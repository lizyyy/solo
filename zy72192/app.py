from flask import Flask, render_template, request, jsonify, Response, abort
import csv
from io import StringIO
from datetime import datetime

from services import (
    get_sample_detail, get_batch_list, get_evaluation_list,
    get_conflicts_list, submit_manual_review, add_supplementary_note,
    run_batch_evaluation, compare_batch_runs, get_batch_runs,
    export_batch_results, get_model_versions, get_latest_batch_info
)

app = Flask(__name__, template_folder='templates', static_folder='static')


@app.template_filter('format_dt')
def format_dt(value):
    if not value:
        return '-'
    try:
        dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except:
        return value


@app.template_filter('result_label')
def result_label(value):
    if value == 1:
        return '<span class="badge badge-danger">侵权</span>'
    elif value == 0:
        return '<span class="badge badge-success">非侵权</span>'
    return '<span class="badge badge-secondary">未判定</span>'


@app.template_filter('conflict_type_label')
def conflict_type_label(value):
    if value == 'model_vs_annotation':
        return '<span class="badge badge-warning">标签冲突</span>'
    elif value == 'sample_leakage':
        return '<span class="badge badge-danger">样本泄漏</span>'
    return f'<span class="badge badge-secondary">{value}</span>'


@app.route('/')
def index():
    batches = get_batch_list()
    return render_template('index.html', batches=batches)


@app.route('/batch/<batch_id>')
def batch_detail(batch_id):
    evals = get_evaluation_list(batch_id)
    batch_info = get_latest_batch_info(batch_id)
    batch_runs = get_batch_runs(batch_id)
    models = get_model_versions()
    return render_template('batch_detail.html',
                           batch_id=batch_id,
                           evals=evals,
                           batch_info=batch_info,
                           batch_runs=batch_runs,
                           models=models)


@app.route('/sample/<sample_id>')
def sample_detail(sample_id):
    detail = get_sample_detail(sample_id)
    if not detail['sample']:
        abort(404)
    return render_template('sample_detail.html', detail=detail, sample_id=sample_id)


@app.route('/conflicts')
def conflicts_page():
    batch_id = request.args.get('batch_id')
    conflicts = get_conflicts_list(batch_id)
    return render_template('conflicts.html', conflicts=conflicts, batch_id=batch_id)


@app.route('/compare/<batch_id>')
def compare_page(batch_id):
    run1_id = request.args.get('run1', type=int)
    run2_id = request.args.get('run2', type=int)
    batch_runs = get_batch_runs(batch_id)

    comparison = None
    if run1_id and run2_id:
        comparison = compare_batch_runs(batch_id, run1_id, run2_id)

    return render_template('compare.html',
                           batch_id=batch_id,
                           batch_runs=batch_runs,
                           run1_id=run1_id,
                           run2_id=run2_id,
                           comparison=comparison)


@app.route('/api/review', methods=['POST'])
def api_review():
    data = request.json
    result = submit_manual_review(
        sample_id=data['sample_id'],
        evaluation_log_id=data['evaluation_log_id'],
        final_result=data['final_result'],
        reviewer=data.get('reviewer', '风控运营-老唐'),
        review_note=data.get('review_note', ''),
        override_protected=data.get('override_protected', True)
    )
    return jsonify(result)


@app.route('/api/note', methods=['POST'])
def api_note():
    data = request.json
    result = add_supplementary_note(
        sample_id=data['sample_id'],
        batch_id=data['batch_id'],
        note_content=data['note_content'],
        note_type=data.get('note_type', 'general'),
        operator=data.get('operator', '风控运营-老唐')
    )
    return jsonify(result)


@app.route('/api/run_batch', methods=['POST'])
def api_run_batch():
    data = request.json
    result = run_batch_evaluation(
        batch_id=data['batch_id'],
        model_version_id=data['model_version_id'],
        operator=data.get('operator', '风控运营-老唐'),
        force_override=data.get('force_override', False)
    )
    return jsonify(result)


@app.route('/export/<batch_id>')
def export_csv(batch_id):
    export_type = request.args.get('type', 'full')
    result = export_batch_results(batch_id, '风控运营-老唐', export_type)

    if not result['success']:
        return jsonify(result), 400

    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=result['columns'])
    writer.writeheader()
    writer.writerows(result['rows'])

    output.seek(0)
    return Response(
        output.getvalue().encode('utf-8-sig'),
        mimetype='text/csv; charset=utf-8',
        headers={
            'Content-Disposition': f'attachment; filename="copyright_check_{batch_id}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv"'
        }
    )


@app.route('/api/compare/<batch_id>')
def api_compare(batch_id):
    run1_id = request.args.get('run1', type=int)
    run2_id = request.args.get('run2', type=int)
    result = compare_batch_runs(batch_id, run1_id, run2_id)
    return jsonify(result)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)
