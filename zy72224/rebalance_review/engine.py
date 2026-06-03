import re
from typing import Optional
from .models import (
    ReviewRecord,
    TaxRateNote,
    ChangeHistory,
    PinyinVerdict,
    ReviewStatus,
    ApproverBoundaryRule,
)


class RebalanceReviewEngine:
    PINYIN_PATTERN = re.compile(r'^[a-zA-Z\s]+$')
    CHINESE_PATTERN = re.compile(r'[\u4e00-\u9fff]')

    def __init__(self):
        self._boundary_rules: list[ApproverBoundaryRule] = []
        self._records: dict[str, ReviewRecord] = {}
        self._imported_fingerprints: dict[str, set] = {}

    def add_boundary_rule(self, rule: ApproverBoundaryRule) -> None:
        self._boundary_rules.append(rule)
        self._boundary_rules.sort(key=lambda r: r.priority, reverse=True)

    def get_boundary_rules(self) -> list[ApproverBoundaryRule]:
        return [r for r in self._boundary_rules if r.is_active]

    def detect_pinyin(self, name: str) -> PinyinVerdict:
        if not name or not name.strip():
            return PinyinVerdict.AMBIGUOUS
        stripped = name.strip()
        has_chinese = bool(self.CHINESE_PATTERN.search(stripped))
        if has_chinese:
            return PinyinVerdict.NORMAL
        is_pure_pinyin = bool(self.PINYIN_PATTERN.match(stripped))
        if is_pure_pinyin:
            return PinyinVerdict.PINYIN_ONLY
        return PinyinVerdict.AMBIGUOUS

    def evaluate_boundary(self, record: ReviewRecord) -> ReviewStatus:
        verdict = self.detect_pinyin(record.approver_name)
        record.approver_pinyin_verdict = verdict
        if verdict == PinyinVerdict.PINYIN_ONLY:
            return ReviewStatus.AWAITING_CLIENT_MANAGER_REVIEW
        if verdict == PinyinVerdict.AMBIGUOUS:
            return ReviewStatus.PINYIN_FLAGGED
        for rule in self.get_boundary_rules():
            if self._rule_matches(rule, record):
                if rule.action == "flag_pinyin":
                    return ReviewStatus.PINYIN_FLAGGED
                elif rule.action == "await_client_manager":
                    return ReviewStatus.AWAITING_CLIENT_MANAGER_REVIEW
                elif rule.action == "reject":
                    return ReviewStatus.REJECTED
        return ReviewStatus.APPROVED

    def _rule_matches(self, rule: ApproverBoundaryRule, record: ReviewRecord) -> bool:
        if rule.condition_type == "approver_name_pattern":
            return bool(re.search(rule.condition_value, record.approver_name))
        if rule.condition_type == "status_equals":
            return record.status.value == rule.condition_value
        if rule.condition_type == "portfolio_name_pattern":
            return bool(re.search(rule.condition_value, record.portfolio_name))
        return False

    def import_tax_notes(self, record: ReviewRecord, notes: list[TaxRateNote], operator: str = "system") -> list[TaxRateNote]:
        if record.id not in self._imported_fingerprints:
            self._imported_fingerprints[record.id] = set()
        existing_fps = self._imported_fingerprints[record.id]
        existing_fps_in_record = {n.fingerprint() for n in record.tax_notes}
        all_existing = existing_fps | existing_fps_in_record

        added: list[TaxRateNote] = []
        for note in notes:
            fp = note.fingerprint()
            if fp in all_existing:
                continue
            all_existing.add(fp)
            record.tax_notes.append(note)
            added.append(note)
            record.history.append(ChangeHistory(
                record_id=record.id,
                field_name="tax_notes",
                old_value="",
                new_value=note.fingerprint(),
                changed_by=operator,
                change_type="add",
            ))

        self._imported_fingerprints[record.id] = all_existing
        record.updated_at = __import__("datetime").datetime.now()
        return added

    def update_note_remark(self, record: ReviewRecord, note_id: str, new_remark: str, operator: str = "system") -> Optional[ChangeHistory]:
        for note in record.tax_notes:
            if note.id == note_id:
                old_remark = note.remark
                note.remark = new_remark
                history_entry = ChangeHistory(
                    record_id=record.id,
                    field_name="remark",
                    old_value=old_remark,
                    new_value=new_remark,
                    changed_by=operator,
                    change_type="update",
                )
                record.history.append(history_entry)
                record.updated_at = __import__("datetime").datetime.now()
                return history_entry
        return None

    def rollback_record(self, record: ReviewRecord, to_history_id: str, operator: str = "system") -> bool:
        target_idx = None
        for i, h in enumerate(record.history):
            if h.id == to_history_id:
                target_idx = i
                break
        if target_idx is None:
            return False

        reversed_entries = []
        for h in reversed(record.history[target_idx + 1:]):
            if h.field_name == "remark" and h.change_type == "update":
                for note in record.tax_notes:
                    if note.fingerprint().startswith(h.new_value[:5] if h.new_value else ""):
                        note.remark = h.old_value
                        break
                reversed_entries.append(ChangeHistory(
                    record_id=record.id,
                    field_name=h.field_name,
                    old_value=h.new_value,
                    new_value=h.old_value,
                    changed_by=operator,
                    change_type="rollback",
                ))

        record.history.extend(reversed_entries)
        record.status = ReviewStatus.ROLLED_BACK
        record.updated_at = __import__("datetime").datetime.now()
        return True

    def get_history_diff(self, record: ReviewRecord) -> list[str]:
        return [h.diff_summary() for h in record.history]

    def create_record(self, portfolio_name: str, approver_name: str) -> ReviewRecord:
        record = ReviewRecord(portfolio_name=portfolio_name, approver_name=approver_name)
        verdict = self.detect_pinyin(approver_name)
        record.approver_pinyin_verdict = verdict
        self._records[record.id] = record
        return record

    def get_record(self, record_id: str) -> Optional[ReviewRecord]:
        return self._records.get(record_id)
