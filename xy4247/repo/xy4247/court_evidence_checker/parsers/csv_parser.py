import csv
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from dateutil.parser import parse as parse_date

from .base import BaseParser, ParseResult
from ..models import Evidence, EvidenceCatalog, EvidenceType, EvidenceStatus, Reference, ReferenceType


@dataclass
class CSVEvidenceEntry:
    evidence_number: str
    display_name: str
    evidence_type: str
    submitter: str
    submission_date: Optional[str] = None
    description: Optional[str] = None
    status: str = "submitted"
    aliases: List[str] = field(default_factory=list)
    page_count: Optional[int] = None
    metadata: Dict = field(default_factory=dict)


class EvidenceCSVParser(BaseParser):
    DEFAULT_COLUMN_MAPPING = {
        "evidence_number": ["证据编号", "编号", "序号", "id", "evidence_number", "evidence_id"],
        "display_name": ["证据名称", "名称", "名称描述", "display_name", "name", "title"],
        "evidence_type": ["证据类型", "类型", "type", "evidence_type"],
        "submitter": ["提交人", "提交方", "提供人", "submitter", "provider", "party"],
        "submission_date": ["提交日期", "日期", "submission_date", "date"],
        "description": ["描述", "说明", "备注", "description", "note", "remark"],
        "status": ["状态", "status", "state"],
        "aliases": ["别名", "其他名称", "别名列表", "aliases", "other_names"],
        "page_count": ["页数", "页码数", "page_count", "pages"],
    }

    TYPE_MAPPING = {
        "书证": "document",
        "物证": "physical",
        "证人证言": "witness",
        "视听资料": "audio_video",
        "电子数据": "audio_video",
        "鉴定意见": "expert",
        "勘验笔录": "expert",
        "其他": "other",
        "document": "document",
        "physical": "physical",
        "witness": "witness",
        "audio_video": "audio_video",
        "expert": "expert",
        "other": "other",
    }

    STATUS_MAPPING = {
        "已提交": "submitted",
        "已采信": "admitted",
        "不采信": "excluded",
        "待确认": "pending",
        "submitted": "submitted",
        "admitted": "admitted",
        "excluded": "excluded",
        "pending": "pending",
    }

    def __init__(self, column_mapping: Optional[Dict[str, List[str]]] = None):
        super().__init__()
        self.column_mapping = column_mapping or self.DEFAULT_COLUMN_MAPPING
        self._column_cache: Dict[str, str] = {}

    def parse(self, file_path: Path) -> ParseResult:
        if not self._validate_file(file_path):
            return ParseResult(
                success=False,
                errors=self.errors,
                warnings=self.warnings,
            )

        try:
            entries = self._parse_csv_file(file_path)
            evidence_catalog = self._build_evidence_catalog(entries)
            references = self._extract_references(entries, str(file_path))

            metadata = {
                "source_file": str(file_path),
                "total_entries": len(entries),
                "parse_timestamp": datetime.now().isoformat(),
            }

            result = ParseResult(
                success=True,
                data={
                    "entries": [e.__dict__ for e in entries],
                    "evidence_catalog": evidence_catalog.to_dict(),
                    "references": [r.to_dict() for r in references],
                },
                errors=self.errors,
                warnings=self.warnings,
                metadata=metadata,
            )
            result.evidence_catalog = evidence_catalog
            result.references = references
            return result

        except Exception as e:
            self.add_error(f"Failed to parse CSV file: {e}")
            return ParseResult(
                success=False,
                errors=self.errors,
                warnings=self.warnings,
            )

    def _parse_csv_file(self, file_path: Path) -> List[CSVEvidenceEntry]:
        entries = []

        with open(file_path, "r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            self._map_columns(reader.fieldnames or [])

            for row_num, row in enumerate(reader, start=2):
                try:
                    entry = self._parse_row(row, row_num)
                    if entry:
                        entries.append(entry)
                except Exception as e:
                    self.add_warning(f"Row {row_num}: Failed to parse - {e}")

        return entries

    def _map_columns(self, headers: List[str]) -> None:
        self._column_cache = {}

        for model_field, possible_columns in self.column_mapping.items():
            for possible_col in possible_columns:
                for header in headers:
                    if header.strip().lower() == possible_col.lower():
                        self._column_cache[model_field] = header
                        break
                if model_field in self._column_cache:
                    break

    def _get_value(self, row: Dict[str, str], field: str) -> Optional[str]:
        if field in self._column_cache:
            value = row.get(self._column_cache[field], "").strip()
            return value if value else None
        return None

    def _parse_row(self, row: Dict[str, str], row_num: int) -> Optional[CSVEvidenceEntry]:
        evidence_number = self._get_value(row, "evidence_number")
        if not evidence_number:
            self.add_warning(f"Row {row_num}: Missing evidence number, skipping")
            return None

        display_name = self._get_value(row, "display_name") or "未命名证据"
        evidence_type = self._get_value(row, "evidence_type") or "other"
        submitter = self._get_value(row, "submitter") or "未知"

        entry = CSVEvidenceEntry(
            evidence_number=evidence_number,
            display_name=display_name,
            evidence_type=evidence_type,
            submitter=submitter,
        )

        submission_date = self._get_value(row, "submission_date")
        if submission_date:
            entry.submission_date = submission_date

        description = self._get_value(row, "description")
        if description:
            entry.description = description

        status = self._get_value(row, "status")
        if status:
            entry.status = status

        aliases = self._get_value(row, "aliases")
        if aliases:
            entry.aliases = [a.strip() for a in aliases.split(",") if a.strip()]

        page_count = self._get_value(row, "page_count")
        if page_count:
            try:
                entry.page_count = int(page_count)
            except ValueError:
                self.add_warning(f"Row {row_num}: Invalid page count: {page_count}")

        for key, value in row.items():
            if key not in self._column_cache.values() and value.strip():
                entry.metadata[key] = value.strip()

        return entry

    def _build_evidence_catalog(self, entries: List[CSVEvidenceEntry]) -> EvidenceCatalog:
        catalog = EvidenceCatalog()

        for entry in entries:
            ev_type_value = self.TYPE_MAPPING.get(entry.evidence_type.lower(), "other")
            ev_type = EvidenceType(ev_type_value)

            status_value = self.STATUS_MAPPING.get(entry.status.lower(), "submitted")
            status = EvidenceStatus(status_value)

            submission_date = None
            if entry.submission_date:
                try:
                    submission_date = parse_date(entry.submission_date)
                except Exception:
                    self.add_warning(f"Invalid date format for evidence {entry.evidence_number}: {entry.submission_date}")

            evidence = Evidence(
                evidence_number=entry.evidence_number,
                display_name=entry.display_name,
                evidence_type=ev_type,
                submitter=entry.submitter,
                submission_date=submission_date,
                description=entry.description,
                status=status,
                aliases=entry.aliases,
                page_count=entry.page_count,
                metadata=entry.metadata,
            )

            catalog.add_evidence(evidence)

        return catalog

    def _extract_references(
        self, entries: List[CSVEvidenceEntry], source_file: str
    ) -> List[Reference]:
        references = []

        for entry in entries:
            ref = Reference(
                evidence_number=entry.evidence_number,
                reference_type=ReferenceType.EVIDENCE_LIST,
                source_file=source_file,
                source_context=entry.display_name,
                description=entry.description,
                aliases=entry.aliases,
            )
            references.append(ref)

        return references
