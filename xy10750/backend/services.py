from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, and_, func
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import uuid
import json
import os
import pandas as pd
from database import (
    UserPreference, SendReceipt, RetryRecord, VersionHistory,
    IdempotentRequest, ExportRecord
)
from schemas import (
    UserPreferenceCreate, UserPreferenceUpdate,
    SendReceiptCreate, SendReceiptUpdate,
    RetryRecordCreate, RetryConfirm,
    ExportRequest
)


class IdempotentService:
    @staticmethod
    def check_idempotent(db: Session, request_id: str) -> Optional[Dict[str, Any]]:
        record = db.query(IdempotentRequest).filter(
            IdempotentRequest.request_id == request_id
        ).first()
        if record:
            return {
                "request_id": record.request_id,
                "status": record.status,
                "result": record.result,
                "error_message": record.error_message,
                "created_at": record.created_at,
                "is_duplicate": True
            }
        return None

    @staticmethod
    def create_idempotent_record(
        db: Session, request_id: str, request_type: str, user_id: str = None
    ) -> IdempotentRequest:
        record = IdempotentRequest(
            request_id=request_id,
            request_type=request_type,
            user_id=user_id,
            status="processing"
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def complete_idempotent_record(
        db: Session, request_id: str, result: Dict[str, Any], error_message: str = None
    ):
        record = db.query(IdempotentRequest).filter(
            IdempotentRequest.request_id == request_id
        ).first()
        if record:
            record.status = "completed" if error_message is None else "failed"
            record.result = result
            record.error_message = error_message
            record.completed_at = datetime.utcnow()
            db.commit()


class PreferenceService:
    @staticmethod
    def create_preference(db: Session, preference_data: UserPreferenceCreate):
        idempotent_result = IdempotentService.check_idempotent(db, preference_data.request_id)
        if idempotent_result:
            return idempotent_result

        IdempotentService.create_idempotent_record(
            db, preference_data.request_id, "create_preference", preference_data.user_id
        )

        existing = db.query(UserPreference).filter(
            UserPreference.user_id == preference_data.user_id,
            UserPreference.channel == preference_data.channel,
            UserPreference.status == "active"
        ).first()

        if existing:
            result = {"error": "Preference already exists for this user and channel"}
            IdempotentService.complete_idempotent_record(
                db, preference_data.request_id, result, result["error"]
            )
            raise ValueError(result["error"])

        preference = UserPreference(
            user_id=preference_data.user_id,
            request_id=preference_data.request_id,
            channel=preference_data.channel,
            topics=preference_data.topics,
            dnd_start_time=preference_data.dnd_start_time,
            dnd_end_time=preference_data.dnd_end_time,
            dnd_enabled=preference_data.dnd_enabled,
            created_by=preference_data.created_by,
            metadata=preference_data.metadata
        )
        db.add(preference)
        db.commit()
        db.refresh(preference)

        version = VersionHistory(
            preference_id=preference.id,
            user_id=preference.user_id,
            version=1,
            channel=preference.channel,
            topics=preference.topics,
            dnd_start_time=preference.dnd_start_time,
            dnd_end_time=preference.dnd_end_time,
            dnd_enabled=preference.dnd_enabled,
            status=preference.status,
            change_reason="Initial creation",
            changed_by=preference.created_by,
            snapshot={
                "user_id": preference.user_id,
                "channel": preference.channel,
                "topics": preference.topics,
                "dnd_start_time": preference.dnd_start_time,
                "dnd_end_time": preference.dnd_end_time,
                "dnd_enabled": preference.dnd_enabled,
                "status": preference.status
            }
        )
        db.add(version)
        db.commit()

        result = {"id": preference.id, "user_id": preference.user_id, "version": 1}
        IdempotentService.complete_idempotent_record(db, preference_data.request_id, result)
        return preference

    @staticmethod
    def update_preference(db: Session, preference_id: int, update_data: UserPreferenceUpdate):
        idempotent_result = IdempotentService.check_idempotent(db, update_data.request_id)
        if idempotent_result:
            return idempotent_result

        IdempotentService.create_idempotent_record(
            db, update_data.request_id, "update_preference"
        )

        preference = db.query(UserPreference).filter(UserPreference.id == preference_id).first()
        if not preference:
            error = "Preference not found"
            IdempotentService.complete_idempotent_record(db, update_data.request_id, {}, error)
            raise ValueError(error)

        old_version = preference.version
        new_version = old_version + 1

        old_snapshot = {
            "user_id": preference.user_id,
            "channel": preference.channel,
            "topics": preference.topics,
            "dnd_start_time": preference.dnd_start_time,
            "dnd_end_time": preference.dnd_end_time,
            "dnd_enabled": preference.dnd_enabled,
            "status": preference.status
        }

        if update_data.channel is not None:
            preference.channel = update_data.channel
        if update_data.topics is not None:
            preference.topics = update_data.topics
        if update_data.dnd_start_time is not None:
            preference.dnd_start_time = update_data.dnd_start_time
        if update_data.dnd_end_time is not None:
            preference.dnd_end_time = update_data.dnd_end_time
        if update_data.dnd_enabled is not None:
            preference.dnd_enabled = update_data.dnd_enabled
        if update_data.status is not None:
            preference.status = update_data.status

        preference.version = new_version
        preference.updated_by = update_data.updated_by
        preference.updated_at = datetime.utcnow()

        version = VersionHistory(
            preference_id=preference.id,
            user_id=preference.user_id,
            version=new_version,
            channel=preference.channel,
            topics=preference.topics,
            dnd_start_time=preference.dnd_start_time,
            dnd_end_time=preference.dnd_end_time,
            dnd_enabled=preference.dnd_enabled,
            status=preference.status,
            change_reason=update_data.change_reason,
            changed_by=update_data.updated_by,
            snapshot=old_snapshot
        )
        db.add(version)
        db.commit()
        db.refresh(preference)

        result = {"id": preference.id, "version": new_version}
        IdempotentService.complete_idempotent_record(db, update_data.request_id, result)
        return preference

    @staticmethod
    def rollback_preference(db: Session, preference_id: int, version_number: int, changed_by: str):
        preference = db.query(UserPreference).filter(UserPreference.id == preference_id).first()
        if not preference:
            raise ValueError("Preference not found")

        version_history = db.query(VersionHistory).filter(
            VersionHistory.preference_id == preference_id,
            VersionHistory.version == version_number
        ).first()
        if not version_history:
            raise ValueError("Version not found")

        snapshot = version_history.snapshot
        old_version = preference.version
        new_version = old_version + 1

        old_snapshot = {
            "user_id": preference.user_id,
            "channel": preference.channel,
            "topics": preference.topics,
            "dnd_start_time": preference.dnd_start_time,
            "dnd_end_time": preference.dnd_end_time,
            "dnd_enabled": preference.dnd_enabled,
            "status": preference.status
        }

        preference.channel = snapshot.get("channel", preference.channel)
        preference.topics = snapshot.get("topics", preference.topics)
        preference.dnd_start_time = snapshot.get("dnd_start_time")
        preference.dnd_end_time = snapshot.get("dnd_end_time")
        preference.dnd_enabled = snapshot.get("dnd_enabled", False)
        preference.status = snapshot.get("status", "active")
        preference.version = new_version
        preference.updated_by = changed_by
        preference.updated_at = datetime.utcnow()

        version = VersionHistory(
            preference_id=preference.id,
            user_id=preference.user_id,
            version=new_version,
            channel=preference.channel,
            topics=preference.topics,
            dnd_start_time=preference.dnd_start_time,
            dnd_end_time=preference.dnd_end_time,
            dnd_enabled=preference.dnd_enabled,
            status=preference.status,
            change_reason=f"Rollback to version {version_number}",
            changed_by=changed_by,
            snapshot=old_snapshot
        )
        db.add(version)
        db.commit()
        db.refresh(preference)
        return preference

    @staticmethod
    def get_preferences(
        db: Session,
        user_id: str = None,
        channel: str = None,
        status: str = None,
        page: int = 1,
        page_size: int = 20
    ):
        query = db.query(UserPreference)
        
        if user_id:
            query = query.filter(UserPreference.user_id == user_id)
        if channel:
            query = query.filter(UserPreference.channel == channel)
        if status:
            query = query.filter(UserPreference.status == status)

        total = query.count()
        preferences = query.order_by(desc(UserPreference.updated_at)).offset(
            (page - 1) * page_size
        ).limit(page_size).all()

        return {"total": total, "data": preferences, "page": page, "page_size": page_size}

    @staticmethod
    def get_preference_by_id(db: Session, preference_id: int):
        return db.query(UserPreference).filter(UserPreference.id == preference_id).first()

    @staticmethod
    def get_version_history(db: Session, preference_id: int):
        return db.query(VersionHistory).filter(
            VersionHistory.preference_id == preference_id
        ).order_by(desc(VersionHistory.version)).all()


class ReceiptService:
    @staticmethod
    def create_receipt(db: Session, receipt_data: SendReceiptCreate):
        idempotent_result = IdempotentService.check_idempotent(db, receipt_data.message_id)
        if idempotent_result:
            return idempotent_result

        IdempotentService.create_idempotent_record(
            db, receipt_data.message_id, "create_receipt", receipt_data.user_id
        )

        receipt = SendReceipt(
            message_id=receipt_data.message_id,
            preference_id=receipt_data.preference_id,
            user_id=receipt_data.user_id,
            request_id=receipt_data.request_id,
            channel=receipt_data.channel,
            topic=receipt_data.topic,
            metadata=receipt_data.metadata
        )
        db.add(receipt)
        db.commit()
        db.refresh(receipt)

        result = {"id": receipt.id, "message_id": receipt.message_id}
        IdempotentService.complete_idempotent_record(db, receipt_data.message_id, result)
        return receipt

    @staticmethod
    def update_receipt(db: Session, receipt_id: int, update_data: SendReceiptUpdate):
        receipt = db.query(SendReceipt).filter(SendReceipt.id == receipt_id).first()
        if not receipt:
            raise ValueError("Receipt not found")

        receipt.status = update_data.status
        receipt.error_code = update_data.error_code
        receipt.error_message = update_data.error_message

        now = datetime.utcnow()
        if update_data.status == "sent":
            receipt.sent_at = now
        elif update_data.status == "delivered":
            receipt.delivered_at = now
        elif update_data.status == "read":
            receipt.read_at = now
        elif update_data.status == "failed":
            receipt.failed_at = now

        if update_data.metadata:
            receipt.metadata = {**receipt.metadata, **update_data.metadata}

        db.commit()
        db.refresh(receipt)
        return receipt

    @staticmethod
    def get_receipts(
        db: Session,
        user_id: str = None,
        channel: str = None,
        status: str = None,
        has_error: bool = None,
        page: int = 1,
        page_size: int = 20
    ):
        query = db.query(SendReceipt)
        
        if user_id:
            query = query.filter(SendReceipt.user_id == user_id)
        if channel:
            query = query.filter(SendReceipt.channel == channel)
        if status:
            query = query.filter(SendReceipt.status == status)
        if has_error is True:
            query = query.filter(SendReceipt.error_message.isnot(None))
        elif has_error is False:
            query = query.filter(SendReceipt.error_message.is_(None))

        total = query.count()
        receipts = query.order_by(desc(SendReceipt.created_at)).offset(
            (page - 1) * page_size
        ).limit(page_size).all()

        return {"total": total, "data": receipts, "page": page, "page_size": page_size}

    @staticmethod
    def get_abnormal_receipts(db: Session, page: int = 1, page_size: int = 20):
        query = db.query(SendReceipt).filter(
            or_(
                SendReceipt.status == "failed",
                and_(
                    SendReceipt.status == "pending",
                    SendReceipt.created_at < datetime.utcnow() - timedelta(hours=24)
                )
            )
        )
        
        total = query.count()
        receipts = query.order_by(desc(SendReceipt.created_at)).offset(
            (page - 1) * page_size
        ).limit(page_size).all()

        return {"total": total, "data": receipts, "page": page, "page_size": page_size}


class RetryService:
    @staticmethod
    def create_retry_record(db: Session, retry_data: RetryRecordCreate):
        retry = RetryRecord(
            receipt_id=retry_data.receipt_id,
            preference_id=retry_data.preference_id,
            retry_number=retry_data.retry_number,
            metadata=retry_data.metadata
        )
        db.add(retry)
        db.commit()
        db.refresh(retry)
        return retry

    @staticmethod
    def confirm_retry(db: Session, retry_id: int, confirm_data: RetryConfirm):
        retry = db.query(RetryRecord).filter(RetryRecord.id == retry_id).first()
        if not retry:
            raise ValueError("Retry record not found")

        if retry.status != "pending":
            raise ValueError("Retry record is not in pending status")

        retry.manual_confirmed = True
        retry.confirmed_by = confirm_data.confirmed_by
        retry.confirmed_at = datetime.utcnow()
        retry.status = "confirmed"

        if confirm_data.metadata:
            retry.metadata = {**retry.metadata, **confirm_data.metadata}

        db.commit()
        db.refresh(retry)
        return retry

    @staticmethod
    def execute_retry(db: Session, retry_id: int):
        retry = db.query(RetryRecord).filter(RetryRecord.id == retry_id).first()
        if not retry:
            raise ValueError("Retry record not found")

        if retry.status != "confirmed":
            raise ValueError("Retry record is not confirmed")

        receipt = db.query(SendReceipt).filter(SendReceipt.id == retry.receipt_id).first()
        if not receipt:
            raise ValueError("Associated receipt not found")

        retry.executed_at = datetime.utcnow()
        receipt.retry_count = receipt.retry_count + 1

        try:
            retry.status = "executed"
            retry.result = "success"
            receipt.status = "sent"
            receipt.sent_at = datetime.utcnow()
            receipt.error_message = None
            receipt.error_code = None
        except Exception as e:
            retry.status = "failed"
            retry.error_message = str(e)
            raise e
        finally:
            db.commit()
            db.refresh(retry)
            db.refresh(receipt)

        return retry

    @staticmethod
    def get_retry_records(
        db: Session,
        receipt_id: int = None,
        status: str = None,
        manual_confirmed: bool = None,
        page: int = 1,
        page_size: int = 20
    ):
        query = db.query(RetryRecord)
        
        if receipt_id:
            query = query.filter(RetryRecord.receipt_id == receipt_id)
        if status:
            query = query.filter(RetryRecord.status == status)
        if manual_confirmed is not None:
            query = query.filter(RetryRecord.manual_confirmed == manual_confirmed)

        total = query.count()
        records = query.order_by(desc(RetryRecord.created_at)).offset(
            (page - 1) * page_size
        ).limit(page_size).all()

        return {"total": total, "data": records, "page": page, "page_size": page_size}


class ExportService:
    EXPORT_DIR = "./exports"

    @classmethod
    def ensure_export_dir(cls):
        if not os.path.exists(cls.EXPORT_DIR):
            os.makedirs(cls.EXPORT_DIR)

    @staticmethod
    def create_export_task(db: Session, export_data: ExportRequest):
        export_id = str(uuid.uuid4())
        export_record = ExportRecord(
            export_id=export_id,
            export_type=export_data.export_type,
            filters=export_data.filters,
            created_by=export_data.created_by
        )
        db.add(export_record)
        db.commit()
        db.refresh(export_record)
        return export_record

    @classmethod
    def execute_export(cls, db: Session, export_id: str):
        export_record = db.query(ExportRecord).filter(
            ExportRecord.export_id == export_id
        ).first()
        if not export_record:
            raise ValueError("Export record not found")

        cls.ensure_export_dir()
        export_type = export_record.export_type
        filters = export_record.filters or {}

        try:
            if export_type == "preferences":
                data = cls._export_preferences(db, filters)
            elif export_type == "receipts":
                data = cls._export_receipts(db, filters)
            elif export_type == "retry_records":
                data = cls._export_retry_records(db, filters)
            elif export_type == "report":
                data = cls._export_report(db, filters)
            else:
                raise ValueError(f"Unknown export type: {export_type}")

            file_name = f"{export_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
            file_path = os.path.join(cls.EXPORT_DIR, file_name)

            df = pd.DataFrame(data)
            df.to_excel(file_path, index=False)

            export_record.file_path = file_path
            export_record.file_name = file_name
            export_record.status = "completed"
            export_record.total_records = len(data)
            export_record.completed_at = datetime.utcnow()

        except Exception as e:
            export_record.status = "failed"
            export_record.error_message = str(e)
            raise e
        finally:
            db.commit()

        return export_record

    @staticmethod
    def _export_preferences(db: Session, filters: Dict[str, Any]):
        query = db.query(UserPreference)
        if filters.get("user_id"):
            query = query.filter(UserPreference.user_id == filters["user_id"])
        if filters.get("channel"):
            query = query.filter(UserPreference.channel == filters["channel"])
        if filters.get("status"):
            query = query.filter(UserPreference.status == filters["status"])

        preferences = query.all()
        return [
            {
                "ID": p.id,
                "用户ID": p.user_id,
                "渠道": p.channel,
                "订阅主题": ",".join(p.topics) if p.topics else "",
                "免打扰启用": "是" if p.dnd_enabled else "否",
                "免打扰开始时间": p.dnd_start_time or "",
                "免打扰结束时间": p.dnd_end_time or "",
                "状态": p.status,
                "版本": p.version,
                "创建时间": p.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "更新时间": p.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
            }
            for p in preferences
        ]

    @staticmethod
    def _export_receipts(db: Session, filters: Dict[str, Any]):
        query = db.query(SendReceipt)
        if filters.get("user_id"):
            query = query.filter(SendReceipt.user_id == filters["user_id"])
        if filters.get("status"):
            query = query.filter(SendReceipt.status == filters["status"])

        receipts = query.all()
        return [
            {
                "ID": r.id,
                "消息ID": r.message_id,
                "用户ID": r.user_id,
                "渠道": r.channel,
                "主题": r.topic,
                "状态": r.status,
                "发送时间": r.sent_at.strftime("%Y-%m-%d %H:%M:%S") if r.sent_at else "",
                "送达时间": r.delivered_at.strftime("%Y-%m-%d %H:%M:%S") if r.delivered_at else "",
                "阅读时间": r.read_at.strftime("%Y-%m-%d %H:%M:%S") if r.read_at else "",
                "失败时间": r.failed_at.strftime("%Y-%m-%d %H:%M:%S") if r.failed_at else "",
                "错误码": r.error_code or "",
                "错误信息": r.error_message or "",
                "重试次数": r.retry_count,
            }
            for r in receipts
        ]

    @staticmethod
    def _export_retry_records(db: Session, filters: Dict[str, Any]):
        query = db.query(RetryRecord)
        if filters.get("status"):
            query = query.filter(RetryRecord.status == filters["status"])

        records = query.all()
        return [
            {
                "ID": r.id,
                "回执ID": r.receipt_id,
                "重试次数": r.retry_number,
                "状态": r.status,
                "人工确认": "是" if r.manual_confirmed else "否",
                "确认人": r.confirmed_by or "",
                "确认时间": r.confirmed_at.strftime("%Y-%m-%d %H:%M:%S") if r.confirmed_at else "",
                "执行时间": r.executed_at.strftime("%Y-%m-%d %H:%M:%S") if r.executed_at else "",
                "执行结果": r.result or "",
                "错误信息": r.error_message or "",
            }
            for r in records
        ]

    @staticmethod
    def _export_report(db: Session, filters: Dict[str, Any]):
        report = []

        total_preferences = db.query(func.count(UserPreference.id)).scalar()
        active_preferences = db.query(func.count(UserPreference.id)).filter(
            UserPreference.status == "active"
        ).scalar()

        total_receipts = db.query(func.count(SendReceipt.id)).scalar()
        success_receipts = db.query(func.count(SendReceipt.id)).filter(
            SendReceipt.status.in_(["sent", "delivered", "read"])
        ).scalar()
        failed_receipts = db.query(func.count(SendReceipt.id)).filter(
            SendReceipt.status == "failed"
        ).scalar()

        total_retries = db.query(func.count(RetryRecord.id)).scalar()
        success_retries = db.query(func.count(RetryRecord.id)).filter(
            RetryRecord.status == "executed"
        ).scalar()

        channels = db.query(UserPreference.channel, func.count(UserPreference.id)).group_by(
            UserPreference.channel
        ).all()

        report.append({"指标": "总偏好数", "数值": total_preferences})
        report.append({"指标": "活跃偏好数", "数值": active_preferences})
        report.append({"指标": "总发送回执数", "数值": total_receipts})
        report.append({"指标": "成功发送数", "数值": success_receipts})
        report.append({"指标": "失败发送数", "数值": failed_receipts})
        report.append({"指标": "成功率", "数值": f"{(success_receipts/total_receipts*100):.2f}%" if total_receipts > 0 else "0%"})
        report.append({"指标": "总重试记录数", "数值": total_retries})
        report.append({"指标": "成功重试数", "数值": success_retries})

        for channel, count in channels:
            report.append({"指标": f"{channel}渠道偏好数", "数值": count})

        return report

    @staticmethod
    def get_export_records(db: Session, status: str = None, page: int = 1, page_size: int = 20):
        query = db.query(ExportRecord)
        
        if status:
            query = query.filter(ExportRecord.status == status)

        total = query.count()
        records = query.order_by(desc(ExportRecord.created_at)).offset(
            (page - 1) * page_size
        ).limit(page_size).all()

        return {"total": total, "data": records, "page": page, "page_size": page_size}

    @staticmethod
    def get_export_file_path(db: Session, export_id: str):
        export_record = db.query(ExportRecord).filter(
            ExportRecord.export_id == export_id
        ).first()
        if not export_record:
            raise ValueError("Export record not found")
        if export_record.status != "completed":
            raise ValueError("Export is not completed")
        return export_record.file_path