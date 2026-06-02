import math
from .models import ParkingSpot


def _parse_time_period(period_str):
    if not period_str or "-" not in period_str:
        return None, None
    parts = period_str.split("-")
    if len(parts) != 2:
        return None, None
    try:
        return parts[0].strip(), parts[1].strip()
    except Exception:
        return None, None


def _time_ranges_overlap(start1, end1, start2, end2):
    try:
        return start1 < end2 and start2 < end1
    except Exception:
        return False


def _haversine_meters(lon1, lat1, lon2, lat2):
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


MERGE_DISTANCE_METERS = 50
COORDINATE_DRIFT_METERS = 30


def merge_parking_spots(existing, new_spots):
    merged = list(existing)
    merge_report = []

    for new_spot in new_spots:
        best_match = None
        best_dist = float("inf")
        best_idx = -1

        for idx, ex in enumerate(merged):
            if ex.路口名称 == new_spot.路口名称 and ex.小区名称 == new_spot.小区名称:
                dist = _haversine_meters(ex.经度, ex.纬度, new_spot.经度, new_spot.纬度)
                if dist < best_dist:
                    best_dist = dist
                    best_match = ex
                    best_idx = idx

        if best_match is None:
            merged.append(new_spot)
            merge_report.append({
                "动作": "新增",
                "点位id": new_spot.id,
                "路口名称": new_spot.路口名称,
                "说明": f"未找到匹配点位，新增记录。来源：{new_spot.来源详情}",
            })
        elif best_dist < MERGE_DISTANCE_METERS:
            if best_dist > COORDINATE_DRIFT_METERS:
                merge_report.append({
                    "动作": "坐标偏移合并",
                    "点位id": best_match.id,
                    "路口名称": best_match.路口名称,
                    "说明": (
                        f"与已有点位距离 {best_dist:.0f} 米（超过 {COORDINATE_DRIFT_METERS} 米偏移阈值），"
                        f"保留原坐标({best_match.经度},{best_match.纬度})，"
                        f"新坐标({new_spot.经度},{new_spot.纬度})记入来源详情"
                    ),
                })
                best_match.来源详情 += f"；坐标偏移记录({new_spot.经度},{new_spot.纬度})来自{new_spot.来源详情}"
            else:
                merge_report.append({
                    "动作": "合并",
                    "点位id": best_match.id,
                    "路口名称": best_match.路口名称,
                    "说明": f"与已有点位匹配（距离 {best_dist:.0f} 米），信息已补充。来源：{new_spot.来源详情}",
                })
            if new_spot.备注:
                best_match.备注 += f"；[补]{new_spot.备注}"
            best_match.来源详情 += f"；合并自{new_spot.来源详情}"
            if not best_match.数据时段 and new_spot.数据时段:
                best_match.数据时段 = new_spot.数据时段
            elif best_match.数据时段 and new_spot.数据时段 and best_match.数据时段 != new_spot.数据时段:
                best_match.数据时段 += f",{new_spot.数据时段}"
        else:
            merged.append(new_spot)
            merge_report.append({
                "动作": "同名远距新增",
                "点位id": new_spot.id,
                "路口名称": new_spot.路口名称,
                "说明": (
                    f"路口名称'{new_spot.路口名称}'与已有点位相同，但距离 {best_dist:.0f} 米"
                    f"（超过 {MERGE_DISTANCE_METERS} 米合并阈值），视为不同点位，单独新增"
                ),
            })

    return merged, merge_report


def detect_duplicate_complaints(spots):
    seen = {}
    duplicates = []
    for s in spots:
        key = (s.路口名称, s.小区名称, s.时段, round(s.经度, 4), round(s.纬度, 4))
        if key in seen:
            duplicates.append({
                "原记录id": seen[key].id,
                "重复记录id": s.id,
                "路口名称": s.路口名称,
                "说明": f"与记录 {seen[key].id} 的路口、小区、时段、坐标均相同，疑似重复投诉",
            })
        else:
            seen[key] = s
    return duplicates
