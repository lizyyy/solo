import pytest
from datetime import datetime, timedelta


class TestExceptionInterception:
    def test_qualification_expired_interception(self, client, test_suppliers):
        primary = test_suppliers["primary"]
        expired_alt = test_suppliers["expired_alt"]
        
        response = client.post("/api/switches", json={
            "primary_supplier_id": primary.id,
            "alternative_supplier_id": expired_alt.id,
            "product_code": "TEST-PROD-001",
            "product_name": "测试产品A",
            "quantity": 500,
            "reason": "测试资质过期拦截场景",
            "requester": "测试员",
            "requester_department": "测试部"
        })
        assert response.status_code == 201
        switch_request_id = response.json()["switch_request_id"]
        
        response = client.get(f"/api/switches/{switch_request_id}/qualification-check")
        assert response.status_code == 200
        result = response.json()
        
        assert result["passed"] is False
        assert len(result["failed_qualifications"]) > 0
        assert "ISO9001" in result["message"]

    def test_validate_request_with_expired_qualification(self, client, test_suppliers):
        primary = test_suppliers["primary"]
        expired_alt = test_suppliers["expired_alt"]
        
        response = client.post("/api/switches", json={
            "primary_supplier_id": primary.id,
            "alternative_supplier_id": expired_alt.id,
            "product_code": "TEST-PROD-001",
            "product_name": "测试产品A",
            "quantity": 500,
            "reason": "测试资质校验",
            "requester": "测试员",
            "requester_department": "测试部"
        })
        switch_request_id = response.json()["switch_request_id"]
        
        approval_response = client.post("/api/approvals", json={
            "switch_request_id": switch_request_id,
            "approver": "审批人",
            "approver_department": "测试部",
            "approval_level": 1
        })
        approval_id = approval_response.json()["id"]
        
        client.post(
            f"/api/approvals/{approval_id}/approve",
            params={"approver": "审批人"}
        )
        
        response = client.post(f"/api/switches/{switch_request_id}/execute")
        assert response.status_code == 400
        assert "资质校验不通过" in response.json()["detail"]
        
        response = client.get(f"/api/switches/{switch_request_id}")
        assert response.status_code == 200
        switch_request = response.json()
        assert switch_request["status"] == "failed"

    def test_exception_record_created_on_qualification_failure(self, client, test_suppliers):
        primary = test_suppliers["primary"]
        expired_alt = test_suppliers["expired_alt"]
        
        response = client.post("/api/switches", json={
            "primary_supplier_id": primary.id,
            "alternative_supplier_id": expired_alt.id,
            "product_code": "TEST-PROD-001",
            "product_name": "测试产品A",
            "quantity": 500,
            "reason": "测试异常记录",
            "requester": "测试员",
            "requester_department": "测试部"
        })
        switch_request_id = response.json()["switch_request_id"]
        
        approval_response = client.post("/api/approvals", json={
            "switch_request_id": switch_request_id,
            "approver": "审批人",
            "approver_department": "测试部",
            "approval_level": 1
        })
        approval_id = approval_response.json()["id"]
        
        client.post(
            f"/api/approvals/{approval_id}/approve",
            params={"approver": "审批人"}
        )
        
        client.post(f"/api/switches/{switch_request_id}/execute")
        
        response = client.get(f"/api/exceptions/switch-request/{switch_request_id}")
        assert response.status_code == 200
        exceptions = response.json()
        
        assert len(exceptions) > 0
        qualification_exceptions = [e for e in exceptions if e["exception_type"] == "qualification_failed"]
        assert len(qualification_exceptions) > 0

    def test_price_abnormal_detection(self, client, test_suppliers, db):
        from app.models import PriceSnapshot
        
        primary = test_suppliers["primary"]
        good_alt = test_suppliers["good_alt"]
        
        high_price = PriceSnapshot(
            supplier_id=good_alt.id,
            product_code="TEST-PROD-001",
            product_name="测试产品A",
            unit_price=130.00,
            is_current=True
        )
        existing = db.query(PriceSnapshot).filter(
            PriceSnapshot.supplier_id == good_alt.id,
            PriceSnapshot.product_code == "TEST-PROD-001",
            PriceSnapshot.is_current == True
        ).first()
        if existing:
            existing.is_current = False
        db.add(high_price)
        db.commit()
        
        response = client.post("/api/switches", json={
            "primary_supplier_id": primary.id,
            "alternative_supplier_id": good_alt.id,
            "product_code": "TEST-PROD-001",
            "product_name": "测试产品A",
            "quantity": 100,
            "reason": "测试价格异常检测",
            "requester": "测试员",
            "requester_department": "测试部"
        })
        switch_request_id = response.json()["switch_request_id"]
        
        response = client.post(f"/api/switches/{switch_request_id}/validate")
        assert response.status_code == 200
        validation = response.json()
        
        assert validation["valid"] is True
        assert validation["price_check"]["is_abnormal"] is True

    def test_exception_query_and_resolution(self, client, test_suppliers):
        response = client.post("/api/exceptions", json={
            "exception_type": "system_error",
            "description": "测试系统异常",
            "detail": "这是一个测试异常记录"
        })
        assert response.status_code == 201
        exception_id = response.json()["id"]
        
        response = client.get("/api/exceptions/pending")
        assert response.status_code == 200
        pending = response.json()
        assert any(e["id"] == exception_id for e in pending)
        
        response = client.post(
            f"/api/exceptions/{exception_id}/resolve",
            params={"resolved_by": "测试处理人", "resolution_detail": "已修复测试异常"}
        )
        assert response.status_code == 200
        resolved = response.json()
        assert resolved["is_resolved"] is True
        assert resolved["resolved_by"] == "测试处理人"
        
        response = client.get("/api/exceptions", params={"is_resolved": True})
        assert response.status_code == 200
        resolved_list = response.json()
        assert any(e["id"] == exception_id for e in resolved_list)

    def test_exception_statistics(self, client, test_suppliers):
        for i in range(3):
            client.post("/api/exceptions", json={
                "exception_type": "delivery_delay",
                "description": f"测试交期延误异常 {i+1}",
                "detail": f"这是第 {i+1} 个测试异常"
            })
        
        response = client.get("/api/exceptions/statistics")
        assert response.status_code == 200
        stats = response.json()
        
        assert stats["total"] >= 3
        assert stats["pending"] >= 3
        assert stats["by_type"]["delivery_delay"] >= 3

    def test_invalid_supplier_interception(self, client, test_suppliers):
        response = client.post("/api/switches", json={
            "primary_supplier_id": 99999,
            "alternative_supplier_id": 99998,
            "product_code": "TEST-PROD-001",
            "product_name": "测试产品A",
            "quantity": 100,
            "reason": "测试无效供应商",
            "requester": "测试员",
            "requester_department": "测试部"
        })
        
        assert response.status_code == 400
        assert "主供应商不存在" in response.json()["detail"]

    def test_execute_without_approval(self, client, test_suppliers):
        primary = test_suppliers["primary"]
        good_alt = test_suppliers["good_alt"]
        
        response = client.post("/api/switches", json={
            "primary_supplier_id": primary.id,
            "alternative_supplier_id": good_alt.id,
            "product_code": "TEST-PROD-001",
            "product_name": "测试产品A",
            "quantity": 100,
            "reason": "测试未审批执行",
            "requester": "测试员",
            "requester_department": "测试部"
        })
        switch_request_id = response.json()["switch_request_id"]
        
        response = client.post(f"/api/switches/{switch_request_id}/execute")
        assert response.status_code == 400
        assert "尚未获得审批" in response.json()["detail"]
