from datetime import datetime
from typing import Optional
from .models import (
    ReviewRecord,
    TaxRateNote,
    CounterTransaction,
    BalanceChangeEntry,
    ChangeHistory,
    WorkflowPhase,
    ReviewStatus,
    PinyinVerdict,
)
from .engine import RebalanceReviewEngine


class WorkflowError(Exception):
    pass


class PinyinInterceptError(WorkflowError):
    def __init__(self, record_id: str, approver_name: str):
        self.record_id = record_id
        self.approver_name = approver_name
        super().__init__(
            f"审批人 '{approver_name}' 仅有拼音，不可直接归为正常，"
            f"需留给客户经理复核 (record={record_id})"
        )


PHASE_TRANSITIONS = {
    WorkflowPhase.TAX_RATE_IMPORT: WorkflowPhase.COUNTER_TRANSACTION_CHECK,
    WorkflowPhase.COUNTER_TRANSACTION_CHECK: WorkflowPhase.BALANCE_UPDATE,
    WorkflowPhase.BALANCE_UPDATE: WorkflowPhase.COMPLETED,
}


class RebalanceWorkflow:
    def __init__(self, engine: RebalanceReviewEngine):
        self.engine = engine

    def step_import_tax_notes(
        self,
        record: ReviewRecord,
        notes: list[TaxRateNote],
        operator: str = "system",
    ) -> list[TaxRateNote]:
        if record.workflow_phase != WorkflowPhase.TAX_RATE_IMPORT:
            raise WorkflowError(
                f"当前阶段为 {record.workflow_phase.value}，无法执行税费率备注导入"
            )

        added = self.engine.import_tax_notes(record, notes, operator)

        verdict = self.engine.detect_pinyin(record.approver_name)
        if verdict == PinyinVerdict.PINYIN_ONLY:
            record.approver_pinyin_verdict = verdict
            record.status = ReviewStatus.AWAITING_CLIENT_MANAGER_REVIEW
            record.history.append(ChangeHistory(
                record_id=record.id,
                field_name="workflow",
                old_value=WorkflowPhase.TAX_RATE_IMPORT.value,
                new_value="pinyin_intercepted",
                changed_by=operator,
                change_type="intercept",
            ))
            raise PinyinInterceptError(record.id, record.approver_name)

        record.workflow_phase = PHASE_TRANSITIONS[WorkflowPhase.TAX_RATE_IMPORT]
        record.status = self.engine.evaluate_boundary(record)
        record.history.append(ChangeHistory(
            record_id=record.id,
            field_name="workflow_phase",
            old_value=WorkflowPhase.TAX_RATE_IMPORT.value,
            new_value=record.workflow_phase.value,
            changed_by=operator,
            change_type="transition",
        ))
        record.updated_at = datetime.now()
        return added

    def step_check_counter_transactions(
        self,
        record: ReviewRecord,
        transactions: list[CounterTransaction],
        operator: str = "risk_control",
    ) -> list[CounterTransaction]:
        if record.workflow_phase != WorkflowPhase.COUNTER_TRANSACTION_CHECK:
            raise WorkflowError(
                f"当前阶段为 {record.workflow_phase.value}，无法执行柜台流水尾号补看"
            )

        if record.approver_pinyin_verdict == PinyinVerdict.PINYIN_ONLY:
            record.status = ReviewStatus.AWAITING_CLIENT_MANAGER_REVIEW
            raise PinyinInterceptError(record.id, record.approver_name)

        added: list[CounterTransaction] = []
        for tx in transactions:
            record.counter_transactions.append(tx)
            added.append(tx)
            record.history.append(ChangeHistory(
                record_id=record.id,
                field_name="counter_transactions",
                old_value="",
                new_value=tx.tail_number,
                changed_by=operator,
                change_type="add",
            ))

        record.workflow_phase = PHASE_TRANSITIONS[WorkflowPhase.COUNTER_TRANSACTION_CHECK]
        record.status = self.engine.evaluate_boundary(record)
        record.history.append(ChangeHistory(
            record_id=record.id,
            field_name="workflow_phase",
            old_value=WorkflowPhase.COUNTER_TRANSACTION_CHECK.value,
            new_value=record.workflow_phase.value,
            changed_by=operator,
            change_type="transition",
        ))
        record.updated_at = datetime.now()
        return added

    def step_update_balance(
        self,
        record: ReviewRecord,
        entries: list[BalanceChangeEntry],
        operator: str = "system",
    ) -> list[BalanceChangeEntry]:
        if record.workflow_phase != WorkflowPhase.BALANCE_UPDATE:
            raise WorkflowError(
                f"当前阶段为 {record.workflow_phase.value}，无法执行余额变化表更新"
            )

        if record.approver_pinyin_verdict == PinyinVerdict.PINYIN_ONLY:
            record.status = ReviewStatus.AWAITING_CLIENT_MANAGER_REVIEW
            raise PinyinInterceptError(record.id, record.approver_name)

        added: list[BalanceChangeEntry] = []
        for entry in entries:
            record.balance_entries.append(entry)
            added.append(entry)
            record.history.append(ChangeHistory(
                record_id=record.id,
                field_name="balance_entries",
                old_value="",
                new_value=f"{entry.account}:{entry.before_balance}->{entry.after_balance}",
                changed_by=operator,
                change_type="add",
            ))

        record.workflow_phase = WorkflowPhase.COMPLETED
        record.status = self.engine.evaluate_boundary(record)
        if record.status == ReviewStatus.APPROVED and record.approver_pinyin_verdict != PinyinVerdict.NORMAL:
            record.status = ReviewStatus.AWAITING_CLIENT_MANAGER_REVIEW
        record.history.append(ChangeHistory(
            record_id=record.id,
            field_name="workflow_phase",
            old_value=WorkflowPhase.BALANCE_UPDATE.value,
            new_value=WorkflowPhase.COMPLETED.value,
            changed_by=operator,
            change_type="transition",
        ))
        record.updated_at = datetime.now()
        return added

    def resolve_pinyin_flag(
        self,
        record: ReviewRecord,
        confirmed_name: str,
        operator: str = "client_manager",
    ) -> None:
        old_name = record.approver_name
        record.approver_name = confirmed_name
        record.approver_pinyin_verdict = self.engine.detect_pinyin(confirmed_name)

        record.history.append(ChangeHistory(
            record_id=record.id,
            field_name="approver_name",
            old_value=old_name,
            new_value=confirmed_name,
            changed_by=operator,
            change_type="pinyin_resolution",
        ))

        if record.approver_pinyin_verdict == PinyinVerdict.NORMAL:
            record.status = ReviewStatus.PENDING
            record.history.append(ChangeHistory(
                record_id=record.id,
                field_name="status",
                old_value=ReviewStatus.AWAITING_CLIENT_MANAGER_REVIEW.value,
                new_value=ReviewStatus.PENDING.value,
                changed_by=operator,
                change_type="pinyin_resolution",
            ))

        record.updated_at = datetime.now()
