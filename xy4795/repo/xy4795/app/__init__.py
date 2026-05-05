from flask import Flask
from flask_sqlalchemy import SQLAlchemy
import os

db = SQLAlchemy()

def create_app(config_name=None):
    app = Flask(__name__)
    
    basedir = os.path.abspath(os.path.dirname(__file__))
    parent_dir = os.path.dirname(basedir)
    db_path = os.path.join(parent_dir, 'test_health.db')
    
    app.config['SECRET_KEY'] = 'test-health-gate-secret-key'
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
    
    db.init_app(app)
    
    from app.routes.reports import reports_bp
    from app.routes.coverage import coverage_bp
    from app.routes.flaky import flaky_bp
    from app.routes.quarantine import quarantine_bp
    from app.routes.metrics import metrics_bp
    from app.routes.export import export_bp
    
    app.register_blueprint(reports_bp, url_prefix='/api/reports')
    app.register_blueprint(coverage_bp, url_prefix='/api/coverage')
    app.register_blueprint(flaky_bp, url_prefix='/api/flaky')
    app.register_blueprint(quarantine_bp, url_prefix='/api/quarantine')
    app.register_blueprint(metrics_bp, url_prefix='/api/metrics')
    app.register_blueprint(export_bp, url_prefix='/api/export')
    
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return {'status': 'healthy', 'message': 'Test Health Gate is running'}
    
    with app.app_context():
        db.create_all()
    
    return app
