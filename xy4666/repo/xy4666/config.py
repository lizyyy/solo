import os

basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'textile-lab-secret-key-2024'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, 'textile_lab.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.path.join(basedir, 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max upload
    
    # 色差仪读数范围
    COLOR_DELTA_E_MIN = 0.0
    COLOR_DELTA_E_MAX = 5.0  # ΔE超过5.0为异常
    
    # 摩擦测试等级范围
    FRICTION_GRADE_MIN = 1
    FRICTION_GRADE_MAX = 5
    
    # 洗涤测试等级范围
    WASHING_GRADE_MIN = 1
    WASHING_GRADE_MAX = 5

class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
