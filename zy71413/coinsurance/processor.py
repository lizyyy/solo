from datetime import datetime
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

from .models import (
    Policy,
    Claim,
    Bill,
    BillStatus,
    BillItem,
    ValidationResult,
    ValidationSeverity,
)
from .storage import Storage
from .calculator import CoInsuranceCalculator


class BillProcessor:
    def __init__(self, storage: Storage, calculator: Optional[CoInsuranceCalculator] = None):
        self.storage = storage
        self.calculator = calculator or CoInsuranceCalculator()
        self._bill_counter: Dict[str, int] = defaultdict(int)

    def _generate_bill_no(self, claim_no: str) -> str:
        self._bill_counter[claim_no] += 1
        count = self._bill_counter[claim_no]
        existing = self.storage.bills.filter(
            lambda b: b.claim_no == claim_no and b.bill_no.startswith(f"BILL-{claim_no}-")
        )
        if existing:
            max_count = max(int(b.bill_no.split("-")[-1]) for b in existing)
            count = max(count, max_count + 1)
        return f"BILL-{claim_no}-{count:03d}"

    def process_claim(self, claim: Claim) -> Bill:
        policy = self.storage.policies.get(claim.policy_no)
        if policy is None:
            bill_no = self._generate_bill_no(claim.claim_no)
            bill = Bill(
                bill_no=bill_no,
                claim_no=claim.claim_no,
                policy_no=claim.policy_no,
                claim_amount=claim.claim_amount or 0,
                deductible_amount=0,
                net_claim_amount=0,
                items=[],
                status=BillStatus.EXCEPTION,
                validation_results=[
                    ValidationResult(
                        field="policy_no",
                        severity=ValidationSeverity.ERROR,
                        message=f"找不到保单号: {claim.policy_no}",
                        code="POLICY_NOT_FOUND",
                    )
                ],
            )
            self.storage.bills.add(bill)
            self.storage.log_action(
                action="BILL_CREATED_EXCEPTION",
                bill_no=bill.bill_no,
                claim_no=claim.claim_no,
                details={"reason": "POLICY_NOT_FOUND"},
            )
            return bill

        existing_bills = self.storage.bills.filter(lambda b: b.claim_no == claim.claim_no)

        if len(existing_bills) > 0:
            last_bill = existing_bills[-1]
            bill_no = self._generate_bill_no(claim.claim_no)
            new_bill = self.calculator.create_bill(
                bill_no=bill_no,
                policy=policy,
                claim=claim,
                existing_bills=existing_bills,
            )
            new_bill.version = last_bill.version + 1
            new_bill.previous_version_bill_no = last_bill.bill_no
            new_bill.status = BillStatus.RESUBMITTED
            new_bill.validation_results.append(
                ValidationResult(
                    field="resubmit",
                    severity=ValidationSeverity.INFO,
                    message=f"重复提交，覆盖账单 {last_bill.bill_no}",
                    code="DUPLICATE_SUBMIT",
                )
            )
            self.storage.bills.add(new_bill)
            self.storage.log_action(
                action="BILL_RESUBMITTED",
                bill_no=new_bill.bill_no,
                claim_no=claim.claim_no,
                details={
                    "previous_bill": last_bill.bill_no,
                    "new_version": new_bill.version,
                },
            )
            return new_bill

        bill_no = self._generate_bill_no(claim.claim_no)
        bill = self.calculator.create_bill(
            bill_no=bill_no,
            policy=policy,
            claim=claim,
            existing_bills=existing_bills,
        )
        bill.processed_at = datetime.now()
        self.storage.bills.add(bill)
        self.storage.log_action(
            action="BILL_CREATED",
            bill_no=bill.bill_no,
            claim_no=claim.claim_no,
            details={"status": bill.status.value},
        )
        return bill

    def process_all_claims(self) -> Tuple[List[Bill], List[Bill], List[Bill]]:
        normal_bills: List[Bill] = []
        pending_bills: List[Bill] = []
        exception_bills: List[Bill] = []

        for claim in self.storage.claims.get_all():
            bill = self.process_claim(claim)
            if bill.status in [BillStatus.NORMAL, BillStatus.SUPPLEMENTED, BillStatus.RESUBMITTED]:
                normal_bills.append(bill)
            elif bill.status == BillStatus.PENDING:
                pending_bills.append(bill)
            else:
                exception_bills.append(bill)

        self.storage.log_action(
            action="BATCH_PROCESS_COMPLETED",
            details={
                "normal_count": len(normal_bills),
                "pending_count": len(pending_bills),
                "exception_count": len(exception_bills),
                "total_count": len(normal_bills) + len(pending_bills) + len(exception_bills),
            },
        )

        return normal_bills, pending_bills, exception_bills

    def withdraw_bill(self, bill_no: str, reason: str = "") -> Optional[Bill]:
        bill = self.storage.bills.get(bill_no)
        if bill is None:
            return None

        if bill.status == BillStatus.WITHDRAWN:
            return bill

        bill.status = BillStatus.WITHDRAWN
        bill.updated_at = datetime.now()
        bill.validation_results.append(
            ValidationResult(
                field="status",
                severity=ValidationSeverity.INFO,
                message=f"账单已撤回: {reason}",
                code="BILL_WITHDRAWN",
            )
        )
        self.storage.bills.update(bill)
        self.storage.log_action(
            action="BILL_WITHDRAWN",
            bill_no=bill_no,
            claim_no=bill.claim_no,
            details={"reason": reason},
        )
        return bill

    def confirm_bill(self, bill_no: str) -> Optional[Bill]:
        bill = self.storage.bills.get(bill_no)
        if bill is None:
            return None

        if bill.status in [BillStatus.EXCEPTION, BillStatus.WITHDRAWN]:
            return bill

        policy = self.storage.policies.get(bill.policy_no)
        if policy is None:
            return bill

        all_confirmed = True
        for item in bill.items:
            co_insurer = next(
                (c for c in policy.co_insurers if c.insurer_id == item.insurer_id), None
            )
            if co_insurer and not co_insurer.confirmed:
                all_confirmed = False
                break

        if not all_confirmed:
            bill.status = BillStatus.PENDING
        else:
            bill.status = BillStatus.NORMAL

        bill.updated_at = datetime.now()
        self.storage.bills.update(bill)
        self.storage.log_action(
            action="BILL_CONFIRMED",
            bill_no=bill_no,
            claim_no=bill.claim_no,
            details={"new_status": bill.status.value, "all_confirmed": all_confirmed},
        )
        return bill

    def confirm_insurer(
        self, bill_no: str, insurer_id: str
    ) -> Optional[Bill]:
        bill = self.storage.bills.get(bill_no)
        if bill is None:
            return None

        for item in bill.items:
            if item.insurer_id == insurer_id:
                item.confirmed = True
                item.confirmed_at = datetime.now()

        policy = self.storage.policies.get(bill.policy_no)
        if policy:
            for co_insurer in policy.co_insurers:
                if co_insurer.insurer_id == insurer_id:
                    co_insurer.confirmed = True
                    co_insurer.confirmed_at = datetime.now()
            self.storage.policies.update(policy)

        all_confirmed = all(item.confirmed for item in bill.items)
        if all_confirmed and bill.status == BillStatus.PENDING:
            has_errors = any(
                v.severity == ValidationSeverity.ERROR for v in bill.validation_results
            )
            if not has_errors:
                bill.status = BillStatus.NORMAL

        bill.updated_at = datetime.now()
        self.storage.bills.update(bill)
        self.storage.log_action(
            action="INSURER_CONFIRMED",
            bill_no=bill_no,
            details={"insurer_id": insurer_id, "all_confirmed": all_confirmed},
        )
        return bill

    def get_bills_by_status(self, status: BillStatus) -> List[Bill]:
        return self.storage.bills.filter(lambda b: b.status == status)

    def get_bills_by_claim(self, claim_no: str) -> List[Bill]:
        return self.storage.bills.filter(lambda b: b.claim_no == claim_no)

    def get_bills_by_policy(self, policy_no: str) -> List[Bill]:
        return self.storage.bills.filter(lambda b: b.policy_no == policy_no)

    def recalculate_bill(self, bill_no: str) -> Optional[Bill]:
        bill = self.storage.bills.get(bill_no)
        if bill is None:
            return None

        policy = self.storage.policies.get(bill.policy_no)
        claim = self.storage.claims.get(bill.claim_no)

        if policy is None or claim is None:
            return bill

        existing_bills = self.storage.bills.filter(
            lambda b: b.claim_no == bill.claim_no and b.bill_no != bill_no
        )

        new_bill = self.calculator.create_bill(
            bill_no=bill.bill_no,
            policy=policy,
            claim=claim,
            existing_bills=existing_bills,
        )
        new_bill.created_at = bill.created_at
        new_bill.version = bill.version + 1
        new_bill.previous_version_bill_no = bill.bill_no
        new_bill.processed_at = datetime.now()

        self.storage.bills.update(new_bill)
        self.storage.log_action(
            action="BILL_RECALCULATED",
            bill_no=bill_no,
            claim_no=bill.claim_no,
            details={"new_version": new_bill.version},
        )
        return new_bill
