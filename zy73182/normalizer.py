from typing import Dict, List, Any, Tuple, Optional
from models import (
    StudentDraft,
    FieldMappingRecord,
    ProcessingStatus,
    AttributionConfig,
    AuditLogEntry,
)
import difflib


class DraftNormalizer:
    REQUIRED_FIELDS = ["student_id", "question_id", "answer_value"]
    FIELD_CONFIDENCE_THRESHOLD = 0.6

    def __init__(self, config: AttributionConfig, auditor=None):
        self.config = config
        self.auditor = auditor
        self._reverse_synonyms = self._build_reverse_synonyms()

    def _build_reverse_synonyms(self) -> Dict[str, str]:
        reverse = {}
        for target_field, synonyms in self.config.field_synonyms.items():
            reverse[target_field.lower()] = target_field
            for syn in synonyms:
                reverse[syn.lower().strip()] = target_field
        return reverse

    def _match_field(self, source_field: str) -> Tuple[Optional[str], float, str]:
        source_lower = source_field.lower().strip()
        if source_lower in self._reverse_synonyms:
            return self._reverse_synonyms[source_lower], 1.0, "exact_synonym_match"

        best_match = None
        best_ratio = 0.0
        best_rule = ""

        for canonical, synonyms in self.config.field_synonyms.items():
            all_candidates = [canonical] + synonyms
            for candidate in all_candidates:
                ratio = difflib.SequenceMatcher(
                    None, source_lower, candidate.lower().strip()
                ).ratio()
                if ratio > best_ratio:
                    best_ratio = ratio
                    best_match = canonical
                    best_rule = "fuzzy_match"

        if best_ratio >= self.FIELD_CONFIDENCE_THRESHOLD:
            return best_match, round(best_ratio, 3), best_rule

        return None, 0.0, "no_match"

    def _extract_chart_points(self, payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        chart_keys = ["chart_data", "图示点", "chart", "points", "图表数据", "scatter", "图表点", "散点", "散点数据"]
        for key in payload:
            for chart_key in chart_keys:
                if chart_key.lower() in key.lower() or key.lower() in chart_key.lower():
                    raw = payload[key]
                    if isinstance(raw, list):
                        return [{"source_key": key, **pt} if isinstance(pt, dict) else {"source_key": key, "value": pt} for pt in raw]
                    if isinstance(raw, dict) and "points" in raw:
                        return [{"source_key": key, **pt} for pt in raw["points"]]
        return []

    def _extract_scratch_text(self, payload: Dict[str, Any]) -> str:
        scratch_keys = ["scratch_text", "草稿", "草稿内容", "scratch", "notes", "说明", "草稿文字", "手写说明"]
        for key in payload:
            for sk in scratch_keys:
                if (sk.lower() in key.lower() or key.lower() in sk.lower()) and isinstance(payload[key], str):
                    return payload[key]
        return ""

    def normalize(self, raw_payload: Dict[str, Any],
                  source_file: str = "",
                  source_batch: str = "",
                  operator: str = "import_job") -> StudentDraft:
        draft = StudentDraft(
            raw_payload=raw_payload,
            source_file=source_file,
            source_batch=source_batch,
        )

        normalized: Dict[str, Any] = {}
        mappings: List[FieldMappingRecord] = []

        for source_field, value in raw_payload.items():
            target_field, confidence, rule = self._match_field(source_field)
            if target_field:
                mapping = FieldMappingRecord(
                    source_field=source_field,
                    target_field=target_field,
                    confidence=confidence,
                    mapping_rule=rule,
                )
                mappings.append(mapping)
                if target_field not in normalized or confidence > 0.9:
                    normalized[target_field] = value

        draft.field_mappings = mappings
        draft.normalized_data = normalized
        draft.raw_scratch_text = self._extract_scratch_text(raw_payload)
        draft.raw_chart_points = self._extract_chart_points(raw_payload)

        if normalized.get("student_id"):
            draft.student_id = str(normalized["student_id"])
        if normalized.get("question_id"):
            draft.question_id = str(normalized["question_id"])
        elif normalized.get("question_number"):
            draft.question_id = str(normalized["question_number"])

        missing_required = [f for f in self.REQUIRED_FIELDS if f not in normalized]
        if missing_required:
            draft.processing_status = ProcessingStatus.AMBIGUOUS
        else:
            draft.processing_status = ProcessingStatus.NORMALIZED

        if self.auditor:
            self.auditor.log(
                AuditLogEntry(
                    entity_type="StudentDraft",
                    entity_id=draft.draft_id,
                    action="normalize",
                    operator=operator,
                    before={"status": ProcessingStatus.RAW.value},
                    after={
                        "status": draft.processing_status.value,
                        "field_mappings_count": len(mappings),
                        "missing_required": missing_required,
                        "source_file": source_file,
                        "source_batch": source_batch,
                    },
                    comment=f"标准化完成，映射{len(mappings)}个字段，缺失关键字段：{missing_required}",
                )
            )

        return draft

    def manual_override_mapping(self, draft: StudentDraft,
                                 source_field: str,
                                 new_target_field: str,
                                 operator: str) -> StudentDraft:
        for mapping in draft.field_mappings:
            if mapping.source_field == source_field:
                mapping.target_field = new_target_field
                mapping.confidence = 1.0
                mapping.manual_override = True
                mapping.mapping_rule = "manual_override"

        draft.normalized_data[new_target_field] = draft.raw_payload.get(source_field)
        draft.processing_status = ProcessingStatus.NORMALIZED
        draft.version += 1
        draft.updated_at = _now()

        if self.auditor:
            self.auditor.log(
                AuditLogEntry(
                    entity_type="StudentDraft",
                    entity_id=draft.draft_id,
                    action="override_mapping",
                    operator=operator,
                    before={"source_field": source_field, "old_target": [m.target_field for m in draft.field_mappings if m.source_field == source_field]},
                    after={"new_target": new_target_field, "new_status": draft.processing_status.value},
                    comment=f"字段映射人工修正：{source_field} -> {new_target_field}",
                )
            )
        return draft

    def normalize_batch(self,
                         payloads: List[Dict[str, Any]],
                         source_file: str = "",
                         source_batch: str = "",
                         operator: str = "import_job") -> List[StudentDraft]:
        return [
            self.normalize(p, source_file, source_batch, operator)
            for p in payloads
        ]


class AuditLogger:
    def __init__(self):
        self._logs: List[AuditLogEntry] = []

    def log(self, entry: AuditLogEntry):
        self._logs.append(entry)

    def query(self, entity_type: str = "", entity_id: str = "", action: str = "",
               operator: str = "", limit: int = 100) -> List[AuditLogEntry]:
        result = self._logs
        if entity_type:
            result = [e for e in result if e.entity_type == entity_type]
        if entity_id:
            result = [e for e in result if e.entity_id == entity_id]
        if action:
            result = [e for e in result if e.action == action]
        if operator:
            result = [e for e in result if e.operator == operator]
        return sorted(result, key=lambda e: e.timestamp, reverse=True)[:limit]

    def all_logs(self) -> List[AuditLogEntry]:
        return list(self._logs)


def _now() -> str:
    from datetime import datetime
    return datetime.now().isoformat(timespec="seconds")
