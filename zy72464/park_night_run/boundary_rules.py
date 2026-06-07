"""
公园夜跑路线安全 - 街道边界规则引擎

边界规则定义（写在代码里，不是口头约定）：
1. BOUNDARY_THRESHOLD_METERS: 距离街道边界多少米内算边界点位
2. 点位同时落在两个街道边界范围内 → 标记 is_boundary=1
3. 边界点位默认 boundary_review_status='pending'，留给项目经理复核
4. 复核通过后才能设为 'confirmed'，否则 'rejected' 可回滚
"""
import math
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass

BOUNDARY_THRESHOLD_METERS = 50.0

BOUNDARY_REVIEW_PENDING = 'pending'
BOUNDARY_REVIEW_CONFIRMED = 'confirmed'
BOUNDARY_REVIEW_REJECTED = 'rejected'

PROCESS_STATUS_INITIAL = 'initial'
PROCESS_STATUS_COMPLAINT_ADDED = 'complaint_added'
PROCESS_STATUS_MAP_EXPORTED = 'map_exported'
PROCESS_STATUS_BOUNDARY_REVIEW = 'boundary_review'


@dataclass
class StreetArea:
    name: str
    center_lng: float
    center_lat: float
    radius_meters: float


STREET_AREAS: Dict[str, StreetArea] = {
    "望京街道": StreetArea("望京街道", 116.4700, 39.9900, 3500),
    "东湖街道": StreetArea("东湖街道", 116.4850, 39.9950, 3000),
    "花家地街道": StreetArea("花家地街道", 116.4600, 39.9800, 3000),
    "大屯街道": StreetArea("大屯街道", 116.4200, 40.0000, 4000),
}


def haversine_distance(lng1: float, lat1: float, lng2: float, lat2: float) -> float:
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)
    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def find_nearby_streets(lng: float, lat: float, threshold_meters: float = BOUNDARY_THRESHOLD_METERS) -> List[Tuple[str, float]]:
    results = []
    for street_name, area in STREET_AREAS.items():
        dist = haversine_distance(lng, lat, area.center_lng, area.center_lat)
        if dist <= area.radius_meters + threshold_meters:
            results.append((street_name, dist))
    results.sort(key=lambda x: x[1])
    return results


def check_boundary_status(lng: float, lat: float) -> Dict:
    streets = find_nearby_streets(lng, lat)
    is_boundary = 0
    primary_street = None
    secondary_street = None
    review_status = BOUNDARY_REVIEW_PENDING

    if len(streets) >= 2:
        dist1 = streets[0][1]
        dist2 = streets[1][1]
        if abs(dist1 - dist2) <= BOUNDARY_THRESHOLD_METERS * 2:
            is_boundary = 1
            primary_street = streets[0][0]
            secondary_street = streets[1][0]
            review_status = BOUNDARY_REVIEW_PENDING
    elif len(streets) == 1:
        primary_street = streets[0][0]
        review_status = BOUNDARY_REVIEW_CONFIRMED
    else:
        primary_street = "未知街道"
        review_status = BOUNDARY_REVIEW_PENDING

    return {
        "is_boundary": is_boundary,
        "street_name": primary_street,
        "second_street_name": secondary_street,
        "boundary_review_status": review_status,
        "nearby_streets": streets,
    }


def confirm_boundary_point(point_id: int, final_street: str, operator: str = '阿宁') -> Dict:
    from .database import get_connection, record_history
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sampling_points WHERE id = ?", (point_id,))
        row = cursor.fetchone()
        if not row:
            return {"success": False, "message": "点位不存在"}

        old_street = row["street_name"]
        old_second = row["second_street_name"]
        old_status = row["boundary_review_status"]

        cursor.execute("""
        UPDATE sampling_points
        SET street_name = ?, second_street_name = ?, boundary_review_status = ?,
            process_status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """, (final_street, None, BOUNDARY_REVIEW_CONFIRMED, PROCESS_STATUS_BOUNDARY_REVIEW, point_id))

        record_history(conn, point_id, "street_name", old_street, final_street,
                       "边界复核确认归属街道", operator)
        record_history(conn, point_id, "second_street_name", old_second, None,
                       "边界复核确认归属街道", operator)
        record_history(conn, point_id, "boundary_review_status", old_status, BOUNDARY_REVIEW_CONFIRMED,
                       "项目经理复核通过", operator)
        record_history(conn, point_id, "process_status", row["process_status"], PROCESS_STATUS_BOUNDARY_REVIEW,
                       "完成边界复核", operator)

        return {"success": True, "message": f"点位{point_id}已确认归属{final_street}"}


def reject_boundary_point(point_id: int, reason: str, operator: str = '阿宁') -> Dict:
    from .database import get_connection, record_history
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sampling_points WHERE id = ?", (point_id,))
        row = cursor.fetchone()
        if not row:
            return {"success": False, "message": "点位不存在"}

        old_status = row["boundary_review_status"]
        cursor.execute("""
        UPDATE sampling_points
        SET boundary_review_status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """, (BOUNDARY_REVIEW_REJECTED, point_id))

        record_history(conn, point_id, "boundary_review_status", old_status, BOUNDARY_REVIEW_REJECTED,
                       f"边界复核驳回: {reason}", operator)

        return {"success": True, "message": f"点位{point_id}已驳回，原因: {reason}"}


def rollback_point(point_id: int, history_id: int, reason: str, operator: str = '阿宁') -> Dict:
    from .database import get_connection, record_history
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM point_history WHERE id = ? AND point_id = ?", (history_id, point_id))
        hist = cursor.fetchone()
        if not hist:
            return {"success": False, "message": "历史记录不存在"}

        field_name = hist["field_name"]
        rollback_value = hist["old_value"]

        cursor.execute(f"SELECT {field_name} FROM sampling_points WHERE id = ?", (point_id,))
        current_row = cursor.fetchone()
        current_value = str(current_row[0]) if current_row and current_row[0] is not None else None

        cursor.execute(f"""
        UPDATE sampling_points SET {field_name} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        """, (rollback_value, point_id))

        record_history(conn, point_id, field_name, current_value, rollback_value,
                       f"回滚至历史版本, 原因: {reason}", operator)

        cursor.execute("""
        INSERT INTO rollback_log (point_id, history_ids, rollback_by, rollback_reason)
        VALUES (?, ?, ?, ?)
        """, (point_id, str(history_id), operator, reason))

        return {"success": True, "message": f"已回滚字段[{field_name}]至值: {rollback_value}"}


def get_pending_boundary_points() -> List[Dict]:
    from .database import get_connection
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT id, point_code, longitude, latitude, street_name, second_street_name,
               original_row_number, process_status
        FROM sampling_points
        WHERE is_boundary = 1 AND boundary_review_status = 'pending'
        ORDER BY id
        """)
        return [dict(row) for row in cursor.fetchall()]
