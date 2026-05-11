"""核心业务逻辑"""

from datetime import datetime, timedelta, date
from typing import Any, Dict, List, Optional, Tuple
from .data_store import load_data, add_item, update_item, delete_item, get_by_id

TIME_FORMAT = "%Y-%m-%d %H:%M"


def parse_time(time_str: str) -> datetime:
    """解析时间字符串"""
    return datetime.strptime(time_str, TIME_FORMAT)


def format_time(dt: datetime) -> str:
    """格式化时间为字符串"""
    return dt.strftime(TIME_FORMAT)


def is_cross_midnight(start: datetime, end: datetime) -> bool:
    """检查是否跨午夜"""
    return start.date() != end.date()


def expand_cross_midnight(start: datetime, end: datetime) -> List[Tuple[datetime, datetime]]:
    """将跨午夜时段拆分为多天时段"""
    segments = []
    current_start = start
    while current_start.date() != end.date():
        next_day = (current_start + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        segments.append((current_start, next_day))
        current_start = next_day
    segments.append((current_start, end))
    return segments


def time_overlap(seg1: Tuple[datetime, datetime], seg2: Tuple[datetime, datetime]) -> bool:
    """检查两个时段是否重叠"""
    s1_start, s1_end = seg1
    s2_start, s2_end = seg2
    return s1_start < s2_end and s2_start < s1_end


def get_booking_segments(booking: Dict[str, Any]) -> List[Tuple[datetime, datetime]]:
    """获取预约的时段片段（处理跨午夜）"""
    start = parse_time(booking["start_time"])
    end = parse_time(booking["end_time"])
    return expand_cross_midnight(start, end)


def check_room_conflict(booking1: Dict[str, Any], booking2: Dict[str, Any]) -> bool:
    """检查两个预约是否有排练厅冲突"""
    if booking1.get("room_id") != booking2.get("room_id"):
        return False
    if booking1.get("status") in ("cancelled", "deleted"):
        return False
    if booking2.get("status") in ("cancelled", "deleted"):
        return False
    if booking1.get("id") == booking2.get("id"):
        return False
    
    segs1 = get_booking_segments(booking1)
    segs2 = get_booking_segments(booking2)
    
    for s1 in segs1:
        for s2 in segs2:
            if time_overlap(s1, s2):
                return True
    return False


def check_equipment_conflict(booking1: Dict[str, Any], booking2: Dict[str, Any]) -> List[str]:
    """检查两个预约是否有设备冲突，返回冲突的设备ID列表"""
    equip1 = set(booking1.get("equipment_ids", []))
    equip2 = set(booking2.get("equipment_ids", []))
    common = equip1 & equip2
    if not common:
        return []
    if booking1.get("status") in ("cancelled", "deleted"):
        return []
    if booking2.get("status") in ("cancelled", "deleted"):
        return []
    if booking1.get("id") == booking2.get("id"):
        return []
    
    segs1 = get_booking_segments(booking1)
    segs2 = get_booking_segments(booking2)
    
    for s1 in segs1:
        for s2 in segs2:
            if time_overlap(s1, s2):
                return list(common)
    return []


def find_all_conflicts(bookings: Optional[List[Dict[str, Any]]] = None) -> Dict[str, List[Dict[str, Any]]]:
    """查找所有冲突"""
    if bookings is None:
        bookings = load_data("bookings")
    
    conflicts = {
        "room_conflicts": [],
        "equipment_conflicts": [],
    }
    
    active_bookings = [b for b in bookings if b.get("status") not in ("cancelled", "deleted")]
    
    for i, b1 in enumerate(active_bookings):
        for b2 in active_bookings[i+1:]:
            if check_room_conflict(b1, b2):
                conflicts["room_conflicts"].append({
                    "booking1_id": b1["id"],
                    "booking2_id": b2["id"],
                    "room_id": b1["room_id"],
                    "type": "room"
                })
            
            equip_conflicts = check_equipment_conflict(b1, b2)
            if equip_conflicts:
                conflicts["equipment_conflicts"].append({
                    "booking1_id": b1["id"],
                    "booking2_id": b2["id"],
                    "equipment_ids": equip_conflicts,
                    "type": "equipment"
                })
    
    return conflicts


def find_available_slots(room_id: str, start_date: date, end_date: date, 
                         min_hours: int = 1) -> List[Dict[str, Any]]:
    """查找指定排练厅在日期范围内的可排时段"""
    bookings = load_data("bookings")
    room_bookings = [
        b for b in bookings 
        if b.get("room_id") == room_id and b.get("status") not in ("cancelled", "deleted")
    ]
    
    available = []
    current_date = start_date
    
    while current_date <= end_date:
        day_start = datetime.combine(current_date, datetime.min.time())
        day_end = datetime.combine(current_date + timedelta(days=1), datetime.min.time())
        
        blocked_segments = []
        for booking in room_bookings:
            segs = get_booking_segments(booking)
            for seg_start, seg_end in segs:
                if seg_start < day_end and seg_end > day_start:
                    effective_start = max(seg_start, day_start)
                    effective_end = min(seg_end, day_end)
                    blocked_segments.append((effective_start, effective_end))
        
        blocked_segments.sort()
        
        current_time = day_start
        for block_start, block_end in blocked_segments:
            if current_time < block_start:
                gap_hours = (block_start - current_time).total_seconds() / 3600
                if gap_hours >= min_hours:
                    available.append({
                        "date": current_date.strftime("%Y-%m-%d"),
                        "start": format_time(current_time),
                        "end": format_time(block_start),
                        "hours": round(gap_hours, 1)
                    })
            current_time = max(current_time, block_end)
        
        if current_time < day_end:
            gap_hours = (day_end - current_time).total_seconds() / 3600
            if gap_hours >= min_hours:
                available.append({
                    "date": current_date.strftime("%Y-%m-%d"),
                    "start": format_time(current_time),
                    "end": format_time(day_end),
                    "hours": round(gap_hours, 1)
                })
        
        current_date += timedelta(days=1)
    
    return available


def get_weekly_schedule(start_date: date) -> List[Dict[str, Any]]:
    """获取本周排练表"""
    end_date = start_date + timedelta(days=6)
    bookings = load_data("bookings")
    
    weekly = []
    for booking in bookings:
        if booking.get("status") in ("cancelled", "deleted"):
            continue
        
        start = parse_time(booking["start_time"])
        end = parse_time(booking["end_time"])
        
        if start.date() > end_date or end.date() < start_date:
            continue
        
        weekly.append(booking)
    
    weekly.sort(key=lambda b: parse_time(b["start_time"]))
    return weekly


def check_duplicate_import(import_hash: str) -> bool:
    """检查是否为重复导入"""
    bookings = load_data("bookings")
    for booking in bookings:
        if booking.get("import_hash") == import_hash:
            return True
    return False


def has_key_record(booking_id: str) -> bool:
    """检查预约是否有未归还的钥匙领取记录"""
    records = load_data("key_records")
    for record in records:
        if record.get("booking_id") == booking_id and record.get("status") == "picked_up":
            return True
    return False


def safe_delete_booking(booking_id: str) -> Tuple[bool, str]:
    """安全删除预约（检查是否有钥匙领取记录）"""
    if has_key_record(booking_id):
        return False, "该预约已有钥匙领取记录，无法直接删除。请先处理钥匙领取记录。"
    
    update_item("bookings", booking_id, {"status": "deleted"})
    return True, "预约已标记为已删除"


def reschedule_booking(booking_id: str, new_start: str, new_end: str, reason: str) -> Dict[str, Any]:
    """改期预约并记录历史"""
    booking = get_by_id("bookings", booking_id)
    if not booking:
        raise ValueError(f"预约 {booking_id} 不存在")
    
    history_record = {
        "booking_id": booking_id,
        "old_start": booking["start_time"],
        "old_end": booking["end_time"],
        "new_start": new_start,
        "new_end": new_end,
        "reason": reason,
        "created_at": format_time(datetime.now())
    }
    add_item("reschedule_history", history_record)
    
    update_item("bookings", booking_id, {
        "start_time": new_start,
        "end_time": new_end,
        "last_modified": format_time(datetime.now())
    })
    
    return history_record


def confirm_booking(booking_id: str) -> Optional[Dict[str, Any]]:
    """最终确认预约"""
    return update_item("bookings", booking_id, {
        "status": "confirmed",
        "confirmed_at": format_time(datetime.now())
    })


def pickup_key(booking_id: str, contact_id: str) -> Dict[str, Any]:
    """领取钥匙（检查重复领取和存在性）"""
    booking = get_by_id("bookings", booking_id)
    if not booking:
        raise ValueError(f"预约 {booking_id} 不存在")
    
    if booking.get("status") in ("cancelled", "deleted"):
        raise ValueError(f"预约 {booking_id} 已取消或删除，无法领取钥匙")
    
    contact = get_by_id("contacts", contact_id)
    if not contact:
        raise ValueError(f"联系人 {contact_id} 不存在")
    
    records = load_data("key_records")
    for record in records:
        if record.get("booking_id") == booking_id and record.get("status") == "picked_up":
            raise ValueError(f"预约 {booking_id} 的钥匙已被领取，请勿重复领取")
    
    record = {
        "booking_id": booking_id,
        "contact_id": contact_id,
        "pickup_time": format_time(datetime.now()),
        "status": "picked_up"
    }
    return add_item("key_records", record)


def return_key(record_id: str) -> Optional[Dict[str, Any]]:
    """归还钥匙（检查存在性和状态）"""
    record = get_by_id("key_records", record_id)
    if not record:
        return None
    
    if record.get("status") == "returned":
        raise ValueError(f"钥匙记录 {record_id} 已归还，请勿重复操作")
    
    return update_item("key_records", record_id, {
        "return_time": format_time(datetime.now()),
        "status": "returned"
    })
