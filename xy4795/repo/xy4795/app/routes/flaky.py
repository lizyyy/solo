from flask import Blueprint, request, jsonify
from app.models import FlakyRun
from app.services.flaky_parser import import_flaky_logs
from app import db

flaky_bp = Blueprint('flaky', __name__)


@flaky_bp.route('', methods=['GET'])
def get_flaky_runs():
    module = request.args.get('module')
    owner = request.args.get('owner')
    ci_run_id = request.args.get('ci_run_id')
    min_flaky_rate = request.args.get('min_flaky_rate', type=float)
    limit = request.args.get('limit', 50, type=int)
    
    query = FlakyRun.query
    
    if module:
        query = query.filter(FlakyRun.module == module)
    if owner:
        query = query.filter(FlakyRun.owner == owner)
    if ci_run_id:
        query = query.filter(FlakyRun.ci_run_id == ci_run_id)
    if min_flaky_rate is not None:
        query = query.filter(FlakyRun.flaky_rate >= min_flaky_rate)
    
    runs = query.order_by(FlakyRun.flaky_rate.desc()).limit(limit).all()
    
    return jsonify({
        'count': len(runs),
        'flaky_runs': [r.to_dict() for r in runs]
    })


@flaky_bp.route('/<int:run_id>', methods=['GET'])
def get_flaky_run(run_id):
    run = FlakyRun.query.get_or_404(run_id)
    return jsonify(run.to_dict())


@flaky_bp.route('/import', methods=['POST'])
def import_flaky():
    if 'file' in request.files:
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400
        
        log_content = file.read()
    elif request.data:
        log_content = request.data
    else:
        return jsonify({'error': 'No log content provided'}), 400
    
    ci_run_id = request.form.get('ci_run_id') if request.form else None
    if not ci_run_id:
        ci_run_id = request.args.get('ci_run_id')
    
    module = request.form.get('module') if request.form else None
    if not module:
        module = request.args.get('module')
    
    owner = request.form.get('owner') if request.form else None
    if not owner:
        owner = request.args.get('owner')
    
    try:
        if isinstance(log_content, bytes):
            log_content = log_content.decode('utf-8')
        
        runs = import_flaky_logs(log_content, ci_run_id, module, owner)
        
        return jsonify({
            'success': True,
            'message': f'Imported {len(runs)} flaky test records',
            'count': len(runs),
            'flaky_runs': [r.to_dict() for r in runs]
        }), 201
    except Exception as e:
        return jsonify({'error': f'Failed to import flaky logs: {str(e)}'}), 500


@flaky_bp.route('/<int:run_id>', methods=['DELETE'])
def delete_flaky_run(run_id):
    run = FlakyRun.query.get_or_404(run_id)
    
    db.session.delete(run)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': f'Flaky run {run_id} deleted successfully'
    })


@flaky_bp.route('/stats', methods=['GET'])
def get_flaky_stats():
    module = request.args.get('module')
    owner = request.args.get('owner')
    days = request.args.get('days', type=int)
    
    from app.services.metrics_calculator import calculate_flaky_risk
    
    stats = calculate_flaky_risk(module=module, owner=owner, days=days)
    
    return jsonify(stats)
