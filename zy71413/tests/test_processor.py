import pytest
import tempfile
import shutil
from datetime import datetime, timedelta
from pathlib import Path

from coinsurance.models import (
    Policy,
    Claim,
    CoInsurer,
    BillStatus,
)
from coinsurance.storage import Storage
from coinsurance.calculator import CoInsuranceCalculator
from coinsurance.processor import BillProcessor


@pytest.fixture
def temp_data_dir():
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)


@pytest.fixture
def storage(temp_data_dir):
    return Storage(data_dir=temp_data_dir)


@pytest.fixture
def processor(storage):
    calculator = CoInsuranceCalculator()
    return BillProcessor(storage=storage, calculator=calculator)


@pytest.fixture
def setup_test_data(storage):
    now = datetime.now()
    effective_date = now - timedelta(days=365)
    expiry_date = now + timedelta(days=365)

    policy = Policy(
        policy_no="TEST-POL-001",
        policy_name="测试保单",
        effective_date=effective_date,
        expiry_date=expiry_date,
        total_sum_insured=1000000.0,
        deductible=50000.0,
        co_insurers=[
            CoInsurer(
                insurer_id="INS-001",
                insurer_name="太平洋保险",
                is_leader=True,
                share_ratio=0.6,
                confirmed=True,
            ),
            CoInsurer(
                insurer_id="INS-002",
                insurer_name="平安保险",
                is_leader=False,
                share_ratio=0.3,
                confirmed=True,
            ),
            CoInsurer(
                insurer_id="INS-003",
                insurer_name="人保财险",
                is_leader=False,
                share_ratio=0.1,
                confirmed=True,
            ),
        ],
    )
    storage.policies.add(policy)

    claim1 = Claim(
        claim_no="TEST-CLM-001",
        policy_no="TEST-POL-001",
        claim_amount=500000.0,
        reported_date=now - timedelta(days=30),
        accident_date=now - timedelta(days=45),
        loss_description="正常赔案",
    )
    storage.claims.add(claim1)

    claim2 = Claim(
        claim_no="TEST-CLM-002",
        policy_no="TEST-POL-001",
        claim_amount=30000.0,
        reported_date=now - timedelta(days=30),
        accident_date=now - timedelta(days=45),
        loss_description="小额赔案",
    )
    storage.claims.add(claim2)

    claim3 = Claim(
        claim_no="TEST-CLM-003",
        policy_no="TEST-POL-999",
        claim_amount=100000.0,
        reported_date=now - timedelta(days=30),
        accident_date=now - timedelta(days=45),
        loss_description="无对应保单",
    )
    storage.claims.add(claim3)

    return storage


class TestProcessClaim:
    def test_process_normal_claim(self, processor, setup_test_data):
        claim = setup_test_data.claims.get("TEST-CLM-001")
        bill = processor.process_claim(claim)
        assert bill is not None
        assert bill.status == BillStatus.NORMAL
        assert bill.bill_no.startswith("BILL-TEST-CLM-001-")
        assert bill.claim_amount == 500000.0
        assert bill.deductible_amount == 50000.0
        assert bill.net_claim_amount == 450000.0
        assert len(bill.items) == 3

    def test_process_claim_with_missing_policy(self, processor, setup_test_data):
        claim = setup_test_data.claims.get("TEST-CLM-003")
        bill = processor.process_claim(claim)
        assert bill is not None
        assert bill.status == BillStatus.EXCEPTION
        assert any(v.code == "POLICY_NOT_FOUND" for v in bill.validation_results)

    def test_process_duplicate_claim(self, processor, setup_test_data):
        claim = setup_test_data.claims.get("TEST-CLM-001")
        bill1 = processor.process_claim(claim)
        bill2 = processor.process_claim(claim)
        assert bill1.bill_no != bill2.bill_no
        assert bill2.status == BillStatus.RESUBMITTED
        assert bill2.version == 2
        assert bill2.previous_version_bill_no == bill1.bill_no
        assert any(v.code == "DUPLICATE_SUBMIT" for v in bill2.validation_results)


class TestProcessAllClaims:
    def test_process_all(self, processor, setup_test_data):
        normal, pending, exception = processor.process_all_claims()
        assert len(normal) + len(pending) + len(exception) == 3
        assert len(exception) >= 1
        assert processor.storage.bills.count() == 3

    def test_process_all_categorization(self, processor, setup_test_data):
        normal, pending, exception = processor.process_all_claims()
        normal_statuses = [b.status for b in normal]
        assert all(s in [BillStatus.NORMAL, BillStatus.SUPPLEMENTED, BillStatus.RESUBMITTED] for s in normal_statuses)
        assert all(b.status == BillStatus.PENDING for b in pending)
        assert all(b.status in [BillStatus.EXCEPTION, BillStatus.WITHDRAWN, BillStatus.DRAFT] for b in exception)


class TestWithdrawBill:
    def test_withdraw_normal_bill(self, processor, setup_test_data):
        claim = setup_test_data.claims.get("TEST-CLM-001")
        bill = processor.process_claim(claim)
        withdrawn_bill = processor.withdraw_bill(bill.bill_no, "测试撤回")
        assert withdrawn_bill is not None
        assert withdrawn_bill.status == BillStatus.WITHDRAWN
        assert any(v.code == "BILL_WITHDRAWN" for v in withdrawn_bill.validation_results)

    def test_withdraw_nonexistent_bill(self, processor):
        result = processor.withdraw_bill("NONEXISTENT-BILL")
        assert result is None

    def test_withdraw_already_withdrawn_bill(self, processor, setup_test_data):
        claim = setup_test_data.claims.get("TEST-CLM-001")
        bill = processor.process_claim(claim)
        processor.withdraw_bill(bill.bill_no, "第一次撤回")
        result = processor.withdraw_bill(bill.bill_no, "第二次撤回")
        assert result.status == BillStatus.WITHDRAWN


class TestConfirmBill:
    def test_confirm_pending_bill(self, processor, setup_test_data, storage):
        policy = storage.policies.get("TEST-POL-001")
        policy.co_insurers[1].confirmed = False
        storage.policies.update(policy)

        claim = setup_test_data.claims.get("TEST-CLM-001")
        bill = processor.process_claim(claim)
        assert bill.status == BillStatus.PENDING

        policy.co_insurers[1].confirmed = True
        storage.policies.update(policy)

        confirmed_bill = processor.confirm_bill(bill.bill_no)
        assert confirmed_bill is not None
        assert confirmed_bill.status == BillStatus.NORMAL

    def test_confirm_exception_bill(self, processor, setup_test_data):
        claim = setup_test_data.claims.get("TEST-CLM-003")
        bill = processor.process_claim(claim)
        assert bill.status == BillStatus.EXCEPTION

        result = processor.confirm_bill(bill.bill_no)
        assert result.status == BillStatus.EXCEPTION


class TestConfirmInsurer:
    def test_confirm_single_insurer(self, processor, setup_test_data, storage):
        policy = storage.policies.get("TEST-POL-001")
        policy.co_insurers[1].confirmed = False
        storage.policies.update(policy)

        claim = setup_test_data.claims.get("TEST-CLM-001")
        bill = processor.process_claim(claim)

        result = processor.confirm_insurer(bill.bill_no, "INS-002")
        assert result is not None
        assert any(item.confirmed for item in result.items if item.insurer_id == "INS-002")

        updated_policy = storage.policies.get("TEST-POL-001")
        assert any(c.confirmed for c in updated_policy.co_insurers if c.insurer_id == "INS-002")

    def test_confirm_all_insurers(self, processor, setup_test_data, storage):
        policy = storage.policies.get("TEST-POL-001")
        for c in policy.co_insurers:
            c.confirmed = False
        storage.policies.update(policy)

        claim = setup_test_data.claims.get("TEST-CLM-001")
        bill = processor.process_claim(claim)
        assert bill.status == BillStatus.PENDING

        processor.confirm_insurer(bill.bill_no, "INS-001")
        processor.confirm_insurer(bill.bill_no, "INS-002")
        final_bill = processor.confirm_insurer(bill.bill_no, "INS-003")

        assert final_bill.status == BillStatus.NORMAL
        assert all(item.confirmed for item in final_bill.items)


class TestRecalculateBill:
    def test_recalculate_bill(self, processor, setup_test_data):
        claim = setup_test_data.claims.get("TEST-CLM-001")
        bill = processor.process_claim(claim)
        original_version = bill.version

        recalculated = processor.recalculate_bill(bill.bill_no)
        assert recalculated is not None
        assert recalculated.version == original_version + 1
        assert recalculated.previous_version_bill_no == bill.bill_no

    def test_recalculate_nonexistent_bill(self, processor):
        result = processor.recalculate_bill("NONEXISTENT-BILL")
        assert result is None


class TestGetBillsByStatus:
    def test_get_bills_by_status(self, processor, setup_test_data):
        processor.process_all_claims()
        normal_bills = processor.get_bills_by_status(BillStatus.NORMAL)
        exception_bills = processor.get_bills_by_status(BillStatus.EXCEPTION)
        assert len(normal_bills) >= 1
        assert len(exception_bills) >= 1


class TestBillNumberGeneration:
    def test_unique_bill_numbers(self, processor, setup_test_data):
        claim = setup_test_data.claims.get("TEST-CLM-001")
        bill_nos = []
        for i in range(5):
            bill = processor.process_claim(claim)
            bill_nos.append(bill.bill_no)
        assert len(set(bill_nos)) == 5
        assert bill_nos == [f"BILL-TEST-CLM-001-{i+1:03d}" for i in range(5)]
