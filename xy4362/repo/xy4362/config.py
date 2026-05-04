import os

basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'diving-club-secret-key-2024'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, 'diving.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    MAX_OXYGEN_PARTIAL_PRESSURE = 1.4  
    BACKUP_TANK_MIN_PRESSURE = 100  
    PRIMARY_TANK_MIN_PRESSURE = 150  
