# app.py
from flask import (Flask, render_template, request, redirect, url_for, jsonify,
                   session, send_from_directory, abort, send_file, Response,
                   current_app, has_request_context, make_response, flash) # Added make_response and flash (flash was used in display_data)

from flask import  has_request_context
import os
import lasio
from flask_cors import CORS
import json
import threading
import ast
import logging
import time
import math  # For sanitize_for_json helper
from werkzeug.utils import secure_filename
# Note: werkzeug.security hashing is generally less common than bcrypt/passlib for passwords
# from werkzeug.security import generate_password_hash, check_password_hash
import bcrypt
import shutil
import queue
from functools import wraps # Needed for @login_required decorator
from urllib.parse import urlparse # Added for login redirect validation
import numpy as np
import copy # Needed for deep copying dictionaries
from datetime import datetime
from uuid import uuid4
# --- Import utility functions ---
# Ensure these files exist in a 'utils' directory relative to app.py
# try:
    # from utils.file_handling import allowed_file # Assuming save_uploaded_files is not used directly anymore
from utils.folder_structure import get_folder_structure_dict, get_project_structure
from utils.categorize import categorize_las_file, categorize_las_folder # If needed
from utils.WellsParent import WellsParent, getLasAttr4wells
from utils.SelectionLasFunctions import print_logs, removeCorruptlas, removeSubsets, suitify
from utils.SuitSplice.SuitSplice import SuitSplice, read_params, las_export
# from utils.SuitSplice.SuitSplice import SuitSplice, read_params, las_export

#     # Using local project functions now, so no need to import create_project
# except ImportError as e:
#     print(f"ERROR: Failed to import utility function: {e}")
#     print("Please ensure 'utils' directory and required files exist.")
#     # Depending on severity, you might want to exit or handle this differently
#     # exit(1)

ALLOWED_EXTENSIONS = {'las'} # Only allow .las files
# Disable lasio debug logging (reduces console noise)
logging.getLogger('lasio').setLevel(logging.WARNING)

# --- Global Variables & Configuration ---
source_las_tracker = {} # Consider replacing with robust provenance tracking
PROVENANCE_SUFFIX = '_provenance.json' # Required AutoSplice provenance suffix
# --- Define the missing helper function ---
import os
from werkzeug.utils import secure_filename

# Use the specific allowed_file function you provided
def allowed_file(filename):
    """Check if the file extension is allowed"""
    ALLOWED_EXTENSIONS = {'las'} # Only allow .las
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Use the save_uploaded_files function you provided
def save_uploaded_files(files, destination_path):
    """
    Save uploaded files (expecting Flask FileStorage objects)
    to the specified destination path.

    Args:
        files: List of FileStorage objects from request.files.
        destination_path: Path where files should be saved.

    Returns:
        Tuple: (list of saved filenames, list of skipped filenames)
    """
    # Ensure logger is available or use print statements
    try:
        from flask import current_app
        logger = current_app.logger
    except ImportError:
        import logging
        logger = logging.getLogger(__name__) # Basic fallback logger

    os.makedirs(destination_path, exist_ok=True)
    saved_files = []
    skipped_files = []

    logger.debug(f"Attempting to save {len(files)} files to {destination_path}")

    for file_storage in files:
        # Check if it's a FileStorage object and has a filename
        if hasattr(file_storage, 'filename') and file_storage.filename:
            original_filename = file_storage.filename
            if allowed_file(original_filename):
                filename = secure_filename(original_filename)
                if not filename: # Handle cases where secure_filename returns empty
                    logger.warning(f"Skipping file with potentially unsafe name after sanitization: '{original_filename}'")
                    skipped_files.append(original_filename + " (unsafe name)")
                    continue

                file_path = os.path.join(destination_path, filename)

                try:
                    # Reject empty files before saving. Preserve stream position for normal saves.
                    try:
                        current_pos = file_storage.stream.tell()
                        file_storage.stream.seek(0, os.SEEK_END)
                        file_size = file_storage.stream.tell()
                        file_storage.stream.seek(current_pos)
                    except Exception:
                        file_size = None
                    if file_size == 0:
                        logger.warning(f"Skipping empty LAS file: {original_filename}")
                        skipped_files.append(original_filename + " (empty file)")
                        continue

                    # Check if file exists - add overwrite warning if needed
                    if os.path.exists(file_path):
                         logger.warning(f"Overwriting existing file: {file_path}")

                    file_storage.save(file_path)
                    saved_files.append(filename)
                    logger.debug(f"Successfully saved: {file_path}")
                except Exception as e:
                     logger.error(f"Error saving file '{filename}' to '{destination_path}': {e}", exc_info=True)
                     skipped_files.append(original_filename + f" (save error: {e})")

            else:
                logger.warning(f"Skipping disallowed file type: {original_filename}")
                skipped_files.append(original_filename + " (disallowed type)")
        elif isinstance(file_storage, dict):
             # Handle the dictionary case if needed, but the new JS sends FileStorage
             logger.warning(f"Received unexpected dictionary object instead of FileStorage: {file_storage.get('name', 'N/A')}")
             skipped_files.append(file_storage.get('name', 'Unknown Dict File') + " (unexpected format)")
        else:
            logger.warning(f"Skipped an invalid or empty file storage object: {type(file_storage)}")
            skipped_files.append("Unknown/Empty File Object")


    logger.debug(f"Saved {len(saved_files)} files, skipped {len(skipped_files)}")
    return saved_files, skipped_files # Return both lists

# Placeholder for login_required decorator and get_user_project_path function
# Make sure these are correctly defined or imported in your actual app.py

# Example placeholder - replace with your actual implementation
def get_user_project_path(project_name, email):
    # IMPORTANT: Implement proper security checks here!
    # This is just a basic example structure.
    # Ensure project_name and email are validated to prevent path traversal attacks.
    base_user_dir = os.path.join('user_projects', secure_filename(email.split('@')[0])) # Example structure
    project_path = os.path.join(base_user_dir, secure_filename(project_name))
    # Add checks: Does base_user_dir exist? Does project_path belong to the user?
    if not os.path.normpath(project_path).startswith(os.path.normpath(base_user_dir)):
         raise ValueError("Invalid project path.")
    # Create base user dir if it doesn't exist?
    # os.makedirs(base_user_dir, exist_ok=True) # Example
    return project_path

def get_mnemonics_from_las_file(las_path):
    """
    Efficiently reads a LAS file header and returns a list of curve mnemonics.

    Args:
        las_path (str): The full path to the LAS file.

    Returns:
        list: A list of mnemonic strings found in the file's curves,
              or an empty list if the file cannot be read, is invalid,
              or contains no curves.
    """
    mnemonics = [] # Initialize empty list

    # 1. Basic Path Validation
    if not las_path or not isinstance(las_path, str):
        logger.warning(f"get_mnemonics_from_las_file: Invalid path provided: {las_path}")
        return mnemonics # Return empty list

    # 2. Check if file exists
    if not os.path.isfile(las_path):
        logger.warning(f"get_mnemonics_from_las_file: File not found: {las_path}")
        return mnemonics # Return empty list

    # 3. Attempt to read LAS header/curves
    try:
        # ignore_data=True makes it read only header & curve definitions
        # ignore_header_errors=True allows processing even with some header issues
        las = lasio.read(las_path, ignore_data=True, ignore_header_errors=True)

        # Check if LAS object is valid and has curves
        if las and hasattr(las, 'curves') and las.curves:
            mnemonics = [curve.mnemonic for curve in las.curves]
            # logger.debug(f"Mnemonics found in '{os.path.basename(las_path)}': {mnemonics}")
        else:
            logger.warning(f"get_mnemonics_from_las_file: No curves found or LAS object invalid in {las_path}")

    except lasio.LASException as las_err:
        # Specific LAS file format or reading errors
        logger.error(f"get_mnemonics_from_las_file: LASio error reading {las_path}: {las_err}")
    except MemoryError:
        # Handle cases where even the header might be excessively large or corrupt
        logger.error(f"get_mnemonics_from_las_file: MemoryError reading header/curves for {las_path}.")
    except Exception as e:
        # Catch any other unexpected errors during file reading
        logger.error(f"get_mnemonics_from_las_file: Unexpected error reading {las_path}: {e}", exc_info=True) # Log full traceback

    return mnemonics

# Base path for data files (ensure this exists)
basepath = './data'
if not os.path.exists(basepath):
    try:
        os.makedirs(basepath)
        print(f"Created base data directory: {basepath}")
    except OSError as e:
        print(f"FATAL: Could not create base data directory '{basepath}': {e}")
        exit(1) # Exit if essential data path cannot be created

# Configuration file paths
autosplice_params_file_path = os.path.join(basepath, 'autosplice_params.json')
mnemonicsfile = os.path.join(basepath, 'mnemonics_revised.txt')
lwdVSwirelineFile = os.path.join(basepath, 'lwd_wireline_differentiators.txt')
# params_file_path = os.path.join(basepath, 'log_params.npy') # .npy files might be less suitable for config
# licence_file_path = os.path.join(basepath, 'licence.npy') # Consider alternatives for licensing
users_file = os.path.join(basepath, 'users.txt')

# --- Ensure necessary config/data files exist or create defaults ---
def ensure_default_file(filepath, default_content=""):
    if not os.path.exists(filepath):
        try:
            os.makedirs(os.path.dirname(filepath), exist_ok=True) # Ensure parent dir exists
            with open(filepath, 'w') as f:
                f.write(default_content)
            print(f"Created default/empty file: {filepath}")
        except Exception as e:
            print(f"Warning: Could not create default file '{filepath}': {e}")

# Default Autosplice Params
default_autosplice_params = {
    "equal_val_allowed_width": 10,
    "maximum_crossover_distance": 25,
    "minimum_depth_overlap": 5,
    "export_sampling_interval": 0.1524,
    "curve_selection_method": "best_coverage",
    "gap_handling_method": "interpolate_small_gaps",
    "null_value_handling": "preserve_nulls",
    "hist_bins": 50,
    "n_big_patches": 5,
    "nan_patches_gap_ignored": 5
}
if not os.path.exists(autosplice_params_file_path):
     try:
         os.makedirs(os.path.dirname(autosplice_params_file_path), exist_ok=True)
         with open(autosplice_params_file_path, 'w') as f:
             json.dump(default_autosplice_params, f, indent=4)
         print(f"Created default autosplice params file: {autosplice_params_file_path}")
     except Exception as e:
         print(f"Warning: Could not create default autosplice params file: {e}")

# Default Mnemonics
default_mnemonics_content = """# Add mnemonic mappings here (e.g., STANDARD_NAME: [ALIAS1, ALIAS2])
# Lines starting with # are comments. Blank lines are ignored.
# Format: STANDARD_MNEMONIC: [ALIAS_1, ALIAS_2, ...]

GR: [GR, GR_EDTC, GRGC, GRXC, SGR, ECGR]
DEPT: [DEPTH, DEPT_1, MD]
CALI: [CAL, CALI, HCAl, C1]
SP: [SP]
"""
ensure_default_file(mnemonicsfile, default_mnemonics_content)

# Default Users (Create an empty file if none exists)
ensure_default_file(users_file, "# User file format: email:bcrypt_hashed_password\n")
# NOTE: You'll need a separate script or method to add users and hash passwords properly.

# Placeholder checks for other files if needed
ensure_default_file(lwdVSwirelineFile, "# Add mnemonics that differentiate LWD vs Wireline\n")
# ensure_default_file(params_file_path) # If using .npy, creation is more complex
# ensure_default_file(licence_file_path)


# --- Flask App Setup ---
is_production = os.environ.get('FLASK_ENV') == 'production' # Standard way to check env

app = Flask(__name__)
CORS(app) # Allow Cross-Origin Resource Sharing

# Example placeholders - replace if necessary
PROVENANCE_SUFFIX = "_provenance.json"
source_las_tracker = {} # Replace with your actual tracker if used

# Configure session secret key
# app.secret_key = 'your_very_secret_key_here' # Replace with a real secret key


UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY') or 'change_this_default_secret_key_in_prod'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
# SERVER_NAME intentionally not set: allows localhost, 127.0.0.1, and LAN IP access.
app.config['JSON_AS_ASCII'] = False
app.secret_key = os.environ.get('SECRET_KEY') or 'change_this_default_secret_key_in_prod' # CHANGE THIS KEY!
app.config['SESSION_PERMANENT'] = False # Session lasts for browser session
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100 MB upload limit

logging.basicConfig(level=logging.DEBUG if not is_production else logging.INFO) # More logs in dev
logger = logging.getLogger(__name__)
print(f"Mnemonics file being used: {mnemonicsfile}") # Use logger instead of print ideally
logger.info(f"Upload folder set to: {app.config['UPLOAD_FOLDER']}")
logger.info(f"Running in {'Production' if is_production else 'Development'} mode.")


# --- Global Login Enforcement ---
# --- Global Login Enforcement ---
@app.before_request
def require_login():
    # Set session email from X-User-Email if present
    if 'USER_EMAIL' not in session:
        session['USER_EMAIL'] = request.headers.get('X-User-Email', 'autosplice@thedrake.ai')


# In app.py

def sanitize_for_json(data):
    """Recursively replace NaN, Infinity, and numpy types (including deprecated) in nested structures."""
    if isinstance(data, list):
        return [sanitize_for_json(item) for item in data]
    # ***** ADD THIS ELIF BLOCK *****
    elif isinstance(data, tuple):
        # Convert tuple to list after sanitizing elements
        return [sanitize_for_json(item) for item in data]
    # ********************************
    elif isinstance(data, dict):
        return {key: sanitize_for_json(value) for key, value in data.items()}
    # --- Handle Floats ---
    elif isinstance(data, (float, np.float64, np.float32, np.float16, np.floating)): # np.floating covers general floats
        # Check for np.float_ specifically if needed, though np.floating might cover it
        if hasattr(np, 'float_') and isinstance(data, np.float_): # Check if np.float_ exists before using it
            data = float(data)
        # Handle standard checks AFTER potential conversion
        if isinstance(data, float): # Re-check type after potential conversion
            if math.isnan(data) or math.isinf(data):
                return None  # Replace with null for JSON
            return data
        else: # If it became something else weirdly, try converting
            try: return float(data)
            except: return str(data) # Fallback string - should be hit less often now

    # --- Handle Integers ---
    elif isinstance(data, (int, np.int64, np.int32, np.int16, np.int8, np.integer)): # np.integer covers general ints
        # Check for np.int_ specifically if needed
        if hasattr(np, 'int_') and isinstance(data, np.int_):
            return int(data)
        return int(data) # Convert any numpy int to standard int

    # --- Handle Booleans ---
    elif isinstance(data, (bool, np.bool_)): # np.bool_ is the one often used
        return bool(data) # Convert numpy bool to standard bool

    # --- Handle Strings ---
    # Added np.str_ which you had before, and also handling potential bytes
    elif isinstance(data, (str, np.str_, bytes, np.bytes_)):
         if isinstance(data, bytes):
             try:
                 return data.decode('utf-8', errors='replace') # Decode bytes safely
             except Exception:
                 return str(data) # Fallback if decoding fails
         return str(data) # Convert numpy str to standard str


    # --- Handle Numpy Arrays ---
    elif isinstance(data, np.ndarray): # Handle arrays - convert to list
        return sanitize_for_json(data.tolist()) # Recursively sanitize elements

    # --- Handle None ---
    elif data is None:
        return None

    # --- Fallback for other types ---
    else:
        # Fallback for other types: convert to string, log a warning
        # This should now be hit much less often for standard data structures.
        logger.debug(f"Sanitizing unknown type {type(data)} to string.")
        return str(data)

# --- Authentication Helper Functions ---
def verify_password(stored_hash, provided_password):
    """Verifies a password against a stored bcrypt hash."""
    if not stored_hash or not isinstance(stored_hash, str):
        logger.error("Invalid stored hash provided for verification.")
        return False
    if not provided_password or not isinstance(provided_password, str):
        logger.error("Invalid provided password provided for verification.")
        return False
    try:
        # Bcrypt expects bytes
        return bcrypt.checkpw(provided_password.encode('utf-8'), stored_hash.encode('utf-8'))
    except ValueError as ve:
        # Handle cases where the stored_hash might not be a valid bcrypt hash
        logger.error(f"Invalid hash format encountered during password verification: {ve}")
        return False
    except Exception as e:
        logger.error(f"Error during password verification: {e}")
        return False

def load_users():
    """Load users from the users.txt file."""
    if not os.path.exists(users_file):
        logger.warning(f"Users file not found: {users_file}. No users can log in.")
        return {}

    users = {}
    try:
        with open(users_file, 'r') as file:
            for line_num, line in enumerate(file, 1):
                line = line.strip()
                if not line or line.startswith('#'): # Ignore empty/comment lines
                    continue
                parts = line.split(':', 1) # Split only on the first colon
                if len(parts) != 2:
                    logger.error(f"Invalid format in users.txt at line {line_num}: '{line}' - Expected email:hash")
                    continue
                email, hashed_password = parts
                email = email.strip()
                hashed_password = hashed_password.strip()
                if not email or not hashed_password:
                    logger.error(f"Empty email or password hash in users.txt at line {line_num}")
                    continue
                # Basic email format check (optional but recommended)
                if '@' not in email or '.' not in email.split('@')[-1]:
                     logger.warning(f"Potentially invalid email format in users.txt at line {line_num}: {email}")
                users[email] = hashed_password
    except Exception as e:
        logger.error(f"Error reading users file '{users_file}': {e}")
        return {}
    if not users:
        logger.warning(f"No valid user entries found in users file: {users_file}")
    return users

def authenticate(email, password):
    """Check if user exists and password is correct."""
    if not email or not password: return False # Basic validation
    try:
        users = load_users()
        if not users:
            # logger already warns in load_users
            return False
        stored_hash = users.get(email)
        if not stored_hash:
            logger.info(f"Login attempt failed for non-existent user: {email}")
            return False
        return verify_password(stored_hash, password)
    except Exception as e:
        # Avoid logging password directly
        logger.error(f"Authentication system error for user {email}: {e}")
        return False

# --- Helper to get user project path (with security check) ---
def get_user_project_path(project_name, email):
    """Gets the validated path for a user's project."""
    if not email:
        logger.error("get_user_project_path called without email.")
        abort(401, description="User not authenticated")
    if not project_name or not isinstance(project_name, str):
         logger.error(f"get_user_project_path called with invalid project_name '{project_name}'")
         abort(400, description="Invalid project name specified.")

    safe_email = secure_filename(email)
    safe_project_name = secure_filename(project_name)

    if not safe_email or not safe_project_name:
         logger.error(f"Failed to secure filename for email '{email}' or project '{project_name}'")
         abort(400, description="Invalid characters in email or project name.")

    path = os.path.join(app.config['UPLOAD_FOLDER'], safe_email, safe_project_name)

    # Security Check: Prevent path traversal (e.g., project_name = "../..")
    # Ensure the absolute path of the calculated directory starts with the absolute path of the UPLOAD_FOLDER
    absolute_upload_folder = os.path.abspath(app.config['UPLOAD_FOLDER'])
    absolute_path = os.path.abspath(path)

    # On Windows, paths might have different casing, compare lowercased paths
    if os.name == 'nt':
        if not absolute_path.lower().startswith(absolute_upload_folder.lower()):
            logger.critical(f"SECURITY ALERT: Path traversal attempt detected for user '{email}', project '{project_name}', calculated path '{path}'")
            abort(400, description="Invalid project name resulting in forbidden path.")
    else: # On Unix-like systems, comparison is case-sensitive
         if not absolute_path.startswith(absolute_upload_folder):
            logger.critical(f"SECURITY ALERT: Path traversal attempt detected for user '{email}', project '{project_name}', calculated path '{path}'")
            abort(400, description="Invalid project name resulting in forbidden path.")

    return path

# --- Utility Processor for Templates ---
def get_las_files(project_name, well_name, email):
    """Safely get list of .las files for a given well (used in template)."""
    try:
        project_path = get_user_project_path(project_name, email) # Base project path
        safe_well_name = secure_filename(well_name)
        if not safe_well_name:
             logger.warning(f"get_las_files called with invalid well name '{well_name}'")
             return []

        well_path = os.path.join(project_path, safe_well_name)

        las_files = []
        if os.path.isdir(well_path):
            try:
                 # List directory and filter for .las files
                 for f in os.listdir(well_path):
                      # Check extension and ensure it's a file (not subdir)
                      if f.lower().endswith('.las') and os.path.isfile(os.path.join(well_path, f)):
                           las_files.append(f)
                 return sorted(las_files) # Return sorted list
            except OSError as e:
                 logger.error(f"Error listing directory {well_path}: {e}")
                 return [] # Return empty on directory listing error
        else:
             # Well path doesn't exist or isn't a directory
             # logger.debug(f"Well path not found or not a directory: {well_path}") # Reduce noise maybe
             return []
    except Exception as e:
        # Catch potential errors from get_user_project_path or os operations
        logger.error(f"Error getting LAS files for {project_name}/{well_name}: {e}")
        return []

@app.context_processor
def utility_processor():
    # Make the helper available in templates
    return dict(get_las_files=get_las_files)

# ---------------------------
# Routes: Authentication, Home, Projects
# ---------------------------
# app.py

@app.route('/login', methods=['GET', 'POST'])
def login():
    """Login route to handle user authentication."""
    if 'USER_EMAIL' in session: # If already logged in, redirect home/projects
        return redirect(url_for('direct_autosplice'))

    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        if not email or not password:
            return render_template('login.html', message="Email and password are required.")

        if authenticate(email, password):
            session.permanent = False
            # --- HERE is where the session variable is set ---
            session['USER_EMAIL'] = email
            # -------------------------------------------------
            logger.info(f"User logged in successfully: {email}")
            next_url = request.args.get('next')
            # ... (redirect logic) ...
            return redirect(url_for('direct_autosplice')) # Simplified workflow
        else:
            logger.warning(f"Failed login attempt for email: {email}")
            return render_template('login.html', message="Invalid email or password")

    # GET request
    return render_template('login.html')

@app.route('/logout')
def logout():
    """Logout the user and clear session."""
    user_email = session.pop('USER_EMAIL', None)
    session.pop('CURRENT_PROJECT_NAME', None) # Also clear current project
    # Clear potentially large items from session if stored there during processing
    session.pop('well_las_attr_dict', None)
    session.pop('autoselectedfiles', None)
    if user_email:
        logger.info(f"User logged out: {user_email}")
    return redirect(url_for('login'))

@app.route('/')
# @login_required # Redirect to login if not authenticated
def home():
    # Redirect logged-in users directly to their projects page
    return redirect(url_for('direct_autosplice'))


def get_user_projects(email):
    """Safely get list of project directories for a user."""
    projects = []
    try:
        safe_email = secure_filename(email)
        if not safe_email: return [] # Invalid email format
        user_projects_path = os.path.join(app.config['UPLOAD_FOLDER'], safe_email)

        if not os.path.exists(user_projects_path):
            os.makedirs(user_projects_path) # Create user folder if it doesn't exist
            logger.info(f"Created user directory: {user_projects_path}")
            return [] # No projects yet

        if os.path.isdir(user_projects_path):
             try:
                for name in os.listdir(user_projects_path):
                    # Check if 'name' is a directory and avoid hidden folders/files
                    # Also ensure the name doesn't contain invalid chars after potential user creation outside app
                    if not name.startswith('.') and secure_filename(name) == name and os.path.isdir(os.path.join(user_projects_path, name)):
                        projects.append(name)
                    elif secure_filename(name) != name:
                         logger.warning(f"Skipping project with invalid characters in name: '{name}' for user {email}")
             except OSError as e:
                  logger.error(f"Error listing projects for user {email} in {user_projects_path}: {e}")
                  return []
        else:
             logger.warning(f"User path exists but is not a directory: {user_projects_path}")

    except Exception as e:
         logger.error(f"Error getting projects for user {email}: {e}")
         return []
    return sorted(projects)

@app.route('/projects')
# @login_required
def projects():
    email = session['USER_EMAIL']
    user_projects = get_user_projects(email)
    return render_template('projects.html', projects=user_projects, username=email)

# Function to create project (used by route)
def create_project(project_name, email):
    """Creates a project directory for the user."""
    # Basic name validation
    if not project_name or not isinstance(project_name, str) or '/' in project_name or '\\' in project_name or '..' in project_name:
        logger.warning(f"Attempt to create project with invalid name '{project_name}' by user {email}")
        return False, "Invalid project name. Avoid slashes, dots, and empty names."

    try:
        # get_user_project_path handles sanitization (secure_filename) and security checks
        project_path = get_user_project_path(project_name, email)

        if os.path.exists(project_path):
             logger.warning(f"Project '{project_name}' already exists for user {email} at {project_path}")
             return False, f"Project '{project_name}' already exists."

        os.makedirs(project_path)
        logger.info(f"Created project '{project_name}' for user {email} at {project_path}")
        return True, f"Project '{project_name}' created successfully."
    except OSError as e:
        logger.error(f"OS Error creating project directory {project_path}: {e}")
        return False, f"Server OS error creating project: {e}"
    except Exception as e:
        logger.error(f"Error creating project '{project_name}' for user {email}: {e}")
        return False, f"Server error creating project: {e}"

@app.route('/create_project', methods=['POST'])
# @login_required
def create_new_project():
    email = session['USER_EMAIL']
    project_name = request.form.get('project_name', '').strip()

    success, message = create_project(project_name, email)

    if success:
        session['CURRENT_PROJECT_NAME'] = project_name # Set current project
        return jsonify({'success': True, 'redirect': url_for('project_dashboard', project_name=project_name)})
    else:
        # Use 409 Conflict if project already exists, 400 for bad name, 500 for server error
        status_code = 409 if 'already exists' in message else 400 if 'Invalid project name' in message else 500
        return jsonify({'success': False, 'message': message}), status_code




def _safe_float(value):
    """Convert LAS values to finite float; return None for null/invalid values.

    Some uploaded LAS files contain comma-separated values, Fortran D exponents,
    inline comments, or null markers.  Keep this helper permissive so preview,
    validation, and fallback AutoSplice all read the same real curve samples.
    """
    if value is None:
        return None
    try:
        text = str(value).strip()
        if not text:
            return None
        text = text.split('#', 1)[0].strip().replace(',', '')
        if not text:
            return None
        text = text.replace('D', 'E').replace('d', 'e')
        f = float(text)
        if math.isfinite(f):
            return f
    except Exception:
        pass
    return None


def _find_first_las_for_preview(project_path, project_structure):
    """Return (well_name, filename, full_path) for the first available LAS file."""
    if not isinstance(project_structure, dict):
        return None, None, None
    for well_name in sorted(project_structure.keys()):
        files = project_structure.get(well_name) or []
        for filename in sorted(files):
            if filename and filename.lower().endswith('.las'):
                las_path = os.path.join(project_path, well_name, filename)
                if os.path.isfile(las_path):
                    return well_name, filename, las_path
    return None, None, None


def _curve_data_to_float_list(curve):
    """Return a clean python list for a lasio curve without requiring pandas."""
    values = []
    data = getattr(curve, 'data', [])
    if data is None:
        data = []
    for value in data:
        values.append(_safe_float(value))
    return values


def _read_las_numeric_table(las_path):
    """
    Read LAS numeric data without using pandas.

    Some LAS files load with lasio but curve.data can be empty/invalid depending on
    header formatting.  The dashboard preview now reads the LAS data matrix first
    and falls back to a small manual ASCII parser.  This keeps the rest of the app
    unchanged while making the Curve Preview robust for uploaded LAS files such as
    dadol/dado files.
    """
    null_values = {-999.25, -999.0, -9999.0, -999.2500}

    def clean_number(value):
        number = _safe_float(value)
        if number is None:
            return None
        for null_value in null_values:
            if abs(number - null_value) < 1e-9:
                return None
        return number

    def pick_depth_index(names):
        for i, name in enumerate(names):
            upper = str(name or '').upper()
            if upper in ('DEPT', 'DEPTH', 'MD', 'TVD') or 'DEPT' in upper or 'DEPTH' in upper:
                return i
        return 0

    # Primary reader: lasio matrix.  This is more reliable than curve.data for
    # malformed-but-readable files and does not require pandas/las.df().
    try:
        las = lasio.read(las_path, ignore_header_errors=True, null_policy='none')
        curves = list(getattr(las, 'curves', []) or [])
        names = [str(getattr(curve, 'mnemonic', '') or '').strip() or f'CURVE_{i + 1}' for i, curve in enumerate(curves)]
        units = [str(getattr(curve, 'unit', '') or '').strip() for curve in curves]
        raw_data = getattr(las, 'data', None)
        data = np.asarray(raw_data if raw_data is not None else [])
        if data.ndim == 1 and data.size and names:
            data = data.reshape((-1, len(names)))
        if data.ndim == 2 and data.shape[0] > 0 and data.shape[1] > 0:
            if not names or len(names) != data.shape[1]:
                names = [f'CURVE_{i + 1}' for i in range(data.shape[1])]
                units = ['' for _ in names]
            try:
                las_null = clean_number(getattr(getattr(las, 'well', None), 'NULL', None).value)
                if las_null is not None:
                    null_values.add(las_null)
            except Exception:
                pass
            depth_index = pick_depth_index(names)
            depth = [clean_number(row[depth_index]) for row in data]
            preview_curves = []
            for col_index, name in enumerate(names):
                if col_index == depth_index:
                    continue
                preview_curves.append({
                    'name': name,
                    'unit': units[col_index] if col_index < len(units) else '',
                    'values': [clean_number(row[col_index]) for row in data]
                })
            if any(value is not None for value in depth) and preview_curves:
                return depth, preview_curves
    except Exception:
        logger.debug('lasio matrix preview read failed for %s', las_path, exc_info=True)

    # Fallback reader: parse simple LAS ~Curve and ~ASCII sections directly.
    names, units, rows = [], [], []
    section = None
    try:
        with open(las_path, 'r', encoding='utf-8', errors='ignore') as fh:
            for raw_line in fh:
                line = raw_line.strip()
                if not line or line.startswith('#'):
                    continue
                if line.startswith('~'):
                    section_name = line[1:].strip().upper()
                    if section_name.startswith('C'):
                        section = 'CURVE'
                    elif section_name.startswith('A'):
                        section = 'ASCII'
                    else:
                        section = None
                    continue
                if section == 'CURVE':
                    before_colon = line.split(':', 1)[0].strip()
                    if not before_colon:
                        continue
                    name_part = before_colon.split()[0]
                    if '.' in name_part:
                        mnemonic, unit = name_part.split('.', 1)
                    else:
                        mnemonic, unit = name_part, ''
                    mnemonic = mnemonic.strip()
                    if mnemonic:
                        names.append(mnemonic)
                        units.append(unit.strip())
                elif section == 'ASCII':
                    parts = line.replace(',', ' ').split()
                    numeric = [clean_number(part) for part in parts]
                    if numeric:
                        rows.append(numeric)
    except Exception:
        logger.debug('manual LAS preview read failed for %s', las_path, exc_info=True)

    if rows:
        max_cols = max(len(row) for row in rows)
        if not names or len(names) < max_cols:
            names = (names + [f'CURVE_{i + 1}' for i in range(len(names), max_cols)])[:max_cols]
            units = (units + ['' for _ in range(len(units), max_cols)])[:max_cols]
        depth_index = pick_depth_index(names)
        depth = [row[depth_index] if depth_index < len(row) else None for row in rows]
        preview_curves = []
        for col_index, name in enumerate(names[:max_cols]):
            if col_index == depth_index:
                continue
            preview_curves.append({
                'name': name,
                'unit': units[col_index] if col_index < len(units) else '',
                'values': [row[col_index] if col_index < len(row) else None for row in rows]
            })
        if any(value is not None for value in depth) and preview_curves:
            return depth, preview_curves

    return [], []


def _iter_las_files_for_preview(project_path, project_structure):
    """Yield all available LAS files in a stable order."""
    if not isinstance(project_structure, dict):
        return
    for well_name in sorted(project_structure.keys()):
        files = project_structure.get(well_name) or []
        for filename in sorted(files):
            if filename and filename.lower().endswith('.las'):
                las_path = os.path.join(project_path, well_name, filename)
                if os.path.isfile(las_path):
                    yield well_name, filename, las_path


def build_curve_preview_data(project_path, project_structure, max_points=160):
    """
    Build real SVG polyline points from uploaded LAS files.

    Fixed: preview now reads depth and curves from the LAS numeric table directly,
    with a manual fallback for lightly malformed LAS files.  It also skips an
    unreadable/empty LAS and tries the next uploaded LAS, so one bad file does
    not block the dashboard curve preview.
    """
    colors = ['#14b86a', '#f0b400', '#00d2ff', '#8a4dff', '#ffffff']
    preferred = ['GR', 'RHOB', 'NPHI', 'DT', 'CALI']
    candidates = list(_iter_las_files_for_preview(project_path, project_structure) or [])
    if not candidates:
        return {
            'source_well': None,
            'source_file': None,
            'depth_min': None,
            'depth_max': None,
            'tracks': [],
            'message': 'No LAS files found. Import LAS files to enable the curve preview.'
        }

    errors = []
    last_identity = candidates[0]

    for well_name, filename, las_path in candidates:
        last_identity = (well_name, filename, las_path)
        try:
            depth_values, available_curves = _read_las_numeric_table(las_path)
            if not depth_values or not available_curves:
                raise ValueError('LAS file has no readable numeric curve data')

            valid_depths = [v for v in depth_values if v is not None]
            if not valid_depths:
                raise ValueError('No valid depth values found in LAS file')
            depth_min, depth_max = min(valid_depths), max(valid_depths)
            if depth_max == depth_min:
                depth_max = depth_min + 1.0

            available = {}
            ordered = []
            for curve in available_curves:
                name = str(curve.get('name') or '').strip()
                if not name:
                    continue
                curve_item = {
                    'name': name,
                    'unit': curve.get('unit') or '',
                    'values': curve.get('values') or []
                }
                ordered.append(curve_item)
                available[name.upper()] = curve_item

            selected = []
            for mnemonic in preferred:
                if mnemonic in available:
                    selected.append(available[mnemonic])
            if len(selected) < 5:
                existing = {item['name'].upper() for item in selected}
                for curve in ordered:
                    if curve['name'].upper() in existing:
                        continue
                    selected.append(curve)
                    existing.add(curve['name'].upper())
                    if len(selected) >= 5:
                        break

            row_count = len(depth_values)
            if row_count <= 0:
                raise ValueError('LAS file has no curve data rows')
            if row_count > max_points:
                indices = np.linspace(0, row_count - 1, max_points).astype(int)
            else:
                indices = np.arange(row_count)

            tracks = []
            for curve in selected[:5]:
                label = curve['name']
                curve_values = curve.get('values') or []
                limit = min(len(depth_values), len(curve_values))
                pairs = []
                values_for_scale = []
                for i in indices:
                    ii = int(i)
                    if ii >= limit:
                        continue
                    d = depth_values[ii]
                    v = curve_values[ii]
                    if d is None or v is None:
                        continue
                    pairs.append((d, v))
                    values_for_scale.append(v)
                if not pairs or not values_for_scale:
                    continue

                try:
                    x_min = float(np.nanpercentile(values_for_scale, 2))
                    x_max = float(np.nanpercentile(values_for_scale, 98))
                except Exception:
                    x_min, x_max = min(values_for_scale), max(values_for_scale)
                if not math.isfinite(x_min) or not math.isfinite(x_max) or x_max == x_min:
                    x_min, x_max = min(values_for_scale), max(values_for_scale)
                if x_max == x_min:
                    x_min, x_max = x_min - 1.0, x_max + 1.0

                point_tokens = []
                for d, v in pairs:
                    x = 5.0 + max(0.0, min(1.0, (v - x_min) / (x_max - x_min))) * 90.0
                    y = max(0.0, min(1.0, (d - depth_min) / (depth_max - depth_min))) * 280.0
                    point_tokens.append(f'{x:.2f},{y:.2f}')

                tracks.append({
                    'name': label,
                    'unit': curve.get('unit') or '',
                    'points': ' '.join(point_tokens),
                    'color': colors[len(tracks) % len(colors)],
                    'x_min': round(x_min, 4),
                    'x_max': round(x_max, 4),
                })

            if not tracks:
                raise ValueError('LAS file was read, but no plottable curve data was found')

            return {
                'source_well': well_name,
                'source_file': filename,
                'depth_min': round(depth_min, 2),
                'depth_max': round(depth_max, 2),
                'tracks': tracks,
                'message': None
            }
        except Exception as e:
            logger.warning('Skipping LAS preview file %s: %s', las_path, e)
            errors.append(f'{filename}: {e}')
            continue

    well_name, filename, las_path = last_identity
    return {
        'source_well': well_name,
        'source_file': filename,
        'depth_min': None,
        'depth_max': None,
        'tracks': [],
        'message': 'Curve preview could not read uploaded LAS files: ' + '; '.join(errors[:3])
    }


# ---------------------------
# Project Dashboard Route
# ---------------------------
@app.route('/project/<project_name>')
# @login_required
def project_dashboard(project_name):
    email = session['USER_EMAIL']
    # Validate project exists for the user and get path safely
    try:
        project_path = get_user_project_path(project_name, email)
        if not os.path.isdir(project_path):
            logger.warning(f"Project '{project_name}' not found or not a directory for user {email}")
            abort(404, description="Project not found.")
    except Exception as e:
        logger.error(f"Error accessing project path for {project_name}: {e}")
        abort(400, description="Invalid project name or path error.")

    session['CURRENT_PROJECT_NAME'] = project_name # Set context
    logger.info(f"Accessing project dashboard: {project_name} for user {email}")

    # Get project structure (wells and their LAS files)
    project_structure = get_project_structure(project_path) # Assumes this returns {well: [file1, file2]}
    curve_preview_data = build_curve_preview_data(project_path, project_structure)
    # Get list of generated spliced logs (directly under project path)
    spliced_logs_map = get_spliced_logs(project_path) # Assumes this returns {well: filename}
    print(f"**********************************************\n  {spliced_logs_map} \n**********************************************")

    return render_template('well_selection.html',
                           project_name=project_name,
                           project_structure=project_structure,
                           curve_preview=curve_preview_data,
                           spliced_logs=spliced_logs_map) # Pass the map

def get_spliced_logs(project_path):
    """Finds files ending in _spliced.las directly under project_path."""
    spliced_logs = {} # {well_name: filename}
    if not os.path.isdir(project_path): return {} # Project path must exist
    try:
        for item in os.listdir(project_path):
            item_path = os.path.join(project_path, item)
            # Check name pattern and ensure it's a file
            if item.lower().endswith('_spliced.las') and os.path.isfile(item_path):
                # Extract well name (handle potential edge cases)
                well_name_part = item[:-len('_spliced.las')]
                # Ensure the extracted part is a valid directory/well name (basic check)
                if well_name_part and secure_filename(well_name_part) == well_name_part:
                     # Check if a directory with this name exists (confirming it's likely a well)
                     # THIS CHECK MIGHT BE TOO STRICT if spliced files are ONLY at root
                     # well_dir_path = os.path.join(project_path, well_name_part)
                     # if os.path.isdir(well_dir_path):
                     spliced_logs[well_name_part] = item # Map well name to filename
                     # else:
                     #    logger.warning(f"Found {item}, but no corresponding well directory named '{well_name_part}'. Assuming it's a valid spliced log.")
                     #    spliced_logs[well_name_part] = item # Still add it if needed
                else:
                    logger.warning(f"Found spliced log with potentially invalid well name part: {item}")
    except OSError as e:
        logger.error(f"Error listing directory for spliced logs {project_path}: {e}")
    except Exception as e:
        logger.error(f"Unexpected error finding spliced logs in {project_path}: {e}")
    return spliced_logs


@app.route('/project/<project_name>/well/<well_name>/file/<file_name>', methods=['DELETE'])
# @login_required
def remove_las_file(project_name, well_name, file_name):
    email = session.get('USER_EMAIL')
    if not email: return jsonify({'success': False, 'message': 'Authentication required'}), 401

    try:
        project_path = get_user_project_path(project_name, email)
        safe_well_name = secure_filename(well_name)
        safe_file_name = secure_filename(file_name)
        if not safe_well_name or not safe_file_name:
            return jsonify({'success': False, 'message': 'Invalid well or file name characters'}), 400

        file_path = os.path.join(project_path, safe_well_name, safe_file_name)

        if os.path.isfile(file_path): # Check if it's a file
            os.remove(file_path)
            logger.info(f"Removed LAS file: {file_path} by user {email}")
            # If this is the last file for the well in the tracker, update tracker? (Maybe not necessary)
            # if well_name in source_las_tracker and file_name in source_las_tracker[well_name]:
            #     source_las_tracker[well_name].remove(file_name)
            return jsonify({'success': True, 'message': f'File "{file_name}" removed.'})
        elif os.path.exists(file_path):
             logger.warning(f"Attempted to remove LAS file, but path is not a file: {file_path}")
             return jsonify({'success': False, 'message': 'Path exists but is not a file.'}), 409
        else:
            logger.warning(f"Attempted to remove non-existent LAS file: {file_path}")
            return jsonify({'success': False, 'message': 'File does not exist'}), 404
    except OSError as e:
         logger.error(f"OS error removing LAS file {file_path}: {e}")
         return jsonify({'success': False, 'message': f'Error removing file: {e}'}), 500
    except Exception as e:
        logger.exception(f"Error removing LAS file {file_name} from {well_name}: {e}")
        return jsonify({'success': False, 'message': f'An unexpected error occurred: {e}'}), 500



# ---------------------------
# Import Wells Route (Initiates JS process) - No changes needed here based on error
# ---------------------------
@app.route('/project/<project_name>/import_wells', methods=['POST'])
# @login_required
def import_wells(project_name):
    email = session.get('USER_EMAIL')
    if not email: return jsonify({'success': False, 'message': 'Authentication required'}), 401
    if not project_name: return jsonify({'success': False, 'message': 'Project name missing'}), 400

    try:
        project_path = get_user_project_path(project_name, email)
        if not os.path.isdir(project_path):
            return jsonify({'success': False, 'message': 'Project not found'}), 404
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error accessing project: {e}'}), 500

    # This endpoint now only acknowledges the start, actual uploads handled by JS
    logger.info(f"Received request to start well import process for project '{project_name}' by user {email}.")
    return jsonify({'success': True, 'message': 'Import process initiated. Files will be uploaded individually.'})

# Keep the create_well_dir route from the NEWER code (it's fine)
@app.route('/project/<project_name>/create_well', methods=['POST'])
# @login_required
def create_well_dir(project_name):
    email = session.get('USER_EMAIL')
    well_name = request.form.get('well_name', '').strip()

    if not email: return jsonify({'success': False, 'message': 'Authentication required'}), 401
    if not project_name or not well_name:
        return jsonify({'success': False, 'message': 'Project name and well name are required'}), 400

    try:
        project_path = get_user_project_path(project_name, email)
        safe_well_name = secure_filename(well_name)
        if not safe_well_name or '..' in safe_well_name or '/' in safe_well_name or '\\' in safe_well_name:
            return jsonify({'success': False, 'message': 'Invalid characters in well name'}), 400

        well_path = os.path.join(project_path, safe_well_name)

        if os.path.exists(well_path):
            if not os.path.isdir(well_path):
                logger.warning(f"Cannot create well directory, file exists: {well_path}")
                return jsonify({'success': False, 'message': f"A file named '{well_name}' already exists."}), 409
            else:
                logger.info(f"Well directory already exists: {well_path}")
                # Return success even if it exists, as the goal is fulfilled
                return jsonify({'success': True, 'message': f'Well directory {well_name} already exists.'})
        else:
            os.makedirs(well_path)
            logger.info(f"Created well directory: {well_path}")
            return jsonify({'success': True, 'message': f'Well directory {well_name} created successfully.'})

    except OSError as e:
        logger.error(f"OS error creating/accessing well directory {well_path}: {e}", exc_info=True)
        return jsonify({'success': False, 'message': f'Could not create/access well directory: {e}'}), 500
    except Exception as e:
        logger.error(f"Error handling create well {well_name} in {project_name}: {e}", exc_info=True)
        return jsonify({'success': False, 'message': f'Internal server error creating well directory: {e}'}), 500


# **MODIFY** the import_las_files route to use your helpers
@app.route('/project/<project_name>/well/<well_name>/import_las', methods=['POST'])
# @login_required
def import_las_files(project_name, well_name):
    email = session.get('USER_EMAIL')
    if not email: return jsonify({'success': False, 'message': 'Authentication required'}), 401
    if not project_name or not well_name:
        return jsonify({'success': False, 'message': 'Project and well name required'}), 400
    print(f"Importing LAS files for {project_name}/{well_name}")
    try:
        project_path = get_user_project_path(project_name, email) # Validated project path
        safe_well_name = secure_filename(well_name)
        if not safe_well_name:
            return jsonify({'success': False, 'message': 'Invalid well name characters'}), 400

        well_path = os.path.join(project_path, safe_well_name)

        # Ensure the well directory exists (important!)
        if not os.path.isdir(well_path):
            # This should ideally not happen if create_well was called first by JS,
            # but handle it defensively.
            logger.warning(f"Well directory not found for LAS import: {well_path}. Attempting to create.")
            try:
                os.makedirs(well_path, exist_ok=True)
            except OSError as e:
                logger.error(f"Could not create well directory during LAS import: {e}")
                return jsonify({'success': False, 'message': f'Target well directory does not exist and could not be created: {e}'}), 500

        logger.debug(f"Import target path: {well_path}")

    except Exception as e: # Catch errors from get_user_project_path as well
        logger.exception(f"Error setting up path for LAS import: {project_name}/{well_name}")
        return jsonify({'success': False, 'message': f'Server error preparing for import: {e}'}), 500

    # Accept both names used by different browsers/pages: files[] and files
    if 'files[]' in request.files:
        files_to_save = request.files.getlist('files[]')
    elif 'files' in request.files:
        files_to_save = request.files.getlist('files')
    else:
        logger.error("No files part in the import LAS request. Keys: %s", list(request.files.keys()))
        return jsonify({'success': False, 'message': 'No LAS files found in request'}), 400

    # Get the list of FileStorage objects
    logger.debug(f"Received {len(files_to_save)} file(s) for well '{well_name}'")

    if not files_to_save:
         return jsonify({'success': False, 'message': 'No files received for import.'}), 400

    # Use the provided save_uploaded_files function
    try:
        saved_list, skipped_list = save_uploaded_files(files_to_save, well_path)
    except Exception as e:
        logger.exception(f"Error occurred within save_uploaded_files for well '{well_name}'")
        return jsonify({'success': False, 'message': f'An error occurred during file saving: {e}'}), 500

    # --- Construct Response ---
    saved_count = len(saved_list)
    skipped_count = len(skipped_list)
    total_received = saved_count + skipped_count # Or len(files_to_save)

    if saved_count > 0:
        message = f'Imported {saved_count} of {total_received} file(s) to well "{well_name}".'
        if skipped_count > 0:
            message += f" Skipped {skipped_count} (check logs for details: {'; '.join(skipped_list[:3])}{'...' if len(skipped_list) > 3 else ''})."
        logger.info(f"LAS Import Summary for {project_name}/{well_name}: {message}")
        return jsonify({'success': True, 'message': message, 'saved_files': saved_list, 'skipped_files': skipped_list})
    elif skipped_count > 0:
         skipped_preview = '; '.join(skipped_list[:3])
         skipped_suffix = '...' if len(skipped_list) > 3 else ''
         message = f'No valid LAS files imported to well "{well_name}". Skipped {skipped_count} file(s) (check logs for details: {skipped_preview}{skipped_suffix}).'
         logger.warning(f"LAS Import Failed for {project_name}/{well_name}: {message}")
         return jsonify({'success': False, 'message': message, 'skipped_files': skipped_list}), 400 # Bad request as nothing useful was processed
    else:
         # This case should ideally not happen if files_to_save was not empty, but handle it.
         message = f'No files were processed for well "{well_name}".'
         logger.warning(f"LAS Import: {message} for {project_name}/{well_name}")
         return jsonify({'success': False, 'message': message}), 400

# ---------------------------
# Remove Well & Remove LAS File Routes - No changes needed here based on error
# ---------------------------
@app.route('/project/<project_name>/remove_well/<well_name>', methods=['DELETE'])
# @login_required
def remove_well(project_name, well_name):
    email = session.get('USER_EMAIL')
    if not email: return jsonify({'success': False, 'message': 'Authentication required'}), 401

    try:
        project_path = get_user_project_path(project_name, email) # Base project path
        safe_well_name = secure_filename(well_name)
        if not safe_well_name:
            return jsonify({'success': False, 'message': 'Invalid well name characters'}), 400
        well_path = os.path.join(project_path, safe_well_name) # Full path to the well directory

        if os.path.isdir(well_path): # Ensure it's a directory before removing
            shutil.rmtree(well_path)
            logger.info(f"Removed well directory: {well_path} by user {email}")

            # Clean up associated spliced file and provenance
            spliced_file = os.path.join(project_path, f"{safe_well_name}_spliced.las")
            provenance_file = os.path.join(project_path, f"{safe_well_name}_spliced{PROVENANCE_SUFFIX}")
            if os.path.exists(spliced_file): os.remove(spliced_file); logger.info(f"Removed associated spliced file: {spliced_file}")
            if os.path.exists(provenance_file): os.remove(provenance_file); logger.info(f"Removed associated provenance file: {provenance_file}")
            # Remove from legacy tracker if exists
            source_las_tracker.pop(well_name, None)

            return jsonify({'success': True, 'message': f'Well "{well_name}" removed.'})
        elif os.path.exists(well_path):
            logger.error(f"Attempted to remove well, but path is not a directory: {well_path}")
            return jsonify({'success': False, 'message': 'Well path exists but is not a directory.'}), 409
        else:
            logger.warning(f"Attempted to remove non-existent well directory: {well_path}")
            # Also clean up associated files just in case they exist without the dir
            spliced_file = os.path.join(project_path, f"{safe_well_name}_spliced.las")
            provenance_file = os.path.join(project_path, f"{safe_well_name}_spliced{PROVENANCE_SUFFIX}")
            if os.path.exists(spliced_file): os.remove(spliced_file); logger.info(f"Removed orphaned spliced file: {spliced_file}")
            if os.path.exists(provenance_file): os.remove(provenance_file); logger.info(f"Removed orphaned provenance file: {provenance_file}")
            source_las_tracker.pop(well_name, None)
            return jsonify({'success': False, 'message': 'Well does not exist'}), 404
    except OSError as e:
        logger.error(f"OS error removing well directory {well_path}: {e}")
        return jsonify({'success': False, 'message': f'Error removing well directory: {e}'}), 500
    except Exception as e:
        logger.exception(f"Error removing well {well_name} in project {project_name}: {e}")
        return jsonify({'success': False, 'message': f'An unexpected error occurred: {e}'}), 500


# --- AutoSplice validation and fallback merge helpers ---
def get_autosplice_params():
    """Read AutoSplice settings from data/autosplice_params.json and fill missing defaults."""
    defaults = dict(default_autosplice_params)
    try:
        if os.path.exists(autosplice_params_file_path):
            with open(autosplice_params_file_path, 'r', encoding='utf-8') as f:
                raw = json.load(f)
            if isinstance(raw, dict):
                defaults.update(raw)
    except Exception as exc:
        logger.warning("Could not read AutoSplice params, using defaults: %s", exc)
    # type normalization
    int_keys = ["equal_val_allowed_width", "hist_bins", "n_big_patches", "nan_patches_gap_ignored"]
    float_keys = ["maximum_crossover_distance", "minimum_depth_overlap", "export_sampling_interval"]
    for k in int_keys:
        try: defaults[k] = int(defaults.get(k, default_autosplice_params.get(k, 1)))
        except Exception: defaults[k] = int(default_autosplice_params.get(k, 1))
    for k in float_keys:
        try: defaults[k] = float(defaults.get(k, default_autosplice_params.get(k, 0.0)))
        except Exception: defaults[k] = float(default_autosplice_params.get(k, 0.0))
    for k in ["curve_selection_method", "gap_handling_method", "null_value_handling"]:
        defaults[k] = str(defaults.get(k, default_autosplice_params.get(k, "")))
    return defaults


def save_autosplice_params(params):
    merged = get_autosplice_params()
    if isinstance(params, dict):
        merged.update(params)
    # Normalize through getter by writing then re-reading-style conversion locally
    os.makedirs(os.path.dirname(autosplice_params_file_path), exist_ok=True)
    with open(autosplice_params_file_path, 'w', encoding='utf-8') as f:
        json.dump(sanitize_for_json(merged), f, indent=4)
    return get_autosplice_params()


def _las_depth_curve_name(las):
    try:
        if getattr(las, 'index', None) is not None and getattr(las.index, 'mnemonic', None):
            return las.index.mnemonic
    except Exception:
        pass
    if las.curves:
        return las.curves[0].mnemonic
    return 'DEPT'


def validate_las_file(las_path):
    """Return user-facing validation metadata for one LAS file.

    Fixed: use the same robust LAS numeric reader as the curve preview when lasio
    cannot expose curve.data correctly.  This prevents valid-but-lightly-malformed
    LAS files from disabling Process / Generate buttons.
    """
    meta = {
        'filename': os.path.basename(las_path),
        'exists': os.path.exists(las_path),
        'valid': False,
        'status': 'Missing',
        'quality': 'Failed',
        'warnings': [],
        'depthrange': 'N/A',
        'depth_min': None,
        'depth_max': None,
        'curves': [],
        'categories': [],
        'curve_count': 0,
        'row_count': 0,
        'coverage_score': 0,
    }
    if not meta['exists']:
        meta['warnings'].append('LAS file is missing on disk.')
        return meta
    if os.path.getsize(las_path) <= 0:
        meta['status'] = 'Empty file'
        meta['warnings'].append('LAS file is empty.')
        return meta

    def apply_numeric_table(depth_values, available_curves, source_label):
        valid_depths = [d for d in depth_values if d is not None and math.isfinite(float(d))]
        plottable = []
        for curve in available_curves or []:
            vals = [v for v in (curve.get('values') or []) if v is not None and math.isfinite(float(v))]
            if vals:
                plottable.append(curve)
        if len(valid_depths) < 2:
            meta['status'] = 'No curve data rows'
            meta['warnings'].append('LAS file has no readable depth rows.')
            return False
        if not plottable:
            meta['status'] = 'No plottable curves'
            meta['warnings'].append('No numeric curves were found after depth.')
            return False
        dmin = float(min(valid_depths)); dmax = float(max(valid_depths))
        if not math.isfinite(dmin) or not math.isfinite(dmax) or dmax <= dmin:
            meta['status'] = 'Invalid depth range'
            meta['warnings'].append('Could not detect a valid depth range.')
            return False
        curve_names = [str(c.get('name') or f'CURVE_{i + 1}').strip() for i, c in enumerate(plottable)]
        meta.update({
            'valid': True,
            'status': 'Valid',
            'quality': 'Ready',
            'depth_min': round(dmin, 3),
            'depth_max': round(dmax, 3),
            'depthrange': [round(dmin, 3), round(dmax, 3)],
            'curves': curve_names,
            'categories': curve_names,
            'curve_count': len(curve_names),
            'row_count': int(len(depth_values)),
            'coverage_score': round((dmax - dmin) * max(1, len(curve_names)), 3),
        })
        if source_label != 'lasio':
            meta['warnings'].append(f'Read using {source_label} parser because LAS header/data format is non-standard.')
        return True

    # First try lasio normally.
    try:
        las = lasio.read(las_path, ignore_header_errors=True, null_policy='none')
        curves = [c.mnemonic for c in las.curves]
        meta['curves'] = curves
        meta['categories'] = curves
        meta['curve_count'] = len(curves)
        if len(curves) >= 2:
            dname = _las_depth_curve_name(las)
            try:
                depth_unit = getattr(las.curves[dname], 'unit', '') or depth_unit
            except Exception:
                pass
            depth = np.asarray(las[dname], dtype=float)
            finite_depth = depth[np.isfinite(depth)]
            meta['row_count'] = int(len(depth))
            if len(finite_depth) >= 2:
                dmin = float(np.nanmin(finite_depth)); dmax = float(np.nanmax(finite_depth))
                data_curve_count = 0
                data_curve_names = []
                for c in curves:
                    if c == dname:
                        continue
                    try:
                        vals = np.asarray(las[c], dtype=float)
                        if np.isfinite(vals).sum() > 0:
                            data_curve_count += 1
                            data_curve_names.append(c)
                    except Exception:
                        continue
                if data_curve_count > 0 and math.isfinite(dmin) and math.isfinite(dmax) and dmax > dmin:
                    meta.update({
                        'valid': True,
                        'status': 'Valid',
                        'quality': 'Ready',
                        'depth_min': round(dmin, 3),
                        'depth_max': round(dmax, 3),
                        'depthrange': [round(dmin, 3), round(dmax, 3)],
                        'curves': data_curve_names,
                        'categories': data_curve_names,
                        'curve_count': data_curve_count,
                        'coverage_score': round((dmax-dmin) * max(1, data_curve_count), 3),
                    })
                    return meta
        meta['warnings'].append('lasio did not expose usable numeric curve arrays; trying text-table parser.')
    except Exception as exc:
        meta['warnings'].append(f'lasio read warning: {exc}; trying text-table parser.')

    # Fallback for files with non-standard curve/header formatting.
    try:
        depth_values, available_curves = _read_las_numeric_table(las_path)
        if apply_numeric_table(depth_values, available_curves, 'text-table'):
            return meta
    except Exception as exc:
        meta['warnings'].append(f'text-table read failed: {exc}')

    if meta['status'] in ('Missing', 'Valid'):
        meta['status'] = 'Corrupt / unreadable'
    return meta


def build_well_validation(project_path, well_name):
    safe_well = secure_filename(well_name)
    well_path = os.path.join(project_path, safe_well)
    result = {}
    if not os.path.isdir(well_path):
        return result
    seen_hashes = {}
    for fname in sorted(os.listdir(well_path)):
        if not fname.lower().endswith('.las'):
            continue
        safe_fname = secure_filename(fname)
        las_path = os.path.join(well_path, safe_fname)
        meta = validate_las_file(las_path)
        # Duplicate detection by size + first/last bytes, cheap and safe.
        try:
            sig = (os.path.getsize(las_path), open(las_path, 'rb').read(256))
            if sig in seen_hashes:
                meta['warnings'].append(f"Possible duplicate of {seen_hashes[sig]}")
                meta['duplicate_of'] = seen_hashes[sig]
            else:
                seen_hashes[sig] = safe_fname
        except Exception:
            pass
        result[safe_fname] = meta
    return result


def auto_select_valid_files(validation_by_well):
    """Select valid LAS files, ordered by coverage/curve richness."""
    selected = {}
    for well, files in validation_by_well.items():
        valid_items = [(fname, meta) for fname, meta in files.items() if meta.get('valid')]
        valid_items.sort(key=lambda item: (item[1].get('coverage_score', 0), item[1].get('curve_count', 0)), reverse=True)
        selected[well] = [fname for fname, _ in valid_items]
    return selected


def fallback_splice_las(project_path, well, files, output_path, params):
    """Simple robust LAS splicer: union curves on a common depth grid, first valid source wins.

    Fixed: when lasio cannot expose arrays for an uploaded LAS, fall back to the
    same text-table parser used by the preview/validation.  This keeps AutoSplice
    working for non-standard LAS files without touching the rest of the UI.
    """
    safe_well = secure_filename(well)
    inputs = []
    curve_units = {}
    curve_sources = {}
    global_min = None; global_max = None
    depth_unit = 'm'

    def add_input_from_numeric(fname, depth_values, available_curves):
        nonlocal global_min, global_max
        clean_depth = np.asarray([np.nan if d is None else float(d) for d in depth_values], dtype=float)
        mask_depth = np.isfinite(clean_depth)
        if mask_depth.sum() < 2:
            return False
        order = np.argsort(clean_depth[mask_depth])
        depth_sorted = clean_depth[mask_depth][order]
        curves = {}
        for curve in available_curves or []:
            name = str(curve.get('name') or '').strip()
            if not name:
                continue
            raw_values = curve.get('values') or []
            if len(raw_values) != len(depth_values):
                # Pad/truncate so indexing remains safe.
                raw_values = (list(raw_values) + [None] * len(depth_values))[:len(depth_values)]
            vals = np.asarray([np.nan if v is None else float(v) for v in raw_values], dtype=float)
            vals_sorted = vals[mask_depth][order]
            good = np.isfinite(vals_sorted)
            if good.sum() < 2:
                continue
            d_good = depth_sorted[good]
            v_good = vals_sorted[good]
            uniq_depth, uniq_idx = np.unique(d_good, return_index=True)
            if len(uniq_depth) < 2:
                continue
            curves[name] = (uniq_depth, v_good[uniq_idx])
            curve_units.setdefault(name, curve.get('unit') or '')
            curve_sources.setdefault(name, []).append({'input_file': fname, 'curve': name})
        if not curves:
            return False
        dmin = float(np.nanmin(depth_sorted)); dmax = float(np.nanmax(depth_sorted))
        inputs.append({'filename': fname, 'depth_min': dmin, 'depth_max': dmax, 'curves': curves})
        global_min = dmin if global_min is None else min(global_min, dmin)
        global_max = dmax if global_max is None else max(global_max, dmax)
        return True

    for fname in files:
        fpath = os.path.join(project_path, safe_well, secure_filename(fname))
        meta = validate_las_file(fpath)
        if not meta.get('valid'):
            continue
        loaded = False
        try:
            las = lasio.read(fpath, ignore_header_errors=True, null_policy='none')
            dname = _las_depth_curve_name(las)
            depth = np.asarray(las[dname], dtype=float)
            order = np.argsort(depth)
            depth = depth[order]
            mask_depth = np.isfinite(depth)
            depth = depth[mask_depth]
            curves = {}
            for curve in las.curves:
                name = curve.mnemonic
                if name == dname:
                    continue
                try:
                    vals = np.asarray(las[name], dtype=float)[order][mask_depth]
                except Exception:
                    continue
                good = np.isfinite(vals)
                if good.sum() == 0:
                    continue
                d_good = depth[good]; v_good = vals[good]
                if len(d_good) < 2:
                    continue
                uniq_depth, uniq_idx = np.unique(d_good, return_index=True)
                if len(uniq_depth) < 2:
                    continue
                curves[name] = (uniq_depth, v_good[uniq_idx])
                curve_units.setdefault(name, getattr(curve, 'unit', '') or '')
                curve_sources.setdefault(name, []).append({'input_file': fname, 'curve': name})
            if curves:
                inputs.append({'filename': fname, 'depth_min': float(depth.min()), 'depth_max': float(depth.max()), 'curves': curves})
                global_min = float(depth.min()) if global_min is None else min(global_min, float(depth.min()))
                global_max = float(depth.max()) if global_max is None else max(global_max, float(depth.max()))
                loaded = True
        except Exception:
            loaded = False
        if not loaded:
            depth_values, available_curves = _read_las_numeric_table(fpath)
            add_input_from_numeric(fname, depth_values, available_curves)

    if not inputs or global_min is None or global_max is None or global_max <= global_min:
        raise RuntimeError('No valid LAS files with usable curve data were available for splicing.')
    try:
        step = float(params.get('export_sampling_interval', 0.1524))
        if step <= 0 or not math.isfinite(step):
            step = 0.1524
    except Exception:
        step = 0.1524
    # Limit grid size to avoid accidental huge memory use.
    n = int(math.floor((global_max - global_min) / step)) + 1
    if n > 250000:
        step = (global_max - global_min) / 250000
        n = 250001
    grid = global_min + np.arange(n) * step
    all_curve_names = sorted(curve_sources.keys())
    las_out = lasio.LASFile()
    las_out.well.WELL.value = well
    las_out.well.NULL.value = -999.25
    las_out.append_curve('DEPT', grid, unit=depth_unit or 'm', descr='Depth')
    output_curve_sources = {}
    for cname in all_curve_names:
        merged = np.full_like(grid, np.nan, dtype=float)
        output_curve_sources[cname] = []
        for item in sorted(inputs, key=lambda x: x['depth_min']):
            if cname not in item['curves']:
                continue
            d, v = item['curves'][cname]
            valid_span = (grid >= d.min()) & (grid <= d.max())
            if not valid_span.any():
                continue
            interp = np.interp(grid[valid_span], d, v, left=np.nan, right=np.nan)
            target_idx = np.where(valid_span)[0]
            fill = np.isnan(merged[target_idx]) & np.isfinite(interp)
            merged[target_idx[fill]] = interp[fill]
            if fill.any():
                output_curve_sources[cname].append({
                    'input_file': item['filename'], 'curve': cname,
                    'depth_from': round(float(grid[target_idx[fill][0]]), 3),
                    'depth_to': round(float(grid[target_idx[fill][-1]]), 3)
                })
        las_out.append_curve(cname, merged, unit=curve_units.get(cname, ''), descr=f'AutoSplice merged {cname}')
    las_out.write(output_path, version=2.0, wrap=False)
    return {
        'input_files': [i['filename'] for i in inputs],
        'output_curves': output_curve_sources,
        'depth_min': round(global_min, 3),
        'depth_max': round(global_max, 3),
        'curve_count': len(all_curve_names),
        'engine': 'fallback_lasio_grid_merge'
    }


# --- Simplified direct Auto Log Splicer visualization helpers ---
def _choose_visual_curves(las_paths, max_curves=4):
    priority = ['GR', 'CGR', 'RHOB', 'RHOZ', 'NPHI', 'TNPH', 'RT', 'ILD', 'ILM', 'AT90', 'DT', 'DTC']
    found = []
    for path in las_paths:
        try:
            las = lasio.read(path, ignore_header_errors=True)
            cols = [str(c.mnemonic).upper() for c in las.curves]
            for p in priority:
                for c in cols:
                    if c == p or c.startswith(p):
                        if c not in found:
                            found.append(c)
            if len(found) >= max_curves:
                break
        except Exception:
            continue
    return found[:max_curves] or ['GR']


def _las_depth_and_curve(path, curve_name):
    try:
        las = lasio.read(path, ignore_header_errors=True)
        df = las.df()
        if df is None or df.empty:
            return None, None
        depth = np.asarray(df.index, dtype=float)
        upper_cols = {str(c).upper(): c for c in df.columns}
        col = None
        for name, original in upper_cols.items():
            if name == curve_name.upper() or name.startswith(curve_name.upper()):
                col = original
                break
        if col is None:
            return None, None
        values = np.asarray(df[col], dtype=float)
        mask = np.isfinite(depth) & np.isfinite(values)
        if mask.sum() < 2:
            return None, None
        depth, values = depth[mask], values[mask]
        if len(depth) > 1600:
            idx = np.linspace(0, len(depth) - 1, 1600).astype(int)
            depth, values = depth[idx], values[idx]
        return depth, values
    except Exception:
        return None, None


def generate_log_visualizations(well_path, project_path, selected_files, output_name):
    """Generate before/after PNG log visualizations for the UI."""
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
    except Exception as exc:
        logger.warning(f'Matplotlib unavailable for visualization: {exc}')
        return [], None

    assets_dir = os.path.join(project_path, 'visual_assets')
    os.makedirs(assets_dir, exist_ok=True)
    input_paths = [os.path.join(well_path, f) for f in selected_files]
    curves = _choose_visual_curves(input_paths, max_curves=4)
    input_images = []

    for fname, path in zip(selected_files, input_paths):
        fig, axes = plt.subplots(1, len(curves), figsize=(3.2 * len(curves), 6), sharey=True)
        if len(curves) == 1:
            axes = [axes]
        plotted = False
        for ax, curve in zip(axes, curves):
            depth, values = _las_depth_and_curve(path, curve)
            if depth is not None:
                ax.plot(values, depth, linewidth=0.8)
                ax.invert_yaxis()
                ax.set_title(curve, fontsize=9)
                ax.grid(True, linewidth=0.25)
                plotted = True
            else:
                ax.text(0.5, 0.5, f'{curve}\nnot found', ha='center', va='center', transform=ax.transAxes, fontsize=9)
                ax.set_title(curve, fontsize=9)
        axes[0].set_ylabel('Depth')
        fig.suptitle(fname, fontsize=10)
        fig.tight_layout(rect=[0, 0, 1, 0.95])
        img_name = 'input_' + secure_filename(os.path.splitext(fname)[0]) + '.png'
        fig.savefig(os.path.join(assets_dir, img_name), dpi=130, bbox_inches='tight')
        plt.close(fig)
        if plotted:
            input_images.append(img_name)

    output_path = os.path.join(project_path, output_name)
    merged_img = None
    if os.path.exists(output_path):
        fig, axes = plt.subplots(1, len(curves), figsize=(3.2 * len(curves), 7), sharey=True)
        if len(curves) == 1:
            axes = [axes]
        for ax, curve in zip(axes, curves):
            depth, values = _las_depth_and_curve(output_path, curve)
            if depth is not None:
                ax.plot(values, depth, linewidth=0.8)
                ax.invert_yaxis()
                ax.set_title(curve, fontsize=9)
                ax.grid(True, linewidth=0.25)
            else:
                ax.text(0.5, 0.5, f'{curve}\nnot found', ha='center', va='center', transform=ax.transAxes, fontsize=9)
                ax.set_title(curve, fontsize=9)
            # Depth interval dividers based on selected input ranges.
            for fname in selected_files:
                meta = validate_las_file(os.path.join(well_path, fname))
                dmin = meta.get('depth_min')
                if dmin is not None:
                    ax.axhline(float(dmin), linestyle='--', linewidth=0.8)
                    if ax is axes[0]:
                        ax.text(0.02, float(dmin), f' start: {fname[:28]}', fontsize=7, va='bottom', transform=ax.get_yaxis_transform())
        axes[0].set_ylabel('Depth')
        fig.suptitle('Merged AutoSpliced LAS with source interval dividers', fontsize=11)
        fig.tight_layout(rect=[0, 0, 1, 0.95])
        merged_img = 'merged_visualization.png'
        fig.savefig(os.path.join(assets_dir, merged_img), dpi=135, bbox_inches='tight')
        plt.close(fig)
    return input_images, merged_img


@app.route('/autosplice', methods=['GET', 'POST'])
def direct_autosplice():
    """Simplified one-screen AutoSplice: upload multiple LAS files and download one output."""
    email = session.get('USER_EMAIL')
    if not email:
        return redirect(url_for('login'))

    if request.method == 'GET':
        return render_template('simple_autosplice.html')

    uploaded = request.files.getlist('las_files')
    uploaded = [f for f in uploaded if f and f.filename]

    if len(uploaded) < 2:
        return render_template('simple_autosplice.html', error='Upload at least two LAS files from the same well.')

    safe_email = secure_filename(email)
    run_id = datetime.now().strftime('%Y%m%d_%H%M%S_') + uuid4().hex[:8]
    project_path = os.path.join(app.config['UPLOAD_FOLDER'], safe_email, 'direct_autosplice_runs', run_id)
    well_name = 'Uploaded_Well'
    well_path = os.path.join(project_path, secure_filename(well_name))
    os.makedirs(well_path, exist_ok=True)

    saved, skipped = save_uploaded_files(uploaded, well_path)
    if len(saved) < 2:
        return render_template('simple_autosplice.html', error='Need at least two readable .las files after upload.', skipped=skipped)

    file_summary = []
    for fname in saved:
        fpath = os.path.join(well_path, fname)
        meta = validate_las_file(fpath)
        file_summary.append({'filename': fname, 'meta': meta})

    valid_items = [x for x in file_summary if x['meta'].get('valid')]
    valid_items.sort(key=lambda x: (x['meta'].get('depth_min') if x['meta'].get('depth_min') is not None else 1e18))
    selected_files = [x['filename'] for x in valid_items]

    if len(selected_files) < 2:
        return render_template('simple_autosplice.html', error='Need at least two valid depth-indexed LAS files for splicing.', file_summary=file_summary, skipped=skipped)

    output_name = 'AutoSpliced_Output.las'
    output_path = os.path.join(project_path, output_name)
    # Fixed default output depth step. User does not need to select it in the UI.
    step_value = 0.1524
    params = {'export_sampling_interval': step_value}

    try:
        detail = fallback_splice_las(project_path, well_name, selected_files, output_path, params)
        # Visualization generation removed as requested. Keep the splicing output only.
        input_images, merged_image = [], None
        provenance = {
            'workflow': 'Simplified Auto Log Splicer',
            'selected_files': selected_files,
            'output_file': output_name,
            'splicing_engine': detail.get('engine'),
            'output_depth_step': step_value,
            'depth_min': detail.get('depth_min'),
            'depth_max': detail.get('depth_max'),
            'curve_count': detail.get('curve_count'),
            'generated_at': datetime.now().isoformat(timespec='seconds')
        }
        with open(os.path.join(project_path, 'AutoSpliced_Output_provenance.json'), 'w', encoding='utf-8') as f:
            json.dump(sanitize_for_json(provenance), f, indent=2)
        return render_template('simple_autosplice.html',
                               success=True,
                               file_summary=file_summary,
                               selected_files=selected_files,
                               skipped=skipped,
                               output_name=output_name,
                               run_id=run_id,
                               detail=detail,
                               input_images=input_images,
                               merged_image=merged_image,
                               output_depth_step=step_value)
    except Exception as exc:
        logger.exception('Direct AutoSplice failed')
        return render_template('simple_autosplice.html', error=f'AutoSplice failed: {exc}', file_summary=file_summary, skipped=skipped)


@app.route('/direct_autosplice_asset/<run_id>/<path:filename>')
def direct_autosplice_asset(run_id, filename):
    email = session.get('USER_EMAIL')
    if not email:
        return redirect(url_for('login'))
    safe_email = secure_filename(email)
    safe_run = secure_filename(run_id)
    if not filename.lower().endswith('.png'):
        abort(403)
    folder = os.path.join(app.config['UPLOAD_FOLDER'], safe_email, 'direct_autosplice_runs', safe_run, 'visual_assets')
    return send_from_directory(folder, secure_filename(filename), as_attachment=False)


@app.route('/download_direct_autosplice/<run_id>/<path:filename>')
def download_direct_autosplice(run_id, filename):
    email = session.get('USER_EMAIL')
    if not email:
        return redirect(url_for('login'))
    safe_email = secure_filename(email)
    safe_run = secure_filename(run_id)
    if not filename.lower().endswith('.las'):
        abort(403)
    folder = os.path.join(app.config['UPLOAD_FOLDER'], safe_email, 'direct_autosplice_runs', safe_run)
    return send_from_directory(folder, secure_filename(filename), as_attachment=True)

# --- Processing & Display Routes ---
@app.route('/process_selected_wells', methods=['POST'])
# @login_required
def process_selected_wells():
    """Validate selected wells, auto-select usable LAS files, and open review screen."""
    email = session.get('USER_EMAIL')
    if not email:
        return jsonify({"success": False, "message": "Authentication required"}), 401
    data = request.json or {}
    selected_wells = data.get('selected_wells', [])
    project_name = data.get('project_name')
    if not project_name:
        return jsonify({"success": False, "message": "No project selected."}), 400
    if not selected_wells:
        return jsonify({"success": False, "message": "No well selected."}), 400
    try:
        project_path = get_user_project_path(project_name, email)
        if not os.path.isdir(project_path):
            return jsonify({"success": False, "message": "Project folder was not found."}), 404
        validation_by_well = {}
        warnings = []
        for well in selected_wells:
            safe_well = secure_filename(well)
            well_path = os.path.join(project_path, safe_well)
            if not os.path.isdir(well_path):
                warnings.append(f'{well}: well folder missing')
                continue
            files_meta = build_well_validation(project_path, well)
            if not files_meta:
                warnings.append(f'{well}: no LAS files found')
            validation_by_well[well] = files_meta
        if not validation_by_well:
            return jsonify({"success": False, "message": "No LAS files found for selected wells."}), 400
        autoselected = auto_select_valid_files(validation_by_well)
        if not any(autoselected.values()):
            return jsonify({"success": False, "message": "No valid LAS files were found. Corrupt, empty, or unreadable files were removed from auto-selection."}), 400
        session['well_las_attr_dict_for_review'] = sanitize_for_json(validation_by_well)
        session['autoselectedfiles_for_review'] = sanitize_for_json(autoselected)
        session['CURRENT_PROJECT_NAME'] = project_name
        msg = 'Validation complete. Review auto-selected LAS files before processing.'
        if warnings:
            msg += ' Warnings: ' + '; '.join(warnings[:4])
        return jsonify({"success": True, "message": msg, "redirect": url_for('display_data')})
    except Exception as e:
        logger.exception('AutoSplice validation failed for project %s', project_name)
        return jsonify({"success": False, "message": f"AutoSplice validation failed: {e}"}), 500

def autoSelectLasFiles(well_las_attr_dict):
    """Performs initial filtering (corruption, subsets) before splicing."""
    selectedfilenames_map = {} # {well_name: [list_of_filenames]}
    for well, las_files_data in well_las_attr_dict.items():
        logger.debug(f"Auto-selecting for well '{well}' - initial files: {list(las_files_data.keys())}")
        # Ensure 'awell' processing doesn't modify the original dict if needed elsewhere
        current_well_data = dict(las_files_data) # Make a copy
        
        current_well_data_after_corr = removeCorruptlas(current_well_data)
        logger.debug(f"  After removeCorruptlas: {list(current_well_data_after_corr.keys())}")
        
        current_well_data_after_subs = removeSubsets(current_well_data_after_corr)
        logger.debug(f"  After removeSubsets: {list(current_well_data_after_subs.keys())}")
        
        # 'suitify' structures data for SuitSplice AND performs selection based on curve sets
        suits = suitify(current_well_data_after_subs) # suits is {suit_index: {filename: data, ...}, ...}

        # Collect all unique filenames chosen by suitify across all suits for this well
        well_selected_files = set()
        if suits: # Check if suitify returned any suits
             for suit_index, files_in_suit_dict in suits.items():
                  well_selected_files.update(files_in_suit_dict.keys()) # Add filenames from this suit

        selectedfilenames_map[well] = list(well_selected_files) # Store list of selected filenames
        logger.debug(f"  After suitify selection: {list(well_selected_files)}")

        if not selectedfilenames_map[well]:
            logger.warning(f"Auto-selection for well '{well}' resulted in no files after filtering and suitify.")

    return selectedfilenames_map

# NEW Route: Display Data for Review (GET)
@app.route('/display_data')
# @login_required
def display_data(): 
    """
    Renders the page where users can review and modify auto-selected files.
    """
    email = session.get('USER_EMAIL')
    project_name = session.get('CURRENT_PROJECT_NAME') # Get project name from session

    # Retrieve data stored by process_selected_wells
    well_las_attr_dict = session.get('well_las_attr_dict_for_review')
    autoselectedfiles = session.get('autoselectedfiles_for_review')

    if not well_las_attr_dict or autoselectedfiles is None: # Check autoselectedfiles for None explicitly
        logger.warning(f"Session data missing for display_data for user {email}, project {project_name}.")
        # Redirect back to the project dashboard if data is missing
        if project_name:
             flash("No data available for review. Please select wells and run 'Process Selected Wells' first.", "warning")
             return redirect(url_for('project_dashboard', project_name=project_name))
        else:
             flash("Project context lost. Please navigate back to your project.", "warning")
             return redirect(url_for('projects')) # Fallback to projects list


    # Read splice parameters to display settings button/modal
    splice_params = get_autosplice_params()

    # Clear the temporary session data after retrieving it? Optional, depends on workflow.
    # session.pop('well_las_attr_dict_for_review', None)
    # session.pop('autoselectedfiles_for_review', None)
    # If kept, it can be reused by /start_splicing

    return render_template('display_categorized_data.html',
                           project_name=project_name,
                           data=well_las_attr_dict,
                           selected_files=autoselectedfiles,
                           splice_params=splice_params)


# NEW Route: Start Splicing (POST) - Receives final selections
@app.route('/start_splicing', methods=['POST'])
# @login_required
def start_splicing():
    """
    Receives final user-confirmed selections and starts the background splicing process.
    """
    email = session.get('USER_EMAIL')
    project_name = session.get('CURRENT_PROJECT_NAME')

    if not email or not project_name:
        return jsonify({"success": False, "message": "User or project context lost"}), 400

    try:
        # Retrieve the full attribute dictionary stored earlier
        well_las_attr_dict = session.get('well_las_attr_dict_for_review')
        if well_las_attr_dict: # Use the actual variable name you use ('well_las_attr_dict' or 'well_las_attr_dict_from_session')
            first_well_name = next(iter(well_las_attr_dict), None)
            if first_well_name:
                first_file_name = next(iter(well_las_attr_dict[first_well_name]), None)
                if first_file_name:
                    file_attrs = well_las_attr_dict[first_well_name][first_file_name]
                    drange = file_attrs.get('depthrange')
                    logger.debug(f"Sample data for {first_well_name}/{first_file_name}:")
                    if drange:
                        logger.debug(f"  Depthrange value: {drange}")
                        logger.debug(f"  Depthrange type: {type(drange)}")
                        if len(drange) > 0:
                            logger.debug(f"  Depthrange[0] type: {type(drange[0])}")
                        if len(drange) > 1:
                            logger.debug(f"  Depthrange[1] type: {type(drange[1])}")
                    else:
                        logger.debug("  Depthrange attribute missing.")
                    # Log categories type too
                    cats = file_attrs.get('categories')
                    logger.debug(f"  Categories type: {type(cats)}")
                else:
                    logger.debug(f"No files found for well {first_well_name} in session data.")
            else:
                logger.debug("No wells found in session data.")
        else:
            logger.debug("well_las_attr_dict retrieved from session is empty or None.")
        logger.debug("--- End Data Inspection ---")
        if not well_las_attr_dict:
             logger.error(f"Session data (attributes) missing for start_splicing for user {email}, project {project_name}.")
             return jsonify({"success": False, "message": "Review data expired or missing. Please start again."}), 400

        # Get the user-confirmed selections from the form data
        # The JS should send this in a structured format, e.g., { "well1": ["fileA.las", "fileB.las"], "well2": [...] }
        final_selections_by_well = request.json.get('final_selections')
        if not final_selections_by_well:
            return jsonify({"success": False, "message": "No final selections received from the review page."}), 400

        logger.info(f"Starting splicing for project '{project_name}' with user-confirmed files: {final_selections_by_well}")

        # Validate that the selected files actually exist in the attribute dictionary
        validated_files_by_well = {}
        for well, files in final_selections_by_well.items():
            if well not in well_las_attr_dict:
                logger.warning(f"Well '{well}' from final selection not found in original attributes. Skipping.")
                continue
            validated_files = [f for f in files if f in well_las_attr_dict[well]]
            if validated_files:
                validated_files_by_well[well] = validated_files
            else:
                 logger.warning(f"No valid files selected for well '{well}' after validation. Skipping.")

        if not validated_files_by_well:
             return jsonify({"success": False, "message": "No valid files selected for splicing after validation."}), 400

        project_path = get_user_project_path(project_name, email)
        if not os.path.isdir(project_path):
             return jsonify({"success": False, "message": "Project path not found."}), 400


        # *** Start Background Thread with FINAL selections ***
        thread = threading.Thread(
            target=process_wells,
            # Pass the FINAL user selections and the full attribute dict
            args=(validated_files_by_well, project_path, well_las_attr_dict)
        )
        thread.daemon = True
        thread.start()
        logger.info(f"Started background splicing thread for project '{project_name}' based on user review.")

        # Clear review data from session now that processing started
        session.pop('well_las_attr_dict_for_review', None)
        session.pop('autoselectedfiles_for_review', None)

        # Respond to the client, indicating processing has started.
        # The client-side JS will then likely listen for SSE updates.
        # A redirect to a dedicated results/SSE page could happen here or be handled by JS.
        return jsonify({
            "success": True,
            "message": "Splicing process started in the background. Monitor status for updates.",
            # Optional: Provide URL for SSE listener page if different from current
            # "sse_url": url_for('process_updates'),
            # "results_url": url_for('project_dashboard', project_name=project_name) # Or a dedicated results view
            })

    except Exception as e:
        logger.exception(f"Error in start_splicing for project {project_name}: {e}")
        return jsonify({"success": False, "message": f"An unexpected server error occurred: {e}"}), 500


# Modify process_wells to accept final selections
# Ensure it uses `files_by_well` which now contains the user-confirmed list.
def process_wells(files_by_well, project_path, well_las_attr_dict):
    """Background AutoSplice processor with validation, status updates, LAS export and provenance."""
    started_all = time.time()
    total_wells = len(files_by_well or {})
    processed_results = []
    processing_manager.send_update({'type': 'status', 'message': 'Starting processing'})
    if not files_by_well:
        processing_manager.send_update({'type': 'error', 'message': 'No well selected for AutoSplice.'})
        return
    params = get_autosplice_params()
    for idx, (well, files) in enumerate(files_by_well.items(), start=1):
        well_start = time.time()
        safe_well = secure_filename(well)
        prefix = f"Well {well} ({idx}/{total_wells})"
        result_record = {'well': well, 'status': 'Failed', 'message': '', 'spliced_file': None, 'provenance_file': None}
        try:
            processing_manager.send_update({'type': 'status', 'message': f'{prefix}: Starting processing'})
            if not safe_well:
                raise RuntimeError('Invalid well name.')
            if not files:
                raise RuntimeError('No LAS files selected.')
            well_path = os.path.join(project_path, safe_well)
            if not os.path.isdir(well_path):
                raise RuntimeError('Well folder is missing.')
            processing_manager.send_update({'type': 'status', 'message': f'{prefix}: Validating files'})
            valid_files = []
            validation_report = {}
            for fname in files:
                safe_fname = secure_filename(fname)
                las_path = os.path.join(well_path, safe_fname)
                meta = validate_las_file(las_path)
                validation_report[safe_fname] = meta
                if meta.get('valid'):
                    valid_files.append(safe_fname)
                else:
                    processing_manager.send_update({'type': 'warning', 'message': f"{prefix}: Removed invalid file {safe_fname} ({meta.get('status')})"})
            if not valid_files:
                raise RuntimeError('No valid LAS files selected after validation.')
            processing_manager.send_update({'type': 'status', 'message': f'{prefix}: Creating curve groups'})
            spliced_filename = f'{safe_well}_spliced.las'
            spliced_file_path = os.path.join(project_path, spliced_filename)
            provenance_filename = f'{safe_well}_spliced{PROVENANCE_SUFFIX}'
            provenance_file_path = os.path.join(project_path, provenance_filename)
            output_detail = None
            engine_used = 'fallback_lasio_grid_merge'
            # Try the existing SuitSplice flow first when attribute data is compatible.
            try:
                awell = (well_las_attr_dict or {}).get(well, {})
                if awell:
                    awell = removeUnselected(awell, valid_files)
                    awell = removeCorruptlas(awell)
                    suits = suitify(awell)
                    if suits:
                        processing_manager.send_update({'type': 'status', 'message': f'{prefix}: Splicing curves with SuitSplice'})
                        ss = SuitSplice(suits, params=params)
                        ss.export(spliced_file_path, params.get('export_sampling_interval'))
                        if os.path.exists(spliced_file_path) and os.path.getsize(spliced_file_path) > 0 and validate_las_file(spliced_file_path).get('valid'):
                            output_detail = ss.get_provenance_data() if hasattr(ss, 'get_provenance_data') else {}
                            output_detail.setdefault('input_files', valid_files)
                            output_detail.setdefault('output_curves', {})
                            output_detail['engine'] = 'SuitSplice'
                            engine_used = 'SuitSplice'
                        else:
                            output_detail = None
            except Exception as suit_err:
                logger.warning('%s: SuitSplice path failed, using fallback merge: %s', prefix, suit_err, exc_info=True)
            if not output_detail:
                processing_manager.send_update({'type': 'status', 'message': f'{prefix}: Splicing curves'})
                output_detail = fallback_splice_las(project_path, well, valid_files, spliced_file_path, params)
            if not os.path.isfile(spliced_file_path) or os.path.getsize(spliced_file_path) <= 0:
                raise RuntimeError('Export failure: spliced LAS was not created.')
            processing_manager.send_update({'type': 'status', 'message': f'{prefix}: Exporting LAS'})
            input_files_used = output_detail.get('input_files', valid_files)
            output_curves_used = output_detail.get('output_curves', output_detail.get('curve_mapping', {}))
            provenance = {
                'project_name': os.path.basename(project_path),
                'processed_well_name': well,
                'output_spliced_las_filename': spliced_filename,
                # Backward-compatible report keys
                'input_las_files_used': input_files_used,
                'curves_used_from_each_source_file': output_curves_used,
                'autosplice_parameters_used': params,
                # Viewer-friendly keys used by the frontend
                'spliced_filename': spliced_filename,
                'input_files': input_files_used,
                'output_curves': output_curves_used,
                'parameters_used': params,
                'processing_timestamp': datetime.utcnow().isoformat() + 'Z',
                'processing_duration': round(time.time() - well_start, 3),
                'status': 'Success',
                'engine_used': output_detail.get('engine', engine_used),
                'validation': validation_report,
                'depth_range': {'min': output_detail.get('depth_min'), 'max': output_detail.get('depth_max')},
                'curve_count': output_detail.get('curve_count')
            }
            provenance['provenance'] = dict(provenance)
            processing_manager.send_update({'type': 'status', 'message': f'{prefix}: Saving provenance'})
            try:
                with open(provenance_file_path, 'w', encoding='utf-8') as pf:
                    json.dump(sanitize_for_json(provenance), pf, indent=4)
            except Exception as prov_err:
                raise RuntimeError(f'Provenance save failure: {prov_err}')
            processing_manager.send_update({'type': 'well_processed', 'well': well, 'message': 'Completed successfully', 'spliced_file': spliced_filename, 'provenance_file': provenance_filename})
            result_record.update({'status': 'Success', 'message': 'Completed successfully', 'spliced_file': spliced_filename, 'provenance_file': provenance_filename})
        except Exception as well_error:
            logger.exception('AutoSplice failed for well %s', well)
            msg = str(well_error)
            processing_manager.send_update({'type': 'error', 'well': well, 'message': f'{prefix}: {msg}'})
            # Try to save failed provenance too.
            try:
                failed_prov = {
                    'project_name': os.path.basename(project_path),
                    'processed_well_name': well,
                    'output_spliced_las_filename': None,
                    'input_las_files_used': files,
                    'autosplice_parameters_used': params,
                    'processing_timestamp': datetime.utcnow().isoformat() + 'Z',
                    'processing_duration': round(time.time() - well_start, 3),
                    'status': 'Failed',
                    'error': msg
                }
                pfname = f'{safe_well or "well"}_spliced{PROVENANCE_SUFFIX}'
                with open(os.path.join(project_path, pfname), 'w', encoding='utf-8') as pf:
                    json.dump(sanitize_for_json(failed_prov), pf, indent=4)
                result_record['provenance_file'] = pfname
            except Exception:
                pass
            result_record['message'] = msg
        processed_results.append(result_record)
    success_count = sum(1 for r in processed_results if r['status'] == 'Success')
    if success_count:
        processing_manager.send_update({'type': 'complete', 'message': f'Completed successfully: {success_count}/{total_wells} well(s).', 'results': processed_results, 'duration_sec': round(time.time() - started_all, 3)})
    else:
        processing_manager.send_update({'type': 'error', 'message': 'AutoSplice finished, but no wells were successfully processed.', 'results': processed_results})


# # Helper function to list files for viewer modal (ensure it exists and works)
# def list_project_files_for_viewer(project_path, project_name):
#     all_files = []
#     logger = logging.getLogger(__name__)
#     try:
#         # Spliced files at root
#         for item in os.listdir(project_path):
#             if item.lower().endswith('.las') and os.path.isfile(os.path.join(project_path, item)) and item.endswith('_spliced.las'):
#                 all_files.append({"filename": item, "well": None, "type": "spliced", "project": project_name})
#         # Source files in wells (assuming wells are subdirectories)
#         for well_dir in os.listdir(project_path):
#             well_path = os.path.join(project_path, well_dir)
#             if os.path.isdir(well_path):
#                  # Check if directory name matches a potential well pattern (optional)
#                  is_likely_well = True # Add better check if needed
#                  if is_likely_well:
#                     for item in os.listdir(well_path):
#                          if item.lower().endswith('.las') and os.path.isfile(os.path.join(well_path, item)):
#                              # Check if it's already listed as a spliced file (avoid duplicates)
#                              if not any(f['filename'] == item and f['well'] is None for f in all_files):
#                                  all_files.append({"filename": item, "well": well_dir, "type": "source", "project": project_name})

#         all_files.sort(key=lambda x: (x['well'] is not None, x['well'] or '', x['filename']))
#     except Exception as e:
#         logger.error(f"Error listing files in list_project_files_for_viewer for {project_name}: {e}")
#     return all_files



def normalize_splice_provenance(raw, spliced_filename=None):
    """Return one consistent provenance schema for the log viewer.

    Older/newer processing code may save provenance either as a flat object or
    under a top-level ``provenance`` key, and it may use either the UI keys
    (input_files/output_curves) or the export-report keys
    (input_las_files_used/curves_used_from_each_source_file).  The viewer only
    needs a normalized, non-destructive dictionary.
    """
    if not isinstance(raw, dict):
        raw = {}
    data = raw.get('provenance') if isinstance(raw.get('provenance'), dict) else raw
    normalized = dict(data)
    if spliced_filename:
        normalized['spliced_filename'] = spliced_filename
    elif normalized.get('output_spliced_las_filename'):
        normalized['spliced_filename'] = normalized.get('output_spliced_las_filename')

    normalized['input_files'] = list(
        normalized.get('input_files')
        or normalized.get('input_las_files_used')
        or []
    )
    normalized['output_curves'] = (
        normalized.get('output_curves')
        or normalized.get('curves_used_from_each_source_file')
        or normalized.get('curve_mapping')
        or {}
    )
    normalized['parameters_used'] = (
        normalized.get('parameters_used')
        or normalized.get('autosplice_parameters_used')
        or {}
    )
    return sanitize_for_json(normalized)

def removeUnselected(awell_attr_dict, files_to_keep):
    """Filters the attribute dictionary to keep only specified files."""
    # Ensure files_to_keep is a set for efficient lookup
    files_to_keep_set = set(files_to_keep)
    return {filename: data for filename, data in awell_attr_dict.items() if filename in files_to_keep_set}

# --- Parameter Reading/Saving ---
@app.route('/get_params', methods=['GET'])
# @login_required
def get_params():
    return jsonify(get_autosplice_params())

@app.route('/save_params', methods=['POST'])
# @login_required
def save_params_route():
    try:
        saved = save_autosplice_params(request.json or {})
        logger.info(f"Splicing parameters updated by user {session.get('USER_EMAIL')}")
        return jsonify({"success": True, "message": "Parameters saved.", "params": saved})
    except Exception as e:
        logger.exception("Error saving AutoSplice parameters.")
        return jsonify({"success": False, "message": f"Server error saving parameters: {e}"}), 500

# Backward-compatible name used by older code paths.
def save_params(params):
    return save_autosplice_params(params)


# --- Serving Uploaded Files (Potentially remove if not needed directly) ---
# This might be a security risk if UPLOAD_FOLDER is not configured carefully
# Commenting out as direct access seems unnecessary and risky. Data is fetched via specific endpoints.
# @app.route('/uploads/<path:filename>')
# @login_required # Protect access
# def uploaded_file(filename):
#     abort(404) # Disable direct access for now unless explicitly needed and secured

# --- Server-Sent Events Processing Manager ---
class ProcessingManager:
    def __init__(self):
        self.clients = set()
        self.lock = threading.Lock()
        self.logger = logging.getLogger(f"{__name__}.ProcessingManager") # More specific logger name

    def register_client(self, client_queue):
        with self.lock:
            self.clients.add(client_queue)
        self.logger.debug(f"SSE client registered. Total clients: {len(self.clients)}")

    def remove_client(self, client_queue):
        with self.lock:
            self.clients.discard(client_queue) # Use discard to avoid error if already removed
        self.logger.debug(f"SSE client removed. Total clients: {len(self.clients)}")

    def send_update(self, message):
        # Ensure message is JSON serializable before sending
        try:
            # Attempt sanitization for safety, though messages here should be simple dicts
            sanitized_message = sanitize_for_json(message)
            if not isinstance(sanitized_message, dict) or 'type' not in sanitized_message:
                 self.logger.warning(f"Attempted to send invalid SSE message format after sanitization: {sanitized_message}")
                 return
            message_json = json.dumps(sanitized_message)
            sse_formatted_message = f"data: {message_json}\n\n"
        except TypeError as e:
             self.logger.error(f"Could not serialize SSE message to JSON: {message} - Error: {e}")
             return
        except Exception as e: # Catch other potential errors during sanitization/dumping
             self.logger.error(f"Error preparing SSE message: {message} - Error: {e}")
             return

        with self.lock:
            if not self.clients: # No clients connected, don't bother sending
                 # self.logger.debug("No SSE clients connected, skipping update send.")
                 return

            removed_clients = set()
            for client_queue in self.clients:
                try:
                    client_queue.put_nowait(sse_formatted_message) # Send pre-formatted string
                except queue.Full:
                    self.logger.warning("SSE queue full for a client, removing client.")
                    removed_clients.add(client_queue)
                except Exception as e:
                    # Catch broader exceptions during put, e.g., if queue is closed unexpectedly
                    self.logger.error(f"Error sending update to SSE client queue: {e}")
                    removed_clients.add(client_queue)

            # Remove problematic clients outside the iteration loop
            self.clients.difference_update(removed_clients)
            if removed_clients:
                 self.logger.debug(f"Removed {len(removed_clients)} problematic SSE clients.")

processing_manager = ProcessingManager()

@app.route('/process-updates')
# @login_required # Keep the login requirement for now
def process_updates():
    user_email = 'NOT_SET' # Initialize
    context_available_at_start = has_request_context() # Check context immediately

    if context_available_at_start:
        try:
            user_email = session.get('USER_EMAIL', 'unknown_user_in_context')
            logger.info(f"SSE route entered. User: {user_email}. Context active: Yes.")
        except Exception as e:
            logger.error(f"!!! Error accessing session even when context reported active: {e}")
            user_email = 'error_accessing_session'
    else:
        logger.warning("!!! SSE route entered, but NO request context found immediately!")
        user_email = 'unknown_user_no_context'

    # Define the nested generator
    def generate_sse_data(captured_email): # Pass the captured email explicitly
        client_queue = queue.Queue(maxsize=100)
        processing_manager.register_client(client_queue)
        logger.info(f"SSE stream generator starting for user: {captured_email}") # Log using the captured email

        try:
            while True:
                try:
                    sse_message = client_queue.get(timeout=30)
                    yield sse_message
                except queue.Empty:
                    yield ": keepalive\n\n"
                except Exception as e:
                    logger.error(f"Error retrieving message from SSE queue for user {captured_email}: {e}")
                    yield f"event: error\ndata: {json.dumps({'message': 'Internal queue error'})}\n\n"
                    break
        except GeneratorExit:
            logger.info(f"SSE connection closed by client for user {captured_email}")
        except Exception as e:
            logger.error(f"Fatal error in SSE generator loop for user {captured_email}: {e}")
        finally:
            processing_manager.remove_client(client_queue)
            logger.info(f"SSE cleanup complete for user {captured_email}")

    # Explicitly copy context IF available? Might not help if context is gone by the time generate() runs.
    # generator = generate_sse_data(user_email)
    # if context_available_at_start:
    #    generator = copy_current_request_context(generator) # Experiment: Copy context

    # Create the response using the generator, passing the captured email
    response = Response(generate_sse_data(user_email), mimetype='text/event-stream', headers={
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        'Connection': 'keep-alive'
    })
    return response

# --- Add New Endpoint to Serve Raw LAS Content ---
@app.route('/get_las/<project_name>/<well_name>/<path:file_name>')
@app.route('/get_las/<project_name>/<path:file_name>') # Route for spliced files (no well dir)
# @login_requiredd
def get_las_content(project_name, file_name, well_name=None):
    """
    Serves the raw text content of a LAS file.
    Handles both source files within wells and spliced files at the project root.
    """
    email = session.get('USER_EMAIL')
    if not email:
        return make_response(jsonify({"error": "Authentication required"}), 401)

    try:
        project_path = get_user_project_path(project_name, email)
        safe_file_name = secure_filename(file_name) # Basic sanitization

        if not safe_file_name:
            return make_response(jsonify({"error": "Invalid file name"}), 400)

        if well_name:
            # Source file within a well directory
            safe_well_name = secure_filename(well_name)
            if not safe_well_name:
                return make_response(jsonify({"error": "Invalid well name"}), 400)
            file_path = os.path.join(project_path, safe_well_name, safe_file_name)
            # Security check (ensure it's within the project/well path)
            if not os.path.abspath(file_path).startswith(os.path.abspath(os.path.join(project_path, safe_well_name))):
                 logger.error(f"Attempt to access file outside well path: {file_path}")
                 abort(403) # Forbidden
        else:
            # Assume it's a spliced file directly under the project path
            file_path = os.path.join(project_path, safe_file_name)
            # Security check (ensure it's within the project path)
            if not os.path.abspath(file_path).startswith(os.path.abspath(project_path)):
                 logger.error(f"Attempt to access file outside project path: {file_path}")
                 abort(403) # Forbidden

        if os.path.isfile(file_path):
            # Read the file content as text (handle potential encoding issues)
            try:
                with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                    content = f.read()
                # Return as plain text
                response = make_response(content)
                response.headers['Content-Type'] = 'text/plain; charset=utf-8'
                return response
            except Exception as e:
                 logger.error(f"Error reading LAS file {file_path}: {e}")
                 return make_response(jsonify({"error": f"Could not read file: {e}"}), 500)
        else:
            logger.warning(f"LAS file not found for raw content request: {file_path}")
            return make_response(jsonify({"error": "File not found"}), 404)

    except Exception as e:
        logger.exception(f"Error in get_las_content for {project_name}/{well_name or ''}/{file_name}: {e}")
        return make_response(jsonify({"error": "Internal server error"}), 500)


# --- Add/Modify Endpoint to List Files for Viewer ---
# --- Add/Modify Endpoint to List Files for Viewer ---
@app.route('/list_files/<project_name>')
# @login_reddquired
def list_project_files_for_viewer(project_name):
    """
    Lists all source and spliced LAS files for the viewer modal.
    MODIFIED: Returns the list directly, or None on error, instead of jsonify.
    """
    email = session.get('USER_EMAIL')
    # Note: @login_required usually handles the abort/redirect before this point
    # if the user is not logged in. Adding an explicit check just in case.
    if not email:
        logger.warning("list_project_files_for_viewer called without authenticated user.")
        # Returning None, caller should handle. Alternatively, abort(401).
        return None # Indicate auth error to internal caller

    files_for_viewer = []
    try:
        project_path = get_user_project_path(project_name, email)
        if not os.path.isdir(project_path):
             logger.warning(f"Project path not found for {project_name} and user {email}")
             # Return None to indicate project not found
             return None

        # 1. Get Spliced Files (at project root)
        for item in os.listdir(project_path):
            item_path = os.path.join(project_path, item)
            # Check it's a file and ends with _spliced.las (case-insensitive)
            if item.lower().endswith('_spliced.las') and os.path.isfile(item_path):
                files_for_viewer.append({
                    "filename": item,
                    "well": None, # Indicate it's not in a specific well subdir
                    "type": "spliced",
                    "project": project_name
                })

        # 2. Get Source Files (within well subdirectories)
        # Ensure get_project_structure returns a dict {well_name: [file1, file2]}
        project_structure = get_project_structure(project_path)
        if isinstance(project_structure, dict): # Basic check
            for well_name, las_files in project_structure.items():
                if isinstance(las_files, list): # Basic check
                    for las_file in las_files:
                        # Prevent duplicates if a source file happens to be named '_spliced.las' (unlikely but safe)
                        if not any(f['filename'] == las_file and f['well'] == well_name for f in files_for_viewer):
                            # Check if the source file actually exists before adding
                            source_file_path = os.path.join(project_path, well_name, las_file)
                            if os.path.isfile(source_file_path):
                                 files_for_viewer.append({
                                     "filename": las_file,
                                     "well": well_name,
                                     "type": "source",
                                     "project": project_name
                                 })
                            # else: Optional: log missing source file listed in structure

        # Sort primarily by well name (spliced first), then filename
        files_for_viewer.sort(key=lambda x: (x['well'] is not None, x['well'] or '', x['filename']))

        # <<< MODIFIED: Return the list directly >>>
        return files_for_viewer

    except Exception as e:
        logger.exception(f"Error listing files for viewer in project {project_name}: {e}")
        # <<< MODIFIED: Return None on internal error >>>
        return None # Indicate internal error

# @app.route('/viewer/<project_name>/<well_name>')
# @login_required
# def log_viewer_page(project_name, well_name):
#     """Renders the dedicated log viewer page."""
#     email = session.get('USER_EMAIL')
#     if not email:
#         abort(401) # Or redirect to login

#     try:
#         project_path = get_user_project_path(project_name, email)
#         safe_well_name = secure_filename(well_name)
#         if not safe_well_name: abort(400, "Invalid well name.")

#         spliced_filename_base = f"{safe_well_name}_spliced"
#         spliced_filename = f"{spliced_filename_base}.las"
#         meta_filename = f"{spliced_filename_base}{PROVENANCE_SUFFIX}" # Use suffix
#         meta_file_path = os.path.join(project_path, meta_filename)

#         files_to_autoload = []
#         splice_provenance_data = None # Initialize provenance data

#         # --- Load Provenance Data ---
#         if os.path.isfile(meta_file_path):
#             try:
#                 with open(meta_file_path, 'r') as pf:
#                     meta_data = json.load(pf)
#                 splice_provenance_data = meta_data.get('provenance', None)
#                 if splice_provenance_data:
#                     logger.info(f"Loaded provenance data for {well_name} from {meta_filename}")
#                 else:
#                     logger.warning(f"'provenance' key not found in {meta_filename}")
#             except Exception as e:
#                 logger.warning(f"Could not read or parse meta file {meta_file_path}: {e}")
#         else:
#             logger.info(f"Provenance meta file not found: {meta_file_path}")
#         # --- END Load Provenance Data ---


#         # Add the spliced file for autoloading if it exists
#         spliced_file_full_path = os.path.join(project_path, spliced_filename)
#         if os.path.isfile(spliced_file_full_path):
#             files_to_autoload.append({
#                 "filename": spliced_filename,
#                 "well": None, # Indicates project root
#                 "type": "spliced",
#                 "project": project_name
#             })

#         # --- Use provenance data to find source files ---
#         if splice_provenance_data and isinstance(splice_provenance_data.get('input_files'), list):
#              logger.info(f"Adding source files from provenance: {splice_provenance_data['input_files']}")
#              for source_file in splice_provenance_data['input_files']:
#                  # Ensure source_file is a string before processing
#                  if not isinstance(source_file, str):
#                       logger.warning(f"Skipping non-string input file from provenance: {source_file}")
#                       continue
#                  safe_source_file = secure_filename(source_file)
#                  if not safe_source_file:
#                       logger.warning(f"Skipping invalid source filename from provenance after securing: {source_file}")
#                       continue

#                  source_file_path = os.path.join(project_path, safe_well_name, safe_source_file)
#                  if os.path.isfile(source_file_path):
#                      # Avoid adding duplicates if already added (e.g., if spliced file was in input list)
#                      if not any(f['filename'] == safe_source_file and f['well'] == safe_well_name for f in files_to_autoload):
#                          files_to_autoload.append({
#                              "filename": safe_source_file,
#                              "well": safe_well_name,
#                              "type": "source",
#                              "project": project_name
#                          })
#                  else:
#                      logger.warning(f"Source file listed in provenance but not found: {source_file_path}")
#         else:
#              logger.warning("Provenance data missing, invalid, or lacks 'input_files' list. Only autoloading spliced file if found.")
#         # --- END Use provenance ---

#         # --- Fetch list of ALL available files for the "Load LAS File" modal ---
#         # <<< MODIFIED: Handle potential None return >>>
#         all_available_files_list = list_project_files_for_viewer(project_name)
#         if all_available_files_list is None:
#              logger.error(f"Failed to retrieve list of available files for project {project_name}. Modal list will be empty.")
#              all_available_files_list = [] # Default to empty list on error

#         # --- Pass data to template ---
#         # Ensure provenance data passed is a dictionary (even if empty)
#         splice_provenance_dict = splice_provenance_data if isinstance(splice_provenance_data, dict) else {}
#         print(f"**********************************************\n {splice_provenance_dict} \n**********************************************")

#         return render_template('log_viewer.html',
#                                project_name=project_name,
#                                well_name=well_name,
#                                files_to_autoload_json=json.dumps(files_to_autoload),
#                                # Pass the retrieved list (or empty list) to dumps
#                                all_available_files_json=json.dumps(all_available_files_list),
#                                # Pass provenance dict (or empty dict) to dumps
#                                splice_provenance_json=json.dumps(splice_provenance_dict)
#                               )

#     except Exception as e:
#         logger.exception(f"Error loading viewer page for {project_name}/{well_name}: {e}")
#         # Use abort(500) which will typically render a generic server error page
#         abort(500)
# app.py

@app.route('/viewer/<project_name>/<well_name>')
def log_viewer_page(project_name, well_name):
    """Renders the dedicated log viewer page."""
    email = session.get('USER_EMAIL')
    if not email:
        abort(401) # Or redirect to login

    try:
        project_path = get_user_project_path(project_name, email)
        safe_well_name = secure_filename(well_name)
        if not safe_well_name: abort(400, "Invalid well name.")

        spliced_filename_base = f"{safe_well_name}_spliced"
        spliced_filename = f"{spliced_filename_base}.las"
        meta_filename = f"{spliced_filename_base}{PROVENANCE_SUFFIX}" # Use suffix
        meta_file_path = os.path.join(project_path, meta_filename)
        spliced_file_full_path = os.path.join(project_path, spliced_filename) # Define path earlier

        files_to_autoload = []
        splice_provenance_data = None # Initialize provenance data

        # --- Load Provenance Data ---
        if os.path.isfile(meta_file_path):
            try:
                with open(meta_file_path, 'r', encoding='utf-8') as pf:
                    meta_data = json.load(pf)
                splice_provenance_data = normalize_splice_provenance(
                    meta_data,
                    spliced_filename if os.path.isfile(spliced_file_full_path) else None
                )
                logger.info(f"Loaded normalized provenance data for {well_name} from {meta_filename}")
            except Exception as e:
                logger.warning(f"Could not read or parse meta file {meta_file_path}: {e}")
                splice_provenance_data = {}
        else:
            logger.info(f"Provenance meta file not found: {meta_file_path}")
            splice_provenance_data = {}
        # --- END Load Provenance Data ---


        # Add the spliced file for autoloading if it exists
        # spliced_file_full_path = os.path.join(project_path, spliced_filename) # Moved definition up
        if os.path.isfile(spliced_file_full_path):
            files_to_autoload.append({
                "filename": spliced_filename,
                "well": None, # Indicates project root
                "type": "spliced",
                "project": project_name
            })

        # --- Use provenance data to find source files ---
        if splice_provenance_data and isinstance(splice_provenance_data.get('input_files'), list):
             logger.info(f"Adding source files from provenance: {splice_provenance_data['input_files']}")
             for source_file in splice_provenance_data['input_files']:
                 # Ensure source_file is a string before processing
                 if not isinstance(source_file, str):
                     logger.warning(f"Skipping non-string input file from provenance: {source_file}")
                     continue
                 safe_source_file = secure_filename(source_file)
                 if not safe_source_file:
                     logger.warning(f"Skipping invalid source filename from provenance after securing: {source_file}")
                     continue

                 source_file_path = os.path.join(project_path, safe_well_name, safe_source_file)
                 if os.path.isfile(source_file_path):
                     # Avoid adding duplicates if already added (e.g., if spliced file was in input list)
                     if not any(f['filename'] == safe_source_file and f['well'] == safe_well_name for f in files_to_autoload):
                         files_to_autoload.append({
                             "filename": safe_source_file,
                             "well": safe_well_name,
                             "type": "source",
                             "project": project_name
                         })
                 else:
                     logger.warning(f"Source file listed in provenance but not found: {source_file_path}")
        else:
            logger.warning("Provenance data missing, invalid, or lacks 'input_files' list. Only autoloading spliced file if found.")
        # --- END Use provenance ---

        # --- Fetch list of ALL available files for the "Load LAS File" modal ---
        all_available_files_list = list_project_files_for_viewer(project_name)
        if all_available_files_list is None:
             logger.error(f"Failed to retrieve list of available files for project {project_name}. Modal list will be empty.")
             all_available_files_list = [] # Default to empty list on error

        # --- Pass normalized data to template ---
        splice_provenance_dict = normalize_splice_provenance(
            splice_provenance_data,
            spliced_filename if os.path.isfile(spliced_file_full_path) else None
        )

        print(f"**********************************************\n {splice_provenance_dict} \n**********************************************") # For debugging

        return render_template('log_viewer.html',
                               project_name=project_name,
                               well_name=well_name,
                               files_to_autoload_json=json.dumps(files_to_autoload),
                               all_available_files_json=json.dumps(all_available_files_list),
                               # Pass provenance dict (potentially updated) to dumps
                               splice_provenance_json=json.dumps(splice_provenance_dict)
                              )

    except Exception as e:
        logger.exception(f"Error loading viewer page for {project_name}/{well_name}: {e}")
        abort(500)

# --- API Endpoint for Spliced Logs ---
@app.route('/api/project/<project_name>/spliced_logs')
def api_get_spliced_logs(project_name):
    """API endpoint to get the list of spliced logs for a project."""
    email = session.get('USER_EMAIL')
    if not email:
        return jsonify({"success": False, "message": "Authentication required"}), 401

    try:
        project_path = get_user_project_path(project_name, email)
        if not os.path.isdir(project_path):
            logger.warning(f"API request for spliced logs: Project '{project_name}' not found for user {email}")
            return jsonify({"success": False, "message": "Project not found"}), 404

        # Reuse the existing helper function
        spliced_logs_map = get_spliced_logs(project_path) # Returns {well: filename}

        # Convert map to a list of objects for easier JS iteration
        spliced_logs_list = [{"well": well, "filename": filename} for well, filename in spliced_logs_map.items()]

        return jsonify({"success": True, "spliced_logs": spliced_logs_list})

    except Exception as e:
        logger.exception(f"Error fetching spliced logs via API for project {project_name}: {e}")
        return jsonify({"success": False, "message": f"An unexpected server error occurred: {e}"}), 500




@app.route('/project/<project_name>/autosplice_status')
def autosplice_status_page(project_name):
    email = session.get('USER_EMAIL')
    if not email:
        abort(401)
    project_path = get_user_project_path(project_name, email)
    if not os.path.isdir(project_path):
        abort(404)
    return render_template('autosplice_results.html', project_name=project_name)

@app.route('/download_spliced_log/<project_name>/<well_name>')
def download_spliced_log_compat(project_name, well_name):
    safe_well = secure_filename(well_name)
    return download_autosplice_file(project_name, f'{safe_well}_spliced.las')

@app.route('/download_autosplice/<project_name>/<path:filename>')
def download_autosplice_file(project_name, filename):
    """Download generated spliced LAS or provenance JSON from the project root."""
    email = session.get('USER_EMAIL')
    if not email:
        abort(401)
    project_path = get_user_project_path(project_name, email)
    safe_filename = secure_filename(filename)
    if not safe_filename or not (safe_filename.lower().endswith('_spliced.las') or safe_filename.lower().endswith('_spliced_provenance.json')):
        abort(400, 'Invalid AutoSplice output filename.')
    path = os.path.join(project_path, safe_filename)
    if not os.path.isfile(path):
        abort(404)
    return send_from_directory(project_path, safe_filename, as_attachment=True, download_name=safe_filename)

@app.route('/api/project/<project_name>/autosplice_results')
def api_autosplice_results(project_name):
    email = session.get('USER_EMAIL')
    if not email:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401
    try:
        project_path = get_user_project_path(project_name, email)
        if not os.path.isdir(project_path):
            return jsonify({'success': False, 'message': 'Project not found'}), 404
        results = []
        for item in sorted(os.listdir(project_path)):
            if item.lower().endswith('_spliced.las'):
                well = item[:-len('_spliced.las')]
                prov = f'{well}_spliced{PROVENANCE_SUFFIX}'
                results.append({
                    'well': well,
                    'status': 'Success',
                    'filename': item,
                    'provenance': prov if os.path.isfile(os.path.join(project_path, prov)) else None,
                    'download_las_url': url_for('download_autosplice_file', project_name=project_name, filename=item),
                    'download_provenance_url': url_for('download_autosplice_file', project_name=project_name, filename=prov) if os.path.isfile(os.path.join(project_path, prov)) else None,
                    'viewer_url': url_for('log_viewer_page', project_name=project_name, well_name=well)
                })
        return jsonify({'success': True, 'results': results})
    except Exception as e:
        logger.exception('Could not list AutoSplice results for %s', project_name)
        return jsonify({'success': False, 'message': str(e)}), 500

# --- Main Execution Block ---
if __name__ == '__main__':
    # Ensure upload folder exists
    try:
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        logger.info(f"Upload directory checked/created: {app.config['UPLOAD_FOLDER']}")
    except OSError as e:
         logger.critical(f"FATAL: Could not create upload directory '{app.config['UPLOAD_FOLDER']}': {e}")
         exit(1)

    # Production execution (e.g., using Waitress or Gunicorn recommended over Flask dev server)
    if is_production:
        logger.info("Attempting to run in production mode (using environment variables)...")
        # port = int(os.environ.get('PORT', 8507)) # Standard 'PORT' env var
        # ip = os.environ.get('IP', '0.0.0.0') # Standard 'IP' env var
        # Use waitress or gunicorn here instead of app.run for production
        # Example using waitress (install waitress: pip install waitress)
        try:
             from waitress import serve
             serve(app, host='0.0.0.0', port=int(os.environ.get('PORT', 8507)))
        except ImportError:
             logger.error("Waitress not found. Install waitress (`pip install waitress`) for production.")
             logger.warning("Falling back to Flask development server (NOT recommended for production).")
             app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8507)), debug=False, threaded=True)
        # Or Gunicorn: gunicorn --bind 0.0.0.0:$PORT app:app

    # Development execution
    else:
        logger.info("Running in development mode with Flask's built-in server.")
        app.run(
            host='0.0.0.0',
            port=8507,
            debug=True, # Enable reloader and debugger
            threaded=True # Handle multiple requests
        )
