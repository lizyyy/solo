import json
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from backend.database import Version, Project, Annotation, ReviewDecision, Conflict


class VersionController:
    def __init__(self, db: Session):
        self.db = db
    
    def _get_next_version(self, project_id: int) -> int:
        latest_version = (
            self.db.query(Version)
            .filter(Version.project_id == project_id)
            .order_by(Version.version_number.desc())
            .first()
        )
        return (latest_version.version_number + 1) if latest_version else 1
    
    def _take_snapshot(self, project_id: int) -> str:
        project = self.db.query(Project).filter(Project.id == project_id).first()
        if not project:
            return "{}"
        
        snapshot = {
            "project_id": project.id,
            "project_name": project.name,
            "annotations": [],
            "conflicts": []
        }
        
        for sample in project.samples:
            for ann in sample.annotations:
                if ann.is_active:
                    snapshot["annotations"].append({
                        "id": ann.id,
                        "sample_id": ann.sample_id,
                        "annotator": ann.annotator,
                        "label": ann.label,
                        "confidence": ann.confidence,
                        "is_active": ann.is_active
                    })
        
        for conflict in project.samples:
            for c in conflict.conflicts:
                snapshot["conflicts"].append({
                    "id": c.id,
                    "sample_id": c.sample_id,
                    "status": c.status,
                    "severity": c.severity
                })
        
        return json.dumps(snapshot, ensure_ascii=False)
    
    def create_version(
        self,
        project_id: int,
        action: str,
        description: str,
        affected_samples: int = 0,
        created_by: str = "system"
    ) -> Version:
        version_number = self._get_next_version(project_id)
        snapshot_data = self._take_snapshot(project_id)
        
        version = Version(
            project_id=project_id,
            version_number=version_number,
            description=description,
            action=action,
            affected_samples=affected_samples,
            created_by=created_by,
            snapshot_data=snapshot_data
        )
        
        self.db.add(version)
        self.db.commit()
        self.db.refresh(version)
        
        return version
    
    def get_versions(self, project_id: int) -> List[Version]:
        return (
            self.db.query(Version)
            .filter(Version.project_id == project_id)
            .order_by(Version.version_number.desc())
            .all()
        )
    
    def get_version(self, version_id: int) -> Optional[Version]:
        return self.db.query(Version).filter(Version.id == version_id).first()
    
    def rollback_to_version(self, version_id: int, reviewer: str = "system") -> Dict[str, Any]:
        target_version = self.db.query(Version).filter(Version.id == version_id).first()
        if not target_version:
            raise ValueError(f"Version {version_id} not found")
        
        snapshot = json.loads(target_version.snapshot_data)
        
        affected = {"annotations_restored": 0, "annotations_deactivated": 0}
        
        for ann_data in snapshot["annotations"]:
            annotation = self.db.query(Annotation).filter(Annotation.id == ann_data["id"]).first()
            if annotation:
                if annotation.is_active != ann_data["is_active"]:
                    annotation.is_active = ann_data["is_active"]
                    if ann_data["is_active"]:
                        affected["annotations_restored"] += 1
                    else:
                        affected["annotations_deactivated"] += 1
        
        new_version = self.create_version(
            project_id=target_version.project_id,
            action="rollback",
            description=f"Rollback to version {target_version.version_number}",
            affected_samples=affected["annotations_restored"] + affected["annotations_deactivated"],
            created_by=reviewer
        )
        
        return {
            "success": True,
            "rolled_back_to_version": target_version.version_number,
            "new_version": new_version.version_number,
            "affected": affected
        }
    
    def get_version_diff(self, version_id1: int, version_id2: int) -> Dict[str, Any]:
        v1 = self.get_version(version_id1)
        v2 = self.get_version(version_id2)
        
        if not v1 or not v2:
            raise ValueError("One or both versions not found")
        
        s1 = json.loads(v1.snapshot_data)
        s2 = json.loads(v2.snapshot_data)
        
        s1_ann = {a["id"]: a for a in s1["annotations"]}
        s2_ann = {a["id"]: a for a in s2["annotations"]}
        
        all_ids = set(s1_ann.keys()) | set(s2_ann.keys())
        
        changes = []
        for ann_id in all_ids:
            a1 = s1_ann.get(ann_id)
            a2 = s2_ann.get(ann_id)
            
            if a1 and a2:
                if a1["label"] != a2["label"] or a1["is_active"] != a2["is_active"]:
                    changes.append({
                        "type": "modified",
                        "annotation_id": ann_id,
                        "from": {"label": a1["label"], "is_active": a1["is_active"]},
                        "to": {"label": a2["label"], "is_active": a2["is_active"]}
                    })
            elif a2 and not a1:
                changes.append({
                    "type": "added",
                    "annotation_id": ann_id,
                    "to": {"label": a2["label"], "is_active": a2["is_active"]}
                })
            elif a1 and not a2:
                changes.append({
                    "type": "removed",
                    "annotation_id": ann_id,
                    "from": {"label": a1["label"], "is_active": a1["is_active"]}
                })
        
        return {
            "versions": {
                "from": {"id": version_id1, "number": v1.version_number},
                "to": {"id": version_id2, "number": v2.version_number}
            },
            "total_changes": len(changes),
            "changes": changes
        }
