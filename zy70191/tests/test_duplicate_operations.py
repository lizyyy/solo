import pytest
from datetime import datetime, timedelta


class TestDuplicateOperations:
    def test_duplicate_switch_request_detection(self, client, test_suppliers):
        primary = test_suppliers["primary"]
        good_alt = test_suppliers["good_alt"]
        
        response = client.post("/api/switches", json={
            "primary_supplier_id": primary.id,
            "alternative_supplier_id": good_alt.id,
            "product_code": "TEST-PROD-001",
            "product_name": "测试产品A",
            "quantity": 1000,
            "reason": "第一次申请",
            "requester": "测试员",
            "requester_department": "测试部"
        })
        assert response.status_code == 201
        first_result = response.json()
        first_request_no = first_result["details"]["request_no"]
        
        response = client.post("/api/switches", json={
            "primary_supplier_id": primary.id,
            "alternative_supplier_id": good_alt.id,
            "product_code": "TEST-PROD-001",
            "product_name": "测试产品A",
            "quantity": 500,
            "reason": "第二次重复申请",
            "requester": "测试员",
            "requester_department": "测试部"
        })
        
        assert response.status_code == 400
        assert "重复切换申请" in response.json()["detail"]

    def test_duplicate_request_creates_exception_record(self, client, test_suppliers):
        primary = test_suppliers["primary"]
        good_alt = test_suppliers["good_alt"]
        
        response = client.post("/api/switches", json={
            "primary_supplier_id": primary.id,
            "alternative_supplier_id": good_alt.id,
            "product_code": "TEST-PROD-001",
            "product_name": "测试产品A",
            "quantity": 1000,
            "reason": "第一次申请",
            "requester": "测试员",
            "requester_department": "测试部"
        })
        first_request_id = response.json()["switch_request_id"]
        
        client.post("/api/switches", json={
            "primary_supplier_id": primary.id,
            "alternative_supplier_id": good_alt.id,
            "product_code": "TEST-PROD-001",
            "product_name": "测试产品A",
            "quantity": 500,
            "reason": "第二次重复申请",
            "requester": "测试员",
            "requester_department": "测试部"
        })
        
        response = client.get(f"/api/exceptions/switch-request/{first_request_id}")
        assert response.status_code == 200
        exceptions = response.json()
        
        duplicate_exceptions = [e for e in exceptions if e["exception_type"] == "duplicate_request"]
        assert len(duplicate_exceptions) > 0

    def test_duplicate_approval_prevention(self, client, test_suppliers):
        primary = test_suppliers["primary"]
        good_alt = test_suppliers["good_alt"]
        
        response = client.post("/api/switches", json={
            "primary_supplier_id": primary.id,
            "alternative_supplier_id": good_alt.id,
            "product_code": "TEST-PROD-001",
            "product_name": "测试产品A",
            "quantity": 1000,
            "reason": "测试重复审批",
            "requester": "测试员",
            "requester_department": "测试部"
        })
        switch_request_id = response.json()["switch_request_id"]
        
        first_approval = client.post("/api/approvals", json={
            "switch_request_id": switch_request_id,
            "approver": "审批人-李总",
            "approver_department": "供应链部",
            "approval_level": 1,
            "comment": "第一次审批"
        })
        assert first_approval.status_code == 201
        first_approval_id = first_approval.json()["id"]
        
        second_approval = client.post("/api/approvals", json={
            "switch_request_id": switch_request_id,
            "approver": "审批人-王总",
            "approver_department": "供应链部",
            "approval_level": 1,
            "comment": "第二次审批"
        })
        assert second_approval.status_code == 400
        assert "无法创建审批记录" in second_approval.json()["detail"]

    def test_execute_completed_allows_new_request(self, client, test_suppliers):
        primary = test_suppliers["primary"]
        good_alt = test_suppliers["good_alt"]
        
        response = client.post("/api/switches", json={
            "primary_supplier_id": primary.id,
            "alternative_supplier_id": good_alt.id,
            "product_code": "TEST-PROD-001",
            "product_name": "测试产品A",
            "quantity": 1000,
            "reason": "第一次申请",
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
        
        response = client.post("/api/switches", json={
            "primary_supplier_id": primary.id,
            "alternative_supplier_id": good_alt.id,
            "product_code": "TEST-PROD-001",
            "product_name": "测试产品A",
            "quantity": 2000,
            "reason": "执行完成后的新申请",
            "requester": "测试员",
            "requester_department": "测试部"
        })
        
        assert response.status_code == 201
        assert response.json()["success"] is True

    def test_different_product_allows_same_suppliers(self, client, test_suppliers, db):
        from app.models import PriceSnapshot
        
        primary = test_suppliers["primary"]
        good_alt = test_suppliers["good_alt"]
        
        db.add(PriceSnapshot(
            supplier_id=primary.id,
            product_code="TEST-PROD-002",
            product_name="测试产品B",
            unit_price=200.00,
            is_current=True
        ))
        db.add(PriceSnapshot(
            supplier_id=good_alt.id,
            product_code="TEST-PROD-002",
            product_name="测试产品B",
            unit_price=210.00,
            is_current=True
        ))
        db.commit()
        
        response = client.post("/api/switches", json={
            "primary_supplier_id": primary.id,
            "alternative_supplier_id": good_alt.id,
            "product_code": "TEST-PROD-001",
            "product_name": "测试产品A",
            "quantity": 1000,
            "reason": "产品A的申请",
            "requester": "测试员",
            "requester_department": "测试部"
        })
        assert response.status_code == 201
        
        response = client.post("/api/switches", json={
            "primary_supplier_id": primary.id,
            "alternative_supplier_id": good_alt.id,
            "product_code": "TEST-PROD-002",
            "product_name": "测试产品B",
            "quantity": 500,
            "reason": "产品B的申请（不同产品，不视为重复）",
            "requester": "测试员",
            "requester_department": "测试部"
        })
        
        assert response.status_code == 201
        assert response.json()["success"] is True

    def test_rejected_allows_new_request(self, client, test_suppliers):
        primary = test_suppliers["primary"]
        good_alt = test_suppliers["good_alt"]
        
        response = client.post("/api/switches", json={
            "primary_supplier_id": primary.id,
            "alternative_supplier_id": good_alt.id,
            "product_code": "TEST-PROD-001",
            "product_name": "测试产品A",
            "quantity": 1000,
            "reason": "第一次申请",
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
            f"/api/approvals/{approval_id}/reject",
            params={"approver": "审批人", "comment": "价格过高，拒绝"}
        )
        
        response = client.post("/api/switches", json={
            "primary_supplier_id": primary.id,
            "alternative_supplier_id": good_alt.id,
            "product_code": "TEST-PROD-001",
            "product_name": "测试产品A",
            "quantity": 800,
            "reason": "被拒绝后的新申请",
            "requester": "测试员",
            "requester_department": "测试部"
        })
        
        assert response.status_code == 201
        assert response.json()["success"] is True
