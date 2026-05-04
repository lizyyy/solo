import os
from flask import Flask, render_template, jsonify, request, send_from_directory
from flask_cors import CORS
from config import Config
from extensions import db

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # 确保必要的目录存在
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config['EXPORT_FOLDER'], exist_ok=True)
    os.makedirs(os.path.join(os.path.dirname(__file__), 'data'), exist_ok=True)
    
    CORS(app)
    db.init_app(app)
    
    # 注册蓝图
    from routes.api import api_bp
    from routes.views import views_bp
    app.register_blueprint(api_bp, url_prefix='/api')
    app.register_blueprint(views_bp)
    
    # 创建数据库表
    with app.app_context():
        db.create_all()
    
    # 示例数据路由
    @app.route('/sample_data/<filename>')
    def sample_data(filename):
        sample_dir = os.path.join(os.path.dirname(__file__), 'data', 'samples')
        return send_from_directory(sample_dir, filename)
    
    return app

app = create_app()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
