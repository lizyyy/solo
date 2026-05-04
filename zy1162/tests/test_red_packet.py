import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import (
    RedPacketActivity, RedPacket, Payment, ClaimRequest,
    LedgerTransaction, RiskRecord, AuditLog,
    RedPacketStatus, PacketStatus, PaymentStatus, RiskAction
)
from app.schemas import (
    CreateRedPacketActivityRequest, LockBudgetRequest,
    ClaimPacketRequest, PaymentCallbackRequest, RiskActionRequest,
    AuditExportRequest
)
from app.services import RedPacketService, generate_id


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def red_packet_service(db_session):
    return RedPacketService(db_session)


class TestRedPacketCreation:
    def test_create_activity_success(self, red_packet_service, db_session):
        request = CreateRedPacketActivityRequest(
            name="测试红包活动",
            description="这是一个测试活动",
            total_amount=100.0,
            total_count=10,
            merchant_id="merchant_test_001",
            merchant_name="测试商家",
            rule_type="random"
        )
        
        activity = red_packet_service.create_activity(request)
        
        assert activity.activity_id is not None
        assert activity.name == "测试红包活动"
        assert activity.total_amount == 100.0
        assert activity.total_count == 10
        assert activity.remaining_amount == 100.0
        assert activity.remaining_count == 10
        assert activity.status == RedPacketStatus.DRAFT.value
        assert activity.merchant_id == "merchant_test_001"
        
        audit_log = db_session.query(AuditLog).filter(
            AuditLog.activity_id == activity.activity_id
        ).first()
        assert audit_log is not None
        assert audit_log.action == "create_activity"

    def test_create_activity_fixed_rule(self, red_packet_service):
        request = CreateRedPacketActivityRequest(
            name="固定金额红包",
            total_amount=100.0,
            total_count=10,
            merchant_id="merchant_test_002",
            rule_type="fixed"
        )
        
        activity = red_packet_service.create_activity(request)
        
        assert activity.rule_type == "fixed"


class TestBudgetLocking:
    def test_lock_budget_success(self, red_packet_service, db_session):
        activity_request = CreateRedPacketActivityRequest(
            name="测试锁定预算",
            total_amount=100.0,
            total_count=10,
            merchant_id="merchant_test_003",
            rule_type="random"
        )
        activity = red_packet_service.create_activity(activity_request)
        
        lock_request = LockBudgetRequest(
            activity_id=activity.activity_id,
            merchant_id="merchant_test_003"
        )
        
        locked_activity, payment = red_packet_service.lock_budget(lock_request)
        
        assert locked_activity.status == RedPacketStatus.PENDING_PAYMENT.value
        assert payment is not None
        assert payment.amount == 100.0
        assert payment.status == PaymentStatus.PENDING.value
        
        packets = db_session.query(RedPacket).filter(
            RedPacket.activity_id == activity.activity_id
        ).all()
        assert len(packets) == 10
        
        total_packet_amount = sum(p.amount for p in packets)
        assert abs(total_packet_amount - 100.0) < 0.01

    def test_lock_budget_from_wrong_status(self, red_packet_service, db_session):
        activity = RedPacketActivity(
            activity_id="act_wrong_status",
            name="已激活活动",
            total_amount=100.0,
            total_count=10,
            remaining_amount=100.0,
            remaining_count=10,
            status=RedPacketStatus.ACTIVE.value,
            rule_type="random",
            merchant_id="merchant_test_004"
        )
        db_session.add(activity)
        db_session.commit()
        
        lock_request = LockBudgetRequest(
            activity_id="act_wrong_status",
            merchant_id="merchant_test_004"
        )
        
        with pytest.raises(ValueError, match="Cannot lock budget from status"):
            red_packet_service.lock_budget(lock_request)

    def test_lock_budget_not_found(self, red_packet_service):
        lock_request = LockBudgetRequest(
            activity_id="act_not_exist",
            merchant_id="merchant_test_005"
        )
        
        with pytest.raises(ValueError, match="Activity not found"):
            red_packet_service.lock_budget(lock_request)


class TestPacketSplitting:
    def test_random_split_sum_correct(self, red_packet_service):
        total_amount = 100.0
        total_count = 10
        
        packets = red_packet_service._random_split(total_amount, total_count)
        
        assert len(packets) == total_count
        assert sum(packets) == total_amount
        assert all(p >= 0.01 for p in packets)

    def test_random_split_single_packet(self, red_packet_service):
        packets = red_packet_service._random_split(100.0, 1)
        
        assert len(packets) == 1
        assert packets[0] == 100.0

    def test_fixed_split(self, red_packet_service, db_session):
        activity_request = CreateRedPacketActivityRequest(
            name="固定金额测试",
            total_amount=100.0,
            total_count=10,
            merchant_id="merchant_test_006",
            rule_type="fixed"
        )
        activity = red_packet_service.create_activity(activity_request)
        
        lock_request = LockBudgetRequest(
            activity_id=activity.activity_id,
            merchant_id="merchant_test_006"
        )
        red_packet_service.lock_budget(lock_request)
        
        packets = db_session.query(RedPacket).filter(
            RedPacket.activity_id == activity.activity_id
        ).all()
        
        assert len(packets) == 10
        assert all(p.amount == 10.0 for p in packets)


class TestPacketClaiming:
    def test_claim_packet_success(self, red_packet_service, db_session):
        activity = RedPacketActivity(
            activity_id="act_claim_test",
            name="领取测试活动",
            total_amount=100.0,
            total_count=5,
            remaining_amount=100.0,
            remaining_count=5,
            status=RedPacketStatus.ACTIVE.value,
            rule_type="fixed",
            merchant_id="merchant_test_007"
        )
        db_session.add(activity)
        
        for i in range(5):
            packet = RedPacket(
                packet_id=f"pkt_claim_{i}",
                activity_id="act_claim_test",
                amount=20.0,
                status=PacketStatus.PENDING.value
            )
            db_session.add(packet)
        
        db_session.commit()
        
        claim_request = ClaimPacketRequest(
            activity_id="act_claim_test",
            user_id="user_claim_001",
            user_name="测试用户",
            request_id="req_claim_001"
        )
        
        result = red_packet_service.claim_packet(claim_request)
        
        assert result.is_success == True
        assert result.status == "success"
        assert result.claimed_amount == 20.0
        
        activity = db_session.query(RedPacketActivity).filter(
            RedPacketActivity.activity_id == "act_claim_test"
        ).first()
        assert activity.remaining_count == 4
        assert activity.remaining_amount == 80.0

    def test_claim_packet_idempotent(self, red_packet_service, db_session):
        activity = RedPacketActivity(
            activity_id="act_idempotent_test",
            name="幂等测试活动",
            total_amount=100.0,
            total_count=5,
            remaining_amount=100.0,
            remaining_count=5,
            status=RedPacketStatus.ACTIVE.value,
            rule_type="fixed",
            merchant_id="merchant_test_008"
        )
        db_session.add(activity)
        
        for i in range(5):
            packet = RedPacket(
                packet_id=f"pkt_idem_{i}",
                activity_id="act_idempotent_test",
                amount=20.0,
                status=PacketStatus.PENDING.value
            )
            db_session.add(packet)
        
        db_session.commit()
        
        claim_request = ClaimPacketRequest(
            activity_id="act_idempotent_test",
            user_id="user_idem_001",
            request_id="req_idem_001"
        )
        
        result1 = red_packet_service.claim_packet(claim_request)
        result2 = red_packet_service.claim_packet(claim_request)
        
        assert result1.request_id == result2.request_id
        assert result1.is_success == result2.is_success
        
        activity = db_session.query(RedPacketActivity).filter(
            RedPacketActivity.activity_id == "act_idempotent_test"
        ).first()
        assert activity.remaining_count == 4

    def test_claim_packet_duplicate_user(self, red_packet_service, db_session):
        activity = RedPacketActivity(
            activity_id="act_duplicate_test",
            name="重复领取测试",
            total_amount=100.0,
            total_count=5,
            remaining_amount=100.0,
            remaining_count=5,
            status=RedPacketStatus.ACTIVE.value,
            rule_type="fixed",
            merchant_id="merchant_test_009"
        )
        db_session.add(activity)
        
        for i in range(5):
            packet = RedPacket(
                packet_id=f"pkt_dup_{i}",
                activity_id="act_duplicate_test",
                amount=20.0,
                status=PacketStatus.PENDING.value
            )
            db_session.add(packet)
        
        db_session.commit()
        
        claim_request1 = ClaimPacketRequest(
            activity_id="act_duplicate_test",
            user_id="user_dup_001",
            request_id="req_dup_001"
        )
        result1 = red_packet_service.claim_packet(claim_request1)
        assert result1.is_success == True
        
        claim_request2 = ClaimPacketRequest(
            activity_id="act_duplicate_test",
            user_id="user_dup_001",
            request_id="req_dup_002"
        )
        result2 = red_packet_service.claim_packet(claim_request2)
        
        assert result2.is_success == False
        assert "already claimed" in result2.error_message

    def test_claim_packet_inactive_activity(self, red_packet_service, db_session):
        activity = RedPacketActivity(
            activity_id="act_inactive_test",
            name="未激活活动",
            total_amount=100.0,
            total_count=5,
            remaining_amount=100.0,
            remaining_count=5,
            status=RedPacketStatus.DRAFT.value,
            rule_type="fixed",
            merchant_id="merchant_test_010"
        )
        db_session.add(activity)
        db_session.commit()
        
        claim_request = ClaimPacketRequest(
            activity_id="act_inactive_test",
            user_id="user_inactive_001",
            request_id="req_inactive_001"
        )
        
        result = red_packet_service.claim_packet(claim_request)
        
        assert result.is_success == False
        assert "not active" in result.error_message

    def test_claim_packet_frozen_activity(self, red_packet_service, db_session):
        activity = RedPacketActivity(
            activity_id="act_frozen_test",
            name="已冻结活动",
            total_amount=100.0,
            total_count=5,
            remaining_amount=100.0,
            remaining_count=5,
            status=RedPacketStatus.FROZEN.value,
            rule_type="fixed",
            merchant_id="merchant_test_011"
        )
        db_session.add(activity)
        db_session.commit()
        
        claim_request = ClaimPacketRequest(
            activity_id="act_frozen_test",
            user_id="user_frozen_001",
            request_id="req_frozen_001"
        )
        
        result = red_packet_service.claim_packet(claim_request)
        
        assert result.is_success == False

    def test_claim_packet_no_available(self, red_packet_service, db_session):
        activity = RedPacketActivity(
            activity_id="act_empty_test",
            name="已抢完活动",
            total_amount=100.0,
            total_count=1,
            remaining_amount=0.0,
            remaining_count=0,
            status=RedPacketStatus.COMPLETED.value,
            rule_type="fixed",
            merchant_id="merchant_test_012"
        )
        db_session.add(activity)
        
        packet = RedPacket(
            packet_id="pkt_empty_001",
            activity_id="act_empty_test",
            amount=100.0,
            status=PacketStatus.CLAIMED.value
        )
        db_session.add(packet)
        db_session.commit()
        
        claim_request = ClaimPacketRequest(
            activity_id="act_empty_test",
            user_id="user_empty_001",
            request_id="req_empty_001"
        )
        
        result = red_packet_service.claim_packet(claim_request)
        
        assert result.is_success == False
        assert "not active" in result.error_message or "No available" in result.error_message


class TestPaymentCallback:
    def test_payment_callback_success(self, red_packet_service, db_session):
        activity = RedPacketActivity(
            activity_id="act_payment_test",
            name="支付测试活动",
            total_amount=100.0,
            total_count=10,
            remaining_amount=100.0,
            remaining_count=10,
            status=RedPacketStatus.PENDING_PAYMENT.value,
            rule_type="random",
            merchant_id="merchant_test_013"
        )
        db_session.add(activity)
        
        payment = Payment(
            payment_id="pay_test_001",
            activity_id="act_payment_test",
            amount=100.0,
            status=PaymentStatus.PENDING.value,
            merchant_id="merchant_test_013"
        )
        db_session.add(payment)
        db_session.commit()
        
        callback_request = PaymentCallbackRequest(
            payment_id="pay_test_001",
            status="success",
            external_order_id="ext_123456"
        )
        
        result = red_packet_service.process_payment_callback(callback_request)
        
        assert result.status == PaymentStatus.SUCCESS.value
        assert result.callback_received == True
        assert result.external_order_id == "ext_123456"
        
        activity = db_session.query(RedPacketActivity).filter(
            RedPacketActivity.activity_id == "act_payment_test"
        ).first()
        assert activity.status == RedPacketStatus.ACTIVE.value

    def test_payment_callback_failed(self, red_packet_service, db_session):
        activity = RedPacketActivity(
            activity_id="act_payment_fail",
            name="支付失败测试",
            total_amount=100.0,
            total_count=10,
            remaining_amount=100.0,
            remaining_count=10,
            status=RedPacketStatus.PENDING_PAYMENT.value,
            rule_type="random",
            merchant_id="merchant_test_014"
        )
        db_session.add(activity)
        
        payment = Payment(
            payment_id="pay_fail_001",
            activity_id="act_payment_fail",
            amount=100.0,
            status=PaymentStatus.PENDING.value,
            merchant_id="merchant_test_014"
        )
        db_session.add(payment)
        db_session.commit()
        
        callback_request = PaymentCallbackRequest(
            payment_id="pay_fail_001",
            status="failed"
        )
        
        result = red_packet_service.process_payment_callback(callback_request)
        
        assert result.status == PaymentStatus.FAILED.value
        
        activity = db_session.query(RedPacketActivity).filter(
            RedPacketActivity.activity_id == "act_payment_fail"
        ).first()
        assert activity.status == RedPacketStatus.DRAFT.value

    def test_payment_callback_not_found(self, red_packet_service):
        callback_request = PaymentCallbackRequest(
            payment_id="pay_not_exist",
            status="success"
        )
        
        with pytest.raises(ValueError, match="Payment not found"):
            red_packet_service.process_payment_callback(callback_request)

    def test_payment_callback_already_processed(self, red_packet_service, db_session):
        activity = RedPacketActivity(
            activity_id="act_payment_already",
            name="已处理支付",
            total_amount=100.0,
            total_count=10,
            remaining_amount=100.0,
            remaining_count=10,
            status=RedPacketStatus.ACTIVE.value,
            rule_type="random",
            merchant_id="merchant_test_015"
        )
        db_session.add(activity)
        
        payment = Payment(
            payment_id="pay_already_001",
            activity_id="act_payment_already",
            amount=100.0,
            status=PaymentStatus.SUCCESS.value,
            merchant_id="merchant_test_015",
            callback_received=True
        )
        db_session.add(payment)
        db_session.commit()
        
        callback_request = PaymentCallbackRequest(
            payment_id="pay_already_001",
            status="success"
        )
        
        result = red_packet_service.process_payment_callback(callback_request)
        
        assert result.payment_id == "pay_already_001"


class TestRiskManagement:
    def test_risk_freeze_activity(self, red_packet_service, db_session):
        activity = RedPacketActivity(
            activity_id="act_risk_freeze",
            name="风控冻结测试",
            total_amount=100.0,
            total_count=10,
            remaining_amount=100.0,
            remaining_count=10,
            status=RedPacketStatus.ACTIVE.value,
            rule_type="random",
            merchant_id="merchant_test_016"
        )
        db_session.add(activity)
        db_session.commit()
        
        risk_request = RiskActionRequest(
            activity_id="act_risk_freeze",
            merchant_id="merchant_test_016",
            action=RiskAction.FREEZE,
            reason="检测到异常领取行为"
        )
        
        result = red_packet_service.process_risk_action(risk_request)
        
        assert result.action == RiskAction.FREEZE.value
        assert result.is_resolved == False
        
        activity = db_session.query(RedPacketActivity).filter(
            RedPacketActivity.activity_id == "act_risk_freeze"
        ).first()
        assert activity.status == RedPacketStatus.FROZEN.value

    def test_risk_unfreeze_activity(self, red_packet_service, db_session):
        activity = RedPacketActivity(
            activity_id="act_risk_unfreeze",
            name="风控解冻测试",
            total_amount=100.0,
            total_count=10,
            remaining_amount=100.0,
            remaining_count=10,
            status=RedPacketStatus.FROZEN.value,
            rule_type="random",
            merchant_id="merchant_test_017"
        )
        db_session.add(activity)
        db_session.commit()
        
        risk_request = RiskActionRequest(
            activity_id="act_risk_unfreeze",
            merchant_id="merchant_test_017",
            action=RiskAction.UNFREEZE,
            reason="风控复核通过"
        )
        
        result = red_packet_service.process_risk_action(risk_request)
        
        assert result.action == RiskAction.UNFREEZE.value
        assert result.is_resolved == True
        
        activity = db_session.query(RedPacketActivity).filter(
            RedPacketActivity.activity_id == "act_risk_unfreeze"
        ).first()
        assert activity.status == RedPacketStatus.ACTIVE.value

    def test_risk_activity_not_found(self, red_packet_service):
        risk_request = RiskActionRequest(
            activity_id="act_not_exist",
            merchant_id="merchant_test_018",
            action=RiskAction.FREEZE,
            reason="测试"
        )
        
        with pytest.raises(ValueError, match="Activity not found"):
            red_packet_service.process_risk_action(risk_request)


class TestLedgerAndAudit:
    def test_ledger_transaction_created(self, red_packet_service, db_session):
        activity_request = CreateRedPacketActivityRequest(
            name="流水测试活动",
            total_amount=100.0,
            total_count=10,
            merchant_id="merchant_test_019",
            rule_type="random"
        )
        activity = red_packet_service.create_activity(activity_request)
        
        lock_request = LockBudgetRequest(
            activity_id=activity.activity_id,
            merchant_id="merchant_test_019"
        )
        red_packet_service.lock_budget(lock_request)
        
        transactions = red_packet_service.get_ledger_transactions("merchant_test_019")
        
        assert len(transactions) >= 1
        assert any(t.transaction_type == "create_packet" for t in transactions)

    def test_audit_log_created(self, red_packet_service, db_session):
        activity_request = CreateRedPacketActivityRequest(
            name="审计测试活动",
            total_amount=100.0,
            total_count=10,
            merchant_id="merchant_test_020",
            rule_type="random"
        )
        activity = red_packet_service.create_activity(activity_request)
        
        audit_request = AuditExportRequest(
            merchant_id="merchant_test_020",
            start_time=datetime.utcnow() - timedelta(hours=1),
            end_time=datetime.utcnow() + timedelta(hours=1)
        )
        
        logs = red_packet_service.export_audit_logs(audit_request)
        
        assert len(logs) >= 1
        assert any(l.action == "create_activity" for l in logs)


class TestIdGeneration:
    def test_generate_id_unique(self):
        ids = set()
        for _ in range(100):
            new_id = generate_id("test")
            assert new_id not in ids
            ids.add(new_id)

    def test_generate_id_format(self):
        new_id = generate_id("act")
        assert new_id.startswith("act_")
        assert len(new_id) > 4
