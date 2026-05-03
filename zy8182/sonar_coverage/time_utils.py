from datetime import datetime, date, time as dt_time, timedelta
from typing import Optional


def parse_time(time_str: str, date_ref: Optional[date] = None) -> datetime:
    formats = [
        "%H:%M:%S",
        "%H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
    ]
    
    dt = None
    for fmt in formats:
        try:
            dt = datetime.strptime(time_str.strip(), fmt)
            break
        except ValueError:
            continue
    
    if dt is None:
        raise ValueError(f"Cannot parse time: {time_str}")
    
    if dt.year == 1900 and date_ref:
        dt = datetime.combine(date_ref, dt.time())
    
    return dt


def time_diff_seconds(t1: datetime, t2: datetime) -> float:
    raw_diff = (t2 - t1).total_seconds()
    
    if abs(raw_diff) > 12 * 3600:
        if raw_diff > 0:
            return raw_diff - 24 * 3600
        else:
            return raw_diff + 24 * 3600
    
    return raw_diff


def is_time_ordered(times: list[datetime], max_gap_hours: float = 12.0) -> tuple[bool, list[int]]:
    if len(times) < 2:
        return True, []
    
    out_of_order_indices = []
    
    for i in range(1, len(times)):
        diff = time_diff_seconds(times[i-1], times[i])
        max_gap_seconds = max_gap_hours * 3600
        
        if diff < -max_gap_seconds:
            continue
        
        if diff < 0:
            out_of_order_indices.append(i)
    
    return len(out_of_order_indices) == 0, out_of_order_indices


def resolve_time_sequence(
    times: list[datetime], 
    base_date: date
) -> list[datetime]:
    if not times:
        return []
    
    resolved = []
    current_date = base_date
    
    for i, t in enumerate(times):
        dt = datetime.combine(current_date, t.time())
        
        if i > 0:
            prev_dt = resolved[i-1]
            diff = (dt - prev_dt).total_seconds()
            
            if diff < -12 * 3600:
                current_date += timedelta(days=1)
                dt = datetime.combine(current_date, t.time())
            elif diff > 12 * 3600:
                current_date -= timedelta(days=1)
                dt = datetime.combine(current_date, t.time())
        
        resolved.append(dt)
    
    return resolved
