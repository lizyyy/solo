from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from config import Config

db = SQLAlchemy()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    os.makedirs(os.path.join(app.root_path, '..', 'instance'), exist_ok=True)
    
    db.init_app(app)
    
    from app.models import Inquiry, Quote, QuoteItem, QuoteVersion, ComparisonResult, BackgroundJob, OperationLog, PriceChange
    from app.routes import main_bp
    from app.api import api_bp
    
    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp, url_prefix='/api')
    
    with app.app_context():
        db.create_all()
    
    return app

import os
