from datetime import datetime
from typing import List, Dict, Any, Optional

from models import (
    ReviewReport, SprinklerCoverage, Obstacle,
    Role, ReviewStatus, ChangeHistory
)
from database import Database, generate_id


class ReportService:
    def __init__(self, db: Database):
        self.db = db

    def generate_review_report(
        self,
        coverage_id: str,
        generated_by: Role
    ) -> ReviewReport:
        coverage = self.db.coverages.get(coverage_id)
        if not coverage:
            raise ValueError(f"Coverage {coverage_id} not found")

        obstacle = self.db.obstacles.get(coverage.obstacle_id)
        if not obstacle:
            raise ValueError(f"Obstacle for coverage {coverage_id} not found")

        why_kept = self._determine_why_kept(coverage, obstacle)
        missing_materials = self._determine_missing_materials(obstacle)
        next_step_role, next_step_action = self._determine_next_step(obstacle, coverage)

        report = ReviewReport(
            id=generate_id(),
            coverage_id=coverage_id,
            obstacle_id=obstacle.id,
            why_kept=why_kept,
            missing_materials=missing_materials,
            next_step_role=next_step_role,
            next_step_action=next_step_action,
            generated_at=datetime.now(),
            generated_by=generated_by
        )
        self.db.save_report(report)
        return report

    def generate_full_audit_report(self, sketch_id: str) -> Dict[str, Any]:
        coverages = self.db.get_coverages_by_sketch(sketch_id)
        sketch = self.db.sketches.get(sketch_id)
        logs = self.db.get_logs_by_sketch(sketch_id)
        obstacles = self.db.get_obstacles_by_sketch(sketch_id)

        all_changes = []
        for coverage in coverages:
            changes = self.db.get_change_history("SprinklerCoverage", coverage.id)
            all_changes.extend(changes)

        for obstacle in obstacles:
            changes = self.db.get_change_history("Obstacle", obstacle.id)
            all_changes.extend(changes)

        for log in logs:
            changes = self.db.get_change_history("PointCloudLog", log.id)
            all_changes.extend(changes)

        all_changes.sort(key=lambda x: x.changed_at, reverse=True)

        reports = []
        for coverage in coverages:
            report = self.db.review_reports.get(coverage.id)
            if report:
                reports.append(report)

        return {
            "sketch_info": {
                "id": sketch_id,
                "floor": sketch.floor if sketch else None,
                "section_name": sketch.section_name if sketch else None,
                "imported_at": sketch.imported_at.isoformat() if sketch else None
            },
            "summary": {
                "total_obstacles": len(obstacles),
                "total_coverages": len(coverages),
                "total_logs": len(logs),
                "pending_review": len([o for o in obstacles if o.review_status == ReviewStatus.PENDING]),
                "need_trainee_review": len([o for o in obstacles if o.review_status == ReviewStatus.NEED_TRAINEE_REVIEW]),
                "need_designer_review": len([o for o in obstacles if o.review_status == ReviewStatus.NEED_DESIGNER_REVIEW]),
                "normal": len([o for o in obstacles if o.review_status == ReviewStatus.NORMAL]),
                "total_changes": len(all_changes)
            },
            "change_log": self._format_change_log(all_changes),
            "coverage_reports": [self._report_to_dict(r) for r in reports],
            "obstacle_details": [self._obstacle_detail_to_dict(o, coverages) for o in obstacles]
        }

    def _determine_why_kept(self, coverage: SprinklerCoverage, obstacle: Obstacle) -> str:
        reasons = []

        if coverage.is_covered:
            reasons.append("喷灌覆盖方案已计算完成，覆盖范围符合设计要求")
        else:
            reasons.append("喷灌覆盖方案待完善，需进一步复核覆盖范围")

        if obstacle.material_type:
            reasons.append(f"障碍物材质为 {obstacle.material_type}，已纳入防火等级评估")
        else:
            reasons.append("障碍物材质待确认，暂按标准障碍物处理")

        if coverage.coverage_area > 50:
            reasons.append(f"覆盖面积较大（{coverage.coverage_area}㎡），需重点关注喷头布置")

        if obstacle.review_status == ReviewStatus.NORMAL:
            reasons.append("障碍物信息已通过复核，无名称冲突")
        elif obstacle.review_status == ReviewStatus.NEED_TRAINEE_REVIEW:
            reasons.append("障碍物存在名称冲突，待培训学员复核确认")

        return "；".join(reasons)

    def _determine_missing_materials(self, obstacle: Obstacle) -> List[str]:
        missing = []

        if not obstacle.material_type:
            missing.append("障碍物材质类型")

        if obstacle.material_status != "confirmed":
            missing.append("材质检测报告")

        if not obstacle.bounds.get("height"):
            missing.append("障碍物高度参数")

        if len(obstacle.source_log_ids) == 0:
            missing.append("点云抽稀日志关联数据")

        return missing

    def _determine_next_step(self, obstacle: Obstacle, coverage: SprinklerCoverage) -> tuple:
        if obstacle.review_status == ReviewStatus.NEED_TRAINEE_REVIEW:
            return Role.TRAINEE, f"复核障碍物'{obstacle.name}'与'{obstacle.conflicting_name}'的名称冲突，确定正确名称"

        if not obstacle.material_type or obstacle.material_status != "confirmed":
            return Role.DESIGNER_AJING, f"补充障碍物'{obstacle.name}'的材质信息和检测报告"

        if not coverage.is_covered:
            return Role.DESIGNER_AJING, f"优化障碍物'{obstacle.name}'的喷灌覆盖方案"

        if not coverage.remark or "自动生成" in coverage.remark:
            return Role.DESIGNER_AJING, f"更新障碍物'{obstacle.name}'的喷灌覆盖备注说明"

        return Role.REVIEWER, f"完成障碍物'{obstacle.name}'的最终复核"

    def _format_change_log(self, changes: List[ChangeHistory]) -> List[Dict[str, Any]]:
        return [
            {
                "changed_at": h.changed_at.isoformat(),
                "changed_by": str(h.changed_by),
                "entity_type": h.entity_type,
                "entity_id": h.entity_id,
                "field_name": h.field_name,
                "old_value": str(h.old_value),
                "new_value": str(h.new_value),
                "change_reason": h.change_reason,
                "affected_results": h.affected_results
            }
            for h in changes
        ]

    def _report_to_dict(self, report: ReviewReport) -> Dict[str, Any]:
        return {
            "id": report.id,
            "coverage_id": report.coverage_id,
            "obstacle_id": report.obstacle_id,
            "why_kept": report.why_kept,
            "missing_materials": report.missing_materials,
            "next_step_role": str(report.next_step_role),
            "next_step_action": report.next_step_action,
            "generated_at": report.generated_at.isoformat()
        }

    def _obstacle_detail_to_dict(self, obstacle: Obstacle, coverages: List[SprinklerCoverage]) -> Dict[str, Any]:
        coverage = next((c for c in coverages if c.obstacle_id == obstacle.id), None)
        report = self.db.review_reports.get(coverage.id) if coverage else None

        return {
            "obstacle": {
                "id": obstacle.id,
                "name": obstacle.name,
                "position_3d": obstacle.position_3d,
                "material_type": obstacle.material_type,
                "material_status": obstacle.material_status,
                "review_status": str(obstacle.review_status),
                "conflicting_name": obstacle.conflicting_name
            },
            "coverage": {
                "id": coverage.id,
                "area": coverage.coverage_area,
                "sprinkler_count": coverage.sprinkler_count,
                "is_covered": coverage.is_covered,
                "remark": coverage.remark
            } if coverage else None,
            "report": self._report_to_dict(report) if report else None,
            "change_count": len(self.db.get_change_history("Obstacle", obstacle.id)) +
                           (len(self.db.get_change_history("SprinklerCoverage", coverage.id)) if coverage else 0)
        }
