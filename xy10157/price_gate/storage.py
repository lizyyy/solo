from __future__ import annotations
import json
import os
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .models import (
    DirtyRecord,
    HistoryRecord,
    PriceRule,
    RuleStatus,
    RuleVersion,
    SampleOrder,
)


class FileStorage:
    def __init__(self, base_dir: Optional[Path] = None):
        if base_dir is None:
            base_dir = Path.cwd() / ".price-gate"
        self.base_dir = Path(base_dir)
        self.rules_dir = self.base_dir / "rules"
        self.samples_dir = self.base_dir / "samples"
        self.history_dir = self.base_dir / "history"
        self.dirty_dir = self.base_dir / "dirty"
        self.versions_dir = self.base_dir / "versions"
        self.reports_dir = self.base_dir / "reports"
        self.catalog_file = self.base_dir / "sku_catalog.json"
        self._ensure_dirs()

    def _ensure_dirs(self) -> None:
        for d in [
            self.rules_dir,
            self.samples_dir,
            self.history_dir,
            self.dirty_dir,
            self.versions_dir,
            self.reports_dir,
        ]:
            d.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _safe_write(path: Path, content: str) -> None:
        tmp_path = path.with_suffix(path.suffix + ".tmp")
        with open(tmp_path, "w", encoding="utf-8") as f:
            f.write(content)
        os.replace(tmp_path, path)

    @staticmethod
    def _model_to_dict(model: Any) -> Dict[str, Any]:
        if hasattr(model, "model_dump"):
            data = model.model_dump()
        else:
            data = model.dict()
        def _convert(obj: Any) -> Any:
            if isinstance(obj, datetime):
                return obj.isoformat()
            if isinstance(obj, dict):
                return {k: _convert(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [_convert(i) for i in obj]
            if isinstance(obj, tuple):
                return tuple(_convert(i) for i in obj)
            return obj
        return _convert(data)

    @staticmethod
    def _datetime_parser(obj: Dict[str, Any]) -> Dict[str, Any]:
        def _convert(obj: Any) -> Any:
            if isinstance(obj, str):
                try:
                    return datetime.fromisoformat(obj)
                except (ValueError, TypeError):
                    return obj
            if isinstance(obj, dict):
                return {k: _convert(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [_convert(i) for i in obj]
            if isinstance(obj, tuple):
                return tuple(_convert(i) for i in obj)
            return obj
        return _convert(obj)

    def save_rule(self, rule: PriceRule) -> None:
        rule_path = self.rules_dir / f"{rule.id}.json"
        data = self._model_to_dict(rule)
        self._safe_write(rule_path, json.dumps(data, ensure_ascii=False, indent=2))

    def load_rule(self, rule_id: str) -> Optional[PriceRule]:
        rule_path = self.rules_dir / f"{rule_id}.json"
        if not rule_path.exists():
            return None
        with open(rule_path, "r", encoding="utf-8") as f:
            data = json.load(f, object_hook=self._datetime_parser)
        return PriceRule(**data)

    def load_all_rules(self, include_inactive: bool = False) -> List[PriceRule]:
        rules = []
        for f in self.rules_dir.glob("*.json"):
            rule = self.load_rule(f.stem)
            if rule and (include_inactive or rule.status not in {RuleStatus.INACTIVE, RuleStatus.REVERTED}):
                rules.append(rule)
        return rules

    def delete_rule(self, rule_id: str) -> bool:
        rule_path = self.rules_dir / f"{rule_id}.json"
        if rule_path.exists():
            rule_path.unlink()
            return True
        return False

    def save_sample(self, sample: SampleOrder) -> None:
        sample_path = self.samples_dir / f"{sample.id}.json"
        data = self._model_to_dict(sample)
        self._safe_write(sample_path, json.dumps(data, ensure_ascii=False, indent=2))

    def load_sample(self, sample_id: str) -> Optional[SampleOrder]:
        sample_path = self.samples_dir / f"{sample_id}.json"
        if not sample_path.exists():
            return None
        with open(sample_path, "r", encoding="utf-8") as f:
            data = json.load(f, object_hook=self._datetime_parser)
        return SampleOrder(**data)

    def load_all_samples(self) -> List[SampleOrder]:
        samples = []
        for f in self.samples_dir.glob("*.json"):
            sample = self.load_sample(f.stem)
            if sample:
                samples.append(sample)
        return samples

    def delete_sample(self, sample_id: str) -> bool:
        sample_path = self.samples_dir / f"{sample_id}.json"
        if sample_path.exists():
            sample_path.unlink()
            return True
        return False

    def save_version(self, version: RuleVersion) -> None:
        version_dir = self.versions_dir / version.rule_id
        version_dir.mkdir(parents=True, exist_ok=True)
        version_path = version_dir / f"v{version.version}.json"
        data = self._model_to_dict(version)
        self._safe_write(version_path, json.dumps(data, ensure_ascii=False, indent=2))

    def load_version(self, rule_id: str, version: int) -> Optional[RuleVersion]:
        version_path = self.versions_dir / rule_id / f"v{version}.json"
        if not version_path.exists():
            return None
        with open(version_path, "r", encoding="utf-8") as f:
            data = json.load(f, object_hook=self._datetime_parser)
        return RuleVersion(**data)

    def list_versions(self, rule_id: str) -> List[int]:
        version_dir = self.versions_dir / rule_id
        if not version_dir.exists():
            return []
        versions = []
        for f in version_dir.glob("v*.json"):
            try:
                v = int(f.stem[1:])
                versions.append(v)
            except ValueError:
                pass
        return sorted(versions, reverse=True)

    def save_history(self, record: HistoryRecord) -> None:
        ts = record.timestamp.strftime("%Y%m%d-%H%M%S")
        history_path = self.history_dir / f"{ts}-{record.id}.json"
        data = self._model_to_dict(record)
        self._safe_write(history_path, json.dumps(data, ensure_ascii=False, indent=2))

    def load_history(self, limit: int = 100) -> List[HistoryRecord]:
        history_files = sorted(self.history_dir.glob("*.json"), reverse=True)
        records = []
        for f in history_files[:limit]:
            with open(f, "r", encoding="utf-8") as fobj:
                data = json.load(fobj, object_hook=self._datetime_parser)
            records.append(HistoryRecord(**data))
        return records

    def save_dirty(self, dirty: DirtyRecord) -> None:
        dirty_path = self.dirty_dir / f"{dirty.id}.json"
        data = self._model_to_dict(dirty)
        self._safe_write(dirty_path, json.dumps(data, ensure_ascii=False, indent=2))

    def load_dirty(self, dirty_id: str) -> Optional[DirtyRecord]:
        dirty_path = self.dirty_dir / f"{dirty_id}.json"
        if not dirty_path.exists():
            return None
        with open(dirty_path, "r", encoding="utf-8") as f:
            data = json.load(f, object_hook=self._datetime_parser)
        return DirtyRecord(**data)

    def load_all_dirty(self) -> List[DirtyRecord]:
        dirty = []
        for f in self.dirty_dir.glob("*.json"):
            d = self.load_dirty(f.stem)
            if d:
                dirty.append(d)
        return dirty

    def delete_dirty(self, dirty_id: str) -> bool:
        dirty_path = self.dirty_dir / f"{dirty_id}.json"
        if dirty_path.exists():
            dirty_path.unlink()
            return True
        return False

    def save_report(self, name: str, content: str) -> Path:
        ts = datetime.now().strftime("%Y%m%d-%H%M%S")
        report_path = self.reports_dir / f"{ts}-{name}"
        self._safe_write(report_path, content)
        return report_path

    def backup(self, backup_name: Optional[str] = None) -> Path:
        if backup_name is None:
            backup_name = f"backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        backup_path = self.base_dir.parent / backup_name
        if self.base_dir.exists():
            shutil.copytree(self.base_dir, backup_path)
        return backup_path

    def restore(self, backup_path: Path) -> None:
        if backup_path.exists():
            if self.base_dir.exists():
                shutil.rmtree(self.base_dir)
            shutil.copytree(backup_path, self.base_dir)

    def reset(self) -> None:
        if self.base_dir.exists():
            shutil.rmtree(self.base_dir)
        self._ensure_dirs()

    def save_sku_catalog(self, catalog: Dict[str, Dict[str, Any]]) -> None:
        self._safe_write(
            self.catalog_file,
            json.dumps(catalog, ensure_ascii=False, indent=2),
        )

    def load_sku_catalog(self) -> Dict[str, Dict[str, Any]]:
        if not self.catalog_file.exists():
            return {}
        with open(self.catalog_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def update_sku_catalog(self, sku: str, info: Dict[str, Any]) -> None:
        catalog = self.load_sku_catalog()
        catalog[sku] = info
        self.save_sku_catalog(catalog)
