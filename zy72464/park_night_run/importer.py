"""
公园夜跑路线安全 - 采样点导入去重模块

去重规则：
1. 同一批数据用 batch_hash 标识，重复导入同一文件直接跳过
2. 单个采样点用 point_code 作为唯一键，已存在则更新而非新增
3. 导入时保留 original_row_number（原始Excel行号）
"""
import hashlib
import csv
import json
from typing import List, Dict, Any, Tuple
from .database import get_connection, record_history
from .boundary_rules import check_boundary_status, PROCESS_STATUS_INITIAL


def compute_batch_hash(rows: List[Dict]) -> str:
    content = json.dumps(rows, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(content.encode('utf-8')).hexdigest()


def generate_point_code(lng: float, lat: float, row_num: int) -> str:
    return f"P{abs(hash((lng, lat, row_num))) % 1000000:06d}"


def import_sampling_points(csv_path: str, operator: str = '阿宁') -> Dict:
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        rows = []
        for i, row in enumerate(reader, start=2):
            row['_original_row'] = i
            rows.append(row)

    batch_hash = compute_batch_hash(rows)
    file_name = csv_path.split('/')[-1]

    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM import_batches WHERE batch_hash = ?", (batch_hash,))
        existing = cursor.fetchone()
        if existing:
            return {
                "success": True,
                "skipped": True,
                "message": f"该批次数据已导入过(批次ID:{existing['id']})，跳过避免数量翻倍",
                "batch_id": existing['id'],
                "inserted": 0,
                "updated": 0
            }

        cursor.execute("""
        INSERT INTO import_batches (batch_hash, file_name, record_count, operator)
        VALUES (?, ?, ?, ?)
        """, (batch_hash, file_name, len(rows), operator))
        batch_id = cursor.lastrowid

        inserted = 0
        updated = 0

        for row in rows:
            original_row = row['_original_row']
            try:
                lng = float(row.get('longitude') or row.get('经度') or 0)
                lat = float(row.get('latitude') or row.get('纬度') or 0)
            except (ValueError, TypeError):
                continue

            point_code = row.get('point_code') or row.get('点位编号') or generate_point_code(lng, lat, original_row)
            boundary_info = check_boundary_status(lng, lat)

            lighting = row.get('lighting') or row.get('照明情况') or ''
            safety = row.get('safety_level') or row.get('安全等级') or 'unknown'
            remark = row.get('remark') or row.get('备注') or ''
            complaint = row.get('complaint_codes') or row.get('投诉编号') or ''

            cursor.execute("SELECT id FROM sampling_points WHERE point_code = ?", (point_code,))
            existing_point = cursor.fetchone()

            if existing_point:
                point_id = existing_point['id']
                cursor.execute("SELECT * FROM sampling_points WHERE id = ?", (point_id,))
                old = cursor.fetchone()

                updates = []
                params = []
                if old['lighting_condition'] != lighting:
                    updates.append("lighting_condition = ?")
                    params.append(lighting)
                    record_history(conn, point_id, "lighting_condition",
                                   old['lighting_condition'], lighting, "重新导入更新", operator)
                if old['safety_level'] != safety:
                    updates.append("safety_level = ?")
                    params.append(safety)
                    record_history(conn, point_id, "safety_level",
                                   old['safety_level'], safety, "重新导入更新", operator)
                if old['remark'] != remark:
                    updates.append("remark = ?")
                    params.append(remark)
                    record_history(conn, point_id, "remark",
                                   old['remark'], remark, "重新导入更新", operator)

                if updates:
                    updates.append("updated_at = CURRENT_TIMESTAMP")
                    params.append(point_id)
                    cursor.execute(f"UPDATE sampling_points SET {', '.join(updates)} WHERE id = ?", params)
                    updated += 1
            else:
                cursor.execute("""
                INSERT INTO sampling_points (
                    original_row_number, batch_id, point_code, longitude, latitude,
                    street_name, second_street_name, is_boundary, boundary_review_status,
                    safety_level, lighting_condition, complaint_codes, remark, process_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    original_row, batch_id, point_code, lng, lat,
                    boundary_info["street_name"], boundary_info["second_street_name"],
                    boundary_info["is_boundary"], boundary_info["boundary_review_status"],
                    safety, lighting, complaint, remark, PROCESS_STATUS_INITIAL
                ))
                inserted += 1

        cursor.execute("UPDATE import_batches SET record_count = ? WHERE id = ?", (inserted + updated, batch_id))

        return {
            "success": True,
            "skipped": False,
            "batch_id": batch_id,
            "inserted": inserted,
            "updated": updated,
            "message": f"导入完成: 新增{inserted}条, 更新{updated}条"
        }


def update_complaint_codes(point_id: int, complaint_codes: str, operator: str = '阿宁') -> Dict:
    from .boundary_rules import PROCESS_STATUS_COMPLAINT_ADDED
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sampling_points WHERE id = ?", (point_id,))
        row = cursor.fetchone()
        if not row:
            return {"success": False, "message": "点位不存在"}

        old_complaint = row["complaint_codes"]
        old_status = row["process_status"]

        new_status = PROCESS_STATUS_COMPLAINT_ADDED if old_status == PROCESS_STATUS_INITIAL else old_status

        cursor.execute("""
        UPDATE sampling_points
        SET complaint_codes = ?, process_status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """, (complaint_codes, new_status, point_id))

        record_history(conn, point_id, "complaint_codes", old_complaint, complaint_codes,
                       "补录居民投诉编号", operator)
        if old_status != new_status:
            record_history(conn, point_id, "process_status", old_status, new_status,
                           "完成投诉编号补录", operator)

        return {"success": True, "message": f"点位{point_id}投诉编号已更新",
                "old": old_complaint, "new": complaint_codes}


def get_all_points() -> List[Dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sampling_points ORDER BY id")
        return [dict(row) for row in cursor.fetchall()]


def get_point_by_id(point_id: int) -> Dict:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sampling_points WHERE id = ?", (point_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
