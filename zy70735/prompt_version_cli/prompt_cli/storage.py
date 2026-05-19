import os
import json
import yaml
from datetime import datetime
from typing import Optional, Dict, List
from pathlib import Path

from .models import PromptVersion, TrafficAllocation, HitRecord, RollbackEvent, VersionSummary


class StorageManager:
    def __init__(self, base_dir: Optional[str] = None):
        if base_dir is None:
            base_dir = os.path.join(os.getcwd(), ".prompt_version_data")
        self.base_dir = Path(base_dir)
        self._ensure_dirs()

    def _ensure_dirs(self) -> None:
        (self.base_dir / "versions").mkdir(parents=True, exist_ok=True)
        (self.base_dir / "traffic").mkdir(parents=True, exist_ok=True)
        (self.base_dir / "hits").mkdir(parents=True, exist_ok=True)
        (self.base_dir / "rollbacks").mkdir(parents=True, exist_ok=True)
        (self.base_dir / "summaries").mkdir(parents=True, exist_ok=True)

    def _get_template_dir(self, template_name: str) -> Path:
        safe_name = template_name.replace("/", "_").replace("\\", "_")
        return self.base_dir / "templates" / safe_name

    def save_version(self, version: PromptVersion) -> None:
        template_dir = self._get_template_dir(version.template_name)
        template_dir.mkdir(parents=True, exist_ok=True)
        version_file = template_dir / f"version_{version.version_id}.json"
        with open(version_file, "w", encoding="utf-8") as f:
            json.dump(version.to_dict(), f, ensure_ascii=False, indent=2)

    def get_version(self, template_name: str, version_id: str) -> Optional[PromptVersion]:
        template_dir = self._get_template_dir(template_name)
        version_file = template_dir / f"version_{version_id}.json"
        if not version_file.exists():
            return None
        with open(version_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        return PromptVersion(**data)

    def list_versions(self, template_name: str) -> List[PromptVersion]:
        template_dir = self._get_template_dir(template_name)
        if not template_dir.exists():
            return []
        versions = []
        for f in template_dir.glob("version_*.json"):
            with open(f, "r", encoding="utf-8") as fp:
                data = json.load(fp)
                versions.append(PromptVersion(**data))
        return sorted(versions, key=lambda v: v.publish_time, reverse=True)

    def save_traffic_allocation(self, allocation: TrafficAllocation) -> None:
        template_dir = self._get_template_dir(allocation.template_name)
        template_dir.mkdir(parents=True, exist_ok=True)
        traffic_file = template_dir / "traffic_history.json"
        history = []
        if traffic_file.exists():
            with open(traffic_file, "r", encoding="utf-8") as f:
                history = json.load(f)
        history.append(allocation.to_dict())
        with open(traffic_file, "w", encoding="utf-8") as f:
            json.dump(history, f, ensure_ascii=False, indent=2)

    def get_latest_traffic(self, template_name: str) -> Optional[TrafficAllocation]:
        template_dir = self._get_template_dir(template_name)
        traffic_file = template_dir / "traffic_history.json"
        if not traffic_file.exists():
            return None
        with open(traffic_file, "r", encoding="utf-8") as f:
            history = json.load(f)
        if not history:
            return None
        return TrafficAllocation(**history[-1])

    def save_hit_record(self, hit: HitRecord) -> None:
        template_dir = self._get_template_dir(hit.template_name)
        template_dir.mkdir(parents=True, exist_ok=True)
        hits_file = template_dir / "hit_records.json"
        records = []
        if hits_file.exists():
            with open(hits_file, "r", encoding="utf-8") as f:
                records = json.load(f)
        records.append(hit.to_dict())
        with open(hits_file, "w", encoding="utf-8") as f:
            json.dump(records, f, ensure_ascii=False, indent=2)

    def get_hit_records(self, template_name: str) -> List[HitRecord]:
        template_dir = self._get_template_dir(template_name)
        hits_file = template_dir / "hit_records.json"
        if not hits_file.exists():
            return []
        with open(hits_file, "r", encoding="utf-8") as f:
            records = json.load(f)
        return [HitRecord(**r) for r in records]

    def save_rollback_event(self, rollback: RollbackEvent) -> None:
        template_dir = self._get_template_dir(rollback.template_name)
        template_dir.mkdir(parents=True, exist_ok=True)
        rollbacks_file = template_dir / "rollback_events.json"
        events = []
        if rollbacks_file.exists():
            with open(rollbacks_file, "r", encoding="utf-8") as f:
                events = json.load(f)
        events.append(rollback.to_dict())
        with open(rollbacks_file, "w", encoding="utf-8") as f:
            json.dump(events, f, ensure_ascii=False, indent=2)

    def get_rollback_events(self, template_name: str) -> List[RollbackEvent]:
        template_dir = self._get_template_dir(template_name)
        rollbacks_file = template_dir / "rollback_events.json"
        if not rollbacks_file.exists():
            return []
        with open(rollbacks_file, "r", encoding="utf-8") as f:
            events = json.load(f)
        return [RollbackEvent(**r) for r in events]

    def list_templates(self) -> List[str]:
        templates_dir = self.base_dir / "templates"
        if not templates_dir.exists():
            return []
        return [d.name for d in templates_dir.iterdir() if d.is_dir()]

    def build_summary(self, template_name: str) -> VersionSummary:
        summary = VersionSummary(template_name)
        summary.versions = self.list_versions(template_name)
        summary.hit_records = self.get_hit_records(template_name)
        summary.rollback_events = self.get_rollback_events(template_name)
        return summary

    def export_summary(self, template_name: str, output_path: str, format: str = "json") -> None:
        summary = self.build_summary(template_name)
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        if format == "json":
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(summary.to_dict(), f, ensure_ascii=False, indent=2)
        elif format == "yaml":
            with open(output_path, "w", encoding="utf-8") as f:
                yaml.dump(summary.to_dict(), f, allow_unicode=True, default_flow_style=False)
        else:
            raise ValueError(f"Unsupported format: {format}")

    def clear_template_data(self, template_name: str) -> None:
        template_dir = self._get_template_dir(template_name)
        if template_dir.exists():
            import shutil
            shutil.rmtree(template_dir)
