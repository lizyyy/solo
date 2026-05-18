from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from config import Config

db = SQLAlchemy()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    db.init_app(app)
    
    from app.routes import silence_bp, rule_bp, alert_bp
    app.register_blueprint(silence_bp, url_prefix='/api/silence')
    app.register_blueprint(rule_bp, url_prefix='/api/rule')
    app.register_blueprint(alert_bp, url_prefix='/api/alert')
    
    return app
