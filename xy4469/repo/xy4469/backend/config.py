import os
from datetime import timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'microplastic-screener-secret-key-2024'
    
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(BASE_DIR, 'microplastic.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    UPLOAD_FOLDER = os.path.join(PROJECT_DIR, 'data', 'uploads')
    EXAMPLES_FOLDER = os.path.join(PROJECT_DIR, 'data', 'examples')
    IMAGES_FOLDER = os.path.join(PROJECT_DIR, 'data', 'images')
    
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    ALLOWED_EXTENSIONS = {'csv', 'txt', 'jpg', 'jpeg', 'png', 'tiff'}
    
    CLASSIFICATION_CLASSES = ['fiber', 'bubble', 'scratch', 'particle', 'unclear']
    CLASSIFICATION_LABELS = {
        'fiber': '纤维',
        'bubble': '气泡',
        'scratch': '划痕',
        'particle': '颗粒',
        'unclear': '未明确'
    }
    
    RISK_LEVELS = {
        'high': '高风险',
        'medium': '中风险',
        'low': '低风险'
    }
    
    @staticmethod
    def init_app(app):
        for folder in [Config.UPLOAD_FOLDER, Config.EXAMPLES_FOLDER, Config.IMAGES_FOLDER]:
            os.makedirs(folder, exist_ok=True)
