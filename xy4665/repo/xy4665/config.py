import os

basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, 'dragon_boat.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dragon-boat-referee-2024'
    UPLOAD_FOLDER = os.path.join(basedir, 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    
    # 比赛配置
    MAX_AGE = 65  # 最大年龄
    MIN_AGE = 18  # 最小年龄
    MAX_WEIGHT_PER_PERSON = 100  # 最大体重(kg)
    MIN_WEIGHT_PER_PERSON = 40  # 最小体重(kg)
    TEAM_SIZE = 22  # 每队人数(包括鼓手、舵手)
    BOAT_CAPACITY = 22  # 每艘船容量

# 确保上传目录存在
os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
