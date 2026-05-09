import os
import csv
import io
import json
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS

from config import Config
from models import db, Alert, ImportSession, MergeGroup, MergeVersion, CorrectionHistory
from merger import AlertMerger

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config['EXPORT_FOLDER'], exist_ok=True)
    
    db.init_app(app)
    CORS(app)
    
    with app.app_context():
        db.create_all()
    
    merger = AlertMerger()
    
    @app.route('/')
    def index():
        return render_template('index.html')
    
    @app.route('/api/alerts/import', methods=['POST'])
    def import_alerts():
        if 'file' not in request.files:
            return jsonify({'error': '未选择文件'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '未选择文件'}), 400
        
        if not file.filename.endswith('.csv'):
            return jsonify({'error': '只支持CSV格式文件'}), 400
        
        try:
            file_content = file.read().decode('utf-8')
            csv_reader = csv.DictReader(io.StringIO(file_content))
            
            session = ImportSession(filename=file.filename)
            db.session.add(session)
            db.session.commit()
            
            alerts = []
            for row in csv_reader:
                alert = Alert(
                    device_id=row.get('device_id', row.get('设备ID', 'unknown')),
                    alert_type=row.get('alert_type', row.get('告警类型', 'unknown')),
                    message=row.get('message', row.get('消息', '')),
                    severity=row.get('severity', row.get('级别', 'warning')),
                    source=row.get('source', row.get('来源', '')),
                    import_session_id=session.id
                )
                
                timestamp_str = row.get('timestamp', row.get('时间', ''))
                if timestamp_str:
                    try:
                        alert.timestamp = datetime.fromisoformat(timestamp_str)
                    except:
                        try:
                            alert.timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')
                        except:
                            pass
                
                alerts.append(alert)
            
            db.session.bulk_save_objects(alerts)
            session.record_count = len(alerts)
            db.session.commit()
            
            return jsonify({
                'success': True,
                'session_id': session.id,
                'filename': session.filename,
                'imported_count': len(alerts)
            })
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'导入失败: {str(e)}'}), 500
    
    @app.route('/api/merger/run', methods=['POST'])
    def run_merger():
        try:
            data = request.get_json() or {}
            
            if data.get('config'):
                merger.update_config(data['config'])
            
            query = Alert.query
            if data.get('import_session_id'):
                query = query.filter_by(import_session_id=data['import_session_id'])
            
            unmerged_alerts = query.filter_by(merge_group_id=None).all()
            
            if not unmerged_alerts:
                return jsonify({'message': '没有需要归并的告警'}), 200
            
            merge_results = merger.merge_alerts(unmerged_alerts)
            
            version = MergeVersion(
                version_number=f"v{datetime.now().strftime('%Y%m%d.%H%M%S')}",
                description=data.get('description', '自动归并版本'),
                algorithm_config=merger.config.copy(),
                group_count=len(merge_results)
            )
            db.session.add(version)
            db.session.commit()
            
            for result in merge_results:
                group = MergeGroup(
                    group_name=result.group_name,
                    device_id=result.representative.device_id,
                    alert_count=len(result.alerts),
                    merge_version_id=version.id,
                    status='merged',
                    review_status='pending'
                )
                db.session.add(group)
                db.session.flush()
                
                group.representative_alert_id = result.representative.id
                
                for alert in result.alerts:
                    alert.merge_group_id = group.id
            
            db.session.commit()
            
            return jsonify({
                'success': True,
                'version_id': version.id,
                'version_number': version.version_number,
                'group_count': len(merge_results),
                'alerts_processed': len(unmerged_alerts)
            })
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'归并失败: {str(e)}'}), 500
    
    @app.route('/api/groups', methods=['GET'])
    def list_groups():
        version_id = request.args.get('version_id')
        device_id = request.args.get('device_id')
        review_status = request.args.get('review_status')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        
        query = MergeGroup.query
        
        if version_id:
            query = query.filter_by(merge_version_id=version_id)
        if device_id:
            query = query.filter_by(device_id=device_id)
        if review_status:
            query = query.filter_by(review_status=review_status)
        
        pagination = query.order_by(MergeGroup.created_at.desc()).paginate(page=page, per_page=per_page)
        
        return jsonify({
            'groups': [g.to_dict() for g in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        })
    
    @app.route('/api/groups/<int:group_id>', methods=['GET'])
    def get_group(group_id):
        group = MergeGroup.query.get_or_404(group_id)
        alerts = Alert.query.filter_by(merge_group_id=group_id).order_by(Alert.timestamp).all()
        
        return jsonify({
            'group': group.to_dict(),
            'alerts': [a.to_dict() for a in alerts]
        })
    
    @app.route('/api/groups/<int:group_id>/review', methods=['POST'])
    def review_group(group_id):
        group = MergeGroup.query.get_or_404(group_id)
        data = request.get_json() or {}
        
        group.review_status = data.get('status', 'approved')
        group.reviewer = data.get('reviewer', 'operator')
        group.reviewed_at = datetime.utcnow()
        group.review_notes = data.get('notes', '')
        
        db.session.commit()
        
        return jsonify({'success': True, 'group': group.to_dict()})
    
    @app.route('/api/alerts/<int:alert_id>/move', methods=['POST'])
    def move_alert(alert_id):
        alert = Alert.query.get_or_404(alert_id)
        data = request.get_json() or {}
        
        original_group_id = alert.merge_group_id
        new_group_id = data.get('new_group_id')
        reason = data.get('reason', '')
        corrected_by = data.get('corrected_by', 'operator')
        
        if not reason:
            return jsonify({'error': '必须提供修正理由'}), 400
        
        if new_group_id:
            new_group = MergeGroup.query.get(new_group_id)
            if not new_group:
                return jsonify({'error': '目标归并组不存在'}), 404
            
            action = 'moved'
        else:
            action = 'unmerged'
        
        if original_group_id:
            original_group = MergeGroup.query.get(original_group_id)
            if original_group:
                original_group.alert_count = original_group.alerts.count()
        
        alert.merge_group_id = new_group_id
        
        if new_group_id:
            new_group = MergeGroup.query.get(new_group_id)
            if new_group:
                new_group.alert_count = new_group.alerts.count()
        
        version_id = None
        if original_group_id:
            original_group = MergeGroup.query.get(original_group_id)
            if original_group:
                version_id = original_group.merge_version_id
        
        correction = CorrectionHistory(
            merge_version_id=version_id,
            alert_id=alert.id,
            original_group_id=original_group_id,
            new_group_id=new_group_id,
            action=action,
            reason=reason,
            corrected_by=corrected_by
        )
        db.session.add(correction)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'alert_id': alert.id,
            'original_group_id': original_group_id,
            'new_group_id': new_group_id,
            'correction_id': correction.id
        })
    
    @app.route('/api/versions', methods=['GET'])
    def list_versions():
        versions = MergeVersion.query.order_by(MergeVersion.created_at.desc()).all()
        return jsonify([v.to_dict() for v in versions])
    
    @app.route('/api/versions/<int:version_id>', methods=['GET'])
    def get_version(version_id):
        version = MergeVersion.query.get_or_404(version_id)
        groups = MergeGroup.query.filter_by(merge_version_id=version_id).all()
        corrections = CorrectionHistory.query.filter_by(merge_version_id=version_id).all()
        
        return jsonify({
            'version': version.to_dict(),
            'groups': [g.to_dict() for g in groups],
            'corrections': [c.to_dict() for c in corrections]
        })
    
    @app.route('/api/corrections', methods=['GET'])
    def list_corrections():
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        
        pagination = CorrectionHistory.query.order_by(CorrectionHistory.created_at.desc()).paginate(page=page, per_page=per_page)
        
        return jsonify({
            'corrections': [c.to_dict() for c in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages
        })
    
    @app.route('/api/export/report', methods=['GET'])
    def export_report():
        version_id = request.args.get('version_id')
        format_type = request.args.get('format', 'json')
        
        if version_id:
            version = MergeVersion.query.get_or_404(version_id)
            groups = MergeGroup.query.filter_by(merge_version_id=version_id).all()
        else:
            version = None
            groups = MergeGroup.query.all()
        
        report_data = {
            'generated_at': datetime.now().isoformat(),
            'version': version.to_dict() if version else None,
            'statistics': {
                'total_groups': len(groups),
                'total_alerts': sum(g.alert_count for g in groups),
                'approved_count': sum(1 for g in groups if g.review_status == 'approved'),
                'pending_count': sum(1 for g in groups if g.review_status == 'pending')
            },
            'groups': []
        }
        
        for group in groups:
            alerts = Alert.query.filter_by(merge_group_id=group.id).all()
            group_data = {
                **group.to_dict(),
                'alerts': [a.to_dict() for a in alerts]
            }
            report_data['groups'].append(group_data)
        
        if format_type == 'json':
            output = io.StringIO()
            json.dump(report_data, output, ensure_ascii=False, indent=2)
            output.seek(0)
            
            return send_file(
                io.BytesIO(output.getvalue().encode('utf-8')),
                mimetype='application/json',
                as_attachment=True,
                download_name=f'merge_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
            )
        
        elif format_type == 'csv':
            output = io.StringIO()
            writer = csv.writer(output)
            
            writer.writerow(['归并组ID', '归并组名称', '设备ID', '告警数量', '复核状态', '告警ID', '告警类型', '告警消息', '时间'])
            
            for group in groups:
                alerts = Alert.query.filter_by(merge_group_id=group.id).all()
                for alert in alerts:
                    writer.writerow([
                        group.id,
                        group.group_name,
                        group.device_id,
                        group.alert_count,
                        group.review_status,
                        alert.id,
                        alert.alert_type,
                        alert.message,
                        alert.timestamp
                    ])
            
            output.seek(0)
            return send_file(
                io.BytesIO(output.getvalue().encode('utf-8-sig')),
                mimetype='text/csv',
                as_attachment=True,
                download_name=f'merge_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            )
        
        return jsonify(report_data)
    
    @app.route('/api/stats', methods=['GET'])
    def get_stats():
        total_alerts = Alert.query.count()
        total_groups = MergeGroup.query.count()
        pending_groups = MergeGroup.query.filter_by(review_status='pending').count()
        approved_groups = MergeGroup.query.filter_by(review_status='approved').count()
        total_versions = MergeVersion.query.count()
        total_corrections = CorrectionHistory.query.count()
        
        device_stats = db.session.query(
            Alert.device_id,
            db.func.count(Alert.id).label('alert_count')
        ).group_by(Alert.device_id).order_by(db.desc('alert_count')).limit(10).all()
        
        return jsonify({
            'total_alerts': total_alerts,
            'total_groups': total_groups,
            'pending_groups': pending_groups,
            'approved_groups': approved_groups,
            'total_versions': total_versions,
            'total_corrections': total_corrections,
            'top_devices': [{'device_id': d[0], 'alert_count': d[1]} for d in device_stats]
        })
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, port=5000)
