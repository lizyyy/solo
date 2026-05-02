from flask import Flask
from config import Config
from extensions import db, migrate

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    db.init_app(app)
    migrate.init_app(app, db)
    
    from routes.main import main as main_blueprint
    app.register_blueprint(main_blueprint, url_prefix='/api')
    
    from routes.sites import sites as sites_blueprint
    app.register_blueprint(sites_blueprint, url_prefix='/api/sites')
    
    from routes.equipment import equipment as equipment_blueprint
    app.register_blueprint(equipment_blueprint, url_prefix='/api/equipment')
    
    from routes.members import members as members_blueprint
    app.register_blueprint(members_blueprint, url_prefix='/api/members')
    
    from routes.bookings import bookings as bookings_blueprint
    app.register_blueprint(bookings_blueprint, url_prefix='/api/bookings')
    
    from routes.rentals import rentals as rentals_blueprint
    app.register_blueprint(rentals_blueprint, url_prefix='/api/rentals')
    
    from routes.maintenance import maintenance as maintenance_blueprint
    app.register_blueprint(maintenance_blueprint, url_prefix='/api/maintenance')
    
    from routes.audit import audit as audit_blueprint
    app.register_blueprint(audit_blueprint, url_prefix='/api/audit')
    
    from routes.import_export import import_export as import_export_blueprint
    app.register_blueprint(import_export_blueprint, url_prefix='/api')
    
    return app
