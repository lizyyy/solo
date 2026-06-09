"""
去重导入模块（幂等性）
- 正常记录重复导入不翻倍
- 人工备注不被覆盖
- 使用 import_state.json 记录已导入键
"""
import csv
import json
import os
import shutil
from datetime import datetime

STATE_PATH = "output/import_state.json"
MANUAL_NOTES_MERGED = "output/attribution_with_notes.csv"

NOTE_FIELDS = ["manual_note_content", "manual_note_author", "manual_note_time"]
PROTECTED_FIELDS = NOTE_FIELDS + ["manual_review_flag", "manual_adjusted_confidence"]

def _load_state():
    if not os.path.exists(STATE_PATH):
        return {"imported_photo_hashes": {}, "imported_attr_ids": {}, "manual_notes": {}}
    try:
        with open(STATE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"imported_photo_hashes": {}, "imported_attr_ids": {}, "manual_notes": {}}

def _save_state(state):
    os.makedirs(os.path.dirname(STATE_PATH), exist_ok=True)
    with open(STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

def load_csv(pth):
    if not os.path.exists(pth):
        return []
    with open(pth, "r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

def write_csv(pth, rows, fieldnames=None):
    if not rows:
        return
    fn = fieldnames or list(rows[0].keys())
    with open(pth, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fn)
        w.writeheader()
        w.writerows(rows)

def dedup_import_normalized_photos(new_csv_path, target_csv_path):
    """
    导入标准化维修照片：
    - 按 row_hash 去重，已存在的行跳过（不翻倍）
    - 返回 (新增条数, 跳过重条数)
    """
    state = _load_state()
    new_rows = load_csv(new_csv_path)
    existing_rows = load_csv(target_csv_path)
    
    existing_by_hash = {r.get("row_hash", ""): r for r in existing_rows if r.get("row_hash")}
    added = 0
    skipped = 0
    
    for r in new_rows:
        h = r.get("row_hash", "")
        if not h:
            continue
        if h in existing_by_hash or h in state["imported_photo_hashes"]:
            skipped += 1
            continue
        existing_by_hash[h] = r
        state["imported_photo_hashes"][h] = {
            "photo_id": r.get("photo_id", ""),
            "imported_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        added += 1
    
    merged = list(existing_by_hash.values())
    if merged:
        write_csv(target_csv_path, merged, list(merged[0].keys()))
    
    _save_state(state)
    return added, skipped

def merge_manual_notes(notes_csv_path, attribution_csv_path, output_path):
    """
    把人工备注合并到归因结果：
    - key = 关联照片编号
    - 若归因结果行已有关联照片且该照片已有备注，则合并
    - 若归因结果中 NOTE_FIELDS 已被人工填过，不覆盖
    """
    notes = load_csv(notes_csv_path)
    attrs = load_csv(attribution_csv_path)
    state = _load_state()
    
    notes_map = {}
    for n in notes:
        pid = n.get("关联照片编号", "").strip()
        if pid:
            notes_map[pid] = n
    
    for pid, n in notes_map.items():
        if pid not in state["manual_notes"]:
            state["manual_notes"][pid] = {
                "content": n.get("备注内容", ""),
                "author": n.get("备注人", ""),
                "time": n.get("备注时间", "")
            }
    
    out_rows = []
    merged_note_count = 0
    preserved_count = 0
    
    for a in attrs:
        row = dict(a)
        existing_note_content = row.get("manual_note_content", "") or state.get("_temp_preserve", {}).get(row.get("attribution_id", ""), {}).get("manual_note_content", "")
        if existing_note_content and existing_note_content.strip():
            preserved_count += 1
        else:
            photo_ids = (row.get("linked_photo_ids") or "").split(",")
            for pid in photo_ids:
                pid = pid.strip()
                if pid in state["manual_notes"]:
                    nd = state["manual_notes"][pid]
                    row["manual_note_content"] = nd.get("content", "")
                    row["manual_note_author"] = nd.get("author", "")
                    row["manual_note_time"] = nd.get("time", "")
                    merged_note_count += 1
                    break
        
        for f in NOTE_FIELDS:
            if f not in row:
                row[f] = ""
        out_rows.append(row)
    
    fn = list(out_rows[0].keys()) if out_rows else []
    write_csv(output_path, out_rows, fn)
    _save_state(state)
    return merged_note_count, preserved_count

def dedup_import_attribution(new_attr_csv, target_attr_csv):
    """
    导入归因结果：
    - 按 attribution_id 去重
    - PROTECTED_FIELDS 如果目标行里有值就不覆盖
    """
    state = _load_state()
    new_rows = load_csv(new_attr_csv)
    old_rows = load_csv(target_attr_csv)
    
    old_by_id = {r.get("attribution_id", ""): r for r in old_rows if r.get("attribution_id")}
    
    added = 0
    updated = 0
    preserved = 0
    
    for nr in new_rows:
        aid = nr.get("attribution_id", "")
        if not aid:
            continue
        if aid in old_by_id:
            old_r = old_by_id[aid]
            merged_r = dict(nr)
            for pf in PROTECTED_FIELDS:
                old_val = old_r.get(pf, "") or ""
                if old_val.strip():
                    merged_r[pf] = old_val
                    preserved += 1
            old_by_id[aid] = merged_r
            updated += 1
        else:
            old_by_id[aid] = nr
            state["imported_attr_ids"][aid] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            added += 1
    
    merged = list(old_by_id.values())
    if merged:
        write_csv(target_attr_csv, merged, list(merged[0].keys()))
    
    _save_state(state)
    return added, updated, preserved

if __name__ == "__main__":
    print("--- 模块自测 ---")
    state = _load_state()
    print(f"初始状态: 已导入照片hash={len(state['imported_photo_hashes'])}")
