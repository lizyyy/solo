import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from config import Config
from backend.models.models import db

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)
db.init_app(app)

with app.app_context():
    db.create_all()

from backend.api.data_import import data_import_bp
from backend.api.clustering import clustering_bp
from backend.api.review import review_bp
from backend.api.history import history_bp
from backend.api.report import report_bp
from backend.api.rules import rules_bp

app.register_blueprint(data_import_bp, url_prefix='/api/import')
app.register_blueprint(clustering_bp, url_prefix='/api/cluster')
app.register_blueprint(review_bp, url_prefix='/api/review')
app.register_blueprint(history_bp, url_prefix='/api/history')
app.register_blueprint(report_bp, url_prefix='/api/report')
app.register_blueprint(rules_bp, url_prefix='/api/rules')

@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../frontend', path)

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': str(error)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
