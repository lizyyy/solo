from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from .models import (
    CoordinateRow,
    FloorProfile,
    InspectionProject,
    NextAction,
    ObstacleRemark,
    OcclusionPoint,
    OcclusionStatus,
    PhotoLocation,
    WorkflowPhase,
)
from .core import (
    advance_workflow,
    detect_inconsistencies,
    generate_occlusion_report,
    resolve_occlusion_points,
)


class WorkflowEngine:
    def __init__(self, storage_dir: str = ".sewage_data"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def create_project(self, name: str, plant_name: str = "", created_by: str = "unknown") -> InspectionProject:
        project = InspectionProject(
            name=name, plant_name=plant_name, created_by=created_by
        )
        self._save(project)
        return project

    def load_project(self, project_id: str) -> InspectionProject:
        path = self.storage_dir / f"{project_id}.json"
        if not path.exists():
            raise FileNotFoundError(f"项目 {project_id} 不存在")
        data = json.loads(path.read_text(encoding="utf-8"))
        return InspectionProject(**data)

    def save_project(self, project: InspectionProject) -> None:
        self._save(project)

    def list_projects(self) -> list[dict]:
        results = []
        for path in self.storage_dir.glob("*.json"):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                results.append(
                    {
                        "id": data.get("id", ""),
                        "name": data.get("name", ""),
                        "plant_name": data.get("plant_name", ""),
                        "current_phase": data.get("current_phase", ""),
                    }
                )
            except Exception:
                pass
        return results

    def import_obstacle_remarks(
        self, project_id: str, remarks: list[dict]
    ) -> InspectionProject:
        project = self.load_project(project_id)
        for r in remarks:
            remark = ObstacleRemark(**r)
            project.obstacle_remarks.append(remark)
            for photo_ref in remark.photo_refs:
                photo_loc = PhotoLocation(
                    photo_ref=photo_ref,
                    x=r.get("photo_x", 0.0),
                    y=r.get("photo_y", 0.0),
                    z=r.get("photo_z", 0.0),
                    obstacle_remark_id=remark.id,
                    source="obstacle_import",
                    label=f"障碍物:{remark.location}",
                )
                project.photo_locations.append(photo_loc)
        new_points = detect_inconsistencies(project)
        project.occlusion_points.extend(new_points)
        self._save(project)
        return project

    def import_floor_profiles(
        self, project_id: str, profiles: list[dict]
    ) -> InspectionProject:
        project = self.load_project(project_id)
        for p in profiles:
            profile = FloorProfile(**p)
            project.floor_profiles.append(profile)
            for photo_ref in profile.photo_refs:
                photo_loc = PhotoLocation(
                    photo_ref=photo_ref,
                    x=p.get("photo_x", 0.0),
                    y=p.get("photo_y", 0.0),
                    z=p.get("photo_z", 0.0),
                    floor_profile_id=profile.id,
                    source="floor_profile_supplement",
                    label=f"楼层:{profile.floor_name}",
                )
                project.photo_locations.append(photo_loc)
        new_points = detect_inconsistencies(project)
        project.occlusion_points.extend(new_points)
        self._save(project)
        return project

    def import_coordinate_rows(
        self, project_id: str, rows: list[dict]
    ) -> InspectionProject:
        project = self.load_project(project_id)
        for r in rows:
            row = CoordinateRow(**r)
            project.coordinate_rows.append(row)
        resolved = resolve_occlusion_points(project)
        self._save(project)
        return project

    def run_step(self, project_id: str) -> InspectionProject:
        project = self.load_project(project_id)
        advance_workflow(project)
        self._save(project)
        return project

    def get_report(self, project_id: str) -> str:
        project = self.load_project(project_id)
        return generate_occlusion_report(project)

    def escalate_occlusion(
        self, project_id: str, occlusion_id: str, target: str = "safety_officer"
    ) -> InspectionProject:
        project = self.load_project(project_id)
        for op in project.occlusion_points:
            if op.id == occlusion_id:
                if target == "safety_officer":
                    op.status = OcclusionStatus.ESCALATED_SAFETY
                    op.next_action = NextAction.SAFETY_OFFICER
                else:
                    op.status = OcclusionStatus.PENDING_REVIEW
                from datetime import datetime

                op.updated_at = datetime.now().isoformat()
                break
        self._save(project)
        return project

    def _save(self, project: InspectionProject) -> None:
        path = self.storage_dir / f"{project.id}.json"
        path.write_text(
            json.dumps(project.model_dump(), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
