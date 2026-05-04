import csv
import json
from datetime import datetime
from database import get_db_connection, init_db

def import_pieces_from_csv(csv_file_path):
    """从CSV文件导入作品数据"""
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    
    imported_count = 0
    updated_count = 0
    
    with open(csv_file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            piece_code = row.get('作品编号', row.get('piece_code', ''))
            if not piece_code:
                continue
            
            # 检查是否已存在
            cursor.execute('SELECT id FROM pieces WHERE piece_code = ?', (piece_code,))
            existing = cursor.fetchone()
            
            if existing:
                # 更新现有记录
                cursor.execute('''
                    UPDATE pieces SET
                        owner_name = ?,
                        height = ?,
                        width = ?,
                        depth = ?,
                        clay_type = ?,
                        glaze_type = ?,
                        temperature_zone = ?,
                        payment_status = ?,
                        pickup_info = ?,
                        notes = ?
                    WHERE piece_code = ?
                ''', (
                    row.get('作者姓名', row.get('owner_name', '')),
                    float(row.get('高度(cm)', row.get('height', 0))),
                    float(row.get('宽度(cm)', row.get('width', 0))),
                    float(row.get('深度(cm)', row.get('depth', 0))),
                    row.get('泥料类型', row.get('clay_type', '')),
                    row.get('釉药类型', row.get('glaze_type', '')),
                    row.get('温区', row.get('temperature_zone', '')),
                    row.get('付款状态', row.get('payment_status', '未付款')),
                    row.get('取件信息', row.get('pickup_info', '')),
                    row.get('备注', row.get('notes', '')),
                    piece_code
                ))
                updated_count += 1
            else:
                # 插入新记录
                cursor.execute('''
                    INSERT INTO pieces (
                        piece_code, owner_name, height, width, depth,
                        clay_type, glaze_type, temperature_zone,
                        payment_status, pickup_info, import_date, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    piece_code,
                    row.get('作者姓名', row.get('owner_name', '')),
                    float(row.get('高度(cm)', row.get('height', 0))),
                    float(row.get('宽度(cm)', row.get('width', 0))),
                    float(row.get('深度(cm)', row.get('depth', 0))),
                    row.get('泥料类型', row.get('clay_type', '')),
                    row.get('釉药类型', row.get('glaze_type', '')),
                    row.get('温区', row.get('temperature_zone', '')),
                    row.get('付款状态', row.get('payment_status', '未付款')),
                    row.get('取件信息', row.get('pickup_info', '')),
                    now,
                    row.get('备注', row.get('notes', ''))
                ))
                imported_count += 1
    
    conn.commit()
    conn.close()
    
    return {
        'imported': imported_count,
        'updated': updated_count,
        'total': imported_count + updated_count
    }

def import_kiln_shelves_from_json(json_file_path):
    """从JSON文件导入窑炉层板数据"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    imported_count = 0
    updated_count = 0
    
    with open(json_file_path, 'r', encoding='utf-8') as f:
        shelves = json.load(f)
    
    # 清空现有层板数据
    cursor.execute('DELETE FROM kiln_shelves')
    
    for shelf in shelves:
        cursor.execute('''
            INSERT INTO kiln_shelves (
                shelf_number, max_height, temperature_zone,
                shelf_type, position_in_kiln, is_available
            ) VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            shelf.get('shelf_number', shelf.get('层板编号', 0)),
            float(shelf.get('max_height', shelf.get('最大高度(cm)', 0))),
            shelf.get('temperature_zone', shelf.get('温区', '')),
            shelf.get('shelf_type', shelf.get('层板类型', '')),
            shelf.get('position_in_kiln', shelf.get('窑内位置', '')),
            1  # 默认可用
        ))
        imported_count += 1
    
    conn.commit()
    conn.close()
    
    return {
        'imported': imported_count,
        'total': imported_count
    }

def import_glaze_conflicts_from_json(json_file_path):
    """从JSON文件导入釉药禁忌表"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    imported_count = 0
    
    with open(json_file_path, 'r', encoding='utf-8') as f:
        conflicts = json.load(f)
    
    # 清空现有禁忌数据
    cursor.execute('DELETE FROM glaze_conflicts')
    
    for conflict in conflicts:
        cursor.execute('''
            INSERT INTO glaze_conflicts (
                glaze_a, glaze_b, conflict_severity,
                conflict_description, is_mutual
            ) VALUES (?, ?, ?, ?, ?)
        ''', (
            conflict.get('glaze_a', conflict.get('釉药A', '')),
            conflict.get('glaze_b', conflict.get('釉药B', '')),
            conflict.get('conflict_severity', conflict.get('风险等级', 'medium')),
            conflict.get('conflict_description', conflict.get('描述', '')),
            1 if conflict.get('is_mutual', conflict.get('是否双向', True)) else 0
        ))
        imported_count += 1
    
    conn.commit()
    conn.close()
    
    return {
        'imported': imported_count,
        'total': imported_count
    }

def import_all(pieces_csv=None, shelves_json=None, conflicts_json=None):
    """批量导入所有数据"""
    results = {}
    
    if pieces_csv:
        results['pieces'] = import_pieces_from_csv(pieces_csv)
    
    if shelves_json:
        results['shelves'] = import_kiln_shelves_from_json(shelves_json)
    
    if conflicts_json:
        results['conflicts'] = import_glaze_conflicts_from_json(conflicts_json)
    
    return results
