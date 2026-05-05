from flask import Blueprint, request, jsonify
from app.services.quarantine_service import (
    add_to_quarantine, remove_from_quarantine, get_quarantine_list,
    get_quarantine_stats, update_quarantine, check_quarantine_status
)

quarantine_bp = Blueprint('quarantine', __name__)


@quarantine_bp.route('', methods=['GET'])
def list_quarantine():
    include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'
    module = request.args.get('module')
    owner = request.args.get('owner')
    reason_category = request.args.get('reason_category')
    
    quarantines = get_quarantine_list(
        include_inactive=include_inactive,
        module=module,
        owner=owner,
        reason_category=reason_category
    )
    
    return jsonify({
        'count': len(quarantines),
        'quarantine_list': quarantines
    })


@quarantine_bp.route('/<path:test_name>', methods=['GET'])
def get_quarantine_item(test_name):
    result = check_quarantine_status(test_name)
    return jsonify(result)


@quarantine_bp.route('', methods=['POST'])
def add_quarantine():
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No JSON data provided'}), 400
    
    test_name = data.get('test_name')
    if not test_name:
        return jsonify({'error': 'test_name is required'}), 400
    
    reason = data.get('reason')
    if not reason:
        return jsonify({'error': 'reason is required'}), 400
    
    result = add_to_quarantine(
        test_name=test_name,
        reason=reason,
        reason_category=data.get('reason_category'),
        full_name=data.get('full_name'),
        module=data.get('module'),
        owner=data.get('owner'),
        added_by=data.get('added_by'),
        expected_fix_date=data.get('expected_fix_date'),
        notes=data.get('notes')
    )
    
    if result['success']:
        return jsonify(result), 201
    else:
        return jsonify(result), 400


@quarantine_bp.route('/<path:test_name>', methods=['PUT'])
def update_quarantine_item(test_name):
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No JSON data provided'}), 400
    
    result = update_quarantine(
        test_name=test_name,
        reason=data.get('reason'),
        reason_category=data.get('reason_category'),
        expected_fix_date=data.get('expected_fix_date'),
        notes=data.get('notes')
    )
    
    if result['success']:
        return jsonify(result)
    else:
        return jsonify(result), 404


@quarantine_bp.route('/<path:test_name>', methods=['DELETE'])
def remove_quarantine(test_name):
    data = request.get_json() or {}
    
    deactivated_by = data.get('deactivated_by') or request.args.get('deactivated_by')
    deactivation_reason = data.get('deactivation_reason') or request.args.get('deactivation_reason')
    
    result = remove_from_quarantine(
        test_name=test_name,
        deactivated_by=deactivated_by,
        deactivation_reason=deactivation_reason
    )
    
    if result['success']:
        return jsonify(result)
    else:
        return jsonify(result), 404


@quarantine_bp.route('/stats', methods=['GET'])
def quarantine_stats():
    stats = get_quarantine_stats()
    return jsonify(stats)
