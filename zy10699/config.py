import os
from datetime import timedelta

basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, 'data_quality.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    SILENCE_STATUS_PENDING = 'pending'
    SILENCE_STATUS_APPROVED = 'approved'
    SILENCE_STATUS_REJECTED = 'rejected'
    SILENCE_STATUS_EXPIRED = 'expired'
    SILENCE_STATUS_RESTORED = 'restored'
    
    RESTORE_STATUS_PENDING = 'pending'
    RESTORE_STATUS_AUTO = 'auto_restored'
    RESTORE_STATUS_MANUAL = 'manual_restored'
    RESTORE_STATUS_FAILED = 'failed'
    
    ALERT_STATUS_ACTIVE = 'active'
    ALERT_STATUS_SILENCED = 'silenced'
    ALERT_STATUS_MERGED = 'merged'
