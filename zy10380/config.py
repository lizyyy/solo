import os
from datetime import timedelta

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///import_confirmation.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    CONFIRMATION_TOKEN_EXPIRE_HOURS = 24
    REVOCATION_WINDOW_MINUTES = 30
    MAX_BATCH_SIZE = 1000
    
    UPLOAD_FOLDER = 'uploads'
    ALLOWED_EXTENSIONS = {'csv', 'json', 'xlsx'}
