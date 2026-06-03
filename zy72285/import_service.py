import json
from datetime import datetime
from typing import List, Dict, Optional, Tuple

from models import FloorSectionSketch, Obstacle, SprinklerCoverage, Role, ReviewStatus
from database import Database, generate_hash, generate_id


class ImportService:
    def __init__(self, db: Database):
        self.db = db

    def import_floor_section_sketch(
        self,
        floor: str,
        section_name: str,
        sketch_data: str,
        obstacles_data: List[Dict],
        imported_by: Role,
        source_file: Optional[str] = None
    ) -> Tuple[FloorSectionSketch, List[SprinklerCoverage], bool]:
        import_content = f"{floor}|{section_name}|{sketch_data}|{json.dumps(obstacles_data, sort_keys=True)}"
        import_hash = generate_hash(import_content)

        existing_sketch = self.db.get_sketch_by_hash(import_hash)
        if existing_sketch:
            coverages = self.db.get_coverages_by_sketch(existing_sketch.id)
            return existing_sketch, coverages, False

        sketch = FloorSectionSketch(
            id=generate_id(),
            floor=floor,
            section_name=section_name,
            sketch_data=sketch_data,
            import_hash=import_hash,
            imported_at=datetime.now(),
            imported_by=imported_by,
            source_file=source_file
        )
        self.db.save_sketch(sketch)

        obstacles = []
        for obs_data in obstacles_data:
            obstacle = Obstacle(
                id=generate_id(),
                sketch_id=sketch.id,
                name=obs_data["name"],
                position_3d=obs_data["position_3d"],
                bounds=obs_data["bounds"],
                material_type=obs_data.get("material_type"),
                material_status=obs_data.get("material_status", "pending")
            )
            obstacles.append(obstacle)
            self.db.save_obstacle(obstacle)

        sketch.obstacles = obstacles

        coverages = []
        for obstacle in obstacles:
            coverage = self._create_coverage(sketch.id, obstacle, imported_by)
            coverages.append(coverage)

        self._detect_name_conflicts(sketch.id)

        return sketch, coverages, True

    def _create_coverage(
        self,
        sketch_id: str,
        obstacle: Obstacle,
        created_by: Role
    ) -> SprinklerCoverage:
        coverage = self.db.get_coverage_by_sketch_obstacle(sketch_id, obstacle.id)
        if coverage:
            return coverage

        bounds = obstacle.bounds
        area = (bounds["max_x"] - bounds["min_x"]) * (bounds["max_y"] - bounds["min_y"])
        sprinkler_count = max(1, int(area / 10.0))

        coverage = SprinklerCoverage(
            id=generate_id(),
            sketch_id=sketch_id,
            obstacle_id=obstacle.id,
            coverage_area=area,
            sprinkler_count=sprinkler_count,
            is_covered=True,
            remark=f"自动生成: 障碍物 {obstacle.name} 的喷灌覆盖方案",
            created_at=datetime.now(),
            updated_at=datetime.now(),
            updated_by=created_by
        )
        self.db.save_coverage(coverage)
        return coverage

    def _detect_name_conflicts(self, sketch_id: str) -> None:
        obstacles = self.db.get_obstacles_by_sketch(sketch_id)
        name_groups: Dict[str, List[Obstacle]] = {}
        position_groups: Dict[Tuple[float, float, float], List[Obstacle]] = {}

        for obs in obstacles:
            pos_key = (
                round(obs.position_3d["x"], 2),
                round(obs.position_3d["y"], 2),
                round(obs.position_3d["z"], 2)
            )
            position_groups.setdefault(pos_key, []).append(obs)

        for pos_key, group in position_groups.items():
            if len(group) >= 2:
                names = {o.name for o in group}
                if len(names) >= 2:
                    for obs in group:
                        other_names = [o.name for o in group if o.id != obs.id]
                        obs.conflicting_name = ", ".join(other_names)
                        obs.review_status = ReviewStatus.NEED_TRAINEE_REVIEW
                        self.db.save_obstacle(obs)
