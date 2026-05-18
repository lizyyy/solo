from sqlalchemy.orm import Session
from sqlalchemy import and_
from models import (
    ClassSchedule, Member, WaitlistRecord, ConversionRecord,
    AuditLog, ImportBadRow, ImportBatch, WaitlistStatus,
    ImportRecordStatus, BadRowReason
)
from datetime import datetime
import json
import uuid


def create_audit_log(db: Session, action: str, table_name: str = None, record_id: int = None,
                     field_name: str = None, old_value: str = None, new_value: str = None,
                     operator: str = None, ip_address: str = None, user_agent: str = None):
    audit_log = AuditLog(
        action=action,
        table_name=table_name,
        record_id=record_id,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
        operator=operator,
        ip_address=ip_address,
        user_agent=user_agent
    )
    db.add(audit_log)
    db.commit()
    return audit_log


def get_or_create_class_schedule(db: Session, class_name: str, class_date: str, start_time: str,
                                  instructor: str, operator: str = None):
    class_date_obj = datetime.strptime(class_date, "%Y-%m-%d").date()
    class_schedule = db.query(ClassSchedule).filter(
        and_(
            ClassSchedule.class_name == class_name,
            ClassSchedule.class_date == datetime.combine(class_date_obj, datetime.min.time()),
            ClassSchedule.start_time == start_time,
            ClassSchedule.instructor == instructor
        )
    ).first()

    if not class_schedule:
        class_schedule = ClassSchedule(
            class_name=class_name,
            class_type="默认类型",
            instructor=instructor,
            studio_room="默认教室",
            class_date=datetime.combine(class_date_obj, datetime.min.time()),
            start_time=start_time,
            end_time="",
            total_quota=20,
            used_quota=0
        )
        db.add(class_schedule)
        db.flush()
        create_audit_log(db, "CREATE", "class_schedules", class_schedule.id,
                         operator=operator, new_value=json.dumps({"class_name": class_name}))
    return class_schedule


def get_or_create_member(db: Session, member_no: str, member_name: str, phone: str, operator: str = None):
    member = db.query(Member).filter(Member.member_no == member_no).first()
    if not member:
        member = Member(
            member_no=member_no,
            member_name=member_name,
            phone=phone,
            membership_type="默认卡"
        )
        db.add(member)
        db.flush()
        create_audit_log(db, "CREATE", "members", member.id,
                         operator=operator, new_value=json.dumps({"member_no": member_no}))
    return member


def validate_status_transition(old_status: WaitlistStatus, new_status: WaitlistStatus) -> tuple:
    valid_transitions = {
        WaitlistStatus.WAITING: [WaitlistStatus.CONFIRMING, WaitlistStatus.CANCELLED, WaitlistStatus.SKIPPED],
        WaitlistStatus.CONFIRMING: [WaitlistStatus.CONFIRMED, WaitlistStatus.CANCELLED, WaitlistStatus.WAITING],
        WaitlistStatus.CONFIRMED: [WaitlistStatus.CANCELLED, WaitlistStatus.NO_SHOW],
        WaitlistStatus.CANCELLED: [],
        WaitlistStatus.SKIPPED: [WaitlistStatus.WAITING],
        WaitlistStatus.NO_SHOW: []
    }

    if old_status and new_status not in valid_transitions.get(old_status, []):
        return False, f"状态从 {old_status.value} 不能直接转为 {new_status.value}"
    return True, ""


def get_suggestion_for_reason(reason: BadRowReason) -> str:
    suggestions = {
        BadRowReason.MISSING_FIELD: "请补充必填字段后重新导入，或添加人工备注确认数据无误",
        BadRowReason.INVALID_STATUS: "请检查状态值是否在允许范围内：等待候补、确认中、已确认转正、已取消、已跳过、未出席",
        BadRowReason.STATUS_SKIP: "状态变更不符合流程，请人工审核确认后继续推进，建议添加备注说明原因",
        BadRowReason.DUPLICATE_RECORD: "该候补编号已存在，请确认是否为重复导入，可人工审核后跳过或更新",
        BadRowReason.INVALID_MEMBER: "会员信息不存在或不匹配，请核对会员编号和姓名",
        BadRowReason.INVALID_CLASS: "课程信息不存在，请核对课程名称、日期、时间和老师",
        BadRowReason.ORDER_MISMATCH: "候补顺序与现有记录不一致，建议检查是否有名额未按顺序释放，人工确认后继续",
        BadRowReason.QUOTA_ERROR: "名额释放存在问题，建议检查课程名额使用情况，人工确认后处理"
    }
    return suggestions.get(reason, "请人工审核后处理")


def create_bad_row(db: Session, batch_no: str, row_number: int, row_data: dict,
                   reason: BadRowReason, detail: str, operator: str = None):
    bad_row = ImportBadRow(
        import_batch_no=batch_no,
        row_number=row_number,
        original_data=json.dumps(row_data, ensure_ascii=False),
        error_reason=reason,
        error_detail=detail,
        suggestion=get_suggestion_for_reason(reason),
        status=ImportRecordStatus.NEEDS_REVIEW
    )
    db.add(bad_row)
    db.flush()
    create_audit_log(db, "IMPORT_BAD_ROW", "import_bad_rows", bad_row.id,
                     operator=operator, new_value=json.dumps({"reason": reason.value, "row": row_number}))
    return bad_row


def process_waitlist_import(db: Session, row_data: dict, row_number: int, batch_no: str, operator: str):
    errors = []

    required_fields = ["waitlist_no", "class_name", "class_date", "start_time", "instructor",
                       "member_no", "member_name", "phone", "waitlist_order", "status", "apply_time", "operator"]
    missing_fields = [f for f in required_fields if not row_data.get(f)]
    if missing_fields:
        create_bad_row(db, batch_no, row_number, row_data,
                       BadRowReason.MISSING_FIELD,
                       f"缺少必填字段: {', '.join(missing_fields)}",
                       operator)
        return False, ImportRecordStatus.FAILED

    existing_waitlist = db.query(WaitlistRecord).filter(
        WaitlistRecord.waitlist_no == row_data["waitlist_no"]
    ).first()
    if existing_waitlist:
        create_bad_row(db, batch_no, row_number, row_data,
                       BadRowReason.DUPLICATE_RECORD,
                       f"候补编号 {row_data['waitlist_no']} 已存在",
                       operator)
        return False, ImportRecordStatus.NEEDS_REVIEW

    try:
        status_enum = WaitlistStatus(row_data["status"])
    except ValueError:
        create_bad_row(db, batch_no, row_number, row_data,
                       BadRowReason.INVALID_STATUS,
                       f"无效的状态值: {row_data['status']}",
                       operator)
        return False, ImportRecordStatus.FAILED

    class_schedule = get_or_create_class_schedule(
        db, row_data["class_name"], row_data["class_date"],
        row_data["start_time"], row_data["instructor"], operator
    )

    member = get_or_create_member(
        db, row_data["member_no"], row_data["member_name"],
        row_data["phone"], operator
    )

    existing_order = db.query(WaitlistRecord).filter(
        and_(
            WaitlistRecord.class_schedule_id == class_schedule.id,
            WaitlistRecord.waitlist_order == row_data["waitlist_order"],
            WaitlistRecord.status.in_([WaitlistStatus.WAITING, WaitlistStatus.CONFIRMING])
        )
    ).first()

    if existing_order and "候补顺序" in str(row_data.get("quota_source", "")):
        create_bad_row(db, batch_no, row_number, row_data,
                       BadRowReason.ORDER_MISMATCH,
                       f"该课程候补顺序 {row_data['waitlist_order']} 已被占用，可能存在名额未按顺序释放",
                       operator)
        return False, ImportRecordStatus.NEEDS_REVIEW

    try:
        apply_time = datetime.strptime(row_data["apply_time"], "%Y-%m-%d %H:%M:%S")
    except ValueError:
        apply_time = datetime.now()

    confirm_deadline = None
    if row_data.get("confirm_deadline"):
        try:
            confirm_deadline = datetime.strptime(row_data["confirm_deadline"], "%Y-%m-%d %H:%M:%S")
        except ValueError:
            pass

    waitlist_record = WaitlistRecord(
        waitlist_no=row_data["waitlist_no"],
        class_schedule_id=class_schedule.id,
        member_id=member.id,
        waitlist_order=row_data["waitlist_order"],
        status=status_enum,
        apply_time=apply_time,
        confirm_deadline=confirm_deadline,
        operator=row_data["operator"]
    )
    db.add(waitlist_record)
    db.flush()

    if status_enum in [WaitlistStatus.CONFIRMED, WaitlistStatus.CONFIRMING]:
        conversion = ConversionRecord(
            conversion_no=f"CV{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4]}",
            waitlist_id=waitlist_record.id,
            original_status=WaitlistStatus.WAITING.value,
            target_status=status_enum.value,
            quota_source=row_data.get("quota_source", ""),
            operator=row_data["operator"]
        )
        db.add(conversion)
        class_schedule.used_quota += 1

    create_audit_log(db, "IMPORT_SUCCESS", "waitlist_records", waitlist_record.id,
                     operator=operator, new_value=json.dumps({"waitlist_no": row_data["waitlist_no"]}, ensure_ascii=False))

    return True, ImportRecordStatus.SUCCESS


def review_bad_row(db: Session, bad_row_id: int, manual_remark: str, operator: str):
    bad_row = db.query(ImportBadRow).filter(ImportBadRow.id == bad_row_id).first()
    if not bad_row:
        return None, "记录不存在"

    old_value = bad_row.status.value
    bad_row.status = ImportRecordStatus.REVIEWED
    bad_row.manual_remark = manual_remark
    bad_row.reviewed_by = operator
    bad_row.reviewed_at = datetime.now()

    create_audit_log(db, "REVIEW_BAD_ROW", "import_bad_rows", bad_row.id,
                     field_name="status", old_value=old_value, new_value=ImportRecordStatus.REVIEWED.value,
                     operator=operator)

    row_data = json.loads(bad_row.original_data)

    if bad_row.error_reason in [BadRowReason.ORDER_MISMATCH, BadRowReason.DUPLICATE_RECORD, BadRowReason.STATUS_SKIP]:
        class_schedule = get_or_create_class_schedule(
            db, row_data["class_name"], row_data["class_date"],
            row_data["start_time"], row_data["instructor"], operator
        )
        member = get_or_create_member(
            db, row_data["member_no"], row_data["member_name"],
            row_data["phone"], operator
        )

        apply_time = datetime.strptime(row_data["apply_time"], "%Y-%m-%d %H:%M:%S")

        if bad_row.error_reason == BadRowReason.DUPLICATE_RECORD:
            waitlist_record = db.query(WaitlistRecord).filter(
                WaitlistRecord.waitlist_no == row_data["waitlist_no"]
            ).first()
            old_status = waitlist_record.status.value
            waitlist_record.manual_remark = manual_remark
            create_audit_log(db, "UPDATE_WITH_REMARK", "waitlist_records", waitlist_record.id,
                             field_name="manual_remark", old_value="", new_value=manual_remark,
                             operator=operator)
        else:
            waitlist_record = WaitlistRecord(
                waitlist_no=row_data["waitlist_no"],
                class_schedule_id=class_schedule.id,
                member_id=member.id,
                waitlist_order=row_data["waitlist_order"],
                status=WaitlistStatus(row_data["status"]),
                apply_time=apply_time,
                manual_remark=manual_remark,
                operator=operator
            )
            db.add(waitlist_record)

        db.commit()
        return bad_row, "审核通过，记录已处理"

    db.commit()
    return bad_row, "审核通过，记录已标记"
