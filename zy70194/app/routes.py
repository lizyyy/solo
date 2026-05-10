from flask import Blueprint, jsonify

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    return jsonify({
        'name': '采购询价比价服务',
        'version': '1.0.0',
        'status': 'running',
        'endpoints': {
            'inquiries': '/api/inquiries',
            'quotes': '/api/quotes',
            'comparison': '/api/comparisons',
            'background_jobs': '/api/jobs',
            'logs': '/api/logs'
        }
    })

@main_bp.route('/health')
def health():
    return jsonify({
        'status': 'healthy',
        'timestamp': __import__('datetime').datetime.utcnow().isoformat()
    })
