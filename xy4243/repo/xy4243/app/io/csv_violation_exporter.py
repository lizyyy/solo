import csv
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

from app.models import Violation, CheckStatus


@dataclass
class ViolationExportConfig:
    include_resolved: bool = False
    include_metadata: bool = False
    delimiter: str = ","
    encoding: str = "utf-8"


class CSVViolationExporter:

    def __init__(self, config: Optional[ViolationExportConfig] = None):
        self.config = config or ViolationExportConfig()

    def export(self, violations: List[Violation]) -> List[Dict[str, Any]]:
        rows = []

        for violation in violations:
            if not self.config.include_resolved and violation.resolved:
                continue

            row = {
                "violation_id": violation.id,
                "violation_type": violation.violation_type,
                "severity": violation.severity,
                "check_status": violation.check_status.name if hasattr(violation.check_status, 'name') else str(violation.check_status),
                "description": violation.description,
                "prop_id": violation.prop_id or "",
                "prop_name": violation.prop_name or "",
                "scene_id": violation.scene_id or "",
                "scene_title": violation.scene_title or "",
                "handover_id": violation.handover_id or "",
                "actor_id": violation.actor_id or "",
                "actor_name": violation.actor_name or "",
                "resolved": "是" if violation.resolved else "否",
                "resolved_by": violation.resolved_by or "",
                "resolution_notes": violation.resolution_notes or "",
                "detected_at": violation.detected_at.strftime("%Y-%m-%d %H:%M:%S") if violation.detected_at else "",
                "resolved_at": violation.resolved_at.strftime("%Y-%m-%d %H:%M:%S") if violation.resolved_at else "",
            }

            if self.config.include_metadata and violation.metadata:
                import json
                row["metadata"] = json.dumps(violation.metadata, ensure_ascii=False)
                row["related_entities"] = ", ".join(violation.related_entities) if violation.related_entities else ""

            rows.append(row)

        return rows

    def export_to_file(self, file_path: Path, violations: List[Violation]) -> Path:
        rows = self.export(violations)

        if not rows:
            with open(file_path, 'w', encoding=self.config.encoding) as f:
                f.write("")
            return file_path

        fieldnames = list(rows[0].keys())

        with open(file_path, 'w', encoding=self.config.encoding, newline='') as f:
            writer = csv.DictWriter(
                f,
                fieldnames=fieldnames,
                delimiter=self.config.delimiter,
                quoting=csv.QUOTE_MINIMAL,
            )
            writer.writeheader()
            writer.writerows(rows)

        return file_path

    @staticmethod
    def get_fieldnames(include_metadata: bool = False) -> List[str]:
        base_fields = [
            "violation_id",
            "violation_type",
            "severity",
            "check_status",
            "description",
            "prop_id",
            "prop_name",
            "scene_id",
            "scene_title",
            "handover_id",
            "actor_id",
            "actor_name",
            "resolved",
            "resolved_by",
            "resolution_notes",
            "detected_at",
            "resolved_at",
        ]

        if include_metadata:
            base_fields.extend(["metadata", "related_entities"])

        return base_fields
