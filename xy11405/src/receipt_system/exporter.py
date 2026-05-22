import pandas as pd
from datetime import datetime
from typing import List, Optional, Dict, Any
from io import BytesIO
from sqlalchemy.orm import Session
from .models import Batch, Receipt, AuditLog, ReceiptStatus
from .state_machine import batch_state_summary


class ReceiptExporter:
    @staticmethod
    def export_to_excel(
        db: Session,
        batch_ids: Optional[List[str]] = None,
        region: Optional[str] = None,
        status: Optional[ReceiptStatus] = None,
        include_audit_log: bool = False
    ) -> BytesIO:
        query = db.query(Batch)
        if batch_ids:
            query = query.filter(Batch.id.in_(batch_ids))
        if region:
            query = query.filter(Batch.region == region)

        batches = query.all()

        output = BytesIO()

        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            ReceiptExporter._export_summary_sheet(batches, writer)
            ReceiptExporter._export_receipts_sheet(db, batches, writer)
            ReceiptExporter._export_freeze_details_sheet(db, batches, writer)

            if include_audit_log:
                ReceiptExporter._export_audit_log_sheet(db, batches, writer)

        output.seek(0)
        return output

    @staticmethod
    def _export_summary_sheet(batches: List[Batch], writer: pd.ExcelWriter):
        summary_data = []
        for batch in batches:
            summary = batch_state_summary(batch)
            summary_data.append({
                "批次ID": summary["batch_id"],
                "药房名称": summary["pharmacy_name"],
                "区域": batch.region,
                "批次状态": summary["status"].value if isinstance(summary["status"], ReceiptStatus) else summary["status"],
                "回执总数": summary["total_receipts"],
                "草稿数": summary["status_breakdown"].get("draft", 0),
                "待复核数": summary["status_breakdown"].get("pending_review", 0),
                "已通过数": summary["status_breakdown"].get("approved", 0),
                "已驳回数": summary["status_breakdown"].get("rejected", 0),
                "已冻结数": summary["status_breakdown"].get("frozen", 0),
                "已归档数": summary["status_breakdown"].get("archived", 0),
                "冻结时间": summary["frozen_at"],
                "冻结操作人": summary["frozen_by"],
                "创建时间": summary["created_at"],
            })

        df = pd.DataFrame(summary_data)
        df.to_excel(writer, sheet_name="批次汇总", index=False)

    @staticmethod
    def _export_receipts_sheet(db: Session, batches: List[Batch], writer: pd.ExcelWriter):
        receipt_data = []
        for batch in batches:
            for receipt in batch.receipts:
                receipt_data.append({
                    "批次ID": batch.id,
                    "药房名称": batch.pharmacy_name,
                    "区域": batch.region,
                    "回执ID": receipt.id,
                    "药品编码": receipt.medicine_code,
                    "药品名称": receipt.medicine_name,
                    "规格": receipt.specification,
                    "生产批号": receipt.batch_number,
                    "有效期至": receipt.expiry_date,
                    "数量": receipt.quantity,
                    "单位": receipt.unit,
                    "原价": receipt.original_price,
                    "调整价": receipt.adjusted_price,
                    "差额": (receipt.adjusted_price - receipt.original_price) if receipt.adjusted_price else None,
                    "数据来源": receipt.source_type,
                    "当前状态": receipt.status.value,
                    "冻结前状态": receipt.previous_status.value if receipt.previous_status and receipt.status == ReceiptStatus.FROZEN else None,
                    "冻结原因": receipt.freeze_reason,
                    "复核人": receipt.review_by,
                    "复核时间": receipt.review_at,
                    "复核意见": receipt.review_reason,
                    "版本号": receipt.version,
                    "创建时间": receipt.created_at,
                    "更新时间": receipt.updated_at,
                })

        df = pd.DataFrame(receipt_data)
        df.to_excel(writer, sheet_name="回执明细", index=False)

    @staticmethod
    def _export_freeze_details_sheet(db: Session, batches: List[Batch], writer: pd.ExcelWriter):
        freeze_data = []
        for batch in batches:
            for receipt in batch.receipts:
                for transition in receipt.status_transitions:
                    if transition.to_status == ReceiptStatus.FROZEN or transition.from_status == ReceiptStatus.FROZEN:
                        freeze_data.append({
                            "批次ID": batch.id,
                            "药房名称": batch.pharmacy_name,
                            "回执ID": receipt.id,
                            "药品名称": receipt.medicine_name,
                            "操作类型": "冻结" if transition.to_status == ReceiptStatus.FROZEN else "解冻",
                            "原状态": transition.from_status.value,
                            "目标状态": transition.to_status.value,
                            "操作人": transition.transitioned_by,
                            "操作时间": transition.transitioned_at,
                            "人工理由": transition.reason,
                        })

        df = pd.DataFrame(freeze_data)
        df.to_excel(writer, sheet_name="冻结记录", index=False)

    @staticmethod
    def _export_audit_log_sheet(db: Session, batches: List[Batch], writer: pd.ExcelWriter):
        batch_ids = [b.id for b in batches]
        audit_logs = db.query(AuditLog).filter(
            AuditLog.batch_id.in_(batch_ids)
        ).order_by(AuditLog.action_at.desc()).all()

        audit_data = []
        for log in audit_logs:
            audit_data.append({
                "日志ID": log.id,
                "批次ID": log.batch_id,
                "回执ID": log.receipt_id,
                "操作": log.action,
                "操作人": log.actor,
                "操作时间": log.action_at,
                "原值": str(log.old_value) if log.old_value else None,
                "新值": str(log.new_value) if log.new_value else None,
                "原因": log.reason,
                "IP地址": log.ip_address,
            })

        df = pd.DataFrame(audit_data)
        df.to_excel(writer, sheet_name="审计日志", index=False)

    @staticmethod
    def get_export_summary(
        db: Session,
        batch_ids: Optional[List[str]] = None,
        region: Optional[str] = None
    ) -> Dict[str, Any]:
        query = db.query(Batch)
        if batch_ids:
            query = query.filter(Batch.id.in_(batch_ids))
        if region:
            query = query.filter(Batch.region == region)

        batches = query.all()

        total_receipts = 0
        total_approved = 0
        total_frozen = 0
        total_value = 0.0
        adjusted_value = 0.0

        for batch in batches:
            for receipt in batch.receipts:
                total_receipts += 1
                if receipt.status == ReceiptStatus.APPROVED:
                    total_approved += 1
                if receipt.status == ReceiptStatus.FROZEN:
                    total_frozen += 1
                total_value += receipt.quantity * receipt.original_price
                if receipt.adjusted_price:
                    adjusted_value += receipt.quantity * receipt.adjusted_price

        return {
            "total_batches": len(batches),
            "total_receipts": total_receipts,
            "approved_count": total_approved,
            "frozen_count": total_frozen,
            "original_total_value": total_value,
            "adjusted_total_value": adjusted_value,
            "price_difference": adjusted_value - total_value,
            "exported_at": datetime.now().isoformat(),
        }
