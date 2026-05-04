import os
from datetime import datetime

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'neural-lab-secret-key-2024'
    
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    
    DATA_DIR = os.path.join(BASE_DIR, 'data')
    EXPERIMENTS_DIR = os.path.join(DATA_DIR, 'experiments')
    SEEDS_DIR = os.path.join(DATA_DIR, 'seeds')
    BAD_SAMPLES_DIR = os.path.join(DATA_DIR, 'bad_samples')
    REPORTS_DIR = os.path.join(DATA_DIR, 'reports')
    
    @classmethod
    def init_dirs(cls):
        for directory in [cls.DATA_DIR, cls.EXPERIMENTS_DIR, cls.SEEDS_DIR, 
                         cls.BAD_SAMPLES_DIR, cls.REPORTS_DIR]:
            if not os.path.exists(directory):
                os.makedirs(directory)
