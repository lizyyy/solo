from database import (
    get_glaze_conflicts, get_batch_placements, 
    get_all_kiln_shelves, get_piece_review_records
)

def check_height_validation(piece, shelf):
    """检查作品高度是否超过层板限制"""
    piece_height = piece.get('height', 0)
    shelf_max_height = shelf.get('max_height', 0)
    
    # 考虑留一定的安全空间（10%）
    safety_margin = shelf_max_height * 0.1
    effective_max = shelf_max_height - safety_margin
    
    if piece_height > effective_max:
        return {
            'valid': False,
            'message': f'作品高度({piece_height}cm)超过层板限制({shelf_max_height}cm，含安全余量)',
            'severity': 'high',
            'check_type': 'height'
        }
    
    return {
        'valid': True,
        'message': '高度检查通过',
        'check_type': 'height'
    }

def check_temperature_zone(piece, shelf):
    """检查作品温区是否与层板温区匹配"""
    piece_zone = piece.get('temperature_zone', '').strip()
    shelf_zone = shelf.get('temperature_zone', '').strip()
    
    # 温区匹配规则：可以是精确匹配，也可以是包含关系
    # 例如：作品是"高温"，层板是"高温区" - 匹配
    # 作品是"中温"，层板是"高温" - 不匹配
    
    if not piece_zone:
        return {
            'valid': True,
            'message': '作品温区未指定，跳过检查',
            'check_type': 'temperature'
        }
    
    if not shelf_zone:
        return {
            'valid': True,
            'message': '层板温区未指定，跳过检查',
            'check_type': 'temperature'
        }
    
    # 简化的温区匹配逻辑
    # 支持的温区类型：低温、中温、高温
    # 支持带"区"字的后缀
    
    def normalize_zone(zone):
        zone = zone.lower()
        zone = zone.replace('区', '')
        zone = zone.replace('温', '')
        return zone.strip()
    
    piece_normalized = normalize_zone(piece_zone)
    shelf_normalized = normalize_zone(shelf_zone)
    
    # 如果归一化后相同，则匹配
    if piece_normalized == shelf_normalized:
        return {
            'valid': True,
            'message': f'温区匹配: {piece_zone} -> {shelf_zone}',
            'check_type': 'temperature'
        }
    
    # 检查温区兼容性：中温可以放在高温区（但高温不能放在中温区）
    # 这是一个常见的陶艺工作室规则
    if piece_normalized == '中' and shelf_normalized == '高':
        return {
            'valid': True,
            'message': f'中温作品可放入高温区: {piece_zone} -> {shelf_zone}',
            'check_type': 'temperature'
        }
    
    return {
        'valid': False,
        'message': f'温区不匹配: 作品{piece_zone} vs 层板{shelf_zone}',
        'severity': 'high',
        'check_type': 'temperature'
    }

def check_payment_status(piece):
    """检查作品是否已付款"""
    payment_status = piece.get('payment_status', '').strip()
    
    # 检查常见的未付款状态
    unpaid_statuses = ['未付款', '未付', '待付款', 'unpaid', 'pending']
    
    if payment_status.lower() in [s.lower() for s in unpaid_statuses]:
        return {
            'valid': False,
            'message': f'作品未付款: {payment_status}',
            'severity': 'medium',
            'check_type': 'payment'
        }
    
    return {
        'valid': True,
        'message': '付款状态正常',
        'check_type': 'payment'
    }

def check_glaze_conflicts_between_pieces(piece1, piece2):
    """检查两件作品的釉药是否有冲突"""
    glaze1 = piece1.get('glaze_type', '').strip()
    glaze2 = piece2.get('glaze_type', '').strip()
    
    if not glaze1 or not glaze2:
        return None
    
    if glaze1 == glaze2:
        return None
    
    # 获取釉药1的冲突列表
    conflicts1 = get_glaze_conflicts(glaze1)
    for conflict in conflicts1:
        if conflict['conflicting_glaze'] == glaze2:
            return {
                'valid': False,
                'message': f'釉药冲突: {glaze1} 与 {glaze2} ({conflict.get("description", "禁忌搭配")})',
                'severity': conflict.get('severity', 'high'),
                'check_type': 'glaze',
                'piece1_code': piece1.get('piece_code'),
                'piece2_code': piece2.get('piece_code'),
                'glaze1': glaze1,
                'glaze2': glaze2
            }
    
    # 检查釉药2的冲突列表（以防不是双向的）
    conflicts2 = get_glaze_conflicts(glaze2)
    for conflict in conflicts2:
        if conflict['conflicting_glaze'] == glaze1:
            return {
                'valid': False,
                'message': f'釉药冲突: {glaze2} 与 {glaze1} ({conflict.get("description", "禁忌搭配")})',
                'severity': conflict.get('severity', 'high'),
                'check_type': 'glaze',
                'piece1_code': piece2.get('piece_code'),
                'piece2_code': piece1.get('piece_code'),
                'glaze1': glaze2,
                'glaze2': glaze1
            }
    
    return None

def check_all_glaze_conflicts_in_batch(batch_id):
    """检查窑次中所有相邻作品的釉药冲突"""
    placements = get_batch_placements(batch_id)
    
    if not placements:
        return []
    
    # 按层板分组
    placements_by_shelf = {}
    for p in placements:
        shelf_id = p['shelf_id']
        if shelf_id not in placements_by_shelf:
            placements_by_shelf[shelf_id] = []
        placements_by_shelf[shelf_id].append(p)
    
    all_conflicts = []
    
    # 检查同一层板上的作品
    for shelf_id, pieces in placements_by_shelf.items():
        # 两两比较
        for i in range(len(pieces)):
            for j in range(i + 1, len(pieces)):
                conflict = check_glaze_conflicts_between_pieces(pieces[i], pieces[j])
                if conflict:
                    conflict['shelf_id'] = shelf_id
                    conflict['shelf_number'] = pieces[i].get('shelf_number')
                    all_conflicts.append(conflict)
    
    return all_conflicts

def validate_piece_placement(piece, shelf, batch_id=None):
    """综合校验作品放置"""
    validations = []
    
    # 高度检查
    height_check = check_height_validation(piece, shelf)
    validations.append(height_check)
    
    # 温区检查
    temp_check = check_temperature_zone(piece, shelf)
    validations.append(temp_check)
    
    # 付款检查
    payment_check = check_payment_status(piece)
    validations.append(payment_check)
    
    # 检查是否有改判记录
    if batch_id:
        review_records = get_piece_review_records(batch_id, piece['id'])
        
        # 对每个校验项检查是否有改判
        for validation in validations:
            check_type = validation['check_type']
            for record in review_records:
                if record['check_type'] == check_type and record['overridden_result'] is not None:
                    validation['original_result'] = validation['valid']
                    validation['valid'] = (record['overridden_result'].lower() == 'pass')
                    validation['overridden'] = True
                    validation['override_reason'] = record.get('override_reason', '')
                    validation['overridden_at'] = record.get('reviewed_at', '')
                    break
    
    # 汇总结果
    all_valid = all(v['valid'] for v in validations)
    
    return {
        'valid': all_valid,
        'validations': validations,
        'piece_code': piece.get('piece_code'),
        'shelf_number': shelf.get('shelf_number')
    }

def validate_entire_batch(batch_id):
    """校验整个窑次的所有放置"""
    placements = get_batch_placements(batch_id)
    shelves = {s['id']: s for s in get_all_kiln_shelves()}
    
    all_validations = []
    
    # 逐个校验每个放置
    for placement in placements:
        piece = {
            'id': placement['piece_id'],
            'piece_code': placement['piece_code'],
            'owner_name': placement['owner_name'],
            'height': placement['height'],
            'width': placement['width'],
            'depth': placement['depth'],
            'clay_type': placement['clay_type'],
            'glaze_type': placement['glaze_type'],
            'temperature_zone': placement['temperature_zone'],
            'payment_status': placement['payment_status']
        }
        
        shelf = shelves.get(placement['shelf_id'], {
            'id': placement['shelf_id'],
            'shelf_number': placement['shelf_number'],
            'max_height': placement['max_height'],
            'temperature_zone': placement['shelf_temperature_zone']
        })
        
        validation = validate_piece_placement(piece, shelf, batch_id)
        validation['placement_id'] = placement['id']
        validation['shelf_id'] = placement['shelf_id']
        all_validations.append(validation)
    
    # 检查釉药冲突
    glaze_conflicts = check_all_glaze_conflicts_in_batch(batch_id)
    
    # 汇总结果
    all_valid = all(v['valid'] for v in all_validations) and len(glaze_conflicts) == 0
    
    # 统计各类问题
    height_issues = sum(1 for v in all_validations if not all(
        check['valid'] for check in v['validations'] if check['check_type'] == 'height'
    ))
    
    temp_issues = sum(1 for v in all_validations if not all(
        check['valid'] for check in v['validations'] if check['check_type'] == 'temperature'
    ))
    
    payment_issues = sum(1 for v in all_validations if not all(
        check['valid'] for check in v['validations'] if check['check_type'] == 'payment'
    ))
    
    high_conflicts = sum(1 for c in glaze_conflicts if c.get('severity') == 'high')
    medium_conflicts = sum(1 for c in glaze_conflicts if c.get('severity') == 'medium')
    
    return {
        'valid': all_valid,
        'total_pieces': len(placements),
        'validations': all_validations,
        'glaze_conflicts': glaze_conflicts,
        'summary': {
            'height_issues': height_issues,
            'temperature_issues': temp_issues,
            'payment_issues': payment_issues,
            'high_glaze_conflicts': high_conflicts,
            'medium_glaze_conflicts': medium_conflicts,
            'total_issues': height_issues + temp_issues + payment_issues + high_conflicts + medium_conflicts
        }
    }
