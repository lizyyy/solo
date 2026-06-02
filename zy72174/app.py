import os
import json
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file, redirect, url_for, flash
from werkzeug.utils import secure_filename
import io

from database import get_db, init_db

app = Flask(__name__)
app.config['SECRET_KEY'] = 'demolition-resettlement-key'
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['DATABASE'] = 'resettlement.db'

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs('templates', exist_ok=True)

from core_logic import (
    get_point_list, get_point_detail, update_point_field, add_review,
    get_statistics, export_to_excel, merge_and_match_points,
    STATUS_MAP, STATUS_COLORS
)

@app.route('/')
def index():
    stats = get_statistics()
    status_filter = request.args.get('status', 'all')
    keyword = request.args.get('keyword', '')
    points = get_point_list(status_filter=status_filter, keyword=keyword)
    
    return render_template('index.html',
                         stats=stats,
                         points=points,
                         status_filter=status_filter,
                         keyword=keyword,
                         STATUS_MAP=STATUS_MAP)

@app.route('/point/<int:point_id>')
def point_detail(point_id):
    data = get_point_detail(point_id)
    return render_template('detail.html',
                         point=data['point'],
                         versions=data['versions'],
                         feedback=data['feedback'],
                         photos=data['photos'],
                         notes=data['notes'],
                         reviews=data['reviews'],
                         STATUS_MAP=STATUS_MAP)

@app.route('/point/<int:point_id>/review', methods=['POST'])
def submit_review(point_id):
    reviewer = request.form.get('reviewer', '何工')
    review_result = request.form.get('review_result')
    review_note = request.form.get('review_note', '')
    
    add_review(point_id, reviewer, review_result, review_note)
    flash('复核意见已提交', 'success')
    return redirect(url_for('point_detail', point_id=point_id))

@app.route('/point/<int:point_id>/update', methods=['POST'])
def update_point(point_id):
    field_name = request.form.get('field_name')
    new_value = request.form.get('new_value')
    operator = request.form.get('operator', '何工')
    operation_note = request.form.get('operation_note', '')
    
    success, msg = update_point_field(point_id, field_name, new_value, operator, operation_note)
    flash(msg, 'success' if success else 'warning')
    return redirect(url_for('point_detail', point_id=point_id))

@app.route('/export')
def export_data():
    status_filter = request.args.get('status', 'all')
    wb = export_to_excel(status_filter=status_filter)
    
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    filename = f"城市更新拆迁安置清单_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return send_file(output,
                     as_attachment=True,
                     download_name=filename,
                     mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

@app.route('/import', methods=['GET', 'POST'])
def import_data():
    if request.method == 'POST':
        source_type = request.form.get('source_type')
        source_name = request.form.get('source_name')
        operator = request.form.get('operator', '何工')
        
        file = request.files.get('file')
        if file:
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO data_sources (source_type, source_name, source_file, imported_by) VALUES (?, ?, ?, ?)",
                (source_type, source_name, filename, operator)
            )
            conn.commit()
            conn.close()
            
            flash(f'数据文件 {filename} 已导入', 'success')
            return redirect(url_for('import_data'))
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM data_sources ORDER BY imported_at DESC')
    sources = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return render_template('import.html', sources=sources)

@app.route('/api/stats')
def api_stats():
    return jsonify(get_statistics())

@app.route('/api/points')
def api_points():
    status_filter = request.args.get('status', 'all')
    keyword = request.args.get('keyword', '')
    points = get_point_list(status_filter=status_filter, keyword=keyword)
    return jsonify(points)

@app.route('/api/point/<int:point_id>')
def api_point_detail(point_id):
    return jsonify(get_point_detail(point_id))

if __name__ == '__main__':
    init_db()
    from data_import import import_sample_data
    import_sample_data()
    print('\n' + '='*60)
    print('城市更新拆迁安置清单管理系统 启动成功!')
    print('访问地址: http://localhost:5001')
    print('样例数据: 3个点位，包含3种状态')
    print('  - CQ-2026-001: 已处理（顺利记录）')
    print('  - CQ-2026-002: 待核实（需人工确认）')
    print('  - CQ-2026-003: 需现场复看（GIS旧口径）')
    print('='*60 + '\n')
    app.run(debug=False, host='0.0.0.0', port=5001)
