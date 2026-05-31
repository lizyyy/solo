import os
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

from database import init_db
from core_logic import (
    import_lecture, add_commentary, update_difficulty,
    withdraw_lecture, revise_lecture, query_lectures,
    get_lecture_timeline, export_data, get_filter_criteria,
    UPLOAD_FOLDER
)
from tangent_checker import check_tangent_lecture, confirm_check_result, get_check_history

app = Flask(__name__, static_folder='static')
CORS(app)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

init_db()

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/api/lectures', methods=['GET'])
def list_lectures():
    filters = request.args.to_dict()
    operator = request.args.get('operator', 'user')
    result = query_lectures(filters, operator=operator)
    return jsonify(result)

@app.route('/api/lectures', methods=['POST'])
def create_lecture():
    title = request.form.get('title', '').strip()
    difficulty_tag = request.form.get('difficulty_tag')
    commentary_content = request.form.get('commentary_content')
    teacher = request.form.get('teacher')
    operator = request.form.get('operator', 'user')
    
    if not title:
        return jsonify({'error': '标题不能为空'}), 400
    
    screenshot_file = request.files.get('screenshot')
    
    result = import_lecture(
        title=title,
        screenshot_file=screenshot_file,
        difficulty_tag=difficulty_tag,
        commentary_content=commentary_content,
        teacher=teacher,
        operator=operator
    )
    
    return jsonify(result)

@app.route('/api/lectures/<lecture_id>', methods=['GET'])
def get_lecture_detail(lecture_id):
    result = get_lecture_timeline(lecture_id)
    return jsonify(result)

@app.route('/api/lectures/<lecture_id>/commentary', methods=['POST'])
def add_lecture_commentary(lecture_id):
    data = request.json
    content = data.get('content', '').strip()
    teacher = data.get('teacher')
    operator = data.get('operator', 'user')
    
    if not content:
        return jsonify({'error': '讲评内容不能为空'}), 400
    
    result = add_commentary(lecture_id, content, teacher, operator=operator)
    return jsonify(result)

@app.route('/api/lectures/<lecture_id>/difficulty', methods=['PUT'])
def update_lecture_difficulty(lecture_id):
    data = request.json
    difficulty_tag = data.get('difficulty_tag')
    confirmed = data.get('confirmed', False)
    operator = data.get('operator', 'user')
    
    result = update_difficulty(lecture_id, difficulty_tag, operator=operator, confirmed=confirmed)
    return jsonify(result)

@app.route('/api/lectures/<lecture_id>/withdraw', methods=['POST'])
def withdraw_lecture_api(lecture_id):
    data = request.json
    reason = data.get('reason', '').strip()
    operator = data.get('operator', 'user')
    
    if not reason:
        return jsonify({'error': '撤回理由不能为空'}), 400
    
    result = withdraw_lecture(lecture_id, reason, operator=operator)
    return jsonify(result)

@app.route('/api/lectures/<lecture_id>/revise', methods=['PUT'])
def revise_lecture_api(lecture_id):
    data = request.json
    new_title = data.get('new_title')
    new_difficulty = data.get('new_difficulty')
    reason = data.get('reason', '')
    operator = data.get('operator', 'user')
    
    result = revise_lecture(lecture_id, new_title, new_difficulty, operator=operator, reason=reason)
    return jsonify(result)

@app.route('/api/lectures/<lecture_id>/check-tangent', methods=['POST'])
def check_tangent_api(lecture_id):
    data = request.json or {}
    operator = data.get('operator', 'user')
    result = check_tangent_lecture(lecture_id, operator=operator)
    return jsonify(result)

@app.route('/api/lectures/<lecture_id>/checks', methods=['GET'])
def get_checks_api(lecture_id):
    result = get_check_history(lecture_id)
    return jsonify(result)

@app.route('/api/checks/<check_id>/confirm', methods=['POST'])
def confirm_check_api(check_id):
    data = request.json
    lecture_id = data.get('lecture_id')
    is_approved = data.get('is_approved', True)
    comment = data.get('comment')
    operator = data.get('operator', 'user')
    
    result = confirm_check_result(check_id, lecture_id, is_approved, comment, operator=operator)
    return jsonify(result)

@app.route('/api/filter-criteria', methods=['GET'])
def filter_criteria_api():
    return jsonify(get_filter_criteria())

@app.route('/api/export', methods=['POST'])
def export_api():
    data = request.json or {}
    filters = data.get('filters')
    format = data.get('format', 'excel')
    operator = data.get('operator', 'user')
    
    result = export_data(filters, format=format, operator=operator)
    return jsonify(result)

@app.route('/api/export/<filename>', methods=['GET'])
def download_export(filename):
    from core_logic import EXPORT_FOLDER
    return send_from_directory(EXPORT_FOLDER, filename, as_attachment=True)

@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
