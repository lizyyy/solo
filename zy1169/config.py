import os

basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'ml-pipeline-studio-secret-key'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, 'pipeline.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    UPLOAD_FOLDER = os.path.join(basedir, 'uploads')
    DATA_FOLDER = os.path.join(basedir, 'data')
    MODELS_FOLDER = os.path.join(basedir, 'models')
    REPORTS_FOLDER = os.path.join(basedir, 'reports')
    
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024
    ALLOWED_EXTENSIONS = {'csv', 'yaml', 'yml'}
    
    @staticmethod
    def init_app(app):
        # 确保所有必要的目录存在
        folders = [
            app.config['UPLOAD_FOLDER'],
            app.config['DATA_FOLDER'],
            app.config['MODELS_FOLDER'],
            app.config['REPORTS_FOLDER'],
            os.path.join(app.config['DATA_FOLDER'], 'raw'),
            os.path.join(app.config['DATA_FOLDER'], 'cleaned'),
            os.path.join(app.config['DATA_FOLDER'], 'features'),
        ]
        for folder in folders:
            os.makedirs(folder, exist_ok=True)

class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False

class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    UPLOAD_FOLDER = os.path.join(basedir, 'test_uploads')
    DATA_FOLDER = os.path.join(basedir, 'test_data')
    MODELS_FOLDER = os.path.join(basedir, 'test_models')
    REPORTS_FOLDER = os.path.join(basedir, 'test_reports')

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
