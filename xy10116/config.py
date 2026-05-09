import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
UPLOAD_DIR = os.path.join(DATA_DIR, 'uploads')
EXPORT_DIR = os.path.join(DATA_DIR, 'exports')

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)

class Config:
    SECRET_KEY = 'resume-risk-detector-secret-key'
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(DATA_DIR, 'resume_risk.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = UPLOAD_DIR
    EXPORT_FOLDER = EXPORT_DIR
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024
