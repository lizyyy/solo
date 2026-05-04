from flask import Flask, jsonify
from extensions import db

def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///swap_cabinet.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    db.init_app(app)
    
    from models import Battery, CabinetDoor, SwapRecord, MaintenanceOrder, Dispute, DoorSensorLog, TemperatureLog
    
    @app.route('/')
    def index():
        return jsonify({
            'service': '换电柜值班员系统',
            'version': '1.0.0',
            'endpoints': {
                'logs': '/api/logs',
                'batteries': '/api/batteries',
                'doors': '/api/doors',
                'swaps': '/api/swaps',
                'maintenance': '/api/maintenance',
                'disputes': '/api/disputes',
                'export': '/api/export'
            }
        })
    
    from api import register_routes
    register_routes(app, db)
    
    with app.app_context():
        db.create_all()
    
    return app

app = create_app()

if __name__ == '__main__':
    app.run(debug=False, host='127.0.0.1', port=8080)
