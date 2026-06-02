import os
from datetime import datetime

class Config:
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    INPUT_DIR = os.path.join(BASE_DIR, 'input')
    OUTPUT_DIR = os.path.join(BASE_DIR, 'output')
    DATA_DIR = os.path.join(BASE_DIR, 'data')
    LOG_DIR = os.path.join(BASE_DIR, 'logs')
    
    COORDINATE_TOLERANCE = 0.001
    TIME_SLOT_CONFLICT_THRESHOLD = 30
    
    STALL_CAPACITY = {
        'large': 20,
        'medium': 12,
        'small': 6
    }
    
    STATUS_CATEGORIES = {
        'processed': '已处理',
        'pending': '待核实',
        'onsite': '需要现场复看'
    }
    
    @classmethod
    def ensure_dirs(cls):
        for dir_path in [cls.INPUT_DIR, cls.OUTPUT_DIR, cls.DATA_DIR, cls.LOG_DIR]:
            os.makedirs(dir_path, exist_ok=True)
    
    @staticmethod
    def get_timestamp():
        return datetime.now().strftime('%Y%m%d_%H%M%S')
