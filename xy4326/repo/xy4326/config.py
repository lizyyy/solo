import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
PHOTO_DIR = os.path.join(BASE_DIR, 'data', 'photos')
DATA_DIR = os.path.join(BASE_DIR, 'data')
EXPORTS_DIR = os.path.join(BASE_DIR, 'exports')

for dir_path in [PHOTO_DIR, DATA_DIR, EXPORTS_DIR]:
    os.makedirs(dir_path, exist_ok=True)

class Config:
    SECRET_KEY = 'thermal-inspection-secret-key-2024'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(DATA_DIR, 'inspection.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024
    UPLOAD_FOLDER = PHOTO_DIR
    ALLOWED_EXTENSIONS = {'csv', 'txt', 'log', 'jpg', 'jpeg', 'png', 'gif', 'bmp'}
