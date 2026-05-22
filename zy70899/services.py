import json
import uuid
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from models import TellerBoxHandover, AuditLog, FieldTrace, TaskStatus, DataCategory
from schemas import HandoverCreate, ConclusionUpdate, ProcessingResult


def json_serializer(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def generate_task_id() -> str:
    return f"HB{datetime.now().strftime('%Y%m%d')}{uuid.uuid4().hex[:8].upper()}"


class DataValidator:
    @staticmethod
    def check_missing_fields(data: dict) -> List[str]:
        required_fields = [
            'branch_id', 'handover_date', 'box_no', 'box_amount',
            'handler1_id', 'handler1_name', 'handler2_id', 'handler2_name'
        ]
        missing = []
        for field in required_fields:
            if not data.get(field):
                missing.append(field)
        return missing

    @staticmethod
    def check_time_conflict(handover_date: datetime, branch_id: str, db: Session, exclude_id: int = None) -> bool:
        query = db.query(TellerBoxHandover).filter(
            TellerBoxHandover.branch_id == branch_id,
            TellerBoxHandover.handover_date == handover_date
        )
        if exclude_id:
            query = query.filter(TellerBoxHandover.id != exclude_id)
        return query.first() is not None

    @staticmethod
    def check_duplicate_box_no(box_no: str, handover_date: datetime, db: Session, exclude_id: int = None) -> bool:
        query = db.query(TellerBoxHandover).filter(
            TellerBoxHandover.box_no == box_no,
            TellerBoxHandover.handover_date == handover_date
        )
        if exclude_id:
            query = query.filter(TellerBoxHandover.id != exclude_id)
        return query.first() is not None

    @staticmethod
    def check_double_confirmation(handler1_id: str, handler2_id: str) -> bool:
        return handler1_id and handler2_id and handler1_id != handler2_id

    @staticmethod
    def check_cross_day_requirements(is_cross_day: int, previous_unclosed_reason: str) -> Tuple[bool, str]:
        if is_cross_day == 1:
            if not previous_unclosed_reason:
                return False, "跨日交接必须提供上一班未闭合原因"
            return True, ""
        return True, ""


class DataClassifier:
    @staticmethod
    def classify(handover, db):
        errors = []
        missing_fields = []

        data_dict = {
            "branch_id": handover.branch_id,
            "handover_date": handover.handover_date,
            "box_no": handover.box_no,
            "box_amount": handover.box_amount,
            "handler1_id": handover.handler1_id,
            "handler1_name": handover.handler1_name,
            "handler2_id": handover.handler2_id,
            "handler2_name": handover.handler2_name,
        }

        missing = DataValidator.check_missing_fields(data_dict)
        if missing:
            missing_fields.extend(missing)

        if DataValidator.check_time_conflict(handover.handover_date, handover.branch_id, db, handover.id):
            errors.append("时间冲突")

        if DataValidator.check_duplicate_box_no(handover.box_no, handover.handover_date, db, handover.id):
            errors.append("尾箱编号重复")

        if not DataValidator.check_double_confirmation(handover.handler1_id, handover.handler2_id):
            errors.append("双人确认失败")

        cross_day_ok, cross_day_msg = DataValidator.check_cross_day_requirements(
            handover.is_cross_day, handover.previous_unclosed_reason
        )
        if not cross_day_ok:
            errors.append(cross_day_msg)

        if handover.box_amount < 0:
            errors.append("尾箱金额不能为负数")

        if missing_fields:
            return ProcessingResult(
                category=DataCategory.PENDING_SUPPLEMENT,
                category_reason="缺少必填字段",
                subsequent_action="请补充缺失字段后重新提交",
                error_details="原始材料位置"
            )

        if errors:
            return ProcessingResult(
                category=DataCategory.BLOCKED,
                category_reason="; ".join(errors),
                subsequent_action="数据存在严重问题",
                error_details="错误明细"
            )

        return ProcessingResult(
            category=DataCategory.NORMAL,
            category_reason="数据校验通过",
            subsequent_action="进入正常处理流程"
        )


class HandoverService:
    @staticmethod
    def create_handover(db, handover_data):
        task_id = generate_task_id()
        raw_data = json.dumps(handover_data.model_dump(), ensure_ascii=False, default=json_serializer)
        db_handover = TellerBoxHandover(
            task_id=task_id,
            branch_id=handover_data.branch_id,
            branch_name=handover_data.branch_name,
            handover_date=handover_data.handover_date,
            handover_type=handover_data.handover_type,
            box_no=handover_data.box_no,
            box_amount=handover_data.box_amount,
            error_no=handover_data.error_no,
            handler1_id=handover_data.handler1_id,
            handler1_name=handover_data.handler1_name,
            handler2_id=handover_data.handler2_id,
            handler2_name=handover_data.handler2_name,
            is_cross_day=handover_data.is_cross_day,
            previous_unclosed_reason=handover_data.previous_unclosed_reason,
            raw_data=raw_data,
            raw_data_position=handover_data.raw_data_position,
            created_by=handover_data.created_by,
            status=TaskStatus.PROCESSING
        )
        db.add(db_handover)
        db.commit()
        db.refresh(db_handover)
        result = DataClassifier.classify(db_handover, db)
        db_handover.category = result.category
        db_handover.category_reason = result.category_reason
        db_handover.subsequent_action = result.subsequent_action
        db_handover.error_details = result.error_details
        if result.category == DataCategory.BLOCKED:
            db_handover.status = TaskStatus.FAILED
        elif result.category == DataCategory.PENDING_SUPPLEMENT:
            db_handover.status = TaskStatus.MANUAL_CONFIRM
        db.commit()
        db.refresh(db_handover)
        return db_handover

    @staticmethod
    def get_handover_by_task_id(db, task_id):
        return db.query(TellerBoxHandover).filter(TellerBoxHandover.task_id == task_id).first()

    @staticmethod
    def list_handovers(db, skip=0, limit=100, status=None, category=None):
        query = db.query(TellerBoxHandover)
        if status:
            query = query.filter(TellerBoxHandover.status == status)
        if category:
            query = query.filter(TellerBoxHandover.category == category)
        total = query.count()
        items = query.order_by(TellerBoxHandover.created_at.desc()).offset(skip).limit(limit).all()
        return total, items

    @staticmethod
    def update_conclusion(db, task_id, update_data):
        handover = HandoverService.get_handover_by_task_id(db, task_id)
        if not handover:
            return None
        audit_log = AuditLog(
            handover_id=handover.id,
            task_id=task_id,
            field_changed=update_data.field_changed,
            old_value=update_data.old_value,
            new_value=update_data.new_value,
            change_reason=update_data.change_reason,
            changed_by_id=update_data.changed_by_id,
            changed_by_name=update_data.changed_by_name,
        )
        db.add(audit_log)
        if update_data.field_changed == "category":
            handover.category = update_data.new_value
        elif update_data.field_changed == "status":
            handover.status = update_data.new_value
        elif update_data.field_changed == "category_reason":
            handover.category_reason = update_data.new_value
        elif update_data.field_changed == "subsequent_action":
            handover.subsequent_action = update_data.new_value
        db.commit()
        db.refresh(audit_log)
        return audit_log

    @staticmethod
    def get_audit_logs(db, task_id):
        return db.query(AuditLog).filter(AuditLog.task_id == task_id).order_by(AuditLog.changed_at.desc()).all()

    @staticmethod
    def get_field_traces(db, task_id):
        return db.query(FieldTrace).filter(FieldTrace.task_id == task_id).all()

    @staticmethod
    def update_status(db, task_id, new_status):
        handover = HandoverService.get_handover_by_task_id(db, task_id)
        if not handover:
            return None
        handover.status = new_status
        db.commit()
        db.refresh(handover)
        return handover

    @staticmethod
    def get_raw_data(db, task_id):
        handover = HandoverService.get_handover_by_task_id(db, task_id)
        if not handover:
            return None
        return json.loads(handover.raw_data)
        )
        db.add(db_handover)
        db.commit()
        db.refresh(db_handover)
        result = DataClassifier.classify(db_handover, db)
        db_handover.category = result.category
        db_handover.category_reason = result.category_reason
        db_handover.subsequent_action = result.subsequent_action
        db_handover.error_details = result.error_details
        if result.category == DataCategory.BLOCKED:
            db_handover.status = TaskStatus.FAILED
        elif result.category == DataCategory.PENDING_SUPPLEMENT:
            db_handover.status = TaskStatus.MANUAL_CONFIRM
        db.commit()
        db.refresh(db_handover)
        HandoverService.create_field_traces(db, db_handover)
        return db_handover

    @staticmethod
    def create_field_traces(db, handover):
        key_fields = [
            ("box_no", handover.box_no),
            ("box_amount", str(handover.box_amount)),
            ("handover_date", handover.handover_date.isoformat()),
            ("handler1_id", handover.handler1_id),
            ("handler2_id", handover.handler2_id),
        ]
        for field_name, value in key_fields:
            trace = FieldTrace(
                handover_id=handover.id,
                task_id=handover.task_id,
                field_name=field_name,
                raw_value=value,
                processed_value=value,
                final_value=value,
                trace_path="原始输入 -> 校验处理 -> 分类结果: {}".format(handover.category)
            )
            db.add(trace)
        db.commit()

    @staticmethod
    def get_handover_by_task_id(db, task_id):
        return db.query(TellerBoxHandover).filter(TellerBoxHandover.task_id == task_id).first()

    @staticmethod
    def list_handovers(db, skip=0, limit=100, status=None, category=None):
        query = db.query(TellerBoxHandover)
        if status:
            query = query.filter(TellerBoxHandover.status == status)
        if category:
            query = query.filter(TellerBoxHandover.category == category)
        total = query.count()
        items = query.order_by(TellerBoxHandover.created_at.desc()).offset(skip).limit(limit).all()
        return total, items

    @staticmethod
    def update_conclusion(db, task_id, update_data):
        handover = HandoverService.get_handover_by_task_id(db, task_id)
        if not handover:
            return None
        audit_log = AuditLog(
            handover_id=handover.id,
            task_id=task_id,
            field_changed=update_data.field_changed,
            old_value=update_data.old_value,
            new_value=update_data.new_value,
            change_reason=update_data.change_reason,
            changed_by_id=update_data.changed_by_id,
            changed_by_name=update_data.changed_by_name,
        )
        db.add(audit_log)
        if update_data.field_changed == "category":
            handover.category = update_data.new_value
        elif update_data.field_changed == "status":
            handover.status = update_data.new_value
        elif update_data.field_changed == "category_reason":
            handover.category_reason = update_data.new_value
        elif update_data.field_changed == "subsequent_action":
            handover.subsequent_action = update_data.new_value
        db.commit()
        db.refresh(audit_log)
        return audit_log

    @staticmethod
    def get_audit_logs(db, task_id):
        return db.query(AuditLog).filter(AuditLog.task_id == task_id).order_by(AuditLog.changed_at.desc()).all()

    @staticmethod
    def get_field_traces(db, task_id):
        return db.query(FieldTrace).filter(FieldTrace.task_id == task_id).all()

    @staticmethod
    def update_status(db, task_id, new_status):
        handover = HandoverService.get_handover_by_task_id(db, task_id)
        if not handover:
            return None
        handover.status = new_status
        db.commit()
        db.refresh(handover)
        return handover

    @staticmethod
    def get_raw_data(db, task_id):
        handover = HandoverService.get_handover_by_task_id(db, task_id)
        if not handover:
            return None
        return json.loads(handover.raw_data)
        db.add(db_handover)
        db.commit()
        db.refresh(db_handover)
        result = DataClassifier.classify(db_handover, db)
        db_handover.category = result.category
        db_handover.category_reason = result.category_reason
        db_handover.subsequent_action = result.subsequent_action
        db_handover.error_details = result.error_details
        if result.category == DataCategory.BLOCKED:
            db_handover.status = TaskStatus.FAILED
        elif result.category == DataCategory.PENDING_SUPPLEMENT:
            db_handover.status = TaskStatus.MANUAL_CONFIRM
        db.commit()
        db.refresh(db_handover)
        HandoverService.create_field_traces(db, db_handover)
        return db_handover

    @staticmethod
    def create_field_traces(db, handover):
        key_fields = [
            ("box_no", handover.box_no),
            ("box_amount", str(handover.box_amount)),
            ("handover_date", handover.handover_date.isoformat()),
            ("handler1_id", handover.handler1_id),
            ("handler2_id", handover.handler2_id),
        ]
        for field_name, value in key_fields:
            trace = FieldTrace(
                handover_id=handover.id,
                task_id=handover.task_id,
                field_name=field_name,
                raw_value=value,
                processed_value=value,
                final_value=value,
                trace_path="原始输入 -> 校验处理 -> 分类结果: {}".format(handover.category)
            )
            db.add(trace)
        db.commit()

    @staticmethod
    def get_handover_by_task_id(db, task_id):
        return db.query(TellerBoxHandover).filter(TellerBoxHandover.task_id == task_id).first()

    @staticmethod
    def list_handovers(db, skip=0, limit=100, status=None, category=None):
        query = db.query(TellerBoxHandover)
        if status:
            query = query.filter(TellerBoxHandover.status == status)
        if category:
            query = query.filter(TellerBoxHandover.category == category)
        total = query.count()
        items = query.order_by(TellerBoxHandover.created_at.desc()).offset(skip).limit(limit).all()
        return total, items

    @staticmethod
    def update_conclusion(db, task_id, update_data):
        handover = HandoverService.get_handover_by_task_id(db, task_id)
        if not handover:
            return None
        audit_log = AuditLog(
            handover_id=handover.id,
            task_id=task_id,
            field_changed=update_data.field_changed,
            old_value=update_data.old_value,
            new_value=update_data.new_value,
            change_reason=update_data.change_reason,
            changed_by_id=update_data.changed_by_id,
            changed_by_name=update_data.changed_by_name,
        )
        db.add(audit_log)
        if update_data.field_changed == "category":
            handover.category = update_data.new_value
        elif update_data.field_changed == "status":
            handover.status = update_data.new_value
        elif update_data.field_changed == "category_reason":
            handover.category_reason = update_data.new_value
        elif update_data.field_changed == "subsequent_action":
            handover.subsequent_action = update_data.new_value
        db.commit()
        db.refresh(audit_log)
        return audit_log

    @staticmethod
    def get_audit_logs(db, task_id):
        return db.query(AuditLog).filter(AuditLog.task_id == task_id).order_by(AuditLog.changed_at.desc()).all()

    @staticmethod
    def get_field_traces(db, task_id):
        return db.query(FieldTrace).filter(FieldTrace.task_id == task_id).all()

    @staticmethod
    def update_status(db, task_id, new_status):
        handover = HandoverService.get_handover_by_task_id(db, task_id)
        if not handover:
            return None
        handover.status = new_status
        db.commit()
        db.refresh(handover)
        return handover

    @staticmethod
    def get_raw_data(db, task_id):
        handover = HandoverService.get_handover_by_task_id(db, task_id)
        if not handover:
            return None
        return json.loads(handover.raw_data)
            status=TaskStatus.PROCESSING
        )
        db.add(db_handover)
        db.commit()
        db.refresh(db_handover)
        result = DataClassifier.classify(db_handover, db)
        db_handover.category = result.category
        db_handover.category_reason = result.category_reason
        db_handover.subsequent_action = result.subsequent_action
        db_handover.error_details = result.error_details
        if result.category == DataCategory.BLOCKED:
            db_handover.status = TaskStatus.FAILED
        elif result.category == DataCategory.PENDING_SUPPLEMENT:
            db_handover.status = TaskStatus.MANUAL_CONFIRM
        db.commit()
        db.refresh(db_handover)
        HandoverService.create_field_traces(db, db_handover)
        return db_handover

    @staticmethod
    def create_field_traces(db, handover):
        key_fields = [
            ("box_no", handover.box_no),
            ("box_amount", str(handover.box_amount)),
            ("handover_date", handover.handover_date.isoformat()),
            ("handler1_id", handover.handler1_id),
            ("handler2_id", handover.handler2_id),
        ]
        for field_name, value in key_fields:
            trace = FieldTrace(
                handover_id=handover.id,
                task_id=handover.task_id,
                field_name=field_name,
                raw_value=value,
                processed_value=value,
                final_value=value,
                trace_path="原始输入 -> 校验处理 -> 分类结果: {}".format(handover.category)
            )
            db.add(trace)
        db.commit()

    @staticmethod
    def get_handover_by_task_id(db, task_id):
        return db.query(TellerBoxHandover).filter(TellerBoxHandover.task_id == task_id).first()

    @staticmethod
    def list_handovers(db, skip=0, limit=100, status=None, category=None):
        query = db.query(TellerBoxHandover)
        if status:
            query = query.filter(TellerBoxHandover.status == status)
        if category:
            query = query.filter(TellerBoxHandover.category == category)
        total = query.count()
        items = query.order_by(TellerBoxHandover.created_at.desc()).offset(skip).limit(limit).all()
        return total, items

    @staticmethod
    def update_conclusion(db, task_id, update_data):
        handover = HandoverService.get_handover_by_task_id(db, task_id)
        if not handover:
            return None
        audit_log = AuditLog(
            handover_id=handover.id,
            task_id=task_id,
            field_changed=update_data.field_changed,
            old_value=update_data.old_value,
            new_value=update_data.new_value,
            change_reason=update_data.change_reason,
            changed_by_id=update_data.changed_by_id,
            changed_by_name=update_data.changed_by_name,
        )
        db.add(audit_log)
        if update_data.field_changed == "category":
            handover.category = update_data.new_value
        elif update_data.field_changed == "status":
            handover.status = update_data.new_value
        elif update_data.field_changed == "category_reason":
            handover.category_reason = update_data.new_value
        elif update_data.field_changed == "subsequent_action":
            handover.subsequent_action = update_data.new_value
        db.commit()
        db.refresh(audit_log)
        return audit_log

    @staticmethod
    def get_audit_logs(db, task_id):
        return db.query(AuditLog).filter(AuditLog.task_id == task_id).order_by(AuditLog.changed_at.desc()).all()

    @staticmethod
    def get_field_traces(db, task_id):
        return db.query(FieldTrace).filter(FieldTrace.task_id == task_id).all()

    @staticmethod
    def update_status(db, task_id, new_status):
        handover = HandoverService.get_handover_by_task_id(db, task_id)
        if not handover:
            return None
        handover.status = new_status
        db.commit()
        db.refresh(handover)
        return handover

    @staticmethod
    def get_raw_data(db, task_id):
        handover = HandoverService.get_handover_by_task_id(db, task_id)
        if not handover:
            return None
        return json.loads(handover.raw_data)
        )
        db.add(db_handover)
        db.commit()
        db.refresh(db_handover)
        result = DataClassifier.classify(db_handover, db)
        db_handover.category = result.category
        db_handover.category_reason = result.category_reason
        db_handover.subsequent_action = result.subsequent_action
        db_handover.error_details = result.error_details
        if result.category == DataCategory.BLOCKED:
            db_handover.status = TaskStatus.FAILED
        elif result.category == DataCategory.PENDING_SUPPLEMENT:
            db_handover.status = TaskStatus.MANUAL_CONFIRM
        db.commit()
        db.refresh(db_handover)
        HandoverService.create_field_traces(db, db_handover)
        return db_handover

    @staticmethod
    def create_field_traces(db, handover):
        key_fields = [
            ("box_no", handover.box_no),
            ("box_amount", str(handover.box_amount)),
            ("handover_date", handover.handover_date.isoformat()),
            ("handler1_id", handover.handler1_id),
            ("handler2_id", handover.handler2_id),
        ]
        for field_name, value in key_fields:
            trace = FieldTrace(
                handover_id=handover.id,
                task_id=handover.task_id,
                field_name=field_name,
                raw_value=value,
                processed_value=value,
                final_value=value,
                trace_path="原始输入 -> 校验处理 -> 分类结果: {}".format(handover.category)
            )
            db.add(trace)
        db.commit()

    @staticmethod
    def get_handover_by_task_id(db, task_id):
        return db.query(TellerBoxHandover).filter(TellerBoxHandover.task_id == task_id).first()

    @staticmethod
    def list_handovers(db, skip=0, limit=100, status=None, category=None):
        query = db.query(TellerBoxHandover)
        if status:
            query = query.filter(TellerBoxHandover.status == status)
        if category:
            query = query.filter(TellerBoxHandover.category == category)
        total = query.count()
        items = query.order_by(TellerBoxHandover.created_at.desc()).offset(skip).limit(limit).all()
        return total, items

    @staticmethod
    def update_conclusion(db, task_id, update_data):
        handover = HandoverService.get_handover_by_task_id(db, task_id)
        if not handover:
            return None
        audit_log = AuditLog(
            handover_id=handover.id,
            task_id=task_id,
            field_changed=update_data.field_changed,
            old_value=update_data.old_value,
            new_value=update_data.new_value,
            change_reason=update_data.change_reason,
            changed_by_id=update_data.changed_by_id,
            changed_by_name=update_data.changed_by_name,
        )
        db.add(audit_log)
        if update_data.field_changed == "category":
            handover.category = update_data.new_value
        elif update_data.field_changed == "status":
            handover.status = update_data.new_value
        elif update_data.field_changed == "category_reason":
            handover.category_reason = update_data.new_value
        elif update_data.field_changed == "subsequent_action":
            handover.subsequent_action = update_data.new_value
        db.commit()
        db.refresh(audit_log)
        return audit_log

    @staticmethod
    def get_audit_logs(db, task_id):
        return db.query(AuditLog).filter(AuditLog.task_id == task_id).order_by(AuditLog.changed_at.desc()).all()

    @staticmethod
    def get_field_traces(db, task_id):
        return db.query(FieldTrace).filter(FieldTrace.task_id == task_id).all()

    @staticmethod
    def update_status(db, task_id, new_status):
        handover = HandoverService.get_handover_by_task_id(db, task_id)
        if not handover:
            return None
        handover.status = new_status
        db.commit()
        db.refresh(handover)
        return handover

    @staticmethod
    def get_raw_data(db, task_id):
        handover = HandoverService.get_handover_by_task_id(db, task_id)
        if not handover:
            return None
        return json.loads(handover.raw_data)
        )
        db.add(db_handover)
        db.commit()
        db.refresh(db_handover)
        result = DataClassifier.classify(db_handover, db)
        db_handover.category = result.category
        db_handover.category_reason = result.category_reason
        db_handover.subsequent_action = result.subsequent_action
        db_handover.error_details = result.error_details
        if result.category == DataCategory.BLOCKED:
            db_handover.status = TaskStatus.FAILED
        elif result.category == DataCategory.PENDING_SUPPLEMENT:
            db_handover.status = TaskStatus.MANUAL_CONFIRM
        db.commit()
        db.refresh(db_handover)
        HandoverService.create_field_traces(db, db_handover)
        return db_handover

    @staticmethod
    def create_field_traces(db, handover):
        key_fields = [
            ("box_no", handover.box_no),
            ("box_amount", str(handover.box_amount)),
            ("handover_date", handover.handover_date.isoformat()),
            ("handler1_id", handover.handler1_id),
            ("handler2_id", handover.handler2_id),
        ]
        for field_name, value in key_fields:
            trace = FieldTrace(
                handover_id=handover.id,
                task_id=handover.task_id,
                field_name=field_name,
                raw_value=value,
                processed_value=value,
                final_value=value,
                trace_path="原始输入 -> 校验处理 -> 分类结果: {}".format(handover.category)
            )
            db.add(trace)
        db.commit()

    @staticmethod
    def get_handover_by_task_id(db, task_id):
        return db.query(TellerBoxHandover).filter(TellerBoxHandover.task_id == task_id).first()

    @staticmethod
    def list_handovers(db, skip=0, limit=100, status=None, category=None):
        query = db.query(TellerBoxHandover)
        if status:
            query = query.filter(TellerBoxHandover.status == status)
        if category:
            query = query.filter(TellerBoxHandover.category == category)
        total = query.count()
        items = query.order_by(TellerBoxHandover.created_at.desc()).offset(skip).limit(limit).all()
        return total, items

    @staticmethod
    def update_conclusion(db, task_id, update_data):
        handover = HandoverService.get_handover_by_task_id(db, task_id)
        if not handover:
            return None
        audit_log = AuditLog(
            handover_id=handover.id,
            task_id=task_id,
            field_changed=update_data.field_changed,
            old_value=update_data.old_value,
            new_value=update_data.new_value,
            change_reason=update_data.change_reason,
            changed_by_id=update_data.changed_by_id,
            changed_by_name=update_data.changed_by_name,
        )
        db.add(audit_log)
        if update_data.field_changed == "category":
            handover.category = update_data.new_value
        elif update_data.field_changed == "status":
            handover.status = update_data.new_value
        elif update_data.field_changed == "category_reason":
            handover.category_reason = update_data.new_value
        elif update_data.field_changed == "subsequent_action":
            handover.subsequent_action = update_data.new_value
        db.commit()
        db.refresh(audit_log)
        return audit_log

    @staticmethod
    def get_audit_logs(db, task_id):
        return db.query(AuditLog).filter(AuditLog.task_id == task_id).order_by(AuditLog.changed_at.desc()).all()

    @staticmethod
    def get_field_traces(db, task_id):
        return db.query(FieldTrace).filter(FieldTrace.task_id == task_id).all()

    @staticmethod
    def update_status(db, task_id, new_status):
        handover = HandoverService.get_handover_by_task_id(db, task_id)
        if not handover:
            return None
        handover.status = new_status
        db.commit()
        db.refresh(handover)
        return handover

    @staticmethod
    def get_raw_data(db, task_id):
        handover = HandoverService.get_handover_by_task_id(db, task_id)
        if not handover:
            return None
        return json.loads(handover.raw_data)
