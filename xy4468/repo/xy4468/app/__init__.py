from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from config import Config

db = SQLAlchemy()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    db.init_app(app)
    CORS(app)
    
    # Register blueprints
    from app.routes.import_routes import import_bp
    from app.routes.risk_routes import risk_bp
    from app.routes.review_routes import review_bp
    from app.routes.query_routes import query_bp
    from app.routes.export_routes import export_bp
    
    app.register_blueprint(import_bp, url_prefix='/api/import')
    app.register_blueprint(risk_bp, url_prefix='/api/risk')
    app.register_blueprint(review_bp, url_prefix='/api/review')
    app.register_blueprint(query_bp, url_prefix='/api/query')
    app.register_blueprint(export_bp, url_prefix='/api/export')
    
    # Create database tables
    with app.app_context():
        db.create_all()
    
    return app
