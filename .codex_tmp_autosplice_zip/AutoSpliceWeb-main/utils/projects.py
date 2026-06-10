# utils/projects.py
import os
from werkzeug.utils import secure_filename

def get_user_projects(username):
    user_path = os.path.join('uploads', secure_filename(username))
    if not os.path.exists(user_path):
        return []
    return [name for name in os.listdir(user_path) if os.path.isdir(os.path.join(user_path, name))]

def create_project(username, project_name):
    project_path = os.path.join('uploads', secure_filename(username), secure_filename(project_name))
    try:
        os.makedirs(project_path, exist_ok=True)
        return True
    except Exception as e:
        print(f"Error creating project: {str(e)}")
        return False