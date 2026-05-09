import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

env_path = BASE_DIR / '.env'
if env_path.exists():
    load_dotenv(env_path)

class Config:
    DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./event_manager.db')
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    MAX_RETRIES = int(os.getenv('MAX_RETRIES', '3'))
    RETRY_DELAY = int(os.getenv('RETRY_DELAY', '1'))
    
    DEFAULT_ADMIN_USERNAME = os.getenv('DEFAULT_ADMIN_USERNAME', 'admin')
    DEFAULT_ADMIN_PASSWORD = os.getenv('DEFAULT_ADMIN_PASSWORD', 'admin123')

config = Config()
