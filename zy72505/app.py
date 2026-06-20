from flask import Flask, render_template, request, jsonify, redirect, url_for, flash, Response, make_response
import pandas as pd
import os
import io
from werkzeug.utils import secure_filename
from models import init_db, ManualReviewRecord

app = Flask(__name__)
app.secret_key = 'medical-review-secret-key'
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
app.config['PORT'] = 5001

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

ALLOWED_EXTENSIONS = {'xlsx', 'xls', 'csv'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def clean_empty(val):
    if val is None:
        return ''
    if isinstance(val, float) and pd.isna(val):
        return ''
    s = str(val).strip()
    if s.lower() == 'nan':
        return ''
    if s.lower() == 'none':
        return ''
    if s.lower() == 'null':
        return ''
    if s.lower() == 'undefined':
        return ''
    return s


@app.route('/')
def index():
    stats = ManualReviewRecord.get_statistics()
    batches = ManualReviewRecord.get_batches()
    rules = ManualReviewRecord.get_boundary_rules()
    return render_template('index.html', stats=stats, batches=batches, rules=rules, port=app.config['PORT'])


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
    operator = clean_empty(request.form.get('operator', 'system'))
    if operator == '':
        operator = 'system'
    change_reason = clean_empty(request.form.get('change_reason', None))
    if change_reason == '':
        change_reason = None

    for field in ['manual_remark', 'prompt_version', 'manual_conclusion', 'reference_url_status', 'current_status']:
        if field in request.form:
            val = clean_empty(request.form[field])
            if val != '' or field == 'manual_remark':
                updates[field] = val

    if updates:
        ManualReviewRecord.update_record(record_id, updates, operator, change_reason)
        flash('记录更新成功，已触发状态重新评估', 'success')

    return redirect(url_for('record_detail', record_id=record_id))


@app.route('/batch/<batch_id>')
def batch_detail(batch_id):
    batch = ManualReviewRecord.get_batch_detail(batch_id)
    if not batch:
        return "批次不存在", 404
    records = ManualReviewRecord.get_records(batch_id=batch_id, limit=1000)
    rollback_logs = ManualReviewRecord.get_rollback_logs(batch_id)
    return render_template('batch_detail.html', batch=batch, records=records, rollback_logs=rollback_logs)


@app.route('/batch/<batch_id>/rollback', methods=['POST'])
def rollback_batch(batch_id):
    rollback_type = request.form.get('rollback_type')
    reason = clean_empty(request.form.get('reason', '未填写原因'))
    if reason == '':
        reason = '未填写原因'
    operator = clean_empty(request.form.get('operator', '系统管理员'))
    if operator == '':
        operator = '系统管理员'

    result = ManualReviewRecord.rollback_batch(batch_id, rollback_type, reason, operator)
    if result['success']:
        flash(result['message'], 'success')
    else:
        flash('回滚失败：' + result.get('message', '未知错误'), 'error')

    return redirect(url_for('batch_detail', batch_id=batch_id))


@app.route('/batch/<batch_id>/export')
def export_batch(batch_id):
    export_format = request.args.get('format', 'xlsx')
    records = ManualReviewRecord.get_records(batch_id=batch_id, limit=10000)

    if not records:
        flash('批次无数据可导出', 'error')
        return redirect(url_for('batch_detail', batch_id=batch_id))

    data = []
    for r in records:
        data.append({
            '批次ID': r['batch_id'],
            '原始行号': r['original_row_number'],
            '问题ID': r['question_id'],
            '问题': r['question'],
            '原结论': r['original_conclusion'],
            '人工改判结论': r['manual_conclusion'],
            '备注': r['manual_remark'],
            '提示词版本号': r['prompt_version'],
            '引用链接': r['reference_url'],
            '链接状态': r['reference_url_status'],
            '当前处理状态': r['current_status'],
            '创建时间': r['created_at'],
            '更新时间': r['updated_at'],
        })

    df = pd.DataFrame(data)

    if export_format == 'csv':
        output = io.StringIO()
        df.to_csv(output, index=False, encoding='utf-8-sig')
        output.seek(0)
        return Response(
            output.getvalue(),
            mimetype='text/csv; charset=utf-8',
            headers={'Content-disposition': f'attachment; filename={batch_id}_export.csv'}
        )
    else:
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='人工改判记录')
        output.seek(0)
        response = make_response(output.getvalue())
        response.headers['Content-Type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        response.headers['Content-Disposition'] = f'attachment; filename={batch_id}_export.xlsx'
        return response


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
    remark = clean_empty(request.form.get('remark', ''))
    operator = clean_empty(request.form.get('operator', 'product'))
    if operator == '':
        operator = 'product'

    if status:
        ManualReviewRecord.update_product_review(conflict_id, status, remark, operator)
        flash('复核完成', 'success')

    return redirect(url_for('conflicts'))


@app.route('/import', methods=['GET', 'POST'])
def import_batch():
    if request.method == 'POST':
        batch_id = request.form.get('batch_id')
        imported_by = clean_empty(request.form.get('imported_by', 'system'))
        if imported_by == '':
            imported_by = 'system'

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
                empty_prompt_count = 0

                for idx, row in df.iterrows():
                    qid = clean_empty(row.get('问题ID', row.get('question_id', '')))
                    q = clean_empty(row.get('问题', row.get('question', '')))
                    oc = clean_empty(row.get('原结论', row.get('original_conclusion', '')))
                    mc = clean_empty(row.get('人工改判结论', row.get('manual_conclusion', '')))
                    mr = clean_empty(row.get('备注', row.get('manual_remark', '')))
                    pv = clean_empty(row.get('提示词版本号', row.get('prompt_version', '')))
                    ru = clean_empty(row.get('引用链接', row.get('reference_url', '')))
                    rus = clean_empty(row.get('链接状态', row.get('reference_url_status', 'unknown')))

                    if pv == '':
                        empty_prompt_count += 1

                    if rus == '':
                        rus = 'unknown'

                    record = {
                        'original_row_number': idx + 2,
                        'question_id': qid,
                        'question': q,
                        'original_conclusion': oc,
                        'manual_conclusion': mc,
                        'manual_remark': mr,
                        'prompt_version': pv,
                        'reference_url': ru,
                        'reference_url_status': rus,
                    }
                    records.append(record)

                result = ManualReviewRecord.import_batch(batch_id, records, filename, imported_by)

                extra_msg = ''
                if empty_prompt_count > 0:
                    extra_msg = f'；其中 {empty_prompt_count} 条提示词版本号为空，已进入「小乔补看」队列'

                flash(f"导入成功！批次: {batch_id}, 新增: {result.get('inserted', 0)}, 更新: {result.get('updated', 0)}, 未变化: {result.get('unchanged', 0)}{extra_msg}", 'success')
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
    app.run(debug=True, host='0.0.0.0', port=app.config['PORT'])
