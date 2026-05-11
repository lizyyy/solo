from flask import Flask
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///equipment.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JSON_AS_ASCII'] = False

    db.init_app(app)

    from app.routes.rider import rider_bp
    from app.routes.equipment import equipment_bp
    from app.routes.record import record_bp
    from app.routes.compensation import compensation_bp

    app.register_blueprint(rider_bp, url_prefix='/api/riders')
    app.register_blueprint(equipment_bp, url_prefix='/api/equipment')
    app.register_blueprint(record_bp, url_prefix='/api/records')
    app.register_blueprint(compensation_bp, url_prefix='/api/compensation')

    with app.app_context():
        db.create_all()

    return app
