
import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        'sqlite:///' + os.path.join(BASE_DIR, 'abtest.db')
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.environ.get('SECRET_KEY', 'abtest-secret-key-2024')
    
    RETRY_MAX_ATTEMPTS = 3
    RETRY_INITIAL_DELAY = 1
    RETRY_MAX_DELAY = 10
    
    BUCKET_COUNT = 100
    
    EXPORT_DIR = os.path.join(BASE_DIR, 'exports')
