import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = 'customer-complaint-cluster-secret-key'
    SQLALCHEMY_DATABASE_URI = f'sqlite:///{os.path.join(BASE_DIR, "data", "db", "complaints.db")}'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'data', 'imports')
    EXPORT_FOLDER = os.path.join(BASE_DIR, 'data', 'exports')
    VERSIONS_FOLDER = os.path.join(BASE_DIR, 'data', 'versions')
    
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    
    DEFAULT_CLUSTER_MODEL = 'all-MiniLM-L6-v2'
    MIN_CLUSTER_SIZE = 2
    
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    os.makedirs(EXPORT_FOLDER, exist_ok=True)
    os.makedirs(VERSIONS_FOLDER, exist_ok=True)
    os.makedirs(os.path.dirname(SQLALCHEMY_DATABASE_URI.replace('sqlite:///', '')), exist_ok=True)
