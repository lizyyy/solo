import os
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from config import Config
from models import db

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    CORS(app)
    
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config['EXPORT_FOLDER'], exist_ok=True)
    os.makedirs(os.path.join(app.root_path, 'instance'), exist_ok=True)
    
    db.init_app(app)
    
    from routes.classes import classes_bp
    from routes.upload import upload_bp
    from routes.analysis import analysis_bp
    from routes.export import export_bp
    from routes.notes import notes_bp
    
    app.register_blueprint(classes_bp, url_prefix='/api/classes')
    app.register_blueprint(upload_bp, url_prefix='/api/upload')
    app.register_blueprint(analysis_bp, url_prefix='/api/analysis')
    app.register_blueprint(export_bp, url_prefix='/api/export')
    app.register_blueprint(notes_bp, url_prefix='/api/notes')
    
    @app.route('/')
    def index():
        return render_template('index.html')
    
    @app.route('/class/<int:class_id>')
    def class_detail(class_id):
        return render_template('class_detail.html', class_id=class_id)
    
    @app.route('/api/health')
    def health():
        return jsonify({'status': 'ok', 'message': '服务运行正常'})
    
    @app.errorhandler(404)
    def not_found_error(error):
        return jsonify({'error': '资源不存在'}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return jsonify({'error': '服务器内部错误'}), 500
    
    with app.app_context():
        db.create_all()
    
    return app

app = create_app()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
