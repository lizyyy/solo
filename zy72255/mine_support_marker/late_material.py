from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from mine_support_marker.models import MarkerRecord, ProcessingStatus
from mine_support_marker.repository import MarkerRepository


PROTECTED_FIELDS = frozenset({
    "photo_number",
    "original_line_number",
    "conclusion",
    "remark",
})


@dataclass
class LateMaterialResult:
    marker_id: str
    photo_number: str
    fields_updated: list[str]
    fields_protected: list[str]
    success: bool
    message: str


class LateMaterialService:
    def __init__(self, repo: MarkerRepository) -> None:
        self._repo = repo

    def apply_cad_layer_late_arrival(
        self,
        photo_number: str,
        cad_layer_name: str,
        operator: str,
    ) -> list[LateMaterialResult]:
        records = self._repo.find_by_photo_number(photo_number)
        if not records:
            return [
                LateMaterialResult(
                    marker_id="",
                    photo_number=photo_number,
                    fields_updated=[],
                    fields_protected=[],
                    success=False,
                    message=f"巡检照片编号 {photo_number} 不存在",
                )
            ]

        results: list[LateMaterialResult] = []
        for record in records:
            updated: list[str] = []
            protected: list[str] = []

            if not record.is_field_confirmed("cad_layer_name"):
                record.apply_change(
                    "cad_layer_name",
                    cad_layer_name,
                    operator,
                    "晚到材料：CAD图层名后补",
                )
                updated.append("cad_layer_name")
            else:
                protected.append("cad_layer_name")

            for pf in PROTECTED_FIELDS:
                if record.is_field_confirmed(pf):
                    protected.append(pf)

            if record.status == ProcessingStatus.IMPORTED:
                record.apply_change(
                    "status",
                    ProcessingStatus.CAD_LAYER_REVIEWED,
                    operator,
                    "晚到材料：CAD图层名补看后状态更新",
                )
                updated.append("status")

            results.append(
                LateMaterialResult(
                    marker_id=record.marker_id,
                    photo_number=record.photo_number,
                    fields_updated=updated,
                    fields_protected=protected,
                    success=True,
                    message=f"CAD图层名已刷新{('，' + '、'.join(protected) + '已确认受保护') if protected else ''}",
                )
            )

        return results

    def batch_apply_cad_layers(
        self,
        cad_layer_updates: dict[str, str],
        operator: str,
    ) -> list[LateMaterialResult]:
        all_results: list[LateMaterialResult] = []
        for photo_number, cad_layer_name in cad_layer_updates.items():
            results = self.apply_cad_layer_late_arrival(
                photo_number, cad_layer_name, operator
            )
            all_results.extend(results)
        return all_results

    def confirm_field(
        self,
        marker_id: str,
        field_name: str,
        operator: str,
    ) -> bool:
        record = self._repo.get(marker_id)
        if record is None:
            return False
        record.confirm_field(field_name)
        return True
