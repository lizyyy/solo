from sqlalchemy.orm import Session
from datetime import datetime
from typing import Tuple, Optional
from . import crud, models


class ValidationError(Exception):
    pass


def validate_box_code_unique(db: Session, box_code: str) -> Tuple[bool, Optional[str]]:
    existing = crud.get_sample_by_box_code(db, box_code)
    if existing:
        return False, f"盒码 {box_code} 已存在"
    return True, None


def validate_event_order(db: Session, sample_id: int, new_event_time: datetime, 
                         event_type: str) -> Tuple[bool, Optional[str]]:
    events = crud.get_sample_events_by_sample(db, sample_id)
    
    if not events:
        if event_type != "register":
            return True, "注意：首次事件非登记，但已接受（事件将按时间排序）"
        return True, None
    
    last_event = events[-1]
    
    if new_event_time < last_event.event_time:
        return True, "警告：事件时间早于最后一次事件时间，系统将自动重新排序"
    
    if event_type == "scan_in":
        if last_event.event_type == "scan_in":
            return False, "错误：样品已在柜中，不能重复入柜"
    elif event_type == "scan_out":
        if last_event.event_type == "register":
            return False, "错误：样品尚未入柜，不能取样"
        if last_event.event_type == "scan_out":
            return False, "错误：样品已被取出，不能重复取样"
    
    return True, None


def validate_fridge_exists(db: Session, fridge_code: str) -> Tuple[bool, Optional[str]]:
    fridge = crud.get_fridge_by_code(db, fridge_code)
    if not fridge:
        return False, f"冷藏柜 {fridge_code} 不存在"
    return True, None


def validate_sample_status(db: Session, box_code: str, expected_statuses: list) -> Tuple[bool, Optional[str]]:
    sample = crud.get_sample_by_box_code(db, box_code)
    if not sample:
        return False, f"留样盒 {box_code} 不存在"
    if sample.status not in expected_statuses:
        return False, f"留样盒状态 {sample.status} 不符合要求，需要 {expected_statuses}"
    return True, None


def validate_sample_exists(db: Session, box_code: str) -> Tuple[bool, Optional[str]]:
    sample = crud.get_sample_by_box_code(db, box_code)
    if not sample:
        return False, f"留样盒 {box_code} 不存在"
    return True, None
