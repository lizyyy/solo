import os
basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'cold-chain-lab-secret-key-2024'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, 'data', 'cold_chain.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # 上传文件夹
    UPLOAD_FOLDER = os.path.join(basedir, 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    
    # 导出文件夹
    EXPORT_FOLDER = os.path.join(basedir, 'exports')
    
    # 温度阈值（摄氏度）
    TEMPERATURE_LOWER_THRESHOLD = -20.0  # 超低温冰箱标准
    TEMPERATURE_UPPER_THRESHOLD = -15.0
    
    # 超温持续时间阈值（分钟）
    OVERTEMP_DURATION_THRESHOLD = 5

    @staticmethod
    def init_app(app):
        pass
