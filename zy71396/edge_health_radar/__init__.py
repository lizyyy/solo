from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

from edge_health_radar import routes, models, analytics, exporter, sample_data, failure_detector

__all__ = ['app', 'routes', 'models', 'analytics', 'exporter', 'sample_data', 'failure_detector']
