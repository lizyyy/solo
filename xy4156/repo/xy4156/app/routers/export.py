from flask import Blueprint, request, jsonify, make_response
from app.import_export import (
    CSVImporter, JSONImporter, Exporter
)
from app.audit_log import AuditLogger
import json

bp = Blueprint('export', __name__, url_prefix='/api')


@bp.route('/import/ledgers/csv', methods=['POST'])
def import_ledgers_csv():
    csv_content = request.get_data(as_text=True)
    if not csv_content:
        csv_content = request.form.get('csv_data', '')
    
    created_by = request.args.get('created_by', 'system')
    
    count, errors = CSVImporter.import_ledgers(csv_content, created_by)
    
    return jsonify({
        'message': f'成功导入 {count} 条试剂台账',
        'imported_count': count,
        'errors': errors
    })


@bp.route('/import/ledgers/json', methods=['POST'])
def import_ledgers_json():
    data = request.get_json()
    if not data:
        return jsonify({'error': '请提供JSON数据'}), 400
    
    json_content = json.dumps(data, ensure_ascii=False)
    created_by = request.args.get('created_by', 'system')
    
    count, errors = JSONImporter.import_ledgers(json_content, created_by)
    
    return jsonify({
        'message': f'成功导入 {count} 条试剂台账',
        'imported_count': count,
        'errors': errors
    })


@bp.route('/import/batches/csv', methods=['POST'])
def import_batches_csv():
    csv_content = request.get_data(as_text=True)
    if not csv_content:
        csv_content = request.form.get('csv_data', '')
    
    created_by = request.args.get('created_by', 'system')
    
    count, errors = CSVImporter.import_batches(csv_content, created_by)
    
    return jsonify({
        'message': f'成功导入 {count} 条批次记录',
        'imported_count': count,
        'errors': errors
    })


@bp.route('/import/cabinets/csv', methods=['POST'])
def import_cabinets_csv():
    csv_content = request.get_data(as_text=True)
    if not csv_content:
        csv_content = request.form.get('csv_data', '')
    
    created_by = request.args.get('created_by', 'system')
    
    count, errors = CSVImporter.import_cabinets(csv_content, created_by)
    
    return jsonify({
        'message': f'成功导入 {count} 条柜位记录',
        'imported_count': count,
        'errors': errors
    })


@bp.route('/import/waste-buckets/csv', methods=['POST'])
def import_waste_buckets_csv():
    csv_content = request.get_data(as_text=True)
    if not csv_content:
        csv_content = request.form.get('csv_data', '')
    
    created_by = request.args.get('created_by', 'system')
    
    count, errors = CSVImporter.import_waste_buckets(csv_content, created_by)
    
    return jsonify({
        'message': f'成功导入 {count} 条废液桶记录',
        'imported_count': count,
        'errors': errors
    })


@bp.route('/import/temperature/csv', methods=['POST'])
def import_temperature_csv():
    csv_content = request.get_data(as_text=True)
    if not csv_content:
        csv_content = request.form.get('csv_data', '')
    
    created_by = request.args.get('created_by', 'system')
    
    count, errors = CSVImporter.import_temperature_records(csv_content, created_by)
    
    return jsonify({
        'message': f'成功导入 {count} 条温度记录',
        'imported_count': count,
        'errors': errors
    })


@bp.route('/export/ledgers/<format_type>', methods=['GET'])
def export_ledgers(format_type):
    if format_type not in ['json', 'csv', 'markdown']:
        return jsonify({'error': '不支持的导出格式，支持: json, csv, markdown'}), 400
    
    content, content_type = Exporter.export_ledgers(format_type)
    
    AuditLogger.log(
        action='EXPORT_DATA',
        resource_type='ReagentLedger',
        resource_id='export',
        user_name=request.args.get('requested_by', 'system'),
        details=json.dumps({'format': format_type}, ensure_ascii=False)
    )
    
    response = make_response(content)
    response.headers['Content-Type'] = f'{content_type}; charset=utf-8'
    if format_type == 'csv':
        response.headers['Content-Disposition'] = 'attachment; filename="ledgers.csv"'
    elif format_type == 'markdown':
        response.headers['Content-Disposition'] = 'attachment; filename="ledgers.md"'
    
    return response


@bp.route('/export/batches/<format_type>', methods=['GET'])
def export_batches(format_type):
    if format_type not in ['json', 'csv', 'markdown']:
        return jsonify({'error': '不支持的导出格式，支持: json, csv, markdown'}), 400
    
    content, content_type = Exporter.export_batches(format_type)
    
    AuditLogger.log(
        action='EXPORT_DATA',
        resource_type='Batch',
        resource_id='export',
        user_name=request.args.get('requested_by', 'system'),
        details=json.dumps({'format': format_type}, ensure_ascii=False)
    )
    
    response = make_response(content)
    response.headers['Content-Type'] = f'{content_type}; charset=utf-8'
    if format_type == 'csv':
        response.headers['Content-Disposition'] = 'attachment; filename="batches.csv"'
    elif format_type == 'markdown':
        response.headers['Content-Disposition'] = 'attachment; filename="batches.md"'
    
    return response


@bp.route('/export/dispense/<format_type>', methods=['GET'])
def export_dispense(format_type):
    if format_type not in ['json', 'csv', 'markdown']:
        return jsonify({'error': '不支持的导出格式，支持: json, csv, markdown'}), 400
    
    content, content_type = Exporter.export_dispense_records(format_type)
    
    AuditLogger.log(
        action='EXPORT_DATA',
        resource_type='DispenseRecord',
        resource_id='export',
        user_name=request.args.get('requested_by', 'system'),
        details=json.dumps({'format': format_type}, ensure_ascii=False)
    )
    
    response = make_response(content)
    response.headers['Content-Type'] = f'{content_type}; charset=utf-8'
    if format_type == 'csv':
        response.headers['Content-Disposition'] = 'attachment; filename="dispense_records.csv"'
    elif format_type == 'markdown':
        response.headers['Content-Disposition'] = 'attachment; filename="dispense_records.md"'
    
    return response


@bp.route('/export/waste/<format_type>', methods=['GET'])
def export_waste(format_type):
    if format_type not in ['json', 'csv', 'markdown']:
        return jsonify({'error': '不支持的导出格式，支持: json, csv, markdown'}), 400
    
    content, content_type = Exporter.export_waste_records(format_type)
    
    AuditLogger.log(
        action='EXPORT_DATA',
        resource_type='WasteRecord',
        resource_id='export',
        user_name=request.args.get('requested_by', 'system'),
        details=json.dumps({'format': format_type}, ensure_ascii=False)
    )
    
    response = make_response(content)
    response.headers['Content-Type'] = f'{content_type}; charset=utf-8'
    if format_type == 'csv':
        response.headers['Content-Disposition'] = 'attachment; filename="waste_records.csv"'
    elif format_type == 'markdown':
        response.headers['Content-Disposition'] = 'attachment; filename="waste_records.md"'
    
    return response


@bp.route('/export/temperature/<format_type>', methods=['GET'])
def export_temperature(format_type):
    if format_type not in ['json', 'csv', 'markdown']:
        return jsonify({'error': '不支持的导出格式，支持: json, csv, markdown'}), 400
    
    content, content_type = Exporter.export_temperature_records(format_type)
    
    AuditLogger.log(
        action='EXPORT_DATA',
        resource_type='TemperatureRecord',
        resource_id='export',
        user_name=request.args.get('requested_by', 'system'),
        details=json.dumps({'format': format_type}, ensure_ascii=False)
    )
    
    response = make_response(content)
    response.headers['Content-Type'] = f'{content_type}; charset=utf-8'
    if format_type == 'csv':
        response.headers['Content-Disposition'] = 'attachment; filename="temperature_records.csv"'
    elif format_type == 'markdown':
        response.headers['Content-Disposition'] = 'attachment; filename="temperature_records.md"'
    
    return response
