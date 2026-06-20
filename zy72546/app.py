import os
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from io import BytesIO
import pandas as pd
import json
import hashlib

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///robot_script.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'uploads'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
db = SQLAlchemy(app)


def build_record_key(batch_id, sample_id, original_row_number):
    return f"{batch_id}:::{sample_id}:::{original_row_number}"


class BoundaryRule:
    MODEL_VERSION_CHANGED_SAMPLE_SAME = 'model_version_changed_sample_same'
    NORMAL = 'normal'
    NEEDS_REVIEW = 'needs_review'

    @staticmethod
    def check_boundary(sample_id, old_model_version, new_model_version):
        if old_model_version != new_model_version:
            return BoundaryRule.MODEL_VERSION_CHANGED_SAMPLE_SAME
        return BoundaryRule.NORMAL


class ManualJudgment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    import_id = db.Column(db.Integer)
    batch_id = db.Column(db.String(100), nullable=False)
    record_key = db.Column(db.String(300), nullable=False, index=True)
    original_row_number = db.Column(db.Integer, nullable=False)
    sample_id = db.Column(db.String(100), nullable=False)
    model_version = db.Column(db.String(100))
    prompt_version = db.Column(db.String(100))
    original_answer = db.Column(db.Text)
    manual_answer = db.Column(db.Text)
    manual_changes = db.Column(db.Text)
    remarks = db.Column(db.Text)
    processing_status = db.Column(db.String(50), default='imported')
    status_note = db.Column(db.Text)
    reviewer = db.Column(db.String(100))
    review_time = db.Column(db.DateTime)
    boundary_status = db.Column(db.String(50), default='normal')
    boundary_note = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    content_hash = db.Column(db.String(64))
    version_number = db.Column(db.Integer, default=1)
    workflow_step = db.Column(db.String(50), default='step1_imported')
    is_latest = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'id': self.id,
            'import_id': self.import_id,
            'batch_id': self.batch_id,
            'record_key': self.record_key,
            'original_row_number': self.original_row_number,
            'sample_id': self.sample_id,
            'model_version': self.model_version,
            'prompt_version': self.prompt_version,
            'original_answer': self.original_answer,
            'manual_answer': self.manual_answer,
            'manual_changes': self.manual_changes,
            'remarks': self.remarks,
            'processing_status': self.processing_status,
            'status_note': self.status_note,
            'reviewer': self.reviewer,
            'review_time': self.review_time.isoformat() if self.review_time else None,
            'boundary_status': self.boundary_status,
            'boundary_note': self.boundary_note,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'version_number': self.version_number,
            'workflow_step': self.workflow_step,
            'is_latest': self.is_latest
        }


class VersionHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    record_key = db.Column(db.String(300), nullable=False, index=True)
    from_record_id = db.Column(db.Integer)
    to_record_id = db.Column(db.Integer)
    version_number = db.Column(db.Integer, nullable=False)
    field_name = db.Column(db.String(100))
    old_value = db.Column(db.Text)
    new_value = db.Column(db.Text)
    changed_by = db.Column(db.String(100))
    change_reason = db.Column(db.Text)
    change_type = db.Column(db.String(50), default='update')
    changed_at = db.Column(db.DateTime, default=datetime.utcnow)
    full_snapshot_before = db.Column(db.Text)
    full_snapshot_after = db.Column(db.Text)

    def to_dict(self):
        return {
            'id': self.id,
            'record_key': self.record_key,
            'from_record_id': self.from_record_id,
            'to_record_id': self.to_record_id,
            'version_number': self.version_number,
            'field_name': self.field_name,
            'old_value': self.old_value,
            'new_value': self.new_value,
            'changed_by': self.changed_by,
            'change_reason': self.change_reason,
            'change_type': self.change_type,
            'changed_at': self.changed_at.isoformat(),
            'full_snapshot_before': json.loads(self.full_snapshot_before) if self.full_snapshot_before else None,
            'full_snapshot_after': json.loads(self.full_snapshot_after) if self.full_snapshot_after else None
        }


class ImportBatch(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    import_id = db.Column(db.String(100), unique=True, nullable=False)
    batch_id = db.Column(db.String(100), nullable=False)
    file_name = db.Column(db.String(255))
    imported_by = db.Column(db.String(100))
    imported_at = db.Column(db.DateTime, default=datetime.utcnow)
    record_count = db.Column(db.Integer, default=0)
    new_count = db.Column(db.Integer, default=0)
    updated_count = db.Column(db.Integer, default=0)
    duplicate_count = db.Column(db.Integer, default=0)
    boundary_alert_count = db.Column(db.Integer, default=0)
    import_note = db.Column(db.Text)

    def to_dict(self):
        return {
            'id': self.id,
            'import_id': self.import_id,
            'batch_id': self.batch_id,
            'file_name': self.file_name,
            'imported_by': self.imported_by,
            'imported_at': self.imported_at.isoformat(),
            'record_count': self.record_count,
            'new_count': self.new_count,
            'updated_count': self.updated_count,
            'duplicate_count': self.duplicate_count,
            'boundary_alert_count': self.boundary_alert_count,
            'import_note': self.import_note
        }


CONTENT_FIELDS = [
    'batch_id', 'original_row_number', 'sample_id', 'model_version',
    'prompt_version', 'original_answer', 'manual_answer',
    'manual_changes', 'remarks'
]


def calculate_content_hash(data):
    if isinstance(data, dict):
        payload = {k: data.get(k, '') for k in CONTENT_FIELDS}
    else:
        payload = {k: str(getattr(data, k, '') or '') for k in CONTENT_FIELDS}
    content = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(content.encode('utf-8')).hexdigest()


def get_latest_record(record_key):
    return ManualJudgment.query.filter_by(
        record_key=record_key,
        is_latest=True
    ).first()


def get_record_versions(record_key):
    return ManualJudgment.query.filter_by(
        record_key=record_key
    ).order_by(ManualJudgment.version_number.asc()).all()


def get_version_history(record_key):
    return VersionHistory.query.filter_by(
        record_key=record_key
    ).order_by(VersionHistory.version_number.asc()).all()


def get_next_version_number(record_key):
    records = get_record_versions(record_key)
    if not records:
        return 1
    return max(r.version_number for r in records) + 1


def _safe_getattr(obj, field, default=''):
    virtual_fields = {'initial', 'create'}
    if not obj:
        return default
    if field in virtual_fields:
        return default
    return getattr(obj, field, default)


def create_version_record(record_key, old_record, new_record, field_name, 
                         changed_by='system', change_reason='', change_type='update'):
    version = VersionHistory()
    version.record_key = record_key
    version.from_record_id = old_record.id if old_record else None
    version.to_record_id = new_record.id if new_record else None
    version.field_name = field_name
    version.old_value = _safe_getattr(old_record, field_name, '')
    version.new_value = '(记录创建)' if field_name in ('initial','create') else _safe_getattr(new_record, field_name, '')
    version.changed_by = changed_by
    version.change_reason = change_reason
    version.change_type = change_type
    version.full_snapshot_before = json.dumps(old_record.to_dict(), ensure_ascii=False) if old_record else None
    version.full_snapshot_after = json.dumps(new_record.to_dict(), ensure_ascii=False) if new_record else None
    
    history_count = VersionHistory.query.filter_by(record_key=record_key).count()
    version.version_number = history_count + 1
    
    db.session.add(version)
    return version


def process_boundary_rule(existing, new_data, record_key):
    if existing and existing.model_version != new_data.get('model_version'):
        new_data['boundary_status'] = BoundaryRule.NEEDS_REVIEW
        new_data['boundary_note'] = (
            f'【边界规则触发】模型版本从 {existing.model_version} 变为 {new_data.get("model_version")}，'
            f'但样本编号 {new_data.get("sample_id")} 未变。系统不自动归为正常，留待运营复核人复核。'
        )
        new_data['processing_status'] = 'pending_review'
        new_data['status_note'] = '模型版本变更，待运营复核'
    return new_data


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/import', methods=['POST'])
def import_file():
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400

    batch_id = request.form.get('batch_id', datetime.now().strftime('%Y%m%d%H%M%S'))
    imported_by = request.form.get('imported_by', 'system')
    import_id = f"IMP{datetime.now().strftime('%Y%m%d%H%M%S%f')}"

    file_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{import_id}_{file.filename}")
    file.save(file_path)

    df = pd.read_excel(file_path) if file.filename.endswith('.xlsx') else pd.read_csv(file_path)

    def _clean(v):
        s = str(v) if v is not None else ''
        if s in ('nan', 'None', 'NaN', 'nat', '<NA>'):
            return ''
        return s

    new_count = 0
    updated_count = 0
    duplicate_count = 0
    boundary_alert_count = 0

    for idx, row in df.iterrows():
        original_row_number = idx + 2
        sample_id = _clean(row.get('样本编号', row.get('sample_id', '')))
        
        row_data = {
            'batch_id': batch_id,
            'original_row_number': original_row_number,
            'sample_id': sample_id,
            'model_version': _clean(row.get('模型版本', row.get('model_version', ''))),
            'prompt_version': _clean(row.get('提示词版本', row.get('prompt_version', ''))),
            'original_answer': _clean(row.get('原始回答', row.get('original_answer', ''))),
            'manual_answer': _clean(row.get('人工改判回答', row.get('manual_answer', ''))),
            'manual_changes': _clean(row.get('人工改动说明', row.get('manual_changes', ''))),
            'remarks': _clean(row.get('备注', row.get('remarks', ''))),
        }
        
        record_key = build_record_key(batch_id, sample_id, original_row_number)
        row_data['record_key'] = record_key
        row_data['content_hash'] = calculate_content_hash(row_data)

        existing = get_latest_record(record_key)

        if existing:
            preserve_fields_when_empty = ['prompt_version', 'remarks']
            for f in preserve_fields_when_empty:
                if not row_data.get(f) and getattr(existing, f):
                    row_data[f] = getattr(existing, f)
            row_data['content_hash'] = calculate_content_hash(row_data)

            if existing.content_hash == row_data['content_hash']:
                duplicate_count += 1
                continue
            else:
                row_data = process_boundary_rule(existing, row_data, record_key)
                
                if row_data.get('boundary_status') == BoundaryRule.NEEDS_REVIEW:
                    boundary_alert_count += 1
                
                existing.is_latest = False
                
                new_version_num = get_next_version_number(record_key)
                new_record = ManualJudgment(**row_data)
                new_record.import_id = ImportBatch.query.count() + 1
                new_record.version_number = new_version_num
                new_record.processing_status = row_data.get('processing_status', existing.processing_status)
                new_record.workflow_step = existing.workflow_step
                new_record.reviewer = existing.reviewer
                new_record.review_time = existing.review_time
                new_record.status_note = row_data.get('status_note', existing.status_note)
                
                if row_data.get('boundary_status') == BoundaryRule.NEEDS_REVIEW:
                    if new_record.workflow_step == 'step3_reviewed':
                        new_record.workflow_step = 'step2_prompt_updated'
                
                db.session.add(new_record)
                db.session.flush()
                
                for field in ['model_version', 'prompt_version', 'original_answer', 
                            'manual_answer', 'manual_changes', 'remarks']:
                    if getattr(existing, field) != row_data.get(field):
                        create_version_record(
                            record_key, existing, new_record, field,
                            changed_by=imported_by, 
                            change_reason='重新导入更新',
                            change_type='import_update'
                        )
                
                updated_count += 1
        else:
            row_data['boundary_status'] = BoundaryRule.NORMAL
            row_data['processing_status'] = 'imported'
            row_data['status_note'] = '首次导入'
            new_record = ManualJudgment(**row_data)
            new_record.import_id = ImportBatch.query.count() + 1
            new_record.version_number = 1
            
            db.session.add(new_record)
            db.session.flush()
            
            create_version_record(
                record_key, None, new_record, 'initial',
                changed_by=imported_by,
                change_reason='首次导入创建记录',
                change_type='create'
            )
            
            new_count += 1

    batch = ImportBatch(
        import_id=import_id,
        batch_id=batch_id,
        file_name=file.filename,
        imported_by=imported_by,
        record_count=len(df),
        new_count=new_count,
        updated_count=updated_count,
        duplicate_count=duplicate_count,
        boundary_alert_count=boundary_alert_count,
        import_note=f'第 {ImportBatch.query.filter_by(batch_id=batch_id).count() + 1} 次导入批次 {batch_id}'
    )
    db.session.add(batch)
    db.session.commit()

    return jsonify({
        'import_id': import_id,
        'batch_id': batch_id,
        'total': len(df),
        'new': new_count,
        'updated': updated_count,
        'duplicate': duplicate_count,
        'boundary_alert': boundary_alert_count,
        'note': f'导入完成。同批次已有 {ImportBatch.query.filter_by(batch_id=batch_id).count()} 次导入记录'
    })


@app.route('/api/records')
def get_records():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status = request.args.get('status', '')
    boundary = request.args.get('boundary', '')
    workflow = request.args.get('workflow', '')
    batch_id = request.args.get('batch_id', '')

    query = ManualJudgment.query.filter_by(is_latest=True)
    if status:
        query = query.filter_by(processing_status=status)
    if boundary:
        query = query.filter_by(boundary_status=boundary)
    if workflow:
        query = query.filter_by(workflow_step=workflow)
    if batch_id:
        query = query.filter_by(batch_id=batch_id)

    pagination = query.order_by(ManualJudgment.updated_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'records': [r.to_dict() for r in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page
    })


@app.route('/api/record/<int:record_id>')
def get_record(record_id):
    record = ManualJudgment.query.get_or_404(record_id)
    versions = get_record_versions(record.record_key)
    history = get_version_history(record.record_key)
    return jsonify({
        'record': record.to_dict(),
        'all_versions': [v.to_dict() for v in versions],
        'version_history': [v.to_dict() for v in history],
        'latest_version_number': max(v.version_number for v in versions) if versions else 0
    })


@app.route('/api/record/<int:record_id>/update_prompt_version', methods=['POST'])
def update_prompt_version(record_id):
    record = ManualJudgment.query.get_or_404(record_id)
    data = request.json
    old_prompt = record.prompt_version
    new_prompt = data.get('prompt_version', '')
    changed_by = data.get('changed_by', '小孟')

    if old_prompt == new_prompt:
        return jsonify({'success': True, 'message': '提示词版本未变化', 'unchanged': True})
    
    if not record.is_latest:
        return jsonify({'error': '只能修改最新版本的记录'}), 400

    record.is_latest = False
    
    new_record_data = record.to_dict()
    for field in ['id', 'created_at', 'updated_at', 'review_time']:
        new_record_data.pop(field, None)
    new_record_data['prompt_version'] = new_prompt
    new_record_data['is_latest'] = True
    new_record_data['workflow_step'] = 'step2_prompt_updated'
    new_record_data['version_number'] = get_next_version_number(record.record_key)
    new_record_data['content_hash'] = calculate_content_hash(new_record_data)
    
    prev_status = record.processing_status
    if record.boundary_status == BoundaryRule.NEEDS_REVIEW:
        new_record_data['processing_status'] = 'pending_review'
        new_record_data['status_note'] = record.status_note or '边界待复核'
    else:
        new_record_data['processing_status'] = 'prompt_updated'
        new_record_data['status_note'] = '模型评测同事已补全提示词版本号'
    
    new_record = ManualJudgment(**new_record_data)
    db.session.add(new_record)
    db.session.flush()

    create_version_record(
        record.record_key, record, new_record, 'prompt_version',
        changed_by=changed_by,
        change_reason='模型评测同事补看/修改提示词版本号',
        change_type='prompt_update'
    )
    
    db.session.commit()
    
    return jsonify({
        'success': True, 
        'new_record_id': new_record.id,
        'version_number': new_record.version_number,
        'workflow_step': new_record.workflow_step,
        'processing_status': new_record.processing_status,
        'status_note': new_record.status_note,
        'old_value': old_prompt,
        'new_value': new_prompt,
        'result_note': f'提示词版本号已更新，版本号从 {old_prompt or "(空)"} 变为 {new_prompt}。工作流推进到步骤2（提示词已更新）。'
    })


@app.route('/api/record/<int:record_id>/review', methods=['POST'])
def review_record(record_id):
    record = ManualJudgment.query.get_or_404(record_id)
    data = request.json
    action = data.get('action', 'approve')
    reviewer = data.get('reviewer', '运营复核人')
    note = data.get('note', '')

    if not record.is_latest:
        return jsonify({'error': '只能复核最新版本的记录'}), 400

    if action == 'approve':
        record.boundary_status = BoundaryRule.NORMAL
        record.processing_status = 'reviewed'
        record.status_note = f'复核通过：{note}' if note else '复核通过'
        record.boundary_note = note
        result_note = '复核通过：边界异常已确认正常，记录进入已复核状态。'
    elif action == 'reject':
        record.processing_status = 'rejected'
        record.status_note = f'复核打回：{note}'
        record.boundary_note = f'复核不通过：{note}'
        result_note = '复核打回：记录被退回，需要模型评测同事重新处理。'
    elif action == 'rollback':
        record.boundary_status = BoundaryRule.NORMAL
        record.processing_status = 'rollback'
        record.status_note = f'已回滚：{note}'
        record.boundary_note = f'已回滚至上一版本：{note}'
        result_note = '已回滚：边界变更已撤销，恢复为正常状态。'

    record.reviewer = reviewer
    record.review_time = datetime.utcnow()
    record.workflow_step = 'step3_reviewed'
    db.session.commit()
    
    return jsonify({
        'success': True,
        'action': action,
        'workflow_step': record.workflow_step,
        'processing_status': record.processing_status,
        'boundary_status': record.boundary_status,
        'status_note': record.status_note,
        'result_note': f'{result_note} 工作流推进到步骤3（已复核）。复核人：{reviewer}'
    })


@app.route('/api/record/<int:record_id>/update_remark', methods=['POST'])
def update_remark(record_id):
    record = ManualJudgment.query.get_or_404(record_id)
    data = request.json
    old_remark = record.remarks
    new_remark = data.get('remarks', '')
    changed_by = data.get('changed_by', '小孟')

    if old_remark == new_remark:
        return jsonify({'success': True, 'message': '备注未变化', 'unchanged': True})
    
    if not record.is_latest:
        return jsonify({'error': '只能修改最新版本的记录'}), 400

    record.is_latest = False
    
    new_record_data = record.to_dict()
    for field in ['id', 'created_at', 'updated_at', 'review_time']:
        new_record_data.pop(field, None)
    new_record_data['remarks'] = new_remark
    new_record_data['is_latest'] = True
    new_record_data['version_number'] = get_next_version_number(record.record_key)
    new_record_data['content_hash'] = calculate_content_hash(new_record_data)
    
    if record.boundary_status == BoundaryRule.NEEDS_REVIEW:
        new_record_data['processing_status'] = 'pending_review'
        new_record_data['status_note'] = record.status_note or '边界待复核'
    else:
        new_record_data['status_note'] = record.status_note or ''
    
    new_record = ManualJudgment(**new_record_data)
    db.session.add(new_record)
    db.session.flush()

    create_version_record(
        record.record_key, record, new_record, 'remarks',
        changed_by=changed_by,
        change_reason='修改备注信息',
        change_type='remark_update'
    )
    
    db.session.commit()
    
    return jsonify({
        'success': True, 
        'new_record_id': new_record.id,
        'version_number': new_record.version_number,
        'old_value': old_remark,
        'new_value': new_remark,
        'processing_status': new_record.processing_status,
        'workflow_step': new_record.workflow_step,
        'result_note': (
            f'备注已修改，版本号升至 v{new_record.version_number}。\n'
            f'修改前：{old_remark or "(空)"}\n'
            f'修改后：{new_remark or "(空)"}\n'
            f'当前工作流：{new_record.workflow_step}\n'
            f'当前处理状态：{new_record.processing_status}'
        )
    })


@app.route('/api/batches')
def get_batches():
    batches = ImportBatch.query.order_by(ImportBatch.imported_at.desc()).all()
    return jsonify([b.to_dict() for b in batches])


@app.route('/api/statistics')
def get_statistics():
    total = ManualJudgment.query.filter_by(is_latest=True).count()
    needs_review = ManualJudgment.query.filter_by(boundary_status=BoundaryRule.NEEDS_REVIEW, is_latest=True).count()
    step1 = ManualJudgment.query.filter_by(workflow_step='step1_imported', is_latest=True).count()
    step2 = ManualJudgment.query.filter_by(workflow_step='step2_prompt_updated', is_latest=True).count()
    step3 = ManualJudgment.query.filter_by(workflow_step='step3_reviewed', is_latest=True).count()
    
    status_breakdown = {
        'imported': ManualJudgment.query.filter_by(processing_status='imported', is_latest=True).count(),
        'prompt_updated': ManualJudgment.query.filter_by(processing_status='prompt_updated', is_latest=True).count(),
        'pending_review': ManualJudgment.query.filter_by(processing_status='pending_review', is_latest=True).count(),
        'reviewed': ManualJudgment.query.filter_by(processing_status='reviewed', is_latest=True).count(),
        'rejected': ManualJudgment.query.filter_by(processing_status='rejected', is_latest=True).count(),
    }
    
    return jsonify({
        'total': total,
        'needs_review': needs_review,
        'workflow_steps': {
            'step1_imported': step1,
            'step2_prompt_updated': step2,
            'step3_reviewed': step3
        },
        'status_breakdown': status_breakdown,
        'import_count': ImportBatch.query.count()
    })


@app.route('/api/export/<batch_id>')
def export_batch(batch_id):
    records = ManualJudgment.query.filter_by(batch_id=batch_id, is_latest=True).all()
    data = []
    for r in records:
        data.append({
            '原始行号': r.original_row_number,
            '样本编号': r.sample_id,
            '模型版本': r.model_version,
            '提示词版本': r.prompt_version,
            '原始回答': r.original_answer,
            '人工改判回答': r.manual_answer,
            '人工改动说明': r.manual_changes,
            '备注': r.remarks,
            '处理状态': r.processing_status,
            '状态说明': r.status_note,
            '边界状态': r.boundary_status,
            '边界说明': r.boundary_note,
            '工作流步骤': r.workflow_step,
            '版本号': r.version_number,
            '复核人': r.reviewer,
            '复核时间': r.review_time
        })
    df = pd.DataFrame(data)
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='人工改判表')
    output.seek(0)
    return send_file(output, download_name=f'batch_{batch_id}_export.xlsx', as_attachment=True)


def migrate_database():
    inspector = db.inspect(db.engine)
    existing_tables = inspector.get_table_names()

    required_tables = ['manual_judgment', 'version_history', 'import_batch']
    required_columns = {
        'manual_judgment': [
            'record_key', 'version_number', 'status_note',
            'original_row_number', 'sample_id', 'model_version',
            'prompt_version', 'manual_changes', 'remarks',
            'processing_status', 'boundary_status', 'boundary_note',
            'workflow_step', 'is_latest', 'content_hash'
        ],
        'import_batch': [
            'import_id', 'boundary_alert_count', 'import_note'
        ],
        'version_history': [
            'record_key', 'change_type', 'full_snapshot_before',
            'full_snapshot_after', 'from_record_id', 'to_record_id'
        ]
    }

    needs_migration = False

    if set(required_tables).issubset(set(existing_tables)):
        for table, cols in required_columns.items():
            existing_cols = [c['name'] for c in inspector.get_columns(table)]
            missing = set(cols) - set(existing_cols)
            if missing:
                needs_migration = True
                print(f"[DB迁移] 表 {table} 缺少列: {missing}")
                break
    else:
        missing_tables = set(required_tables) - set(existing_tables)
        if missing_tables:
            needs_migration = True
            print(f"[DB迁移] 缺少表: {missing_tables}")

    if needs_migration:
        import shutil
        db_path = app.config['SQLALCHEMY_DATABASE_URI'].replace('sqlite:///', '')
        if db_path and os.path.exists(db_path):
            backup_path = f"{db_path}.bak_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            shutil.copy2(db_path, backup_path)
            print(f"[DB迁移] 旧数据库已备份: {backup_path}")
            db.drop_all()
            print(f"[DB迁移] 旧结构已清除")

        db.create_all()
        print(f"[DB迁移] 新结构已创建")
    else:
        db.create_all()
        print(f"[DB] 结构验证通过，无需迁移")


with app.app_context():
    migrate_database()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
