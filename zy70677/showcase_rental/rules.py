from datetime import date, timedelta
from decimal import Decimal
from typing import List, Dict, Any, Tuple, Optional
from collections import defaultdict

from .models import (
    Contract,
    Showcase,
    LeasePeriod,
    AddCabinetRecord,
    DepositRecord,
    BillingPeriod,
    SourceLocation,
)


class RuleEngine:
    def __init__(self):
        pass

    def calculate_days_between(self, start: date, end: date) -> int:
        if end < start:
            return 0
        return (end - start).days + 1

    def split_lease_by_billing_cycle(
        self, lease: LeasePeriod, contract: Contract
    ) -> List[Tuple[date, date]]:
        periods = []
        current_start = lease.start_date
        lease_end = lease.effective_end_date

        if current_start > lease_end:
            return periods

        while current_start <= lease_end:
            cycle_end = current_start + timedelta(days=contract.billing_cycle_days - 1)
            current_end = min(cycle_end, lease_end)
            periods.append((current_start, current_end))
            current_start = current_end + timedelta(days=1)

        return periods

    def get_add_cabinet_rate(self, add_record: AddCabinetRecord, contract: Contract) -> Decimal:
        if add_record.daily_rate_override is not None:
            return add_record.daily_rate_override
        if contract.add_cabinet_daily_rate is not None:
            return contract.add_cabinet_daily_rate
        return contract.daily_rate

    def calculate_add_cabinet_days_in_period(
        self, add_record: AddCabinetRecord, period_start: date, period_end: date
    ) -> int:
        add_start = add_record.add_date
        add_end = add_record.remove_date or date.max

        effective_start = max(add_start, period_start)
        effective_end = min(add_end, period_end)

        return self.calculate_days_between(effective_start, effective_end)

    def calculate_deposit_available(
        self, contract_id: str, deposit_records: List[DepositRecord]
    ) -> Decimal:
        total = Decimal("0")
        for record in deposit_records:
            if record.contract_id == contract_id:
                if record.transaction_type == "DEPOSIT":
                    total += record.amount
                elif record.transaction_type == "REFUND":
                    total -= record.amount
                elif record.transaction_type == "DEDUCTION":
                    total -= record.amount
        return total

    def process_contract_billing(
        self,
        contract: Contract,
        leases: List[LeasePeriod],
        add_cabinets: List[AddCabinetRecord],
        deposit_records: List[DepositRecord],
    ) -> List[BillingPeriod]:
        billing_periods = []
        contract_leases = [l for l in leases if l.contract_id == contract.contract_id]
        contract_adds = [a for a in add_cabinets if a.contract_id == contract.contract_id]

        period_counter = 1

        for lease in contract_leases:
            lease_periods = self.split_lease_by_billing_cycle(lease, contract)

            for period_start, period_end in lease_periods:
                base_days = self.calculate_days_between(period_start, period_end)
                base_amount = Decimal(base_days) * contract.daily_rate

                add_cabinet_days = 0
                add_cabinet_amount = Decimal("0")
                add_details = []

                for add_record in contract_adds:
                    if add_record.showcase_id == lease.showcase_id:
                        days = self.calculate_add_cabinet_days_in_period(
                            add_record, period_start, period_end
                        )
                        if days > 0:
                            rate = self.get_add_cabinet_rate(add_record, contract)
                            amount = Decimal(days) * rate
                            add_cabinet_days += days
                            add_cabinet_amount += amount
                            add_details.append(
                                {
                                    "add_id": add_record.add_id,
                                    "days": days,
                                    "rate": str(rate),
                                    "amount": str(amount),
                                }
                            )

                deposit_available = self.calculate_deposit_available(
                    contract.contract_id, deposit_records
                )
                total_before_deduction = base_amount + add_cabinet_amount

                deposit_deduction = min(deposit_available, total_before_deduction)
                total_amount = total_before_deduction - deposit_deduction

                billing_period = BillingPeriod(
                    period_id=f"{contract.contract_id}-{period_counter:03d}",
                    contract_id=contract.contract_id,
                    start_date=period_start,
                    end_date=period_end,
                    base_days=base_days,
                    base_amount=base_amount,
                    add_cabinet_days=add_cabinet_days,
                    add_cabinet_amount=add_cabinet_amount,
                    deposit_deduction=deposit_deduction,
                    total_amount=total_amount,
                    details=[
                        {
                            "lease_id": lease.lease_id,
                            "showcase_id": lease.showcase_id,
                            "add_details": add_details,
                        }
                    ],
                    source=SourceLocation(
                        file_name="rule_engine",
                        sheet_name="billing",
                        row_number=period_counter,
                    ),
                )
                billing_periods.append(billing_period)
                period_counter += 1

        return billing_periods

    def process_all_billing(
        self,
        contracts: List[Contract],
        lease_periods: List[LeasePeriod],
        add_cabinet_records: List[AddCabinetRecord],
        deposit_records: List[DepositRecord],
    ) -> List[BillingPeriod]:
        all_billing = []
        for contract in contracts:
            billing = self.process_contract_billing(
                contract, lease_periods, add_cabinet_records, deposit_records
            )
            all_billing.extend(billing)
        return all_billing

    def generate_summary(
        self,
        contracts: List[Contract],
        showcases: List[Showcase],
        lease_periods: List[LeasePeriod],
        add_cabinet_records: List[AddCabinetRecord],
        deposit_records: List[DepositRecord],
        billing_periods: List[BillingPeriod],
    ) -> Dict[str, Any]:
        summary = {
            "total_contracts": len(contracts),
            "total_showcases": len(showcases),
            "total_lease_periods": len(lease_periods),
            "total_add_cabinet_records": len(add_cabinet_records),
            "total_deposit_records": len(deposit_records),
            "total_billing_periods": len(billing_periods),
            "contracts_summary": [],
            "grand_totals": {
                "base_days": 0,
                "base_amount": "0",
                "add_cabinet_days": 0,
                "add_cabinet_amount": "0",
                "deposit_deduction": "0",
                "total_amount": "0",
            },
        }

        grand_base_days = 0
        grand_base_amount = Decimal("0")
        grand_add_days = 0
        grand_add_amount = Decimal("0")
        grand_deposit_deduction = Decimal("0")
        grand_total = Decimal("0")

        for contract in contracts:
            contract_billing = [b for b in billing_periods if b.contract_id == contract.contract_id]

            total_base_days = sum(b.base_days for b in contract_billing)
            total_base_amount = sum(b.base_amount for b in contract_billing)
            total_add_days = sum(b.add_cabinet_days for b in contract_billing)
            total_add_amount = sum(b.add_cabinet_amount for b in contract_billing)
            total_deposit_deduction = sum(b.deposit_deduction for b in contract_billing)
            total_amount = sum(b.total_amount for b in contract_billing)

            deposit_balance = self.calculate_deposit_available(contract.contract_id, deposit_records)

            summary["contracts_summary"].append(
                {
                    "contract_id": contract.contract_id,
                    "merchant_name": contract.merchant_name,
                    "billing_periods": len(contract_billing),
                    "total_base_days": total_base_days,
                    "total_base_amount": str(total_base_amount),
                    "total_add_cabinet_days": total_add_days,
                    "total_add_cabinet_amount": str(total_add_amount),
                    "total_deposit_deduction": str(total_deposit_deduction),
                    "total_amount": str(total_amount),
                    "deposit_balance": str(deposit_balance),
                }
            )

            grand_base_days += total_base_days
            grand_base_amount += total_base_amount
            grand_add_days += total_add_days
            grand_add_amount += total_add_amount
            grand_deposit_deduction += total_deposit_deduction
            grand_total += total_amount

        summary["grand_totals"] = {
            "base_days": grand_base_days,
            "base_amount": str(grand_base_amount),
            "add_cabinet_days": grand_add_days,
            "add_cabinet_amount": str(grand_add_amount),
            "deposit_deduction": str(grand_deposit_deduction),
            "total_amount": str(grand_total),
        }

        return summary
