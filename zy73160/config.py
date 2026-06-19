import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(BASE_DIR, 'data', 'matrix_check.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = 'matrix-check-secret-key'
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'data', 'uploads')
    REPORT_FOLDER = os.path.join(BASE_DIR, 'data', 'reports')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
