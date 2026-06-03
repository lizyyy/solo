from datetime import datetime
from typing import Any, List, Optional

from models import (
    SprinklerCoverage, ChangeHistory, PointCloudLog,
    Obstacle, Role, ReviewStatus
)
from database import Database, generate_id


class ChangeTrackingService:
    def __init__(self, db: Database):
        self.db = db

    def update_coverage_remark(
        self,
        coverage_id: str,
        new_remark: str,
        changed_by: Role,
        change_reason: str
    ) -> SprinklerCoverage:
        coverage = self.db.coverages.get(coverage_id)
        if not coverage:
            raise ValueError(f"Coverage {coverage_id} not found")

        old_remark = coverage.remark
        if old_remark == new_remark:
            return coverage

        coverage.remark = new_remark
        coverage.updated_at = datetime.now()
        coverage.updated_by = changed_by
        self.db.save_coverage(coverage)

        affected_results = self._calculate_affected_results(coverage)

        history = ChangeHistory(
            id=generate_id(),
            entity_type="SprinklerCoverage",
            entity_id=coverage_id,
            field_name="remark",
            old_value=old_remark,
            new_value=new_remark,
            changed_by=changed_by,
            changed_at=datetime.now(),
            change_reason=change_reason,
            affected_results=affected_results
        )
        self.db.add_change_history(history)

        return coverage

    def update_point_cloud_log_notes(
        self,
        log_id: str,
        new_notes: str,
        changed_by: Role,
        change_reason: str
    ) -> PointCloudLog:
        log = self.db.point_cloud_logs.get(log_id)
        if not log:
            raise ValueError(f"PointCloudLog {log_id} not found")

        old_notes = log.notes or ""
        if old_notes == new_notes:
            return log

        log.notes = new_notes
        log.reviewed_by = changed_by
        log.reviewed_at = datetime.now()
        self.db.save_log(log)

        history = ChangeHistory(
            id=generate_id(),
            entity_type="PointCloudLog",
            entity_id=log_id,
            field_name="notes",
            old_value=old_notes,
            new_value=new_notes,
            changed_by=changed_by,
            changed_at=datetime.now(),
            change_reason=change_reason,
            affected_results=[f"关联草图: {log.sketch_id}"]
        )
        self.db.add_change_history(history)

        self._update_obstacles_from_log(log)

        return log

    def update_obstacle_review_status(
        self,
        obstacle_id: str,
        new_status: ReviewStatus,
        changed_by: Role,
        change_reason: str,
        resolved_name: Optional[str] = None
    ) -> Obstacle:
        obstacle = self.db.obstacles.get(obstacle_id)
        if not obstacle:
            raise ValueError(f"Obstacle {obstacle_id} not found")

        old_status = obstacle.review_status
        if old_status == new_status:
            return obstacle

        obstacle.review_status = new_status
        if resolved_name and new_status == ReviewStatus.NORMAL:
            obstacle.name = resolved_name
            obstacle.conflicting_name = None

        self.db.save_obstacle(obstacle)

        history = ChangeHistory(
            id=generate_id(),
            entity_type="Obstacle",
            entity_id=obstacle_id,
            field_name="review_status",
            old_value=str(old_status),
            new_value=str(new_status),
            changed_by=changed_by,
            changed_at=datetime.now(),
            change_reason=change_reason,
            affected_results=[f"关联喷灌覆盖: {obs.id}" for obs in self.db.get_coverages_by_sketch(obstacle.sketch_id)]
        )
        self.db.add_change_history(history)

        return obstacle

    def get_change_history(self, entity_type: str, entity_id: str) -> List[ChangeHistory]:
        return self.db.get_change_history(entity_type, entity_id)

    def compare_remark_history(self, coverage_id: str) -> List[dict]:
        histories = self.db.get_change_history("SprinklerCoverage", coverage_id)
        remark_changes = [h for h in histories if h.field_name == "remark"]

        result = []
        for h in remark_changes:
            result.append({
                "changed_at": h.changed_at,
                "changed_by": h.changed_by,
                "change_reason": h.change_reason,
                "old_value": h.old_value,
                "new_value": h.new_value,
                "affected_results": h.affected_results
            })
        return result

    def _calculate_affected_results(self, coverage: SprinklerCoverage) -> List[str]:
        results = []
        obstacle = self.db.obstacles.get(coverage.obstacle_id)
        if obstacle:
            results.append(f"障碍物状态: {obstacle.review_status}")
        results.append(f"覆盖面积: {coverage.coverage_area}㎡")
        results.append(f"喷头数量: {coverage.sprinkler_count}个")
        return results

    def _update_obstacles_from_log(self, log: PointCloudLog) -> None:
        obstacles = self.db.get_obstacles_by_sketch(log.sketch_id)
        for obstacle in obstacles:
            if log.id not in obstacle.source_log_ids:
                obstacle.source_log_ids.append(log.id)
                self.db.save_obstacle(obstacle)
