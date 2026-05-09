from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from config import Config

db = SQLAlchemy()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    Config.init_dirs()
    db.init_app(app)
    
    from app.api.routes import api_bp
    app.register_blueprint(api_bp, url_prefix='/api/v1')
    
    with app.app_context():
        db.create_all()
    
    return app
