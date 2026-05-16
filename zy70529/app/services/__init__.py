from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

from app.models import (
    CompensationRecord, CompensationHistory, CompensationBatch, CompensationReport,
    CompensationStatus, CompensationStrategy
)
from app.schemas import CompensationRecordCreate, CompensationRecordUpdate


class CompensationService:
    def __init__(self, db: Session):
        self.db = db

    def _add_history(self, record_id: int, from_status: Optional[str], to_status: str,
                     operation_type: str, operator: str = "system", remark: Optional[str] = None):
        history = CompensationHistory(
            record_id=record_id,
            from_status=from_status,
            to_status=to_status,
            operation_type=operation_type,
            operator=operator,
            remark=remark
        )
        self.db.add(history)

    def check_duplicate(self, queue_name: str, message_id: str, business_no: str) -> bool:
        existing = self.db.query(CompensationRecord).filter(
            and_(
                CompensationRecord.queue_name == queue_name,
                CompensationRecord.message_id == message_id,
                CompensationRecord.business_no == business_no,
                CompensationRecord.status != CompensationStatus.SKIPPED
            )
        ).first()
        return existing is not None

    def check_business_success(self, business_no: str) -> bool:
        existing = self.db.query(CompensationRecord).filter(
            and_(
                CompensationRecord.business_no == business_no,
                CompensationRecord.status.in_([CompensationStatus.SUCCESS, CompensationStatus.MANUAL_FIXED])
            )
        ).first()
        return existing is not None

    def create_record(self, record_data: CompensationRecordCreate) -> CompensationRecord:
        if self.check_duplicate(record_data.queue_name, record_data.message_id, record_data.business_no):
            raise ValueError("该补偿记录已存在，请勿重复创建")

        if self.check_business_success(record_data.business_no):
            raise ValueError("该业务单据已成功处理，无需补偿")

        record = CompensationRecord(
            queue_name=record_data.queue_name,
            message_id=record_data.message_id,
            business_no=record_data.business_no,
            strategy=record_data.strategy,
            original_input=record_data.original_input,
            batch_id=record_data.batch_id,
            status=CompensationStatus.PENDING
        )
        self.db.add(record)
        self.db.flush()

        self._add_history(
            record_id=record.id,
            from_status=None,
            to_status=CompensationStatus.PENDING,
            operation_type="create",
            operator="system",
            remark="创建补偿记录"
        )
        self.db.commit()
        self.db.refresh(record)
        return record

    def get_record(self, record_id: int) -> Optional[CompensationRecord]:
        return self.db.query(CompensationRecord).filter(CompensationRecord.id == record_id).first()

    def get_record_by_business_no(self, business_no: str) -> Optional[CompensationRecord]:
        return self.db.query(CompensationRecord).filter(CompensationRecord.business_no == business_no).first()

    def query_records(self, queue_name: Optional[str] = None, business_no: Optional[str] = None,
                      status: Optional[CompensationStatus] = None, batch_id: Optional[str] = None,
                      page: int = 1, page_size: int = 20) -> tuple[List[CompensationRecord], int]:
        query = self.db.query(CompensationRecord)

        if queue_name:
            query = query.filter(CompensationRecord.queue_name == queue_name)
        if business_no:
            query = query.filter(CompensationRecord.business_no == business_no)
        if status:
            query = query.filter(CompensationRecord.status == status)
        if batch_id:
            query = query.filter(CompensationRecord.batch_id == batch_id)

        total = query.count()
        records = query.order_by(CompensationRecord.created_at.desc()).offset(
            (page - 1) * page_size
        ).limit(page_size).all()

        return records, total

    def update_status(self, record_id: int, new_status: CompensationStatus,
                      operator: str = "system", remark: Optional[str] = None,
                      process_basis: Optional[str] = None, final_conclusion: Optional[str] = None,
                      error_message: Optional[str] = None) -> CompensationRecord:
        record = self.get_record(record_id)
        if not record:
            raise ValueError("补偿记录不存在")

        old_status = record.status

        if new_status in [CompensationStatus.SUCCESS, CompensationStatus.MANUAL_FIXED]:
            record.processed_at = datetime.now()

        if process_basis:
            record.process_basis = process_basis
        if final_conclusion:
            record.final_conclusion = final_conclusion
        if error_message:
            record.error_message = error_message

        record.status = new_status
        self._add_history(
            record_id=record.id,
            from_status=old_status,
            to_status=new_status,
            operation_type="status_update",
            operator=operator,
            remark=remark
        )

        self.db.commit()
        self.db.refresh(record)
        return record

    def process_record(self, record_id: int) -> CompensationRecord:
        record = self.get_record(record_id)
        if not record:
            raise ValueError("补偿记录不存在")

        if record.status != CompensationStatus.PENDING:
            raise ValueError("只有待处理状态的记录可以处理")

        record.status = CompensationStatus.PROCESSING
        record.retry_count += 1
        self._add_history(
            record_id=record.id,
            from_status=CompensationStatus.PENDING,
            to_status=CompensationStatus.PROCESSING,
            operation_type="start_process",
            operator="system",
            remark=f"开始处理，第{record.retry_count}次尝试"
        )

        self.db.commit()
        self.db.refresh(record)
        return record

    def handle_success(self, record_id: int, process_basis: str, final_conclusion: str) -> CompensationRecord:
        return self.update_status(
            record_id=record_id,
            new_status=CompensationStatus.SUCCESS,
            operator="system",
            remark="处理成功",
            process_basis=process_basis,
            final_conclusion=final_conclusion
        )

    def handle_failure(self, record_id: int, error_message: str, process_basis: Optional[str] = None) -> CompensationRecord:
        record = self.get_record(record_id)
        if not record:
            raise ValueError("补偿记录不存在")

        final_status = CompensationStatus.FAILED
        remark = "处理失败"

        if record.retry_count < record.max_retry:
            final_status = CompensationStatus.PENDING
            remark = f"处理失败，将进行第{record.retry_count + 1}次重试"

        return self.update_status(
            record_id=record_id,
            new_status=final_status,
            operator="system",
            remark=remark,
            process_basis=process_basis,
            error_message=error_message
        )

    def manual_fix(self, business_no: str, final_conclusion: str, process_basis: str, operator: str) -> CompensationRecord:
        record = self.get_record_by_business_no(business_no)
        if not record:
            raise ValueError("未找到该业务单据的补偿记录")

        return self.update_status(
            record_id=record.id,
            new_status=CompensationStatus.MANUAL_FIXED,
            operator=operator,
            remark="人工修正",
            process_basis=process_basis,
            final_conclusion=final_conclusion
        )

    def skip_record(self, record_id: int, operator: str = "system", remark: str = "跳过处理") -> CompensationRecord:
        return self.update_status(
            record_id=record_id,
            new_status=CompensationStatus.SKIPPED,
            operator=operator,
            remark=remark
        )

    def get_record_history(self, record_id: int) -> List[CompensationHistory]:
        return self.db.query(CompensationHistory).filter(
            CompensationHistory.record_id == record_id
        ).order_by(CompensationHistory.created_at.desc()).all()

    def create_batch(self, queue_name: str, records: List[CompensationRecordCreate]) -> CompensationBatch:
        batch_id = f"BATCH_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}"

        batch = CompensationBatch(
            batch_id=batch_id,
            queue_name=queue_name,
            total_count=len(records),
            status="processing"
        )
        self.db.add(batch)

        success_count = 0
        failed_count = 0
        skipped_count = 0

        for record_data in records:
            record_data.batch_id = batch_id
            try:
                if self.check_business_success(record_data.business_no):
                    skipped_count += 1
                    continue
                self.create_record(record_data)
                success_count += 1
            except ValueError:
                failed_count += 1

        batch.success_count = success_count
        batch.failed_count = failed_count
        batch.skipped_count = skipped_count
        batch.status = "completed"
        batch.finished_at = datetime.now()

        self.db.commit()
        self.db.refresh(batch)
        return batch

    def get_batch(self, batch_id: str) -> Optional[CompensationBatch]:
        return self.db.query(CompensationBatch).filter(CompensationBatch.batch_id == batch_id).first()

    def export_records(self, queue_name: Optional[str] = None, batch_id: Optional[str] = None,
                       status: Optional[CompensationStatus] = None, start_time: Optional[datetime] = None,
                       end_time: Optional[datetime] = None) -> List[Dict[str, Any]]:
        query = self.db.query(CompensationRecord)

        if queue_name:
            query = query.filter(CompensationRecord.queue_name == queue_name)
        if batch_id:
            query = query.filter(CompensationRecord.batch_id == batch_id)
        if status:
            query = query.filter(CompensationRecord.status == status)
        if start_time:
            query = query.filter(CompensationRecord.created_at >= start_time)
        if end_time:
            query = query.filter(CompensationRecord.created_at <= end_time)

        records = query.order_by(CompensationRecord.created_at.desc()).all()

        export_data = []
        for record in records:
            export_data.append({
                "ID": record.id,
                "队列名称": record.queue_name,
                "消息编号": record.message_id,
                "业务单据号": record.business_no,
                "消费状态": record.status,
                "补偿策略": record.strategy,
                "重试次数": record.retry_count,
                "最大重试次数": record.max_retry,
                "原始输入": str(record.original_input),
                "处理依据": record.process_basis or "",
                "最终结论": record.final_conclusion or "",
                "错误信息": record.error_message or "",
                "批次ID": record.batch_id or "",
                "创建时间": record.created_at.strftime("%Y-%m-%d %H:%M:%S") if record.created_at else "",
                "更新时间": record.updated_at.strftime("%Y-%m-%d %H:%M:%S") if record.updated_at else "",
                "处理时间": record.processed_at.strftime("%Y-%m-%d %H:%M:%S") if record.processed_at else ""
            })

        return export_data

    def create_report(self, batch_id: Optional[str], queue_name: Optional[str],
                      start_time: Optional[datetime], end_time: Optional[datetime],
                      created_by: str = "system") -> CompensationReport:
        query = self.db.query(CompensationRecord)

        if batch_id:
            query = query.filter(CompensationRecord.batch_id == batch_id)
        if queue_name:
            query = query.filter(CompensationRecord.queue_name == queue_name)
        if start_time:
            query = query.filter(CompensationRecord.created_at >= start_time)
        if end_time:
            query = query.filter(CompensationRecord.created_at <= end_time)

        records = query.all()

        total_count = len(records)
        success_count = sum(1 for r in records if r.status == CompensationStatus.SUCCESS)
        failed_count = sum(1 for r in records if r.status == CompensationStatus.FAILED)
        skipped_count = sum(1 for r in records if r.status == CompensationStatus.SKIPPED)

        report_id = f"REPORT_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}"

        report = CompensationReport(
            report_id=report_id,
            batch_id=batch_id,
            queue_name=queue_name,
            start_time=start_time,
            end_time=end_time,
            total_count=total_count,
            success_count=success_count,
            failed_count=failed_count,
            skipped_count=skipped_count,
            created_by=created_by
        )

        self.db.add(report)
        self.db.commit()
        self.db.refresh(report)
        return report

    def get_report(self, report_id: str) -> Optional[CompensationReport]:
        return self.db.query(CompensationReport).filter(CompensationReport.report_id == report_id).first()
