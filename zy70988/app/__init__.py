from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import os

db = SQLAlchemy()

def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///short_rental.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
    app.config['EXPORT_FOLDER'] = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'exports')
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
    
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config['EXPORT_FOLDER'], exist_ok=True)
    
    CORS(app)
    db.init_app(app)
    
    from app.routes import batches, records, files, exports
    app.register_blueprint(batches.bp)
    app.register_blueprint(records.bp)
    app.register_blueprint(files.bp)
    app.register_blueprint(exports.bp)
    
    with app.app_context():
        db.create_all()
    
    return app
