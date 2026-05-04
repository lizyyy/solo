import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'bus-display-validation-secret-key'
    
    DATA_DIR = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'data')
    
    UPLOAD_DIR = os.path.join(DATA_DIR, 'uploads')
    RELEASES_DIR = os.path.join(DATA_DIR, 'releases')
    AUDITS_DIR = os.path.join(DATA_DIR, 'audits')
    TEMPLATES_DIR = os.path.join(DATA_DIR, 'templates')
    
    @staticmethod
    def ensure_directories():
        directories = [
            Config.DATA_DIR,
            Config.UPLOAD_DIR,
            Config.RELEASES_DIR,
            Config.AUDITS_DIR,
            Config.TEMPLATES_DIR
        ]
        for directory in directories:
            if not os.path.exists(directory):
                os.makedirs(directory)
