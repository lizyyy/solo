import csv
import os
import io
from flask import Flask, request, jsonify, render_template, send_from_directory
import db

app = Flask(__name__)
db.init_db()

SAMPLE_DIR = os.path.join(os.path.dirname(__file__), 'sample_data')
os.makedirs(SAMPLE_DIR, exist_ok=True)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/overview')
def overview():
    return jsonify(db.query_all())


@app.route('/api/import/submission', methods=['POST'])
def import_submission():
    f = request.files.get('file')
    if not f:
        return jsonify({'error': '未上传文件'}), 400
    rows = read_csv(f.stream)
    result = db.import_submission(rows, f.filename)
    return jsonify(result)


@app.route('/api/import/model', methods=['POST'])
def import_model():
    f = request.files.get('file')
    if not f:
        return jsonify({'error': '未上传文件'}), 400
    rows = read_csv(f.stream)
    result = db.import_model(rows, f.filename)
    db.run_collision_detection()
    return jsonify(result)


@app.route('/api/detect', methods=['POST'])
def detect():
    result = db.run_collision_detection()
    return jsonify(result)


@app.route('/api/submission/<int:rid>/remark', methods=['POST'])
def update_remark(rid):
    data = request.get_json() or {}
    db.update_manual_remark(rid, data.get('manual_remark', ''))
    return jsonify({'ok': True})


@app.route('/api/status/<table>/<int:rid>', methods=['POST'])
def update_status(table, rid):
    data = request.get_json() or {}
    db.update_process_status(table, rid, data.get('status', '待预审'))
    return jsonify({'ok': True})


@app.route('/api/samples')
def list_samples():
    files = []
    if os.path.isdir(SAMPLE_DIR):
        for n in sorted(os.listdir(SAMPLE_DIR)):
            if n.endswith('.csv'):
                files.append(n)
    return jsonify(files)


@app.route('/api/load_sample/<filename>', methods=['POST'])
def load_sample(filename):
    fp = os.path.join(SAMPLE_DIR, filename)
    if not os.path.isfile(fp):
        return jsonify({'error': '样例文件不存在'}), 404
    with open(fp, 'r', encoding='utf-8-sig', newline='') as fh:
        rows = read_csv(fh)
    if '送审' in filename or 'submission' in filename.lower():
        result = db.import_submission(rows, filename)
    else:
        result = db.import_model(rows, filename)
        db.run_collision_detection()
    return jsonify(result)


def read_csv(stream):
    content = stream.read() if hasattr(stream, 'read') else stream
    if isinstance(content, bytes):
        content = content.decode('utf-8-sig', errors='replace')
    reader = csv.DictReader(io.StringIO(content))
    return [dict(row) for row in reader]


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5055, debug=False, use_reloader=False)
