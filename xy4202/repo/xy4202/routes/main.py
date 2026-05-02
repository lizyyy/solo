from flask import Blueprint, jsonify

main = Blueprint('main', __name__)

@main.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'message': '辅具借还风险管家服务运行正常'
    }), 200

@main.route('/', methods=['GET'])
def index():
    return jsonify({
        'name': '辅具借还风险管家',
        'version': '1.0.0',
        'description': '社区康复中心辅具借还管理系统',
        'endpoints': {
            'sites': '/api/sites',
            'equipment': '/api/equipment',
            'members': '/api/members',
            'bookings': '/api/bookings',
            'rentals': '/api/rentals',
            'maintenance': '/api/maintenance',
            'audit': '/api/audit/logs',
            'import_csv': '/api/import/csv',
            'export_weekly_report': '/api/export/weekly-report',
            'export_audit_package': '/api/export/audit-package'
        }
    }), 200
