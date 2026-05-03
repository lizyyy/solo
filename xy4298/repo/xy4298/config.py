import os

basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'scaffold-risk-platform-secret-key'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, 'scaffold_risk.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.path.join(basedir, 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    
    SCAFFOLD_VALIDITY_DAYS = 30
    REINSPECTION_WARNING_DAYS = 7
    
    WORK_TYPES = {
        'high_altitude': '高处作业',
        'hot_work': '动火作业',
        'lifting': '吊装作业',
        'confined_space': '有限空间作业'
    }
    
    SCAFFOLD_STATUSES = {
        'applied': '已申请',
        'accepted': '已验收',
        'inspected': '已复验',
        'overdue': '超期未复验',
        'rectifying': '整改中',
        'closed': '已闭环',
        'disabled': '已禁用'
    }
