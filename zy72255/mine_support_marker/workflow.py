from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional

from mine_support_marker.models import MarkerRecord, ProcessingStatus
from mine_support_marker.importer import ImportRow, MarkerImporter
from mine_support_marker.repository import MarkerRepository
from mine_support_marker.z_axis import ZAxisService


class WorkflowStep(Enum):
    STEP_1_IMPORTED = "step_1_imported"
    STEP_2_CAD_LAYER_REVIEWED = "step_2_cad_layer_reviewed"
    STEP_3_PATH_REPLAY_UPDATED = "step_3_path_replay_updated"


STEP_STATUS_MAP = {
    WorkflowStep.STEP_1_IMPORTED: ProcessingStatus.IMPORTED,
    WorkflowStep.STEP_2_CAD_LAYER_REVIEWED: ProcessingStatus.CAD_LAYER_REVIEWED,
    WorkflowStep.STEP_3_PATH_REPLAY_UPDATED: ProcessingStatus.PATH_REPLAY_UPDATED,
}

REQUIRED_PREV_STEP = {
    WorkflowStep.STEP_2_CAD_LAYER_REVIEWED: WorkflowStep.STEP_1_IMPORTED,
    WorkflowStep.STEP_3_PATH_REPLAY_UPDATED: WorkflowStep.STEP_2_CAD_LAYER_REVIEWED,
}


@dataclass
class WorkflowResult:
    marker_id: str
    photo_number: str
    step: WorkflowStep
    success: bool
    message: str
    z_axis_flagged: bool = False


class WorkflowService:
    def __init__(self, repo: MarkerRepository) -> None:
        self._repo = repo
        self._importer = MarkerImporter(repo)
        self._z_axis = ZAxisService(repo)

    def step_1_import(
        self,
        rows: list[ImportRow],
        batch_id: Optional[str] = None,
        operator: str = "system",
    ) -> list[WorkflowResult]:
        import_result = self._importer.import_rows(rows, batch_id, operator)
        results: list[WorkflowResult] = []
        for record in import_result.created:
            z_flagged = False
            if ZAxisService.should_flag_for_review(record.z_axis_value):
                self._z_axis.flag_z_axis_reversal(record.marker_id, operator)
                z_flagged = True
            results.append(
                WorkflowResult(
                    marker_id=record.marker_id,
                    photo_number=record.photo_number,
                    step=WorkflowStep.STEP_1_IMPORTED,
                    success=True,
                    message="巡检照片编号首次导入完成"
                    + ("，Z轴方向异常已标记待复核" if z_flagged else ""),
                    z_axis_flagged=z_flagged,
                )
            )
        for photo_num in import_result.skipped_duplicates:
            results.append(
                WorkflowResult(
                    marker_id="",
                    photo_number=photo_num,
                    step=WorkflowStep.STEP_1_IMPORTED,
                    success=False,
                    message="重复导入，已跳过",
                )
            )
        return results

    def step_2_review_cad_layer(
        self,
        marker_id: str,
        cad_layer_name: str,
        operator: str,
    ) -> Optional[WorkflowResult]:
        record = self._repo.get(marker_id)
        if record is None:
            return WorkflowResult(
                marker_id=marker_id,
                photo_number="",
                step=WorkflowStep.STEP_2_CAD_LAYER_REVIEWED,
                success=False,
                message="记录不存在",
            )
        if record.status not in (
            ProcessingStatus.IMPORTED,
            ProcessingStatus.Z_AXIS_FLAGGED,
        ):
            return WorkflowResult(
                marker_id=marker_id,
                photo_number=record.photo_number,
                step=WorkflowStep.STEP_2_CAD_LAYER_REVIEWED,
                success=False,
                message=f"当前状态 {record.status.value} 不允许进入CAD图层名补看步骤",
            )
        record.apply_change(
            "cad_layer_name", cad_layer_name, operator, "航测内业补看CAD图层名"
        )
        record.apply_change(
            "status", ProcessingStatus.CAD_LAYER_REVIEWED, operator, "CAD图层名已补看"
        )
        z_flagged = record.z_axis_flagged_for_review
        return WorkflowResult(
            marker_id=marker_id,
            photo_number=record.photo_number,
            step=WorkflowStep.STEP_2_CAD_LAYER_REVIEWED,
            success=True,
            message="CAD图层名补看完成"
            + ("，Z轴方向异常仍待现场班组复核" if z_flagged else ""),
            z_axis_flagged=z_flagged,
        )

    def step_3_path_replay_update(
        self,
        marker_id: str,
        path_data: dict,
        operator: str,
    ) -> Optional[WorkflowResult]:
        record = self._repo.get(marker_id)
        if record is None:
            return WorkflowResult(
                marker_id=marker_id,
                photo_number="",
                step=WorkflowStep.STEP_3_PATH_REPLAY_UPDATED,
                success=False,
                message="记录不存在",
            )
        if record.status not in (
            ProcessingStatus.CAD_LAYER_REVIEWED,
            ProcessingStatus.Z_AXIS_FLAGGED,
        ):
            return WorkflowResult(
                marker_id=marker_id,
                photo_number=record.photo_number,
                step=WorkflowStep.STEP_3_PATH_REPLAY_UPDATED,
                success=False,
                message=f"当前状态 {record.status.value} 不允许进入路径回放更新步骤",
            )
        if record.z_axis_flagged_for_review:
            return WorkflowResult(
                marker_id=marker_id,
                photo_number=record.photo_number,
                step=WorkflowStep.STEP_3_PATH_REPLAY_UPDATED,
                success=False,
                message="Z轴方向按旧习惯写反，归正常前需现场班组复核确认，请勿急归正常",
                z_axis_flagged=True,
            )
        for field_name, new_value in path_data.items():
            if not record.is_field_confirmed(field_name):
                record.apply_change(
                    field_name, new_value, operator, "路径回放更新"
                )
        record.apply_change(
            "status", ProcessingStatus.PATH_REPLAY_UPDATED, operator, "路径回放更新完成"
        )
        return WorkflowResult(
            marker_id=marker_id,
            photo_number=record.photo_number,
            step=WorkflowStep.STEP_3_PATH_REPLAY_UPDATED,
            success=True,
            message="路径回放更新完成",
        )

    def get_current_step(self, marker_id: str) -> Optional[WorkflowStep]:
        record = self._repo.get(marker_id)
        if record is None:
            return None
        status_to_step = {
            ProcessingStatus.IMPORTED: WorkflowStep.STEP_1_IMPORTED,
            ProcessingStatus.Z_AXIS_FLAGGED: WorkflowStep.STEP_1_IMPORTED,
            ProcessingStatus.CAD_LAYER_REVIEWED: WorkflowStep.STEP_2_CAD_LAYER_REVIEWED,
            ProcessingStatus.PATH_REPLAY_UPDATED: WorkflowStep.STEP_3_PATH_REPLAY_UPDATED,
            ProcessingStatus.FIELD_TEAM_CONFIRMED: WorkflowStep.STEP_3_PATH_REPLAY_UPDATED,
            ProcessingStatus.FIELD_TEAM_REJECTED: WorkflowStep.STEP_3_PATH_REPLAY_UPDATED,
        }
        return status_to_step.get(record.status)
