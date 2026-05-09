import os

class Config:
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        f'sqlite:///{os.path.join(BASE_DIR, "creditcard.db")}'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    
    EXPORT_DIR = os.path.join(BASE_DIR, 'exports')
    LOG_DIR = os.path.join(BASE_DIR, 'logs')
    
    MAX_INSTALLMENT_MONTHS = 24
    DEFAULT_FEE_RATE = 0.006
    EARLY_REPAYMENT_FEE_RATE = 0.03
    MAX_EXCEPTION_AGE_DAYS = 30
    
    @staticmethod
    def init_dirs():
        for directory in [Config.EXPORT_DIR, Config.LOG_DIR]:
            os.makedirs(directory, exist_ok=True)
