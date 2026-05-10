import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'procurement-service-secret-key')
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        f'sqlite:///{os.path.join(BASE_DIR, "instance", "procurement.db")}'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'connect_args': {'check_same_thread': False}
    }
    
    BACKGROUND_JOB_MAX_RETRIES = 3
    BACKGROUND_JOB_RETRY_DELAY = 60
    
    VALIDITY_CHECK_INTERVAL = 300
    
    CURRENCY = 'CNY'
    TAX_RATE_DEFAULT = 0.13
