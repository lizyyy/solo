from flask import Flask
from extensions import db
from datetime import datetime


def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///port_inspection.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = 'port-inspection-secret-key-2026'
    
    db.init_app(app)
    
    from models.models import (
        CustomsDeclaration,
        DeclarationItem,
        Manifest,
        ManifestItem,
        SealRecord,
        XrayInspection,
        LabSample,
        RiskAssessment,
        ReviewRecord
    )
    
    with app.app_context():
        db.create_all()
    
    from routes.import_routes import import_bp
    from routes.query_routes import query_bp
    from routes.risk_routes import risk_bp
    from routes.review_routes import review_bp
    from routes.export_routes import export_bp
    
    app.register_blueprint(import_bp, url_prefix='/api/import')
    app.register_blueprint(query_bp, url_prefix='/api/query')
    app.register_blueprint(risk_bp, url_prefix='/api/risk')
    app.register_blueprint(review_bp, url_prefix='/api/review')
    app.register_blueprint(export_bp, url_prefix='/api/export')
    
    @app.route('/api/health')
    def health_check():
        from flask import jsonify
        return jsonify({
            'status': 'ok',
            'timestamp': datetime.utcnow().isoformat()
        })
    
    return app


if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5001, debug=True)
