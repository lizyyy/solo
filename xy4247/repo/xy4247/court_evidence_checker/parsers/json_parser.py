import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from dateutil.parser import parse as parse_date

from .base import BaseParser, ParseResult
from ..models import Objection, ObjectionType, ObjectionStatus, Reference, ReferenceType


@dataclass
class CrossExaminationEntry:
    entry_id: str
    evidence_number: str
    presenter: str
    cross_examiner: str
    timestamp: Optional[datetime] = None
    evidence_description: Optional[str] = None
    presentation_content: Optional[str] = None
    cross_examination_content: Optional[str] = None
    objections: List[Dict] = field(default_factory=list)
    rulings: List[Dict] = field(default_factory=list)
    metadata: Dict = field(default_factory=dict)


class CrossExaminationJSONParser(BaseParser):
    TYPE_MAPPING = {
        "关联性": "relevance",
        "传闻": "hearsay",
        "真实性": "authenticity",
        "鉴定意见": "opinion",
        "特权": "privilege",
        "其他": "other",
        "relevance": "relevance",
        "hearsay": "hearsay",
        "authenticity": "authenticity",
        "opinion": "opinion",
        "privilege": "privilege",
        "other": "other",
    }

    STATUS_MAPPING = {
        "提出": "raised",
        "成立": "sustained",
        "不成立": "overruled",
        "待裁决": "pending",
        "撤回": "withdrawn",
        "raised": "raised",
        "sustained": "sustained",
        "overruled": "overruled",
        "pending": "pending",
        "withdrawn": "withdrawn",
    }

    def parse(self, file_path: Path) -> ParseResult:
        if not self._validate_file(file_path):
            return ParseResult(
                success=False,
                errors=self.errors,
                warnings=self.warnings,
            )

        content = self._read_file(file_path)
        if content is None:
            return ParseResult(
                success=False,
                errors=self.errors,
                warnings=self.warnings,
            )

        return self.parse_string(content, str(file_path))

    def parse_string(self, content: str, source_file: str = "string") -> ParseResult:
        try:
            data = json.loads(content)
        except json.JSONDecodeError as e:
            self.add_error(f"Invalid JSON: {e}")
            return ParseResult(
                success=False,
                errors=self.errors,
                warnings=self.warnings,
            )

        entries = self._parse_entries(data)
        objections = self._extract_objections(entries, source_file)
        references = self._extract_references(entries, source_file)

        metadata = {
            "source_file": source_file,
            "total_entries": len(entries),
            "total_objections": len(objections),
            "parse_timestamp": datetime.now().isoformat(),
        }

        result = ParseResult(
            success=True,
            data={
                "entries": [e.__dict__ for e in entries],
                "objections": [o.to_dict() for o in objections],
                "references": [r.to_dict() for r in references],
                "raw_data": data,
            },
            errors=self.errors,
            warnings=self.warnings,
            metadata=metadata,
        )
        result.references = references
        result.objections = objections
        return result

    def _parse_entries(self, data: Any) -> List[CrossExaminationEntry]:
        entries = []

        if isinstance(data, list):
            items = data
        elif isinstance(data, dict):
            items = data.get("entries", data.get("cross_examinations", [data]))
        else:
            self.add_error("Unexpected JSON structure")
            return []

        for i, item in enumerate(items):
            try:
                entry = self._parse_single_entry(item, i + 1)
                if entry:
                    entries.append(entry)
            except Exception as e:
                self.add_warning(f"Entry {i + 1}: Failed to parse - {e}")

        return entries

    def _parse_single_entry(self, item: Dict, index: int) -> Optional[CrossExaminationEntry]:
        entry_id = item.get("entry_id", item.get("id", f"entry_{index}"))
        evidence_number = item.get("evidence_number", item.get("evidence_id"))

        if not evidence_number:
            self.add_warning(f"Entry {index}: Missing evidence number")
            return None

        entry = CrossExaminationEntry(
            entry_id=entry_id,
            evidence_number=evidence_number,
            presenter=item.get("presenter", item.get("proponent", "未知")),
            cross_examiner=item.get("cross_examiner", item.get("opponent", "未知")),
        )

        timestamp = item.get("timestamp", item.get("time", item.get("date")))
        if timestamp:
            try:
                if isinstance(timestamp, str):
                    entry.timestamp = parse_date(timestamp)
                elif isinstance(timestamp, (int, float)):
                    entry.timestamp = datetime.fromtimestamp(timestamp)
            except Exception:
                self.add_warning(f"Entry {index}: Invalid timestamp format")

        entry.evidence_description = item.get("evidence_description", item.get("description"))
        entry.presentation_content = item.get("presentation", item.get("presentation_content"))
        entry.cross_examination_content = item.get("cross_examination", item.get("cross_examination_content"))

        entry.objections = item.get("objections", [])
        entry.rulings = item.get("rulings", [])

        for key, value in item.items():
            if key not in [
                "entry_id", "id", "evidence_number", "evidence_id",
                "presenter", "proponent", "cross_examiner", "opponent",
                "timestamp", "time", "date", "evidence_description", "description",
                "presentation", "presentation_content", "cross_examination",
                "cross_examination_content", "objections", "rulings"
            ]:
                entry.metadata[key] = value

        return entry

    def _extract_objections(
        self, entries: List[CrossExaminationEntry], source_file: str
    ) -> List[Objection]:
        objections = []

        for entry in entries:
            for i, obj_data in enumerate(entry.objections):
                try:
                    obj_type_value = self.TYPE_MAPPING.get(
                        obj_data.get("type", "").lower(), "other"
                    )
                    obj_type = ObjectionType(obj_type_value)

                    status_value = self.STATUS_MAPPING.get(
                        obj_data.get("status", "raised").lower(), "raised"
                    )
                    status = ObjectionStatus(status_value)

                    raised_at = None
                    raised_at_str = obj_data.get("raised_at", obj_data.get("timestamp"))
                    if raised_at_str:
                        try:
                            raised_at = parse_date(raised_at_str) if isinstance(raised_at_str, str) else raised_at_str
                        except Exception:
                            pass

                    ruling_at = None
                    ruling_at_str = obj_data.get("ruling_at")
                    if ruling_at_str:
                        try:
                            ruling_at = parse_date(ruling_at_str) if isinstance(ruling_at_str, str) else ruling_at_str
                        except Exception:
                            pass

                    objection = Objection(
                        objection_id=obj_data.get("objection_id", f"{entry.entry_id}_obj_{i}"),
                        evidence_number=entry.evidence_number,
                        objection_type=obj_type,
                        raised_by=obj_data.get("raised_by", obj_data.get("by", entry.cross_examiner)),
                        raised_at=raised_at,
                        description=obj_data.get("description", obj_data.get("reason")),
                        status=status,
                        ruling=obj_data.get("ruling", obj_data.get("decision")),
                        ruling_at=ruling_at,
                        source_file=source_file,
                    )
                    objections.append(objection)
                except Exception as e:
                    self.add_warning(f"Failed to parse objection in entry {entry.entry_id}: {e}")

        return objections

    def _extract_references(
        self, entries: List[CrossExaminationEntry], source_file: str
    ) -> List[Reference]:
        references = []

        for entry in entries:
            context_parts = []
            if entry.presentation_content:
                context_parts.append(f"举证: {entry.presentation_content[:100]}")
            if entry.cross_examination_content:
                context_parts.append(f"质证: {entry.cross_examination_content[:100]}")

            context = " | ".join(context_parts) if context_parts else f"Entry: {entry.entry_id}"

            ref = Reference(
                evidence_number=entry.evidence_number,
                reference_type=ReferenceType.CROSS_EXAMINATION,
                source_file=source_file,
                source_context=context,
                description=entry.evidence_description,
            )
            references.append(ref)

        return references
