"""
公园夜跑路线安全 - 地图导出模块

导出用于GIS/地图的数据，包含：
1. 标准GeoJSON格式（可直接导入地图工具）
2. 导出时标记 process_status = 'map_exported'
3. 边界点位待复核的会特别标注
"""
import csv
import json
import os
from datetime import datetime
from typing import List, Dict
from .database import get_connection, record_history
from .boundary_rules import PROCESS_STATUS_MAP_EXPORTED, BOUNDARY_REVIEW_PENDING


def export_to_geojson(output_path: str, include_pending_boundary: bool = True,
                      operator: str = '阿宁') -> Dict:
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
        rows = [dict(row) for row in cursor.fetchall()]

    features = []
    exported_ids = []
    for row in rows:
        exported_ids.append(row['id'])
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

    geojson = {
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
            "pending_review": sum(1 for f in features if f["properties"]["needs_review"])
        }
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)

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
                               PROCESS_STATUS_MAP_EXPORTED, "地图导出完成", operator)

    return {
        "success": True,
        "output_path": os.path.abspath(output_path),
        "total_exported": len(features),
        "boundary_points": geojson["summary"]["boundary_points"],
        "pending_review": geojson["summary"]["pending_review"]
    }


def export_to_csv(output_path: str, operator: str = '阿宁') -> Dict:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sampling_points ORDER BY id")
        rows = [dict(row) for row in cursor.fetchall()]

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

    return {
        "success": True,
        "output_path": os.path.abspath(output_path),
        "total_exported": len(rows)
    }


def generate_summary_report() -> Dict:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as cnt FROM sampling_points")
        total = cursor.fetchone()["cnt"]

        cursor.execute("""
        SELECT street_name, COUNT(*) as cnt
        FROM sampling_points
        WHERE street_name IS NOT NULL
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

    return {
        "total_points": total,
        "by_street": by_street,
        "boundary_stats": boundary_stats,
        "process_stats": process_stats
    }
