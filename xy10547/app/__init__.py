from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from config import Config

db = SQLAlchemy()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    db.init_app(app)
    
    from app.routes.main import bp as main_bp
    from app.routes.resident import bp as resident_bp
    from app.routes.prescription import bp as prescription_bp
    from app.routes.medication import bp as medication_bp
    from app.routes.nurse import bp as nurse_bp
    from app.routes.inventory import bp as inventory_bp
    from app.routes.handover import bp as handover_bp
    from app.routes.exception import bp as exception_bp
    from app.routes.report import bp as report_bp
    
    app.register_blueprint(main_bp)
    app.register_blueprint(resident_bp, url_prefix='/api/residents')
    app.register_blueprint(prescription_bp, url_prefix='/api/prescriptions')
    app.register_blueprint(medication_bp, url_prefix='/api/medications')
    app.register_blueprint(nurse_bp, url_prefix='/api/nurses')
    app.register_blueprint(inventory_bp, url_prefix='/api/inventory')
    app.register_blueprint(handover_bp, url_prefix='/api/handovers')
    app.register_blueprint(exception_bp, url_prefix='/api/exceptions')
    app.register_blueprint(report_bp, url_prefix='/api/reports')
    
    with app.app_context():
        db.create_all()
    
    return app
