import pytest
import tempfile
import shutil
import json
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
from coinsurance.sample_data import load_sample_data


@pytest.fixture
def temp_data_dir():
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)


class TestDataPersistence:
    def test_data_persists_after_reload(self, temp_data_dir):
        storage1 = Storage(data_dir=temp_data_dir)
        load_sample_data(storage1)

        processor1 = BillProcessor(storage=storage1)
        normal1, pending1, exception1 = processor1.process_all_claims()

        total_amount_before = storage1.get_total_amounts()
        bill_count_before = storage1.bills.count()
        policy_count_before = storage1.policies.count()
        claim_count_before = storage1.claims.count()

        storage2 = Storage(data_dir=temp_data_dir)

        assert storage2.policies.count() == policy_count_before
        assert storage2.claims.count() == claim_count_before
        assert storage2.bills.count() == bill_count_before

        total_amount_after = storage2.get_total_amounts()
        assert abs(total_amount_after["normal"] - total_amount_before["normal"]) < 0.01
        assert abs(total_amount_after["pending"] - total_amount_before["pending"]) < 0.01
        assert abs(total_amount_after["exception"] - total_amount_before["exception"]) < 0.01
        assert abs(total_amount_after["all"] - total_amount_before["all"]) < 0.01

        for bill_before in storage1.bills.get_all():
            bill_after = storage2.bills.get(bill_before.bill_no)
            assert bill_after is not None
            assert bill_after.status == bill_before.status
            assert abs(bill_after.claim_amount - bill_before.claim_amount) < 0.01
            assert abs(bill_after.deductible_amount - bill_before.deductible_amount) < 0.01
            assert abs(bill_after.net_claim_amount - bill_before.net_claim_amount) < 0.01
            assert len(bill_after.items) == len(bill_before.items)
            for i, item_before in enumerate(bill_before.items):
                item_after = bill_after.items[i]
                assert item_after.insurer_id == item_before.insurer_id
                assert abs(item_after.payable_amount - item_before.payable_amount) < 0.01

    def test_reload_method(self, temp_data_dir):
        storage = Storage(data_dir=temp_data_dir)
        load_sample_data(storage)

        processor = BillProcessor(storage=storage)
        processor.process_all_claims()

        stats_before = storage.get_stats()
        total_before = storage.get_total_amounts()

        bill_file = Path(temp_data_dir) / "bills.json"
        with open(bill_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        for bill_data in data:
            if bill_data["status"] == "pending":
                bill_data["status"] = "normal"
        with open(bill_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        storage.reload()

        stats_after = storage.get_stats()
        total_after = storage.get_total_amounts()

        assert stats_after["bills_by_status"].get("normal", 0) > stats_before["bills_by_status"].get("normal", 0)
        assert stats_after["bills_by_status"].get("pending", 0) < stats_before["bills_by_status"].get("pending", 0)

    def test_audit_log_persistence(self, temp_data_dir):
        storage1 = Storage(data_dir=temp_data_dir)
        load_sample_data(storage1)

        processor1 = BillProcessor(storage=storage1)
        processor1.process_all_claims()

        audit_count_before = len(storage1.audit_log.get_all())

        storage2 = Storage(data_dir=temp_data_dir)
        audit_count_after = len(storage2.audit_log.get_all())

        assert audit_count_after == audit_count_before

        actions_before = [entry.action for entry in storage1.audit_log.get_all()]
        actions_after = [entry.action for entry in storage2.audit_log.get_all()]
        assert actions_before == actions_after


class TestEndToEndWorkflow:
    def test_full_workflow_normal_claim(self, temp_data_dir):
        storage = Storage(data_dir=temp_data_dir)
        processor = BillProcessor(storage=storage)

        now = datetime.now()
        policy = Policy(
            policy_no="E2E-POL-001",
            policy_name="端到端测试保单",
            effective_date=now - timedelta(days=365),
            expiry_date=now + timedelta(days=365),
            total_sum_insured=2000000.0,
            deductible=10000.0,
            co_insurers=[
                CoInsurer(
                    insurer_id="INS-001",
                    insurer_name="主承保",
                    is_leader=True,
                    share_ratio=0.5,
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
                    share_ratio=0.2,
                    confirmed=True,
                ),
            ],
        )
        storage.policies.add(policy)

        claim = Claim(
            claim_no="E2E-CLM-001",
            policy_no="E2E-POL-001",
            claim_amount=500000.0,
            reported_date=now - timedelta(days=10),
            accident_date=now - timedelta(days=20),
            loss_description="端到端测试赔案",
        )
        storage.claims.add(claim)

        bill = processor.process_claim(claim)
        assert bill.status == BillStatus.NORMAL
        assert bill.net_claim_amount == 490000.0
        assert sum(i.payable_amount for i in bill.items) == 490000.0
        assert abs(bill.items[0].payable_amount - 245000.0) < 0.01
        assert abs(bill.items[1].payable_amount - 147000.0) < 0.01
        assert abs(bill.items[2].payable_amount - 98000.0) < 0.01

        new_storage = Storage(data_dir=temp_data_dir)
        loaded_bill = new_storage.bills.get(bill.bill_no)
        assert loaded_bill is not None
        assert loaded_bill.status == BillStatus.NORMAL
        assert loaded_bill.net_claim_amount == 490000.0

    def test_full_workflow_exception_claim(self, temp_data_dir):
        storage = Storage(data_dir=temp_data_dir)
        processor = BillProcessor(storage=storage)

        now = datetime.now()
        policy = Policy(
            policy_no="E2E-POL-002",
            policy_name="比例不闭合保单",
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
                    insurer_name="从承保",
                    is_leader=False,
                    share_ratio=0.3,
                    confirmed=True,
                ),
            ],
        )
        storage.policies.add(policy)

        claim = Claim(
            claim_no="E2E-CLM-002",
            policy_no="E2E-POL-002",
            claim_amount=200000.0,
            reported_date=now - timedelta(days=10),
            accident_date=now - timedelta(days=20),
            loss_description="比例不闭合赔案",
        )
        storage.claims.add(claim)

        bill = processor.process_claim(claim)
        assert bill.status == BillStatus.EXCEPTION
        assert bill.has_errors()
        assert any(v.code == "RATIO_NOT_CLOSED" for v in bill.validation_results)

        new_storage = Storage(data_dir=temp_data_dir)
        loaded_bill = new_storage.bills.get(bill.bill_no)
        assert loaded_bill is not None
        assert loaded_bill.status == BillStatus.EXCEPTION

    def test_full_workflow_pending_claim(self, temp_data_dir):
        storage = Storage(data_dir=temp_data_dir)
        processor = BillProcessor(storage=storage)

        now = datetime.now()
        policy = Policy(
            policy_no="E2E-POL-003",
            policy_name="待确认保单",
            effective_date=now - timedelta(days=365),
            expiry_date=now + timedelta(days=365),
            total_sum_insured=1000000.0,
            deductible=50000.0,
            co_insurers=[
                CoInsurer(
                    insurer_id="INS-001",
                    insurer_name="主承保",
                    is_leader=True,
                    share_ratio=0.7,
                    confirmed=True,
                ),
                CoInsurer(
                    insurer_id="INS-002",
                    insurer_name="从承保",
                    is_leader=False,
                    share_ratio=0.3,
                    confirmed=False,
                ),
            ],
        )
        storage.policies.add(policy)

        claim = Claim(
            claim_no="E2E-CLM-003",
            policy_no="E2E-POL-003",
            claim_amount=300000.0,
            reported_date=now - timedelta(days=10),
            accident_date=now - timedelta(days=20),
            loss_description="待确认赔案",
        )
        storage.claims.add(claim)

        bill = processor.process_claim(claim)
        assert bill.status == BillStatus.PENDING
        assert bill.has_warnings()
        assert not bill.has_errors()
        assert any(v.code == "FOLLOWER_NOT_CONFIRMED" for v in bill.validation_results)

        processor.confirm_insurer(bill.bill_no, "INS-002")

        updated_bill = storage.bills.get(bill.bill_no)
        assert updated_bill.status == BillStatus.NORMAL

        new_storage = Storage(data_dir=temp_data_dir)
        loaded_bill = new_storage.bills.get(bill.bill_no)
        assert loaded_bill is not None
        assert loaded_bill.status == BillStatus.NORMAL

    def test_full_workflow_withdraw_and_resubmit(self, temp_data_dir):
        storage = Storage(data_dir=temp_data_dir)
        processor = BillProcessor(storage=storage)

        now = datetime.now()
        policy = Policy(
            policy_no="E2E-POL-004",
            policy_name="撤回测试保单",
            effective_date=now - timedelta(days=365),
            expiry_date=now + timedelta(days=365),
            total_sum_insured=1000000.0,
            deductible=50000.0,
            co_insurers=[
                CoInsurer(
                    insurer_id="INS-001",
                    insurer_name="主承保",
                    is_leader=True,
                    share_ratio=1.0,
                    confirmed=True,
                ),
            ],
        )
        storage.policies.add(policy)

        claim = Claim(
            claim_no="E2E-CLM-004",
            policy_no="E2E-POL-004",
            claim_amount=150000.0,
            reported_date=now - timedelta(days=10),
            accident_date=now - timedelta(days=20),
            loss_description="撤回测试赔案",
        )
        storage.claims.add(claim)

        bill1 = processor.process_claim(claim)
        assert bill1.status == BillStatus.NORMAL

        processor.withdraw_bill(bill1.bill_no, "信息有误")

        claim.claim_amount = 180000.0
        storage.claims.update(claim)

        bill2 = processor.process_claim(claim)
        assert bill2.status == BillStatus.RESUBMITTED
        assert bill2.claim_amount == 180000.0
        assert bill2.previous_version_bill_no == bill1.bill_no
        assert bill2.version == 2

        new_storage = Storage(data_dir=temp_data_dir)
        assert new_storage.bills.count() == 2

        loaded_bill1 = new_storage.bills.get(bill1.bill_no)
        loaded_bill2 = new_storage.bills.get(bill2.bill_no)
        assert loaded_bill1.status == BillStatus.WITHDRAWN
        assert loaded_bill2.status == BillStatus.RESUBMITTED
        assert loaded_bill2.net_claim_amount == 130000.0


class TestExportConsistency:
    def test_export_amounts_match_storage(self, temp_data_dir):
        storage = Storage(data_dir=temp_data_dir)
        load_sample_data(storage)
        processor = BillProcessor(storage=storage)
        processor.process_all_claims()

        amounts = storage.get_total_amounts()
        stats = storage.get_stats()

        normal_bills = storage.bills.filter(
            lambda b: b.status in [BillStatus.NORMAL, BillStatus.SUPPLEMENTED, BillStatus.RESUBMITTED]
        )
        pending_bills = storage.bills.filter(lambda b: b.status == BillStatus.PENDING)
        exception_bills = storage.bills.filter(
            lambda b: b.status in [BillStatus.EXCEPTION, BillStatus.WITHDRAWN, BillStatus.DRAFT]
        )

        normal_sum = sum(b.net_claim_amount for b in normal_bills)
        pending_sum = sum(b.net_claim_amount for b in pending_bills)
        exception_sum = sum(b.net_claim_amount for b in exception_bills)
        total_sum = normal_sum + pending_sum + exception_sum

        assert abs(normal_sum - amounts["normal"]) < 0.01
        assert abs(pending_sum - amounts["pending"]) < 0.01
        assert abs(exception_sum - amounts["exception"]) < 0.01
        assert abs(total_sum - amounts["all"]) < 0.01

        assert len(normal_bills) == stats["bills_by_status"].get("normal", 0) + stats["bills_by_status"].get("supplemented", 0) + stats["bills_by_status"].get("resubmitted", 0)
        assert len(pending_bills) == stats["bills_by_status"].get("pending", 0)
