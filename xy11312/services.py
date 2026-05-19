from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
from typing import List, Tuple, Optional
import uuid
import json
import hashlib
import pandas as pd
from io import BytesIO

from models import (
    DriverCheckin, GpsTrack, ParentComplaint, Ruling, Review,
    BatchOperation, BatchOperationItem, Bus, Driver, Student,
    mask_sensitive_data
)
from schemas import (
    DriverCheckinCreate, GpsTrackCreate, ParentComplaintCreate,
    RulingCreate, ReviewCreate, ResponsibilityEnum
)

def generate_idempotency_key(prefix: str, data: dict) -> str:
    data_str = json.dumps(data, sort_keys=True, default=str)
    hash_str = hashlib.md5(data_str.encode()).hexdigest()
    return f"{prefix}_{hash_str}"

def find_bus_by_route(db: Session, route_name: str) -> Optional[Bus]:
    if not route_name:
        return None
    return db.query(Bus).filter(
        or_(Bus.route_name == route_name, Bus.route_name.like(f"%{route_name}%"))
    ).first()

def find_gps_around_time(db: Session, bus_id: int, target_time: datetime, window_minutes: int = 60) -> List[GpsTrack]:
    start_time = target_time - timedelta(minutes=window_minutes)
    end_time = target_time + timedelta(minutes=window_minutes)
    return db.query(GpsTrack).filter(
        and_(
            GpsTrack.bus_id == bus_id,
            GpsTrack.record_time >= start_time,
            GpsTrack.record_time <= end_time
        )
    ).order_by(GpsTrack.record_time).all()

def find_driver_checkin_around_time(db: Session, driver_id: int, target_time: datetime, window_minutes: int = 120) -> List[DriverCheckin]:
    start_time = target_time - timedelta(minutes=window_minutes)
    end_time = target_time + timedelta(minutes=window_minutes)
    return db.query(DriverCheckin).filter(
        and_(
            DriverCheckin.driver_id == driver_id,
            DriverCheckin.checkin_time >= start_time,
            DriverCheckin.checkin_time <= end_time
        )
    ).order_by(DriverCheckin.checkin_time).all()

def calculate_delay_from_gps(gps_tracks: List[GpsTrack], scheduled_time: datetime, stop_location: Tuple[float, float] = None) -> Tuple[int, Optional[datetime]]:
    if not gps_tracks or not scheduled_time:
        return 0, None
    
    threshold_distance = 0.001
    arrival_time = None
    
    for track in gps_tracks:
        if stop_location:
            distance = ((track.lat - stop_location[0])**2 + (track.lng - stop_location[1])**2)**0.5
            if distance < threshold_distance:
                arrival_time = track.record_time
                break
        else:
            if track.record_time >= scheduled_time:
                arrival_time = track.record_time
                break
    
    if not arrival_time:
        arrival_time = gps_tracks[-1].record_time if gps_tracks else None
    
    if arrival_time:
        delay_seconds = (arrival_time - scheduled_time).total_seconds()
        delay_minutes = max(0, int(delay_seconds / 60))
        return delay_minutes, arrival_time
    
    return 0, None

def determine_responsibility(
    delay_minutes: int,
    gps_tracks: List[GpsTrack],
    checkins: List[DriverCheckin],
    scheduled_time: datetime
) -> Tuple[ResponsibilityEnum, str]:
    if delay_minutes <= 5:
        return ResponsibilityEnum.UNKNOWN, "延误在5分钟以内，属于正常波动范围"
    
    if delay_minutes > 30:
        return ResponsibilityEnum.TRAFFIC, "延误超过30分钟，可能由交通拥堵导致"
    
    driver_start_checkin = None
    for checkin in checkins:
        if checkin.checkin_type == "start":
            driver_start_checkin = checkin
            break
    
    if driver_start_checkin:
        start_delay = (driver_start_checkin.checkin_time - scheduled_time.replace(hour=6, minute=0)).total_seconds() / 60
        if start_delay > 15:
            return ResponsibilityEnum.DRIVER, f"司机打卡时间比计划发车晚{int(start_delay)}分钟，可能是司机原因"
    
    avg_speed = None
    if gps_tracks and len(gps_tracks) > 0:
        speeds = [t.speed for t in gps_tracks if t.speed is not None]
        if speeds:
            avg_speed = sum(speeds) / len(speeds)
    
    if avg_speed is not None and avg_speed < 10:
        return ResponsibilityEnum.TRAFFIC, f"GPS显示平均车速{avg_speed:.1f}km/h，低于10km/h，可能存在交通拥堵"
    
    if delay_minutes > 15:
        return ResponsibilityEnum.DRIVER, f"延误{delay_minutes}分钟，无明显交通拥堵迹象，可能是司机原因"
    
    return ResponsibilityEnum.UNKNOWN, "根据现有数据无法明确判定责任"

def create_driver_checkin(db: Session, checkin: DriverCheckinCreate) -> Tuple[Optional[DriverCheckin], bool]:
    existing = db.query(DriverCheckin).filter(DriverCheckin.idempotency_key == checkin.idempotency_key).first()
    if existing:
        return existing, False
    
    db_checkin = DriverCheckin(**checkin.dict())
    db.add(db_checkin)
    db.commit()
    db.refresh(db_checkin)
    return db_checkin, True

def create_gps_track(db: Session, gps: GpsTrackCreate) -> Tuple[Optional[GpsTrack], bool]:
    existing = db.query(GpsTrack).filter(GpsTrack.idempotency_key == gps.idempotency_key).first()
    if existing:
        return existing, False
    
    db_gps = GpsTrack(**gps.dict())
    db.add(db_gps)
    db.commit()
    db.refresh(db_gps)
    return db_gps, True

def create_parent_complaint(db: Session, complaint: ParentComplaintCreate) -> Tuple[Optional[ParentComplaint], bool]:
    existing = db.query(ParentComplaint).filter(
        or_(
            ParentComplaint.idempotency_key == complaint.idempotency_key,
            ParentComplaint.complaint_number == complaint.complaint_number
        )
    ).first()
    if existing:
        return existing, False
    
    db_complaint = ParentComplaint(**complaint.dict(), status="pending")
    db.add(db_complaint)
    db.commit()
    db.refresh(db_complaint)
    return db_complaint, True

def create_ruling(db: Session, ruling: RulingCreate) -> Ruling:
    existing = db.query(Ruling).filter(Ruling.complaint_id == ruling.complaint_id).first()
    if existing:
        for key, value in ruling.dict(exclude_unset=True).items():
            setattr(existing, key, value)
        existing.status = "final"
        existing.ruled_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        complaint = db.query(ParentComplaint).filter(ParentComplaint.id == ruling.complaint_id).first()
        if complaint:
            complaint.status = "ruled"
            db.commit()
        return existing
    
    ruling_number = f"RUL-{int(datetime.utcnow().timestamp())}-{uuid.uuid4().hex[:4]}"
    db_ruling = Ruling(
        **ruling.dict(),
        ruling_number=ruling_number,
        status="final",
        ruled_at=datetime.utcnow()
    )
    db.add(db_ruling)
    db.commit()
    db.refresh(db_ruling)
    
    complaint = db.query(ParentComplaint).filter(ParentComplaint.id == ruling.complaint_id).first()
    if complaint:
        complaint.status = "ruled"
        db.commit()
    
    return db_ruling

def auto_match_and_rule(db: Session, complaint_id: int) -> Optional[Ruling]:
    complaint = db.query(ParentComplaint).filter(ParentComplaint.id == complaint_id).first()
    if not complaint:
        return None
    
    bus = find_bus_by_route(db, complaint.bus_route)
    bus_id = bus.id if bus else None
    
    gps_tracks = []
    if bus_id:
        gps_tracks = find_gps_around_time(db, bus_id, complaint.complaint_date)
    
    checkins = []
    if bus and bus.driver_id:
        checkins = find_driver_checkin_around_time(db, bus.driver_id, complaint.complaint_date)
    
    scheduled_time = complaint.scheduled_arrival or complaint.complaint_date.replace(hour=7, minute=30)
    delay_minutes, actual_arrival = calculate_delay_from_gps(gps_tracks, scheduled_time)
    
    if complaint.actual_arrival:
        manual_delay = (complaint.actual_arrival - scheduled_time).total_seconds() / 60
        if manual_delay > delay_minutes:
            delay_minutes = int(manual_delay)
    
    responsibility, reason = determine_responsibility(delay_minutes, gps_tracks, checkins, scheduled_time)
    
    gps_evidence = f"共获取{len(gps_tracks)}条GPS轨迹记录"
    if gps_tracks:
        gps_evidence += f"，时间范围: {gps_tracks[0].record_time} 至 {gps_tracks[-1].record_time}"
    
    checkin_evidence = f"共获取{len(checkins)}条司机打卡记录"
    if checkins:
        checkin_times = [c.checkin_time.strftime('%H:%M') for c in checkins]
        checkin_evidence += f"，打卡时间: {', '.join(checkin_times)}"
    
    ruling_create = RulingCreate(
        complaint_id=complaint_id,
        responsibility=responsibility,
        delay_minutes=delay_minutes,
        root_cause=reason,
        gps_evidence=gps_evidence,
        checkin_evidence=checkin_evidence,
        ruling_reason=f"自动判定: {reason}",
        ruled_by="system"
    )
    
    return create_ruling(db, ruling_create)

def create_review(db: Session, review: ReviewCreate) -> Review:
    ruling = db.query(Ruling).filter(Ruling.id == review.ruling_id).first()
    if not ruling:
        raise ValueError("Ruling not found")
    
    review_number = f"REV-{int(datetime.utcnow().timestamp())}-{uuid.uuid4().hex[:4]}"
    db_review = Review(
        **review.dict(),
        review_number=review_number,
        original_responsibility=ruling.responsibility,
        reviewed_at=datetime.utcnow()
    )
    
    if review.review_result == "revised" and review.new_responsibility:
        ruling.responsibility = review.new_responsibility
        ruling.updated_at = datetime.utcnow()
    
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    return db_review

def batch_import_with_status(db: Session, items: List[dict], import_type: str, idempotency_prefix: str):
    batch_id = f"BATCH-{import_type.upper()}-{int(datetime.utcnow().timestamp())}"
    batch_op = BatchOperation(
        batch_id=batch_id,
        operation_type=f"import_{import_type}",
        total_count=len(items),
        status="processing"
    )
    db.add(batch_op)
    db.commit()
    
    success_items = []
    failure_items = []
    success_count = 0
    failure_count = 0
    
    for idx, item in enumerate(items):
        try:
            item_id = None
            is_new = False
            
            if import_type == "checkin":
                item["idempotency_key"] = generate_idempotency_key(f"{idempotency_prefix}_checkin", item)
                obj, is_new = create_driver_checkin(db, DriverCheckinCreate(**item))
                item_id = obj.id if obj else None
            elif import_type == "gps":
                item["idempotency_key"] = generate_idempotency_key(f"{idempotency_prefix}_gps", item)
                obj, is_new = create_gps_track(db, GpsTrackCreate(**item))
                item_id = obj.id if obj else None
            elif import_type == "complaint":
                item["idempotency_key"] = generate_idempotency_key(f"{idempotency_prefix}_complaint", item)
                obj, is_new = create_parent_complaint(db, ParentComplaintCreate(**item))
                item_id = obj.id if obj else None
            
            batch_item = BatchOperationItem(
                batch_id=batch_id,
                item_index=idx,
                item_id=str(item_id) if item_id else None,
                status="success" if is_new else "duplicate",
                error_message=None if is_new else "Duplicate record, skipped"
            )
            db.add(batch_item)
            
            if is_new:
                success_count += 1
                success_items.append({"index": idx, "id": item_id, "status": "created"})
            else:
                success_items.append({"index": idx, "id": item_id, "status": "duplicate"})
            
        except Exception as e:
            failure_count += 1
            failure_items.append({"index": idx, "error": str(e), "data": mask_sensitive_data(item)})
            
            batch_item = BatchOperationItem(
                batch_id=batch_id,
                item_index=idx,
                item_id=None,
                status="failed",
                error_message=str(e)
            )
            db.add(batch_item)
        
        db.commit()
    
    batch_op.success_count = success_count
    batch_op.failure_count = failure_count
    batch_op.status = "completed"
    batch_op.completed_at = datetime.utcnow()
    db.commit()
    
    return {
        "batch_id": batch_id,
        "operation_type": f"import_{import_type}",
        "total_count": len(items),
        "success_count": success_count,
        "failure_count": failure_count,
        "status": "completed",
        "success_items": success_items,
        "failure_items": failure_items
    }

def export_rulings_to_excel(db: Session, start_date: datetime = None, end_date: datetime = None, 
                            status: str = None, bus_route: str = None) -> BytesIO:
    query = db.query(Ruling).join(ParentComplaint)
    
    if start_date:
        query = query.filter(Ruling.created_at >= start_date)
    if end_date:
        query = query.filter(Ruling.created_at <= end_date)
    if status:
        query = query.filter(Ruling.status == status)
    if bus_route:
        query = query.filter(ParentComplaint.bus_route == bus_route)
    
    rulings = query.all()
    
    data = []
    for ruling in rulings:
        complaint = ruling.complaint
        row = {
            "裁定编号": ruling.ruling_number,
            "申诉编号": complaint.complaint_number if complaint else "",
            "学生姓名": mask_sensitive_data({"student_name": complaint.student_name if complaint else ""})["student_name"],
            "家长姓名": mask_sensitive_data({"parent_name": complaint.parent_name if complaint else ""})["parent_name"],
            "家长电话": mask_sensitive_data({"parent_phone": complaint.parent_phone if complaint else ""})["parent_phone"],
            "线路": complaint.bus_route if complaint else "",
            "站点": complaint.stop_name if complaint else "",
            "申诉日期": complaint.complaint_date.strftime('%Y-%m-%d %H:%M') if complaint and complaint.complaint_date else "",
            "责任判定": ruling.responsibility,
            "延误分钟": ruling.delay_minutes,
            "根本原因": ruling.root_cause,
            "GPS证据": ruling.gps_evidence,
            "打卡证据": ruling.checkin_evidence,
            "裁定理由": ruling.ruling_reason,
            "裁定人": ruling.ruled_by,
            "裁定时间": ruling.ruled_at.strftime('%Y-%m-%d %H:%M') if ruling.ruled_at else "",
            "复核次数": len(ruling.reviews)
        }
        data.append(row)
    
    df = pd.DataFrame(data)
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='裁定记录')
    output.seek(0)
    return output
