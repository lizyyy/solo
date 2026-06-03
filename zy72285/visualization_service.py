from datetime import datetime
from typing import Dict, List, Optional, Any

from models import (
    SprinklerCoverage, ThreeDView, DisplayMode,
    FloorSectionSketch, PointCloudLog, Obstacle, ReviewStatus, Role
)
from database import Database, generate_id


class VisualizationService:
    def __init__(self, db: Database):
        self.db = db

    def create_3d_view(
        self,
        coverage_id: str,
        display_mode: DisplayMode,
        created_by: Role
    ) -> Dict[str, Any]:
        coverage = self.db.coverages.get(coverage_id)
        if not coverage:
            raise ValueError(f"Coverage {coverage_id} not found")

        obstacle = self.db.obstacles.get(coverage.obstacle_id)
        sketch = self.db.sketches.get(coverage.sketch_id)
        logs = self.db.get_logs_by_sketch(coverage.sketch_id)

        log_ids = [l.id for l in logs]
        if obstacle:
            log_ids = list(set(log_ids + obstacle.source_log_ids))

        view = ThreeDView(
            id=generate_id(),
            coverage_id=coverage_id,
            display_mode=display_mode,
            source_sketch_id=coverage.sketch_id,
            source_log_ids=log_ids,
            created_at=datetime.now()
        )
        self.db.save_3d_view(view)

        has_conflict = obstacle and obstacle.review_status == ReviewStatus.NEED_TRAINEE_REVIEW

        result = {
            "view_id": view.id,
            "display_mode": display_mode,
            "coverage_data": self._coverage_to_dict(coverage),
            "obstacle_data": self._obstacle_to_dict(obstacle) if obstacle else None,
            "has_conflict": has_conflict,
            "conflict_info": self._get_conflict_info(obstacle) if has_conflict else None,
            "traceability": {
                "source_sketch_id": view.source_sketch_id,
                "source_sketch_name": sketch.section_name if sketch else None,
                "source_log_ids": view.source_log_ids,
                "source_log_count": len(view.source_log_ids)
            },
            "navigation_links": self._generate_navigation_links(view, obstacle)
        }
        return result

    def get_source_sketch(self, view_id: str) -> Optional[FloorSectionSketch]:
        view = self.db.views_3d.get(view_id)
        if not view:
            return None
        return self.db.sketches.get(view.source_sketch_id)

    def get_source_logs(self, view_id: str) -> List[PointCloudLog]:
        view = self.db.views_3d.get(view_id)
        if not view:
            return []
        return [self.db.point_cloud_logs.get(log_id)
                for log_id in view.source_log_ids
                if self.db.point_cloud_logs.get(log_id)]

    def trace_back_to_sources(self, view_id: str) -> Dict[str, Any]:
        view = self.db.views_3d.get(view_id)
        if not view:
            raise ValueError(f"3D View {view_id} not found")

        coverage = self.db.coverages.get(view.coverage_id)
        sketch = self.db.sketches.get(view.source_sketch_id)
        logs = self.get_source_logs(view_id)
        obstacle = self.db.obstacles.get(coverage.obstacle_id) if coverage else None

        return {
            "sketch": self._sketch_to_dict(sketch) if sketch else None,
            "logs": [self._log_to_dict(log) for log in logs],
            "obstacle": self._obstacle_to_dict(obstacle) if obstacle else None,
            "coverage": self._coverage_to_dict(coverage) if coverage else None,
            "conflict_needs_review": obstacle and obstacle.review_status == ReviewStatus.NEED_TRAINEE_REVIEW
        }

    def render_3d_scene(self, view_id: str) -> Dict[str, Any]:
        data = self.trace_back_to_sources(view_id)
        obstacle = data.get("obstacle")
        coverage = data.get("coverage")

        scene = {
            "type": "scene",
            "metadata": {
                "view_id": view_id,
                "generated_at": datetime.now().isoformat(),
                "has_conflict": data.get("conflict_needs_review", False)
            },
            "objects": []
        }

        if obstacle:
            scene["objects"].append({
                "type": "obstacle",
                "id": obstacle["id"],
                "name": obstacle["name"],
                "position": obstacle["position_3d"],
                "bounds": obstacle["bounds"],
                "material_status": obstacle["material_status"],
                "review_status": obstacle["review_status"]
            })

        if coverage:
            scene["objects"].append({
                "type": "sprinkler_coverage",
                "id": coverage["id"],
                "area": coverage["coverage_area"],
                "sprinkler_count": coverage["sprinkler_count"],
                "is_covered": coverage["is_covered"],
                "remark": coverage["remark"]
            })

        scene["trace_actions"] = [
            {
                "action": "view_sketch",
                "label": "查看楼层剖面草图",
                "sketch_id": data["sketch"]["id"] if data.get("sketch") else None
            },
            {
                "action": "view_point_cloud_logs",
                "label": "查看点云抽稀日志",
                "log_count": len(data.get("logs", []))
            }
        ]

        if data.get("conflict_needs_review"):
            scene["trace_actions"].append({
                "action": "resolve_conflict",
                "label": "障碍物重名待培训学员复核",
                "conflicting_name": obstacle.get("conflicting_name"),
                "priority": "high"
            })

        return scene

    def _coverage_to_dict(self, coverage: SprinklerCoverage) -> Dict[str, Any]:
        return {
            "id": coverage.id,
            "sketch_id": coverage.sketch_id,
            "obstacle_id": coverage.obstacle_id,
            "coverage_area": coverage.coverage_area,
            "sprinkler_count": coverage.sprinkler_count,
            "is_covered": coverage.is_covered,
            "remark": coverage.remark,
            "created_at": coverage.created_at.isoformat(),
            "updated_at": coverage.updated_at.isoformat(),
            "updated_by": str(coverage.updated_by) if coverage.updated_by else None
        }

    def _obstacle_to_dict(self, obstacle: Obstacle) -> Dict[str, Any]:
        return {
            "id": obstacle.id,
            "name": obstacle.name,
            "position_3d": obstacle.position_3d,
            "bounds": obstacle.bounds,
            "material_type": obstacle.material_type,
            "material_status": obstacle.material_status,
            "review_status": str(obstacle.review_status),
            "conflicting_name": obstacle.conflicting_name,
            "source_log_ids": obstacle.source_log_ids
        }

    def _sketch_to_dict(self, sketch: FloorSectionSketch) -> Dict[str, Any]:
        return {
            "id": sketch.id,
            "floor": sketch.floor,
            "section_name": sketch.section_name,
            "imported_at": sketch.imported_at.isoformat(),
            "imported_by": str(sketch.imported_by),
            "source_file": sketch.source_file
        }

    def _log_to_dict(self, log: PointCloudLog) -> Dict[str, Any]:
        return {
            "id": log.id,
            "sketch_id": log.sketch_id,
            "recorded_at": log.recorded_at.isoformat(),
            "reviewed_by": str(log.reviewed_by) if log.reviewed_by else None,
            "reviewed_at": log.reviewed_at.isoformat() if log.reviewed_at else None,
            "notes": log.notes
        }

    def _get_conflict_info(self, obstacle: Obstacle) -> Dict[str, Any]:
        return {
            "current_name": obstacle.name,
            "conflicting_name": obstacle.conflicting_name,
            "review_status": str(obstacle.review_status),
            "required_action": "培训学员复核后确定正确名称"
        }

    def _generate_navigation_links(self, view: ThreeDView, obstacle: Optional[Obstacle]) -> List[Dict[str, Any]]:
        links = [
            {
                "rel": "source_sketch",
                "href": f"/api/sketches/{view.source_sketch_id}",
                "method": "GET",
                "description": "返回楼层剖面草图"
            }
        ]

        for log_id in view.source_log_ids:
            links.append({
                "rel": "source_point_cloud_log",
                "href": f"/api/point-cloud-logs/{log_id}",
                "method": "GET",
                "description": "返回点云抽稀日志"
            })

        if obstacle and obstacle.review_status == ReviewStatus.NEED_TRAINEE_REVIEW:
            links.append({
                "rel": "resolve_conflict",
                "href": f"/api/obstacles/{obstacle.id}/resolve",
                "method": "POST",
                "description": "培训学员复核障碍物名称冲突",
                "priority": "high"
            })

        return links
