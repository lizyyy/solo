"""
公园夜跑路线安全 - 统一导出模块

GeoJSON 和 CSV 放在同一条导出链路里：
1. 一次性从数据库读取当前最新状态
2. 同时生成 GeoJSON 和 CSV，保证数据一致
3. 统一更新 process_status = 'map_exported'
4. 返回结果包含两种格式的路径和校验数据
"""
import csv
import json
import os
from datetime import datetime
from typing import List, Dict, Tuple
from .database import get_connection, record_history
from .boundary_rules import PROCESS_STATUS_MAP_EXPORTED, BOUNDARY_REVIEW_PENDING


def _read_current_points(include_pending_boundary: bool = True) -> List[Dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        if include_pending_boundary:
            cursor.execute("SELECT * FROM sampling_points ORDER BY id")
        else:
            cursor.execute("""
            SELECT * FROM sampling_points
            WHERE boundary_review_status != 'pending' OR is_boundary = 0
            ORDER BY id
            """)
        return [dict(row) for row in cursor.fetchall()]


def _update_process_status(exported_ids: List[int], operator: str = '阿宁'):
    with get_connection() as conn:
        for pid in exported_ids:
            cursor = conn.cursor()
            cursor.execute("SELECT process_status FROM sampling_points WHERE id = ?", (pid,))
            old = cursor.fetchone()
            if old and old["process_status"] != PROCESS_STATUS_MAP_EXPORTED:
                cursor.execute("""
                UPDATE sampling_points
                SET process_status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """, (PROCESS_STATUS_MAP_EXPORTED, pid))
                record_history(conn, pid, "process_status", old["process_status"],
                               PROCESS_STATUS_MAP_EXPORTED, "统一导出完成(GeoJSON+CSV)", operator)


def _build_geojson(rows: List[Dict], operator: str) -> Dict:
    features = []
    for row in rows:
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [row["longitude"], row["latitude"]]
            },
            "properties": {
                "id": row["id"],
                "point_code": row["point_code"],
                "original_row": row["original_row_number"],
                "street_name": row["street_name"],
                "second_street": row["second_street_name"],
                "is_boundary": bool(row["is_boundary"]),
                "boundary_status": row["boundary_review_status"],
                "safety_level": row["safety_level"],
                "lighting": row["lighting_condition"],
                "complaint_codes": row["complaint_codes"],
                "remark": row["remark"],
                "process_status": row["process_status"],
                "needs_review": row["is_boundary"] == 1 and row["boundary_review_status"] == BOUNDARY_REVIEW_PENDING
            }
        }
        features.append(feature)

    return {
        "type": "FeatureCollection",
        "name": "公园夜跑路线安全_夜间采样点",
        "export_time": datetime.now().isoformat(),
        "export_by": operator,
        "crs": {
            "type": "name",
            "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}
        },
        "features": features,
        "summary": {
            "total": len(features),
            "boundary_points": sum(1 for f in features if f["properties"]["is_boundary"]),
            "pending_review": sum(1 for f in features if f["properties"]["needs_review"]),
            "empty_streets": sum(1 for f in features if not f["properties"]["street_name"])
        }
    }


def _write_geojson(geojson: Dict, output_path: str):
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)


def _write_csv(rows: List[Dict], output_path: str):
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    fieldnames = [
        "id", "point_code", "original_row_number", "longitude", "latitude",
        "street_name", "second_street_name", "is_boundary", "boundary_review_status",
        "safety_level", "lighting_condition", "complaint_codes", "remark",
        "process_status", "created_at", "updated_at"
    ]
    with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k, '') for k in fieldnames})


def export_all(geojson_path: str, csv_path: str,
               include_pending_boundary: bool = True,
               operator: str = '阿宁') -> Dict:
    rows = _read_current_points(include_pending_boundary)

    exported_ids = [r['id'] for r in rows]

    geojson = _build_geojson(rows, operator)
    _write_geojson(geojson, geojson_path)

    _write_csv(rows, csv_path)

    _update_process_status(exported_ids, operator)

    csv_empty_streets = [r for r in rows if not r.get('street_name')]

    return {
        "success": True,
        "geojson_path": os.path.abspath(geojson_path),
        "csv_path": os.path.abspath(csv_path),
        "total_exported": len(rows),
        "boundary_points": geojson["summary"]["boundary_points"],
        "pending_review": geojson["summary"]["pending_review"],
        "geojson_empty_streets": geojson["summary"]["empty_streets"],
        "csv_empty_streets": len(csv_empty_streets),
        "data_snapshot": [{
            "id": r["id"],
            "remark": r["remark"],
            "street_name": r["street_name"],
            "boundary_review_status": r["boundary_review_status"],
            "process_status": r["process_status"],
            "is_boundary": r["is_boundary"],
        } for r in rows]
    }


def generate_summary_report() -> Dict:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as cnt FROM sampling_points")
        total = cursor.fetchone()["cnt"]

        cursor.execute("""
        SELECT street_name, COUNT(*) as cnt
        FROM sampling_points
        WHERE street_name IS NOT NULL AND street_name != ''
        GROUP BY street_name
        ORDER BY cnt DESC
        """)
        by_street = [dict(row) for row in cursor.fetchall()]

        cursor.execute("""
        SELECT is_boundary, boundary_review_status, COUNT(*) as cnt
        FROM sampling_points
        GROUP BY is_boundary, boundary_review_status
        """)
        boundary_stats = [dict(row) for row in cursor.fetchall()]

        cursor.execute("""
        SELECT process_status, COUNT(*) as cnt
        FROM sampling_points
        GROUP BY process_status
        """)
        process_stats = [dict(row) for row in cursor.fetchall()]

        cursor.execute("""
        SELECT COUNT(*) as cnt FROM sampling_points
        WHERE street_name IS NULL OR street_name = ''
        """)
        empty_street_count = cursor.fetchone()["cnt"]

    return {
        "total_points": total,
        "empty_street_count": empty_street_count,
        "by_street": by_street,
        "boundary_stats": boundary_stats,
        "process_stats": process_stats
    }


def export_to_geojson(output_path: str, include_pending_boundary: bool = True,
                      operator: str = '阿宁') -> Dict:
    rows = _read_current_points(include_pending_boundary)
    exported_ids = [r['id'] for r in rows]
    geojson = _build_geojson(rows, operator)
    _write_geojson(geojson, output_path)
    _update_process_status(exported_ids, operator)
    return {
        "success": True,
        "output_path": os.path.abspath(output_path),
        "total_exported": len(rows),
        "boundary_points": geojson["summary"]["boundary_points"],
        "pending_review": geojson["summary"]["pending_review"],
        "empty_streets": geojson["summary"]["empty_streets"]
    }


def export_to_csv(output_path: str, operator: str = '阿宁') -> Dict:
    rows = _read_current_points(include_pending_boundary=True)
    _write_csv(rows, output_path)
    empty_streets = [r for r in rows if not r.get('street_name')]
    return {
        "success": True,
        "output_path": os.path.abspath(output_path),
        "total_exported": len(rows),
        "empty_streets": len(empty_streets)
    }
