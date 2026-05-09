from flask import Blueprint, request, jsonify, send_file
from backend.services.report_service import ReportService

report_bp = Blueprint('report', __name__)


@report_bp.route('/summary', methods=['GET'])
def get_summary():
    try:
        summary = ReportService.generate_summary()
        return jsonify({
            'success': True,
            'data': summary
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@report_bp.route('/export/clusters', methods=['GET'])
def export_clusters():
    try:
        format = request.args.get('format', 'csv').lower()
        if format not in ['csv', 'xlsx', 'excel']:
            format = 'csv'
        
        if format == 'excel':
            format = 'xlsx'
        
        filepath, filename = ReportService.export_clusters(format)
        
        mime_type = 'text/csv' if format == 'csv' else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        return send_file(filepath, as_attachment=True, download_name=filename, mimetype=mime_type)
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@report_bp.route('/export/operations', methods=['GET'])
def export_operations():
    try:
        format = request.args.get('format', 'csv').lower()
        if format not in ['csv', 'xlsx', 'excel']:
            format = 'csv'
        
        if format == 'excel':
            format = 'xlsx'
        
        filepath, filename = ReportService.export_operations(format)
        
        mime_type = 'text/csv' if format == 'csv' else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        return send_file(filepath, as_attachment=True, download_name=filename, mimetype=mime_type)
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@report_bp.route('/operations', methods=['GET'])
def list_operations():
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        
        result = ReportService.get_operations_log(page=page, per_page=per_page)
        return jsonify({
            'success': True,
            'data': result
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400
