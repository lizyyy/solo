import os

basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dive-center-local-secret-key-2024'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, 'dive_center.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    RISK_THRESHOLDS = {
        'max_wind_speed_kmh': 30,
        'max_wave_height_m': 1.5,
        'max_instructor_ratio': 4,
        'certificate_expiry_warning_days': 30,
        'cylinder_inspection_interval_months': 12,
        'medical_validity_months': 12
    }
