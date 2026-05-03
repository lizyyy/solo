import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'repetitive-complaints-2024'
    
    DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
    UPLOAD_DIR = os.path.join(DATA_DIR, 'uploads')
    STORAGE_DIR = os.path.join(DATA_DIR, 'storage')
    EXPORT_DIR = os.path.join(DATA_DIR, 'exports')
    
    SIMILARITY_THRESHOLD = 0.65
    CLUSTERING_METHOD = 'dbscan'
    MAX_FEATURES = 1000
    
    @staticmethod
    def ensure_directories():
        for dir_path in [Config.DATA_DIR, Config.UPLOAD_DIR, 
                         Config.STORAGE_DIR, Config.EXPORT_DIR]:
            os.makedirs(dir_path, exist_ok=True)
