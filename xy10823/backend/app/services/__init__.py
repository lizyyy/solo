from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
import uuid
from datetime import datetime
import json
import csv
from io import StringIO

from backend.app.models import (
    WarehouseAccount, LogisticsChannel, LabelTemplate, PrintBatch, LabelRecord,
    StatusHistory, ExceptionRecord, ReprintRecord,
    PrintBatchStatus, LabelRecordStatus, ExceptionType, ExceptionStatus,
    WarehouseAccountStatus, LogisticsChannelStatus, LabelTemplateStatus
)
from backend.app.schemas import (
    PrintBatchCreate, LabelRecordItem, StatusUpdateRequest,
    ExceptionResolveRequest, ReprintRequest, ExportFilter
)


def generate_no(prefix: str) -> str:
    return f"{prefix}{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"


class ChannelAdapter:
    def __init__(self, db: Session):
        self.db = db

    def get_channel(self, channel_code: str) -> Optional[LogisticsChannel]:
        return self.db.query(LogisticsChannel).filter(
            LogisticsChannel.code == channel_code,
            LogisticsChannel.status == LogisticsChannelStatus.ENABLED
        ).first()

    def select_template(self, channel_id: int, template_code: Optional[str] = None) -> Optional[LabelTemplate]:
        query = self.db.query(LabelTemplate).filter(
            LabelTemplate.channel_id == channel_id,
            LabelTemplate.status == LabelTemplateStatus.ACTIVE
        )
        if template_code:
            query = query.filter(LabelTemplate.code == template_code)
        return query.first()

    def validate_warehouse(self, warehouse_code: str) -> Optional[WarehouseAccount]:
        return self.db.query(WarehouseAccount).filter(
            WarehouseAccount.code == warehouse_code,
            WarehouseAccount.status == WarehouseAccountStatus.ACTIVE
        ).first()


class PrintService:
    def __init__(self, db: Session):
        self.db = db
        self.channel_adapter = ChannelAdapter(db)

    def create_batch(self, batch_data: PrintBatchCreate) -> PrintBatch:
        warehouse = self.channel_adapter.validate_warehouse(batch_data.warehouse_code)
        if not warehouse:
            raise ValueError(f"Invalid or inactive warehouse: {batch_data.warehouse_code}")

        channel = self.channel_adapter.get_channel(batch_data.channel_code)
        if not channel:
            raise ValueError(f"Invalid or disabled channel: {batch_data.channel_code}")

        template = self.channel_adapter.select_template(channel.id, batch_data.template_code)
        if not template:
            raise ValueError(f"No active template found for channel: {channel.code}")

        batch = PrintBatch(
            batch_no=generate_no("BATCH"),
            warehouse_id=warehouse.id,
            channel_id=channel.id,
            template_id=template.id,
            total_count=len(batch_data.records),
            status=PrintBatchStatus.PENDING
        )
        self.db.add(batch)
        self.db.flush()

        for item in batch_data.records:
            record = LabelRecord(
                record_no=generate_no("REC"),
                batch_id=batch.id,
                order_no=item.order_no,
                receiver_name=item.receiver_name,
                receiver_phone=item.receiver_phone,
                receiver_address=item.receiver_address,
                sender_info=item.sender_info,
                goods_info=item.goods_info,
                weight=item.weight,
                status=LabelRecordStatus.CREATED,
                status_reason="记录创建成功"
            )
            self.db.add(record)
            self.db.flush()

            self._add_status_history(
                record_id=record.id,
                from_status=None,
                to_status=LabelRecordStatus.CREATED,
                reason="记录创建成功"
            )

        self.db.commit()
        self.db.refresh(batch)
        return batch

    def process_batch(self, batch_id: int) -> PrintBatch:
        batch = self.db.query(PrintBatch).filter(PrintBatch.id == batch_id).first()
        if not batch:
            raise ValueError(f"Batch not found: {batch_id}")

        batch.status = PrintBatchStatus.PROCESSING
        self.db.commit()

        success_count = 0
        failed_count = 0

        for record in batch.records:
            try:
                self._process_record(record)
                success_count += 1
            except Exception as e:
                self._handle_record_exception(record, e)
                failed_count += 1

        batch.success_count = success_count
        batch.failed_count = failed_count

        if failed_count == 0:
            batch.status = PrintBatchStatus.COMPLETED
        elif success_count == 0:
            batch.status = PrintBatchStatus.FAILED
        else:
            batch.status = PrintBatchStatus.PARTIAL_FAILED

        batch.completed_at = datetime.now()
        self.db.commit()
        self.db.refresh(batch)
        return batch

    def _process_record(self, record: LabelRecord):
        self._update_record_status(
            record,
            LabelRecordStatus.GENERATING,
            "开始生成面单"
        )

        if hash(record.order_no) % 10 < 2:
            raise Exception(f"模拟渠道API错误: 单号 {record.order_no} 验证失败")

        if hash(record.receiver_phone) % 10 < 1:
            raise ValueError(f"数据验证失败: 手机号格式不正确")

        record.tracking_no = generate_no("TRK")
        record.label_url = f"https://example.com/labels/{record.tracking_no}.pdf"
        record.label_data = json.dumps({
            "tracking_no": record.tracking_no,
            "receiver": record.receiver_name,
            "address": record.receiver_address,
            "generated_at": datetime.now().isoformat()
        })

        self._update_record_status(
            record,
            LabelRecordStatus.GENERATED,
            "面单生成成功"
        )

        self._update_record_status(
            record,
            LabelRecordStatus.PRINTING,
            "开始打印"
        )

        self._update_record_status(
            record,
            LabelRecordStatus.PRINTED,
            "打印完成"
        )

    def _update_record_status(self, record: LabelRecord, new_status: LabelRecordStatus, reason: str):
        old_status = record.status
        record.status = new_status
        record.status_reason = reason
        self.db.commit()

        self._add_status_history(
            record_id=record.id,
            from_status=old_status.value if old_status else None,
            to_status=new_status.value,
            reason=reason
        )

    def _handle_record_exception(self, record: LabelRecord, exception: Exception):
        self._update_record_status(
            record,
            LabelRecordStatus.EXCEPTION,
            f"处理异常: {str(exception)}"
        )

        exception_type = ExceptionType.UNKNOWN
        error_code = "UNKNOWN_ERROR"

        if isinstance(exception, ValueError):
            if "手机号" in str(exception) or "地址" in str(exception):
                exception_type = ExceptionType.DATA_ERROR
                error_code = "DATA_VALIDATION_FAILED"
            else:
                exception_type = ExceptionType.VALIDATION_ERROR
                error_code = "VALIDATION_ERROR"
        elif "API" in str(exception) or "渠道" in str(exception):
            exception_type = ExceptionType.API_ERROR
            error_code = "API_CALL_FAILED"

        exc_record = ExceptionRecord(
            record_id=record.id,
            exception_type=exception_type,
            error_code=error_code,
            error_message=str(exception),
            error_detail=str(exception),
            status=ExceptionStatus.OPEN
        )
        self.db.add(exc_record)
        self.db.commit()

        self._update_record_status(
            record,
            LabelRecordStatus.FAILED,
            f"处理失败: {str(exception)}"
        )

    def _add_status_history(self, record_id: int, from_status: Optional[str], to_status: str,
                           reason: str, operator: str = "system"):
        history = StatusHistory(
            record_id=record_id,
            from_status=from_status,
            to_status=to_status,
            reason=reason,
            operator=operator
        )
        self.db.add(history)
        self.db.commit()


class RecordService:
    def __init__(self, db: Session):
        self.db = db

    def get_record(self, record_id: int) -> Optional[LabelRecord]:
        return self.db.query(LabelRecord).filter(LabelRecord.id == record_id).first()

    def get_record_detail(self, record_id: int) -> Optional[LabelRecord]:
        return self.db.query(LabelRecord).filter(LabelRecord.id == record_id).first()

    def list_records(self, skip: int = 0, limit: int = 100, status: Optional[LabelRecordStatus] = None):
        query = self.db.query(LabelRecord)
        if status:
            query = query.filter(LabelRecord.status == status)
        return query.order_by(LabelRecord.id.desc()).offset(skip).limit(limit).all()

    def update_record_status(self, record_id: int, request: StatusUpdateRequest) -> LabelRecord:
        record = self.get_record(record_id)
        if not record:
            raise ValueError(f"Record not found: {record_id}")

        old_status = record.status
        record.status = request.new_status
        record.status_reason = request.reason or "手动更新状态"
        self.db.commit()

        history = StatusHistory(
            record_id=record.id,
            from_status=old_status.value,
            to_status=request.new_status.value,
            reason=request.reason,
            operator=request.operator
        )
        self.db.add(history)
        self.db.commit()

        self.db.refresh(record)
        return record

    def reprint_record(self, record_id: int, request: ReprintRequest) -> LabelRecord:
        record = self.get_record(record_id)
        if not record:
            raise ValueError(f"Record not found: {record_id}")

        existing_reprints = self.db.query(ReprintRecord).filter(
            ReprintRecord.record_id == record_id
        ).count()

        if existing_reprints >= 3:
            raise ValueError("重打次数已达上限（最多3次）")

        reprint = ReprintRecord(
            record_id=record.id,
            reprint_count=existing_reprints + 1,
            reprint_reason=request.reason,
            operator=request.operator
        )
        self.db.add(reprint)

        old_status = record.status
        record.status = LabelRecordStatus.PRINTING
        record.status_reason = f"第{existing_reprints + 1}次重打: {request.reason}"
        self.db.commit()

        history = StatusHistory(
            record_id=record.id,
            from_status=old_status.value,
            to_status=LabelRecordStatus.PRINTING.value,
            reason=f"开始重打: {request.reason}",
            operator=request.operator
        )
        self.db.add(history)
        self.db.commit()

        record.status = LabelRecordStatus.PRINTED
        record.status_reason = f"第{existing_reprints + 1}次重打完成"
        self.db.commit()

        history = StatusHistory(
            record_id=record.id,
            from_status=LabelRecordStatus.PRINTING.value,
            to_status=LabelRecordStatus.PRINTED.value,
            reason="重打完成",
            operator=request.operator
        )
        self.db.add(history)
        self.db.commit()

        self.db.refresh(record)
        return record


class ExceptionService:
    def __init__(self, db: Session):
        self.db = db

    def get_exception(self, exception_id: int) -> Optional[ExceptionRecord]:
        return self.db.query(ExceptionRecord).filter(ExceptionRecord.id == exception_id).first()

    def list_exceptions(self, skip: int = 0, limit: int = 100, status: Optional[ExceptionStatus] = None):
        query = self.db.query(ExceptionRecord)
        if status:
            query = query.filter(ExceptionRecord.status == status)
        return query.order_by(ExceptionRecord.id.desc()).offset(skip).limit(limit).all()

    def resolve_exception(self, exception_id: int, request: ExceptionResolveRequest) -> ExceptionRecord:
        exception = self.get_exception(exception_id)
        if not exception:
            raise ValueError(f"Exception not found: {exception_id}")

        exception.status = ExceptionStatus.RESOLVED
        exception.resolution = request.resolution
        exception.resolved_at = datetime.now()
        self.db.commit()

        record = self.db.query(LabelRecord).filter(LabelRecord.id == exception.record_id).first()
        if record:
            history = StatusHistory(
                record_id=record.id,
                from_status=record.status.value,
                to_status=LabelRecordStatus.PRINTED.value,
                reason=f"异常已解决: {request.resolution}",
                operator=request.operator
            )
            self.db.add(history)
            record.status = LabelRecordStatus.PRINTED
            record.status_reason = f"异常已解决: {request.resolution}"
            self.db.commit()

        self.db.refresh(exception)
        return exception

    def archive_exception(self, exception_id: int) -> ExceptionRecord:
        exception = self.get_exception(exception_id)
        if not exception:
            raise ValueError(f"Exception not found: {exception_id}")

        exception.status = ExceptionStatus.ARCHIVED
        self.db.commit()
        self.db.refresh(exception)
        return exception


class BatchService:
    def __init__(self, db: Session):
        self.db = db

    def get_batch(self, batch_id: int) -> Optional[PrintBatch]:
        return self.db.query(PrintBatch).filter(PrintBatch.id == batch_id).first()

    def get_batch_detail(self, batch_id: int) -> Optional[PrintBatch]:
        return self.db.query(PrintBatch).filter(PrintBatch.id == batch_id).first()

    def list_batches(self, skip: int = 0, limit: int = 100):
        return self.db.query(PrintBatch).order_by(PrintBatch.id.desc()).offset(skip).limit(limit).all()


class ExportService:
    def __init__(self, db: Session):
        self.db = db

    def export_records(self, filter: ExportFilter) -> str:
        query = self.db.query(LabelRecord)

        if filter.batch_no:
            batch = self.db.query(PrintBatch).filter(PrintBatch.batch_no == filter.batch_no).first()
            if batch:
                query = query.filter(LabelRecord.batch_id == batch.id)

        if filter.status:
            query = query.filter(LabelRecord.status == filter.status)

        if filter.start_date:
            query = query.filter(LabelRecord.created_at >= filter.start_date)

        if filter.end_date:
            query = query.filter(LabelRecord.created_at <= filter.end_date)

        records = query.order_by(LabelRecord.id).all()

        output = StringIO()
        writer = csv.writer(output)

        writer.writerow([
            "记录编号", "订单号", "物流单号", "状态", "状态说明",
            "收件人", "收件电话", "收件地址", "创建时间", "更新时间"
        ])

        for record in records:
            writer.writerow([
                record.record_no,
                record.order_no,
                record.tracking_no or "",
                record.status.value,
                record.status_reason or "",
                record.receiver_name or "",
                record.receiver_phone or "",
                record.receiver_address or "",
                record.created_at.strftime("%Y-%m-%d %H:%M:%S") if record.created_at else "",
                record.updated_at.strftime("%Y-%m-%d %H:%M:%S") if record.updated_at else ""
            ])

        return output.getvalue()


class MasterDataService:
    def __init__(self, db: Session):
        self.db = db

    def list_warehouses(self):
        return self.db.query(WarehouseAccount).all()

    def list_channels(self):
        return self.db.query(LogisticsChannel).all()

    def list_templates(self, channel_id: Optional[int] = None):
        query = self.db.query(LabelTemplate)
        if channel_id:
            query = query.filter(LabelTemplate.channel_id == channel_id)
        return query.all()

    def init_sample_data(self):
        if self.db.query(WarehouseAccount).count() > 0:
            return "Sample data already exists"

        warehouses = [
            WarehouseAccount(code="WH001", name="上海仓库", config='{"region": "shanghai"}'),
            WarehouseAccount(code="WH002", name="广州仓库", config='{"region": "guangzhou"}'),
        ]
        for wh in warehouses:
            self.db.add(wh)

        channels = [
            LogisticsChannel(code="SF", name="顺丰速运", carrier="SF", api_config='{"api_key": "sf_test_key"}'),
            LogisticsChannel(code="JD", name="京东物流", carrier="JD", api_config='{"api_key": "jd_test_key"}'),
            LogisticsChannel(code="ZT", name="中通快递", carrier="ZT", api_config='{"api_key": "zt_test_key"}'),
        ]
        for ch in channels:
            self.db.add(ch)
        self.db.flush()

        sf_channel = self.db.query(LogisticsChannel).filter(LogisticsChannel.code == "SF").first()
        jd_channel = self.db.query(LogisticsChannel).filter(LogisticsChannel.code == "JD").first()
        zt_channel = self.db.query(LogisticsChannel).filter(LogisticsChannel.code == "ZT").first()

        templates = [
            LabelTemplate(code="SF_A4", name="顺丰A4模板", channel_id=sf_channel.id, width=210, height=297, template_content="<template>SF A4</template>"),
            LabelTemplate(code="SF_100X150", name="顺丰100x150标签", channel_id=sf_channel.id, width=100, height=150, template_content="<template>SF 100x150</template>"),
            LabelTemplate(code="JD_A4", name="京东A4模板", channel_id=jd_channel.id, width=210, height=297, template_content="<template>JD A4</template>"),
            LabelTemplate(code="ZT_STD", name="中通标准模板", channel_id=zt_channel.id, width=100, height=150, template_content="<template>ZT STD</template>"),
        ]
        for tpl in templates:
            self.db.add(tpl)

        self.db.commit()
        return "Sample data initialized successfully"
