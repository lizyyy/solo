import json
import os
from typing import List, Dict, Any, Optional
from datetime import datetime
from .models import Recommendation, ImportRecord, VersionHistory, MaskingRule


class JSONStorage:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self._ensure_dirs()

    def _ensure_dirs(self):
        os.makedirs(self.data_dir, exist_ok=True)
        for subdir in ["recommendations", "import_records", "version_history", "masking_rules", "audit_logs"]:
            os.makedirs(os.path.join(self.data_dir, subdir), exist_ok=True)

    def _get_path(self, category: str, item_id: str) -> str:
        return os.path.join(self.data_dir, category, f"{item_id}.json")

    def _list_files(self, category: str) -> List[str]:
        path = os.path.join(self.data_dir, category)
        return [f for f in os.listdir(path) if f.endswith(".json")]

    def save_recommendation(self, rec: Recommendation):
        path = self._get_path("recommendations", rec.id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(rec.to_dict(), f, ensure_ascii=False, indent=2)

    def get_recommendation(self, rec_id: str) -> Optional[Recommendation]:
        path = self._get_path("recommendations", rec_id)
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return Recommendation.from_dict(data)

    def find_recommendation_by_model_output_id(self, model_output_id: str) -> Optional[Recommendation]:
        for f in self._list_files("recommendations"):
            path = os.path.join(self.data_dir, "recommendations", f)
            with open(path, "r", encoding="utf-8") as fp:
                data = json.load(fp)
            if data.get("model_output_id") == model_output_id and data.get("is_active", True):
                return Recommendation.from_dict(data)
        return None

    def list_recommendations(self, batch_id: Optional[str] = None, active_only: bool = True) -> List[Recommendation]:
        results = []
        for f in self._list_files("recommendations"):
            path = os.path.join(self.data_dir, "recommendations", f)
            with open(path, "r", encoding="utf-8") as fp:
                data = json.load(fp)
            if batch_id and data.get("batch_id") != batch_id:
                continue
            if active_only and not data.get("is_active", True):
                continue
            results.append(Recommendation.from_dict(data))
        return results

    def save_import_record(self, record: ImportRecord):
        path = self._get_path("import_records", record.id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(record.to_dict(), f, ensure_ascii=False, indent=2)

    def get_import_record(self, record_id: str) -> Optional[ImportRecord]:
        path = self._get_path("import_records", record_id)
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return ImportRecord.from_dict(data)

    def list_import_records(self, batch_id: Optional[str] = None) -> List[ImportRecord]:
        results = []
        for f in self._list_files("import_records"):
            path = os.path.join(self.data_dir, "import_records", f)
            with open(path, "r", encoding="utf-8") as fp:
                data = json.load(fp)
            if batch_id and data.get("batch_id") != batch_id:
                continue
            results.append(ImportRecord.from_dict(data))
        return results

    def save_version_history(self, history: VersionHistory):
        path = self._get_path("version_history", history.id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(history.to_dict(), f, ensure_ascii=False, indent=2)

    def get_version_history(self, recommendation_id: str) -> List[VersionHistory]:
        results = []
        for f in self._list_files("version_history"):
            path = os.path.join(self.data_dir, "version_history", f)
            with open(path, "r", encoding="utf-8") as fp:
                data = json.load(fp)
            if data.get("recommendation_id") == recommendation_id:
                results.append(VersionHistory.from_dict(data))
        results.sort(key=lambda x: x.version)
        return results

    def save_masking_rule(self, rule: MaskingRule):
        path = self._get_path("masking_rules", rule.id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(rule.to_dict(), f, ensure_ascii=False, indent=2)

    def get_masking_rules(self, enabled_only: bool = True) -> List[MaskingRule]:
        results = []
        for f in self._list_files("masking_rules"):
            path = os.path.join(self.data_dir, "masking_rules", f)
            with open(path, "r", encoding="utf-8") as fp:
                data = json.load(fp)
            if enabled_only and not data.get("is_enabled", True):
                continue
            results.append(MaskingRule.from_dict(data))
        return results

    def append_audit_log(self, entry: Dict[str, Any]):
        log_path = os.path.join(self.data_dir, "audit_logs", "audit.log.jsonl")
        entry["timestamp"] = datetime.now().isoformat()
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    def get_audit_logs(self, limit: int = 100) -> List[Dict[str, Any]]:
        log_path = os.path.join(self.data_dir, "audit_logs", "audit.log.jsonl")
        if not os.path.exists(log_path):
            return []
        logs = []
        with open(log_path, "r", encoding="utf-8") as f:
            for line in f:
                logs.append(json.loads(line.strip()))
        return logs[-limit:]
