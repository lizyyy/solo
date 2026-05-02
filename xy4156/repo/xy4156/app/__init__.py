from flask import Flask, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import os

db = SQLAlchemy()

def create_app(config=None):
    app = Flask(__name__)
    
    if config is None:
        app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
        app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
            'DATABASE_URL', 
            'sqlite:///' + os.path.join(os.path.abspath(os.path.dirname(__file__)), '..', 'instance', 'chemicals.db')
        )
        app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    else:
        app.config.update(config)
    
    CORS(app)
    db.init_app(app)
    
    from app.routers import reagent, dispense, temperature, waste, review, audit, export
    app.register_blueprint(reagent.bp)
    app.register_blueprint(dispense.bp)
    app.register_blueprint(temperature.bp)
    app.register_blueprint(waste.bp)
    app.register_blueprint(review.bp)
    app.register_blueprint(audit.bp)
    app.register_blueprint(export.bp)
    
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({'error': 'Bad Request', 'message': str(e)}), 400
    
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'error': 'Not Found', 'message': str(e)}), 404
    
    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({'error': 'Internal Server Error', 'message': str(e)}), 500
    
    @app.route('/health')
    def health():
        return jsonify({'status': 'healthy', 'service': '危化品小瓶分装台'}), 200
    
    return app
