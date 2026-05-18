import pytest
from httpx import AsyncClient, ASGITransport
from datetime import datetime
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app
from database import Base, engine, SessionLocal
from services import LeaderService, CommissionRuleService, OrderService, RefundService, AuditLogService
import schemas


@pytest.fixture(scope="function")
def test_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def sample_leader(test_db):
    return LeaderService.create_leader(test_db, schemas.LeaderCreate(
        leader_code="TEST001",
        name="测试团长",
        phone="13800000001",
        email="test@example.com"
    ))


@pytest.fixture(scope="function")
def sample_commission_rules(test_db):
    rules = [
        CommissionRuleService.create_rule(test_db, schemas.CommissionRuleCreate(
            tier_min=0, tier_max=1000, commission_rate=0.08
        )),
        CommissionRuleService.create_rule(test_db, schemas.CommissionRuleCreate(
            tier_min=1000, tier_max=5000, commission_rate=0.10
        )),
        CommissionRuleService.create_rule(test_db, schemas.CommissionRuleCreate(
            tier_min=5000, tier_max=None, commission_rate=0.12
        )),
    ]
    return rules


@pytest.mark.asyncio
async def test_create_leader(test_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/leaders/", json={
            "leader_code": "API001",
            "name": "API团长",
            "phone": "13900000001",
            "email": "api@example.com"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["leader_code"] == "API001"
        assert data["name"] == "API团长"


@pytest.mark.asyncio
async def test_create_order(test_db, sample_leader):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/orders/", json={
            "order_no": "ORDAPI001",
            "leader_id": sample_leader.id,
            "user_name": "测试用户",
            "user_phone": "13800000001",
            "total_amount": 299.0,
            "product_count": 1,
            "processed_by": "test_user"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["order_no"] == "ORDAPI001"
        assert data["total_amount"] == 299.0


@pytest.mark.asyncio
async def test_duplicate_order_detection_with_audit_log(test_db, sample_leader):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response1 = await client.post("/orders/", json={
            "order_no": "DUP001",
            "leader_id": sample_leader.id,
            "user_name": "用户1",
            "user_phone": "13800000002",
            "total_amount": 199.0,
            "product_count": 1,
            "processed_by": "operator_a"
        })
        assert response1.status_code == 200
        
        logs_before = AuditLogService.get_all_logs(test_db)
        
        response2 = await client.post("/orders/", json={
            "order_no": "DUP001",
            "leader_id": sample_leader.id,
            "user_name": "用户2",
            "user_phone": "13800000003",
            "total_amount": 199.0,
            "product_count": 1,
            "processed_by": "operator_b"
        })
        assert response2.status_code == 400
        
        logs_after = AuditLogService.get_all_logs(test_db)
        assert len(logs_after) > len(logs_before)
        
        failed_logs = [log for log in logs_after if log.action == "create_order_failed"]
        assert len(failed_logs) >= 1
        assert failed_logs[0].processed_by == "operator_b"
        assert "订单号已存在" in failed_logs[0].conclusion


@pytest.mark.asyncio
async def test_create_order_invalid_leader_with_audit_log(test_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/orders/", json={
            "order_no": "INVALID001",
            "leader_id": 99999,
            "user_name": "测试用户",
            "user_phone": "13800000001",
            "total_amount": 100.0,
            "product_count": 1,
            "processed_by": "test_operator"
        })
        assert response.status_code == 400
        
        logs = AuditLogService.get_all_logs(test_db)
        failed_logs = [log for log in logs if log.action == "create_order_failed"]
        assert len(failed_logs) >= 1
        assert failed_logs[0].processed_by == "test_operator"
        assert "团长不存在" in failed_logs[0].conclusion


@pytest.mark.asyncio
async def test_full_settlement_flow(test_db, sample_leader, sample_commission_rules):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        order_response = await client.post("/orders/", json={
            "order_no": "SETT001",
            "leader_id": sample_leader.id,
            "user_name": "结算用户",
            "user_phone": "13800000004",
            "total_amount": 1000.0,
            "product_count": 2,
            "processed_by": "order_operator"
        })
        assert order_response.status_code == 200
        order_id = order_response.json()["id"]
        
        refund_response = await client.post("/refunds/", json={
            "refund_no": "REFSETT001",
            "order_id": order_id,
            "refund_amount": 100.0,
            "refund_reason": "质量问题",
            "processed_by": "refund_operator"
        })
        assert refund_response.status_code == 200
        refund_id = refund_response.json()["id"]
        
        process_refund_response = await client.put(f"/refunds/{refund_id}/process?processed_by=approve_operator")
        assert process_refund_response.status_code == 200
        
        settlement_response = await client.post("/settlements/", json={
            "leader_id": sample_leader.id,
            "start_date": "2025-01-01T00:00:00",
            "end_date": "2026-12-31T23:59:59",
            "processed_by": "settlement_operator"
        })
        assert settlement_response.status_code == 200
        settlement_id = settlement_response.json()["id"]
        
        calculate_response = await client.post("/settlements/calculate", json={
            "settlement_id": settlement_id,
            "processed_by": "finance"
        })
        assert calculate_response.status_code == 200
        calc_data = calculate_response.json()
        assert calc_data["total_order_amount"] == 1000.0
        assert calc_data["total_refund_amount"] == 100.0
        assert calc_data["net_order_amount"] == 900.0
        assert calc_data["status"] == "calculated"
        
        process_response = await client.post("/settlements/process", json={
            "settlement_id": settlement_id,
            "processed_by": "manager"
        })
        assert process_response.status_code == 200
        proc_data = process_response.json()
        assert proc_data["status"] == "processed"
        
        export_response = await client.get(f"/settlements/{settlement_id}/export")
        assert export_response.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in export_response.headers["content-type"]
        
        logs_response = await client.get(f"/settlements/{settlement_id}/audit-logs")
        assert logs_response.status_code == 200
        logs = logs_response.json()
        assert len(logs) >= 3


@pytest.mark.asyncio
async def test_adjustment(test_db, sample_leader, sample_commission_rules):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        order_response = await client.post("/orders/", json={
            "order_no": "ADJ001",
            "leader_id": sample_leader.id,
            "user_name": "修正用户",
            "user_phone": "13800000005",
            "total_amount": 500.0,
            "product_count": 1,
            "processed_by": "order_op"
        })
        assert order_response.status_code == 200
        
        settlement_response = await client.post("/settlements/", json={
            "leader_id": sample_leader.id,
            "start_date": "2025-01-01T00:00:00",
            "end_date": "2026-12-31T23:59:59",
            "processed_by": "settlement_op"
        })
        settlement_id = settlement_response.json()["id"]
        
        await client.post("/settlements/calculate", json={
            "settlement_id": settlement_id,
            "processed_by": "finance"
        })
        
        adjustment_response = await client.post("/adjustments/", json={
            "settlement_id": settlement_id,
            "adjustment_type": "add_commission",
            "amount": 50.0,
            "reason": "测试奖励",
            "processed_by": "manager"
        })
        assert adjustment_response.status_code == 200
        
        get_settlement_response = await client.get(f"/settlements/{settlement_id}")
        assert get_settlement_response.status_code == 200
        final_amount = get_settlement_response.json()["final_leader_amount"]
        assert final_amount > 0


@pytest.mark.asyncio
async def test_adjustment_on_draft_settlement_with_audit_log(test_db, sample_leader):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        settlement_response = await client.post("/settlements/", json={
            "leader_id": sample_leader.id,
            "start_date": "2025-01-01T00:00:00",
            "end_date": "2026-12-31T23:59:59",
            "processed_by": "settlement_op"
        })
        settlement_id = settlement_response.json()["id"]
        
        adjustment_response = await client.post("/adjustments/", json={
            "settlement_id": settlement_id,
            "adjustment_type": "add_commission",
            "amount": 100.0,
            "reason": "测试",
            "processed_by": "manager"
        })
        assert adjustment_response.status_code == 400
        
        logs = AuditLogService.get_logs_by_settlement(test_db, settlement_id)
        failed_logs = [log for log in logs if log.action == "create_adjustment_failed"]
        assert len(failed_logs) >= 1
        assert failed_logs[0].processed_by == "manager"
        assert "状态不正确" in failed_logs[0].conclusion


@pytest.mark.asyncio
async def test_close_settlement(test_db, sample_leader, sample_commission_rules):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        order_response = await client.post("/orders/", json={
            "order_no": "CLOSE001",
            "leader_id": sample_leader.id,
            "user_name": "关闭用户",
            "user_phone": "13800000006",
            "total_amount": 300.0,
            "product_count": 1,
            "processed_by": "order_op"
        })
        assert order_response.status_code == 200
        
        settlement_response = await client.post("/settlements/", json={
            "leader_id": sample_leader.id,
            "start_date": "2025-01-01T00:00:00",
            "end_date": "2026-12-31T23:59:59",
            "processed_by": "settlement_op"
        })
        settlement_id = settlement_response.json()["id"]
        
        await client.post("/settlements/calculate", json={
            "settlement_id": settlement_id,
            "processed_by": "finance"
        })
        
        close_response = await client.post("/settlements/close", json={
            "settlement_id": settlement_id,
            "processed_by": "admin",
            "close_reason": "测试关闭"
        })
        assert close_response.status_code == 200
        assert close_response.json()["status"] == "closed"
        
        logs_response = await client.get(f"/settlements/{settlement_id}/audit-logs")
        assert logs_response.status_code == 200
        assert len(logs_response.json()) > 0


@pytest.mark.asyncio
async def test_calculate_on_already_processed_with_audit_log(test_db, sample_leader, sample_commission_rules):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        order_response = await client.post("/orders/", json={
            "order_no": "ERR001",
            "leader_id": sample_leader.id,
            "user_name": "错误用户",
            "user_phone": "13800000007",
            "total_amount": 200.0,
            "product_count": 1,
            "processed_by": "order_op"
        })
        assert order_response.status_code == 200
        
        settlement_response = await client.post("/settlements/", json={
            "leader_id": sample_leader.id,
            "start_date": "2025-01-01T00:00:00",
            "end_date": "2026-12-31T23:59:59",
            "processed_by": "settlement_op"
        })
        settlement_id = settlement_response.json()["id"]
        
        await client.post("/settlements/calculate", json={
            "settlement_id": settlement_id,
            "processed_by": "finance"
        })
        
        await client.post("/settlements/process", json={
            "settlement_id": settlement_id,
            "processed_by": "manager"
        })
        
        recalculate_response = await client.post("/settlements/calculate", json={
            "settlement_id": settlement_id,
            "processed_by": "finance"
        })
        assert recalculate_response.status_code == 400
        
        logs = AuditLogService.get_logs_by_settlement(test_db, settlement_id)
        failed_logs = [log for log in logs if log.action == "calculate_settlement_failed"]
        assert len(failed_logs) >= 1
        assert failed_logs[0].processed_by == "finance"
        assert "状态不正确" in failed_logs[0].conclusion


@pytest.mark.asyncio
async def test_process_refund_already_processed_with_audit_log(test_db, sample_leader):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        order_response = await client.post("/orders/", json={
            "order_no": "REFERR001",
            "leader_id": sample_leader.id,
            "user_name": "测试用户",
            "user_phone": "13800000008",
            "total_amount": 100.0,
            "product_count": 1,
            "processed_by": "order_op"
        })
        order_id = order_response.json()["id"]
        
        refund_response = await client.post("/refunds/", json={
            "refund_no": "REFERR001",
            "order_id": order_id,
            "refund_amount": 50.0,
            "refund_reason": "测试",
            "processed_by": "refund_op"
        })
        refund_id = refund_response.json()["id"]
        
        await client.put(f"/refunds/{refund_id}/process?processed_by=approve_op")
        
        retry_response = await client.put(f"/refunds/{refund_id}/process?processed_by=approve_op2")
        assert retry_response.status_code == 400
        
        logs = AuditLogService.get_all_logs(test_db)
        failed_logs = [log for log in logs if log.action == "process_refund_failed"]
        assert len(failed_logs) >= 1
        assert failed_logs[0].processed_by == "approve_op2"
        assert "退款已处理" in failed_logs[0].conclusion


@pytest.mark.asyncio
async def test_create_refund_invalid_order_with_audit_log(test_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        refund_response = await client.post("/refunds/", json={
            "refund_no": "INVREF001",
            "order_id": 99999,
            "refund_amount": 50.0,
            "refund_reason": "测试无效订单",
            "processed_by": "test_op"
        })
        assert refund_response.status_code == 404
        
        logs = AuditLogService.get_all_logs(test_db)
        failed_logs = [log for log in logs if log.action == "create_refund_failed"]
        assert len(failed_logs) >= 1
        assert failed_logs[0].processed_by == "test_op"
        assert "订单不存在" in failed_logs[0].conclusion


@pytest.mark.asyncio
async def test_create_settlement_invalid_leader_with_audit_log(test_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        settlement_response = await client.post("/settlements/", json={
            "leader_id": 99999,
            "start_date": "2025-01-01T00:00:00",
            "end_date": "2026-12-31T23:59:59",
            "processed_by": "test_op"
        })
        assert settlement_response.status_code == 404
        
        logs = AuditLogService.get_all_logs(test_db)
        failed_logs = [log for log in logs if log.action == "create_settlement_failed"]
        assert len(failed_logs) >= 1
        assert failed_logs[0].processed_by == "test_op"
        assert "团长不存在" in failed_logs[0].conclusion


@pytest.mark.asyncio
async def test_audit_logs_creation(test_db, sample_leader, sample_commission_rules):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        order_response = await client.post("/orders/", json={
            "order_no": "AUDIT001",
            "leader_id": sample_leader.id,
            "user_name": "审计用户",
            "user_phone": "13800000008",
            "total_amount": 800.0,
            "product_count": 2,
            "processed_by": "order_op"
        })
        assert order_response.status_code == 200
        
        settlement_response = await client.post("/settlements/", json={
            "leader_id": sample_leader.id,
            "start_date": "2025-01-01T00:00:00",
            "end_date": "2026-12-31T23:59:59",
            "processed_by": "settlement_op"
        })
        settlement_id = settlement_response.json()["id"]
        
        await client.post("/settlements/calculate", json={
            "settlement_id": settlement_id,
            "processed_by": "finance"
        })
        
        await client.post("/settlements/process", json={
            "settlement_id": settlement_id,
            "processed_by": "manager"
        })
        
        logs_response = await client.get(f"/settlements/{settlement_id}/audit-logs")
        assert logs_response.status_code == 200
        logs = logs_response.json()
        assert len(logs) >= 2
        
        actions = [log["action"] for log in logs]
        assert "calculate" in actions or "calculate_settlement_success" in actions
        assert "process" in actions or "process_settlement_success" in actions
        
        for log in logs:
            assert log["processed_by"] is not None
            assert log["original_input"] is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
