from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
import hashlib
import json

from app.models import (
    VesselSchedule,
    Berth,
    TideRecord,
    ReconciliationBatch,
    ReconciliationRecord,
    DiscrepancyLog,
    ReviewHistory,
    ReconciliationStatus,
    DiscrepancyType,
)
from app.services.import_service import ImportService


class ReconciliationService:
    def __init__(self, db: Session):
        self.db = db
        self.import_service = ImportService(db)
        self.MIN_DEPTH_MARGIN = 0.5

    def run_reconciliation(self, batch_id: str) -> Dict[str, Any]:
        batch = self.db.query(ReconciliationBatch).filter(ReconciliationBatch.batch_id == batch_id).first()
        if not batch:
            raise ValueError(f"Batch {batch_id} not found")

        vessels = self.db.query(VesselSchedule).all()
        berths = {b.berth_number: b for b in self.db.query(Berth).all()}
        tides = self.db.query(TideRecord).order_by(TideRecord.record_date).all()

        self.db.query(ReconciliationRecord).filter(ReconciliationRecord.batch_id == batch_id).delete()
        self.db.query(DiscrepancyLog).filter(DiscrepancyLog.batch_id == batch_id).delete()
        self.db.commit()

        passed_count = 0
        failed_count = 0
        warning_count = 0

        for vessel in vessels:
            record = self._create_reconciliation_record(batch_id, vessel, berths.get(vessel.berth_number))
            discrepancies = []

            if record.berth_number and record.berth_number in berths:
                berth = berths[record.berth_number]

                depth_discrepancies = self._check_draft_and_depth(vessel, berth, tides, record)
                discrepancies.extend(depth_discrepancies)

                availability_discrepancies = self._check_berth_availability(vessel, berth, record)
                discrepancies.extend(availability_discrepancies)

                window_discrepancies = self._check_berth_window(vessel, berth, tides, record)
                discrepancies.extend(window_discrepancies)
            else:
                discrepancies.append(
                    self._create_discrepancy(
                        record.id,
                        batch_id,
                        DiscrepancyType.BERTH_UNAVAILABLE,
                        "warning",
                        "berth_number",
                        None,
                        vessel.berth_number,
                        f"船舶 {vessel.vessel_name} 未分配有效泊位",
                        "船期表中未指定泊位或泊位不存在，请确认靠泊计划",
                    )
                )

            if vessel.is_cut_in:
                discrepancies.append(
                    self._create_discrepancy(
                        record.id,
                        batch_id,
                        DiscrepancyType.CUT_IN_DETECTED,
                        "warning",
                        "is_cut_in",
                        "False",
                        "True",
                        f"检测到船舶 {vessel.vessel_name} 为临时插队船舶",
                        f"插队原因: {vessel.cut_in_reason or '未提供'}，需要人工复核确认优先级",
                    )
                )

            for disc in discrepancies:
                self.db.add(disc)

            record.discrepancy_count = len(discrepancies)
            record.has_discrepancy = len(discrepancies) > 0

            if len(discrepancies) == 0:
                record.status = ReconciliationStatus.AUTO_CHECKED
                passed_count += 1
            elif any(d.severity == "error" for d in discrepancies):
                record.status = ReconciliationStatus.AUTO_CHECKED
                failed_count += 1
            else:
                record.status = ReconciliationStatus.AUTO_CHECKED
                warning_count += 1

            self.db.add(record)

        batch.status = ReconciliationStatus.AUTO_CHECKED
        batch.total_records = len(vessels)
        batch.passed_records = passed_count
        batch.failed_records = failed_count
        batch.warning_records = warning_count
        batch.checked_at = datetime.utcnow()

        self.db.commit()

        return {
            "batch_id": batch_id,
            "total_records": len(vessels),
            "passed_count": passed_count,
            "failed_count": failed_count,
            "warning_count": warning_count,
        }

    def _create_reconciliation_record(
        self, batch_id: str, vessel: VesselSchedule, berth: Optional[Berth]
    ) -> ReconciliationRecord:
        available_depth = berth.depth_at_mllw if berth else 0
        depth_margin = available_depth - vessel.draft if berth else -vessel.draft

        data_dict = {
            "vessel_name": vessel.vessel_name,
            "draft": vessel.draft,
            "eta": vessel.eta.isoformat() if vessel.eta else None,
            "berth_number": vessel.berth_number,
        }
        data_hash = hashlib.sha256(json.dumps(data_dict, sort_keys=True).encode()).hexdigest()

        record = ReconciliationRecord(
            batch_id=batch_id,
            vessel_schedule_id=vessel.id,
            berth_id=berth.id if berth else None,
            vessel_name=vessel.vessel_name,
            vessel_imo=vessel.vessel_imo,
            voyage_number=vessel.voyage_number,
            berth_number=vessel.berth_number,
            draft=vessel.draft,
            available_depth=available_depth,
            depth_margin=depth_margin,
            arrival_time=vessel.eta,
            departure_time=vessel.etd,
            planned_berth_time=vessel.etb,
            status=ReconciliationStatus.PENDING,
            original_data_hash=data_hash,
            current_data_hash=data_hash,
        )
        self.db.add(record)
        self.db.flush()
        return record

    def _check_draft_and_depth(
        self, vessel: VesselSchedule, berth: Berth, tides: List[TideRecord], record: ReconciliationRecord
    ) -> List[DiscrepancyLog]:
        discrepancies = []

        available_depth = berth.depth_at_mllw
        tide_height = self._get_tide_at_time(vessel.eta, tides) if vessel.eta else 0
        total_available_depth = available_depth + tide_height
        depth_margin = total_available_depth - vessel.draft

        record.available_depth = total_available_depth
        record.depth_margin = depth_margin

        if depth_margin < 0:
            discrepancies.append(
                self._create_discrepancy(
                    record.id,
                    record.batch_id,
                    DiscrepancyType.DRAFT_EXCEEDS_DEPTH,
                    "error",
                    "draft",
                    f"< {total_available_depth:.2f}m",
                    f"{vessel.draft:.2f}m",
                    f"船舶吃水 {vessel.draft:.2f}m 超过可用水深 {total_available_depth:.2f}m（泊位基准水深 {available_depth:.2f}m + 潮汐 {tide_height:.2f}m）",
                    f"无法靠泊，吃水超差 {abs(depth_margin):.2f}m。建议：1) 等待更高潮位 2) 更换深水泊位 3) 船舶减载",
                )
            )
        elif depth_margin < self.MIN_DEPTH_MARGIN:
            discrepancies.append(
                self._create_discrepancy(
                    record.id,
                    record.batch_id,
                    DiscrepancyType.TIDE_INSUFFICIENT,
                    "warning",
                    "depth_margin",
                    f">= {self.MIN_DEPTH_MARGIN}m",
                    f"{depth_margin:.2f}m",
                    f"水深余量不足：{depth_margin:.2f}m（最低要求 {self.MIN_DEPTH_MARGIN}m）",
                    f"可用水深 {total_available_depth:.2f}m = 泊位基准 {available_depth:.2f}m + 潮汐 {tide_height:.2f}m。建议密切关注潮汐变化，确认靠泊窗口。",
                )
            )

        return discrepancies

    def _check_berth_availability(
        self, vessel: VesselSchedule, berth: Berth, record: ReconciliationRecord
    ) -> List[DiscrepancyLog]:
        discrepancies = []

        if not berth.is_available:
            if berth.unavailable_from and berth.unavailable_to and vessel.eta:
                if berth.unavailable_from <= vessel.eta <= berth.unavailable_to:
                    discrepancies.append(
                        self._create_discrepancy(
                            record.id,
                            record.batch_id,
                            DiscrepancyType.BERTH_UNAVAILABLE,
                            "error",
                            "berth_available",
                            "可用",
                            "不可用",
                            f"泊位 {berth.berth_number} 在船舶到港时间不可用",
                            f"泊位不可用时段: {berth.unavailable_from.strftime('%Y-%m-%d %H:%M')} ~ {berth.unavailable_to.strftime('%Y-%m-%d %H:%M')}，原因: {berth.unavailable_reason or '未说明'}。建议更换泊位或调整到港时间。",
                        )
                    )

        return discrepancies

    def _check_berth_window(
        self, vessel: VesselSchedule, berth: Berth, tides: List[TideRecord], record: ReconciliationRecord
    ) -> List[DiscrepancyLog]:
        discrepancies = []

        if vessel.eta and vessel.etd:
            if vessel.eta.date() != vessel.etd.date():
                discrepancies.append(
                    self._create_discrepancy(
                        record.id,
                        record.batch_id,
                        DiscrepancyType.CROSS_DAY_WINDOW,
                        "warning",
                        "berth_window",
                        "同日",
                        "跨日",
                        f"检测到跨日装卸窗口：{vessel.eta.strftime('%Y-%m-%d %H:%M')} ~ {vessel.etd.strftime('%Y-%m-%d %H:%M')}",
                        "跨日作业需确认：1) 夜航许可 2) 连续作业审批 3) 潮汐变化对水深的持续影响。建议人工复核确认。",
                    )
                )

            min_depth_in_window = self._get_min_depth_in_window(vessel.eta, vessel.etd, berth.depth_at_mllw, tides)
            if min_depth_in_window < vessel.draft + 0.3:
                discrepancies.append(
                    self._create_discrepancy(
                        record.id,
                        record.batch_id,
                        DiscrepancyType.TIDE_INSUFFICIENT,
                        "warning",
                        "window_depth",
                        f">= {vessel.draft + 0.3:.2f}m",
                        f"{min_depth_in_window:.2f}m",
                        f"装卸窗口内最小可用水深 {min_depth_in_window:.2f}m 接近安全边际",
                        f"作业期间水深波动较大，最低水深 {min_depth_in_window:.2f}m。建议：1) 缩短作业时间 2) 高潮时段优先完成吃水敏感作业 3) 准备应急预案。",
                    )
                )

        return discrepancies

    def _get_tide_at_time(self, target_time: datetime, tides: List[TideRecord]) -> float:
        if not target_time or not tides:
            return 0

        target_time = target_time.replace(tzinfo=None)

        before_tide = None
        after_tide = None

        for tide in tides:
            tide_time = tide.record_date.replace(tzinfo=None)
            if tide_time <= target_time:
                before_tide = tide
            else:
                after_tide = tide
                break

        if before_tide is None and after_tide:
            return after_tide.height
        if after_tide is None and before_tide:
            return before_tide.height
        if before_tide and after_tide:
            time_diff = (after_tide.record_date - before_tide.record_date).total_seconds()
            if time_diff == 0:
                return before_tide.height
            progress = (target_time - before_tide.record_date.replace(tzinfo=None)).total_seconds() / time_diff
            height_diff = after_tide.height - before_tide.height
            return before_tide.height + height_diff * progress

        return 0

    def _get_min_depth_in_window(
        self, start_time: datetime, end_time: datetime, base_depth: float, tides: List[TideRecord]
    ) -> float:
        if not start_time or not end_time:
            return base_depth

        min_tide = float("inf")
        current = start_time.replace(tzinfo=None)
        end = end_time.replace(tzinfo=None)

        while current <= end:
            tide = self._get_tide_at_time(current, tides)
            min_tide = min(min_tide, tide)
            current += timedelta(minutes=30)

        return base_depth + min_tide

    def _create_discrepancy(
        self,
        record_id: int,
        batch_id: str,
        discrepancy_type: str,
        severity: str,
        field_name: str,
        expected_value: str,
        actual_value: str,
        description: str,
        explanation: str,
    ) -> DiscrepancyLog:
        return DiscrepancyLog(
            record_id=record_id,
            batch_id=batch_id,
            discrepancy_type=discrepancy_type,
            severity=severity,
            field_name=field_name,
            expected_value=str(expected_value) if expected_value else None,
            actual_value=str(actual_value) if actual_value else None,
            description=description,
            explanation=explanation,
            source="auto_check",
            is_resolved=False,
        )

    def get_record_details(self, record_id: int) -> ReconciliationRecord:
        record = self.db.query(ReconciliationRecord).filter(ReconciliationRecord.id == record_id).first()
        if not record:
            raise ValueError(f"Record {record_id} not found")
        return record

    def get_batch_records(self, batch_id: str) -> List[ReconciliationRecord]:
        return (
            self.db.query(ReconciliationRecord)
            .filter(ReconciliationRecord.batch_id == batch_id)
            .order_by(ReconciliationRecord.arrival_time)
            .all()
        )
