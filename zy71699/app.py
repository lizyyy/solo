from flask import Flask, jsonify
from models import db
from schemas import ma
from routes.instruments import bp as instruments_bp
from routes.fault_records import bp as fault_records_bp
from routes.spare_parts import bp as spare_parts_bp
from routes.performances import bp as performances_bp
from routes.technicians import bp as technicians_bp
from routes.repair_orders import bp as repair_orders_bp
from routes.exceptions import bp as exceptions_bp
from routes.reports import bp as reports_bp
from routes.reminders import bp as reminders_bp

import os

def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL') or 'sqlite:///repair_schedule.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JSON_AS_ASCII'] = False

    db.init_app(app)
    ma.init_app(app)

    app.register_blueprint(instruments_bp)
    app.register_blueprint(fault_records_bp)
    app.register_blueprint(spare_parts_bp)
    app.register_blueprint(performances_bp)
    app.register_blueprint(technicians_bp)
    app.register_blueprint(repair_orders_bp)
    app.register_blueprint(exceptions_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(reminders_bp)

    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'ok',
            'service': '民乐团乐器维修排程系统',
            'version': '1.0.0'
        })

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': '资源不存在'}), 404

    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'error': '服务器内部错误'}), 500

    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({'error': '请求参数错误'}), 400

    with app.app_context():
        db.create_all()

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5001, debug=True)
