from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_marshmallow import Marshmallow
from config import config

db = SQLAlchemy()
ma = Marshmallow()


def create_app(config_name='default'):
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    db.init_app(app)
    ma.init_app(app)

    from app.routes.routes_routes import routes_bp
    from app.routes.checkin_routes import checkin_bp
    from app.routes.supplement_routes import supplement_bp
    from app.routes.detection_routes import detection_bp
    from app.routes.report_routes import report_bp

    app.register_blueprint(routes_bp, url_prefix='/api/v1/routes')
    app.register_blueprint(checkin_bp, url_prefix='/api/v1/checkins')
    app.register_blueprint(supplement_bp, url_prefix='/api/v1/supplements')
    app.register_blueprint(detection_bp, url_prefix='/api/v1/detections')
    app.register_blueprint(report_bp, url_prefix='/api/v1/reports')

    from app.errors import register_error_handlers
    register_error_handlers(app)

    return app
