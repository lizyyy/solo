from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from mine_support_marker.models import MarkerRecord, ProcessingStatus, ZAxisConvention
from mine_support_marker.repository import MarkerRepository


OLD_CONVENTION_THRESHOLD = 0.0

OLD_CONVENTION_Z_SIGN = -1


@dataclass
class ZAxisDetection:
    marker_id: str
    photo_number: str
    current_value: float
    detected_convention: ZAxisConvention
    needs_review: bool
    reason: str


class ZAxisService:
    def __init__(self, repo: MarkerRepository) -> None:
        self._repo = repo

    @staticmethod
    def detect_convention(z_value: float, expected_sign: int = 1) -> ZAxisConvention:
        if z_value == 0.0:
            return ZAxisConvention.STANDARD
        actual_sign = 1 if z_value > 0 else -1
        if actual_sign != expected_sign:
            return ZAxisConvention.OLD_REVERSED
        return ZAxisConvention.STANDARD

    @staticmethod
    def should_flag_for_review(
        z_value: float,
        declared_convention: ZAxisConvention = ZAxisConvention.STANDARD,
    ) -> bool:
        detected = ZAxisService.detect_convention(z_value)
        if detected == ZAxisConvention.OLD_REVERSED:
            return True
        return False

    def flag_z_axis_reversal(
        self,
        marker_id: str,
        operator: str,
        reason: str = "",
    ) -> Optional[MarkerRecord]:
        record = self._repo.get(marker_id)
        if record is None:
            return None
        if record.status == ProcessingStatus.FIELD_TEAM_CONFIRMED:
            return None
        if record.z_axis_flagged_for_review:
            return record
        record.apply_change(
            "z_axis_flagged_for_review", True, operator, reason or "Z轴方向按旧习惯写反，标记待复核"
        )
        record.apply_change(
            "z_axis_convention", ZAxisConvention.OLD_REVERSED, operator, reason or "检测到Z轴旧习惯反转"
        )
        record.apply_change(
            "status", ProcessingStatus.Z_AXIS_FLAGGED, operator, "Z轴方向异常，等待现场班组复核"
        )
        return record

    def correct_z_axis(
        self,
        marker_id: str,
        operator: str,
        reason: str = "",
    ) -> Optional[MarkerRecord]:
        record = self._repo.get(marker_id)
        if record is None:
            return None
        if not record.z_axis_flagged_for_review:
            return record
        corrected_value = -record.z_axis_value
        record.apply_change(
            "z_axis_value", corrected_value, operator, reason or "Z轴方向按标准习惯修正"
        )
        record.apply_change(
            "z_axis_convention", ZAxisConvention.STANDARD, operator, "Z轴已按标准习惯修正"
        )
        record.apply_change(
            "z_axis_flagged_for_review", False, operator, "Z轴方向已修正，取消复核标记"
        )
        return record

    def rollback_z_axis_correction(
        self,
        marker_id: str,
        operator: str,
        reason: str = "",
    ) -> Optional[MarkerRecord]:
        record = self._repo.get(marker_id)
        if record is None:
            return None
        z_history = record.get_history_for_field("z_axis_value")
        if not z_history:
            return record
        original_z = z_history[0].old_value
        record.apply_change(
            "z_axis_value", original_z, operator, reason or "回滚Z轴修正，恢复原始值"
        )
        record.apply_change(
            "z_axis_convention", ZAxisConvention.OLD_REVERSED, operator, "回滚Z轴修正，恢复旧习惯标记"
        )
        record.apply_change(
            "z_axis_flagged_for_review", True, operator, "回滚Z轴修正，重新标记待复核"
        )
        record.apply_change(
            "status", ProcessingStatus.Z_AXIS_FLAGGED, operator, "回滚Z轴修正，等待现场班组复核"
        )
        return record

    def scan_batch_for_reversals(
        self, batch_id: str, operator: str
    ) -> list[ZAxisDetection]:
        records = self._repo.find_by_batch_id(batch_id)
        results: list[ZAxisDetection] = []
        for record in records:
            detected = self.detect_convention(record.z_axis_value)
            needs_review = self.should_flag_for_review(record.z_axis_value)
            results.append(
                ZAxisDetection(
                    marker_id=record.marker_id,
                    photo_number=record.photo_number,
                    current_value=record.z_axis_value,
                    detected_convention=detected,
                    needs_review=needs_review,
                    reason="Z轴值符号与标准习惯不符" if needs_review else "Z轴方向正常",
                )
            )
            if needs_review and not record.z_axis_flagged_for_review:
                self.flag_z_axis_reversal(record.marker_id, operator)
        return results
