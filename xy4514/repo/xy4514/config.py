import os
from datetime import datetime

basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'xian-dangan-guan-secret-key-2024'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, 'archives.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # 文件上传配置
    UPLOAD_FOLDER = os.path.join(basedir, 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB
    ALLOWED_EXTENSIONS = {'csv', 'json'}
    
    # 审计日志导出配置
    EXPORT_FOLDER = os.path.join(basedir, 'exports')
    
    @staticmethod
    def init_app(app):
        # 确保必要的目录存在
        os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
        os.makedirs(Config.EXPORT_FOLDER, exist_ok=True)
