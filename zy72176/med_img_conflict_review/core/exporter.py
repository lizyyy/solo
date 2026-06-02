from __future__ import annotations

import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from .auditor import Auditor
from .models import ConflictRecord, Sample
from .stratifier import Stratifier


class Exporter:
    def __init__(
        self,
        conflicts: list[ConflictRecord],
        samples: dict[str, Sample],
        auditor: Optional[Auditor] = None,
    ):
        self.conflicts = conflicts
        self.samples = samples
        self.auditor = auditor

    def _conflict_to_flat_dict(self, c: ConflictRecord) -> dict:
        sample = self.samples.get(c.sample_id)
        evidence_str = " | ".join(
            f"[{e.source}]{e.label}({e.detail}@{e.timestamp})"
            for e in c.evidence_chain
        )
        notes_str = ""
        if self.auditor:
            notes = self.auditor.get_notes_for(c.conflict_id)
            notes_str = " | ".join(
                f"[{n.operator}@{n.created_at}]{n.note_content}"
                f"({n.diff_description})"
                for n in notes
            ) or "无备注"
        return {
            "conflict_id": c.conflict_id,
            "sample_id": c.sample_id,
            "patient_id": sample.patient_id if sample else "",
            "modality": sample.modality if sample else "",
            "body_part": sample.body_part if sample else "",
            "study_date": sample.study_date if sample else "",
            "conflict_type": c.conflict_type.value,
            "severity": c.severity.value,
            "model_version": c.model_version,
            "sources_involved": "; ".join(c.sources_involved),
            "auto_judgment": c.auto_judgment,
            "evidence_chain": evidence_str,
            "resolved": "是" if c.resolved else "否",
            "resolution": c.resolution or "",
            "notes": notes_str,
            "detected_at": c.detected_at,
        }

    def to_csv(self, output_path: str | Path) -> Path:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.conflicts:
            output_path.write_text("", encoding="utf-8")
            return output_path
        rows = [self._conflict_to_flat_dict(c) for c in self.conflicts]
        fieldnames = list(rows[0].keys())
        with open(output_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        return output_path

    def to_json(self, output_path: str | Path) -> Path:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "report_title": "医学影像标注冲突复核报告",
            "generated_at": datetime.now().isoformat(),
            "total_conflicts": len(self.conflicts),
            "conflicts": [self._conflict_to_flat_dict(c) for c in self.conflicts],
        }
        if self.auditor:
            data["audit_notes"] = self.auditor.export_notes()
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return output_path

    def to_stratified_json(
        self,
        output_path: str | Path,
        stratifier: Stratifier,
    ) -> Path:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "report_title": "医学影像标注冲突复核报告(分层)",
            "generated_at": datetime.now().isoformat(),
            "summary": stratifier.summary(),
            "by_severity": {
                s.value: [self._conflict_to_flat_dict(c) for c in conflicts]
                for s, conflicts in stratifier.by_severity().items()
            },
            "by_conflict_type": {
                t.value: [self._conflict_to_flat_dict(c) for c in conflicts]
                for t, conflicts in stratifier.by_conflict_type().items()
            },
            "by_modality": {
                k: [self._conflict_to_flat_dict(c) for c in v]
                for k, v in stratifier.by_modality().items()
            },
            "by_model_version": {
                k: [self._conflict_to_flat_dict(c) for c in v]
                for k, v in stratifier.by_model_version().items()
            },
        }
        if self.auditor:
            data["audit_notes"] = self.auditor.export_notes()
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return output_path
