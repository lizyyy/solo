import re
from datetime import datetime
from typing import Optional
from .models import (
    ReviewRecord,
    TaxRateNote,
    ChangeHistory,
    PinyinVerdict,
    ReviewStatus,
    ApproverBoundaryRule,
    WorkflowPhase,
)


PINYIN_ONLY_ACTION = {
    "verdict": PinyinVerdict.PINYIN_ONLY,
    "status": ReviewStatus.AWAITING_CLIENT_MANAGER_REVIEW,
    "allow_auto_approve": False,
    "require_client_manager_review": True,
    "description": "审批人仅留拼音，不可直接归为正常，留给客户经理复核",
}

NORMAL_NAME_ACTION = {
    "verdict": PinyinVerdict.NORMAL,
    "status": ReviewStatus.APPROVED,
    "allow_auto_approve": True,
    "require_client_manager_review": False,
    "description": "审批人含中文字符，流程正常推进",
}

AMBIGUOUS_NAME_ACTION = {
    "verdict": PinyinVerdict.AMBIGUOUS,
    "status": ReviewStatus.PINYIN_FLAGGED,
    "allow_auto_approve": False,
    "require_client_manager_review": False,
    "description": "审批人姓名模糊，需人工确认",
}

APPROVER_NAME_BOUNDARY_RULES = [
    {
        "condition": "name_contains_chinese",
        "pattern": r'[\u4e00-\u9fff]',
        "action": NORMAL_NAME_ACTION,
        "priority": 100,
    },
    {
        "condition": "name_is_pure_pinyin",
        "pattern": r'^[a-zA-Z\s]+$',
        "action": PINYIN_ONLY_ACTION,
        "priority": 90,
    },
    {
        "condition": "name_is_empty_or_mixed",
        "pattern": r'.*',
        "action": AMBIGUOUS_NAME_ACTION,
        "priority": 0,
    },
]

ROLLBACK_FIELD_HANDLERS = {
    "remark": "handle_remark_rollback",
    "approver_name": "handle_approver_name_rollback",
    "workflow_phase": "handle_workflow_phase_rollback",
    "status": "handle_status_rollback",
    "tax_notes": "handle_tax_notes_rollback",
    "counter_transactions": "handle_counter_transactions_rollback",
    "balance_entries": "handle_balance_entries_rollback",
}


class RebalanceReviewEngine:
    PINYIN_PATTERN = re.compile(r'^[a-zA-Z\s]+$')
    CHINESE_PATTERN = re.compile(r'[\u4e00-\u9fff]')

    def get_pinyin_boundary_rule(self, name: str) -> dict:
        if not name or not name.strip():
            return AMBIGUOUS_NAME_ACTION
        stripped = name.strip()
        for rule in sorted(APPROVER_NAME_BOUNDARY_RULES, key=lambda r: r["priority"], reverse=True):
            if re.search(rule["pattern"], stripped):
                return rule["action"]
        return AMBIGUOUS_NAME_ACTION

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
        return self.get_pinyin_boundary_rule(name)["verdict"]

    def evaluate_boundary(self, record: ReviewRecord) -> ReviewStatus:
        boundary_action = self.get_pinyin_boundary_rule(record.approver_name)
        record.approver_pinyin_verdict = boundary_action["verdict"]
        if boundary_action["require_client_manager_review"]:
            return ReviewStatus.AWAITING_CLIENT_MANAGER_REVIEW
        if boundary_action["verdict"] == PinyinVerdict.AMBIGUOUS:
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

    def describe_boundary_decision(self, name: str) -> str:
        action = self.get_pinyin_boundary_rule(name)
        return f"审批人 '{name}': {action['description']}"

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
        existing_fps_in_record = {n.content_fingerprint() for n in record.tax_notes}
        all_existing = existing_fps | existing_fps_in_record

        added: list[TaxRateNote] = []
        for note in notes:
            fp = note.content_fingerprint()
            if fp in all_existing:
                continue
            all_existing.add(fp)
            record.tax_notes.append(note)
            added.append(note)
            record.history.append(ChangeHistory(
                record_id=record.id,
                field_name="tax_notes",
                old_value="",
                new_value=f"{note.id}:{note.content_fingerprint()}",
                changed_by=operator,
                change_type="add",
            ))

        self._imported_fingerprints[record.id] = all_existing
        record.updated_at = datetime.now()
        return added

    def update_note_remark(self, record: ReviewRecord, note_id: str, new_remark: str, operator: str = "system") -> Optional[ChangeHistory]:
        for note in record.tax_notes:
            if note.id == note_id:
                old_remark = note.remark
                note.remark = new_remark
                history_entry = ChangeHistory(
                    record_id=record.id,
                    field_name="remark",
                    target_id=note_id,
                    old_value=old_remark,
                    new_value=new_remark,
                    changed_by=operator,
                    change_type="update",
                )
                record.history.append(history_entry)
                record.updated_at = datetime.now()
                return history_entry
        return None

    def update_approver_name(self, record: ReviewRecord, new_name: str, operator: str = "client_manager") -> ChangeHistory:
        old_name = record.approver_name
        old_verdict = record.approver_pinyin_verdict
        record.approver_name = new_name
        new_verdict = self.detect_pinyin(new_name)
        record.approver_pinyin_verdict = new_verdict
        history_entry = ChangeHistory(
            record_id=record.id,
            field_name="approver_name",
            old_value=f"{old_name} ({old_verdict.value})",
            new_value=f"{new_name} ({new_verdict.value})",
            changed_by=operator,
            change_type="pinyin_resolution",
        )
        record.history.append(history_entry)
        record.updated_at = datetime.now()
        return history_entry

    def handle_remark_rollback(self, record: ReviewRecord, history: ChangeHistory) -> None:
        if not history.target_id:
            return
        for note in record.tax_notes:
            if note.id == history.target_id:
                note.remark = history.old_value
                return

    def handle_approver_name_rollback(self, record: ReviewRecord, history: ChangeHistory) -> None:
        old_name = history.old_value.split(" (")[0]
        record.approver_name = old_name
        record.approver_pinyin_verdict = self.detect_pinyin(old_name)

    def handle_workflow_phase_rollback(self, record: ReviewRecord, history: ChangeHistory) -> None:
        old_phase = history.old_value
        for phase in WorkflowPhase:
            if phase.value == old_phase:
                record.workflow_phase = phase
                return

    def handle_status_rollback(self, record: ReviewRecord, history: ChangeHistory) -> None:
        old_status = history.old_value
        for status in ReviewStatus:
            if status.value == old_status:
                record.status = status
                return

    def handle_tax_notes_rollback(self, record: ReviewRecord, history: ChangeHistory) -> None:
        if history.change_type == "add":
            note_id = history.new_value.split(":")[0]
            record.tax_notes = [n for n in record.tax_notes if n.id != note_id]
            if record.id in self._imported_fingerprints:
                fp = history.new_value.split(":", 1)[1] if ":" in history.new_value else history.new_value
                self._imported_fingerprints[record.id].discard(fp)

    def handle_counter_transactions_rollback(self, record: ReviewRecord, history: ChangeHistory) -> None:
        if history.change_type == "add":
            tail_number = history.new_value
            record.counter_transactions = [tx for tx in record.counter_transactions if tx.tail_number != tail_number]

    def handle_balance_entries_rollback(self, record: ReviewRecord, history: ChangeHistory) -> None:
        if history.change_type == "add":
            entry_info = history.new_value
            account = entry_info.split(":")[0]
            record.balance_entries = [e for e in record.balance_entries if not e.account == account or entry_info not in str(e)]

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
            if h.change_type == "rollback":
                continue
            handler_name = ROLLBACK_FIELD_HANDLERS.get(h.field_name)
            if handler_name and hasattr(self, handler_name):
                handler = getattr(self, handler_name)
                handler(record, h)
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
        record.updated_at = datetime.now()
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
