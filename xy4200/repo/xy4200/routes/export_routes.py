from flask import Blueprint, request, jsonify, make_response
from datetime import datetime
import io

from app import db
from models import Pottery, SpliceGroup, Issue, AuditLog, Version
from services import ExportService, AuditService, RuleEngine

export_bp = Blueprint('export', __name__)


@export_bp.route('/review-form/<group_id>', methods=['GET'])
def export_review_form(group_id):
    group = SpliceGroup.query.filter_by(group_id=group_id).first()
    
    if not group:
        return jsonify({
            'success': False,
            'error': '拼接组不存在',
            'group_id': group_id
        }), 404
    
    include_issues = request.args.get('include_issues', 'true').lower() == 'true'
    download = request.args.get('download', 'true').lower() == 'true'
    
    try:
        markdown_content = ExportService.generate_markdown_review_form(
            group, include_issues=include_issues
        )
        
        user = request.args.get('user')
        AuditService.log_export(
            'review_form', 'markdown', 1, user=user
        )
        
        if download:
            response = make_response(markdown_content)
            response.headers['Content-Type'] = 'text/markdown; charset=utf-8'
            response.headers['Content-Disposition'] = f'attachment; filename=review_form_{group.group_id}_{datetime.now().strftime("%Y%m%d")}.md'
            return response
        else:
            return jsonify({
                'success': True,
                'data': {
                    'group_id': group.group_id,
                    'format': 'markdown',
                    'content': markdown_content
                }
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'生成复核单失败: {str(e)}'
        }), 500


@export_bp.route('/issues', methods=['GET'])
def export_issues():
    status = request.args.get('status')
    severity = request.args.get('severity')
    group_id = request.args.get('group_id')
    pottery_id = request.args.get('pottery_id')
    download = request.args.get('download', 'true').lower() == 'true'
    
    query = Issue.query
    
    if status:
        query = query.filter_by(status=status)
    if severity:
        query = query.filter_by(severity=severity)
    if group_id:
        group = SpliceGroup.query.filter_by(group_id=group_id).first()
        if group:
            query = query.filter_by(group_id=group.id)
    if pottery_id:
        pottery = Pottery.query.filter_by(pottery_id=pottery_id).first()
        if pottery:
            query = query.filter_by(pottery_id=pottery.id)
    
    issues = query.order_by(Issue.created_at.desc()).all()
    
    if not issues:
        return jsonify({
            'success': True,
            'data': {
                'count': 0,
                'issues': [],
                'message': '没有找到匹配的问题'
            }
        })
    
    try:
        csv_content, filename = ExportService.generate_issues_csv(issues)
        
        user = request.args.get('user')
        AuditService.log_export(
            'issues', 'csv', len(issues), user=user
        )
        
        if download:
            response = make_response(csv_content)
            response.headers['Content-Type'] = 'text/csv; charset=utf-8'
            response.headers['Content-Disposition'] = f'attachment; filename={filename}'
            return response
        else:
            return jsonify({
                'success': True,
                'data': {
                    'count': len(issues),
                    'filename': filename,
                    'content': csv_content
                }
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'导出问题表失败: {str(e)}'
        }), 500


@export_bp.route('/audit', methods=['GET'])
def export_audit():
    entity_type = request.args.get('entity_type')
    entity_id = request.args.get('entity_id')
    action = request.args.get('action')
    user = request.args.get('user')
    include_versions = request.args.get('include_versions', 'false').lower() == 'true'
    download = request.args.get('download', 'true').lower() == 'true'
    
    try:
        start_time = None
        end_time = None
        
        start_date_str = request.args.get('start_date')
        if start_date_str:
            start_time = datetime.strptime(start_date_str, '%Y-%m-%d')
        
        end_date_str = request.args.get('end_date')
        if end_date_str:
            end_time = datetime.strptime(end_date_str, '%Y-%m-%d')
        
        audit_logs = AuditService.get_logs(
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            user=user,
            start_time=start_time,
            end_time=end_time,
            limit=1000
        )
        
        versions = None
        if include_versions and entity_type and entity_id:
            from services import VersionManager
            versions = VersionManager.get_versions(entity_type, entity_id)
        
        json_content, filename = ExportService.generate_audit_json(
            audit_logs, include_versions=include_versions, versions=versions
        )
        
        export_user = request.args.get('export_user')
        AuditService.log_export(
            'audit', 'json', len(audit_logs), user=export_user
        )
        
        if download:
            response = make_response(json_content)
            response.headers['Content-Type'] = 'application/json; charset=utf-8'
            response.headers['Content-Disposition'] = f'attachment; filename={filename}'
            return response
        else:
            return jsonify({
                'success': True,
                'data': {
                    'log_count': len(audit_logs),
                    'version_count': len(versions) if versions else 0,
                    'filename': filename,
                    'content': json.loads(json_content)
                }
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'导出审计包失败: {str(e)}'
        }), 500


@export_bp.route('/potteries', methods=['GET'])
def export_potteries():
    trench = request.args.get('trench')
    layer = request.args.get('layer')
    status = request.args.get('status')
    format = request.args.get('format', 'json').lower()
    download = request.args.get('download', 'true').lower() == 'true'
    
    query = Pottery.query
    
    if trench:
        query = query.filter_by(trench=trench)
    if layer:
        query = query.filter_by(layer=layer)
    if status:
        query = query.filter_by(status=status)
    
    potteries = query.order_by(Pottery.created_at.desc()).all()
    
    if not potteries:
        return jsonify({
            'success': True,
            'data': {
                'count': 0,
                'potteries': [],
                'message': '没有找到匹配的陶片'
            }
        })
    
    try:
        content, filename = ExportService.generate_pottery_export(potteries, format)
        
        user = request.args.get('user')
        AuditService.log_export(
            'potteries', format, len(potteries), user=user
        )
        
        if download:
            if format == 'csv':
                response = make_response(content)
                response.headers['Content-Type'] = 'text/csv; charset=utf-8'
            else:
                response = make_response(content)
                response.headers['Content-Type'] = 'application/json; charset=utf-8'
            
            response.headers['Content-Disposition'] = f'attachment; filename={filename}'
            return response
        else:
            if format == 'json':
                data = json.loads(content)
            else:
                data = {'content': content}
            
            return jsonify({
                'success': True,
                'data': {
                    'count': len(potteries),
                    'format': format,
                    'filename': filename,
                    **data
                }
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'导出陶片数据失败: {str(e)}'
        }), 500


@export_bp.route('/groups', methods=['GET'])
def export_groups():
    status = request.args.get('status')
    format = request.args.get('format', 'json').lower()
    download = request.args.get('download', 'true').lower() == 'true'
    
    query = SpliceGroup.query
    
    if status:
        query = query.filter_by(status=status)
    
    groups = query.order_by(SpliceGroup.created_at.desc()).all()
    
    if not groups:
        return jsonify({
            'success': True,
            'data': {
                'count': 0,
                'groups': [],
                'message': '没有找到匹配的拼接组'
            }
        })
    
    try:
        content, filename = ExportService.generate_group_export(groups, format)
        
        user = request.args.get('user')
        AuditService.log_export(
            'groups', format, len(groups), user=user
        )
        
        if download:
            if format == 'csv':
                response = make_response(content)
                response.headers['Content-Type'] = 'text/csv; charset=utf-8'
            else:
                response = make_response(content)
                response.headers['Content-Type'] = 'application/json; charset=utf-8'
            
            response.headers['Content-Disposition'] = f'attachment; filename={filename}'
            return response
        else:
            if format == 'json':
                data = json.loads(content)
            else:
                data = {'content': content}
            
            return jsonify({
                'success': True,
                'data': {
                    'count': len(groups),
                    'format': format,
                    'filename': filename,
                    **data
                }
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'导出拼接组数据失败: {str(e)}'
        }), 500


@export_bp.route('/validation-report', methods=['POST'])
def export_validation_report():
    data = request.get_json() or {}
    
    all_potteries = Pottery.query.all()
    all_groups = SpliceGroup.query.all()
    
    specific_group_ids = data.get('group_ids', [])
    specific_pottery_ids = data.get('pottery_ids', [])
    
    if specific_group_ids:
        all_groups = [g for g in all_groups if g.group_id in specific_group_ids]
    if specific_pottery_ids:
        all_potteries = [p for p in all_potteries if p.pottery_id in specific_pottery_ids]
    
    rule_engine = RuleEngine()
    results = rule_engine.validate_all(all_potteries, all_groups)
    
    try:
        markdown_content = ExportService.generate_validation_report(results)
        
        user = data.get('user')
        AuditService.log_export(
            'validation_report', 'markdown', 
            len(all_potteries) + len(all_groups), user=user
        )
        
        download = request.args.get('download', 'true').lower() == 'true'
        
        if download:
            filename = f"validation_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
            response = make_response(markdown_content)
            response.headers['Content-Type'] = 'text/markdown; charset=utf-8'
            response.headers['Content-Disposition'] = f'attachment; filename={filename}'
            return response
        else:
            return jsonify({
                'success': True,
                'data': {
                    'results': results,
                    'markdown': markdown_content
                }
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'生成校验报告失败: {str(e)}'
        }), 500
