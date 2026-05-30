import pytest
from datetime import datetime, timedelta

from coinsurance.models import (
    Policy,
    Claim,
    CoInsurer,
    BillStatus,
    ValidationSeverity,
)
from coinsurance.calculator import CoInsuranceCalculator


@pytest.fixture
def calculator():
    return CoInsuranceCalculator()


@pytest.fixture
def sample_policy():
    now = datetime.now()
    return Policy(
        policy_no="TEST-POL-001",
        policy_name="测试保单",
        effective_date=now - timedelta(days=365),
        expiry_date=now + timedelta(days=365),
        total_sum_insured=1000000.0,
        deductible=50000.0,
        co_insurers=[
            CoInsurer(
                insurer_id="INS-001",
                insurer_name="主承保",
                is_leader=True,
                share_ratio=0.6,
                confirmed=True,
            ),
            CoInsurer(
                insurer_id="INS-002",
                insurer_name="从承保1",
                is_leader=False,
                share_ratio=0.3,
                confirmed=True,
            ),
            CoInsurer(
                insurer_id="INS-003",
                insurer_name="从承保2",
                is_leader=False,
                share_ratio=0.1,
                confirmed=True,
            ),
        ],
    )


@pytest.fixture
def sample_claim(sample_policy):
    now = datetime.now()
    return Claim(
        claim_no="TEST-CLM-001",
        policy_no=sample_policy.policy_no,
        claim_amount=500000.0,
        reported_date=now - timedelta(days=30),
        accident_date=now - timedelta(days=45),
        loss_description="测试损失",
    )


class TestValidateRatio:
    def test_normal_ratio_closed(self, calculator, sample_policy):
        results = calculator.validate_ratio(sample_policy.co_insurers)
        assert len(results) == 0

    def test_ratio_not_closed(self, calculator):
        co_insurers = [
            CoInsurer(
                insurer_id="INS-001",
                insurer_name="主承保",
                is_leader=True,
                share_ratio=0.6,
                confirmed=True,
            ),
            CoInsurer(
                insurer_id="INS-002",
                insurer_name="从承保",
                is_leader=False,
                share_ratio=0.3,
                confirmed=True,
            ),
        ]
        results = calculator.validate_ratio(co_insurers)
        assert len(results) == 1
        assert results[0].code == "RATIO_NOT_CLOSED"
        assert results[0].severity == ValidationSeverity.ERROR

    def test_ratio_negative(self, calculator):
        co_insurers = [
            CoInsurer(
                insurer_id="INS-001",
                insurer_name="主承保",
                is_leader=True,
                share_ratio=0.5,
                confirmed=True,
            ),
            CoInsurer(
                insurer_id="INS-002",
                insurer_name="从承保",
                is_leader=False,
                share_ratio=-0.1,
                confirmed=True,
            ),
            CoInsurer(
                insurer_id="INS-003",
                insurer_name="从承保2",
                is_leader=False,
                share_ratio=0.6,
                confirmed=True,
            ),
        ]
        results = calculator.validate_ratio(co_insurers)
        assert any(r.code == "RATIO_NEGATIVE" for r in results)

    def test_ratio_exceeds_100(self, calculator):
        co_insurers = [
            CoInsurer(
                insurer_id="INS-001",
                insurer_name="主承保",
                is_leader=True,
                share_ratio=1.5,
                confirmed=True,
            ),
            CoInsurer(
                insurer_id="INS-002",
                insurer_name="从承保",
                is_leader=False,
                share_ratio=0.5,
                confirmed=True,
            ),
        ]
        results = calculator.validate_ratio(co_insurers)
        assert any(r.code == "RATIO_EXCEEDED" for r in results)


class TestValidateDeductible:
    def test_normal_deductible(self, calculator, sample_policy, sample_claim):
        results = calculator.validate_deductible(sample_policy, sample_claim, [])
        assert not any(r.severity == ValidationSeverity.ERROR for r in results)

    def test_zero_deductible(self, calculator, sample_policy, sample_claim):
        sample_policy.deductible = 0.0
        results = calculator.validate_deductible(sample_policy, sample_claim, [])
        assert any(r.code == "DEDUCTIBLE_ZERO" for r in results)
        assert results[0].severity == ValidationSeverity.WARNING

    def test_deductible_mismatch(self, calculator, sample_policy, sample_claim):
        sample_claim.deductible_applied = 30000.0
        results = calculator.validate_deductible(sample_policy, sample_claim, [])
        assert any(r.code == "DEDUCTIBLE_MISMATCH" for r in results)

    def test_zero_claim_amount(self, calculator, sample_policy, sample_claim):
        sample_claim.claim_amount = 0.0
        results = calculator.validate_deductible(sample_policy, sample_claim, [])
        assert any(r.code == "CLAIM_AMOUNT_ZERO" for r in results)
        assert any(r.severity == ValidationSeverity.ERROR for r in results)

    def test_deductible_waived(self, calculator, sample_policy, sample_claim):
        sample_claim.deductible_waived = True
        results = calculator.validate_deductible(sample_policy, sample_claim, [])
        assert any(r.code == "DEDUCTIBLE_WAIVED" for r in results)

    def test_duplicate_deductible(self, calculator, sample_policy, sample_claim):
        from coinsurance.models import Bill, BillItem
        existing_bill = Bill(
            bill_no="EXISTING-BILL",
            claim_no=sample_claim.claim_no,
            policy_no=sample_policy.policy_no,
            claim_amount=100000.0,
            deductible_amount=50000.0,
            net_claim_amount=50000.0,
            items=[],
            status=BillStatus.NORMAL,
        )
        results = calculator.validate_deductible(sample_policy, sample_claim, [existing_bill])
        assert any(r.code == "DEDUCTIBLE_DUPLICATE" for r in results)
        assert any(r.severity == ValidationSeverity.ERROR for r in results)


class TestValidateConfirmations:
    def test_all_confirmed(self, calculator, sample_policy):
        for c in sample_policy.co_insurers:
            c.confirmed = True
        results, all_confirmed = calculator.validate_confirmations(sample_policy.co_insurers)
        assert len(results) == 0
        assert all_confirmed is True

    def test_follower_not_confirmed(self, calculator, sample_policy):
        sample_policy.co_insurers[1].confirmed = False
        results, all_confirmed = calculator.validate_confirmations(sample_policy.co_insurers)
        assert any(r.code == "FOLLOWER_NOT_CONFIRMED" for r in results)
        assert any(r.severity == ValidationSeverity.WARNING for r in results)
        assert all_confirmed is False

    def test_leader_not_confirmed(self, calculator, sample_policy):
        sample_policy.co_insurers[0].confirmed = False
        results, all_confirmed = calculator.validate_confirmations(sample_policy.co_insurers)
        assert any(r.code == "LEADER_NOT_CONFIRMED" for r in results)
        assert all_confirmed is False


class TestValidateRequiredFields:
    def test_all_fields_present(self, calculator, sample_policy, sample_claim):
        results = calculator.validate_required_fields(sample_policy, sample_claim)
        assert len(results) == 0

    def test_missing_policy_field(self, calculator, sample_policy, sample_claim):
        sample_policy.policy_name = ""
        results = calculator.validate_required_fields(sample_policy, sample_claim)
        assert any(r.code == "MISSING_FIELD" for r in results)
        assert "policy.policy_name" in [r.field for r in results]

    def test_missing_claim_field(self, calculator, sample_policy, sample_claim):
        sample_claim.loss_description = ""
        results = calculator.validate_required_fields(sample_policy, sample_claim)
        assert any(r.code == "MISSING_FIELD" for r in results)
        assert "claim.loss_description" in [r.field for r in results]

    def test_accident_before_effective(self, calculator, sample_policy, sample_claim):
        sample_claim.accident_date = sample_policy.effective_date - timedelta(days=1)
        results = calculator.validate_required_fields(sample_policy, sample_claim)
        assert any(r.code == "ACCIDENT_BEFORE_EFFECTIVE" for r in results)

    def test_accident_after_expiry(self, calculator, sample_policy, sample_claim):
        sample_claim.accident_date = sample_policy.expiry_date + timedelta(days=1)
        results = calculator.validate_required_fields(sample_policy, sample_claim)
        assert any(r.code == "ACCIDENT_AFTER_EXPIRY" for r in results)


class TestCalculateDeductible:
    def test_normal_deductible(self, calculator, sample_policy, sample_claim):
        deductible = calculator.calculate_deductible(sample_policy, sample_claim)
        assert deductible == 50000.0

    def test_claim_amount_less_than_deductible(self, calculator, sample_policy, sample_claim):
        sample_claim.claim_amount = 30000.0
        deductible = calculator.calculate_deductible(sample_policy, sample_claim)
        assert deductible == 30000.0

    def test_deductible_waived(self, calculator, sample_policy, sample_claim):
        sample_claim.deductible_waived = True
        deductible = calculator.calculate_deductible(sample_policy, sample_claim)
        assert deductible == 0.0

    def test_claim_deductible_applied(self, calculator, sample_policy, sample_claim):
        sample_claim.deductible_applied = 30000.0
        deductible = calculator.calculate_deductible(sample_policy, sample_claim)
        assert deductible == 30000.0


class TestCalculateShares:
    def test_shares_sum_correctly(self, calculator, sample_policy):
        net_amount = 450000.0
        items = calculator.calculate_shares(net_amount, sample_policy.co_insurers)
        total = sum(item.payable_amount for item in items)
        assert abs(total - net_amount) < 0.01

    def test_individual_share_calculation(self, calculator, sample_policy):
        net_amount = 450000.0
        items = calculator.calculate_shares(net_amount, sample_policy.co_insurers)
        assert abs(items[0].payable_amount - 270000.0) < 0.01
        assert abs(items[1].payable_amount - 135000.0) < 0.01
        assert abs(items[2].payable_amount - 45000.0) < 0.01

    def test_carries_forward_rounding_difference(self, calculator):
        co_insurers = [
            CoInsurer(
                insurer_id="INS-001",
                insurer_name="主承保",
                is_leader=True,
                share_ratio=0.3333,
                confirmed=True,
            ),
            CoInsurer(
                insurer_id="INS-002",
                insurer_name="从承保1",
                is_leader=False,
                share_ratio=0.3333,
                confirmed=True,
            ),
            CoInsurer(
                insurer_id="INS-003",
                insurer_name="从承保2",
                is_leader=False,
                share_ratio=0.3334,
                confirmed=True,
            ),
        ]
        net_amount = 100.0
        items = calculator.calculate_shares(net_amount, co_insurers)
        total = sum(item.payable_amount for item in items)
        assert abs(total - net_amount) < 0.01


class TestCreateBill:
    def test_normal_bill(self, calculator, sample_policy, sample_claim):
        bill = calculator.create_bill(
            bill_no="TEST-BILL-001",
            policy=sample_policy,
            claim=sample_claim,
            existing_bills=[],
        )
        assert bill.status == BillStatus.NORMAL
        assert bill.claim_amount == 500000.0
        assert bill.deductible_amount == 50000.0
        assert bill.net_claim_amount == 450000.0
        assert len(bill.items) == 3
        assert sum(i.payable_amount for i in bill.items) == 450000.0

    def test_bill_with_errors(self, calculator, sample_policy, sample_claim):
        sample_claim.claim_amount = 0.0
        bill = calculator.create_bill(
            bill_no="TEST-BILL-002",
            policy=sample_policy,
            claim=sample_claim,
            existing_bills=[],
        )
        assert bill.status == BillStatus.EXCEPTION
        assert bill.has_errors()

    def test_bill_with_warnings(self, calculator, sample_policy, sample_claim):
        sample_policy.co_insurers[1].confirmed = False
        bill = calculator.create_bill(
            bill_no="TEST-BILL-003",
            policy=sample_policy,
            claim=sample_claim,
            existing_bills=[],
        )
        assert bill.status == BillStatus.PENDING
        assert bill.has_warnings()
        assert not bill.has_errors()

    def test_late_supplement_bill(self, calculator, sample_policy, sample_claim):
        sample_claim.is_late_supplement = True
        bill = calculator.create_bill(
            bill_no="TEST-BILL-004",
            policy=sample_policy,
            claim=sample_claim,
            existing_bills=[],
        )
        assert bill.status == BillStatus.SUPPLEMENTED
        assert any(v.code == "LATE_SUPPLEMENT" for v in bill.validation_results)

    def test_remarks_modified_bill(self, calculator, sample_policy, sample_claim):
        sample_claim.remarks_modified = True
        bill = calculator.create_bill(
            bill_no="TEST-BILL-005",
            policy=sample_policy,
            claim=sample_claim,
            existing_bills=[],
        )
        assert any(v.code == "REMARKS_MODIFIED" for v in bill.validation_results)
