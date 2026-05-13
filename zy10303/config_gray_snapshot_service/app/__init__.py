import os
from flask import Flask
from .models import db


def create_app():
    app = Flask(__name__)
    
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'gray_snapshot.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    
    db.init_app(app)
    
    with app.app_context():
        db.create_all()
    
    from . import routes
    app.register_blueprint(routes.bp)
    
    return app
