from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from config import config

db = SQLAlchemy()

def create_app(config_name='default'):
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    db.init_app(app)
    
    # 注册蓝图
    from app.routes.interview_routes import interview_bp
    from app.routes.review_routes import review_bp
    from app.routes.export_routes import export_bp
    
    app.register_blueprint(interview_bp, url_prefix='/api/interviews')
    app.register_blueprint(review_bp, url_prefix='/api/review')
    app.register_blueprint(export_bp, url_prefix='/api/export')
    
    # 创建数据库表
    with app.app_context():
        db.create_all()
    
    return app
