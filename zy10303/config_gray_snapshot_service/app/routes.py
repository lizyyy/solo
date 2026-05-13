from flask import Blueprint, request, jsonify
from .services import GraySnapshotService

bp = Blueprint('api', __name__, url_prefix='/api/v1')


@bp.route('/configs', methods=['POST'])
def create_config():
    data = request.get_json()
    required_fields = ['config_name', 'config_content', 'version', 'created_by']
    
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400
    
    result, status = GraySnapshotService.create_config_version(
        config_name=data['config_name'],
        config_content=data['config_content'],
        version=data['version'],
        created_by=data['created_by'],
        description=data.get('description'),
        request_id=data.get('request_id')
    )
    return jsonify(result), status


@bp.route('/configs/<version_key>/conditions', methods=['POST'])
def create_condition(version_key):
    data = request.get_json()
    required_fields = ['condition_type', 'condition_expression', 'created_by']
    
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400
    
    result, status = GraySnapshotService.create_gray_condition(
        version_key=version_key,
        condition_type=data['condition_type'],
        condition_expression=data['condition_expression'],
        created_by=data['created_by'],
        description=data.get('description'),
        priority=data.get('priority', 0),
        request_id=data.get('request_id')
    )
    return jsonify(result), status


@bp.route('/batches', methods=['POST'])
def create_batch():
    data = request.get_json()
    required_fields = ['version_key', 'batch_name', 'target_percentage', 'created_by']
    
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400
    
    result, status = GraySnapshotService.create_release_batch(
        version_key=data['version_key'],
        batch_name=data['batch_name'],
        target_percentage=data['target_percentage'],
        created_by=data['created_by'],
        request_id=data.get('request_id')
    )
    return jsonify(result), status


@bp.route('/batches/<batch_key>/rollback-points', methods=['POST'])
def create_rollback_point(batch_key):
    data = request.get_json()
    required_fields = ['created_by']
    
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400
    
    result, status = GraySnapshotService.create_rollback_point(
        batch_key=batch_key,
        created_by=data['created_by'],
        description=data.get('description'),
        request_id=data.get('request_id')
    )
    return jsonify(result), status


@bp.route('/tokens', methods=['POST'])
def create_token():
    data = request.get_json()
    required_fields = ['created_by', 'permissions']
    
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400
    
    result, status = GraySnapshotService.create_query_token(
        created_by=data['created_by'],
        permissions=data['permissions'],
        expires_hours=data.get('expires_hours', 24),
        request_id=data.get('request_id')
    )
    return jsonify(result), status


@bp.route('/batches/<batch_key>/evaluate', methods=['POST'])
def evaluate_hit(batch_key):
    data = request.get_json()
    required_fields = ['user_id', 'user_attributes']
    
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400
    
    result, status = GraySnapshotService.evaluate_gray_hit(
        batch_key=batch_key,
        user_id=data['user_id'],
        user_attributes=data['user_attributes'],
        request_id=data.get('request_id'),
        operator=data.get('operator', 'system')
    )
    return jsonify(result), status


@bp.route('/batches/<batch_key>/status', methods=['PUT'])
def update_status(batch_key):
    data = request.get_json()
    required_fields = ['new_status', 'updated_by']
    
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400
    
    result, status = GraySnapshotService.update_batch_status(
        batch_key=batch_key,
        new_status=data['new_status'],
        updated_by=data['updated_by'],
        current_percentage=data.get('current_percentage'),
        conclusion=data.get('conclusion'),
        request_id=data.get('request_id')
    )
    return jsonify(result), status


@bp.route('/rollbacks/<rollback_key>/execute', methods=['POST'])
def execute_rollback(rollback_key):
    data = request.get_json()
    required_fields = ['rolled_by']
    
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400
    
    result, status = GraySnapshotService.rollback_to_point(
        rollback_key=rollback_key,
        rolled_by=data['rolled_by'],
        request_id=data.get('request_id')
    )
    return jsonify(result), status


@bp.route('/batches/<batch_key>/history', methods=['GET'])
def get_history(batch_key):
    token_value = request.headers.get('X-Query-Token')
    result, status = GraySnapshotService.get_batch_history(
        batch_key=batch_key,
        token_value=token_value
    )
    return jsonify(result), status


@bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "config-gray-snapshot-service"}), 200
