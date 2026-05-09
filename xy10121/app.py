import os
import uuid
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file
from werkzeug.utils import secure_filename
import pandas as pd
from dateutil import parser

from config import Config
from models import db, PatientRecord, VersionHistory, Misjudgment, ImportBatch, RISK_LEVELS, REVIEW_STATUSES
from risk_engine import risk_engine

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)


def init_db():
    with app.app_context():
        db.create_all()


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/records', methods=['GET'])
def get_records():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    risk_level = request.args.get('risk_level')
    review_status = request.args.get('review_status')
    search = request.args.get('search', '')
    batch_id = request.args.get('batch_id')
    
    query = PatientRecord.query
    
    if risk_level:
        query = query.filter((PatientRecord.manual_risk_level == risk_level) | 
                            (PatientRecord.manual_risk_level == None) & (PatientRecord.auto_risk_level == risk_level))
    
    if review_status:
        query = query.filter(PatientRecord.review_status == review_status)
    
    if search:
        search_pattern = f'%{search}%'
        query = query.filter((PatientRecord.patient_id.like(search_pattern)) |
                            (PatientRecord.patient_name.like(search_pattern)) |
                            (PatientRecord.follow_up_text.like(search_pattern)))
    
    if batch_id:
        query = query.filter(PatientRecord.import_batch_id == batch_id)
    
    pagination = query.order_by(PatientRecord.id.desc()).paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'records': [r.to_dict() for r in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page
    })


@app.route('/api/records/<int:record_id>', methods=['GET'])
def get_record(record_id):
    record = PatientRecord.query.get_or_404(record_id)
    return jsonify(record.to_dict())


@app.route('/api/records/<int:record_id>/history', methods=['GET'])
def get_record_history(record_id):
    histories = VersionHistory.query.filter_by(record_id=record_id).order_by(VersionHistory.created_at.desc()).all()
    return jsonify([h.to_dict() for h in histories])


@app.route('/api/records/<int:record_id>/review', methods=['POST'])
def review_record(record_id):
    record = PatientRecord.query.get_or_404(record_id)
    data = request.get_json()
    
    action = data.get('action')
    new_risk_level = data.get('risk_level')
    reason = data.get('reason', '')
    operator = data.get('operator', 'admin')
    
    previous_risk = record.manual_risk_level or record.auto_risk_level
    previous_reason = record.manual_risk_reason or record.auto_risk_reason
    previous_status = record.review_status
    
    version_history = VersionHistory(
        record_id=record.id,
        previous_risk_level=previous_risk,
        previous_reason=previous_reason,
        previous_status=previous_status
    )
    
    if action == 'approve':
        record.review_status = 'approved'
        record.manual_risk_level = record.auto_risk_level
        record.manual_risk_reason = reason or record.auto_risk_reason
        version_history.new_risk_level = record.auto_risk_level
        version_history.new_reason = reason or record.auto_risk_reason
        version_history.new_status = 'approved'
        version_history.change_type = '确认自动分层'
        version_history.change_reason = reason or '人工确认，风险等级无误'
    
    elif action == 'modify':
        if new_risk_level and new_risk_level in RISK_LEVELS:
            record.review_status = 'modified'
            record.manual_risk_level = new_risk_level
            record.manual_risk_reason = reason
            
            version_history.new_risk_level = new_risk_level
            version_history.new_reason = reason
            version_history.new_status = 'modified'
            version_history.change_type = '人工修正'
            version_history.change_reason = reason
            
            if record.auto_risk_level != new_risk_level:
                misjudgment_type = '漏判' if RISK_LEVELS[new_risk_level]['score'] > RISK_LEVELS[record.auto_risk_level]['score'] else '误判'
                misjudgment = Misjudgment(
                    record_id=record.id,
                    auto_risk_level=record.auto_risk_level,
                    correct_risk_level=new_risk_level,
                    misjudgment_type=misjudgment_type,
                    follow_up_text=record.follow_up_text,
                    auto_keywords=record.auto_risk_keywords,
                    correction_reason=reason,
                    reported_by=operator
                )
                db.session.add(misjudgment)
    
    elif action == 'rollback':
        record.review_status = 'rejected'
        record.manual_risk_level = None
        record.manual_risk_reason = None
        
        version_history.new_risk_level = record.auto_risk_level
        version_history.new_reason = record.auto_risk_reason
        version_history.new_status = 'rejected'
        version_history.change_type = '回滚'
        version_history.change_reason = reason or '回滚到待复核状态'
    
    record.reviewed_by = operator
    record.reviewed_at = datetime.utcnow()
    version_history.operator = operator
    
    db.session.add(version_history)
    db.session.commit()
    
    return jsonify(record.to_dict())


@app.route('/api/records/batch-review', methods=['POST'])
def batch_review():
    data = request.get_json()
    record_ids = data.get('record_ids', [])
    action = data.get('action')
    new_risk_level = data.get('risk_level')
    reason = data.get('reason', '')
    operator = data.get('operator', 'admin')
    
    success_count = 0
    for record_id in record_ids:
        record = PatientRecord.query.get(record_id)
        if not record:
            continue
        
        previous_risk = record.manual_risk_level or record.auto_risk_level
        previous_reason = record.manual_risk_reason or record.auto_risk_reason
        previous_status = record.review_status
        
        version_history = VersionHistory(
            record_id=record.id,
            previous_risk_level=previous_risk,
            previous_reason=previous_reason,
            previous_status=previous_status
        )
        
        if action == 'approve':
            record.review_status = 'approved'
            record.manual_risk_level = record.auto_risk_level
            record.manual_risk_reason = reason or record.auto_risk_reason
            version_history.new_risk_level = record.auto_risk_level
            version_history.new_reason = reason or record.auto_risk_reason
            version_history.new_status = 'approved'
            version_history.change_type = '批量确认'
            version_history.change_reason = reason or '批量确认，风险等级无误'
        
        elif action == 'modify' and new_risk_level in RISK_LEVELS:
            record.review_status = 'modified'
            record.manual_risk_level = new_risk_level
            record.manual_risk_reason = reason
            version_history.new_risk_level = new_risk_level
            version_history.new_reason = reason
            version_history.new_status = 'modified'
            version_history.change_type = '批量修正'
            version_history.change_reason = reason
            
            if record.auto_risk_level != new_risk_level:
                misjudgment_type = '漏判' if RISK_LEVELS[new_risk_level]['score'] > RISK_LEVELS[record.auto_risk_level]['score'] else '误判'
                misjudgment = Misjudgment(
                    record_id=record.id,
                    auto_risk_level=record.auto_risk_level,
                    correct_risk_level=new_risk_level,
                    misjudgment_type=misjudgment_type,
                    follow_up_text=record.follow_up_text,
                    auto_keywords=record.auto_risk_keywords,
                    correction_reason=reason,
                    reported_by=operator
                )
                db.session.add(misjudgment)
        
        elif action == 'rollback':
            record.review_status = 'rejected'
            record.manual_risk_level = None
            record.manual_risk_reason = None
            version_history.new_risk_level = record.auto_risk_level
            version_history.new_reason = record.auto_risk_reason
            version_history.new_status = 'rejected'
            version_history.change_type = '批量回滚'
            version_history.change_reason = reason or '批量回滚到待复核状态'
        
        record.reviewed_by = operator
        record.reviewed_at = datetime.utcnow()
        version_history.operator = operator
        db.session.add(version_history)
        success_count += 1
    
    db.session.commit()
    
    return jsonify({'success': True, 'processed': success_count, 'total': len(record_ids)})


@app.route('/api/import', methods=['POST'])
def import_records():
    if 'file' not in request.files:
        return jsonify({'error': '未上传文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '文件名不能为空'}), 400
    
    allowed_extensions = {'csv', 'xlsx', 'xls'}
    if '.' not in file.filename or file.filename.rsplit('.', 1)[1].lower() not in allowed_extensions:
        return jsonify({'error': '只支持 CSV 和 Excel 文件'}), 400
    
    filename = secure_filename(file.filename)
    batch_id = str(uuid.uuid4())[:8]
    
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{batch_id}_{filename}')
    file.save(file_path)
    
    try:
        if filename.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
        
        df.columns = [col.lower().strip() for col in df.columns]
        
        required_cols = ['patient_id', 'follow_up_text']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            return jsonify({'error': f'缺少必要列: {", ".join(missing_cols)}'}), 400
        
        total_records = 0
        high_count = 0
        medium_count = 0
        low_count = 0
        
        for _, row in df.iterrows():
            follow_up_text = str(row.get('follow_up_text', '')).strip()
            if not follow_up_text:
                continue
            
            risk_result = risk_engine.stratify(follow_up_text)
            
            visit_date = row.get('visit_date')
            if pd.notna(visit_date):
                try:
                    visit_date = parser.parse(str(visit_date)).date()
                except:
                    visit_date = None
            else:
                visit_date = None
            
            record = PatientRecord(
                patient_id=str(row.get('patient_id', '')),
                patient_name=str(row.get('patient_name', '')) if pd.notna(row.get('patient_name')) else None,
                visit_date=visit_date,
                follow_up_text=follow_up_text,
                auto_risk_level=risk_result['risk_level'],
                auto_risk_reason=risk_result['reason'],
                auto_risk_keywords=','.join(risk_result['keywords']),
                auto_confidence=risk_result['confidence'],
                import_batch_id=batch_id
            )
            db.session.add(record)
            
            total_records += 1
            if risk_result['risk_level'] == 'high':
                high_count += 1
            elif risk_result['risk_level'] == 'medium':
                medium_count += 1
            else:
                low_count += 1
        
        batch = ImportBatch(
            id=batch_id,
            filename=filename,
            total_records=total_records,
            high_risk_count=high_count,
            medium_risk_count=medium_count,
            low_risk_count=low_count,
            imported_by='admin'
        )
        db.session.add(batch)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'batch_id': batch_id,
            'filename': filename,
            'total_records': total_records,
            'high_risk_count': high_count,
            'medium_risk_count': medium_count,
            'low_risk_count': low_count
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'导入失败: {str(e)}'}), 500


@app.route('/api/batches', methods=['GET'])
def get_batches():
    batches = ImportBatch.query.order_by(ImportBatch.created_at.desc()).all()
    return jsonify([b.to_dict() for b in batches])


@app.route('/api/misjudgments', methods=['GET'])
def get_misjudgments():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    misjudgment_type = request.args.get('type')
    
    query = Misjudgment.query
    if misjudgment_type:
        query = query.filter(Misjudgment.misjudgment_type == misjudgment_type)
    
    pagination = query.order_by(Misjudgment.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'misjudgments': [m.to_dict() for m in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages
    })


@app.route('/api/export', methods=['GET'])
def export_records():
    risk_level = request.args.get('risk_level')
    review_status = request.args.get('review_status')
    batch_id = request.args.get('batch_id')
    format_type = request.args.get('format', 'xlsx')
    
    query = PatientRecord.query
    
    if risk_level:
        query = query.filter((PatientRecord.manual_risk_level == risk_level) | 
                            (PatientRecord.manual_risk_level == None) & (PatientRecord.auto_risk_level == risk_level))
    
    if review_status:
        query = query.filter(PatientRecord.review_status == review_status)
    
    if batch_id:
        query = query.filter(PatientRecord.import_batch_id == batch_id)
    
    records = query.all()
    
    data = []
    for r in records:
        data.append({
            '记录ID': r.id,
            '患者ID': r.patient_id,
            '患者姓名': r.patient_name or '',
            '随访日期': r.visit_date.strftime('%Y-%m-%d') if r.visit_date else '',
            '随访文本': r.follow_up_text,
            '自动风险等级': RISK_LEVELS.get(r.auto_risk_level, {}).get('name', ''),
            '自动分层理由': r.auto_risk_reason or '',
            '匹配关键词': r.auto_risk_keywords or '',
            '置信度': r.auto_confidence or '',
            '人工风险等级': RISK_LEVELS.get(r.manual_risk_level, {}).get('name', ''),
            '人工修正理由': r.manual_risk_reason or '',
            '复核状态': REVIEW_STATUSES.get(r.review_status, ''),
            '复核人': r.reviewed_by or '',
            '复核时间': r.reviewed_at.strftime('%Y-%m-%d %H:%M:%S') if r.reviewed_at else '',
            '导入批次': r.import_batch_id or ''
        })
    
    df = pd.DataFrame(data)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    if format_type == 'csv':
        filename = f'risk_report_{timestamp}.csv'
        file_path = os.path.join(app.config['EXPORT_FOLDER'], filename)
        df.to_csv(file_path, index=False, encoding='utf-8-sig')
        mimetype = 'text/csv'
    else:
        filename = f'risk_report_{timestamp}.xlsx'
        file_path = os.path.join(app.config['EXPORT_FOLDER'], filename)
        df.to_excel(file_path, index=False)
        mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    
    return send_file(file_path, as_attachment=True, download_name=filename, mimetype=mimetype)


@app.route('/api/export/misjudgments', methods=['GET'])
def export_misjudgments():
    misjudgments = Misjudgment.query.order_by(Misjudgment.created_at.desc()).all()
    
    data = []
    for m in misjudgments:
        data.append({
            '记录ID': m.record_id,
            '误判类型': m.misjudgment_type,
            '自动风险等级': RISK_LEVELS.get(m.auto_risk_level, {}).get('name', ''),
            '正确风险等级': RISK_LEVELS.get(m.correct_risk_level, {}).get('name', ''),
            '随访文本': m.follow_up_text,
            '自动匹配关键词': m.auto_keywords or '',
            '修正理由': m.correction_reason or '',
            '报告人': m.reported_by or '',
            '报告时间': m.created_at.strftime('%Y-%m-%d %H:%M:%S') if m.created_at else ''
        })
    
    df = pd.DataFrame(data)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'misjudgments_report_{timestamp}.xlsx'
    file_path = os.path.join(app.config['EXPORT_FOLDER'], filename)
    df.to_excel(file_path, index=False)
    
    return send_file(file_path, as_attachment=True, download_name=filename)


@app.route('/api/stats', methods=['GET'])
def get_stats():
    total = PatientRecord.query.count()
    
    high_risk = PatientRecord.query.filter(
        ((PatientRecord.manual_risk_level == 'high') | 
        (PatientRecord.manual_risk_level == None) & (PatientRecord.auto_risk_level == 'high'))
    ).count()
    
    medium_risk = PatientRecord.query.filter(
        ((PatientRecord.manual_risk_level == 'medium') | 
        (PatientRecord.manual_risk_level == None) & (PatientRecord.auto_risk_level == 'medium'))
    ).count()
    
    low_risk = PatientRecord.query.filter(
        ((PatientRecord.manual_risk_level == 'low') | 
        (PatientRecord.manual_risk_level == None) & (PatientRecord.auto_risk_level == 'low'))
    ).count()
    
    pending = PatientRecord.query.filter_by(review_status='pending').count()
    approved = PatientRecord.query.filter_by(review_status='approved').count()
    modified = PatientRecord.query.filter_by(review_status='modified').count()
    rejected = PatientRecord.query.filter_by(review_status='rejected').count()
    
    misjudgments = Misjudgment.query.count()
    false_positive = Misjudgment.query.filter_by(misjudgment_type='误判').count()
    false_negative = Misjudgment.query.filter_by(misjudgment_type='漏判').count()
    
    return jsonify({
        'total_records': total,
        'risk_distribution': {
            'high': high_risk,
            'medium': medium_risk,
            'low': low_risk
        },
        'review_status': {
            'pending': pending,
            'approved': approved,
            'modified': modified,
            'rejected': rejected
        },
        'misjudgments': {
            'total': misjudgments,
            'false_positive': false_positive,
            'false_negative': false_negative
        }
    })


@app.route('/api/rules', methods=['GET'])
def get_rules():
    return jsonify(risk_engine.get_keyword_rules())


@app.route('/api/test-stratify', methods=['POST'])
def test_stratify():
    data = request.get_json()
    text = data.get('text', '')
    result = risk_engine.stratify(text)
    result['risk_name'] = RISK_LEVELS.get(result['risk_level'], {}).get('name', '未知')
    return jsonify(result)


if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5001)
