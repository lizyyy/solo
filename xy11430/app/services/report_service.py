import io
import csv
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session

import pandas as pd

from app.models.models import (
    AbnormalReceipt,
    Batch,
    StatusHistory,
    ReceiptStatus,
    DataSource,
    AbnormalType,
    User
)
from app.schemas.schemas import (
    ExportRequest,
    BatchSummary
)


class ReportService:
    @staticmethod
    def get_batch_summary(db: Session, batch_id: int) -> Optional[BatchSummary]:
        batch = db.query(Batch).filter(Batch.id == batch_id).first()
        if not batch:
            return None

        receipts = db.query(AbnormalReceipt).filter(
            AbnormalReceipt.batch_id == batch_id
        ).all()

        by_status = {}
        by_abnormal_type = {}
        total_amount = 0.0

        for receipt in receipts:
            status_key = receipt.status.value
            by_status[status_key] = by_status.get(status_key, 0) + 1

            type_key = receipt.abnormal_type.value
            by_abnormal_type[type_key] = by_abnormal_type.get(type_key, 0) + 1

            total_amount += receipt.total_amount or 0

        return BatchSummary(
            batch_id=batch.id,
            batch_no=batch.batch_no,
            college=batch.college,
            total_receipts=len(receipts),
            total_amount=total_amount,
            by_status=by_status,
            by_abnormal_type=by_abnormal_type,
            frozen_before_status=None,
            is_frozen=batch.is_frozen
        )

    @staticmethod
    def query_receipts(
        db: Session,
        batch_id: Optional[int] = None,
        college: Optional[str] = None,
        status: Optional[List[ReceiptStatus]] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[AbnormalReceipt]:
        query = db.query(AbnormalReceipt)

        if batch_id:
            query = query.filter(AbnormalReceipt.batch_id == batch_id)
        if college:
            query = query.filter(AbnormalReceipt.college == college)
        if status:
            query = query.filter(AbnormalReceipt.status.in_(status))
        if start_date:
            query = query.filter(AbnormalReceipt.created_at >= start_date)
        if end_date:
            query = query.filter(AbnormalReceipt.created_at <= end_date)

        return query.order_by(AbnormalReceipt.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def export_to_csv(
        db: Session,
        export_request: ExportRequest
    ) -> bytes:
        receipts = ReportService.query_receipts(
            db=db,
            batch_id=export_request.batch_id,
            college=export_request.college,
            status=export_request.status,
            start_date=export_request.start_date,
            end_date=export_request.end_date,
            skip=0,
            limit=10000
        )

        output = io.StringIO()
        writer = csv.writer(output)

        headers = [
            "回执编号", "学院", "异常类型", "数据来源", "来源单号",
            "物料名称", "物料编码", "规格", "数量", "单位",
            "单价", "金额", "实验室", "老师姓名", "供应商",
            "异常原因", "人工理由", "当前状态", "冻结前状态",
            "创建时间", "更新时间"
        ]
        writer.writerow(headers)

        for r in receipts:
            row = [
                r.receipt_no,
                r.college,
                r.abnormal_type.value,
                r.source_type.value,
                r.source_no or "",
                r.material_name,
                r.material_code or "",
                r.specification or "",
                r.quantity,
                r.unit or "",
                r.unit_price or "",
                r.total_amount or "",
                r.lab_name or "",
                r.teacher_name or "",
                r.supplier_name or "",
                r.abnormal_reason or "",
                r.manual_reason or "",
                r.status.value,
                r.frozen_before_status.value if r.frozen_before_status else "",
                r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else "",
                r.updated_at.strftime("%Y-%m-%d %H:%M:%S") if r.updated_at else ""
            ]
            writer.writerow(row)

        return output.getvalue().encode('utf-8-sig')

    @staticmethod
    def export_to_excel(
        db: Session,
        export_request: ExportRequest
    ) -> bytes:
        receipts = ReportService.query_receipts(
            db=db,
            batch_id=export_request.batch_id,
            college=export_request.college,
            status=export_request.status,
            start_date=export_request.start_date,
            end_date=export_request.end_date,
            skip=0,
            limit=10000
        )

        data = []
        for r in receipts:
            data.append({
                "回执编号": r.receipt_no,
                "学院": r.college,
                "异常类型": r.abnormal_type.value,
                "数据来源": r.source_type.value,
                "来源单号": r.source_no or "",
                "物料名称": r.material_name,
                "物料编码": r.material_code or "",
                "规格": r.specification or "",
                "数量": r.quantity,
                "单位": r.unit or "",
                "单价": r.unit_price or 0,
                "金额": r.total_amount or 0,
                "实验室": r.lab_name or "",
                "老师姓名": r.teacher_name or "",
                "供应商": r.supplier_name or "",
                "异常原因": r.abnormal_reason or "",
                "人工理由": r.manual_reason or "",
                "当前状态": r.status.value,
                "冻结前状态": r.frozen_before_status.value if r.frozen_before_status else "",
                "创建时间": r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else "",
                "更新时间": r.updated_at.strftime("%Y-%m-%d %H:%M:%S") if r.updated_at else ""
            })

        df = pd.DataFrame(data)

        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='异常回执明细')

            if export_request.include_history:
                history_data = []
                for r in receipts:
                    histories = db.query(StatusHistory).filter(
                        StatusHistory.receipt_id == r.id
                    ).all()
                    for h in histories:
                        changer = db.query(User).filter(User.id == h.changed_by).first()
                        history_data.append({
                            "回执编号": r.receipt_no,
                            "从状态": h.from_status.value if h.from_status else "",
                            "到状态": h.to_status.value,
                            "变更人": changer.real_name if changer else "",
                            "变更原因": h.change_reason or "",
                            "人工理由": h.manual_reason or "",
                            "变更时间": h.created_at.strftime("%Y-%m-%d %H:%M:%S") if h.created_at else ""
                        })

                if history_data:
                    df_history = pd.DataFrame(history_data)
                    df_history.to_excel(writer, index=False, sheet_name='状态变更历史')

        output.seek(0)
        return output.getvalue()

    @staticmethod
    def get_college_summary(
        db: Session,
        college: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        query = db.query(AbnormalReceipt)
        if college:
            query = query.filter(AbnormalReceipt.college == college)

        receipts = query.all()

        summary = {}
        for r in receipts:
            key = r.college
            if key not in summary:
                summary[key] = {
                    "college": key,
                    "total_count": 0,
                    "total_amount": 0,
                    "by_status": {},
                    "by_type": {}
                }

            summary[key]["total_count"] += 1
            summary[key]["total_amount"] += r.total_amount or 0

            status_key = r.status.value
            summary[key]["by_status"][status_key] = summary[key]["by_status"].get(status_key, 0) + 1

            type_key = r.abnormal_type.value
            summary[key]["by_type"][type_key] = summary[key]["by_type"].get(type_key, 0) + 1

        return list(summary.values())
