import os

basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'bibliography-tracker-secret-key-2024'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, 'bibliography.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    UPLOAD_FOLDER = os.path.join(basedir, 'uploads')
    EXPORT_FOLDER = os.path.join(basedir, 'exports')
    
    ALLOWED_EXTENSIONS = {'csv', 'json'}
    
    VALID_CURRENCIES = ['CNY', 'USD', 'EUR', 'GBP', 'JPY']
    DEFAULT_CURRENCY = 'CNY'
