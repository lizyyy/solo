from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import io
import pandas as pd

from app import models
from app.models import BatchStatus


class ExportCRUD:
    def generate_summary_report(
        self,
        db: Session,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        status: Optional[BatchStatus] = None
    ) -> pd.DataFrame:
        query = db.query(models.Batch)

        if start_date:
            query = query.filter(models.Batch.created_at >= start_date)
        if end_date:
            query = query.filter(models.Batch.created_at <= end_date)
        if status:
            query = query.filter(models.Batch.current_status == status)

        batches = query.all()

        data = []
        for batch in batches:
            frozen_transition = next(
                (t for t in batch.status_history if t.to_status == BatchStatus.FROZEN),
                None
            )
            reverted_transition = next(
                (t for t in batch.status_history if t.from_status == BatchStatus.FROZEN),
                None
            )

            supervisor_notes = [
                note for note in batch.notes
                if note.author and note.author.role == models.UserRole.SUPERVISOR
            ]
            approval_notes = [n.content for n in supervisor_notes if n.is_approval]
            general_notes = [n.content for n in supervisor_notes if not n.is_approval]

            dirty_records = db.query(models.DirtyRecord).filter(
                models.DirtyRecord.batch_id == batch.id
            ).all()

            unresolved_dirty = [d for d in dirty_records if not d.is_resolved]

            row = {
                "批次号": batch.batch_no,
                "运输单号": batch.transport_order_no,
                "发站": batch.origin,
                "到站": batch.destination,
                "发运日期": batch.departure_date.strftime("%Y-%m-%d") if batch.departure_date else "",
                "到达日期": batch.arrival_date.strftime("%Y-%m-%d") if batch.arrival_date else "",
                "箱数": batch.total_boxes or 0,
                "总金额": batch.total_amount or 0,
                "当前状态": batch.current_status.value,
                "冻结前状态": batch.status_before_frozen.value if batch.status_before_frozen else "",
                "冻结原因": batch.frozen_reason or "",
                "冻结时间": frozen_transition.transition_time.strftime("%Y-%m-%d %H:%M") if frozen_transition else "",
                "解冻/撤销时间": reverted_transition.transition_time.strftime("%Y-%m-%d %H:%M") if reverted_transition else "",
                "主管审批意见": "; ".join(approval_notes),
                "主管批注": "; ".join(general_notes),
                "未解决异常数": len(unresolved_dirty),
                "异常类型": ", ".join(set(d.record_type.value for d in unresolved_dirty)),
                "创建时间": batch.created_at.strftime("%Y-%m-%d %H:%M")
            }
            data.append(row)

        return pd.DataFrame(data)

    def generate_box_detail_report(
        self,
        db: Session,
        batch_id: Optional[int] = None
    ) -> pd.DataFrame:
        query = db.query(models.BoxItem)
        if batch_id:
            query = query.filter(models.BoxItem.batch_id == batch_id)

        box_items = query.all()

        data = []
        for box in box_items:
            batch = db.query(models.Batch).filter(models.Batch.id == box.batch_id).first()
            row = {
                "批次号": batch.batch_no if batch else "",
                "箱号": box.box_no,
                "原始箱号": box.original_box_no or "",
                "产品名称": box.product_name or "",
                "数量": box.quantity or 0,
                "单价": box.unit_price or 0,
                "金额": box.amount or 0,
                "最低温度": box.temperature_min or "",
                "最高温度": box.temperature_max or "",
                "平均温度": box.temperature_avg or "",
                "是否异常": "是" if box.is_abnormal else "否",
                "备注": box.remark or ""
            }
            data.append(row)

        return pd.DataFrame(data)

    def generate_dirty_records_report(
        self,
        db: Session,
        batch_id: Optional[int] = None,
        include_resolved: bool = False
    ) -> pd.DataFrame:
        query = db.query(models.DirtyRecord)
        if batch_id:
            query = query.filter(models.DirtyRecord.batch_id == batch_id)
        if not include_resolved:
            query = query.filter(models.DirtyRecord.is_resolved == False)

        records = query.all()

        data = []
        for record in records:
            batch = db.query(models.Batch).filter(models.Batch.id == record.batch_id).first()
            resolver = None
            if record.resolved_by:
                resolver = db.query(models.User).filter(models.User.id == record.resolved_by).first()

            row = {
                "批次号": batch.batch_no if batch else "",
                "异常类型": record.record_type.value,
                "缺失字段": record.missing_fields or "",
                "跨日信息": record.cross_day_info or "",
                "旧箱号": record.old_box_no or "",
                "新箱号": record.new_box_no or "",
                "冲突字段": record.conflict_field or "",
                "原值": record.old_value or "",
                "新值": record.new_value or "",
                "处理建议": record.handling_suggestion or "",
                "是否已解决": "是" if record.is_resolved else "否",
                "解决人": resolver.full_name if resolver else "",
                "解决时间": record.resolved_at.strftime("%Y-%m-%d %H:%M") if record.resolved_at else "",
                "解决说明": record.resolution_note or "",
                "创建时间": record.created_at.strftime("%Y-%m-%d %H:%M")
            }
            data.append(row)

        return pd.DataFrame(data)

    def export_to_excel(
        self,
        db: Session,
        report_type: str = "summary",
        **kwargs
    ) -> bytes:
        if report_type == "summary":
            df = self.generate_summary_report(db, **kwargs)
        elif report_type == "box_detail":
            df = self.generate_box_detail_report(db, **kwargs)
        elif report_type == "dirty_records":
            df = self.generate_dirty_records_report(db, **kwargs)
        else:
            raise ValueError(f"Unknown report type: {report_type}")

        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name=report_type)
        output.seek(0)
        return output.getvalue()

    def get_batch_status_changes(
        self,
        db: Session,
        batch_id: int
    ) -> List[dict]:
        transitions = db.query(models.StatusTransition).filter(
            models.StatusTransition.batch_id == batch_id
        ).order_by(models.StatusTransition.id).all()

        result = []
        for t in transitions:
            operator = db.query(models.User).filter(models.User.id == t.operator_id).first()
            result.append({
                "from_status": t.from_status.value if t.from_status else None,
                "to_status": t.to_status.value,
                "transition_time": t.transition_time,
                "operator": operator.full_name if operator else "",
                "operator_role": operator.role.value if operator else "",
                "reason": t.reason
            })
        return result


export_crud = ExportCRUD()
