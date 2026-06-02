import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from models import (
    TailAdjustmentEntry,
    CustodianConfirmation,
    AuditLog,
    ReconciliationResult,
    DividendStatus,
    AuditAction,
)


class MixedCurrencyDetector:
    HKD_PATTERNS = [r"HKD", r"HK\$", r"港币", r"港幣"]
    CNY_PATTERNS = [r"CNY", r"RMB", r"¥", r"人民币", r"人民幣"]

    @classmethod
    def detect(cls, amount_str: str) -> Tuple[bool, Optional[str], float]:
        has_hkd = any(re.search(p, amount_str, re.IGNORECASE) for p in cls.HKD_PATTERNS)
        has_cny = any(re.search(p, amount_str, re.IGNORECASE) for p in cls.CNY_PATTERNS)

        amount = cls._extract_amount(amount_str)

        if has_hkd and has_cny:
            return True, None, amount
        elif has_hkd:
            return False, "HKD", amount
        elif has_cny:
            return False, "CNY", amount
        else:
            return False, None, amount

    @staticmethod
    def _extract_amount(amount_str: str) -> float:
        match = re.search(r"[\d,]+\.?\d*", amount_str)
        if match:
            num_str = match.group().replace(",", "")
            return float(num_str)
        return 0.0


class ReconciliationEngine:
    def __init__(self):
        self.entries: Dict[str, TailAdjustmentEntry] = {}
        self.confirmations: Dict[str, CustodianConfirmation] = {}
        self.audit_logs: List[AuditLog] = []
        self._log_counter = 0

    def _add_audit_log(
        self,
        entry_id: str,
        action: AuditAction,
        operator: str,
        before_status: Optional[DividendStatus] = None,
        after_status: Optional[DividendStatus] = None,
        remark: str = "",
    ) -> None:
        self._log_counter += 1
        log = AuditLog(
            id=f"AUD{self._log_counter:04d}",
            entry_id=entry_id,
            action=action,
            timestamp=datetime.now(),
            operator=operator,
            before_status=before_status,
            after_status=after_status,
            remark=remark,
        )
        self.audit_logs.append(log)

    def import_tail_adjustment(self, entry: TailAdjustmentEntry, operator: str = "阿芬") -> None:
        self.entries[entry.id] = entry
        self._add_audit_log(
            entry_id=entry.id,
            action=AuditAction.IMPORT,
            operator=operator,
            before_status=None,
            after_status=DividendStatus.PENDING,
            remark=f"导入尾差调整条：{entry.stock_name}({entry.stock_code})",
        )

    def process_entry(self, entry_id: str, operator: str = "阿芬", force: bool = False) -> None:
        entry = self.entries.get(entry_id)
        if not entry:
            return

        if not force and entry.status in [DividendStatus.ADJUSTED, DividendStatus.OLD_STANDARD, DividendStatus.MATCHED]:
            if entry.status == DividendStatus.ADJUSTED:
                self._add_audit_log(
                    entry_id=entry_id,
                    action=AuditAction.RERUN,
                    operator=operator,
                    before_status=entry.status,
                    after_status=entry.status,
                    remark="重跑跳过：该记录已人工修正，保留原有结果",
                )
            elif entry.status == DividendStatus.OLD_STANDARD:
                self._add_audit_log(
                    entry_id=entry_id,
                    action=AuditAction.RERUN,
                    operator=operator,
                    before_status=entry.status,
                    after_status=entry.status,
                    remark="重跑跳过：该记录为旧口径补录，保留原有结果",
                )
            return

        before_status = entry.status
        has_mixed, currency, amount = MixedCurrencyDetector.detect(entry.amount_str)
        entry.amount = amount
        entry.currency = currency
        entry.has_mixed_currency = has_mixed

        if has_mixed:
            entry.status = DividendStatus.MIXED_CURRENCY
            entry.remark = "检测到港币和人民币在同一列，需托管对接人复核"
            self._add_audit_log(
                entry_id=entry_id,
                action=AuditAction.CURRENCY_FLAG,
                operator=operator,
                before_status=before_status,
                after_status=DividendStatus.MIXED_CURRENCY,
                remark="系统自动检测到港币人民币同列，暂停自动对账，留待托管复核",
            )
        elif currency and amount > 0:
            entry.status = DividendStatus.MATCHED
            self._add_audit_log(
                entry_id=entry_id,
                action=AuditAction.COMPLETE,
                operator=operator,
                before_status=before_status,
                after_status=DividendStatus.MATCHED,
                remark=f"自动对账完成，金额{currency} {amount:,.2f}",
            )
        else:
            entry.status = DividendStatus.NEEDS_CONFIRMATION
            entry.remark = "币别或金额不明确，等待托管确认页"

    def add_custodian_confirmation(
        self, confirmation: CustodianConfirmation, operator: str = "阿芬"
    ) -> None:
        self.confirmations[confirmation.entry_id] = confirmation
        entry = self.entries.get(confirmation.entry_id)
        if not entry:
            return

        before_status = entry.status

        if confirmation.is_old_standard:
            entry.currency = confirmation.confirmed_currency
            entry.amount = confirmation.confirmed_amount
            entry.status = DividendStatus.OLD_STANDARD
            entry.remark = f"托管确认页补录旧口径数据：{confirmation.custodian_remark}"
        elif confirmation.confirmed_currency:
            entry.currency = confirmation.confirmed_currency
            entry.amount = confirmation.confirmed_amount
            entry.status = DividendStatus.MATCHED
            entry.has_mixed_currency = False
            entry.remark = "托管确认后对账完成"

        self._add_audit_log(
            entry_id=confirmation.entry_id,
            action=AuditAction.ADD_CONFIRMATION,
            operator=operator,
            before_status=before_status,
            after_status=entry.status,
            remark=f"补录托管确认页，确认金额{confirmation.confirmed_currency} {confirmation.confirmed_amount:,.2f}",
        )

    def manual_correct(
        self, entry_id: str, new_currency: str, new_amount: float, operator: str = "阿芬"
    ) -> None:
        entry = self.entries.get(entry_id)
        if not entry:
            return

        before_status = entry.status
        old_currency = entry.currency
        old_amount = entry.amount

        entry.currency = new_currency
        entry.amount = new_amount
        entry.has_mixed_currency = False
        entry.status = DividendStatus.ADJUSTED
        entry.remark = f"人工修正：{old_currency} {old_amount:,.2f} → {new_currency} {new_amount:,.2f}"

        self._add_audit_log(
            entry_id=entry_id,
            action=AuditAction.MANUAL_CORRECT,
            operator=operator,
            before_status=before_status,
            after_status=DividendStatus.ADJUSTED,
            remark=f"人工修正币别金额，原{old_currency} {old_amount:,.2f}，现{new_currency} {new_amount:,.2f}",
        )

    def rerun_reconciliation(self, entry_id: str, operator: str = "阿芬") -> None:
        entry = self.entries.get(entry_id)
        if not entry:
            return

        before_status = entry.status
        self._add_audit_log(
            entry_id=entry_id,
            action=AuditAction.RERUN,
            operator=operator,
            before_status=before_status,
            after_status=None,
            remark="执行重跑对账流程",
        )

        self.process_entry(entry_id, operator)

    def get_entry_audit_trail(self, entry_id: str) -> List[AuditLog]:
        return [log for log in self.audit_logs if log.entry_id == entry_id]

    def generate_result(self, entry_id: str) -> Optional[ReconciliationResult]:
        entry = self.entries.get(entry_id)
        if not entry:
            return None

        confirmation = self.confirmations.get(entry_id)
        is_old_standard = confirmation.is_old_standard if confirmation else False

        conclusion = self._generate_conclusion(entry, is_old_standard)

        return ReconciliationResult(
            entry_id=entry.id,
            stock_code=entry.stock_code,
            stock_name=entry.stock_name,
            final_amount=entry.amount,
            final_currency=entry.currency or "未确认",
            status=entry.status,
            is_mixed_currency=entry.has_mixed_currency,
            is_old_standard=is_old_standard,
            audit_trail=self.get_entry_audit_trail(entry_id),
            conclusion=conclusion,
        )

    def _generate_conclusion(self, entry: TailAdjustmentEntry, is_old_standard: bool) -> str:
        if is_old_standard:
            return "【旧口径补录】该笔股息来自托管确认页补充的历史数据，按旧口径入账处理"
        elif entry.has_mixed_currency:
            return "【托管待复核】港币和人民币标注在同一列，已暂停自动处理，等托管对接人明确币别后再继续"
        elif entry.status == DividendStatus.MATCHED:
            return f"【顺利完成】{entry.currency} {entry.amount:,.2f} 自动对账通过，无异常"
        elif entry.status == DividendStatus.ADJUSTED:
            return f"【尾差调整】经人工核对后调整为 {entry.currency} {entry.amount:,.2f}，已同步审计轨迹"
        else:
            return "【处理中】等待后续确认或修正"

    def get_all_results(self) -> List[ReconciliationResult]:
        return [self.generate_result(eid) for eid in self.entries.keys() if self.generate_result(eid)]
