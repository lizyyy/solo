import os
import logging
from flask import Flask, request, jsonify, send_file
from datetime import datetime
from config import Config
from database import Database
from issue_detector import IssueDetector

logger = logging.getLogger(__name__)

def create_app(db: Database = None, detector: IssueDetector = None):
    app = Flask(__name__)
    app.config.from_object(Config)
    
    db = db or Database()
    detector = detector or IssueDetector(db)
    
    @app.route('/api/performances', methods=['GET'])
    def get_performances():
        performances = db.get_all_performances()
        
        result = []
        for perf in performances:
            files = db.get_performance_files(perf['id'])
            perf_info = {
                'id': perf['id'],
                'performance_name': perf['performance_name'],
                'performance_date': perf['performance_date'],
                'status': perf['status'],
                'is_public': bool(perf['is_public']),
                'needs_takedown': bool(perf['needs_takedown']),
                'notes': perf['notes'],
                'created_at': perf['created_at'],
                'updated_at': perf['updated_at'],
                'files': {
                    'audio_count': len(files['audio']),
                    'transcript_count': len(files['transcripts']),
                    'license_count': len(files['licenses']),
                    'audio': files['audio'],
                    'transcripts': files['transcripts'],
                    'licenses': files['licenses']
                }
            }
            result.append(perf_info)
        
        return jsonify({
            'success': True,
            'data': result,
            'count': len(result)
        })
    
    @app.route('/api/performances/<int:performance_id>', methods=['GET'])
    def get_performance(performance_id):
        perf = db.get_performance_by_id(performance_id)
        if not perf:
            return jsonify({
                'success': False,
                'message': f'演出不存在: ID {performance_id}'
            }), 404
        
        files = db.get_performance_files(performance_id)
        
        result = {
            'id': perf['id'],
            'performance_name': perf['performance_name'],
            'performance_date': perf['performance_date'],
            'status': perf['status'],
            'is_public': bool(perf['is_public']),
            'needs_takedown': bool(perf['needs_takedown']),
            'notes': perf['notes'],
            'created_at': perf['created_at'],
            'updated_at': perf['updated_at'],
            'files': {
                'audio': files['audio'],
                'transcripts': files['transcripts'],
                'licenses': files['licenses']
            }
        }
        
        return jsonify({
            'success': True,
            'data': result
        })
    
    @app.route('/api/performances/<int:performance_id>', methods=['PUT', 'PATCH'])
    def update_performance(performance_id):
        perf = db.get_performance_by_id(performance_id)
        if not perf:
            return jsonify({
                'success': False,
                'message': f'演出不存在: ID {performance_id}'
            }), 404
        
        data = request.get_json() or {}
        
        update_fields = {}
        
        if 'performance_date' in data:
            update_fields['performance_date'] = data['performance_date']
        
        if 'is_public' in data:
            update_fields['is_public'] = 1 if data['is_public'] else 0
        
        if 'needs_takedown' in data:
            update_fields['needs_takedown'] = 1 if data['needs_takedown'] else 0
        
        if 'notes' in data:
            update_fields['notes'] = data['notes']
        
        if not update_fields:
            return jsonify({
                'success': False,
                'message': '没有提供可更新的字段'
            }), 400
        
        db.update_performance_info(performance_id, **update_fields)
        
        updated_perf = db.get_performance_by_id(performance_id)
        
        return jsonify({
            'success': True,
            'message': '演出信息已更新',
            'data': {
                'id': updated_perf['id'],
                'performance_name': updated_perf['performance_name'],
                'is_public': bool(updated_perf['is_public']),
                'needs_takedown': bool(updated_perf['needs_takedown']),
                'notes': updated_perf['notes'],
                'performance_date': updated_perf['performance_date']
            }
        })
    
    @app.route('/api/performances/<int:performance_id>/public', methods=['POST'])
    def mark_public(performance_id):
        perf = db.get_performance_by_id(performance_id)
        if not perf:
            return jsonify({
                'success': False,
                'message': f'演出不存在: ID {performance_id}'
            }), 404
        
        data = request.get_json() or {}
        is_public = data.get('is_public', True)
        
        db.update_performance_info(performance_id, is_public=1 if is_public else 0)
        
        action = '标记为可公开' if is_public else '取消公开标记'
        
        return jsonify({
            'success': True,
            'message': f'演出已{action}',
            'data': {
                'performance_id': performance_id,
                'performance_name': perf['performance_name'],
                'is_public': is_public
            }
        })
    
    @app.route('/api/performances/<int:performance_id>/takedown', methods=['POST'])
    def mark_takedown(performance_id):
        perf = db.get_performance_by_id(performance_id)
        if not perf:
            return jsonify({
                'success': False,
                'message': f'演出不存在: ID {performance_id}'
            }), 404
        
        data = request.get_json() or {}
        needs_takedown = data.get('needs_takedown', True)
        
        db.update_performance_info(performance_id, needs_takedown=1 if needs_takedown else 0)
        
        action = '标记为需下架' if needs_takedown else '取消下架标记'
        
        return jsonify({
            'success': True,
            'message': f'演出已{action}',
            'data': {
                'performance_id': performance_id,
                'performance_name': perf['performance_name'],
                'needs_takedown': needs_takedown
            }
        })
    
    @app.route('/api/missing', methods=['GET'])
    def get_missing_files():
        missing = detector.check_missing_files()
        
        return jsonify({
            'success': True,
            'data': missing,
            'count': len(missing)
        })
    
    @app.route('/api/issues', methods=['GET'])
    def get_issues():
        resolved = request.args.get('resolved', 'false').lower() == 'true'
        
        if resolved:
            issues = db.get_open_issues()
        else:
            issues = db.get_open_issues()
        
        return jsonify({
            'success': True,
            'data': issues,
            'count': len(issues)
        })
    
    @app.route('/api/issues/<int:issue_id>/resolve', methods=['POST'])
    def resolve_issue(issue_id):
        db.resolve_issue(issue_id)
        
        return jsonify({
            'success': True,
            'message': '问题已标记为已解决',
            'data': {
                'issue_id': issue_id
            }
        })
    
    @app.route('/api/issues/summary', methods=['GET'])
    def get_issue_summary():
        summary = detector.get_issue_summary()
        
        return jsonify({
            'success': True,
            'data': summary
        })
    
    @app.route('/api/licenses/expiring', methods=['GET'])
    def get_expiring_licenses():
        warning_days = request.args.get('warning_days', Config.LICENSE_EXPIRY_WARNING_DAYS)
        try:
            warning_days = int(warning_days)
        except ValueError:
            warning_days = Config.LICENSE_EXPIRY_WARNING_DAYS
        
        expiring = detector.check_license_expiry(warning_days)
        
        return jsonify({
            'success': True,
            'data': expiring,
            'count': len(expiring),
            'warning_days': warning_days
        })
    
    @app.route('/api/scan', methods=['POST'])
    def scan_issues():
        results = detector.detect_all_issues()
        
        total_issues = sum(len(v) for v in results.values())
        
        return jsonify({
            'success': True,
            'message': f'扫描完成，发现 {total_issues} 个问题',
            'data': results,
            'total_issues': total_issues
        })
    
    @app.route('/api/stats', methods=['GET'])
    def get_stats():
        performances = db.get_all_performances()
        open_issues = db.get_open_issues()
        
        stats = {
            'total_performances': len(performances),
            'complete_performances': len([p for p in performances if p['status'] == 'complete']),
            'partial_performances': len([p for p in performances if p['status'] == 'partial']),
            'incomplete_performances': len([p for p in performances if p['status'] == 'incomplete']),
            'public_performances': len([p for p in performances if p['is_public']]),
            'needs_takedown': len([p for p in performances if p['needs_takedown']]),
            'open_issues': len(open_issues)
        }
        
        return jsonify({
            'success': True,
            'data': stats
        })
    
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            'success': True,
            'status': 'healthy',
            'timestamp': datetime.now().isoformat()
        })
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(
        host=Config.FLASK_HOST,
        port=Config.FLASK_PORT,
        debug=Config.DEBUG
    )
