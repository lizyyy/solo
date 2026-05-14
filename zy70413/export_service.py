import os
import uuid
import json
from datetime import datetime
from sqlalchemy.orm import Session
import pandas as pd
import models
import schemas


class ExportService:
    EXPORT_DIR = "./exports"

    @staticmethod
    def ensure_export_dir():
        if not os.path.exists(ExportService.EXPORT_DIR):
            os.makedirs(ExportService.EXPORT_DIR)

    @staticmethod
    def export_batch_to_excel(
        db: Session,
        batch_no: str,
        include_failed_only: bool = False,
        created_by: str = None
    ) -> schemas.ExportResponse:
        ExportService.ensure_export_dir()

        batch = db.query(models.Batch).filter(models.Batch.batch_no == batch_no).first()
        if not batch:
            return schemas.ExportResponse(
                success=False,
                task_no="",
                file_path=None,
                message=f"批次不存在: {batch_no}"
            )

        task_no = f"EXPORT_{datetime.now().strftime('%Y%m%d%H%M%S')}_{str(uuid.uuid4())[:8]}"
        
        query = db.query(models.BatchDetail).filter(models.BatchDetail.batch_id == batch.id)
        if include_failed_only:
            query = query.filter(models.BatchDetail.status != models.DetailStatus.SUCCESS)
        
        details = query.all()

        data = []
        for d in details:
            verification_result = json.loads(d.verification_result) if d.verification_result else {}
            data.append({
                "序号": d.sequence_no,
                "会员ID": d.member_id,
                "交易流水号": d.transaction_no,
                "交易时间": d.transaction_time.strftime("%Y-%m-%d %H:%M:%S") if d.transaction_time else "",
                "交易金额": d.amount,
                "交易类型": d.transaction_type,
                "状态": d.status,
                "是否时间顺序错误": "是" if d.is_time_order_error else "否",
                "错误信息": d.error_message or "",
                "验签规则": json.dumps(verification_result.get("checks", {}), ensure_ascii=False),
                "原始数据": d.original_data
            })

        df = pd.DataFrame(data)
        file_name = f"{task_no}_{batch_no}.xlsx"
        file_path = os.path.join(ExportService.EXPORT_DIR, file_name)
        
        with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='验签明细', index=False)

            summary_data = [{
                "批次号": batch.batch_no,
                "调用方": batch.caller,
                "总记录数": batch.total_count,
                "成功数": batch.success_count,
                "失败数": batch.failed_count,
                "批次状态": batch.status,
                "规则版本": batch.rule_version,
                "提交时间": batch.submitted_at.strftime("%Y-%m-%d %H:%M:%S") if batch.submitted_at else "",
                "完成时间": batch.completed_at.strftime("%Y-%m-%d %H:%M:%S") if batch.completed_at else "",
                "备注": batch.remark or "",
                "规则快照": batch.rule_snapshot or ""
            }]
            pd.DataFrame(summary_data).to_excel(writer, sheet_name='批次摘要', index=False)

        export_task = models.ExportTask(
            task_no=task_no,
            batch_id=batch.id,
            export_type="excel",
            status="completed",
            file_path=file_path,
            created_by=created_by,
            completed_at=datetime.now()
        )
        db.add(export_task)
        db.commit()

        return schemas.ExportResponse(
            success=True,
            task_no=task_no,
            file_path=file_path,
            message=f"导出成功，共{len(data)}条记录"
        )

    @staticmethod
    def get_export_task(db: Session, task_no: str) -> Optional[models.ExportTask]:
        return db.query(models.ExportTask).filter(models.ExportTask.task_no == task_no).first()
