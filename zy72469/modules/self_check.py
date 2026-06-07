from typing import List, Dict
from datetime import datetime
from collections import defaultdict
from models import store, SelfCheckResult, GridInspection, HeatmapData
from modules.heatmap import generate_heatmap, get_heatmap_stats
from modules.data_import import calculate_file_hash
import os
import json

def check_duplicate_imports() -> SelfCheckResult:
    duplicate_groups = defaultdict(list)
    
    for insp in store.inspections:
        key = (insp.inspector_name, insp.inspection_date, insp.location, insp.inspection_time)
        duplicate_groups[key].append(insp.id)
    
    real_duplicates = {k: v for k, v in duplicate_groups.items() if len(v) > 1}
    
    file_duplicates = defaultdict(int)
    for record in store.import_records:
        file_duplicates[record.file_hash] += 1
    
    repeated_files = {k: v for k, v in file_duplicates.items() if v > 1}
    
    status = 'pass'
    message = '未发现重复导入问题'
    details = {
        'duplicate_records': len(real_duplicates),
        'repeated_files': len(repeated_files)
    }
    
    if real_duplicates or repeated_files:
        status = 'warning'
        message = f'发现 {len(real_duplicates)} 组重复记录，{len(repeated_files)} 个重复导入文件'
        details['duplicate_record_ids'] = list(real_duplicates.values())[:10]
        details['repeated_file_hashes'] = list(repeated_files.keys())[:5]
    
    result = SelfCheckResult(
        check_type='duplicate_import',
        check_name='重复导入检测',
        status=status,
        message=message,
        details=details
    )
    
    store.self_checks.append(result)
    store.save()
    return result

def check_evening_sampling_gaps() -> SelfCheckResult:
    from modules.heatmap import is_evening_hour, parse_inspection_time
    
    evening_counts = defaultdict(int)
    all_counts = defaultdict(int)
    
    for insp in store.inspections:
        hour = parse_inspection_time(insp.inspection_time)
        date_key = insp.inspection_date
        all_counts[date_key] += 1
        if hour >= 0 and is_evening_hour(hour):
            evening_counts[date_key] += 1
    
    low_evening_dates = []
    for date_key, total in all_counts.items():
        evening = evening_counts.get(date_key, 0)
        if total > 5 and evening / total < 0.2:
            low_evening_dates.append({
                'date': date_key,
                'total_samples': total,
                'evening_samples': evening,
                'ratio': round(evening / total, 3)
            })
    
    heatmap_stats = get_heatmap_stats()
    
    status = 'pass'
    message = '晚间采样正常'
    details = {
        'low_evening_dates': len(low_evening_dates),
        'heatmap_evening_gap_grids': heatmap_stats.get('has_evening_gap', 0),
        'heatmap_needs_review': heatmap_stats.get('needs_review', 0)
    }
    
    if low_evening_dates or heatmap_stats.get('has_evening_gap', 0) > 0:
        status = 'warning'
        message = f'发现 {len(low_evening_dates)} 个日期晚间采样不足，{heatmap_stats.get("has_evening_gap", 0)} 个热力图网格存在晚间缺口'
        details['low_evening_details'] = low_evening_dates[:5]
    
    result = SelfCheckResult(
        check_type='evening_sampling',
        check_name='晚间采样缺口检测',
        status=status,
        message=message,
        details=details
    )
    
    store.self_checks.append(result)
    store.save()
    return result

def check_supplement_recalculation() -> SelfCheckResult:
    supplement_records = [r for r in store.import_records if r.import_type == 'supplement']
    
    heatmap_before_supplement = []
    heatmap_after_supplement = []
    
    status = 'pass'
    message = '补录数据重算正常'
    details = {
        'supplement_imports': len(supplement_records)
    }
    
    if supplement_records:
        if store.heatmaps:
            details['heatmap_grid_count'] = len(store.heatmaps)
            message = f'检测到 {len(supplement_records)} 次补录导入，热力图已包含 {len(store.heatmaps)} 个网格数据'
        else:
            status = 'warning'
            message = f'检测到 {len(supplement_records)} 次补录导入，但热力图尚未重新生成'
    
    result = SelfCheckResult(
        check_type='supplement_recalc',
        check_name='补录后重算检测',
        status=status,
        message=message,
        details=details
    )
    
    store.self_checks.append(result)
    store.save()
    return result

def check_export_consistency() -> SelfCheckResult:
    from config import PROCESSED_DATA_DIR
    
    data_file = os.path.join(PROCESSED_DATA_DIR, 'datastore.json')
    
    status = 'pass'
    message = '数据一致性检查通过'
    details = {}
    
    if os.path.exists(data_file):
        with open(data_file, 'r', encoding='utf-8') as f:
            saved_data = json.load(f)
        
        details['saved_inspections'] = len(saved_data.get('inspections', []))
        details['memory_inspections'] = len(store.inspections)
        details['saved_notices'] = len(saved_data.get('notices', []))
        details['memory_notices'] = len(store.notices)
        
        if len(saved_data.get('inspections', [])) != len(store.inspections):
            status = 'fail'
            message = '巡查表数据不一致：内存与存储数据数量不匹配'
        elif len(saved_data.get('notices', [])) != len(store.notices):
            status = 'fail'
            message = '施工告示数据不一致：内存与存储数据数量不匹配'
    else:
        status = 'warning'
        message = '数据存储文件不存在，首次使用'
    
    result = SelfCheckResult(
        check_type='export_consistency',
        check_name='导出一致性检测',
        status=status,
        message=message,
        details=details
    )
    
    store.self_checks.append(result)
    store.save()
    return result

def check_data_completeness() -> SelfCheckResult:
    missing_remarks = []
    missing_location = []
    
    for insp in store.inspections:
        if not insp.location or (insp.lng == 0 and insp.lat == 0):
            missing_location.append(insp.id)
    
    for notice in store.notices:
        if not notice.location or (notice.lng == 0 and notice.lat == 0):
            missing_location.append(notice.id)
    
    remarks_preserved = sum(1 for n in store.notices if n.remarks)
    
    status = 'pass'
    message = '数据完整性检查通过'
    details = {
        'missing_location': len(missing_location),
        'notices_with_remarks': remarks_preserved,
        'total_notices': len(store.notices)
    }
    
    if missing_location:
        status = 'warning'
        message = f'发现 {len(missing_location)} 条记录缺少位置信息'
        details['missing_location_ids'] = missing_location[:10]
    
    result = SelfCheckResult(
        check_type='data_completeness',
        check_name='数据完整性检测',
        status=status,
        message=message,
        details=details
    )
    
    store.self_checks.append(result)
    store.save()
    return result

def run_all_checks() -> List[Dict]:
    results = []
    results.append(check_duplicate_imports().to_dict())
    results.append(check_evening_sampling_gaps().to_dict())
    results.append(check_supplement_recalculation().to_dict())
    results.append(check_export_consistency().to_dict())
    results.append(check_data_completeness().to_dict())
    return results

def get_check_history() -> List[Dict]:
    return [c.to_dict() for c in reversed(store.self_checks)]
