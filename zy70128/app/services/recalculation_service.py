from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from app.models.result import ResultVersion, ResultRecord
from app.models.chip import ChipData
from app.models.review import Review, ReviewStatus
from app.services.exception_service import ExceptionService


class RecalculationService:
    """名次重算服务"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.exception_service = ExceptionService(db)

    async def recalculate_ranks(
        self,
        version_id: int,
        recalculate_method: str = "DURATION",
        category: Optional[str] = None,
    ) -> Dict[str, Any]:
        """重排名次"""
        version_result = await self.db.execute(
            select(ResultVersion).where(ResultVersion.id == version_id).options(
                selectinload(ResultVersion.records)
            )
        )
        version = version_result.scalar_one_or_none()
        if not version:
            return {"error": "版本不存在", "success": False}

        records_to_rerank = [
            r for r in version.records
            if r.status == "FINISHED" and (category is None or r.category == category)
        ]

        original_ranks = {r.id: r.rank for r in records_to_rerank}
        changes = []

        if recalculate_method == "DURATION":
            sorted_records = sorted(
                records_to_rerank,
                key=lambda x: (x.duration_seconds is None, x.duration_seconds if x.duration_seconds is not None else float('inf'))
            )
        elif recalculate_method == "END_TIME":
            sorted_records = sorted(
                records_to_rerank,
                key=lambda x: (x.end_time is None, x.end_time if x.end_time is not None else datetime.max)
            )
        else:
            return {"error": "不支持的重算方法", "success": False}

        for new_rank, record in enumerate(sorted_records, start=1):
            old_rank = original_ranks.get(record.id)
            if old_rank != new_rank:
                record.rank = new_rank
                changes.append({
                    "record_id": record.id,
                    "athlete_name": record.athlete_name,
                    "bib_number": record.bib_number,
                    "old_rank": old_rank,
                    "new_rank": new_rank,
                })

        await self.db.flush()

        if changes:
            await self.exception_service.create_exception(
                exception_type="RANKING_CONFLICT",
                title=f"名次重算: 版本 {version_id}",
                source_module="RecalculationService.recalculate_ranks",
                severity="MEDIUM",
                description=f"重算完成，共 {len(changes)} 条记录名次发生变化",
                raw_data=str({"recalculate_method": recalculate_method, "category": category}),
                related_record_id=str(version_id),
                related_record_type="ResultVersion",
            )

        return {
            "success": True,
            "version_id": version_id,
            "total_records": len(records_to_rerank),
            "changes_count": len(changes),
            "changes": changes,
            "method": recalculate_method,
        }

    async def recalculate_from_chip_data(
        self,
        version_id: int,
        batch_id: int,
    ) -> Dict[str, Any]:
        """基于芯片数据重算成绩"""
        version_result = await self.db.execute(
            select(ResultVersion).where(ResultVersion.id == version_id).options(
                selectinload(ResultVersion.records)
            )
        )
        version = version_result.scalar_one_or_none()
        if not version:
            return {"error": "版本不存在", "success": False}

        from app.models.chip import ChipBatch
        batch_result = await self.db.execute(
            select(ChipBatch).where(ChipBatch.id == batch_id).options(
                selectinload(ChipBatch.chip_data)
            )
        )
        batch = batch_result.scalar_one_or_none()
        if not batch:
            return {"error": "批次不存在", "success": False}

        valid_chip_records = [c for c in batch.chip_data if c.is_valid]
        chip_by_bib = {}
        for chip in valid_chip_records:
            if chip.bib_number:
                if chip.bib_number not in chip_by_bib:
                    chip_by_bib[chip.bib_number] = []
                chip_by_bib[chip.bib_number].append(chip)

        updates = []
        errors = []

        for record in version.records:
            if not record.bib_number:
                continue

            chips = chip_by_bib.get(record.bib_number, [])
            if not chips:
                errors.append({
                    "record_id": record.id,
                    "athlete_name": record.athlete_name,
                    "bib_number": record.bib_number,
                    "error": "未找到对应的芯片数据",
                })
                continue

            chips_sorted = sorted(chips, key=lambda x: x.timestamp)
            start_chip = None
            end_chip = None

            for chip in chips_sorted:
                if chip.timing_point == "START" and start_chip is None:
                    start_chip = chip
                if chip.timing_point == "END":
                    end_chip = chip

            if not start_chip:
                start_chip = chips_sorted[0] if chips_sorted else None
            if not end_chip:
                end_chip = chips_sorted[-1] if chips_sorted else None

            if start_chip and end_chip:
                duration = (end_chip.timestamp - start_chip.timestamp).total_seconds()

                old_start = record.start_time
                old_end = record.end_time
                old_duration = record.duration_seconds

                record.start_time = start_chip.timestamp
                record.end_time = end_chip.timestamp
                record.duration_seconds = duration
                record.source = "CHIP_RECALCULATED"

                updates.append({
                    "record_id": record.id,
                    "athlete_name": record.athlete_name,
                    "bib_number": record.bib_number,
                    "old_start_time": old_start.isoformat() if old_start else None,
                    "new_start_time": start_chip.timestamp.isoformat(),
                    "old_end_time": old_end.isoformat() if old_end else None,
                    "new_end_time": end_chip.timestamp.isoformat(),
                    "old_duration": old_duration,
                    "new_duration": duration,
                })

        await self.db.flush()

        if errors:
            await self.exception_service.create_exception(
                exception_type="DATA_INCONSISTENCY",
                title=f"基于芯片重算成绩: 版本 {version_id}",
                source_module="RecalculationService.recalculate_from_chip_data",
                severity="HIGH",
                description=f"重算完成，{len(errors)} 条记录未找到芯片数据",
                raw_data=str({"batch_id": batch_id, "errors_count": len(errors)}),
                related_record_id=str(version_id),
                related_record_type="ResultVersion",
            )

        return {
            "success": True,
            "version_id": version_id,
            "batch_id": batch_id,
            "updated_records": len(updates),
            "errors_count": len(errors),
            "updates": updates[:50],
            "errors": errors,
        }

    async def create_recalculated_version(
        self,
        race_id: int,
        review_id: int,
        notes: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """基于审核结果创建重算后的版本"""
        review_result = await self.db.execute(
            select(Review).where(Review.id == review_id)
        )
        review = review_result.scalar_one_or_none()
        if not review:
            return None

        if review.status != ReviewStatus.APPROVED.value:
            return None

        from app.services.result_service import ResultService
        result_service = ResultService(self.db)

        old_version = await result_service.get_latest_version(race_id, include_records=True)
        if not old_version:
            return None

        new_version = await result_service.create_new_version_from_previous(
            race_id=race_id,
            notes=f"基于审核重算: {notes or review.findings}",
            created_by=review.approved_by or review.reviewer_name,
        )

        if new_version:
            return {
                "success": True,
                "old_version_id": old_version.id,
                "new_version_id": new_version.id,
                "new_version_number": new_version.version_number,
                "review_id": review_id,
            }

        return None
