from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Optional

from .models import (
    WithdrawalRecord, WithdrawalStatus, AuditItem, AuditReport,
    ExceptionRecord, ExceptionSeverity,
)


class WithdrawalError(Exception):
    def __init__(self, message: str, code: str = "", record: Optional[WithdrawalRecord] = None):
        super().__init__(message)
        self.code = code
        self.record = record


class WithdrawalService:
    def __init__(self):
        self.records: list[WithdrawalRecord] = []
        self._idempotency_cache: dict[str, WithdrawalRecord] = {}

    def request_withdrawal(
        self,
        driver_id: str,
        amount: float,
        idempotency_key: str,
        audit_item: AuditItem,
        reviewer: str = "",
    ) -> WithdrawalRecord:
        if idempotency_key in self._idempotency_cache:
            cached = self._idempotency_cache[idempotency_key]
            return cached

        if amount <= 0:
            raise WithdrawalError(
                f"提现金额必须大于0，当前: ¥{amount:.2f}",
                code="INVALID_AMOUNT",
            )

        if amount > audit_item.withdrawable:
            raise WithdrawalError(
                f"提现金额 ¥{amount:.2f} 超过可提现余额 ¥{audit_item.withdrawable:.2f}\n"
                f"  收入 ¥{audit_item.total_income:,.2f} + 奖励 ¥{audit_item.total_rewards:,.2f}"
                f" - 罚款 ¥{audit_item.total_fines:,.2f} - 冻结 ¥{audit_item.total_frozen:,.2f}"
                f" = 可提现 ¥{audit_item.withdrawable:,.2f}",
                code="INSUFFICIENT_BALANCE",
            )

        record = WithdrawalRecord(
            withdrawal_id=str(uuid.uuid4())[:12],
            driver_id=driver_id,
            amount=amount,
            request_date=date.today(),
            status=WithdrawalStatus.APPROVED,
            idempotency_key=idempotency_key,
            reviewer=reviewer,
            approved_at=datetime.now(),
        )
        self.records.append(record)
        self._idempotency_cache[idempotency_key] = record
        return record

    def rollback_withdrawal(
        self,
        withdrawal_id: str,
        reason: str = "",
        operator: str = "",
    ) -> WithdrawalRecord:
        record = self._find_record(withdrawal_id)
        if record.status != WithdrawalStatus.APPROVED and record.status != WithdrawalStatus.OVERRIDDEN:
            raise WithdrawalError(
                f"只能回滚已审核通过的提现单，当前状态: {record.status.value}",
                code="INVALID_STATUS",
                record=record,
            )

        original_status = record.status
        record.status = WithdrawalStatus.ROLLED_BACK
        record.review_note = f"回滚原因: {reason} | 操作人: {operator} | 原状态: {original_status.value}"

        if record.idempotency_key in self._idempotency_cache:
            del self._idempotency_cache[record.idempotency_key]

        return record

    def manual_override(
        self,
        withdrawal_id: str,
        new_amount: Optional[float] = None,
        force_approve: bool = False,
        reason: str = "",
        operator: str = "",
        audit_item: Optional[AuditItem] = None,
    ) -> WithdrawalRecord:
        record = self._find_record(withdrawal_id)
        if record.status not in (WithdrawalStatus.PENDING, WithdrawalStatus.REJECTED, WithdrawalStatus.ROLLED_BACK):
            raise WithdrawalError(
                f"当前状态 {record.status.value} 不允许人工覆盖",
                code="INVALID_STATUS",
                record=record,
            )

        override_notes = [f"人工覆盖 | 操作人: {operator} | 原因: {reason}"]

        if new_amount is not None:
            if new_amount <= 0:
                raise WithdrawalError("覆盖金额必须大于0", code="INVALID_AMOUNT")
            if audit_item and new_amount > audit_item.withdrawable and not force_approve:
                raise WithdrawalError(
                    f"覆盖金额 ¥{new_amount:.2f} 仍超过可提现余额 ¥{audit_item.withdrawable:.2f}，如需强制通过请使用 force_approve",
                    code="INSUFFICIENT_BALANCE",
                )
            override_notes.append(f"金额变更: ¥{record.amount:.2f} -> ¥{new_amount:.2f}")
            if force_approve and audit_item and new_amount > audit_item.withdrawable:
                override_notes.append(f"⚠️ 强制通过：覆盖金额超出可提现余额 ¥{new_amount - audit_item.withdrawable:.2f}")
            record.amount = new_amount

        record.status = WithdrawalStatus.OVERRIDDEN
        record.reviewer = operator
        record.approved_at = datetime.now()
        record.review_note = " | ".join(override_notes)

        return record

    def reject_withdrawal(
        self,
        withdrawal_id: str,
        reason: str = "",
        reviewer: str = "",
    ) -> WithdrawalRecord:
        record = self._find_record(withdrawal_id)
        if record.status != WithdrawalStatus.PENDING:
            raise WithdrawalError(
                f"只能拒绝待审核的提现单，当前状态: {record.status.value}",
                code="INVALID_STATUS",
                record=record,
            )
        record.status = WithdrawalStatus.REJECTED
        record.reviewer = reviewer
        record.review_note = f"拒绝原因: {reason}"
        return record

    def get_driver_withdrawals(self, driver_id: str) -> list[WithdrawalRecord]:
        return [r for r in self.records if r.driver_id == driver_id]

    def get_total_withdrawn(self, driver_id: str) -> float:
        return round(sum(
            r.amount for r in self.records
            if r.driver_id == driver_id and r.status in (WithdrawalStatus.APPROVED, WithdrawalStatus.OVERRIDDEN)
        ), 2)

    def _find_record(self, withdrawal_id: str) -> WithdrawalRecord:
        for r in self.records:
            if r.withdrawal_id == withdrawal_id:
                return r
        raise WithdrawalError(f"未找到提现单: {withdrawal_id}", code="NOT_FOUND")

    def format_withdrawal_result(self, record: WithdrawalRecord, audit_item: Optional[AuditItem] = None) -> str:
        status_emoji = {
            WithdrawalStatus.APPROVED: "✅",
            WithdrawalStatus.REJECTED: "❌",
            WithdrawalStatus.ROLLED_BACK: "↩️",
            WithdrawalStatus.OVERRIDDEN: "🔧",
            WithdrawalStatus.PENDING: "⏳",
        }
        emoji = status_emoji.get(record.status, "❓")
        status_cn = {
            WithdrawalStatus.APPROVED: "已通过",
            WithdrawalStatus.REJECTED: "已拒绝",
            WithdrawalStatus.ROLLED_BACK: "已回滚",
            WithdrawalStatus.OVERRIDDEN: "人工覆盖通过",
            WithdrawalStatus.PENDING: "待审核",
        }.get(record.status, record.status.value)

        lines = [
            f"{emoji} 提现审核结果",
            "─" * 40,
            f"  提现单号: {record.withdrawal_id}",
            f"  司机ID:   {record.driver_id}",
            f"  提现金额: ¥{record.amount:,.2f}",
            f"  审核状态: {status_cn}",
        ]

        if record.reviewer:
            lines.append(f"  审核人:   {record.reviewer}")
        if record.review_note:
            lines.append(f"  备注:     {record.review_note}")
        if record.approved_at:
            lines.append(f"  审核时间: {record.approved_at.strftime('%Y-%m-%d %H:%M:%S')}")

        if audit_item:
            remaining = round(audit_item.withdrawable - record.amount, 2)
            lines.append(f"  剩余可提现: ¥{remaining:,.2f}")
            if remaining < 0:
                lines.append(f"  ⚠️ 注意: 提现后余额为负，请核实")

        return "\n".join(lines)
