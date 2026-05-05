import os
from datetime import timedelta

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'sql-validator-dev-key')
    
    SQLITE_TEMP_DIR = os.environ.get('SQLITE_TEMP_DIR', '/tmp/sql_validator')
    
    STORAGE_DIR = os.environ.get('STORAGE_DIR', os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'data',
        'storage'
    ))
    
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024
    
    SQL_TIMEOUT = int(os.environ.get('SQL_TIMEOUT', '30'))
    
    MAX_ROWS_TO_COMPARE = int(os.environ.get('MAX_ROWS_TO_COMPARE', '10000'))
