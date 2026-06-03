from flask import Flask, render_template, request, jsonify
from models import init_db
from service import (
    import_teacher_comments,
    supplementary_sampling_list,
    update_assistant_note,
    teacher_review,
    get_complete_trace,
    get_all_records_with_trace,
    get_record_history_diff
)

app = Flask(__name__)


@app.route('/')
def index():
    records = get_all_records_with_trace()
    return render_template('index.html', records=records)


@app.route('/record/<int:record_id>')
def record_detail(record_id):
    trace = get_complete_trace(record_id)
    history = get_record_history_diff(record_id)
    return render_template('detail.html', trace=trace, history=history)


@app.route('/api/import_comments', methods=['POST'])
def api_import_comments():
    data = request.json
    comments = data.get('comments', [])
    source_file = data.get('source_file', '未知文件')
    imported_by = data.get('imported_by', '未知用户')
    
    batch_id, count, skipped = import_teacher_comments(
        comments, source_file, imported_by
    )
    
    return jsonify({
        'batch_id': batch_id,
        'success_count': count,
        'skipped': skipped
    })


@app.route('/api/supplementary_sampling', methods=['POST'])
def api_supplementary_sampling():
    data = request.json
    samples = data.get('samples', [])
    operator = data.get('operator', '未知用户')
    
    count, messages = supplementary_sampling_list(samples, operator)
    
    return jsonify({
        'updated_count': count,
        'messages': messages
    })


@app.route('/api/update_note/<int:record_id>', methods=['POST'])
def api_update_note(record_id):
    data = request.json
    new_note = data.get('note', '')
    operator = data.get('operator', '未知用户')
    
    success = update_assistant_note(record_id, new_note, operator)
    
    return jsonify({'success': success})


@app.route('/api/teacher_review/<int:record_id>', methods=['POST'])
def api_teacher_review(record_id):
    data = request.json
    review_result = data.get('review_result', '')
    reviewer = data.get('reviewer', '未知老师')
    final_status = data.get('final_status', 'normal')
    
    success = teacher_review(record_id, review_result, reviewer, final_status)
    
    return jsonify({'success': success})


if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5001)
