from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
import pandas as pd
import os
from werkzeug.utils import secure_filename
from models import init_db, ManualReviewRecord

app = Flask(__name__)
app.secret_key = 'medical-review-secret-key'
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

ALLOWED_EXTENSIONS = {'xlsx', 'xls', 'csv'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/')
def index():
    stats = ManualReviewRecord.get_statistics()
    batches = ManualReviewRecord.get_batches()
    rules = ManualReviewRecord.get_boundary_rules()
    return render_template('index.html', stats=stats, batches=batches, rules=rules)


@app.route('/records')
def records():
    batch_id = request.args.get('batch_id')
    status = request.args.get('status')
    page = int(request.args.get('page', 1))
    per_page = 50
    offset = (page - 1) * per_page

    records = ManualReviewRecord.get_records(batch_id=batch_id, status=status, offset=offset, limit=per_page)
    batches = ManualReviewRecord.get_batches()
    return render_template('records.html', records=records, batches=batches,
                           selected_batch=batch_id, selected_status=status,
                           page=page, per_page=per_page)


@app.route('/record/<int:record_id>')
def record_detail(record_id):
    records = ManualReviewRecord.get_records()
    record = next((r for r in records if r['id'] == record_id), None)
    if not record:
        return "Record not found", 404
    history = ManualReviewRecord.get_record_history(record_id)
    return render_template('record_detail.html', record=record, history=history)


@app.route('/record/<int:record_id>/edit', methods=['POST'])
def edit_record(record_id):
    updates = {}
    operator = request.form.get('operator', 'system')

    for field in ['manual_remark', 'prompt_version', 'manual_conclusion', 'reference_url_status', 'current_status']:
        if field in request.form and request.form[field] != '':
            updates[field] = request.form[field]

    if updates:
        ManualReviewRecord.update_record(record_id, updates, operator)
        flash('记录更新成功', 'success')

    return redirect(url_for('record_detail', record_id=record_id))


@app.route('/conflicts')
def conflicts():
    batch_id = request.args.get('batch_id')
    product_status = request.args.get('product_status')
    samples = ManualReviewRecord.get_conflict_samples(batch_id=batch_id, product_status=product_status)
    batches = ManualReviewRecord.get_batches()
    return render_template('conflicts.html', samples=samples, batches=batches,
                           selected_batch=batch_id, selected_status=product_status)


@app.route('/conflict/<int:conflict_id>/review', methods=['POST'])
def review_conflict(conflict_id):
    status = request.form.get('status')
    remark = request.form.get('remark')
    operator = request.form.get('operator', 'product')

    if status:
        ManualReviewRecord.update_product_review(conflict_id, status, remark, operator)
        flash('复核完成', 'success')

    return redirect(url_for('conflicts'))


@app.route('/import', methods=['GET', 'POST'])
def import_batch():
    if request.method == 'POST':
        batch_id = request.form.get('batch_id')
        imported_by = request.form.get('imported_by', 'system')

        if not batch_id:
            flash('请输入批次ID', 'error')
            return redirect(url_for('import_batch'))

        if 'file' not in request.files:
            flash('请选择文件', 'error')
            return redirect(url_for('import_batch'))

        file = request.files['file']
        if file.filename == '':
            flash('请选择文件', 'error')
            return redirect(url_for('import_batch'))

        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)

            try:
                if filename.endswith('.csv'):
                    df = pd.read_csv(filepath)
                else:
                    df = pd.read_excel(filepath)

                records = []
                for idx, row in df.iterrows():
                    record = {
                        'original_row_number': idx + 2,
                        'question_id': str(row.get('问题ID', row.get('question_id', ''))),
                        'question': str(row.get('问题', row.get('question', ''))),
                        'original_conclusion': str(row.get('原结论', row.get('original_conclusion', ''))),
                        'manual_conclusion': str(row.get('人工改判结论', row.get('manual_conclusion', ''))),
                        'manual_remark': str(row.get('备注', row.get('manual_remark', ''))),
                        'prompt_version': str(row.get('提示词版本号', row.get('prompt_version', ''))),
                        'reference_url': str(row.get('引用链接', row.get('reference_url', ''))),
                        'reference_url_status': str(row.get('链接状态', row.get('reference_url_status', 'unknown'))),
                    }
                    records.append(record)

                result = ManualReviewRecord.import_batch(batch_id, records, filename, imported_by)
                flash(f"导入成功！批次: {batch_id}, 新增: {result.get('inserted', 0)}, 更新: {result.get('updated', 0)}, 未变化: {result.get('unchanged', 0)}", 'success')
                return redirect(url_for('records', batch_id=batch_id))

            except Exception as e:
                flash(f"导入失败: {str(e)}", 'error')
                return redirect(url_for('import_batch'))

    return render_template('import.html')


@app.route('/api/statistics')
def api_statistics():
    return jsonify(ManualReviewRecord.get_statistics())


@app.route('/api/boundary-rules')
def api_boundary_rules():
    return jsonify(ManualReviewRecord.get_boundary_rules())


@app.route('/workflow')
def workflow():
    batches = ManualReviewRecord.get_batches()
    return render_template('workflow.html', batches=batches)


if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5001)
