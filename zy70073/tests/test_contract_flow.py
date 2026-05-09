from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.models.enums import (
    ContractStatus,
    DeliveryStatus,
    AcceptanceResult,
    PaymentStatus,
    WarningType,
    WarningLevel,
    CompensationStatus,
    CompensationType,
)
from app.models.models import Contract, DeliveryPlan, PaymentNode
from app.services.contract_service import ContractService
from app.services.delivery_service import DeliveryService
from app.services.acceptance_service import AcceptanceService
from app.services.payment_service import PaymentService
from app.services.penalty_service import PenaltyService
from app.services.warning_service import WarningService
from app.services.compensation_service import CompensationHandler
from app.services.report_service import ReportService
from app.schemas.schemas import (
    ContractCreate,
    DeliveryPlanCreate,
    PaymentNodeCreate,
    AcceptanceReceiptCreate,
    FulfillmentRecordCreate,
)


class TestContractFulfillmentFlow:
    """测试完整履约流程"""

    def test_create_contract_with_plans(self, db_session, sample_dates):
        contract_service = ContractService(db_session)
        
        contract_data = ContractCreate(
            contract_no="PO-2026-001",
            contract_name="2026年度原材料采购合同",
            supplier_name="供应商A有限公司",
            total_amount=Decimal("1000000.00"),
            sign_date=sample_dates["sign_date"],
            effective_date=sample_dates["effective_date"],
            expiry_date=sample_dates["expiry_date"],
            late_delivery_rate=Decimal("0.001"),
            quality_penalty_rate=Decimal("0.1"),
        )
        contract = contract_service.create_contract(contract_data)
        
        assert contract.id is not None
        assert contract.contract_no == "PO-2026-001"
        assert contract.status == ContractStatus.DRAFT
        
        delivery_service = DeliveryService(db_session)
        payment_service = PaymentService(db_session)
        
        dp1 = delivery_service.create_delivery_plan(DeliveryPlanCreate(
            contract_id=contract.id,
            batch_no="BATCH-001",
            plan_delivery_date=sample_dates["in_3_days"],
            plan_quantity=Decimal("100"),
            plan_amount=Decimal("300000.00"),
        ))
        assert dp1 is not None
        
        dp2 = delivery_service.create_delivery_plan(DeliveryPlanCreate(
            contract_id=contract.id,
            batch_no="BATCH-002",
            plan_delivery_date=sample_dates["in_7_days"],
            plan_quantity=Decimal("200"),
            plan_amount=Decimal("700000.00"),
        ))
        assert dp2 is not None
        
        pn1 = payment_service.create_payment_node(PaymentNodeCreate(
            contract_id=contract.id,
            node_name="预付款",
            plan_payment_date=sample_dates["tomorrow"],
            plan_amount=Decimal("300000.00"),
            payment_ratio=Decimal("0.3"),
        ))
        assert pn1 is not None
        
        pn2 = payment_service.create_payment_node(PaymentNodeCreate(
            contract_id=contract.id,
            node_name="验收款",
            plan_payment_date=sample_dates["in_7_days"],
            plan_amount=Decimal("700000.00"),
            payment_ratio=Decimal("0.7"),
        ))
        assert pn2 is not None
        
        activated = contract_service.activate_contract(contract.id)
        assert activated.status == ContractStatus.ACTIVE
        
        delivery_plans = delivery_service.list_delivery_plans(contract.id)
        assert len(delivery_plans) == 2
        
        payment_nodes = payment_service.list_payment_nodes(contract.id)
        assert len(payment_nodes) == 2

    def test_ontime_delivery_and_acceptance(self, db_session, sample_dates):
        contract_service = ContractService(db_session)
        delivery_service = DeliveryService(db_session)
        acceptance_service = AcceptanceService(db_session)
        penalty_service = PenaltyService(db_session)
        
        contract = contract_service.create_contract(ContractCreate(
            contract_no="PO-2026-002",
            contract_name="按时交付测试合同",
            supplier_name="供应商B",
            total_amount=Decimal("500000.00"),
            sign_date=sample_dates["sign_date"],
            effective_date=sample_dates["effective_date"],
            expiry_date=sample_dates["expiry_date"],
        ))
        contract_service.activate_contract(contract.id)
        
        dp = delivery_service.create_delivery_plan(DeliveryPlanCreate(
            contract_id=contract.id,
            batch_no="BATCH-001",
            plan_delivery_date=sample_dates["today"],
            plan_quantity=Decimal("50"),
            plan_amount=Decimal("500000.00"),
        ))
        
        recorded = delivery_service.record_delivery(FulfillmentRecordCreate(
            delivery_plan_id=dp.id,
            actual_delivery_date=sample_dates["today"],
            actual_quantity=Decimal("50"),
            actual_amount=Decimal("500000.00"),
        ))
        
        assert recorded.status == DeliveryStatus.DELIVERED
        
        acceptance = acceptance_service.create_acceptance(AcceptanceReceiptCreate(
            delivery_plan_id=dp.id,
            receipt_no="AR-001",
            acceptance_date=sample_dates["tomorrow"],
            accepted_quantity=Decimal("50"),
            accepted_amount=Decimal("500000.00"),
            result=AcceptanceResult.ACCEPTED,
        ))
        
        assert acceptance is not None
        assert acceptance.result == AcceptanceResult.ACCEPTED
        assert dp.status == DeliveryStatus.ACCEPTED
        
        penalties = penalty_service.process_delivery_penalties(dp.id)
        assert len(penalties) == 0

    def test_late_delivery_penalty_calculation(self, db_session, sample_dates):
        contract_service = ContractService(db_session)
        delivery_service = DeliveryService(db_session)
        penalty_service = PenaltyService(db_session)
        
        contract = contract_service.create_contract(ContractCreate(
            contract_no="PO-2026-003",
            contract_name="延迟交付违约金测试合同",
            supplier_name="供应商C",
            total_amount=Decimal("200000.00"),
            sign_date=sample_dates["sign_date"],
            effective_date=sample_dates["effective_date"],
            expiry_date=sample_dates["expiry_date"],
            late_delivery_rate=Decimal("0.001"),
        ))
        contract_service.activate_contract(contract.id)
        
        dp = delivery_service.create_delivery_plan(DeliveryPlanCreate(
            contract_id=contract.id,
            batch_no="BATCH-001",
            plan_delivery_date=sample_dates["7_days_ago"],
            plan_quantity=Decimal("100"),
            plan_amount=Decimal("200000.00"),
        ))
        
        actual_date = sample_dates["today"]
        delivery_service.record_delivery(FulfillmentRecordCreate(
            delivery_plan_id=dp.id,
            actual_delivery_date=actual_date,
            actual_quantity=Decimal("100"),
            actual_amount=Decimal("200000.00"),
        ))
        
        penalties = penalty_service.process_delivery_penalties(dp.id)
        
        assert len(penalties) == 1
        penalty = penalties[0]
        assert penalty.penalty_type == "late_delivery"
        
        late_days = 7
        expected_amount = Decimal("200000.00") * Decimal("0.001") * Decimal(late_days)
        assert penalty.penalty_amount == expected_amount.quantize(Decimal("0.01"))
        assert penalty.late_days == late_days
        assert "延迟天数=7天" in penalty.calculation_details

    def test_quality_issue_penalty_calculation(self, db_session, sample_dates):
        contract_service = ContractService(db_session)
        delivery_service = DeliveryService(db_session)
        acceptance_service = AcceptanceService(db_session)
        penalty_service = PenaltyService(db_session)
        
        contract = contract_service.create_contract(ContractCreate(
            contract_no="PO-2026-004",
            contract_name="质量问题违约金测试合同",
            supplier_name="供应商D",
            total_amount=Decimal("100000.00"),
            sign_date=sample_dates["sign_date"],
            effective_date=sample_dates["effective_date"],
            expiry_date=sample_dates["expiry_date"],
            quality_penalty_rate=Decimal("0.1"),
        ))
        contract_service.activate_contract(contract.id)
        
        dp = delivery_service.create_delivery_plan(DeliveryPlanCreate(
            contract_id=contract.id,
            batch_no="BATCH-001",
            plan_delivery_date=sample_dates["today"],
            plan_quantity=Decimal("100"),
            plan_amount=Decimal("100000.00"),
        ))
        
        delivery_service.record_delivery(FulfillmentRecordCreate(
            delivery_plan_id=dp.id,
            actual_delivery_date=sample_dates["today"],
            actual_quantity=Decimal("100"),
            actual_amount=Decimal("100000.00"),
        ))
        
        acceptance_service.create_acceptance(AcceptanceReceiptCreate(
            delivery_plan_id=dp.id,
            receipt_no="AR-002",
            acceptance_date=sample_dates["tomorrow"],
            accepted_quantity=Decimal("80"),
            rejected_quantity=Decimal("20"),
            accepted_amount=Decimal("80000.00"),
            rejected_amount=Decimal("20000.00"),
            result=AcceptanceResult.PARTIAL_ACCEPTED,
            quality_issue_rate=Decimal("0.2"),
            rejection_reason="部分产品不符合规格",
        ))
        
        penalties = penalty_service.process_delivery_penalties(dp.id)
        
        quality_penalty = next((p for p in penalties if p.penalty_type == "quality_issue"), None)
        assert quality_penalty is not None
        
        expected_rate = Decimal("0.1") * Decimal("0.2")
        expected_amount = Decimal("100000.00") * expected_rate
        assert quality_penalty.penalty_amount == expected_amount.quantize(Decimal("0.01"))
        assert quality_penalty.penalty_rate == expected_rate.quantize(Decimal("0.00001"))
        assert quality_penalty.is_settled is False

    def test_warning_generation(self, db_session, sample_dates):
        contract_service = ContractService(db_session)
        delivery_service = DeliveryService(db_session)
        payment_service = PaymentService(db_session)
        acceptance_service = AcceptanceService(db_session)
        warning_service = WarningService(db_session)
        
        contract = contract_service.create_contract(ContractCreate(
            contract_no="PO-2026-005",
            contract_name="预警测试合同",
            supplier_name="供应商E",
            total_amount=Decimal("300000.00"),
            sign_date=sample_dates["sign_date"],
            effective_date=sample_dates["effective_date"],
            expiry_date=sample_dates["expiry_date"],
        ))
        contract_service.activate_contract(contract.id)
        
        dp1 = delivery_service.create_delivery_plan(DeliveryPlanCreate(
            contract_id=contract.id,
            batch_no="BATCH-001",
            plan_delivery_date=sample_dates["tomorrow"],
            plan_quantity=Decimal("100"),
            plan_amount=Decimal("150000.00"),
        ))
        
        dp2 = delivery_service.create_delivery_plan(DeliveryPlanCreate(
            contract_id=contract.id,
            batch_no="BATCH-002",
            plan_delivery_date=sample_dates["10_days_ago"],
            plan_quantity=Decimal("100"),
            plan_amount=Decimal("150000.00"),
        ))
        
        payment_service.create_payment_node(PaymentNodeCreate(
            contract_id=contract.id,
            node_name="预付款",
            plan_payment_date=sample_dates["3_days_ago"],
            plan_amount=Decimal("90000.00"),
            payment_ratio=Decimal("0.3"),
        ))
        
        payment_service.refresh_payment_statuses(sample_dates["today"])
        
        results = warning_service.run_all_checks(sample_dates["today"])
        
        assert results["upcoming_deliveries"] == 1
        assert results["late_deliveries"] == 1
        assert results["late_payments"] >= 1
        
        warnings = warning_service.get_active_warnings(contract.id)
        assert len(warnings) >= 3
        
        upcoming = [w for w in warnings if w.warning_type == WarningType.UPCOMING_DELIVERY]
        assert len(upcoming) == 1
        assert upcoming[0].warning_level == WarningLevel.MEDIUM
        
        late_delivery = [w for w in warnings if w.warning_type == WarningType.LATE_DELIVERY]
        assert len(late_delivery) == 1
        assert late_delivery[0].warning_level == WarningLevel.CRITICAL

    def test_payment_processing(self, db_session, sample_dates):
        contract_service = ContractService(db_session)
        payment_service = PaymentService(db_session)
        
        contract = contract_service.create_contract(ContractCreate(
            contract_no="PO-2026-006",
            contract_name="付款测试合同",
            supplier_name="供应商F",
            total_amount=Decimal("400000.00"),
            sign_date=sample_dates["sign_date"],
            effective_date=sample_dates["effective_date"],
            expiry_date=sample_dates["expiry_date"],
        ))
        contract_service.activate_contract(contract.id)
        
        pn = payment_service.create_payment_node(PaymentNodeCreate(
            contract_id=contract.id,
            node_name="进度款",
            plan_payment_date=sample_dates["today"],
            plan_amount=Decimal("400000.00"),
            payment_ratio=Decimal("1.0"),
        ))
        
        payment_service.refresh_payment_statuses(sample_dates["today"])
        db_session.refresh(pn)
        assert pn.status == PaymentStatus.DUE
        
        recorded = payment_service.record_payment(
            pn.id,
            sample_dates["today"],
            Decimal("400000.00"),
        )
        
        assert recorded.status == PaymentStatus.PAID
        assert recorded.actual_amount == Decimal("400000.00")
        assert recorded.actual_payment_date == sample_dates["today"]

    def test_compensation_task_retry_mechanism(self, db_session, sample_dates):
        contract_service = ContractService(db_session)
        compensation_handler = CompensationHandler(db_session)
        
        contract = contract_service.create_contract(ContractCreate(
            contract_no="PO-2026-007",
            contract_name="补偿机制测试合同",
            supplier_name="供应商G",
            total_amount=Decimal("50000.00"),
            sign_date=sample_dates["sign_date"],
            effective_date=sample_dates["effective_date"],
            expiry_date=sample_dates["expiry_date"],
        ))
        contract_service.activate_contract(contract.id)
        
        task = compensation_handler.create_compensation_task(
            contract_id=contract.id,
            task_type=CompensationType.SEND_NOTIFICATION,
            task_data={"message": "这是一个测试通知"},
            max_retries=2,
        )
        
        assert task.status == CompensationStatus.PENDING
        assert task.retry_count == 0
        
        success, message = compensation_handler.execute_task(task)
        assert success is True
        assert task.status == CompensationStatus.SUCCESS
        
        task2 = compensation_handler.create_compensation_task(
            contract_id=999999,
            task_type=CompensationType.UPDATE_CONTRACT_STATUS,
            task_data={"contract_id": 999999, "new_status": "closed"},
            max_retries=2,
        )
        
        success2, message2 = compensation_handler.retry_task(task2.id)
        assert success2 is False
        assert task2.retry_count == 1
        assert task2.status == CompensationStatus.RETRYABLE
        
        marked = compensation_handler.mark_for_retry(task2.id)
        assert marked is not None
        
        success3, message3 = compensation_handler.retry_task(task2.id)
        assert success3 is False
        assert task2.retry_count == 2
        assert task2.status == CompensationStatus.FAILED

    def test_report_validation_numbers_match(self, db_session, sample_dates):
        contract_service = ContractService(db_session)
        delivery_service = DeliveryService(db_session)
        payment_service = PaymentService(db_session)
        acceptance_service = AcceptanceService(db_session)
        report_service = ReportService(db_session)
        penalty_service = PenaltyService(db_session)
        warning_service = WarningService(db_session)
        
        contract = contract_service.create_contract(ContractCreate(
            contract_no="PO-2026-008",
            contract_name="报告验证合同",
            supplier_name="供应商H",
            total_amount=Decimal("1200000.00"),
            sign_date=sample_dates["sign_date"],
            effective_date=sample_dates["effective_date"],
            expiry_date=sample_dates["expiry_date"],
            late_delivery_rate=Decimal("0.002"),
        ))
        contract_service.activate_contract(contract.id)
        
        dp1 = delivery_service.create_delivery_plan(DeliveryPlanCreate(
            contract_id=contract.id,
            batch_no="BATCH-001",
            plan_delivery_date=sample_dates["3_days_ago"],
            plan_quantity=Decimal("100"),
            plan_amount=Decimal("400000.00"),
        ))
        dp2 = delivery_service.create_delivery_plan(DeliveryPlanCreate(
            contract_id=contract.id,
            batch_no="BATCH-002",
            plan_delivery_date=sample_dates["in_3_days"],
            plan_quantity=Decimal("200"),
            plan_amount=Decimal("800000.00"),
        ))
        
        delivery_service.record_delivery(FulfillmentRecordCreate(
            delivery_plan_id=dp1.id,
            actual_delivery_date=sample_dates["today"],
            actual_quantity=Decimal("100"),
            actual_amount=Decimal("400000.00"),
        ))
        
        acceptance_service.create_acceptance(AcceptanceReceiptCreate(
            delivery_plan_id=dp1.id,
            receipt_no="AR-003",
            acceptance_date=sample_dates["tomorrow"],
            accepted_quantity=Decimal("90"),
            rejected_quantity=Decimal("10"),
            accepted_amount=Decimal("360000.00"),
            rejected_amount=Decimal("40000.00"),
            result=AcceptanceResult.PARTIAL_ACCEPTED,
            quality_issue_rate=Decimal("0.1"),
        ))
        
        payment_service.create_payment_node(PaymentNodeCreate(
            contract_id=contract.id,
            node_name="预付款",
            plan_payment_date=sample_dates["yesterday"],
            plan_amount=Decimal("360000.00"),
            payment_ratio=Decimal("0.3"),
        ))
        
        penalty_service.process_delivery_penalties(dp1.id)
        
        warning_service.run_all_checks(sample_dates["today"])
        
        detail_report = report_service.get_contract_detail_report(contract.id)
        
        assert detail_report is not None
        assert detail_report["total_amount"] == 1200000.00
        
        assert detail_report["delivery"]["total_batches"] == 2
        assert detail_report["delivery"]["plan_amount"] == 1200000.00
        assert detail_report["delivery"]["actual_amount"] == 400000.00
        assert detail_report["delivery"]["progress_pct"] == 33.33
        
        assert detail_report["payment"]["total_nodes"] == 1
        assert detail_report["payment"]["plan_amount"] == 360000.00
        
        penalties = detail_report["penalties"]
        assert penalties["total_count"] >= 1
        assert penalties["unsettled_count"] >= 1
        
        active_warnings = detail_report["active_warnings"]
        assert active_warnings >= 2
        
        daily_report = report_service.generate_daily_report(sample_dates["today"])
        
        assert daily_report["deliveries"]["plan_amount"] == 1200000.00
        assert daily_report["deliveries"]["actual_amount"] == 400000.00
        assert daily_report["penalties"]["total_count"] >= 1
        assert daily_report["penalties"]["unsettled_count"] >= 1

    def test_contract_status_auto_calculation(self, db_session, sample_dates):
        contract_service = ContractService(db_session)
        delivery_service = DeliveryService(db_session)
        acceptance_service = AcceptanceService(db_session)
        
        contract = contract_service.create_contract(ContractCreate(
            contract_no="PO-2026-009",
            contract_name="合同状态自动计算测试",
            supplier_name="供应商I",
            total_amount=Decimal("600000.00"),
            sign_date=sample_dates["sign_date"],
            effective_date=sample_dates["effective_date"],
            expiry_date=sample_dates["expiry_date"],
        ))
        contract_service.activate_contract(contract.id)
        
        dp1 = delivery_service.create_delivery_plan(DeliveryPlanCreate(
            contract_id=contract.id,
            batch_no="BATCH-001",
            plan_delivery_date=sample_dates["today"],
            plan_quantity=Decimal("100"),
            plan_amount=Decimal("300000.00"),
        ))
        dp2 = delivery_service.create_delivery_plan(DeliveryPlanCreate(
            contract_id=contract.id,
            batch_no="BATCH-002",
            plan_delivery_date=sample_dates["tomorrow"],
            plan_quantity=Decimal("100"),
            plan_amount=Decimal("300000.00"),
        ))
        
        delivery_service.record_delivery(FulfillmentRecordCreate(
            delivery_plan_id=dp1.id,
            actual_delivery_date=sample_dates["today"],
            actual_quantity=Decimal("100"),
            actual_amount=Decimal("300000.00"),
        ))
        
        acceptance_service.create_acceptance(AcceptanceReceiptCreate(
            delivery_plan_id=dp1.id,
            receipt_no="AR-004",
            acceptance_date=sample_dates["tomorrow"],
            accepted_quantity=Decimal("100"),
            accepted_amount=Decimal("300000.00"),
            result=AcceptanceResult.ACCEPTED,
        ))
        
        updated = contract_service.recalculate_contract_status(contract.id)
        assert updated.status == ContractStatus.PARTIAL_FULFILLED
        
        delivery_service.record_delivery(FulfillmentRecordCreate(
            delivery_plan_id=dp2.id,
            actual_delivery_date=sample_dates["tomorrow"],
            actual_quantity=Decimal("100"),
            actual_amount=Decimal("300000.00"),
        ))
        
        acceptance_service.create_acceptance(AcceptanceReceiptCreate(
            delivery_plan_id=dp2.id,
            receipt_no="AR-005",
            acceptance_date=sample_dates["in_3_days"],
            accepted_quantity=Decimal("100"),
            accepted_amount=Decimal("300000.00"),
            result=AcceptanceResult.ACCEPTED,
        ))
        
        final = contract_service.recalculate_contract_status(contract.id)
        assert final.status == ContractStatus.FULLY_FULFILLED
