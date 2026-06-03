from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple

from models import (
    FloorSectionSketch, PointCloudLog, SprinklerCoverage,
    ThreeDView, DisplayMode, Role, ReviewStatus, Obstacle
)
from database import Database
from import_service import ImportService
from point_cloud_service import PointCloudService
from visualization_service import VisualizationService
from change_tracking_service import ChangeTrackingService
from report_service import ReportService


class WorkflowService:
    def __init__(self, db: Database):
        self.db = db
        self.import_service = ImportService(db)
        self.point_cloud_service = PointCloudService(db)
        self.visualization_service = VisualizationService(db)
        self.change_tracking_service = ChangeTrackingService(db)
        self.report_service = ReportService(db)

    def run_complete_workflow(
        self,
        floor: str,
        section_name: str,
        sketch_data: str,
        obstacles_data: List[Dict],
        point_cloud_logs_data: List[Dict],
        designer_remarks: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        step1_result = self.step1_import_sketch(
            floor=floor,
            section_name=section_name,
            sketch_data=sketch_data,
            obstacles_data=obstacles_data
        )

        sketch_id = step1_result["sketch"]["id"]
        is_new = step1_result["is_new_import"]
        sketch = self.db.sketches.get(sketch_id)

        step2_result = self.step2_review_point_cloud_logs(
            sketch_id=sketch_id,
            logs_data=point_cloud_logs_data
        )

        step3_result = self.step3_update_3d_view(
            sketch_id=sketch_id
        )

        if designer_remarks:
            for remark in designer_remarks:
                self.change_tracking_service.update_coverage_remark(
                    coverage_id=remark["coverage_id"],
                    new_remark=remark["new_remark"],
                    changed_by=Role.DESIGNER_AJING,
                    change_reason=remark.get("reason", "展陈设计师阿景修改备注")
                )

        conflicts = self._get_conflicts_for_trainee(sketch_id)

        final_report = self.report_service.generate_full_audit_report(sketch_id)

        return {
            "workflow_completed_at": datetime.now().isoformat(),
            "step1_import": step1_result,
            "step2_point_cloud_review": step2_result,
            "step3_3d_view_update": step3_result,
            "trainee_review_required": len(conflicts) > 0,
            "conflicts_for_trainee": conflicts,
            "final_audit_report": final_report
        }

    def step1_import_sketch(
        self,
        floor: str,
        section_name: str,
        sketch_data: str,
        obstacles_data: List[Dict]
    ) -> Dict[str, Any]:
        sketch, coverages, is_new = self.import_service.import_floor_section_sketch(
            floor=floor,
            section_name=section_name,
            sketch_data=sketch_data,
            obstacles_data=obstacles_data,
            imported_by=Role.DESIGNER_AJING
        )

        return {
            "step": "step1",
            "step_name": "楼层剖面草图导入",
            "sketch": {
                "id": sketch.id,
                "floor": sketch.floor,
                "section_name": sketch.section_name,
                "imported_at": sketch.imported_at.isoformat()
            },
            "obstacles_imported": len(sketch.obstacles),
            "coverages_created": len(coverages),
            "is_new_import": is_new,
            "message": "新草图导入成功" if is_new else "重复导入，已去重处理，未创建新记录"
        }

    def step2_review_point_cloud_logs(
        self,
        sketch_id: str,
        logs_data: List[Dict]
    ) -> Dict[str, Any]:
        imported_logs = []
        reviewed_logs = []

        for log_data in logs_data:
            log, is_new = self.point_cloud_service.import_point_cloud_log(
                sketch_id=sketch_id,
                log_data=log_data.get("log_data", str(log_data)),
                recorded_at=log_data.get("recorded_at"),
                notes=log_data.get("initial_notes")
            )
            imported_logs.append({"log": log, "is_new": is_new})

            if log_data.get("designer_notes"):
                reviewed_log = self.point_cloud_service.review_point_cloud_log(
                    log_id=log.id,
                    notes=log_data["designer_notes"],
                    reviewed_by=Role.DESIGNER_AJING
                )
                reviewed_logs.append(reviewed_log)

        obstacles = self.db.get_obstacles_by_sketch(sketch_id)
        obstacles_with_logs = [o for o in obstacles if len(o.source_log_ids) > 0]

        return {
            "step": "step2",
            "step_name": "点云抽稀日志补看与复核",
            "logs_imported": len(imported_logs),
            "new_logs": len([l for l in imported_logs if l["is_new"]]),
            "logs_reviewed_by_designer": len(reviewed_logs),
            "obstacles_updated_with_logs": len(obstacles_with_logs),
            "reviewed_by": str(Role.DESIGNER_AJING),
            "message": f"展陈设计师阿景已完成 {len(reviewed_logs)} 条点云抽稀日志的复核"
        }

    def step3_update_3d_view(
        self,
        sketch_id: str,
        display_mode: DisplayMode = DisplayMode.VIEW_3D
    ) -> Dict[str, Any]:
        coverages = self.db.get_coverages_by_sketch(sketch_id)
        views = []
        conflict_views = []

        for coverage in coverages:
            view_data = self.visualization_service.create_3d_view(
                coverage_id=coverage.id,
                display_mode=display_mode,
                created_by=Role.SYSTEM
            )
            views.append(view_data)

            if view_data.get("has_conflict"):
                conflict_views.append(view_data)

        reports = []
        for coverage in coverages:
            report = self.report_service.generate_review_report(
                coverage_id=coverage.id,
                generated_by=Role.SYSTEM
            )
            reports.append(report)

        return {
            "step": "step3",
            "step_name": "三维标注视图更新",
            "views_created": len(views),
            "views_with_conflicts": len(conflict_views),
            "reports_generated": len(reports),
            "display_mode": str(display_mode),
            "conflict_views": [
                {
                    "view_id": v["view_id"],
                    "obstacle_name": v["obstacle_data"]["name"] if v.get("obstacle_data") else None,
                    "conflict_info": v.get("conflict_info"),
                    "navigation_links": v.get("navigation_links")
                }
                for v in conflict_views
            ],
            "message": f"已更新 {len(views)} 个三维标注视图，其中 {len(conflict_views)} 个存在名称冲突待培训学员复核"
        }

    def resolve_obstacle_conflict(
        self,
        obstacle_id: str,
        resolved_name: str,
        resolved_by: Role
    ) -> Dict[str, Any]:
        obstacle = self.db.obstacles.get(obstacle_id)
        if not obstacle:
            raise ValueError(f"Obstacle {obstacle_id} not found")

        if obstacle.review_status != ReviewStatus.NEED_TRAINEE_REVIEW:
            raise ValueError(f"Obstacle {obstacle_id} does not need trainee review")

        if resolved_by != Role.TRAINEE:
            raise ValueError("Only TRAINEE role can resolve name conflicts")

        updated_obstacle = self.change_tracking_service.update_obstacle_review_status(
            obstacle_id=obstacle_id,
            new_status=ReviewStatus.NORMAL,
            changed_by=Role.TRAINEE,
            change_reason=f"培训学员已复核，确定正确名称为: {resolved_name}",
            resolved_name=resolved_name
        )

        coverage = self.db.get_coverage_by_sketch_obstacle(
            updated_obstacle.sketch_id,
            updated_obstacle.id
        )

        if coverage:
            self.change_tracking_service.update_coverage_remark(
                coverage_id=coverage.id,
                new_remark=f"{coverage.remark} | 名称冲突已由培训学员复核解决，正确名称: {resolved_name}",
                changed_by=Role.TRAINEE,
                change_reason="培训学员解决障碍物名称冲突"
            )

        return {
            "obstacle_id": obstacle_id,
            "original_names": [obstacle.name, obstacle.conflicting_name],
            "resolved_name": resolved_name,
            "resolved_by": str(resolved_by),
            "resolved_at": datetime.now().isoformat(),
            "status": "resolved"
        }

    def _get_conflicts_for_trainee(self, sketch_id: str) -> List[Dict[str, Any]]:
        obstacles = self.db.get_obstacles_by_sketch(sketch_id)
        conflicts = [o for o in obstacles if o.review_status == ReviewStatus.NEED_TRAINEE_REVIEW]

        result = []
        for conflict in conflicts:
            coverage = self.db.get_coverage_by_sketch_obstacle(sketch_id, conflict.id)
            result.append({
                "obstacle_id": conflict.id,
                "position_3d": conflict.position_3d,
                "name_1": conflict.name,
                "name_2": conflict.conflicting_name,
                "coverage_id": coverage.id if coverage else None,
                "action_required": "培训学员复核并确定正确名称"
            })
        return result
