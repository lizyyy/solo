from flask import Blueprint, request, jsonify
from app.audit_log import AuditLogger

bp = Blueprint('audit', __name__, url_prefix='/api/audit')


@bp.route('/', methods=['GET'])
def get_logs():
    limit = int(request.args.get('limit', 100))
    offset = int(request.args.get('offset', 0))
    action = request.args.get('action')
    resource_type = request.args.get('resource_type')
    user_name = request.args.get('user_name')
    
    logs = AuditLogger.get_logs(
        limit=limit,
        offset=offset,
        action=action,
        resource_type=resource_type,
        user_name=user_name
    )
    
    return jsonify({
        'logs': logs,
        'limit': limit,
        'offset': offset,
        'total': len(logs)
    })


@bp.route('/actions', methods=['GET'])
def get_available_actions():
    actions = [
        'CREATE_LEDGER',
        'CREATE_BATCH',
        'CREATE_BOTTLE',
        'CREATE_CABINET',
        'PLACE_BOTTLE',
        'CREATE_DISPENSE',
        'REPORT_TEMPERATURE',
        'CREATE_WASTE_BUCKET',
        'CREATE_WASTE_RECORD',
        'DISPOSE_WASTE_BUCKET',
        'REVIEW_DISPENSE',
        'REVIEW_WASTE',
        'IMPORT_DATA',
        'EXPORT_DATA'
    ]
    
    return jsonify({'actions': actions})


@bp.route('/resource-types', methods=['GET'])
def get_resource_types():
    resource_types = [
        'ReagentLedger',
        'Batch',
        'Bottle',
        'Cabinet',
        'DispenseRecord',
        'TemperatureRecord',
        'WasteBucket',
        'WasteRecord'
    ]
    
    return jsonify({'resource_types': resource_types})
