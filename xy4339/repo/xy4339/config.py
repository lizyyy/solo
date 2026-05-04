import os

basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'paper-cutter-helper-secret-key-2024'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, 'paper_cutter.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    DEFAULT_PAPER_THICKNESS = 0.1  
    DEFAULT_CUTTING_LOSS = 5       
    DEFAULT_WASTAGE_RATE = 0.03    
    URGENT_SURCHARGE_RATE = 0.3    
    LABOR_COST_PER_HOUR = 80       
    DEFAULT_MARGIN = 10             
