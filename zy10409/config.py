import os
from datetime import timedelta

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(BASE_DIR, 'suppression.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    
    SUPPRESSION_DEFAULT_DAYS = 90
    SUPPRESSION_MAX_DAYS = 365
    
    EXPORT_BATCH_SIZE = 1000
    
    STATES = {
        'PENDING': 'pending',
        'UNDER_REVIEW': 'under_review',
        'APPROVED': 'approved',
        'REJECTED': 'rejected',
        'EXPIRED': 'expired',
        'REVOKED': 'revoked'
    }
    
    STATE_TRANSITIONS = {
        'pending': ['under_review', 'rejected', 'revoked'],
        'under_review': ['approved', 'rejected', 'pending'],
        'approved': ['expired', 'revoked'],
        'rejected': ['pending'],
        'expired': ['pending'],
        'revoked': ['pending']
    }
    
    REVIEW_CONCLUSIONS = {
        'TRUE_POSITIVE': 'true_positive',
        'FALSE_POSITIVE': 'false_positive',
        'NEEDS_MORE_CONTEXT': 'needs_more_context',
        'ACCEPTABLE_RISK': 'acceptable_risk'
    }
