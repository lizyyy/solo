import pandas as pd
import json
import os
from datetime import datetime
from typing import Dict, List
from models import store
from config import PROCESSED_DATA_DIR

def export_inspections_to_excel(file_path: str = None) -> str:
    if not file_path:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        file_path = os.path.join(PROCESSED_DATA_DIR, f'inspections_{timestamp}.xlsx')
    
    data = []
    for insp in store.inspections:
        data.append({
            'ID': insp.id,
            '网格员姓名': insp.inspector_name,
            '巡查日期': insp.inspection_date,
            '巡查地点': insp.location,
            '经度': insp.lng,
            '纬度': insp.lat,
            '道路状况': insp.road_condition,
            '是否通行': '是' if insp.passable else '否',
            '障碍物': insp.obstacle,
            '巡查时间': insp.inspection_time,
            '备注': insp.remarks,
            '来源文件': insp.source_file,
            '导入时间': insp.import_time,
            '数据类型': insp.data_type
        })
    
    df = pd.DataFrame(data)
    df.to_excel(file_path, index=False)
    return file_path

def export_notices_to_excel(file_path: str = None) -> str:
    if not file_path:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        file_path = os.path.join(PROCESSED_DATA_DIR, f'notices_{timestamp}.xlsx')
    
    data = []
    for notice in store.notices:
        data.append({
            'ID': notice.id,
            '告示编号': notice.notice_no,
            '工程名称': notice.project_name,
            '施工单位': notice.construction_unit,
            '施工地点': notice.location,
            '经度': notice.lng,
            '纬度': notice.lat,
            '开始日期': notice.start_date,
            '结束日期': notice.end_date,
            '施工类型': notice.construction_type,
            '是否封路': '是' if notice.road_closure else '否',
            '影响范围': notice.affected_area,
            '备注': notice.remarks,
            '来源文件': notice.source_file,
            '导入时间': notice.import_time,
            '审核人': notice.reviewed_by,
            '审核时间': notice.review_time
        })
    
    df = pd.DataFrame(data)
    df.to_excel(file_path, index=False)
    return file_path

def export_heatmap_to_excel(file_path: str = None) -> str:
    if not file_path:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        file_path = os.path.join(PROCESSED_DATA_DIR, f'heatmap_{timestamp}.xlsx')
    
    data = []
    for heat in store.heatmaps:
        data.append({
            'ID': heat.id,
            '网格X': heat.grid_x,
            '网格Y': heat.grid_y,
            '经度': heat.lng,
            '纬度': heat.lat,
            '热力权重': heat.weight,
            '样本数量': heat.sample_count,
            '日期': heat.date,
            '晚间缺口': '是' if heat.has_evening_gap else '否',
            '需复核': '是' if heat.needs_review else '否',
            '复核人': heat.reviewed_by,
            '复核状态': heat.review_status
        })
    
    df = pd.DataFrame(data)
    df.to_excel(file_path, index=False)
    return file_path

def export_conflicts_to_excel(file_path: str = None) -> str:
    if not file_path:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        file_path = os.path.join(PROCESSED_DATA_DIR, f'conflicts_{timestamp}.xlsx')
    
    data = []
    for conflict in store.conflicts:
        data.append({
            'ID': conflict.id,
            '冲突类型': conflict.conflict_type,
            '描述': conflict.description,
            '地点': conflict.location,
            '状态': conflict.status,
            '巡查记录ID': conflict.inspection_id,
            '施工告示ID': conflict.notice_id,
            '创建时间': conflict.create_time,
            '处理人': conflict.resolved_by,
            '处理结果': conflict.resolution,
            '处理时间': conflict.resolve_time
        })
    
    df = pd.DataFrame(data)
    df.to_excel(file_path, index=False)
    return file_path

def export_full_report() -> Dict:
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    report_dir = os.path.join(PROCESSED_DATA_DIR, f'report_{timestamp}')
    os.makedirs(report_dir, exist_ok=True)
    
    files = {}
    
    files['inspections'] = export_inspections_to_excel(
        os.path.join(report_dir, 'inspections.xlsx'))
    files['notices'] = export_notices_to_excel(
        os.path.join(report_dir, 'notices.xlsx'))
    files['heatmap'] = export_heatmap_to_excel(
        os.path.join(report_dir, 'heatmap.xlsx'))
    files['conflicts'] = export_conflicts_to_excel(
        os.path.join(report_dir, 'conflicts.xlsx'))
    
    summary = {
        '生成时间': datetime.now().isoformat(),
        '巡查记录数': len(store.inspections),
        '施工告示数': len(store.notices),
        '热力图网格数': len(store.heatmaps),
        '冲突记录数': len(store.conflicts),
        '待处理冲突数': sum(1 for c in store.conflicts if c.status == 'pending'),
        '热力图待复核数': sum(1 for h in store.heatmaps if h.needs_review)
    }
    
    summary_path = os.path.join(report_dir, 'summary.json')
    with open(summary_path, 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    files['summary'] = summary_path
    
    return {
        'report_dir': report_dir,
        'files': files,
        'summary': summary
    }

def get_data_summary() -> Dict:
    return {
        'inspections_count': len(store.inspections),
        'notices_count': len(store.notices),
        'heatmap_count': len(store.heatmaps),
        'conflicts_count': len(store.conflicts),
        'pending_conflicts': sum(1 for c in store.conflicts if c.status == 'pending'),
        'heatmap_needs_review': sum(1 for h in store.heatmaps if h.needs_review),
        'import_records_count': len(store.import_records),
        'self_checks_count': len(store.self_checks)
    }
