from flask import Blueprint, request, jsonify, make_response, current_app
from datetime import datetime, date
import os
import uuid
import json

from app.services.export_service import ExportService
from app.services.storage_service import StorageService

export_bp = Blueprint('export', __name__)

@export_bp.route('/validation/markdown', methods=['GET'])
def export_validation_markdown():
    broadcast_date = request.args.get('date')
    include_details = request.args.get('include_details', 'true').lower() == 'true'
    
    if not broadcast_date:
        return jsonify({'success': False, 'error': '请指定日期参数'}), 400
    
    try:
        date_obj = datetime.strptime(broadcast_date, '%Y-%m-%d').date()
    except:
        return jsonify({'success': False, 'error': '日期格式错误，请使用 YYYY-MM-DD'}), 400
    
    try:
        md_content = ExportService.export_validation_markdown(date_obj, include_details)
        
        if request.args.get('download', 'false').lower() == 'true':
            response = make_response(md_content)
            response.headers["Content-Disposition"] = f"attachment; filename=validation_report_{broadcast_date}.md"
            response.headers["Content-type"] = "text/markdown; charset=utf-8"
            return response
        
        return jsonify({
            'success': True,
            'date': str(date_obj),
            'format': 'markdown',
            'content': md_content
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@export_bp.route('/problems/csv', methods=['GET'])
def export_problems_csv():
    broadcast_date = request.args.get('date')
    
    if not broadcast_date:
        return jsonify({'success': False, 'error': '请指定日期参数'}), 400
    
    try:
        date_obj = datetime.strptime(broadcast_date, '%Y-%m-%d').date()
    except:
        return jsonify({'success': False, 'error': '日期格式错误，请使用 YYYY-MM-DD'}), 400
    
    try:
        csv_content = ExportService.export_problems_csv(date_obj)
        
        if request.args.get('download', 'false').lower() == 'true':
            response = make_response(csv_content)
            response.headers["Content-Disposition"] = f"attachment; filename=problems_{broadcast_date}.csv"
            response.headers["Content-type"] = "text/csv; charset=utf-8"
            return response
        
        return jsonify({
            'success': True,
            'date': str(date_obj),
            'format': 'csv',
            'content': csv_content
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@export_bp.route('/audit/json', methods=['GET'])
def export_audit_json():
    broadcast_date = request.args.get('date')
    include_events = request.args.get('include_events', 'true').lower() == 'true'
    include_programs = request.args.get('include_programs', 'true').lower() == 'true'
    include_contracts = request.args.get('include_contracts', 'true').lower() == 'true'
    include_opinions = request.args.get('include_opinions', 'true').lower() == 'true'
    
    if not broadcast_date:
        return jsonify({'success': False, 'error': '请指定日期参数'}), 400
    
    try:
        date_obj = datetime.strptime(broadcast_date, '%Y-%m-%d').date()
    except:
        return jsonify({'success': False, 'error': '日期格式错误，请使用 YYYY-MM-DD'}), 400
    
    try:
        json_content = ExportService.export_audit_json(
            date_obj,
            include_events=include_events,
            include_programs=include_programs,
            include_contracts=include_contracts,
            include_opinions=include_opinions
        )
        
        if request.args.get('download', 'false').lower() == 'true':
            response = make_response(json_content)
            response.headers["Content-Disposition"] = f"attachment; filename=audit_package_{broadcast_date}.json"
            response.headers["Content-type"] = "application/json; charset=utf-8"
            return response
        
        return jsonify({
            'success': True,
            'date': str(date_obj),
            'format': 'json',
            'content': json.loads(json_content)
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@export_bp.route('/events/csv', methods=['GET'])
def export_events_csv():
    broadcast_date = request.args.get('date')
    source_type = request.args.get('source_type')
    
    if not broadcast_date:
        return jsonify({'success': False, 'error': '请指定日期参数'}), 400
    
    try:
        date_obj = datetime.strptime(broadcast_date, '%Y-%m-%d').date()
    except:
        return jsonify({'success': False, 'error': '日期格式错误，请使用 YYYY-MM-DD'}), 400
    
    try:
        csv_content = ExportService.export_events_csv(date_obj, source_type)
        
        if request.args.get('download', 'false').lower() == 'true':
            suffix = f"_{source_type}" if source_type else ""
            response = make_response(csv_content)
            response.headers["Content-Disposition"] = f"attachment; filename=events{suffix}_{broadcast_date}.csv"
            response.headers["Content-type"] = "text/csv; charset=utf-8"
            return response
        
        return jsonify({
            'success': True,
            'date': str(date_obj),
            'source_type': source_type,
            'format': 'csv',
            'content': csv_content
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@export_bp.route('/contracts/csv', methods=['GET'])
def export_contracts_csv():
    try:
        csv_content = ExportService.export_contracts_csv()
        
        if request.args.get('download', 'false').lower() == 'true':
            response = make_response(csv_content)
            response.headers["Content-Disposition"] = f"attachment; filename=contracts_{datetime.now().strftime('%Y%m%d')}.csv"
            response.headers["Content-type"] = "text/csv; charset=utf-8"
            return response
        
        return jsonify({
            'success': True,
            'format': 'csv',
            'content': csv_content
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@export_bp.route('/daily/report', methods=['GET'])
def export_daily_report():
    broadcast_date = request.args.get('date')
    
    if not broadcast_date:
        return jsonify({'success': False, 'error': '请指定日期参数'}), 400
    
    try:
        date_obj = datetime.strptime(broadcast_date, '%Y-%m-%d').date()
    except:
        return jsonify({'success': False, 'error': '日期格式错误，请使用 YYYY-MM-DD'}), 400
    
    try:
        md_content = ExportService.export_daily_report_markdown(date_obj)
        
        if request.args.get('download', 'false').lower() == 'true':
            response = make_response(md_content)
            response.headers["Content-Disposition"] = f"attachment; filename=daily_report_{broadcast_date}.md"
            response.headers["Content-type"] = "text/markdown; charset=utf-8"
            return response
        
        return jsonify({
            'success': True,
            'date': str(date_obj),
            'format': 'markdown',
            'content': md_content
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@export_bp.route('/save', methods=['POST'])
def save_export_to_file():
    data = request.get_json() if request.is_json else request.form
    
    export_type = data.get('type')
    broadcast_date = data.get('date')
    
    if not export_type or not broadcast_date:
        return jsonify({'success': False, 'error': '请提供导出类型和日期'}), 400
    
    try:
        date_obj = datetime.strptime(broadcast_date, '%Y-%m-%d').date()
    except:
        return jsonify({'success': False, 'error': '日期格式错误'}), 400
    
    try:
        export_folder = current_app.config.get('EXPORT_FOLDER', 'exports')
        os.makedirs(export_folder, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = None
        content = None
        content_type = None
        
        if export_type == 'validation_markdown':
            content = ExportService.export_validation_markdown(date_obj)
            filename = f"validation_report_{broadcast_date}_{timestamp}.md"
            content_type = 'text/markdown'
        elif export_type == 'problems_csv':
            content = ExportService.export_problems_csv(date_obj)
            filename = f"problems_{broadcast_date}_{timestamp}.csv"
            content_type = 'text/csv'
        elif export_type == 'audit_json':
            content = ExportService.export_audit_json(date_obj)
            filename = f"audit_package_{broadcast_date}_{timestamp}.json"
            content_type = 'application/json'
        elif export_type == 'daily_report':
            content = ExportService.export_daily_report_markdown(date_obj)
            filename = f"daily_report_{broadcast_date}_{timestamp}.md"
            content_type = 'text/markdown'
        else:
            return jsonify({'success': False, 'error': f'不支持的导出类型: {export_type}'}), 400
        
        filepath = os.path.join(export_folder, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return jsonify({
            'success': True,
            'message': f'文件已保存',
            'file': {
                'name': filename,
                'path': filepath,
                'size': len(content),
                'content_type': content_type
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
