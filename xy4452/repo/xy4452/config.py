import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'lost-found-matcher-secret-key-2024'
    
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    
    DATA_DIR = os.path.join(BASE_DIR, 'data')
    UPLOAD_DIR = os.path.join(BASE_DIR, 'uploads')
    IMAGES_DIR = os.path.join(BASE_DIR, 'static', 'images')
    EXPORT_DIR = os.path.join(BASE_DIR, 'exports')
    
    ALLOWED_EXTENSIONS = {'csv', 'txt', 'json', 'jpg', 'jpeg', 'png', 'gif'}
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB max file size
    
    @staticmethod
    def create_directories():
        dirs = [Config.DATA_DIR, Config.UPLOAD_DIR, Config.IMAGES_DIR, Config.EXPORT_DIR]
        for d in dirs:
            if not os.path.exists(d):
                os.makedirs(d, exist_ok=True)
