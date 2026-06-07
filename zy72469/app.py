from flask import Flask, render_template, request, jsonify, send_file
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import SAMPLES_DIR, RAW_DATA_DIR
from models import store
from modules.data_import import import_inspections, import_notices, get_import_history
from modules.conflict_detection import (
    detect_conflicts, resolve_conflict, reject_conflict,
    get_conflicts, get_conflict_stats
)
from modules.heatmap import (
    generate_heatmap, review_heatmap_grid,
    get_heatmap_data, get_heatmap_stats
)
from modules.self_check import run_all_checks, get_check_history
from modules.export import (
    export_inspections_to_excel, export_notices_to_excel,
    export_heatmap_to_excel, export_conflicts_to_excel,
    export_full_report, get_data_summary
)

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400
    
    file = request.files['file']
    data_type = request.form.get('data_type', 'inspection')
    import_type = request.form.get('import_type', 'normal')
    operator = request.form.get('operator', '')
    
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
    file_path = os.path.join(RAW_DATA_DIR, filename)
    file.save(file_path)
    
    try:
        if data_type == 'inspection':
            result = import_inspections(file_path, import_type, operator)
        else:
            result = import_notices(file_path, import_type, operator)
        
        return jsonify(result.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/import/load_sample', methods=['POST'])
def load_sample():
    sample_type = request.json.get('sample_type', 'normal')
    data_type = request.json.get('data_type', 'inspection')
    operator = request.json.get('operator', '')
    
    sample_file = os.path.join(SAMPLES_DIR, f'{data_type}_{sample_type}.xlsx')
    if not os.path.exists(sample_file):
        return jsonify({'error': f'样例文件不存在: {sample_file}'}), 400
    
    try:
        if data_type == 'inspection':
            result = import_inspections(sample_file, sample_type, operator)
        else:
            result = import_notices(sample_file, sample_type, operator)
        
        return jsonify(result.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/import/history')
def import_history():
    return jsonify(get_import_history())

@app.route('/api/conflicts/detect', methods=['POST'])
def detect():
    new_conflicts = detect_conflicts()
    return jsonify({
        'new_count': len(new_conflicts),
        'conflicts': [c.to_dict() for c in new_conflicts]
    })

@app.route('/api/conflicts')
def conflicts_list():
    status = request.args.get('status')
    return jsonify(get_conflicts(status))

@app.route('/api/conflicts/stats')
def conflicts_stats():
    return jsonify(get_conflict_stats())

@app.route('/api/conflicts/<conflict_id>/resolve', methods=['POST'])
def resolve(conflict_id):
    data = request.json
    resolution = data.get('resolution', '')
    resolved_by = data.get('resolved_by', '阿宁')
    result = resolve_conflict(conflict_id, resolution, resolved_by)
    if result:
        return jsonify(result.to_dict())
    return jsonify({'error': '冲突记录不存在'}), 404

@app.route('/api/conflicts/<conflict_id>/reject', methods=['POST'])
def reject(conflict_id):
    data = request.json
    resolved_by = data.get('resolved_by', '阿宁')
    result = reject_conflict(conflict_id, resolved_by)
    if result:
        return jsonify(result.to_dict())
    return jsonify({'error': '冲突记录不存在'}), 404

@app.route('/api/heatmap/generate', methods=['POST'])
def gen_heatmap():
    data = request.json or {}
    target_date = data.get('date')
    result = generate_heatmap(target_date)
    return jsonify(result)

@app.route('/api/heatmap')
def heatmap_data():
    return jsonify(get_heatmap_data())

@app.route('/api/heatmap/stats')
def heatmap_stats():
    return jsonify(get_heatmap_stats())

@app.route('/api/heatmap/<grid_id>/review', methods=['POST'])
def review_grid(grid_id):
    data = request.json
    review_status = data.get('review_status', 'normal')
    reviewed_by = data.get('reviewed_by', '街道规划员')
    result = review_heatmap_grid(grid_id, review_status, reviewed_by)
    if result:
        return jsonify(result.to_dict())
    return jsonify({'error': '网格记录不存在'}), 404

@app.route('/api/selfcheck/run', methods=['POST'])
def run_checks():
    results = run_all_checks()
    return jsonify(results)

@app.route('/api/selfcheck/history')
def checks_history():
    return jsonify(get_check_history())

@app.route('/api/export/<data_type>')
def export_data(data_type):
    try:
        if data_type == 'inspections':
            file_path = export_inspections_to_excel()
        elif data_type == 'notices':
            file_path = export_notices_to_excel()
        elif data_type == 'heatmap':
            file_path = export_heatmap_to_excel()
        elif data_type == 'conflicts':
            file_path = export_conflicts_to_excel()
        elif data_type == 'report':
            result = export_full_report()
            return jsonify(result)
        else:
            return jsonify({'error': '不支持的导出类型'}), 400
        
        return send_file(file_path, as_attachment=True)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/summary')
def summary():
    return jsonify(get_data_summary())

@app.route('/api/inspections')
def inspections_list():
    return jsonify([i.to_dict() for i in store.inspections])

@app.route('/api/notices')
def notices_list():
    return jsonify([n.to_dict() for n in store.notices])

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
