from flask import Flask
from flask_cors import CORS
from app.models import db
from app.routes import register_routes
import os

def create_app():
    app = Flask(__name__)
    CORS(app)
    
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///replay_platform.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
    
    db.init_app(app)
    
    with app.app_context():
        db.create_all()
    
    register_routes(app)
    
    return app
