from flask import Flask, send_from_directory
from flask_cors import CORS
import os

from backend.config import Config
from backend.api.routes import api_bp, init_services


def create_app(config_class=Config):
    app = Flask(__name__, 
                static_folder='../frontend/static',
                template_folder='../frontend')
    app.config.from_object(config_class)

    CORS(app, supports_credentials=True)

    Config.ensure_directories()
    init_services()

    app.register_blueprint(api_bp, url_prefix='/api')

    @app.route('/')
    def index():
        return send_from_directory(app.template_folder, 'index.html')

    @app.route('/<path:filename>')
    def serve_static(filename):
        return send_from_directory(app.template_folder, filename)

    @app.errorhandler(404)
    def not_found_error(error):
        return {"error": "Not found", "message": "The requested resource was not found"}, 404

    @app.errorhandler(500)
    def internal_error(error):
        return {"error": "Internal server error", "message": "An unexpected error occurred"}, 500

    return app
