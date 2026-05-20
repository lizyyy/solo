from flask import Flask, send_from_directory
from flask_cors import CORS
from .models import init_db
from .routes import api_bp
import os

def create_app():
    app = Flask(__name__, static_folder='../../frontend/static', template_folder='../../frontend/templates')
    CORS(app)
    
    init_db()
    
    app.register_blueprint(api_bp)
    
    @app.route('/')
    def index():
        return send_from_directory(app.template_folder, 'index.html')
    
    @app.route('/<path:path>')
    def serve_static(path):
        return send_from_directory(app.static_folder, path)
    
    return app
