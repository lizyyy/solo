import json
import os
from datetime import datetime
from typing import List, Optional, Dict, Any
from config import Config
from models import (
    Release, ReleaseStatus, Device, Schedule, Detour, Template,
    ValidationIssue, ReleaseItem, ReviewComment, generate_id
)


class ReleaseStore:
    def __init__(self):
        self.releases_dir = Config.RELEASES_DIR
        Config.ensure_directories()
    
    def save_release(self, release: Release) -> None:
        file_path = os.path.join(self.releases_dir, f"{release.release_id}.json")
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(release.to_dict(), f, ensure_ascii=False, indent=2)
    
    def load_release(self, release_id: str) -> Optional[Release]:
        file_path = os.path.join(self.releases_dir, f"{release_id}.json")
        if not os.path.exists(file_path):
            return None
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return Release.from_dict(data)
    
    def load_all_releases(self) -> List[Release]:
        releases = []
        if not os.path.exists(self.releases_dir):
            return releases
        for filename in os.listdir(self.releases_dir):
            if filename.endswith('.json'):
                release_id = filename[:-5]
                release = self.load_release(release_id)
                if release:
                    releases.append(release)
        releases.sort(key=lambda r: r.created_at, reverse=True)
        return releases
    
    def delete_release(self, release_id: str) -> bool:
        file_path = os.path.join(self.releases_dir, f"{release_id}.json")
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False
    
    def create_release(
        self, 
        release_name: str, 
        created_by: str,
        devices: List[Device] = None,
        schedules: List[Schedule] = None,
        detours: List[Detour] = None,
        templates: List[Template] = None
    ) -> Release:
        release = Release(
            release_id=generate_id(),
            release_name=release_name,
            created_at=datetime.now(),
            created_by=created_by,
            status=ReleaseStatus.DRAFT,
            devices=devices or [],
            schedules=schedules or [],
            detours=detours or [],
            templates=templates or [],
            validation_issues=[],
            release_items=[],
            review_comments=[]
        )
        self.save_release(release)
        return release


class AuditStore:
    def __init__(self):
        self.audits_dir = Config.AUDITS_DIR
        Config.ensure_directories()
    
    def save_audit(self, release_id: str, audit_data: Dict[str, Any]) -> str:
        audit_id = generate_id()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"audit_{release_id}_{timestamp}.json"
        file_path = os.path.join(self.audits_dir, filename)
        
        audit_package = {
            "audit_id": audit_id,
            "release_id": release_id,
            "generated_at": datetime.now().isoformat(),
            "data": audit_data
        }
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(audit_package, f, ensure_ascii=False, indent=2)
        
        return filename
    
    def load_audit(self, filename: str) -> Optional[Dict[str, Any]]:
        file_path = os.path.join(self.audits_dir, filename)
        if not os.path.exists(file_path):
            return None
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)


release_store = ReleaseStore()
audit_store = AuditStore()
