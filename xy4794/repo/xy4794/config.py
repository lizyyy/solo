import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'saas-renewal-risk-dev-key'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///saas_renewal_risk.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = os.environ.get('SQL_ECHO', 'false').lower() == 'true'
