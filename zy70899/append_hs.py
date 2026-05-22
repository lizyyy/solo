#!/usr/bin/env python3
# -*- coding: utf-8 -*-

code = '''

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
'''

with open('services.py', 'a') as f:
    f.write(code)

print('HandoverService added successfully!')
print('Total lines:', sum(1 for _ in open('services.py')))
