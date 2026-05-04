from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from config import Config

db = SQLAlchemy()

def create_app(config_class=Config):
    app = Flask(__name__, 
                static_folder='../static',
                template_folder='../templates')
    app.config.from_object(config_class)
    
    CORS(app)
    db.init_app(app)
    
    from app.routes import main as main_blueprint
    app.register_blueprint(main_blueprint)
    
    from app.api import api as api_blueprint
    app.register_blueprint(api_blueprint, url_prefix='/api')
    
    with app.app_context():
        db.create_all()
    
    return app
