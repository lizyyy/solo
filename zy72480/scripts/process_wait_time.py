#!/usr/bin/env python3
import json
import os
import sys
from datetime import datetime

CONFIG_PATH = "config.json"

def load_config():
    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)

def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(data, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def step1_import_complaints(config, batch_file):
    print("=" * 60)
    print("【步骤1】居民投诉编号第一次导入")
    print("=" * 60)
    
    complaints = load_json(batch_file)
    history_records = []
    initial_points = []
    
    status_rules = config['data_rules']['status']
    source_types = config['data_rules']['source_types']
    
    for c in complaints:
        record = {
            "complaint_id": c['complaint_id'],
            "intersection_id": c['intersection_id'],
            "location": c['location'],
            "timestamp": datetime.now().isoformat(),
            "step": "import",
            "operator": config['operator'],
            "wait_time": c['reported_wait_time'],
            "source": source_types['complaint'],
            "raw_data": c
        }
        
        if not c.get('map_sync', True) and c.get('has_construction', False):
            record['status'] = status_rules['pending_review']
            record['note'] = "施工临时改道未同步到地图，待居民代表复核"
            print(f"  ⚠️  {c['complaint_id']} - {c['location']} - 状态: 待居民代表复核")
        else:
            record['status'] = status_rules['normal']
            print(f"  ✅ {c['complaint_id']} - {c['location']} - 状态: 正常")
        
        history_records.append(record)
        initial_points.append({
            "intersection_id": c['intersection_id'],
            "location": c['location'],
            "latest_wait_time": c['reported_wait_time'],
            "status": record['status'],
            "complaint_ids": [c['complaint_id']],
            "last_updated": datetime.now().isoformat()
        })
    
    history_path = os.path.join(config['paths']['history'], f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}_step1_import.json")
    points_path = os.path.join(config['paths']['points'], "points_list_initial.json")
    
    save_json(history_records, history_path)
    save_json(initial_points, points_path)
    
    print(f"\n  导入完成: {len(complaints)} 条记录")
    print(f"  历史记录已保存: {history_path}")
    print(f"  初始点位清单: {points_path}")
    
    return history_records, initial_points, history_path

def step2_review_photos(config, history_records, photo_file):
    print("\n" + "=" * 60)
    print("【步骤2】街道规划员小姜补看路口照片")
    print("=" * 60)
    
    photos = load_json(photo_file)
    photo_map = {p['complaint_id']: p for p in photos}
    updated_history = []
    
    for record in history_records:
        cid = record['complaint_id']
        if cid in photo_map:
            photo = photo_map[cid]
            new_record = record.copy()
            new_record['step'] = "photo_review"
            new_record['timestamp'] = datetime.now().isoformat()
            new_record['photo_id'] = photo['photo_id']
            new_record['photo_description'] = photo['description']
            new_record['photo_supplements'] = photo['supplements']
            new_record['source'] = config['data_rules']['source_types']['photo']
            
            if photo['supplements'].get('old_caliber_found', False):
                new_record['note'] = "发现旧口径记录，需补录修正"
                print(f"  📷 {cid} - 发现旧口径记录，准备补录")
            elif photo['supplements'].get('map_detour_missing', False):
                new_record['note'] = "照片确认施工改道未同步，维持待复核状态"
                print(f"  📷 {cid} - 照片确认施工改道，维持待复核")
            else:
                new_record['note'] = "照片核实无误"
                print(f"  📷 {cid} - 照片核实无误")
            
            updated_history.append(new_record)
        else:
            updated_history.append(record)
            print(f"  ℹ️  {record['complaint_id']} - 无对应照片")
    
    history_path = os.path.join(config['paths']['history'], f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}_step2_photos.json")
    save_json(updated_history, history_path)
    
    print(f"\n  照片补看完成")
    print(f"  历史记录已保存: {history_path}")
    
    return updated_history, history_path

def step3_update_points(config, history_records, current_points, correction_file=None):
    print("\n" + "=" * 60)
    print("【步骤3】点位清单更新")
    print("=" * 60)
    
    status_rules = config['data_rules']['status']
    points_map = {p['intersection_id']: p.copy() for p in current_points}
    
    if correction_file and os.path.exists(correction_file):
        correction = load_json(correction_file)
        target_id = correction['target_intersection_id']
        if target_id in points_map:
            point = points_map[target_id]
            point['latest_wait_time'] = correction['after_correction']['wait_time']
            point['old_caliber'] = {
                "wait_time": correction['after_correction']['old_caliber_wait_time'],
                "period": correction['after_correction']['old_caliber_period']
            }
            point['status'] = status_rules['supplemented']
            point['last_updated'] = datetime.now().isoformat()
            point['correction_id'] = correction['correction_id']
            
            print(f"  🔧 {target_id} - 已应用人工修正: 补充旧口径")
            
            correction_record = {
                "complaint_id": correction['target_complaint_id'],
                "intersection_id": target_id,
                "location": point['location'],
                "timestamp": datetime.now().isoformat(),
                "step": "manual_correction",
                "operator": correction['operator'],
                "correction_id": correction['correction_id'],
                "before": correction['before_correction'],
                "after": correction['after_correction'],
                "reason": correction['correction_reason'],
                "status": status_rules['supplemented'],
                "source": config['data_rules']['source_types']['manual']
            }
            history_records.append(correction_record)
    
    for record in history_records:
        iid = record['intersection_id']
        if iid in points_map:
            point = points_map[iid]
            if record['status'] == status_rules['pending_review']:
                point['status'] = status_rules['pending_review']
            if 'photo_id' in record:
                point['has_photos'] = True
            point['last_updated'] = record['timestamp']
    
    final_points = list(points_map.values())
    
    for p in final_points:
        status_icon = "✅" if p['status'] == status_rules['normal'] else ("⚠️" if p['status'] == status_rules['pending_review'] else "🔧")
        extra = ""
        if 'old_caliber' in p:
            extra = f" (旧口径:{p['old_caliber']['wait_time']}秒/{p['old_caliber']['period']})"
        print(f"  {status_icon} {p['intersection_id']} - {p['location']} - 等待时间:{p['latest_wait_time']}秒 - 状态:{p['status']}{extra}")
    
    points_path = os.path.join(config['paths']['points'], "points_list_final.json")
    history_path = os.path.join(config['paths']['history'], f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}_step3_final.json")
    
    save_json(final_points, points_path)
    save_json(history_records, history_path)
    
    print(f"\n  点位清单更新完成: {len(final_points)} 个点位")
    print(f"  最终点位清单: {points_path}")
    print(f"  完整历史记录: {history_path}")
    
    return final_points, history_records, points_path, history_path

def print_summary(history_records, final_points):
    print("\n" + "=" * 60)
    print("【处理结果汇总】")
    print("=" * 60)
    
    status_counts = {}
    for p in final_points:
        s = p['status']
        status_counts[s] = status_counts.get(s, 0) + 1
    
    for status, count in status_counts.items():
        print(f"  {status}: {count} 个点位")
    
    print(f"\n  历史操作记录: {len(history_records)} 条")
    
    print("\n  三种处理结果对比:")
    for p in final_points:
        print(f"\n  【{p['intersection_id']}】{p['location']}")
        print(f"    状态: {p['status']}")
        print(f"    等待时间: {p['latest_wait_time']}秒")
        if 'old_caliber' in p:
            print(f"    旧口径: {p['old_caliber']['wait_time']}秒 ({p['old_caliber']['period']})")
        for h in history_records:
            if h['intersection_id'] == p['intersection_id']:
                print(f"    - [{h['step']}] {h.get('note', h.get('reason', ''))}")

def main():
    if len(sys.argv) < 2:
        print("用法: python scripts/process_wait_time.py <投诉批次文件> [照片文件] [修正文件]")
        print("示例: python scripts/process_wait_time.py data/raw/complaints_batch_001.json data/photos/photo_records.json data/raw/manual_correction_001.json")
        sys.exit(1)
    
    batch_file = sys.argv[1]
    photo_file = sys.argv[2] if len(sys.argv) > 2 else None
    correction_file = sys.argv[3] if len(sys.argv) > 3 else None
    
    config = load_config()
    
    print(f"\n🏃 开始处理: 老年人过街等待时间分析")
    print(f"📅 运行时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"👤 操作员: {config['operator']}")
    
    history_records, initial_points, hist1 = step1_import_complaints(config, batch_file)
    
    if photo_file:
        history_records, hist2 = step2_review_photos(config, history_records, photo_file)
    else:
        print("\n  ℹ️  跳过照片补看步骤（未提供照片文件）")
        hist2 = None
    
    final_points, history_records, points_path, hist3 = step3_update_points(
        config, history_records, initial_points, correction_file
    )
    
    print_summary(history_records, final_points)
    
    print("\n" + "=" * 60)
    print("【可重跑命令】")
    print("=" * 60)
    cmd = f"python scripts/process_wait_time.py {batch_file}"
    if photo_file:
        cmd += f" {photo_file}"
    if correction_file:
        cmd += f" {correction_file}"
    print(f"  {cmd}")
    print()
    print("【产出文件】")
    print(f"  点位清单: {points_path}")
    print(f"  历史记录: {hist3}")
    print()

if __name__ == "__main__":
    main()
