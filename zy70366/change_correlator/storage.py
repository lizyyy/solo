"""
数据存储管理
"""

import json
import os
from typing import List, Optional
from datetime import datetime
from .models import (
    Change, Alert, ServiceAlias, CorrelationResult, Report
)


class StorageManager:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = data_dir
        self.changes_file = os.path.join(data_dir, "changes.json")
        self.alerts_file = os.path.join(data_dir, "alerts.json")
        self.aliases_file = os.path.join(data_dir, "service_aliases.json")
        self.correlations_file = os.path.join(data_dir, "correlations.json")
        self.reports_dir = os.path.join(data_dir, "reports")
        self._ensure_dirs()

    def _ensure_dirs(self):
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(self.reports_dir, exist_ok=True)
        for f in [self.changes_file, self.alerts_file, self.aliases_file, self.correlations_file]:
            if not os.path.exists(f):
                self._write_json(f, [])

    def _read_json(self, file_path: str):
        if not os.path.exists(file_path):
            return []
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _write_json(self, file_path: str, data):
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load_changes(self) -> List[Change]:
        data = self._read_json(self.changes_file)
        return [Change.from_dict(c) for c in data]

    def save_changes(self, changes: List[Change]):
        self._write_json(self.changes_file, [c.to_dict() for c in changes])

    def add_change(self, change: Change):
        changes = self.load_changes()
        changes.append(change)
        self.save_changes(changes)

    def update_change(self, change: Change):
        changes = self.load_changes()
        for i, c in enumerate(changes):
            if c.id == change.id:
                changes[i] = change
                break
        self.save_changes(changes)

    def get_change(self, change_id: str) -> Optional[Change]:
        changes = self.load_changes()
        for c in changes:
            if c.id == change_id:
                return c
        return None

    def load_alerts(self) -> List[Alert]:
        data = self._read_json(self.alerts_file)
        return [Alert.from_dict(a) for a in data]

    def save_alerts(self, alerts: List[Alert]):
        self._write_json(self.alerts_file, [a.to_dict() for a in alerts])

    def add_alert(self, alert: Alert):
        alerts = self.load_alerts()
        alerts.append(alert)
        self.save_alerts(alerts)

    def load_aliases(self) -> List[ServiceAlias]:
        data = self._read_json(self.aliases_file)
        return [ServiceAlias.from_dict(a) for a in data]

    def save_aliases(self, aliases: List[ServiceAlias]):
        self._write_json(self.aliases_file, [a.to_dict() for a in aliases])

    def load_correlations(self) -> List[CorrelationResult]:
        data = self._read_json(self.correlations_file)
        return [CorrelationResult.from_dict(c) for c in data]

    def save_correlations(self, correlations: List[CorrelationResult]):
        self._write_json(self.correlations_file, [c.to_dict() for c in correlations])

    def save_report(self, report: Report) -> str:
        timestamp = report.generated_at.strftime("%Y%m%d_%H%M%S")
        file_path = os.path.join(self.reports_dir, f"report_{timestamp}.json")
        self._write_json(file_path, report.to_dict())
        return file_path

    def load_latest_report(self) -> Optional[Report]:
        reports = sorted(
            [f for f in os.listdir(self.reports_dir) if f.startswith("report_")],
            reverse=True
        )
        if not reports:
            return None
        file_path = os.path.join(self.reports_dir, reports[0])
        data = self._read_json(file_path)
        return Report.from_dict(data)
