from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime
from math import radians, sin, cos, sqrt, atan2
import json
from models import (
    Volunteer, Location, Shift, CheckInRecord, ShiftSwap,
    DurationCertification, ServiceReport, ReportDetail,
    ExceptionLog, ManualCorrection,
    ShiftStatus, CheckInStatus, SwapStatus, CertificationStatus,
    ReportStatus, ExceptionType
)
from schemas import (
    VolunteerCreate, VolunteerUpdate,
    LocationCreate, LocationUpdate,
    ShiftCreate, ShiftUpdate,
    CheckInCreate, CheckOut,
    ShiftSwapCreate, ShiftSwapApproval,
    DurationCertificationCreate, DurationCertificationVerify,
    ServiceReportCreate, ManualCorrectionCreate,
    ExportRequest
)


def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371000
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c


def log_exception(
    db: Session,
    exception_type: ExceptionType,
    raw_input: dict,
    handling_conclusion: str,
    related_type: str = None,
    related_id: int = None,
    error_message: str = None,
    handler_id: int = None
):
    exception_log = ExceptionLog(
        exception_type=exception_type,
        related_type=related_type,
        related_id=related_id,
        raw_input=json.dumps(raw_input, ensure_ascii=False, default=str),
        error_message=error_message,
        handling_conclusion=handling_conclusion,
        handler_id=handler_id
    )
    db.add(exception_log)
    db.commit()
    return exception_log


def create_volunteer(db: Session, volunteer: VolunteerCreate):
    db_volunteer = Volunteer(**volunteer.model_dump())
    db.add(db_volunteer)
    db.commit()
    db.refresh(db_volunteer)
    return db_volunteer


def get_volunteer(db: Session, volunteer_id: int):
    return db.query(Volunteer).filter(Volunteer.id == volunteer_id).first()


def get_volunteers(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Volunteer).offset(skip).limit(limit).all()


def update_volunteer(db: Session, volunteer_id: int, volunteer: VolunteerUpdate):
    db_volunteer = get_volunteer(db, volunteer_id)
    if db_volunteer:
        update_data = volunteer.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_volunteer, key, value)
        db.commit()
        db.refresh(db_volunteer)
    return db_volunteer


def create_location(db: Session, location: LocationCreate):
    db_location = Location(**location.model_dump())
    db.add(db_location)
    db.commit()
    db.refresh(db_location)
    return db_location


def get_location(db: Session, location_id: int):
    return db.query(Location).filter(Location.id == location_id).first()


def get_locations(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Location).offset(skip).limit(limit).all()


def update_location(db: Session, location_id: int, location: LocationUpdate):
    db_location = get_location(db, location_id)
    if db_location:
        update_data = location.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_location, key, value)
        db.commit()
        db.refresh(db_location)
    return db_location


def create_shift(db: Session, shift: ShiftCreate):
    db_shift = Shift(**shift.model_dump())
    db.add(db_shift)
    db.commit()
    db.refresh(db_shift)
    return db_shift


def get_shift(db: Session, shift_id: int):
    return db.query(Shift).filter(Shift.id == shift_id).first()


def get_shifts(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Shift).offset(skip).limit(limit).all()


def update_shift(db: Session, shift_id: int, shift: ShiftUpdate):
    db_shift = get_shift(db, shift_id)
    if db_shift:
        update_data = shift.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_shift, key, value)
        db.commit()
        db.refresh(db_shift)
    return db_shift


def check_shift_capacity(db: Session, shift_id: int):
    shift = get_shift(db, shift_id)
    if not shift:
        return False, "班次不存在"
    if shift.actual_count >= shift.capacity:
        return False, "班次已满员"
    return True, "容量可用"


def verify_checkin_location(db: Session, shift_id: int, lat: float, lng: float):
    shift = get_shift(db, shift_id)
    if not shift or not shift.location:
        return False, "班次或位置不存在"
    
    location = shift.location
    if location.latitude is None or location.longitude is None:
        return True, "位置未设置坐标，跳过校验"
    
    distance = calculate_distance(location.latitude, location.longitude, lat, lng)
    if distance <= location.radius_meters:
        return True, f"位置校验通过，距离{distance:.1f}米"
    return False, f"位置超出范围，距离{distance:.1f}米，范围{location.radius_meters}米"


def create_checkin(db: Session, checkin: CheckInCreate):
    raw_input = checkin.model_dump()
    
    capacity_ok, capacity_msg = check_shift_capacity(db, checkin.shift_id)
    if not capacity_ok:
        log_exception(
            db, ExceptionType.CAPACITY_ERROR, raw_input,
            f"签到被拒绝: {capacity_msg}", "shift", checkin.shift_id, capacity_msg
        )
        return None, capacity_msg
    
    existing = db.query(CheckInRecord).filter(
        and_(
            CheckInRecord.volunteer_id == checkin.volunteer_id,
            CheckInRecord.shift_id == checkin.shift_id,
            CheckInRecord.status != CheckInStatus.ABSENT
        )
    ).first()
    if existing:
        msg = "该志愿者已在此班次签到"
        log_exception(
            db, ExceptionType.CHECKIN_ERROR, raw_input,
            f"签到被拒绝: {msg}", "checkin", existing.id, msg
        )
        return None, msg
    
    shift = get_shift(db, checkin.shift_id)
    if not shift:
        msg = "班次不存在"
        log_exception(
            db, ExceptionType.CHECKIN_ERROR, raw_input,
            f"签到被拒绝: {msg}", "shift", checkin.shift_id, msg
        )
        return None, msg
    
    location = shift.location
    if location and location.require_location_check and not checkin.skip_location_check:
        if not checkin.checkin_lat or not checkin.checkin_lng:
            msg = "该签到点要求位置校验，请提供经纬度"
            log_exception(
                db, ExceptionType.LOCATION_ERROR, raw_input,
                f"签到被拒绝: {msg}", "shift", checkin.shift_id, msg
            )
            return None, msg
        
        location_ok, location_msg = verify_checkin_location(
            db, checkin.shift_id, checkin.checkin_lat, checkin.checkin_lng
        )
        if not location_ok:
            log_exception(
                db, ExceptionType.LOCATION_ERROR, raw_input,
                f"签到被拒绝: {location_msg}", "shift", checkin.shift_id, location_msg
            )
            return None, location_msg
    
    checkin_data = checkin.model_dump(exclude={"skip_location_check"})
    db_checkin = CheckInRecord(**checkin_data)
    db_checkin.checkin_time = datetime.now()
    db_checkin.status = CheckInStatus.CHECKED_IN
    
    if shift.start_time and db_checkin.checkin_time > shift.start_time:
        db_checkin.status = CheckInStatus.LATE
        db_checkin.remarks = f"迟到提醒: 班次开始时间{shift.start_time}"
    
    shift.actual_count += 1
    
    db.add(db_checkin)
    db.commit()
    db.refresh(db_checkin)
    return db_checkin, "签到成功"


def get_checkin(db: Session, checkin_id: int):
    return db.query(CheckInRecord).filter(CheckInRecord.id == checkin_id).first()


def get_checkins(db: Session, skip: int = 0, limit: int = 100):
    return db.query(CheckInRecord).offset(skip).limit(limit).all()


def checkout(db: Session, checkin_id: int, checkout_data: CheckOut):
    raw_input = {"checkin_id": checkin_id, **checkout_data.model_dump()}
    db_checkin = get_checkin(db, checkin_id)
    
    if not db_checkin:
        msg = "签到记录不存在"
        log_exception(db, ExceptionType.CHECKIN_ERROR, raw_input, f"签出失败: {msg}", None, None, msg)
        return None, msg
    
    if db_checkin.status in [CheckInStatus.CHECKED_OUT, CheckInStatus.ABSENT]:
        msg = f"当前状态{db_checkin.status}不允许签出"
        log_exception(db, ExceptionType.CHECKIN_ERROR, raw_input, f"签出失败: {msg}", "checkin", checkin_id, msg)
        return None, msg
    
    db_checkin.checkout_time = datetime.now()
    db_checkin.checkout_lat = checkout_data.checkout_lat
    db_checkin.checkout_lng = checkout_data.checkout_lng
    db_checkin.status = CheckInStatus.CHECKED_OUT
    
    if db_checkin.checkin_time:
        duration = (db_checkin.checkout_time - db_checkin.checkin_time).total_seconds() / 3600
        db_checkin.actual_duration = round(duration, 2)
    
    db.commit()
    db.refresh(db_checkin)
    return db_checkin, "签出成功"


def recalculate_duration(db: Session, checkin_id: int):
    db_checkin = get_checkin(db, checkin_id)
    if not db_checkin or not db_checkin.checkin_time or not db_checkin.checkout_time:
        return None, "签到记录不完整，无法重算时长"
    
    old_duration = db_checkin.actual_duration
    duration = (db_checkin.checkout_time - db_checkin.checkin_time).total_seconds() / 3600
    db_checkin.actual_duration = round(duration, 2)
    
    db.commit()
    db.refresh(db_checkin)
    
    log_exception(
        db, ExceptionType.CERTIFICATION_ERROR,
        {"checkin_id": checkin_id, "old_duration": old_duration, "new_duration": db_checkin.actual_duration},
        f"时长重算完成: {old_duration} -> {db_checkin.actual_duration}",
        "checkin", checkin_id
    )
    
    return db_checkin, "时长重算完成"


def create_swap(db: Session, swap: ShiftSwapCreate):
    db_swap = ShiftSwap(**swap.model_dump())
    db.add(db_swap)
    db.commit()
    db.refresh(db_swap)
    return db_swap


def get_swap(db: Session, swap_id: int):
    return db.query(ShiftSwap).filter(ShiftSwap.id == swap_id).first()


def get_swaps(db: Session, skip: int = 0, limit: int = 100):
    return db.query(ShiftSwap).offset(skip).limit(limit).all()


def approve_swap(db: Session, swap_id: int, approval: ShiftSwapApproval):
    raw_input = {"swap_id": swap_id, **approval.model_dump()}
    db_swap = get_swap(db, swap_id)
    
    if not db_swap:
        msg = "替班申请不存在"
        log_exception(db, ExceptionType.SWAP_ERROR, raw_input, f"审批失败: {msg}", None, None, msg)
        return None, msg
    
    if db_swap.status != SwapStatus.PENDING:
        msg = f"当前状态{db_swap.status}不允许审批"
        log_exception(db, ExceptionType.SWAP_ERROR, raw_input, f"审批失败: {msg}", "swap", swap_id, msg)
        return None, msg
    
    if approval.status == SwapStatus.APPROVED:
        old_checkin = db.query(CheckInRecord).filter(
            and_(
                CheckInRecord.volunteer_id == db_swap.requester_id,
                CheckInRecord.shift_id == db_swap.shift_id
            )
        ).first()
        
        if old_checkin:
            old_checkin.volunteer_id = db_swap.acceptor_id
        else:
            new_checkin = CheckInRecord(
                volunteer_id=db_swap.acceptor_id,
                shift_id=db_swap.shift_id,
                status=CheckInStatus.PENDING
            )
            db.add(new_checkin)
    
    db_swap.status = approval.status
    db_swap.approval_remarks = approval.approval_remarks
    db_swap.approver_id = approval.approver_id
    db_swap.approved_at = datetime.now()
    
    db.commit()
    db.refresh(db_swap)
    return db_swap, "审批完成"


def create_certification(db: Session, certification: DurationCertificationCreate):
    db_cert = DurationCertification(**certification.model_dump())
    db.add(db_cert)
    db.commit()
    db.refresh(db_cert)
    return db_cert


def get_certification(db: Session, cert_id: int):
    return db.query(DurationCertification).filter(DurationCertification.id == cert_id).first()


def get_certifications(db: Session, skip: int = 0, limit: int = 100):
    return db.query(DurationCertification).offset(skip).limit(limit).all()


def verify_certification(db: Session, cert_id: int, verification: DurationCertificationVerify):
    raw_input = {"cert_id": cert_id, **verification.model_dump()}
    db_cert = get_certification(db, cert_id)
    
    if not db_cert:
        msg = "认证记录不存在"
        log_exception(db, ExceptionType.CERTIFICATION_ERROR, raw_input, f"认证失败: {msg}", None, None, msg)
        return None, msg
    
    if db_cert.status != CertificationStatus.PENDING:
        msg = f"当前状态{db_cert.status}不允许验证"
        log_exception(db, ExceptionType.CERTIFICATION_ERROR, raw_input, f"认证失败: {msg}", "certification", cert_id, msg)
        return None, msg
    
    db_cert.verified_duration = verification.verified_duration
    db_cert.status = verification.status
    db_cert.verification_remarks = verification.verification_remarks
    db_cert.verifier_id = verification.verifier_id
    db_cert.verified_at = datetime.now()
    
    if verification.status == CertificationStatus.VERIFIED:
        volunteer = db.query(Volunteer).filter(Volunteer.id == db_cert.volunteer_id).first()
        if volunteer:
            volunteer.total_hours += verification.verified_duration
    
    db.commit()
    db.refresh(db_cert)
    return db_cert, "认证完成"


def create_report(db: Session, report: ServiceReportCreate):
    db_report = ServiceReport(**report.model_dump())
    
    query = db.query(CheckInRecord).join(Shift)
    if report.volunteer_id:
        query = query.filter(CheckInRecord.volunteer_id == report.volunteer_id)
    if report.start_date:
        query = query.filter(CheckInRecord.created_at >= report.start_date)
    if report.end_date:
        query = query.filter(CheckInRecord.created_at <= report.end_date)
    
    checkins = query.all()
    
    total_hours = 0
    for checkin in checkins:
        detail = ReportDetail(
            shift_id=checkin.shift_id,
            shift_name=checkin.shift.name if checkin.shift else "",
            location_name=checkin.shift.location.name if (checkin.shift and checkin.shift.location) else "",
            checkin_time=checkin.checkin_time,
            checkout_time=checkin.checkout_time,
            duration=checkin.actual_duration,
            status=checkin.status.value
        )
        db_report.details.append(detail)
        total_hours += checkin.actual_duration
    
    db_report.total_hours = round(total_hours, 2)
    db_report.shift_count = len(checkins)
    db_report.status = ReportStatus.GENERATED
    
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report


def get_report(db: Session, report_id: int):
    return db.query(ServiceReport).filter(ServiceReport.id == report_id).first()


def get_reports(db: Session, skip: int = 0, limit: int = 100):
    return db.query(ServiceReport).offset(skip).limit(limit).all()


def export_report(db: Session, export_req: ExportRequest):
    report = get_report(db, export_req.report_id)
    if not report:
        return None, "报告不存在"
    
    report.export_format = export_req.format
    report.exported_at = datetime.now()
    report.status = ReportStatus.EXPORTED
    db.commit()
    
    if export_req.format == "csv":
        csv_content = "班次,位置,签到时间,签退时间,时长(小时),状态\n"
        for detail in report.details:
            csv_content += f"{detail.shift_name},{detail.location_name},{detail.checkin_time},{detail.checkout_time},{detail.duration},{detail.status}\n"
        return csv_content, "csv"
    elif export_req.format == "json":
        data = {
            "report_id": report.id,
            "volunteer_id": report.volunteer_id,
            "total_hours": report.total_hours,
            "shift_count": report.shift_count,
            "details": [
                {
                    "shift_name": d.shift_name,
                    "location_name": d.location_name,
                    "checkin_time": str(d.checkin_time),
                    "checkout_time": str(d.checkout_time),
                    "duration": d.duration,
                    "status": d.status
                }
                for d in report.details
            ]
        }
        return json.dumps(data, ensure_ascii=False, indent=2), "json"
    
    return None, "未知格式"


def create_manual_correction(db: Session, correction: ManualCorrectionCreate):
    checkin = get_checkin(db, correction.checkin_id)
    if not checkin:
        return None, "签到记录不存在"
    
    db_correction = ManualCorrection(
        checkin_id=correction.checkin_id,
        old_status=checkin.status.value if checkin.status else None,
        new_status=correction.new_status,
        old_checkin_time=checkin.checkin_time,
        new_checkin_time=correction.new_checkin_time,
        old_checkout_time=checkin.checkout_time,
        new_checkout_time=correction.new_checkout_time,
        old_duration=checkin.actual_duration,
        new_duration=correction.new_duration,
        reason=correction.reason,
        corrector_id=correction.corrector_id
    )
    
    if correction.new_status:
        checkin.status = CheckInStatus(correction.new_status)
    if correction.new_checkin_time:
        checkin.checkin_time = correction.new_checkin_time
    if correction.new_checkout_time:
        checkin.checkout_time = correction.new_checkout_time
    if correction.new_duration is not None:
        checkin.actual_duration = correction.new_duration
    
    db.add(db_correction)
    db.commit()
    db.refresh(db_correction)
    
    log_exception(
        db, ExceptionType.MANUAL_CORRECTION,
        correction.model_dump(),
        f"人工修正完成: {correction.reason}",
        "checkin", correction.checkin_id, None, correction.corrector_id
    )
    
    return db_correction, "修正成功"


def get_exception_logs(db: Session, skip: int = 0, limit: int = 100, related_type: str = None, related_id: int = None):
    query = db.query(ExceptionLog)
    if related_type:
        query = query.filter(ExceptionLog.related_type == related_type)
    if related_id:
        query = query.filter(ExceptionLog.related_id == related_id)
    return query.order_by(ExceptionLog.created_at.desc()).offset(skip).limit(limit).all()


def get_corrections(db: Session, checkin_id: int = None, skip: int = 0, limit: int = 100):
    query = db.query(ManualCorrection)
    if checkin_id:
        query = query.filter(ManualCorrection.checkin_id == checkin_id)
    return query.order_by(ManualCorrection.created_at.desc()).offset(skip).limit(limit).all()