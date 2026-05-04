import os
from datetime import datetime

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
UPLOAD_DIR = os.path.join(DATA_DIR, 'uploads')
EXPORT_DIR = os.path.join(DATA_DIR, 'exports')
DB_PATH = os.path.join(DATA_DIR, 'aquarium.db')

for dir_path in [DATA_DIR, UPLOAD_DIR, EXPORT_DIR]:
    os.makedirs(dir_path, exist_ok=True)

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'aquarium-local-secret-key-2024'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or f'sqlite:///{DB_PATH}'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = UPLOAD_DIR
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    ALLOWED_EXTENSIONS = {'csv', 'json', 'txt'}
    
    WATER_QUALITY_THRESHOLDS = {
        'temp': {'min': 24.0, 'max': 28.0, 'drift': 1.0},
        'salinity': {'min': 30.0, 'max': 35.0, 'drift': 0.5},
        'ph': {'min': 8.0, 'max': 8.4, 'drift': 0.2},
        'ammonia': {'min': 0.0, 'max': 0.25, 'drift': 0.1}
    }
    
    ISOLATION_DAYS_REQUIRED = 14
    WATER_CHANGE_INTERVAL_DAYS = 7
