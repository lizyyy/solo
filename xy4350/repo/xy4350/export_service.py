import csv
import json
import os
from datetime import datetime
from config import EXPORT_DIR
from database import (
    get_kiln_batch, get_batch_placements, 
    get_batch_review_records, get_all_kiln_shelves
)
from validation_service import validate_entire_batch

def ensure_export_dir():
    if not os.path.exists(EXPORT_DIR):
        os.makedirs(EXPORT_DIR)

def export_kiln_list_to_markdown(batch_id, output_path=None):
    """导出装窑单为Markdown格式"""
    ensure_export_dir()
    
    batch = get_kiln_batch(batch_id)
    placements = get_batch_placements(batch_id)
    validation = validate_entire_batch(batch_id)
    
    if not batch:
        return None
    
    # 按层板分组
    placements_by_shelf = {}
    shelves = {s['id']: s for s in get_all_kiln_shelves()}
    
    for p in placements:
        shelf_id = p['shelf_id']
        if shelf_id not in placements_by_shelf:
            placements_by_shelf[shelf_id] = []
        placements_by_shelf[shelf_id].append(p)
    
    # 生成Markdown内容
    md_content = []
    
    # 标题
    md_content.append(f'# 装窑单\n')
    md_content.append(f'**窑次编号**: {batch["batch_code"]}')
    md_content.append(f'**窑次名称**: {batch.get("batch_name", "未命名")}')
    md_content.append(f'**目标温区**: {batch["target_temperature_zone"]}')
    md_content.append(f'**状态**: {batch["status"]}')
    md_content.append(f'**生成时间**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    md_content.append('')
    
    # 校验摘要
    md_content.append('## 校验摘要\n')
    summary = validation['summary']
    md_content.append(f'- 作品总数: {validation["total_pieces"]}')
    md_content.append(f'- 高度问题: {summary["height_issues"]}')
    md_content.append(f'- 温区问题: {summary["temperature_issues"]}')
    md_content.append(f'- 付款问题: {summary["payment_issues"]}')
    md_content.append(f'- 高风险釉药冲突: {summary["high_glaze_conflicts"]}')
    md_content.append(f'- 中风险釉药冲突: {summary["medium_glaze_conflicts"]}')
    md_content.append(f'**总问题数**: {summary["total_issues"]}')
    md_content.append('')
    
    # 层板详情
    md_content.append('## 层板安排\n')
    
    for shelf_id, pieces in sorted(placements_by_shelf.items(), key=lambda x: shelves.get(x[0], {}).get('shelf_number', 0)):
        shelf = shelves.get(shelf_id, {})
        shelf_num = shelf.get('shelf_number', '未知')
        
        md_content.append(f'### 层板 {shelf_num}\n')
        md_content.append(f'- 最大高度: {shelf.get("max_height", "未知")}cm')
        md_content.append(f'- 温区: {shelf.get("temperature_zone", "未知")}')
        md_content.append('')
        
        # 作品表格
        md_content.append('| 作品编号 | 作者 | 尺寸(高×宽×深) | 泥料 | 釉药 | 温区 | 付款状态 |')
        md_content.append('|----------|------|-----------------|------|------|------|----------|')
        
        for p in pieces:
            dimensions = f"{p['height']}×{p['width']}×{p['depth']}"
            md_content.append(
                f"| {p['piece_code']} | {p['owner_name']} | {dimensions} | "
                f"{p['clay_type']} | {p['glaze_type']} | {p['temperature_zone']} | {p['payment_status']} |"
            )
        
        md_content.append('')
    
    # 釉药冲突
    if validation['glaze_conflicts']:
        md_content.append('## 釉药冲突警告\n')
        for conflict in validation['glaze_conflicts']:
            severity_icon = '🔴' if conflict.get('severity') == 'high' else '🟡'
            md_content.append(
                f"{severity_icon} **层板 {conflict.get('shelf_number', '未知')}**: "
                f"{conflict['piece1_code']}({conflict['glaze1']}) 与 "
                f"{conflict['piece2_code']}({conflict['glaze2']}) - "
                f"{conflict['message']}"
            )
        md_content.append('')
    
    # 有问题的作品详情
    issues_exist = any(not v['valid'] for v in validation['validations'])
    if issues_exist:
        md_content.append('## 问题作品详情\n')
        for v in validation['validations']:
            if not v['valid']:
                md_content.append(f"### 作品 {v['piece_code']}\n")
                for check in v['validations']:
                    if not check['valid']:
                        status = '❌'
                        if check.get('overridden'):
                            status = '⚠️ (已改判)'
                        md_content.append(f"{status} **{check['check_type']}**: {check['message']}")
                md_content.append('')
    
    final_content = '\n'.join(md_content)
    
    if output_path:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(final_content)
        return output_path
    else:
        filename = f'kiln_list_{batch["batch_code"]}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.md'
        output_path = os.path.join(EXPORT_DIR, filename)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(final_content)
        return output_path

def export_pickup_list_to_csv(batch_id, output_path=None):
    """导出取件清单为CSV格式"""
    ensure_export_dir()
    
    batch = get_kiln_batch(batch_id)
    placements = get_batch_placements(batch_id)
    
    if not batch:
        return None
    
    # 按作者分组
    pieces_by_owner = {}
    for p in placements:
        owner = p['owner_name']
        if owner not in pieces_by_owner:
            pieces_by_owner[owner] = []
        pieces_by_owner[owner].append(p)
    
    if output_path:
        csv_path = output_path
    else:
        filename = f'pickup_list_{batch["batch_code"]}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        csv_path = os.path.join(EXPORT_DIR, filename)
    
    with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        
        # 标题行
        writer.writerow([
            '窑次编号', '窑次名称', '目标温区',
            '作者姓名', '作品编号', '层板位置',
            '泥料', '釉药', '温区', '付款状态',
            '取件信息', '备注'
        ])
        
        for owner, pieces in pieces_by_owner.items():
            for p in pieces:
                writer.writerow([
                    batch['batch_code'],
                    batch.get('batch_name', ''),
                    batch['target_temperature_zone'],
                    p['owner_name'],
                    p['piece_code'],
                    f"层板{p['shelf_number']}",
                    p['clay_type'],
                    p['glaze_type'],
                    p['temperature_zone'],
                    p['payment_status'],
                    p.get('pickup_info', ''),
                    p.get('notes', '')
                ])
    
    return csv_path

def export_audit_package_to_json(batch_id, output_path=None):
    """导出审计包为JSON格式"""
    ensure_export_dir()
    
    batch = get_kiln_batch(batch_id)
    placements = get_batch_placements(batch_id)
    review_records = get_batch_review_records(batch_id)
    validation = validate_entire_batch(batch_id)
    
    if not batch:
        return None
    
    audit_package = {
        'export_time': datetime.now().isoformat(),
        'batch_info': batch,
        'placements': placements,
        'review_records': review_records,
        'validation_result': validation
    }
    
    if output_path:
        json_path = output_path
    else:
        filename = f'audit_package_{batch["batch_code"]}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        json_path = os.path.join(EXPORT_DIR, filename)
    
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(audit_package, f, ensure_ascii=False, indent=2)
    
    return json_path

def export_all(batch_id, markdown_path=None, csv_path=None, json_path=None):
    """批量导出所有格式"""
    results = {}
    
    try:
        md_file = export_kiln_list_to_markdown(batch_id, markdown_path)
        results['markdown'] = md_file
    except Exception as e:
        results['markdown_error'] = str(e)
    
    try:
        csv_file = export_pickup_list_to_csv(batch_id, csv_path)
        results['csv'] = csv_file
    except Exception as e:
        results['csv_error'] = str(e)
    
    try:
        json_file = export_audit_package_to_json(batch_id, json_path)
        results['json'] = json_file
    except Exception as e:
        results['json_error'] = str(e)
    
    return results
