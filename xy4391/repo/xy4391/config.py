import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'interview-anonymization-secret-key'
    
    # SQLite 数据库配置
    basedir = os.path.abspath(os.path.dirname(__file__))
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, 'interview.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # 文件上传配置
    UPLOAD_FOLDER = os.path.join(basedir, 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB 最大文件大小
    ALLOWED_EXTENSIONS = {'json', 'txt', 'csv'}
    
    # Celery 配置
    CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL') or 'redis://localhost:6379/0'
    CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND') or 'redis://localhost:6379/0'
    
    # 脱敏配置
    ANONYMIZATION_PLACEHOLDERS = {
        'name': '[姓名]',
        'phone': '[电话]',
        'company': '[公司]',
        'address': '[地址]',
        'email': '[邮箱]',
        'id_card': '[身份证号]'
    }
    
    # 审计日志配置
    AUDIT_LOG_ENABLED = True

class DevelopmentConfig(Config):
    DEBUG = True

class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'

class ProductionConfig(Config):
    DEBUG = False

config = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
