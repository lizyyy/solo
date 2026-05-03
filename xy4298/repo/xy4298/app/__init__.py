from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from config import Config

db = SQLAlchemy()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    db.init_app(app)
    
    from app.routes.import_routes import import_bp
    from app.routes.query_routes import query_bp
    from app.routes.status_routes import status_bp
    
    app.register_blueprint(import_bp, url_prefix='/api/import')
    app.register_blueprint(query_bp, url_prefix='/api/query')
    app.register_blueprint(status_bp, url_prefix='/api/status')
    
    with app.app_context():
        db.create_all()
    
    return app
