import os
from datetime import datetime

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'first-aid-training-tool-secret-key-2024'
    
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(BASE_DIR, 'instance', 'training.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
    EXPORT_FOLDER = os.path.join(BASE_DIR, 'exports')
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024
    
    ALLOWED_EXTENSIONS = {
        'students': {'csv'},
        'compression': {'csv'},
        'aed': {'json'},
        'group': {'csv'}
    }
    
    COMPRESSION_STANDARDS = {
        'min_depth_cm': 5.0,
        'max_depth_cm': 6.0,
        'min_rate': 100,
        'max_rate': 120,
        'min_consecutive_presses': 30
    }
    
    AED_EXPECTED_STEPS = [
        'power_on',
        'attach_pads',
        'analyze_heart_rhythm',
        'clear_for_shock',
        'deliver_shock',
        'resume_cpr'
    ]

def allowed_file(filename, file_type):
    if '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    return ext in Config.ALLOWED_EXTENSIONS.get(file_type, set())

def generate_unique_filename(original_name, prefix=''):
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    ext = original_name.rsplit('.', 1)[1].lower() if '.' in original_name else ''
    base = original_name.rsplit('.', 1)[0] if '.' in original_name else original_name
    if prefix:
        return f"{prefix}_{timestamp}_{base}.{ext}" if ext else f"{prefix}_{timestamp}_{base}"
    return f"{timestamp}_{base}.{ext}" if ext else f"{timestamp}_{base}"
