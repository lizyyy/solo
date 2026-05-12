from datetime import datetime, timedelta
from collections import defaultdict
from typing import List, Dict, Any, Optional
import json

from .models import db

SLA_CONFIG = {
    "NORMAL": {
        "response_hours": 4,
        "resolution_hours": 24,
        "business_hours": {"start": 9, "end": 18}
    },
    "VIP": {
        "response_hours": 1,
        "resolution_hours": 8,
        "business_hours": {"start": 9, "end": 20}
    },
    "URGENT": {
        "response_hours": 0.5,
        "resolution_hours": 4,
        "business_hours": {"start": 9, "end": 20}
    }
}

PAUSE_EXCLUSION_CATEGORIES = [
    "等待客户",
    "等待第三方",
    "等待系统",
    "其他业务原因"
]

INTERNAL_TRANSFER_CATEGORIES = [
    "内部转派",
    "技能转移",
    "等级提升"
]


def parse_datetime(dt_str: str) -> datetime:
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%dT%H:%M",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(dt_str, fmt)
        except ValueError:
            continue
    raise ValueError(f"无法解析时间格式: {dt_str}")


def get_holidays() -> List[str]:
    conn = db.conn
    rows = conn.execute("SELECT date FROM holidays").fetchall()
    return [row["date"] for row in rows]


def is_holiday(dt: datetime) -> bool:
    holidays = get_holidays()
    date_str = dt.strftime("%Y-%m-%d")
    if date_str in holidays:
        return True
    if dt.weekday() >= 5:
        return True
    return False


def is_in_business_hours(dt: datetime, customer_type: str) -> bool:
    if is_holiday(dt):
        return False
    config = SLA_CONFIG.get(customer_type, SLA_CONFIG["NORMAL"])
    start = config["business_hours"]["start"]
    end = config["business_hours"]["end"]
    hour = dt.hour
    return start <= hour < end


def calculate_business_hours(
    start_dt: datetime,
    end_dt: datetime,
    customer_type: str,
    excluded_periods: List[tuple] = None
) -> float:
    if excluded_periods is None:
        excluded_periods = []
    
    if start_dt >= end_dt:
        return 0.0
    
    excluded_periods = [
        (parse_datetime(start) if isinstance(start, str) else start,
         parse_datetime(end) if isinstance(end, str) else end)
        for start, end in excluded_periods
        if end is not None
    ]
    
    total_hours = 0.0
    current = start_dt
    config = SLA_CONFIG.get(customer_type, SLA_CONFIG["NORMAL"])
    start_hour = config["business_hours"]["start"]
    end_hour = config["business_hours"]["end"]
    
    while current < end_dt:
        if not is_holiday(current):
            day_start = current.replace(hour=start_hour, minute=0, second=0, microsecond=0)
            day_end = current.replace(hour=end_hour, minute=0, second=0, microsecond=0)
            
            effective_start = max(current, day_start)
            effective_end = min(end_dt, day_end)
            
            if effective_start < effective_end:
                for exc_start, exc_end in excluded_periods:
                    overlap_start = max(effective_start, exc_start)
                    overlap_end = min(effective_end, exc_end)
                    if overlap_start < overlap_end:
                        effective_end = overlap_start
                
                if effective_start < effective_end:
                    delta = effective_end - effective_start
                    total_hours += delta.total_seconds() / 3600
        
        next_day = current.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        current = next_day
    
    return total_hours


def add_business_hours(
    start_dt: datetime,
    hours: float,
    customer_type: str,
    excluded_periods: List[tuple] = None
) -> datetime:
    if excluded_periods is None:
        excluded_periods = []
    
    excluded_periods = [
        (parse_datetime(start) if isinstance(start, str) else start,
         parse_datetime(end) if isinstance(end, str) else end)
        for start, end in excluded_periods
        if end is not None
    ]
    
    remaining = hours
    current = start_dt
    config = SLA_CONFIG.get(customer_type, SLA_CONFIG["NORMAL"])
    start_hour = config["business_hours"]["start"]
    end_hour = config["business_hours"]["end"]
    
    while remaining > 0:
        if is_holiday(current):
            current = current.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
            continue
        
        day_start = current.replace(hour=start_hour, minute=0, second=0, microsecond=0)
        day_end = current.replace(hour=end_hour, minute=0, second=0, microsecond=0)
        
        if current < day_start:
            current = day_start
            continue
        
        if current >= day_end:
            current = current.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
            continue
        
        available_hours_in_day = (day_end - current).total_seconds() / 3600
        
        for exc_start, exc_end in excluded_periods:
            if exc_start < day_end and exc_end > current:
                overlap_start = max(current, exc_start)
                overlap_end = min(day_end, exc_end)
                if overlap_start < overlap_end:
                    excluded_hours = (overlap_end - overlap_start).total_seconds() / 3600
                    available_hours_in_day -= excluded_hours
                    current = overlap_end
        
        if remaining <= available_hours_in_day:
            return current + timedelta(hours=remaining)
        else:
            remaining -= available_hours_in_day
            current = day_end
    
    return current


def get_ticket_details(ticket_id: str) -> Optional[Dict[str, Any]]:
    conn = db.conn
    
    ticket = conn.execute(
        "SELECT * FROM tickets WHERE ticket_id = ?", (ticket_id,)
    ).fetchone()
    
    if not ticket:
        return None
    
    ticket_dict = dict(ticket)
    
    transitions = conn.execute(
        "SELECT * FROM status_transitions WHERE ticket_id = ? ORDER BY transition_time",
        (ticket_id,)
    ).fetchall()
    
    pauses = conn.execute(
        "SELECT * FROM pauses WHERE ticket_id = ? ORDER BY pause_start",
        (ticket_id,)
    ).fetchall()
    
    escalations = conn.execute(
        "SELECT * FROM escalations WHERE ticket_id = ? ORDER BY escalation_time",
        (ticket_id,)
    ).fetchall()
    
    corrections = conn.execute(
        "SELECT * FROM corrections WHERE ticket_id = ? ORDER BY correction_time DESC",
        (ticket_id,)
    ).fetchall()
    
    breaches = conn.execute(
        "SELECT * FROM sla_breaches WHERE ticket_id = ? ORDER BY breached_at",
        (ticket_id,)
    ).fetchall()
    
    return {
        "ticket": ticket_dict,
        "transitions": [dict(t) for t in transitions],
        "pauses": [dict(p) for p in pauses],
        "escalations": [dict(e) for e in escalations],
        "corrections": [dict(c) for c in corrections],
        "breaches": [dict(b) for b in breaches]
    }


def analyze_ticket(ticket_id: str) -> Dict[str, Any]:
    details = get_ticket_details(ticket_id)
    if not details:
        return {"error": f"工单 {ticket_id} 不存在"}
    
    ticket = details["ticket"]
    transitions = details["transitions"]
    pauses = details["pauses"]
    escalations = details["escalations"]
    
    created_at = parse_datetime(ticket["created_at"])
    customer_type = ticket["customer_type"] or "NORMAL"
    config = SLA_CONFIG.get(customer_type, SLA_CONFIG["NORMAL"])
    
    issues = []
    warnings = []
    excluded_periods = []
    queue_time_allocations = defaultdict(float)
    processing_timeline = []
    
    for pause in pauses:
        pause_start = parse_datetime(pause["pause_start"])
        pause_end = None
        if pause["pause_end"]:
            pause_end = parse_datetime(pause["pause_end"])
        else:
            issues.append({
                "type": "pause_without_end",
                "severity": "error",
                "message": f"缺少暂停结束时间: 暂停ID={pause.get('pause_id')}, 原因={pause['pause_reason']}, 开始={pause['pause_start']}",
                "pause": pause
            })
        
        excluded_periods.append((pause_start, pause_end))
        category = pause.get("pause_reason_category") or pause["pause_reason"]
        is_excluded = category in PAUSE_EXCLUSION_CATEGORIES
        
        processing_timeline.append({
            "time": pause["pause_start"],
            "event": "暂停开始",
            "queue": "暂停",
            "action": pause["pause_reason"],
            "excluded": is_excluded
        })
        if pause_end:
            processing_timeline.append({
                "time": pause["pause_end"],
                "event": "暂停结束",
                "queue": "暂停结束",
                "action": "恢复处理",
                "excluded": False
            })
    
    for escalation in escalations:
        esc_time = parse_datetime(escalation["escalation_time"])
        if esc_time < created_at:
            issues.append({
                "type": "escalation_before_creation",
                "severity": "error",
                "message": f"升级时间早于创建时间: 升级时间={escalation['escalation_time']}, 创建时间={ticket['created_at']}",
                "escalation": escalation
            })
        
        processing_timeline.append({
            "time": escalation["escalation_time"],
            "event": "升级",
            "queue": escalation.get("to_queue") or "升级",
            "action": f"{escalation.get('from_level')} -> {escalation.get('to_level')}",
            "excluded": False
        })
    
    previous_time = created_at
    previous_queue = transitions[0]["from_queue"] if transitions and transitions[0]["from_queue"] else "初始"
    
    for transition in transitions:
        trans_time = parse_datetime(transition["transition_time"])
        
        if previous_queue and previous_time < trans_time:
            queue_time = calculate_business_hours(
                previous_time,
                trans_time,
                customer_type,
                excluded_periods
            )
            queue_time_allocations[previous_queue] += queue_time
        
        processing_timeline.append({
            "time": transition["transition_time"],
            "event": "状态流转",
            "from_queue": transition.get("from_queue"),
            "to_queue": transition["to_queue"],
            "action": f"{transition.get('from_status') or '-'} -> {transition['to_status']}",
            "excluded": False
        })
        
        previous_time = trans_time
        previous_queue = transition["to_queue"]
    
    now = datetime.now()
    if previous_queue:
        current_queue_time = calculate_business_hours(
            previous_time,
            now,
            customer_type,
            excluded_periods
        )
        queue_time_allocations[previous_queue] += current_queue_time
    
    sla_deadline = add_business_hours(
        created_at,
        config["resolution_hours"],
        customer_type,
        excluded_periods
    )
    
    is_breached = now > sla_deadline
    
    blame_queue = None
    blame_reason = None
    breach_category = None
    
    if issues:
        critical_errors = [i for i in issues if i["severity"] == "error"]
        if critical_errors:
            last_error = critical_errors[-1]
            blame_queue = "数据异常"
            blame_reason = last_error["message"]
            breach_category = "数据错误"
    elif is_breached:
        if queue_time_allocations:
            blame_queue = max(queue_time_allocations.items(), key=lambda x: x[1])[0]
            blame_reason = f"该队列耗时最长: {queue_time_allocations[blame_queue]:.2f} 工时"
            
            if any(t.get("to_queue") == blame_queue for t in transitions) and \
               transitions and transitions[-1]["to_queue"] == blame_queue:
                pass
            else:
                pass
        else:
            blame_queue = "未分配"
        
        has_pauses = len(pauses) > 0
        has_escalations = len(escalations) > 0
        
        if has_pauses and any(p.get("pause_reason_category") == "等待客户" for p in pauses):
            breach_category = "客户响应延迟"
        elif has_escalations:
            breach_category = "升级流转超时"
        else:
            breach_category = "处理超时"
    
    processing_timeline.sort(key=lambda x: parse_datetime(x["time"]))
    
    active_queues = list(queue_time_allocations.keys())
    
    return {
        "ticket_id": ticket_id,
        "customer_type": customer_type,
        "created_at": ticket["created_at"],
        "sla_deadline": sla_deadline.strftime("%Y-%m-%d %H:%M:%S"),
        "is_breached": is_breached,
        "issues": issues,
        "warnings": warnings,
        "queue_time_allocations": dict(queue_time_allocations),
        "excluded_periods": excluded_periods,
        "blame_queue": blame_queue,
        "blame_reason": blame_reason,
        "breach_category": breach_category,
        "processing_timeline": processing_timeline,
        "active_queues": active_queues,
        "config": config,
        "transitions_count": len(transitions),
        "pauses_count": len(pauses),
        "escalations_count": len(escalations)
    }


def check_all_tickets() -> List[Dict[str, Any]]:
    conn = db.conn
    tickets = conn.execute("SELECT ticket_id FROM tickets").fetchall()
    
    results = []
    for ticket in tickets:
        result = analyze_ticket(ticket["ticket_id"])
        results.append(result)
        
        if "error" not in result:
            conn.execute("""
                INSERT OR REPLACE INTO sla_breaches (
                    ticket_id, breached_at, breach_category, blame_queue, blame_reason,
                    calculated_sla_deadline, excluded_periods, active_queues, processing_details
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                ticket["ticket_id"],
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                result.get("breach_category") or "无违约",
                result.get("blame_queue") or "",
                result.get("blame_reason") or "",
                result.get("sla_deadline"),
                json.dumps([
                    (s.strftime("%Y-%m-%d %H:%M:%S") if s else None,
                     e.strftime("%Y-%m-%d %H:%M:%S") if e else None)
                    for s, e in result.get("excluded_periods", [])
                ]),
                json.dumps(result.get("active_queues", [])),
                json.dumps(result.get("processing_timeline", []))
            ))
    
    conn.commit()
    return results


def apply_correction(
    ticket_id: str,
    field_name: str,
    new_value: str,
    operator: str,
    notes: str = ""
) -> Dict[str, Any]:
    conn = db.conn
    
    old_value = conn.execute(
        f"SELECT {field_name} FROM tickets WHERE ticket_id = ?",
        (ticket_id,)
    ).fetchone()
    
    if not old_value:
        return {"error": f"工单 {ticket_id} 不存在或字段 {field_name} 不存在"}
    
    old_val_str = str(old_value[0]) if old_value[0] is not None else ""
    
    conn.execute(f"""
        UPDATE tickets SET {field_name} = ? WHERE ticket_id = ?
    """, (new_value, ticket_id))
    
    conn.execute("""
        INSERT INTO corrections (ticket_id, field_name, old_value, new_value, operator, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (ticket_id, field_name, old_val_str, new_value, operator, notes))
    
    conn.commit()
    
    return {
        "success": True,
        "ticket_id": ticket_id,
        "field_name": field_name,
        "old_value": old_val_str,
        "new_value": new_value,
        "operator": operator,
        "notes": notes
    }


def get_queue_ownership(queue_name: str) -> Optional[str]:
    queue_owners = {
        "客服一线": "张主管",
        "客服二线": "李主管",
        "技术支持": "王主管",
        "产品支持": "赵主管",
        "管理层": "陈总监"
    }
    return queue_owners.get(queue_name)
