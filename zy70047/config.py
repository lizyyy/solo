import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        f'sqlite:///{os.path.join(BASE_DIR, "spare_parts.db")}'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.environ.get('SECRET_KEY', 'spare-parts-secret-key')
    JSON_AS_ASCII = False
    
    IDEMPOTENT_WINDOW_MINUTES = 30
    EXPORT_DIR = os.path.join(BASE_DIR, 'exports')
