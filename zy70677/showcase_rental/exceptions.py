from datetime import date, timedelta
from decimal import Decimal
from typing import List, Dict, Any, Set
from collections import defaultdict

from .models import (
    Contract,
    Showcase,
    LeasePeriod,
    AddCabinetRecord,
    DepositRecord,
    BillingPeriod,
    ValidationError,
    ValidationSeverity,
    SourceLocation,
)


class ContractValidator:
    def __init__(self):
        self.errors: List[ValidationError] = []

    def add_error(
        self,
        message: str,
        severity: ValidationSeverity,
        rule_code: str,
        source: SourceLocation,
        data_id: str = None,
    ):
        self.errors.append(
            ValidationError(
                message=message,
                severity=severity,
                rule_code=rule_code,
                source=source,
                data_id=data_id,
            )
        )

    def validate_contract_integrity(self, contracts: List[Contract]) -> None:
        contract_ids: Set[str] = set()

        for contract in contracts:
            if contract.contract_id in contract_ids:
                self.add_error(
                    f"重复的合同ID: {contract.contract_id}",
                    ValidationSeverity.ERROR,
                    "CONTRACT_DUPLICATE_ID",
                    contract.source,
                    contract.contract_id,
                )
            contract_ids.add(contract.contract_id)

            if contract.end_date < contract.start_date:
                self.add_error(
                    f"合同结束日期早于开始日期: {contract.start_date} -> {contract.end_date}",
                    ValidationSeverity.ERROR,
                    "CONTRACT_DATE_INVALID",
                    contract.source,
                    contract.contract_id,
                )

            if contract.daily_rate <= Decimal("0"):
                self.add_error(
                    f"合同日租金必须大于0: {contract.daily_rate}",
                    ValidationSeverity.ERROR,
                    "CONTRACT_RATE_INVALID",
                    contract.source,
                    contract.contract_id,
                )

            if contract.deposit_amount < Decimal("0"):
                self.add_error(
                    f"保证金额不能为负数: {contract.deposit_amount}",
                    ValidationSeverity.WARNING,
                    "CONTRACT_DEPOSIT_NEGATIVE",
                    contract.source,
                    contract.contract_id,
                )

            if contract.showcase_count <= 0:
                self.add_error(
                    f"展柜数量必须大于0: {contract.showcase_count}",
                    ValidationSeverity.ERROR,
                    "CONTRACT_SHOWCASE_COUNT_INVALID",
                    contract.source,
                    contract.contract_id,
                )

    def validate_showcase_integrity(
        self, showcases: List[Showcase], contracts: List[Contract]
    ) -> None:
        contract_ids = {c.contract_id for c in contracts}
        showcase_ids: Set[str] = set()
        showcase_count_by_contract: Dict[str, int] = defaultdict(int)

        for showcase in showcases:
            if showcase.showcase_id in showcase_ids:
                self.add_error(
                    f"重复的展柜ID: {showcase.showcase_id}",
                    ValidationSeverity.ERROR,
                    "SHOWCASE_DUPLICATE_ID",
                    showcase.source,
                    showcase.showcase_id,
                )
            showcase_ids.add(showcase.showcase_id)

            if showcase.contract_id not in contract_ids:
                self.add_error(
                    f"展柜关联的合同不存在: {showcase.contract_id}",
                    ValidationSeverity.ERROR,
                    "SHOWCASE_CONTRACT_NOT_FOUND",
                    showcase.source,
                    showcase.showcase_id,
                )

            showcase_count_by_contract[showcase.contract_id] += 1

        for contract in contracts:
            actual_count = showcase_count_by_contract.get(contract.contract_id, 0)
            if actual_count != contract.showcase_count:
                self.add_error(
                    f"合同展柜数量不匹配: 合同约定{contract.showcase_count}个, 实际{actual_count}个",
                    ValidationSeverity.WARNING,
                    "SHOWCASE_COUNT_MISMATCH",
                    contract.source,
                    contract.contract_id,
                )

    def validate_lease_integrity(
        self,
        lease_periods: List[LeasePeriod],
        contracts: List[Contract],
        showcases: List[Showcase],
    ) -> None:
        contract_ids = {c.contract_id for c in contracts}
        showcase_ids = {s.showcase_id for s in showcases}
        lease_ids: Set[str] = set()

        contract_map = {c.contract_id: c for c in contracts}

        for lease in lease_periods:
            if lease.lease_id in lease_ids:
                self.add_error(
                    f"重复的租期ID: {lease.lease_id}",
                    ValidationSeverity.ERROR,
                    "LEASE_DUPLICATE_ID",
                    lease.source,
                    lease.lease_id,
                )
            lease_ids.add(lease.lease_id)

            if lease.contract_id not in contract_ids:
                self.add_error(
                    f"租期关联的合同不存在: {lease.contract_id}",
                    ValidationSeverity.ERROR,
                    "LEASE_CONTRACT_NOT_FOUND",
                    lease.source,
                    lease.lease_id,
                )
                continue

            if lease.showcase_id not in showcase_ids:
                self.add_error(
                    f"租期关联的展柜不存在: {lease.showcase_id}",
                    ValidationSeverity.ERROR,
                    "LEASE_SHOWCASE_NOT_FOUND",
                    lease.source,
                    lease.lease_id,
                )

            contract = contract_map.get(lease.contract_id)
            if contract:
                if lease.start_date < contract.start_date:
                    self.add_error(
                        f"租期开始日期早于合同开始日期: 租期{lease.start_date}, 合同{contract.start_date}",
                        ValidationSeverity.WARNING,
                        "LEASE_START_BEFORE_CONTRACT",
                        lease.source,
                        lease.lease_id,
                    )

                lease_end = lease.effective_end_date
                if lease_end > contract.end_date:
                    self.add_error(
                        f"租期结束日期晚于合同结束日期: 租期{lease_end}, 合同{contract.end_date}",
                        ValidationSeverity.WARNING,
                        "LEASE_END_AFTER_CONTRACT",
                        lease.source,
                        lease.lease_id,
                    )

            if lease.actual_end_date and lease.end_date:
                if abs((lease.actual_end_date - lease.end_date).days) > 7:
                    self.add_error(
                        f"实际结束日期与约定结束日期差异较大: 约定{lease.end_date}, 实际{lease.actual_end_date}",
                        ValidationSeverity.INFO,
                        "LEASE_END_DATE_DIFF_LARGE",
                        lease.source,
                        lease.lease_id,
                    )

    def validate_add_cabinet_integrity(
        self,
        add_cabinet_records: List[AddCabinetRecord],
        contracts: List[Contract],
        showcases: List[Showcase],
    ) -> None:
        contract_ids = {c.contract_id for c in contracts}
        showcase_ids = {s.showcase_id for s in showcases}
        add_ids: Set[str] = set()

        contract_map = {c.contract_id: c for c in contracts}

        for add_record in add_cabinet_records:
            if add_record.add_id in add_ids:
                self.add_error(
                    f"重复的加柜ID: {add_record.add_id}",
                    ValidationSeverity.ERROR,
                    "ADD_CABINET_DUPLICATE_ID",
                    add_record.source,
                    add_record.add_id,
                )
            add_ids.add(add_record.add_id)

            if add_record.contract_id not in contract_ids:
                self.add_error(
                    f"加柜记录关联的合同不存在: {add_record.contract_id}",
                    ValidationSeverity.ERROR,
                    "ADD_CABINET_CONTRACT_NOT_FOUND",
                    add_record.source,
                    add_record.add_id,
                )
                continue

            if add_record.showcase_id not in showcase_ids:
                self.add_error(
                    f"加柜记录关联的展柜不存在: {add_record.showcase_id}",
                    ValidationSeverity.ERROR,
                    "ADD_CABINET_SHOWCASE_NOT_FOUND",
                    add_record.source,
                    add_record.add_id,
                )

            contract = contract_map.get(add_record.contract_id)
            if contract and not contract.allow_add_cabinet:
                self.add_error(
                    f"合同不允许加柜但有加柜记录: 合同{add_record.contract_id}",
                    ValidationSeverity.WARNING,
                    "ADD_CABINET_NOT_ALLOWED",
                    add_record.source,
                    add_record.add_id,
                )

            if add_record.remove_date and add_record.remove_date < add_record.add_date:
                self.add_error(
                    f"撤柜日期早于加柜日期: 加柜{add_record.add_date}, 撤柜{add_record.remove_date}",
                    ValidationSeverity.ERROR,
                    "ADD_CABINET_REMOVE_DATE_INVALID",
                    add_record.source,
                    add_record.add_id,
                )

    def validate_deposit_integrity(
        self, deposit_records: List[DepositRecord], contracts: List[Contract]
    ) -> None:
        contract_ids = {c.contract_id for c in contracts}
        deposit_ids: Set[str] = set()

        contract_map = {c.contract_id: c for c in contracts}

        deposit_balance: Dict[str, Decimal] = defaultdict(Decimal)

        for deposit in sorted(deposit_records, key=lambda d: d.transaction_date):
            if deposit.deposit_id in deposit_ids:
                self.add_error(
                    f"重复的保证金ID: {deposit.deposit_id}",
                    ValidationSeverity.ERROR,
                    "DEPOSIT_DUPLICATE_ID",
                    deposit.source,
                    deposit.deposit_id,
                )
            deposit_ids.add(deposit.deposit_id)

            if deposit.contract_id not in contract_ids:
                self.add_error(
                    f"保证金记录关联的合同不存在: {deposit.contract_id}",
                    ValidationSeverity.ERROR,
                    "DEPOSIT_CONTRACT_NOT_FOUND",
                    deposit.source,
                    deposit.deposit_id,
                )
                continue

            if deposit.amount < Decimal("0"):
                self.add_error(
                    f"保证金金额不能为负数: {deposit.amount}",
                    ValidationSeverity.WARNING,
                    "DEPOSIT_AMOUNT_NEGATIVE",
                    deposit.source,
                    deposit.deposit_id,
                )

            valid_types = ["DEPOSIT", "REFUND", "DEDUCTION"]
            if deposit.transaction_type not in valid_types:
                self.add_error(
                    f"未知的交易类型: {deposit.transaction_type}, 有效类型: {valid_types}",
                    ValidationSeverity.WARNING,
                    "DEPOSIT_TYPE_UNKNOWN",
                    deposit.source,
                    deposit.deposit_id,
                )

            if deposit.transaction_type == "DEPOSIT":
                deposit_balance[deposit.contract_id] += deposit.amount
            elif deposit.transaction_type in ["REFUND", "DEDUCTION"]:
                deposit_balance[deposit.contract_id] -= deposit.amount

            if deposit.is_refunded and not deposit.refund_date:
                self.add_error(
                    f"保证金标记为已退款但无退款日期",
                    ValidationSeverity.WARNING,
                    "DEPOSIT_REFUND_DATE_MISSING",
                    deposit.source,
                    deposit.deposit_id,
                )

        for contract in contracts:
            balance = deposit_balance.get(contract.contract_id, Decimal("0"))
            if balance < Decimal("0"):
                self.add_error(
                    f"合同保证金余额为负数: {balance}",
                    ValidationSeverity.WARNING,
                    "DEPOSIT_BALANCE_NEGATIVE",
                    contract.source,
                    contract.contract_id,
                )

            expected_deposit = contract.deposit_amount
            if abs(balance - expected_deposit) > Decimal("0.01"):
                self.add_error(
                    f"合同保证金余额与约定不符: 约定{expected_deposit}, 实际{balance}",
                    ValidationSeverity.INFO,
                    "DEPOSIT_BALANCE_MISMATCH",
                    contract.source,
                    contract.contract_id,
                )

    def validate_all(
        self,
        contracts: List[Contract],
        showcases: List[Showcase],
        lease_periods: List[LeasePeriod],
        add_cabinet_records: List[AddCabinetRecord],
        deposit_records: List[DepositRecord],
    ) -> List[ValidationError]:
        self.errors = []

        self.validate_contract_integrity(contracts)
        self.validate_showcase_integrity(showcases, contracts)
        self.validate_lease_integrity(lease_periods, contracts, showcases)
        self.validate_add_cabinet_integrity(add_cabinet_records, contracts, showcases)
        self.validate_deposit_integrity(deposit_records, contracts)

        return self.errors

    def get_error_summary(self) -> Dict[str, int]:
        summary = {"ERROR": 0, "WARNING": 0, "INFO": 0}
        for error in self.errors:
            summary[error.severity.value] += 1
        return summary
