from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from config import config

db = SQLAlchemy()

def create_app(config_name='default'):
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    CORS(app)
    db.init_app(app)
    
    from app.routes.import_routes import import_bp
    from app.routes.query_routes import query_bp
    from app.routes.validation_routes import validation_bp
    from app.routes.export_routes import export_bp
    from app.routes.opinion_routes import opinion_bp
    
    app.register_blueprint(import_bp, url_prefix='/api/import')
    app.register_blueprint(query_bp, url_prefix='/api/query')
    app.register_blueprint(validation_bp, url_prefix='/api/validation')
    app.register_blueprint(export_bp, url_prefix='/api/export')
    app.register_blueprint(opinion_bp, url_prefix='/api/opinion')
    
    with app.app_context():
        db.create_all()
    
    return app
