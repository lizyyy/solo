import os

basedir = os.path.abspath(os.path.dirname(__file__))


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'pottery-splicing-review-secret-key'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, 'pottery.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.path.join(basedir, 'uploads')
    PHOTOS_FOLDER = os.path.join(basedir, 'photos')
    EXPORT_FOLDER = os.path.join(basedir, 'exports')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max upload
    
    RULE_CONFIG = {
        'edge_size_tolerance': 0.5,  # 边缘尺寸误差容限（厘米）
        'min_pieces_for_group': 2,  # 拼接组最少陶片数
        'max_pieces_for_group': 10,  # 拼接组最多陶片数
    }


class DevelopmentConfig(Config):
    DEBUG = True


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'


class ProductionConfig(Config):
    pass


config = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
