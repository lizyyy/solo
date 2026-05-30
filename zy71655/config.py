import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(BASE_DIR, 'running_analysis.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
    REPORT_FOLDER = os.path.join(BASE_DIR, 'reports')
    CHART_FOLDER = os.path.join(BASE_DIR, 'static', 'charts')
    
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    
    PACEDROP_THRESHOLD = 0.15
    HEARTRATE_DRIFT_THRESHOLD = 10
    GAP_THRESHOLD = 15
    
    SEGMENT_DISTANCE = 1000
    
    ALLOWED_EXTENSIONS = {'csv', 'txt', 'gpx', 'json'}
