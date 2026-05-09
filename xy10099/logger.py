import logging
import os
from pathlib import Path


class Logger:
    _instance = None
    
    def __new__(cls, log_file=None):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self, log_file=None):
        if self._initialized:
            return
            
        from config import config
        
        log_file = log_file or os.path.join(config.output_dir, config.log_file)
        log_dir = Path(log_file).parent
        log_dir.mkdir(parents=True, exist_ok=True)
        
        self.logger = logging.getLogger('AirCompressorAnalysis')
        self.logger.setLevel(logging.DEBUG)
        self.logger.handlers.clear()
        
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setLevel(logging.DEBUG)
        
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        
        formatter = logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(formatter)
        console_handler.setFormatter(formatter)
        
        self.logger.addHandler(file_handler)
        self.logger.addHandler(console_handler)
        
        self.failed_samples = []
        self._initialized = True
    
    def log_info(self, message):
        self.logger.info(message)
    
    def log_warning(self, message):
        self.logger.warning(message)
    
    def log_error(self, message):
        self.logger.error(message)
    
    def log_debug(self, message):
        self.logger.debug(message)
    
    def record_failed_sample(self, index, data, reason, category):
        self.failed_samples.append({
            'index': index,
            'data': data,
            'reason': reason,
            'category': category
        })
        self.log_warning(f"[{category}] 样本 {index} 失败: {reason}")
    
    def get_failed_samples(self):
        return self.failed_samples
    
    def get_failed_summary(self):
        from collections import Counter
        categories = [s['category'] for s in self.failed_samples]
        return Counter(categories)


def get_logger():
    return Logger()
