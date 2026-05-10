
from flask import Flask
from config import Config
from app.models import db

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    db.init_app(app)
    
    from app.routes import api
    app.register_blueprint(api, url_prefix='/api/v1')
    
    with app.app_context():
        db.create_all()
    
    @app.route('/')
    def index():
        return {
            'name': 'AB实验分桶回溯API',
            'version': '1.0.0',
            'endpoints': {
                '实验管理': '/api/v1/experiments',
                '健康检查': '/api/v1/health'
            }
        }
    
    return app
