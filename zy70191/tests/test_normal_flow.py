import pytest
from datetime import datetime, timedelta


class TestNormalSupplierSwitchFlow:
    def test_create_switch_request_success(self, client, test_suppliers):
        primary = test_suppliers["primary"]
        good_alt = test_suppliers["good_alt"]
        
        response = client.post("/api/switches", json={
            "primary_supplier_id": primary.id,
            "alternative_supplier_id": good_alt.id,
            "product_code": "TEST-PROD-001",
            "product_name": "测试产品A",
            "quantity": 1000,
            "reason": "主供应商生产线故障，需要紧急切换",
            "requester": "测试员-张三",
            "requester_department": "采购部"
        })
        
        assert response.status_code == 201
        result = response.json()
        assert result["success"] is True
        assert "request_no" in result["details"]
        switch_request_id = result["switch_request_id"]
        
        list_response = client.get("/api/switches")
        assert list_response.status_code == 200
        requests = list_response.json()
        assert len(requests) == 1
        assert requests[0]["id"] == switch_request_id
        assert requests[0]["status"] == "pending"
        
        return switch_request_id

    def test_qualification_check_pass(self, client, test_suppliers):
        good_alt = test_suppliers["good_alt"]
        
        response = client.get(f"/api/suppliers/{good_alt.id}/qualifications")
        assert response.status_code == 200
        qualifications = response.json()
        assert len(qualifications) == 2
        
        switch_request_id = self.test_create_switch_request_success(client, test_suppliers)
        
        response = client.get(f"/api/switches/{switch_request_id}/qualification-check")
        assert response.status_code == 200
        result = response.json()
        assert result["passed"] is True
        assert result["failed_qualifications"] == []

    def test_price_comparison_normal(self, client, test_suppliers):
        primary = test_suppliers["primary"]
        good_alt = test_suppliers["good_alt"]
        
        switch_request_id = self.test_create_switch_request_success(client, test_suppliers)
        
        response = client.get(f"/api/switches/{switch_request_id}/price-comparison")
        assert response.status_code == 200
        comparison = response.json()
        
        assert comparison["product_code"] == "TEST-PROD-001"
        assert comparison["primary_price"] == 100.00
        assert comparison["alternative_price"] == 105.00
        assert comparison["price_difference"] == 5.00
        assert comparison["price_difference_percent"] == 5.0

    def test_approval_flow(self, client, test_suppliers):
        switch_request_id = self.test_create_switch_request_success(client, test_suppliers)
        
        response = client.post("/api/approvals", json={
            "switch_request_id": switch_request_id,
            "approver": "审批人-李总",
            "approver_department": "供应链管理部",
            "approval_level": 1,
            "comment": "资质齐全，价格合理，同意切换"
        })
        assert response.status_code == 201
        approval = response.json()
        approval_id = approval["id"]
        assert approval["status"] == "pending"
        
        response = client.post(
            f"/api/approvals/{approval_id}/approve",
            params={"approver": "审批人-李总", "comment": "同意"}
        )
        assert response.status_code == 200
        result = response.json()
        assert result["status"] == "approved"
        
        response = client.get(f"/api/switches/{switch_request_id}")
        assert response.status_code == 200
        switch_request = response.json()
        assert switch_request["status"] == "approved"

    def test_delivery_impact_analysis(self, client, test_suppliers):
        switch_request_id = self.test_create_switch_request_success(client, test_suppliers)
        
        original_date = (datetime.utcnow() + timedelta(days=7)).isoformat()
        
        response = client.post(
            "/api/delivery/analyze",
            params={
                "switch_request_id": switch_request_id,
                "original_delivery_date": original_date,
                "standard_delivery_days": 5
            }
        )
        assert response.status_code == 200
        analysis = response.json()
        
        assert analysis["switch_request_id"] == switch_request_id
        assert analysis["delay_days"] == 5
        assert analysis["impact_level"] in ["轻微影响", "中等影响"]
        assert len(analysis["mitigation_measures"]) > 0

    def test_generate_switch_report(self, client, test_suppliers):
        switch_request_id = self.test_create_switch_request_success(client, test_suppliers)
        
        response = client.post(
            f"/api/reports/switch-request/{switch_request_id}",
            params={"generated_by": "系统自动生成"}
        )
        assert response.status_code == 201
        report = response.json()
        report_id = report["id"]
        
        response = client.get(f"/api/reports/{report_id}")
        assert response.status_code == 200
        report_detail = response.json()
        
        assert "report_header" in report_detail["content"]
        assert "supplier_information" in report_detail["content"]
        assert "qualification_check" in report_detail["content"]
        assert "price_analysis" in report_detail["content"]
        assert "recommendation" in report_detail["content"]

    def test_execute_switch_after_approval(self, client, test_suppliers):
        switch_request_id = self.test_create_switch_request_success(client, test_suppliers)
        
        approval_response = client.post("/api/approvals", json={
            "switch_request_id": switch_request_id,
            "approver": "审批人-王总",
            "approver_department": "供应链管理部",
            "approval_level": 1
        })
        approval_id = approval_response.json()["id"]
        
        client.post(
            f"/api/approvals/{approval_id}/approve",
            params={"approver": "审批人-王总"}
        )
        
        response = client.post(f"/api/switches/{switch_request_id}/execute")
        assert response.status_code == 200
        result = response.json()
        
        assert result["success"] is True
        assert result["message"] == "切换执行成功"
        
        response = client.get(f"/api/switches/{switch_request_id}")
        assert response.status_code == 200
        switch_request = response.json()
        assert switch_request["status"] == "executed"
