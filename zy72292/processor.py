from datetime import datetime
from typing import Dict, List, Any
import uuid

from models import (
    FloorSectionSketch,
    PointCloudLog,
    Issue,
    IssueStatus,
    NextAction,
    ManualCorrection,
    ReRunRecord,
    PathPlayback,
)


class ZAxisAnalyzer:
    EXPECTED_DIRECTION = "up"

    @staticmethod
    def detect_inversion(z_direction: str) -> bool:
        return z_direction.lower() != ZAxisAnalyzer.EXPECTED_DIRECTION

    @staticmethod
    def create_issue(
        sketch_id: str,
        z_direction: str,
        discovered_by: str,
    ) -> Issue:
        return Issue(
            issue_id=f"ISS-{uuid.uuid4().hex[:8]}",
            type="Z轴方向异常",
            description=f"检测到Z轴方向按旧习惯写反，当前值为: {z_direction}",
            status=IssueStatus.PENDING,
            discovered_at=datetime.now(),
            discovered_by=discovered_by,
            z_axis_inverted=True,
            why_kept="按历史惯例Z轴方向写反，系统未自动修正，留给现场班组复核确认",
            missing_materials=["现场班组Z轴复核确认单", "点云原始坐标系说明"],
            next_action=NextAction.FIELD_TEAM,
        )


class SketchProcessor:
    def __init__(self):
        self.z_analyzer = ZAxisAnalyzer()

    def import_sketch(
        self,
        name: str,
        importer: str,
        floor_number: int,
        z_axis_direction: str,
        stall_coordinates: List[Dict[str, float]],
        raw_data: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        sketch = FloorSectionSketch(
            sketch_id=f"SKT-{uuid.uuid4().hex[:8]}",
            name=name,
            import_time=datetime.now(),
            importer=importer,
            floor_number=floor_number,
            z_axis_direction=z_axis_direction,
            stall_coordinates=stall_coordinates,
            raw_data=raw_data or {},
        )

        issues = []
        if self.z_analyzer.detect_inversion(z_axis_direction):
            issues.append(
                self.z_analyzer.create_issue(
                    sketch.sketch_id, z_axis_direction, importer
                )
            )

        return {"sketch": sketch, "issues": issues}

    def add_point_cloud_log(
        self,
        playback: PathPlayback,
        operator: str,
        action: str,
        thinning_ratio: float,
        parameters: Dict[str, Any],
        notes: str = "",
    ) -> PathPlayback:
        log = PointCloudLog(
            log_id=f"LOG-{uuid.uuid4().hex[:8]}",
            timestamp=datetime.now(),
            operator=operator,
            action=action,
            thinning_ratio=thinning_ratio,
            parameters=parameters,
            notes=notes,
        )
        playback.point_cloud_logs.append(log)
        self._update_issues_after_log(playback, log)
        return playback

    def _update_issues_after_log(
        self, playback: PathPlayback, log: PointCloudLog
    ) -> None:
        for issue in playback.issues:
            if issue.z_axis_inverted and issue.status == IssueStatus.PENDING:
                if "z轴" in log.notes.lower() or "坐标系" in log.notes.lower():
                    issue.missing_materials = [
                        m
                        for m in issue.missing_materials
                        if "点云" not in m and "坐标系" not in m
                    ]
                    if len(issue.missing_materials) <= 1:
                        issue.next_action = NextAction.SURVEY_TEAM
                        issue.why_kept += (
                            "\n已补录点云抽稀日志，航测内业小魏需确认Z轴方向处理方式"
                        )

    def add_manual_correction(
        self,
        playback: PathPlayback,
        operator: str,
        field_name: str,
        old_value: Any,
        new_value: Any,
        reason: str,
    ) -> PathPlayback:
        correction = ManualCorrection(
            correction_id=f"CRR-{uuid.uuid4().hex[:8]}",
            timestamp=datetime.now(),
            operator=operator,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
        )
        playback.corrections.append(correction)
        self._apply_correction(playback, correction)
        return playback

    def _apply_correction(self, playback: PathPlayback, correction: ManualCorrection) -> None:
        if correction.field_name == "z_axis_direction":
            if playback.sketch:
                playback.sketch.z_axis_direction = correction.new_value
            for issue in playback.issues:
                if issue.z_axis_inverted:
                    issue.status = IssueStatus.RESOLVED
                    issue.next_action = NextAction.COMPLETED

    def add_rerun(
        self,
        playback: PathPlayback,
        operator: str,
        reason: str,
        affected_results: List[str],
    ) -> PathPlayback:
        rerun = ReRunRecord(
            run_id=f"RUN-{uuid.uuid4().hex[:8]}",
            timestamp=datetime.now(),
            operator=operator,
            reason=reason,
            affected_results=affected_results,
        )
        playback.re_runs.append(rerun)
        return playback

    def create_playback(self, project_name: str) -> PathPlayback:
        return PathPlayback(
            playback_id=f"PB-{uuid.uuid4().hex[:8]}",
            project_name=project_name,
        )
