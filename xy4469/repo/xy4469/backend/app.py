import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from config import Config
from models import db
from routes import batches_bp, particles_bp, exports_bp

def create_app(config_class=Config):
    app = Flask(__name__, 
                static_folder=os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend', 'static'),
                template_folder=os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend'))
    
    app.config.from_object(config_class)
    config_class.init_app(app)
    
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    
    db.init_app(app)
    
    app.register_blueprint(batches_bp, url_prefix='/api/batches')
    app.register_blueprint(particles_bp, url_prefix='/api/particles')
    app.register_blueprint(exports_bp, url_prefix='/api/exports')
    
    @app.route('/')
    def index():
        return send_from_directory(app.template_folder, 'index.html')
    
    @app.route('/<path:path>')
    def static_files(path):
        return send_from_directory(app.static_folder, path)
    
    @app.errorhandler(404)
    def not_found_error(error):
        return jsonify({'success': False, 'error': '资源不存在'}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return jsonify({'success': False, 'error': '服务器内部错误'}), 500
    
    @app.route('/api/health')
    def health_check():
        return jsonify({
            'success': True,
            'data': {
                'status': 'healthy',
                'version': '1.0.0',
                'database': 'connected'
            }
        })
    
    with app.app_context():
        db.create_all()
    
    return app

app = create_app()

if __name__ == '__main__':
    print('=' * 60)
    print('微塑料滤膜初筛台 - Microplastic Screener')
    print('=' * 60)
    print(f'服务地址: http://localhost:5000')
    print(f'API 文档: http://localhost:5000/api/health')
    print('=' * 60)
    app.run(host='0.0.0.0', port=5000, debug=True)
