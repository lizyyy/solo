from datetime import datetime
from typing import List, Dict, Optional, Tuple

from models import PointCloudLog, Role, Obstacle, ReviewStatus
from database import Database, generate_hash, generate_id


class PointCloudService:
    def __init__(self, db: Database):
        self.db = db

    def import_point_cloud_log(
        self,
        sketch_id: str,
        log_data: str,
        recorded_at: Optional[datetime] = None,
        notes: Optional[str] = None,
        imported_by: Role = Role.SYSTEM
    ) -> Tuple[PointCloudLog, bool]:
        log_hash = generate_hash(f"{sketch_id}|{log_data}")

        existing_log = self.db.get_log_by_hash(log_hash)
        if existing_log:
            return existing_log, False

        log = PointCloudLog(
            id=generate_id(),
            sketch_id=sketch_id,
            log_data=log_data,
            log_hash=log_hash,
            recorded_at=recorded_at or datetime.now(),
            notes=notes
        )
        self.db.save_log(log)

        self._associate_log_with_obstacles(log)

        return log, True

    def review_point_cloud_log(
        self,
        log_id: str,
        notes: str,
        reviewed_by: Role
    ) -> PointCloudLog:
        from change_tracking_service import ChangeTrackingService

        change_service = ChangeTrackingService(self.db)
        return change_service.update_point_cloud_log_notes(
            log_id=log_id,
            new_notes=notes,
            changed_by=reviewed_by,
            change_reason="展陈设计师阿景补看点云抽稀日志，补充备注"
        )

    def _associate_log_with_obstacles(self, log: PointCloudLog) -> None:
        obstacles = self.db.get_obstacles_by_sketch(log.sketch_id)

        try:
            log_data = eval(log.log_data) if isinstance(log.log_data, str) else log.log_data
        except (SyntaxError, NameError):
            log_data = {}

        if isinstance(log_data, dict) and "obstacle_positions" in log_data:
            for pos in log_data["obstacle_positions"]:
                matching_obstacle = self._find_matching_obstacle(obstacles, pos)
                if matching_obstacle and log.id not in matching_obstacle.source_log_ids:
                    matching_obstacle.source_log_ids.append(log.id)
                    self.db.save_obstacle(matching_obstacle)

    def _find_matching_obstacle(
        self,
        obstacles: List[Obstacle],
        pos: Dict[str, float]
    ) -> Optional[Obstacle]:
        for obs in obstacles:
            if (abs(obs.position_3d["x"] - pos.get("x", 0)) < 0.1 and
                abs(obs.position_3d["y"] - pos.get("y", 0)) < 0.1 and
                abs(obs.position_3d["z"] - pos.get("z", 0)) < 0.1):
                return obs
        return None

    def get_logs_for_sketch(self, sketch_id: str) -> List[PointCloudLog]:
        return self.db.get_logs_by_sketch(sketch_id)

    def get_unreviewed_logs(self, sketch_id: str) -> List[PointCloudLog]:
        logs = self.db.get_logs_by_sketch(sketch_id)
        return [l for l in logs if l.reviewed_by is None]
