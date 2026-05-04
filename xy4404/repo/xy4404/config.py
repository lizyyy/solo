import os
from datetime import timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

class Config:
    SQLITE_DB_PATH = os.path.join(BASE_DIR, 'theater_recordings.db')
    MATERIALS_FOLDER = os.path.join(BASE_DIR, 'materials')
    REPORTS_FOLDER = os.path.join(BASE_DIR, 'reports')
    
    AUDIO_EXTENSIONS = {'.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac', '.wma'}
    TRANSCRIPT_EXTENSIONS = {'.txt', '.docx', '.doc', '.pdf'}
    LICENSE_EXTENSIONS = {'.pdf'}
    
    LICENSE_EXPIRY_WARNING_DAYS = 30
    
    FLASK_HOST = '127.0.0.1'
    FLASK_PORT = 5000
    DEBUG = True
    
    FILE_MONITOR_INTERVAL = 1.0
