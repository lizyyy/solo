import uuid
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from pathlib import Path

from config import EXPORT_DIR
from models import Bill, HistoryRecord, ReviewRecord
from config import (
    STATUS_NORMAL, STATUS_PENDING, STATUS_CONFIRMED, STATUS_REVISED, STATUS_DISPUTED,
    ANOMALY_DUPLICATE, ANOMALY_CROSS_PERIOD, ANOMALY_SUSPENSE, ANOMALY_REFUND, ANOMALY_FEE_MISMATCH
)

STATUS_MAP = {
    STATUS_NORMAL: "正常",
    STATUS_PENDING: "待确认",
    STATUS_CONFIRMED: "已复核",
    STATUS_REVISED: "已修正",
    STATUS_DISPUTED: "有争议",
}

ANOMALY_MAP = {
    ANOMALY_DUPLICATE: "重复入账",
    ANOMALY_CROSS_PERIOD: "手续费跨期",
    ANOMALY_SUSPENSE: "挂账",
    ANOMALY_REFUND: "退款挂账",
    ANOMALY_FEE_MISMATCH: "手续费不匹配",
    None: "无异常",
}


class ExportService:
    def __init__(self, db: Session):
        self.db = db

    def _get_bills_for_export(
        self,
        status: Optional[str] = None,
        anomaly_type: Optional[str] = None,
        start_date: Optional[datetime.date] = None,
        end_date: Optional[datetime.date] = None,
        due_soon_only: bool = False,
    ) -> List[Bill]:
        query = self.db.query(Bill)

        if status:
            query = query.filter(Bill.status == status)
        if anomaly_type:
            query = query.filter(Bill.anomaly_type == anomaly_type)
        if start_date:
            query = query.filter(Bill.due_date >= start_date)
        if end_date:
            query = query.filter(Bill.due_date <= end_date)
        if due_soon_only:
            soon_date = datetime.now().date() + timedelta(days=30)
            query = query.filter(Bill.due_date <= soon_date)

        return query.order_by(Bill.due_date.asc()).all()

    def export_to_excel(
        self,
        status: Optional[str] = None,
        anomaly_type: Optional[str] = None,
        start_date: Optional[datetime.date] = None,
        end_date: Optional[datetime.date] = None,
        due_soon_only: bool = False,
        include_history: bool = True,
    ) -> Path:
        bills = self._get_bills_for_export(status, anomaly_type, start_date, end_date, due_soon_only)

        filename = f"票据到期提醒_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        file_path = EXPORT_DIR / filename

        with pd.ExcelWriter(file_path, engine='xlsxwriter') as writer:
            self._write_summary_sheet(writer, bills)
            self._write_bills_sheet(writer, bills)
            if include_history:
                self._write_history_sheet(writer, bills)
                self._write_review_sheet(writer, bills)
            self._write_evidence_sheet(writer, bills)

        return file_path

    def _write_summary_sheet(self, writer, bills: List[Bill]):
        total_count = len(bills)
        total_amount = sum(b.amount for b in bills)

        status_stats = {}
        anomaly_stats = {}

        for bill in bills:
            status_stats[bill.status] = status_stats.get(bill.status, 0) + 1
            if bill.anomaly_type:
                anomaly_stats[bill.anomaly_type] = anomaly_stats.get(bill.anomaly_type, 0) + 1

        today = datetime.now().date()
        due_soon = sum(1 for b in bills if b.due_date <= today + timedelta(days=30))
        overdue = sum(1 for b in bills if b.due_date < today)

        summary_data = [
            ["票据到期提醒汇总表"],
            ["导出时间", datetime.now().strftime("%Y-%m-%d %H:%M:%S")],
            ["总记录数", total_count],
            ["总金额", total_amount],
            ["30天内到期", due_soon],
            ["已逾期", overdue],
            [],
            ["状态分布"],
            ["状态", "数量"],
        ]

        for status, count in status_stats.items():
            summary_data.append([STATUS_MAP.get(status, status), count])

        summary_data.append([])
        summary_data.append(["异常分布"])
        summary_data.append(["异常类型", "数量"])

        for anomaly, count in anomaly_stats.items():
            summary_data.append([ANOMALY_MAP.get(anomaly, anomaly), count])

        df = pd.DataFrame(summary_data)
        df.to_excel(writer, sheet_name='汇总', index=False, header=False)

        worksheet = writer.sheets['汇总']
        worksheet.set_column(0, 0, 20)
        worksheet.set_column(1, 1, 20)

    def _write_bills_sheet(self, writer, bills: List[Bill]):
        data = []
        for idx, bill in enumerate(bills):
            data.append({
                "ID": bill.id,
                "票据号": bill.bill_no,
                "票据日期": bill.bill_date.strftime("%Y-%m-%d") if bill.bill_date else "",
                "到期日期": bill.due_date.strftime("%Y-%m-%d") if bill.due_date else "",
                "金额": bill.amount,
                "手续费": bill.fee_amount,
                "付款方": bill.payer or "",
                "收款方": bill.payee or "",
                "流水号": bill.serial_no or "",
                "银行账号": bill.bank_account or "",
                "状态": STATUS_MAP.get(bill.status, bill.status),
                "异常类型": ANOMALY_MAP.get(bill.anomaly_type, bill.anomaly_type or ""),
                "异常原因": bill.anomaly_reason or "",
                "来源文件": bill.source_file or "",
                "关联对账单ID": bill.related_statement_id or "",
                "关联票据ID": bill.related_invoice_id or "",
                "备注": bill.remark or "",
                "创建时间": bill.created_at.strftime("%Y-%m-%d %H:%M:%S") if bill.created_at else "",
                "可追溯链接": f"=HYPERLINK(\"#证据明细!A{idx + 2}\", \"点击查看证据\")" if idx < 1000 else "查看证据表",
            })

        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name='票据明细', index=False)

        worksheet = writer.sheets['票据明细']
        for i, col in enumerate(df.columns):
            max_len = max(df[col].astype(str).map(len).max(), len(col)) + 2
            worksheet.set_column(i, i, min(max_len, 50))

    def _write_history_sheet(self, writer, bills: List[Bill]):
        bill_ids = [b.id for b in bills]
        histories = self.db.query(HistoryRecord).filter(
            HistoryRecord.bill_id.in_(bill_ids)
        ).order_by(HistoryRecord.bill_id, HistoryRecord.operated_at.desc()).all()

        data = []
        for h in histories:
            data.append({
                "票据ID": h.bill_id,
                "操作类型": h.operation_type,
                "修改字段": h.field_name or "",
                "原值": h.old_value or "",
                "新值": h.new_value or "",
                "操作人": h.operator,
                "操作时间": h.operated_at.strftime("%Y-%m-%d %H:%M:%S") if h.operated_at else "",
                "备注": h.remark or "",
            })

        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name='操作历史', index=False)

        worksheet = writer.sheets['操作历史']
        for i, col in enumerate(df.columns):
            max_len = max(df[col].astype(str).map(len).max(), len(col)) + 2
            worksheet.set_column(i, i, min(max_len, 40))

    def _write_review_sheet(self, writer, bills: List[Bill]):
        bill_ids = [b.id for b in bills]
        reviews = self.db.query(ReviewRecord).filter(
            ReviewRecord.bill_id.in_(bill_ids)
        ).order_by(ReviewRecord.bill_id, ReviewRecord.reviewed_at.desc()).all()

        data = []
        for r in reviews:
            data.append({
                "票据ID": r.bill_id,
                "复核操作": r.review_action,
                "复核结果": r.review_result,
                "复核原因": r.review_reason or "",
                "复核依据": r.review_evidence or "",
                "原状态": STATUS_MAP.get(r.previous_status, r.previous_status or ""),
                "新状态": STATUS_MAP.get(r.new_status, r.new_status or ""),
                "复核人": r.reviewed_by,
                "复核时间": r.reviewed_at.strftime("%Y-%m-%d %H:%M:%S") if r.reviewed_at else "",
            })

        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name='复核记录', index=False)

        worksheet = writer.sheets['复核记录']
        for i, col in enumerate(df.columns):
            max_len = max(df[col].astype(str).map(len).max(), len(col)) + 2
            worksheet.set_column(i, i, min(max_len, 40))

    def _write_evidence_sheet(self, writer, bills: List[Bill]):
        data = []
        for bill in bills:
            related_stmt = None
            related_inv = None

            if bill.related_statement_id:
                related_stmt = self.db.query(Bill).filter(Bill.id == bill.related_statement_id).first()
            if bill.related_invoice_id:
                related_inv = self.db.query(Bill).filter(Bill.id == bill.related_invoice_id).first()

            data.append({
                "票据ID": bill.id,
                "票据号": bill.bill_no,
                "来源类型": bill.source_type or "",
                "来源文件名": bill.source_file or "",
                "异常类型": ANOMALY_MAP.get(bill.anomaly_type, bill.anomaly_type or ""),
                "异常原因说明": bill.anomaly_reason or "",
                "关联对账单ID": bill.related_statement_id or "",
                "关联对账单号": related_stmt.bill_no if related_stmt else "",
                "关联对账单来源": related_stmt.source_file if related_stmt else "",
                "关联票据ID": bill.related_invoice_id or "",
                "关联票据号": related_inv.bill_no if related_inv else "",
                "关联票据来源": related_inv.source_file if related_inv else "",
                "复核依据": "详见复核记录表",
            })

        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name='证据明细', index=False)

        worksheet = writer.sheets['证据明细']
        for i, col in enumerate(df.columns):
            max_len = max(df[col].astype(str).map(len).max(), len(col)) + 2
            worksheet.set_column(i, i, min(max_len, 40))

    def get_statistics(self) -> Dict[str, Any]:
        from datetime import timedelta

        today = datetime.now().date()
        soon_date = today + timedelta(days=30)

        total = self.db.query(Bill).count()
        total_amount = self.db.query(Bill).with_entities(Bill.amount).all()
        total_amount_sum = sum(a[0] for a in total_amount) if total_amount else 0

        stats = {
            "total_count": total,
            "total_amount": total_amount_sum,
            "normal_count": self.db.query(Bill).filter(Bill.status == STATUS_NORMAL).count(),
            "pending_count": self.db.query(Bill).filter(Bill.status == STATUS_PENDING).count(),
            "confirmed_count": self.db.query(Bill).filter(Bill.status == STATUS_CONFIRMED).count(),
            "disputed_count": self.db.query(Bill).filter(Bill.status == STATUS_DISPUTED).count(),
            "revised_count": self.db.query(Bill).filter(Bill.status == STATUS_REVISED).count(),
            "anomaly_duplicate": self.db.query(Bill).filter(Bill.anomaly_type == ANOMALY_DUPLICATE).count(),
            "anomaly_cross_period": self.db.query(Bill).filter(Bill.anomaly_type == ANOMALY_CROSS_PERIOD).count(),
            "anomaly_suspense": self.db.query(Bill).filter(Bill.anomaly_type == ANOMALY_SUSPENSE).count(),
            "anomaly_refund": self.db.query(Bill).filter(Bill.anomaly_type == ANOMALY_REFUND).count(),
            "anomaly_fee_mismatch": self.db.query(Bill).filter(Bill.anomaly_type == ANOMALY_FEE_MISMATCH).count(),
            "due_soon_count": self.db.query(Bill).filter(Bill.due_date <= soon_date).count(),
        }

        return stats
