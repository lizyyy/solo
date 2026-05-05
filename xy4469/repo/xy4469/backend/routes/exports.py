from flask import Blueprint, request, jsonify, Response, make_response
from models import db, AuditLog
from services import DataExporter
from datetime import datetime

exports_bp = Blueprint('exports', __name__)

@exports_bp.route('/<batch_id>/quality-report', methods=['GET'])
def export_quality_report(batch_id):
    try:
        user = request.args.get('user', 'system')
        
        report_content = DataExporter.generate_quality_report(batch_id)
        
        audit_log = AuditLog(
            action='export',
            entity_type='batch',
            details=f'导出品检报告: {batch_id}',
            user=user
        )
        db.session.add(audit_log)
        db.session.commit()
        
        response = make_response(report_content)
        response.headers['Content-Type'] = 'text/markdown; charset=utf-8'
        response.headers['Content-Disposition'] = f'attachment; filename=quality-report-{batch_id}.md'
        
        return response
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@exports_bp.route('/<batch_id>/risk-list', methods=['GET'])
def export_risk_list(batch_id):
    try:
        user = request.args.get('user', 'system')
        
        csv_content = DataExporter.generate_risk_csv(batch_id)
        
        audit_log = AuditLog(
            action='export',
            entity_type='batch',
            details=f'导出风险清单: {batch_id}',
            user=user
        )
        db.session.add(audit_log)
        db.session.commit()
        
        response = make_response(csv_content)
        response.headers['Content-Type'] = 'text/csv; charset=utf-8-sig'
        response.headers['Content-Disposition'] = f'attachment; filename=risk-list-{batch_id}.csv'
        
        return response
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@exports_bp.route('/<batch_id>/audit-package', methods=['GET'])
def export_audit_package(batch_id):
    try:
        user = request.args.get('user', 'system')
        
        json_content = DataExporter.generate_audit_json(batch_id)
        
        audit_log = AuditLog(
            action='export',
            entity_type='batch',
            details=f'导出审计包: {batch_id}',
            user=user
        )
        db.session.add(audit_log)
        db.session.commit()
        
        response = make_response(json_content)
        response.headers['Content-Type'] = 'application/json; charset=utf-8'
        response.headers['Content-Disposition'] = f'attachment; filename=audit-package-{batch_id}.json'
        
        return response
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@exports_bp.route('/<batch_id>/preview', methods=['GET'])
def preview_report(batch_id):
    try:
        format_type = request.args.get('format', 'markdown')
        
        if format_type == 'markdown':
            content = DataExporter.generate_quality_report(batch_id)
            return jsonify({
                'success': True,
                'data': {
                    'format': 'markdown',
                    'content': content,
                    'filename': f'quality-report-{batch_id}.md'
                }
            })
        elif format_type == 'csv':
            content = DataExporter.generate_risk_csv(batch_id)
            return jsonify({
                'success': True,
                'data': {
                    'format': 'csv',
                    'content': content,
                    'filename': f'risk-list-{batch_id}.csv'
                }
            })
        elif format_type == 'json':
            content = DataExporter.generate_audit_json(batch_id)
            return jsonify({
                'success': True,
                'data': {
                    'format': 'json',
                    'content': content,
                    'filename': f'audit-package-{batch_id}.json'
                }
            })
        else:
            return jsonify({'success': False, 'error': '不支持的预览格式'}), 400
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
