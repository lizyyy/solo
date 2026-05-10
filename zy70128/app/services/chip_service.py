from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from app.models.chip import ChipBatch, ChipData
from app.models.result import ResultVersion, ResultRecord
from app.schemas.chip import ChipBatchCreate, ChipDataCreate, ChipImportRequest
from app.services.exception_service import ExceptionService


class ChipService:
    """芯片数据服务"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.exception_service = ExceptionService(db)

    async def create_batch(self, batch_data: ChipBatchCreate) -> ChipBatch:
        """创建芯片数据批次"""
        batch = ChipBatch(
            race_id=batch_data.race_id,
            batch_name=batch_data.batch_name,
            import_status="PENDING",
            imported_by=batch_data.imported_by,
            notes=batch_data.notes,
        )
        self.db.add(batch)
        await self.db.flush()
        return batch

    async def import_chip_data(self, import_data: ChipImportRequest) -> Tuple[ChipBatch, List[Exception]]:
        """导入芯片数据并验证"""
        batch = ChipBatch(
            race_id=import_data.race_id,
            batch_name=import_data.batch_name,
            import_status="PROCESSING",
            total_records=len(import_data.chip_data),
            imported_by=import_data.imported_by,
            notes=import_data.notes,
        )
        self.db.add(batch)
        await self.db.flush()

        error_count = 0
        valid_count = 0
        errors = []

        for idx, chip_data in enumerate(import_data.chip_data):
            is_valid, validation_error = self._validate_chip_data(chip_data)

            if not is_valid:
                error_count += 1
                chip = ChipData(
                    batch_id=batch.id,
                    chip_id=chip_data.chip_id,
                    bib_number=chip_data.bib_number,
                    athlete_id=chip_data.athlete_id,
                    timing_point=chip_data.timing_point,
                    timestamp=chip_data.timestamp,
                    raw_data=chip_data.raw_data,
                    is_valid=False,
                    validation_error=validation_error,
                )
                self.db.add(chip)

                await self.exception_service.create_exception(
                    exception_type="INVALID_DATA",
                    title=f"芯片数据验证失败: {chip_data.chip_id}",
                    source_module="ChipService.import_chip_data",
                    severity="MEDIUM",
                    description=validation_error,
                    raw_data=str(chip_data.model_dump()),
                    related_record_id=str(batch.id),
                    related_record_type="ChipBatch",
                )
            else:
                valid_count += 1
                chip = ChipData(
                    batch_id=batch.id,
                    chip_id=chip_data.chip_id,
                    bib_number=chip_data.bib_number,
                    athlete_id=chip_data.athlete_id,
                    timing_point=chip_data.timing_point,
                    timestamp=chip_data.timestamp,
                    raw_data=chip_data.raw_data,
                    is_valid=True,
                )
                self.db.add(chip)

        batch.processed_records = len(import_data.chip_data)
        batch.error_count = error_count
        batch.import_status = "COMPLETED" if error_count == 0 else "COMPLETED_WITH_ERRORS"
        await self.db.flush()

        return batch, errors

    def _validate_chip_data(self, chip_data: ChipDataCreate) -> Tuple[bool, Optional[str]]:
        """验证单条芯片数据"""
        if not chip_data.chip_id:
            return False, "芯片ID不能为空"

        if not chip_data.timing_point:
            return False, "计时点不能为空"

        if not chip_data.timestamp:
            return False, "时间戳不能为空"

        if chip_data.timestamp > datetime.utcnow():
            return False, "时间戳不能晚于当前时间"

        return True, None

    async def get_batch(self, batch_id: int, include_chip_data: bool = True) -> Optional[ChipBatch]:
        """获取芯片数据批次"""
        stmt = select(ChipBatch).where(ChipBatch.id == batch_id)
        if include_chip_data:
            stmt = stmt.options(selectinload(ChipBatch.chip_data))

        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_batches(
        self,
        race_id: Optional[int] = None,
        import_status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[ChipBatch]:
        """列出芯片数据批次"""
        conditions = []
        if race_id is not None:
            conditions.append(ChipBatch.race_id == race_id)
        if import_status is not None:
            conditions.append(ChipBatch.import_status == import_status)

        stmt = select(ChipBatch)
        if conditions:
            stmt = stmt.where(and_(*conditions))
        stmt = stmt.order_by(ChipBatch.created_at.desc()).limit(limit).offset(offset)

        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def reconcile_with_results(
        self,
        batch_id: int,
        version_id: int,
    ) -> Dict[str, Any]:
        """对比芯片数据与成绩数据，识别不一致"""
        batch = await self.get_batch(batch_id, include_chip_data=True)
        if not batch:
            return {"error": "批次不存在"}

        version_result = await self.db.execute(
            select(ResultVersion).where(ResultVersion.id == version_id).options(
                selectinload(ResultVersion.records)
            )
        )
        version = version_result.scalar_one_or_none()
        if not version:
            return {"error": "版本不存在"}

        valid_chip_records = [c for c in batch.chip_data if c.is_valid]
        chip_by_bib = {}
        for chip in valid_chip_records:
            if chip.bib_number:
                if chip.bib_number not in chip_by_bib:
                    chip_by_bib[chip.bib_number] = []
                chip_by_bib[chip.bib_number].append(chip)

        result_by_bib = {}
        for record in version.records:
            if record.bib_number:
                result_by_bib[record.bib_number] = record

        inconsistencies = []
        missing_chip_data = []
        missing_result_data = []

        for bib, result in result_by_bib.items():
            if bib not in chip_by_bib:
                missing_chip_data.append({
                    "bib_number": bib,
                    "athlete_name": result.athlete_name,
                    "athlete_id": result.athlete_id,
                })

                await self.exception_service.create_exception(
                    exception_type="MISSING_DATA",
                    title=f"缺少芯片数据: {bib}",
                    source_module="ChipService.reconcile_with_results",
                    severity="MEDIUM",
                    description=f"运动员 {result.athlete_name} (号码布 {bib}) 的成绩存在，但无对应的芯片数据",
                    related_record_id=str(result.id),
                    related_record_type="ResultRecord",
                )

        for bib, chips in chip_by_bib.items():
            if bib not in result_by_bib:
                missing_result_data.append({
                    "bib_number": bib,
                    "chip_count": len(chips),
                })

                await self.exception_service.create_exception(
                    exception_type="MISSING_DATA",
                    title=f"缺少成绩记录: {bib}",
                    source_module="ChipService.reconcile_with_results",
                    severity="HIGH",
                    description=f"芯片数据中有号码布 {bib}，但成绩记录中不存在",
                    related_record_id=str(batch.id),
                    related_record_type="ChipBatch",
                )

            if bib in result_by_bib:
                result = result_by_bib[bib]
                chips_sorted = sorted(chips, key=lambda x: x.timestamp)

                if chips_sorted and result.end_time:
                    chip_end_time = chips_sorted[-1].timestamp
                    time_diff = abs((chip_end_time - result.end_time).total_seconds())

                    if time_diff > 1:
                        inconsistencies.append({
                            "bib_number": bib,
                            "athlete_name": result.athlete_name,
                            "result_end_time": result.end_time.isoformat(),
                            "chip_end_time": chip_end_time.isoformat(),
                            "difference_seconds": time_diff,
                        })

                        await self.exception_service.create_exception(
                            exception_type="TIMESTAMP_CONFLICT",
                            title=f"时间戳不一致: {bib}",
                            source_module="ChipService.reconcile_with_results",
                            severity="HIGH",
                            description=f"成绩记录与芯片数据的结束时间相差 {time_diff:.2f} 秒",
                            raw_data=str({
                                "result_end_time": result.end_time.isoformat(),
                                "chip_end_time": chip_end_time.isoformat(),
                            }),
                            related_record_id=str(result.id),
                            related_record_type="ResultRecord",
                        )

        await self.db.flush()

        return {
            "batch_id": batch_id,
            "version_id": version_id,
            "total_chip_records": len(valid_chip_records),
            "total_result_records": len(version.records),
            "inconsistencies": inconsistencies,
            "missing_chip_data": missing_chip_data,
            "missing_result_data": missing_result_data,
            "has_issues": len(inconsistencies) > 0 or len(missing_chip_data) > 0 or len(missing_result_data) > 0,
        }
