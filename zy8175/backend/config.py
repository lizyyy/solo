import os

BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')
SAMPLES_DIR = os.path.join(BASE_DIR, 'samples')

DATABASE_PATH = os.path.join(DATA_DIR, 'catering.db')

SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-key-zy8175-catering')

class Config:
    SECRET_KEY = SECRET_KEY
    DATABASE_PATH = DATABASE_PATH
    DATA_DIR = DATA_DIR
    SAMPLES_DIR = SAMPLES_DIR
    UPLOAD_FOLDER = DATA_DIR
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    WINDOW_HOT_MIN = 20
    WINDOW_HOT_MAX = 90
    WINDOW_COLD_MIN = 20
    WINDOW_COLD_MAX = 240
    
    @staticmethod
    def ensure_dirs():
        for d in [DATA_DIR, SAMPLES_DIR, Config.UPLOAD_FOLDER]:
            os.makedirs(d, exist_ok=True)
