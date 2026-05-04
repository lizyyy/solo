from flask import Flask, render_template, request, jsonify, redirect, url_for
import os
import sys

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import (
    init_db, get_all_pieces, get_all_kiln_batches, 
    get_kiln_batch, get_all_kiln_shelves, get_piece_by_code,
    create_kiln_batch, add_shelf_placement, get_batch_placements,
    add_review_record, get_db_connection
)
from validation_service import validate_entire_batch, validate_piece_placement
from export_service import export_all, export_kiln_list_to_markdown, export_pickup_list_to_csv, export_audit_package_to_json
from import_service import import_pieces_from_csv, import_kiln_shelves_from_json, import_glaze_conflicts_from_json
from config import DATA_DIR, EXPORT_DIR

app = Flask(__name__)
app.secret_key = 'kiln-prechecker-secret-key'

# 初始化数据库
init_db()

@app.route('/')
def index():
    """首页 - 窑次列表"""
    batches = get_all_kiln_batches()
    return render_template('index.html', batches=batches)

@app.route('/batch/<int:batch_id>')
def batch_detail(batch_id):
    """窑次详情页 - 复核页面"""
    batch = get_kiln_batch(batch_id)
    if not batch:
        return redirect(url_for('index'))
    
    placements = get_batch_placements(batch_id)
    validation = validate_entire_batch(batch_id)
    shelves = get_all_kiln_shelves()
    all_pieces = get_all_pieces()
    
    # 获取已安排的作品ID
    placed_piece_ids = [p['piece_id'] for p in placements]
    
    # 筛选未安排的作品
    unplaced_pieces = [p for p in all_pieces if p['id'] not in placed_piece_ids]
    
    # 按层板分组
    placements_by_shelf = {}
    for p in placements:
        shelf_id = p['shelf_id']
        if shelf_id not in placements_by_shelf:
            placements_by_shelf[shelf_id] = []
        placements_by_shelf[shelf_id].append(p)
    
    return render_template('batch_detail.html',
                          batch=batch,
                          placements=placements,
                          placements_by_shelf=placements_by_shelf,
                          validation=validation,
                          shelves=shelves,
                          unplaced_pieces=unplaced_pieces)

@app.route('/api/batch/<int:batch_id>/validate')
def api_validate_batch(batch_id):
    """API: 校验窑次"""
    result = validate_entire_batch(batch_id)
    return jsonify(result)

@app.route('/api/batch/<int:batch_id>/place', methods=['POST'])
def api_place_piece(batch_id):
    """API: 安排作品到层板"""
    data = request.get_json()
    piece_code = data.get('piece_code')
    shelf_number = data.get('shelf_number')
    
    if not piece_code or shelf_number is None:
        return jsonify({'success': False, 'error': '缺少参数'})
    
    piece = get_piece_by_code(piece_code)
    if not piece:
        return jsonify({'success': False, 'error': '未找到作品'})
    
    shelves = get_all_kiln_shelves()
    shelf = next((s for s in shelves if s['shelf_number'] == int(shelf_number)), None)
    
    if not shelf:
        return jsonify({'success': False, 'error': '未找到层板'})
    
    # 检查作品是否已安排
    placements = get_batch_placements(batch_id)
    if any(p['piece_id'] == piece['id'] for p in placements):
        return jsonify({'success': False, 'error': '作品已安排'})
    
    try:
        placement_id = add_shelf_placement(
            batch_id=batch_id,
            piece_id=piece['id'],
            shelf_id=shelf['id']
        )
        return jsonify({'success': True, 'placement_id': placement_id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/placement/<int:placement_id>/remove', methods=['POST'])
def api_remove_placement(placement_id):
    """API: 移除作品安排"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM shelf_placements WHERE id = ?', (placement_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

@app.route('/api/batch/<int:batch_id>/review', methods=['POST'])
def api_add_review(batch_id):
    """API: 添加复核记录（改判）"""
    data = request.get_json()
    
    piece_id = data.get('piece_id')
    check_type = data.get('check_type')
    original_result = data.get('original_result')
    overridden_result = data.get('overridden_result')
    override_reason = data.get('override_reason', '')
    reviewed_by = data.get('reviewed_by', '系统')
    
    if not all([piece_id, check_type, original_result, overridden_result]):
        return jsonify({'success': False, 'error': '缺少参数'})
    
    try:
        record_id = add_review_record(
            batch_id=batch_id,
            piece_id=piece_id,
            check_type=check_type,
            original_result=original_result,
            overridden_result=overridden_result,
            override_reason=override_reason,
            reviewed_by=reviewed_by
        )
        return jsonify({'success': True, 'record_id': record_id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/batch/create', methods=['POST'])
def create_batch():
    """创建新窑次"""
    batch_code = request.form.get('batch_code')
    target_temperature_zone = request.form.get('target_temperature_zone')
    batch_name = request.form.get('batch_name', batch_code)
    
    if not batch_code or not target_temperature_zone:
        return redirect(url_for('index'))
    
    try:
        batch_id = create_kiln_batch(
            batch_code=batch_code,
            target_temperature_zone=target_temperature_zone,
            batch_name=batch_name
        )
        return redirect(url_for('batch_detail', batch_id=batch_id))
    except Exception as e:
        return redirect(url_for('index'))

@app.route('/batch/<int:batch_id>/export/<format>')
def export_batch(batch_id, format):
    """导出窑次数据"""
    batch = get_kiln_batch(batch_id)
    if not batch:
        return jsonify({'success': False, 'error': '未找到窑次'})
    
    try:
        if format == 'all':
            results = export_all(batch_id)
            return jsonify({'success': True, 'files': results})
        elif format == 'markdown':
            path = export_kiln_list_to_markdown(batch_id)
            return jsonify({'success': True, 'path': path})
        elif format == 'csv':
            path = export_pickup_list_to_csv(batch_id)
            return jsonify({'success': True, 'path': path})
        elif format == 'json':
            path = export_audit_package_to_json(batch_id)
            return jsonify({'success': True, 'path': path})
        else:
            return jsonify({'success': False, 'error': '不支持的格式'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/import', methods=['GET', 'POST'])
def import_data():
    """导入数据页面"""
    if request.method == 'POST':
        results = {}
        
        # 处理作品CSV
        if 'pieces_file' in request.files:
            file = request.files['pieces_file']
            if file.filename:
                filepath = os.path.join(DATA_DIR, file.filename)
                file.save(filepath)
                results['pieces'] = import_pieces_from_csv(filepath)
        
        # 处理层板JSON
        if 'shelves_file' in request.files:
            file = request.files['shelves_file']
            if file.filename:
                filepath = os.path.join(DATA_DIR, file.filename)
                file.save(filepath)
                results['shelves'] = import_kiln_shelves_from_json(filepath)
        
        # 处理釉药禁忌JSON
        if 'glazes_file' in request.files:
            file = request.files['glazes_file']
            if file.filename:
                filepath = os.path.join(DATA_DIR, file.filename)
                file.save(filepath)
                results['conflicts'] = import_glaze_conflicts_from_json(filepath)
        
        return render_template('import_result.html', results=results)
    
    return render_template('import.html')

@app.route('/api/pieces')
def api_list_pieces():
    """API: 列出所有作品"""
    pieces = get_all_pieces()
    return jsonify(pieces)

@app.route('/api/shelves')
def api_list_shelves():
    """API: 列出所有层板"""
    shelves = get_all_kiln_shelves()
    return jsonify(shelves)

if __name__ == '__main__':
    # 确保模板目录存在
    template_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'templates')
    if not os.path.exists(template_dir):
        os.makedirs(template_dir)
    
    app.run(host='127.0.0.1', port=5000, debug=True)
