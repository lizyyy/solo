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
    batch_id = db.Column(db.String(100), nullable=False)
    original_row_number = db.Column(db.Integer, nullable=False)
    sample_id = db.Column(db.String(100), nullable=False)
    model_version = db.Column(db.String(100))
    prompt_version = db.Column(db.String(100))
    original_answer = db.Column(db.Text)
    manual_answer = db.Column(db.Text)
    manual_changes = db.Column(db.Text)
    remarks = db.Column(db.Text)
    processing_status = db.Column(db.String(50), default='imported')
    reviewer = db.Column(db.String(100))
    review_time = db.Column(db.DateTime)
    boundary_status = db.Column(db.String(50), default='normal')
    boundary_note = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    content_hash = db.Column(db.String(64))
    workflow_step = db.Column(db.String(50), default='step1_imported')
    is_latest = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'id': self.id,
            'batch_id': self.batch_id,
            'original_row_number': self.original_row_number,
            'sample_id': self.sample_id,
            'model_version': self.model_version,
            'prompt_version': self.prompt_version,
            'original_answer': self.original_answer,
            'manual_answer': self.manual_answer,
            'manual_changes': self.manual_changes,
            'remarks': self.remarks,
            'processing_status': self.processing_status,
            'reviewer': self.reviewer,
            'review_time': self.review_time.isoformat() if self.review_time else None,
            'boundary_status': self.boundary_status,
            'boundary_note': self.boundary_note,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'workflow_step': self.workflow_step,
            'is_latest': self.is_latest
        }


class VersionHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    manual_judgment_id = db.Column(db.Integer, db.ForeignKey('manual_judgment.id'))
    version_number = db.Column(db.Integer, nullable=False)
    field_name = db.Column(db.String(100))
    old_value = db.Column(db.Text)
    new_value = db.Column(db.Text)
    changed_by = db.Column(db.String(100))
    change_reason = db.Column(db.Text)
    changed_at = db.Column(db.DateTime, default=datetime.utcnow)
    full_snapshot = db.Column(db.Text)

    manual_judgment = db.relationship('ManualJudgment', backref=db.backref('versions', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'manual_judgment_id': self.manual_judgment_id,
            'version_number': self.version_number,
            'field_name': self.field_name,
            'old_value': self.old_value,
            'new_value': self.new_value,
            'changed_by': self.changed_by,
            'change_reason': self.change_reason,
            'changed_at': self.changed_at.isoformat(),
            'full_snapshot': json.loads(self.full_snapshot) if self.full_snapshot else None
        }


class ImportBatch(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.String(100), unique=True, nullable=False)
    file_name = db.Column(db.String(255))
    imported_by = db.Column(db.String(100))
    imported_at = db.Column(db.DateTime, default=datetime.utcnow)
    record_count = db.Column(db.Integer, default=0)
    new_count = db.Column(db.Integer, default=0)
    updated_count = db.Column(db.Integer, default=0)
    duplicate_count = db.Column(db.Integer, default=0)

    def to_dict(self):
        return {
            'id': self.id,
            'batch_id': self.batch_id,
            'file_name': self.file_name,
            'imported_by': self.imported_by,
            'imported_at': self.imported_at.isoformat(),
            'record_count': self.record_count,
            'new_count': self.new_count,
            'updated_count': self.updated_count,
            'duplicate_count': self.duplicate_count
        }


def calculate_content_hash(row_data):
    content = json.dumps(row_data, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(content.encode('utf-8')).hexdigest()


def get_existing_record(sample_id, batch_id, original_row_number):
    return ManualJudgment.query.filter_by(
        sample_id=sample_id,
        batch_id=batch_id,
        original_row_number=original_row_number,
        is_latest=True
    ).first()


def create_version_record(old_record, new_record, field_name, changed_by='system', change_reason=''):
    version = VersionHistory()
    version.manual_judgment_id = old_record.id
    version.field_name = field_name
    version.old_value = getattr(old_record, field_name)
    version.new_value = getattr(new_record, field_name)
    version.changed_by = changed_by
    version.change_reason = change_reason
    version.full_snapshot = json.dumps(old_record.to_dict(), ensure_ascii=False)
    max_version = VersionHistory.query.filter_by(manual_judgment_id=old_record.id).count()
    version.version_number = max_version + 1
    db.session.add(version)


def process_boundary_rule(existing, new_data):
    if existing and existing.model_version != new_data.get('model_version'):
        new_data['boundary_status'] = BoundaryRule.NEEDS_REVIEW
        new_data['boundary_note'] = f'模型版本从 {existing.model_version} 变为 {new_data.get("model_version")}，但样本编号 {new_data.get("sample_id")} 未变，需要运营复核人复核'
        new_data['processing_status'] = 'pending_review'
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

    file_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{batch_id}_{file.filename}")
    file.save(file_path)

    df = pd.read_excel(file_path) if file.filename.endswith('.xlsx') else pd.read_csv(file_path)

    new_count = 0
    updated_count = 0
    duplicate_count = 0

    for idx, row in df.iterrows():
        row_data = {
            'batch_id': batch_id,
            'original_row_number': idx + 2,
            'sample_id': str(row.get('样本编号', row.get('sample_id', ''))),
            'model_version': str(row.get('模型版本', row.get('model_version', ''))),
            'prompt_version': str(row.get('提示词版本', row.get('prompt_version', ''))),
            'original_answer': str(row.get('原始回答', row.get('original_answer', ''))),
            'manual_answer': str(row.get('人工改判回答', row.get('manual_answer', ''))),
            'manual_changes': str(row.get('人工改动说明', row.get('manual_changes', ''))),
            'remarks': str(row.get('备注', row.get('remarks', ''))),
        }
        row_data['content_hash'] = calculate_content_hash(row_data)

        existing = get_existing_record(
            row_data['sample_id'],
            batch_id,
            row_data['original_row_number']
        )

        if existing:
            if existing.content_hash == row_data['content_hash']:
                duplicate_count += 1
                continue
            else:
                row_data = process_boundary_rule(existing, row_data)
                existing.is_latest = False
                for field in ['model_version', 'prompt_version', 'original_answer', 
                            'manual_answer', 'manual_changes', 'remarks', 'content_hash']:
                    if getattr(existing, field) != row_data.get(field):
                        create_version_record(existing, type('obj', (object,), row_data)(), field, 
                                           changed_by=imported_by, change_reason='重新导入更新')
                new_record = ManualJudgment(**row_data)
                new_record.processing_status = existing.processing_status
                new_record.workflow_step = existing.workflow_step
                new_record.reviewer = existing.reviewer
                new_record.review_time = existing.review_time
                db.session.add(new_record)
                updated_count += 1
        else:
            row_data['boundary_status'] = BoundaryRule.NORMAL
            new_record = ManualJudgment(**row_data)
            db.session.add(new_record)
            new_count += 1

    batch = ImportBatch(
        batch_id=batch_id,
        file_name=file.filename,
        imported_by=imported_by,
        record_count=len(df),
        new_count=new_count,
        updated_count=updated_count,
        duplicate_count=duplicate_count
    )
    db.session.add(batch)
    db.session.commit()

    return jsonify({
        'batch_id': batch_id,
        'total': len(df),
        'new': new_count,
        'updated': updated_count,
        'duplicate': duplicate_count
    })


@app.route('/api/records')
def get_records():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status = request.args.get('status', '')
    boundary = request.args.get('boundary', '')
    workflow = request.args.get('workflow', '')

    query = ManualJudgment.query.filter_by(is_latest=True)
    if status:
        query = query.filter_by(processing_status=status)
    if boundary:
        query = query.filter_by(boundary_status=boundary)
    if workflow:
        query = query.filter_by(workflow_step=workflow)

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
    versions = VersionHistory.query.filter_by(manual_judgment_id=record_id).order_by(VersionHistory.version_number.desc()).all()
    return jsonify({
        'record': record.to_dict(),
        'versions': [v.to_dict() for v in versions]
    })


@app.route('/api/record/<int:record_id>/update_prompt_version', methods=['POST'])
def update_prompt_version(record_id):
    record = ManualJudgment.query.get_or_404(record_id)
    data = request.json
    old_prompt = record.prompt_version
    new_prompt = data.get('prompt_version', '')
    changed_by = data.get('changed_by', '小孟')

    if old_prompt != new_prompt:
        record.is_latest = False
        new_record_data = record.to_dict()
        del new_record_data['id']
        new_record_data['prompt_version'] = new_prompt
        new_record_data['is_latest'] = True
        new_record_data['workflow_step'] = 'step2_prompt_updated'
        new_record = ManualJudgment(**new_record_data)
        new_record.content_hash = calculate_content_hash(new_record_data)
        db.session.add(new_record)

        version = VersionHistory()
        version.manual_judgment_id = record.id
        version.version_number = VersionHistory.query.filter_by(manual_judgment_id=record.id).count() + 1
        version.field_name = 'prompt_version'
        version.old_value = old_prompt
        version.new_value = new_prompt
        version.changed_by = changed_by
        version.change_reason = '模型评测同事补看提示词版本号'
        version.full_snapshot = json.dumps(record.to_dict(), ensure_ascii=False)
        db.session.add(version)
        db.session.commit()
        return jsonify({'success': True, 'new_record_id': new_record.id})
    return jsonify({'success': True, 'message': '提示词版本未变化'})


@app.route('/api/record/<int:record_id>/review', methods=['POST'])
def review_record(record_id):
    record = ManualJudgment.query.get_or_404(record_id)
    data = request.json
    action = data.get('action', 'approve')
    reviewer = data.get('reviewer', '运营复核人')

    if action == 'approve':
        record.boundary_status = BoundaryRule.NORMAL
        record.processing_status = 'reviewed'
        record.boundary_note = data.get('note', '')
    elif action == 'reject':
        record.processing_status = 'rejected'
        record.boundary_note = data.get('note', '复核不通过：' + data.get('note', ''))
    elif action == 'rollback':
        record.boundary_status = BoundaryRule.NORMAL
        record.processing_status = 'rollback'
        record.boundary_note = '已回滚：' + data.get('note', '')

    record.reviewer = reviewer
    record.review_time = datetime.utcnow()
    record.workflow_step = 'step3_reviewed'
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/record/<int:record_id>/update_remark', methods=['POST'])
def update_remark(record_id):
    record = ManualJudgment.query.get_or_404(record_id)
    data = request.json
    old_remark = record.remarks
    new_remark = data.get('remarks', '')
    changed_by = data.get('changed_by', '小孟')

    if old_remark != new_remark:
        record.is_latest = False
        new_record_data = record.to_dict()
        del new_record_data['id']
        new_record_data['remarks'] = new_remark
        new_record_data['is_latest'] = True
        new_record = ManualJudgment(**new_record_data)
        new_record.content_hash = calculate_content_hash(new_record_data)
        db.session.add(new_record)

        version = VersionHistory()
        version.manual_judgment_id = record.id
        version.version_number = VersionHistory.query.filter_by(manual_judgment_id=record.id).count() + 1
        version.field_name = 'remarks'
        version.old_value = old_remark
        version.new_value = new_remark
        version.changed_by = changed_by
        version.change_reason = '修改备注'
        version.full_snapshot = json.dumps(record.to_dict(), ensure_ascii=False)
        db.session.add(version)
        db.session.commit()
        return jsonify({'success': True, 'new_record_id': new_record.id})
    return jsonify({'success': True, 'message': '备注未变化'})


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
    return jsonify({
        'total': total,
        'needs_review': needs_review,
        'workflow_steps': {
            'step1_imported': step1,
            'step2_prompt_updated': step2,
            'step3_reviewed': step3
        }
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
            '边界状态': r.boundary_status,
            '边界说明': r.boundary_note,
            '工作流步骤': r.workflow_step,
            '复核人': r.reviewer,
            '复核时间': r.review_time
        })
    df = pd.DataFrame(data)
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='人工改判表')
    output.seek(0)
    return send_file(output, download_name=f'batch_{batch_id}_export.xlsx', as_attachment=True)


with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
