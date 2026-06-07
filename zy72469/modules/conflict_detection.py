from typing import List, Dict, Tuple
from datetime import datetime, date
from models import store, GridInspection, ConstructionNotice, ConflictRecord
from geopy.distance import geodesic

DISTANCE_THRESHOLD = 100

def is_location_close(lat1: float, lng1: float, lat2: float, lng2: float) -> bool:
    if lat1 == 0 or lng1 == 0 or lat2 == 0 or lng2 == 0:
        return False
    try:
        dist = geodesic((lat1, lng1), (lat2, lng2)).meters
        return dist <= DISTANCE_THRESHOLD
    except:
        return False

def is_date_in_range(inspection_date: str, start_date: str, end_date: str) -> bool:
    try:
        insp_date = datetime.strptime(inspection_date, '%Y-%m-%d').date()
        s_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        e_date = datetime.strptime(end_date, '%Y-%m-%d').date()
        return s_date <= insp_date <= e_date
    except:
        return False

def detect_passable_conflict(inspection: GridInspection, 
                             notice: ConstructionNotice) -> Tuple[bool, str]:
    if not is_location_close(inspection.lat, inspection.lng, notice.lat, notice.lng):
        return False, ""
    
    if notice.road_closure and inspection.passable:
        if is_date_in_range(inspection.inspection_date, notice.start_date, notice.end_date):
            desc = (f"地点 [{inspection.location}] 冲突：施工告示显示封路 "
                   f"({notice.start_date} ~ {notice.end_date})，但巡查表显示可通行")
            return True, desc
    return False, ""

def detect_road_condition_conflict(inspection: GridInspection,
                                    notice: ConstructionNotice) -> Tuple[bool, str]:
    if not is_location_close(inspection.lat, inspection.lng, notice.lat, notice.lng):
        return False, ""
    
    if is_date_in_range(inspection.inspection_date, notice.start_date, notice.end_date):
        if inspection.road_condition and "施工" not in inspection.road_condition:
            if notice.construction_type:
                desc = (f"地点 [{inspection.location}] 路况描述不一致："
                       f"巡查表记录 [{inspection.road_condition}]，"
                       f"施工告示显示 [{notice.construction_type}] 施工")
                return True, desc
    return False, ""

def detect_conflicts() -> List[ConflictRecord]:
    new_conflicts = []
    
    existing_keys = set()
    for c in store.conflicts:
        key = (c.inspection_id, c.notice_id, c.conflict_type)
        existing_keys.add(key)
    
    for inspection in store.inspections:
        for notice in store.notices:
            has_conflict, desc = detect_passable_conflict(inspection, notice)
            if has_conflict:
                key = (inspection.id, notice.id, 'passable')
                if key not in existing_keys:
                    conflict = ConflictRecord(
                        inspection_id=inspection.id,
                        notice_id=notice.id,
                        conflict_type='passable',
                        description=desc,
                        location=inspection.location or notice.location,
                        inspection_data=inspection.to_dict(),
                        notice_data=notice.to_dict(),
                        status='pending'
                    )
                    store.conflicts.append(conflict)
                    new_conflicts.append(conflict)
                    existing_keys.add(key)
            
            has_conflict, desc = detect_road_condition_conflict(inspection, notice)
            if has_conflict:
                key = (inspection.id, notice.id, 'road_condition')
                if key not in existing_keys:
                    conflict = ConflictRecord(
                        inspection_id=inspection.id,
                        notice_id=notice.id,
                        conflict_type='road_condition',
                        description=desc,
                        location=inspection.location or notice.location,
                        inspection_data=inspection.to_dict(),
                        notice_data=notice.to_dict(),
                        status='pending'
                    )
                    store.conflicts.append(conflict)
                    new_conflicts.append(conflict)
                    existing_keys.add(key)
    
    store.save()
    return new_conflicts

def resolve_conflict(conflict_id: str, resolution: str, 
                     resolved_by: str) -> ConflictRecord:
    for conflict in store.conflicts:
        if conflict.id == conflict_id:
            conflict.status = 'resolved'
            conflict.resolved_by = resolved_by
            conflict.resolution = resolution
            conflict.resolve_time = datetime.now().isoformat()
            store.save()
            return conflict
    return None

def reject_conflict(conflict_id: str, resolved_by: str) -> ConflictRecord:
    for conflict in store.conflicts:
        if conflict.id == conflict_id:
            conflict.status = 'rejected'
            conflict.resolved_by = resolved_by
            conflict.resolve_time = datetime.now().isoformat()
            store.save()
            return conflict
    return None

def get_conflicts(status: str = None) -> List[Dict]:
    result = []
    for conflict in reversed(store.conflicts):
        if status is None or conflict.status == status:
            result.append(conflict.to_dict())
    return result

def get_conflict_stats() -> Dict:
    total = len(store.conflicts)
    pending = sum(1 for c in store.conflicts if c.status == 'pending')
    resolved = sum(1 for c in store.conflicts if c.status == 'resolved')
    rejected = sum(1 for c in store.conflicts if c.status == 'rejected')
    return {
        'total': total,
        'pending': pending,
        'resolved': resolved,
        'rejected': rejected
    }
