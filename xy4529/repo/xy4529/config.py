import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-for-testing'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(os.path.dirname(__file__), 'app.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    DOOR_CODE_LENGTH = 6
    DOOR_CODE_EXPIRE_MINUTES = 15
    
    WEBHOOK_URL = os.environ.get('WEBHOOK_URL') or 'http://localhost:5001/webhook/simulate'
    
    TIME_FORMAT = '%Y-%m-%d %H:%M:%S'
