import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

SECRET_KEY = os.environ.get('SECRET_KEY') or 'museum-borrowing-tool-secret-key-2024'

UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
SESSION_FOLDER = os.path.join(BASE_DIR, 'sessions')
SAMPLE_DATA_FOLDER = os.path.join(BASE_DIR, 'sample_data')

ALLOWED_EXTENSIONS = {'csv', 'json', 'txt'}
MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB

def create_directories():
    for folder in [UPLOAD_FOLDER, SESSION_FOLDER, SAMPLE_DATA_FOLDER]:
        os.makedirs(folder, exist_ok=True)
