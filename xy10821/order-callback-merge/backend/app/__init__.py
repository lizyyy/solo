from flask import Flask
from flask_cors import CORS
from app.models import init_db
from app.api import register_routes

def create_app():
    app = Flask(__name__)
    app.config.from_object('app.config.Config')
    
    CORS(app)
    
    init_db(app)
    
    register_routes(app)
    
    return app