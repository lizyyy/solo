import os
import uuid
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file, redirect, url_for, flash
from werkzeug.utils import secure_filename
from config import Config
from models import db, Resume, RiskDetection, DetectionHistory, ImportBatch
from utils.deduplicator import ResumeDeduplicator
from utils.importer import ResumeImporter
from utils.exporter import ReportExporter

app = Flask(__name__)
app.config.from_object(Config)

db.init_app(app)

with app.app_context():
    db.create_all()

deduplicator = ResumeDeduplicator()


def save_history(detection_id, action, old_data, new_data, action_by, change_reason=''):
    history = DetectionHistory(
        detection_id=detection_id,
        version=new_data.get('version', 1),
        action=action,
        action_by=action_by,
        old_risk_level=old_data.get('risk_level'),
        new_risk_level=new_data.get('risk_level'),
        old_manual_label=old_data.get('manual_label'),
        new_manual_label=new_data.get('manual_label'),
        old_reviewer_comment=old_data.get('reviewer_comment'),
        new_reviewer_comment=new_data.get('reviewer_comment'),
        change_reason=change_reason,
    )
    db.session.add(history)
    db.session.commit()


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/stats', methods=['GET'])
def get_stats():
    total_resumes = Resume.query.count()
    total_detections = RiskDetection.query.count()
    reviewed_count = RiskDetection.query.filter(RiskDetection.manual_label.isnot(None)).count()
    high_risk = RiskDetection.query.filter_by(risk_level='high').count()
    medium_risk = RiskDetection.query.filter_by(risk_level='medium').count()
    low_risk = RiskDetection.query.filter_by(risk_level='low').count()
    rollback_count = RiskDetection.query.filter_by(is_rollback=True).count()
    pending_count = total_detections - reviewed_count
    
    batches = ImportBatch.query.order_by(ImportBatch.created_at.desc()).limit(10).all()
    
    return jsonify({
        'total_resumes': total_resumes,
        'total_detections': total_detections,
        'reviewed_count': reviewed_count,
        'pending_count': pending_count,
        'high_risk': high_risk,
        'medium_risk': medium_risk,
        'low_risk': low_risk,
        'rollback_count': rollback_count,
        'batches': [b.to_dict() for b in batches]
    })


@app.route('/api/resumes', methods=['GET'])
def get_resumes():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    search = request.args.get('search', '')
    batch_id = request.args.get('batch_id', '')
    
    query = Resume.query
    
    if search:
        search_pattern = f'%{search}%'
        query = query.filter(
            (Resume.name.ilike(search_pattern)) |
            (Resume.phone.ilike(search_pattern)) |
            (Resume.email.ilike(search_pattern))
        )
    
    if batch_id:
        query = query.filter_by(batch_id=batch_id)
    
    pagination = query.order_by(Resume.created_at.desc()).paginate(page=page, per_page=per_page)
    
    return jsonify({
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': pagination.page,
        'per_page': pagination.per_page,
        'items': [r.to_dict() for r in pagination.items]
    })


@app.route('/api/resumes/<int:resume_id>', methods=['GET'])
def get_resume_detail(resume_id):
    resume = Resume.query.get_or_404(resume_id)
    
    related_detections = RiskDetection.query.filter(
        (RiskDetection.resume_id == resume_id) | 
        (RiskDetection.matched_resume_id == resume_id)
    ).order_by(RiskDetection.created_at.desc()).all()
    
    detections_list = []
    for det in related_detections:
        other_resume_id = det.matched_resume_id if det.resume_id == resume_id else det.resume_id
        other_resume = Resume.query.get(other_resume_id)
        det_dict = det.to_dict()
        det_dict['other_resume'] = other_resume.to_dict() if other_resume else None
        detections_list.append(det_dict)
    
    return jsonify({
        'resume': resume.to_dict(),
        'related_detections': detections_list
    })


@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': '未选择文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '未选择文件'}), 400
    
    if not ResumeImporter.allowed_file(file.filename):
        return jsonify({'error': '不支持的文件格式，请上传CSV或Excel文件'}), 400
    
    try:
        filename = secure_filename(file.filename)
        temp_path = os.path.join(app.config['UPLOAD_FOLDER'], f"temp_{uuid.uuid4().hex}_{filename}")
        file.save(temp_path)
        
        batch_id, success_records, failed_records, saved_path = ResumeImporter.import_file(
            temp_path, filename, app.config['UPLOAD_FOLDER']
        )
        
        total_records = len(success_records) + len(failed_records)
        
        import_batch = ImportBatch(
            id=batch_id,
            file_name=filename,
            total_records=total_records,
            success_records=len(success_records),
            failed_records=len(failed_records),
            imported_by='admin'
        )
        db.session.add(import_batch)
        
        for record in success_records:
            resume = Resume(**record)
            db.session.add(resume)
        
        db.session.commit()
        
        if os.path.exists(temp_path) and temp_path != saved_path:
            os.remove(temp_path)
        
        return jsonify({
            'batch_id': batch_id,
            'total_records': total_records,
            'success_records': len(success_records),
            'failed_records': len(failed_records),
            'failed_details': failed_records[:10]
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'导入失败: {str(e)}'}), 500


@app.route('/api/detect', methods=['POST'])
def run_detection():
    data = request.json
    batch_id = data.get('batch_id')
    min_score = data.get('min_score', 30)
    
    try:
        if batch_id:
            new_resumes = Resume.query.filter_by(batch_id=batch_id).all()
            existing_resumes = Resume.query.filter(Resume.batch_id != batch_id).all()
        else:
            new_resumes = Resume.query.all()
            existing_resumes = []
        
        new_resumes_dicts = [r.to_dict() for r in new_resumes]
        existing_resumes_dicts = [r.to_dict() for r in existing_resumes]
        
        results = deduplicator.detect_duplicates(
            new_resumes_dicts,
            existing_resumes_dicts,
            min_score=min_score
        )
        
        new_detections = []
        for result in results:
            existing = RiskDetection.query.filter(
                ((RiskDetection.resume_id == result['resume_id']) & 
                 (RiskDetection.matched_resume_id == result['matched_resume_id'])) |
                ((RiskDetection.resume_id == result['matched_resume_id']) & 
                 (RiskDetection.matched_resume_id == result['resume_id']))
            ).first()
            
            if not existing:
                detection = RiskDetection(
                    resume_id=result['resume_id'],
                    matched_resume_id=result['matched_resume_id'],
                    risk_level=result['risk_level'],
                    risk_score=result['score'],
                    risk_reason=result['risk_reason'],
                    matched_fields=result['matched_fields'],
                    auto_label=result['auto_label'],
                    version=1
                )
                db.session.add(detection)
                new_detections.append(detection)
        
        db.session.commit()
        
        return jsonify({
            'total_detected': len(results),
            'new_detections': len(new_detections),
            'high_risk': sum(1 for d in new_detections if d.risk_level == 'high'),
            'medium_risk': sum(1 for d in new_detections if d.risk_level == 'medium'),
            'low_risk': sum(1 for d in new_detections if d.risk_level == 'low')
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'检测失败: {str(e)}'}), 500


@app.route('/api/detections', methods=['GET'])
def get_detections():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    risk_level = request.args.get('risk_level', '')
    manual_label = request.args.get('manual_label', '')
    is_reviewed = request.args.get('is_reviewed', '')
    is_rollback = request.args.get('is_rollback', '')
    
    query = RiskDetection.query
    
    if risk_level:
        query = query.filter_by(risk_level=risk_level)
    
    if manual_label:
        query = query.filter_by(manual_label=manual_label)
    
    if is_reviewed == 'true':
        query = query.filter(RiskDetection.manual_label.isnot(None))
    elif is_reviewed == 'false':
        query = query.filter(RiskDetection.manual_label.is_(None))
    
    if is_rollback == 'true':
        query = query.filter_by(is_rollback=True)
    elif is_rollback == 'false':
        query = query.filter_by(is_rollback=False)
    
    pagination = query.order_by(RiskDetection.risk_score.desc(), RiskDetection.created_at.desc()).paginate(
        page=page, per_page=per_page
    )
    
    items = []
    for det in pagination.items:
        resume_a = Resume.query.get(det.resume_id)
        resume_b = Resume.query.get(det.matched_resume_id)
        
        det_dict = det.to_dict()
        det_dict['resume_a'] = resume_a.to_dict() if resume_a else None
        det_dict['resume_b'] = resume_b.to_dict() if resume_b else None
        items.append(det_dict)
    
    return jsonify({
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': pagination.page,
        'per_page': pagination.per_page,
        'items': items
    })


@app.route('/api/detections/<int:detection_id>', methods=['GET'])
def get_detection_detail(detection_id):
    detection = RiskDetection.query.get_or_404(detection_id)
    
    resume_a = Resume.query.get(detection.resume_id)
    resume_b = Resume.query.get(detection.matched_resume_id)
    
    history = DetectionHistory.query.filter_by(
        detection_id=detection_id
    ).order_by(DetectionHistory.created_at.desc()).all()
    
    det_dict = detection.to_dict()
    det_dict['resume_a'] = resume_a.to_dict() if resume_a else None
    det_dict['resume_b'] = resume_b.to_dict() if resume_b else None
    det_dict['history'] = [h.to_dict() for h in history]
    
    return jsonify(det_dict)


@app.route('/api/detections/<int:detection_id>/review', methods=['POST'])
def review_detection(detection_id):
    detection = RiskDetection.query.get_or_404(detection_id)
    data = request.json
    
    old_data = {
        'risk_level': detection.risk_level,
        'manual_label': detection.manual_label,
        'reviewer_comment': detection.reviewer_comment,
        'version': detection.version
    }
    
    manual_label = data.get('manual_label')
    reviewer_comment = data.get('reviewer_comment', '')
    reviewer = data.get('reviewer', 'admin')
    
    if not manual_label:
        return jsonify({'error': '必须提供人工标注结果'}), 400
    
    detection.manual_label = manual_label
    detection.reviewer_comment = reviewer_comment
    detection.reviewed_by = reviewer
    detection.reviewed_at = datetime.utcnow()
    detection.version += 1
    
    db.session.flush()
    
    save_history(
        detection_id=detection_id,
        action='review',
        old_data=old_data,
        new_data={
            'risk_level': detection.risk_level,
            'manual_label': detection.manual_label,
            'reviewer_comment': detection.reviewer_comment,
            'version': detection.version
        },
        action_by=reviewer,
        change_reason='人工复核'
    )
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'detection_id': detection_id,
        'manual_label': manual_label,
        'new_version': detection.version
    })


@app.route('/api/detections/<int:detection_id>/rollback', methods=['POST'])
def rollback_detection(detection_id):
    detection = RiskDetection.query.get_or_404(detection_id)
    data = request.json
    
    if detection.is_rollback:
        return jsonify({'error': '该记录已回滚'}), 400
    
    old_data = {
        'risk_level': detection.risk_level,
        'manual_label': detection.manual_label,
        'reviewer_comment': detection.reviewer_comment,
        'version': detection.version
    }
    
    rollback_reason = data.get('rollback_reason', '')
    rollback_by = data.get('rollback_by', 'admin')
    
    detection.is_rollback = True
    detection.rollback_reason = rollback_reason
    detection.rollback_by = rollback_by
    detection.rollback_at = datetime.utcnow()
    detection.version += 1
    
    db.session.flush()
    
    save_history(
        detection_id=detection_id,
        action='rollback',
        old_data=old_data,
        new_data={
            'risk_level': detection.risk_level,
            'manual_label': detection.manual_label,
            'reviewer_comment': detection.reviewer_comment,
            'version': detection.version
        },
        action_by=rollback_by,
        change_reason=f'误判回滚: {rollback_reason}'
    )
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'detection_id': detection_id,
        'is_rollback': True,
        'new_version': detection.version
    })


@app.route('/api/detections/<int:detection_id>/unrollback', methods=['POST'])
def unrollback_detection(detection_id):
    detection = RiskDetection.query.get_or_404(detection_id)
    data = request.json
    
    if not detection.is_rollback:
        return jsonify({'error': '该记录未被回滚'}), 400
    
    old_data = {
        'risk_level': detection.risk_level,
        'manual_label': detection.manual_label,
        'reviewer_comment': detection.reviewer_comment,
        'version': detection.version
    }
    
    reason = data.get('reason', '取消回滚')
    action_by = data.get('action_by', 'admin')
    
    detection.is_rollback = False
    detection.version += 1
    
    db.session.flush()
    
    save_history(
        detection_id=detection_id,
        action='unrollback',
        old_data=old_data,
        new_data={
            'risk_level': detection.risk_level,
            'manual_label': detection.manual_label,
            'reviewer_comment': detection.reviewer_comment,
            'version': detection.version
        },
        action_by=action_by,
        change_reason=f'取消回滚: {reason}'
    )
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'detection_id': detection_id,
        'is_rollback': False,
        'new_version': detection.version
    })


@app.route('/api/export/risk', methods=['GET'])
def export_risk_report():
    risk_level = request.args.get('risk_level', '')
    
    query = RiskDetection.query
    if risk_level:
        query = query.filter_by(risk_level=risk_level)
    
    detections = query.all()
    
    export_data = []
    for det in detections:
        resume_a = Resume.query.get(det.resume_id)
        resume_b = Resume.query.get(det.matched_resume_id)
        
        det_dict = det.to_dict()
        det_dict['resume_a'] = resume_a.to_dict() if resume_a else {}
        det_dict['resume_b'] = resume_b.to_dict() if resume_b else {}
        export_data.append(det_dict)
    
    file_path = ReportExporter.export_risk_report(export_data, app.config['EXPORT_FOLDER'])
    
    return send_file(file_path, as_attachment=True, download_name=os.path.basename(file_path))


@app.route('/api/export/history', methods=['GET'])
def export_history_report():
    detection_id = request.args.get('detection_id', type=int)
    
    query = DetectionHistory.query
    if detection_id:
        query = query.filter_by(detection_id=detection_id)
    
    histories = query.order_by(DetectionHistory.created_at.desc()).all()
    export_data = [h.to_dict() for h in histories]
    
    file_path = ReportExporter.export_history_report(export_data, app.config['EXPORT_FOLDER'])
    
    return send_file(file_path, as_attachment=True, download_name=os.path.basename(file_path))


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5555)
