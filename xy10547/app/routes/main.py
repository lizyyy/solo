from flask import Blueprint, jsonify

bp = Blueprint('main', __name__)

@bp.route('/')
def index():
    return jsonify({
        'name': '养老院用药提醒 API',
        'version': '1.0.0',
        'description': '围绕养老院老人用药核对医嘱、库存、漏服、补服和护理员交接的完整业务系统',
        'endpoints': {
            '老人档案': '/api/residents',
            '医嘱管理': '/api/prescriptions',
            '用药计划': '/api/medications',
            '护理员管理': '/api/nurses',
            '库存管理': '/api/inventory',
            '交接班管理': '/api/handovers',
            '异常处理': '/api/exceptions',
            '报告导出': '/api/reports'
        }
    })

@bp.route('/health')
def health():
    return jsonify({'status': 'healthy'})
