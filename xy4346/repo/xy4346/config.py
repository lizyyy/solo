import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'shared-kitchen-secret-key'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(BASE_DIR, 'kitchen.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # 风控配置
    MAX_PARTICIPANTS = 50  # 最大活动人数
    FRIDGE_CAPACITY_WARNING_THRESHOLD = 0.8  # 冷藏格容量警告阈值
    QUALIFICATION_EXPIRY_WARNING_DAYS = 7  # 资质过期警告提前天数
