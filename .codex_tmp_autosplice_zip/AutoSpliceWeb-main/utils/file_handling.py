import os
from werkzeug.utils import secure_filename

ALLOWED_EXTENSIONS = {'las', 'txt', 'csv', 'json'}

# def allowed_file(filename):
#     return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
def allowed_file(filename):
    """Check if the file extension is allowed"""
    ALLOWED_EXTENSIONS = {'las'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS



def save_uploaded_files(files, destination_path):
    """
    Save uploaded files to the specified destination path.
    
    Args:
        files: List of file objects from request.files or custom file objects
        destination_path: Path where files should be saved
    
    Returns:
        List of saved filenames
    """
    os.makedirs(destination_path, exist_ok=True)
    saved_files = []
    
    for file in files:
        if hasattr(file, 'filename'):
            # This is a FileStorage object from request.files
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                file_path = os.path.join(destination_path, filename)
                file.save(file_path)
                saved_files.append(filename)
        elif isinstance(file, dict) and 'name' in file and 'content' in file:
            # This is a custom file object with name and content
            if allowed_file(file['name']):
                filename = secure_filename(file['name'])
                file_path = os.path.join(destination_path, filename)
                with open(file_path, 'wb') as f:
                    if isinstance(file['content'], list):
                        # Convert list back to bytes
                        f.write(bytes(file['content']))
                    else:
                        # Assume content is already bytes
                        f.write(file['content'])
                saved_files.append(filename)
    
    return saved_files

