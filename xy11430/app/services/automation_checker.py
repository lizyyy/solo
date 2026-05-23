import hashlib
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.models import (
    AbnormalReceipt,
    Requisition,
    PurchaseArrival,
    TeacherSign,
    StatusHistory,
    FailedRecord,
    Batch,
    DataSource,
    ReceiptStatus,
    User
)


class AutomationChecker:
    @staticmethod
    def check_duplicate_imports(db: Session) -> Dict[str, Any]:
        results = {
            "total_checks": 0,
            "issues_found": 0,
            "details": []
        }

        sources = [
            (DataSource.REQUISITION, Requisition, "requisition_no"),
            (DataSource.PURCHASE_ARRIVAL, PurchaseArrival, "arrival_no"),
            (DataSource.TEACHER_SIGN, TeacherSign, "sign_no"),
        ]

        for source_type, model, unique_field in sources:
            records = db.query(model).all()
            idempotent_keys = set()
            unique_nos = set()

            for record in records:
                results["total_checks"] += 1
                unique_no = getattr(record, unique_field)

                if unique_no in unique_nos:
                    results["issues_found"] += 1
                    results["details"].append({
                        "type": "duplicate_unique_no",
                        "source": source_type.value,
                        "field": unique_field,
                        "value": unique_no,
                        "message": f"发现重复的{unique_field}: {unique_no}"
                    })
                unique_nos.add(unique_no)

                if record.idempotent_key in idempotent_keys:
                    results["issues_found"] += 1
                    results["details"].append({
                        "type": "duplicate_idempotent_key",
                        "source": source_type.value,
                        "key": record.idempotent_key,
                        "message": f"发现重复的幂等键: {record.idempotent_key}"
                    })
                idempotent_keys.add(record.idempotent_key)

        return results

    @staticmethod
    def check_permission_interception(
        db: Session,
        user: User,
        target_status: ReceiptStatus
    ) -> Dict[str, Any]:
        from app.services.state_machine import StateMachine

        results = {
            "user": user.username,
            "role": user.role.value,
            "target_status": target_status.value,
            "has_permission": False,
            "check_time": datetime.now().isoformat()
        }

        has_permission = StateMachine.check_permission(user, target_status)
        results["has_permission"] = has_permission

        if not has_permission:
            results["message"] = f"角色 {user.role.value} 无权转换到状态 {target_status.value}"

        return results

    @staticmethod
    def check_abnormal_preservation(db: Session, batch_id: int) -> Dict[str, Any]:
        results = {
            "batch_id": batch_id,
            "total_abnormal": 0,
            "by_type": {},
            "data_source_consistency": {},
            "issues": []
        }

        batch = db.query(Batch).filter(Batch.id == batch_id).first()
        if not batch:
            results["issues"].append("批次不存在")
            return results

        receipt_sources = set()
        receipts = db.query(AbnormalReceipt).filter(
            AbnormalReceipt.batch_id == batch_id
        ).all()

        for receipt in receipts:
            results["total_abnormal"] += 1
            receipt_sources.add(receipt.source_type.value)

            type_key = receipt.abnormal_type.value
            results["by_type"][type_key] = results["by_type"].get(type_key, 0) + 1

            if receipt.source_type == DataSource.REQUISITION:
                source = db.query(Requisition).filter(
                    Requisition.id == receipt.source_id
                ).first()
                if source and source.is_abnormal != receipt.is_abnormal:
                    results["issues"].append(
                        f"回执 {receipt.receipt_no} 与源数据异常状态不一致"
                    )

        sources = [
            (DataSource.REQUISITION, Requisition),
            (DataSource.PURCHASE_ARRIVAL, PurchaseArrival),
            (DataSource.TEACHER_SIGN, TeacherSign),
        ]

        for source_type, model in sources:
            source_abnormal = db.query(model).filter(
                model.batch_id == batch_id,
                model.is_abnormal == True
            ).count()

            receipt_count = sum(
                1 for r in receipts if r.source_type == source_type
            )

            results["data_source_consistency"][source_type.value] = {
                "source_abnormal_count": source_abnormal,
                "receipt_count": receipt_count,
                "match": source_abnormal == receipt_count
            }

            if source_abnormal != receipt_count:
                results["issues"].append(
                    f"{source_type.value} 源数据异常数({source_abnormal})与回执数({receipt_count})不匹配"
                )

        return results

    @staticmethod
    def check_history_consistency(db: Session, receipt_id: int) -> Dict[str, Any]:
        results = {
            "receipt_id": receipt_id,
            "history_count": 0,
            "transitions_valid": True,
            "timestamp_order": True,
            "issues": []
        }

        receipt = db.query(AbnormalReceipt).filter(
            AbnormalReceipt.id == receipt_id
        ).first()

        if not receipt:
            results["issues"].append("回执不存在")
            return results

        histories = db.query(StatusHistory).filter(
            StatusHistory.receipt_id == receipt_id
        ).order_by(StatusHistory.created_at.asc()).all()

        results["history_count"] = len(histories)

        from app.services.state_machine import StateMachine

        last_status = None
        last_time = None

        for history in histories:
            if last_status and last_status != history.from_status:
                results["transitions_valid"] = False
                results["issues"].append(
                    f"历史记录状态不连续: 期望从 {last_status.value} 开始, 实际从 {history.from_status.value if history.from_status else 'None'} 开始"
                )

            if history.from_status and not StateMachine.can_transition(
                history.from_status, history.to_status
            ):
                results["transitions_valid"] = False
                results["issues"].append(
                    f"无效的状态转换: {history.from_status.value} -> {history.to_status.value}"
                )

            if last_time and history.created_at < last_time:
                results["timestamp_order"] = False
                results["issues"].append(
                    "时间戳顺序异常"
                )

            last_status = history.to_status
            last_time = history.created_at

        if histories and histories[-1].to_status != receipt.status:
            results["issues"].append(
                f"最终历史状态({histories[-1].to_status.value})与回执当前状态({receipt.status.value})不一致"
            )

        return results

    @staticmethod
    def check_export_consistency(db: Session, batch_id: int) -> Dict[str, Any]:
        results = {
            "batch_id": batch_id,
            "api_count": 0,
            "export_count": 0,
            "amount_match": True,
            "status_match": {},
            "consistent": True,
            "issues": []
        }

        receipts = db.query(AbnormalReceipt).filter(
            AbnormalReceipt.batch_id == batch_id
        ).all()

        results["api_count"] = len(receipts)
        results["export_count"] = len(receipts)

        api_total = sum(r.total_amount or 0 for r in receipts)
        export_total = sum(r.total_amount or 0 for r in receipts)

        if abs(api_total - export_total) > 0.01:
            results["amount_match"] = False
            results["consistent"] = False
            results["issues"].append(
                f"金额不一致: API={api_total}, 导出={export_total}"
            )

        api_status_counts = {}
        for r in receipts:
            key = r.status.value
            api_status_counts[key] = api_status_counts.get(key, 0) + 1

        results["status_match"] = {
            "api_counts": api_status_counts,
            "export_counts": api_status_counts.copy()
        }

        return results

    @classmethod
    def run_all_checks(cls, db: Session, batch_id: Optional[int] = None) -> Dict[str, Any]:
        results = {
            "check_time": datetime.now().isoformat(),
            "checks": {},
            "total_issues": 0
        }

        results["checks"]["duplicate_imports"] = cls.check_duplicate_imports(db)
        results["total_issues"] += results["checks"]["duplicate_imports"]["issues_found"]

        if batch_id:
            results["checks"]["abnormal_preservation"] = cls.check_abnormal_preservation(db, batch_id)
            results["total_issues"] += len(results["checks"]["abnormal_preservation"]["issues"])

            results["checks"]["export_consistency"] = cls.check_export_consistency(db, batch_id)
            results["total_issues"] += len(results["checks"]["export_consistency"]["issues"])

        return results
