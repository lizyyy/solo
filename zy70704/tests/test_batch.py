import pytest
from datetime import datetime, timedelta
from app.models.models import BatchStatus, OverrideStrategy


class TestBatchAPI:
    def test_create_batch(self, client):
        """测试创建灰度批次"""
        response = client.post(
            "/api/v1/batches/",
            json={
                "batch_code": "TEST-001",
                "batch_name": "测试批次",
                "description": "测试用批次",
                "override_strategy": "protect",
                "created_by": "test_user",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["batch_code"] == "TEST-001"
        assert data["status"] == "pending"

    def test_create_batch_duplicate_code(self, client):
        """测试创建批次时重复编码"""
        client.post(
            "/api/v1/batches/",
            json={
                "batch_code": "TEST-001",
                "batch_name": "测试批次1",
                "created_by": "test_user",
            },
        )
        response = client.post(
            "/api/v1/batches/",
            json={
                "batch_code": "TEST-001",
                "batch_name": "测试批次2",
                "created_by": "test_user",
            },
        )
        assert response.status_code == 400

    def test_get_batch(self, client, test_batch):
        """测试获取批次详情"""
        response = client.get(f"/api/v1/batches/{test_batch.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_batch.id
        assert data["batch_code"] == "TEST-BATCH-001"

    def test_get_batch_not_found(self, client):
        """测试获取不存在的批次"""
        response = client.get("/api/v1/batches/99999")
        assert response.status_code == 404

    def test_list_batches(self, client, test_batch):
        """测试获取批次列表"""
        response = client.get("/api/v1/batches/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_update_batch(self, client, test_batch):
        """测试更新批次"""
        response = client.put(
            f"/api/v1/batches/{test_batch.id}",
            json={
                "batch_name": "更新后的批次名",
                "description": "更新后的描述",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["batch_name"] == "更新后的批次名"

    def test_transition_status_valid(self, client, test_batch):
        """测试有效的状态转换"""
        response = client.post(
            f"/api/v1/batches/{test_batch.id}/transition",
            json={
                "target_status": "approving",
                "operator": "test_user",
                "comment": "提交审批",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approving"

    def test_transition_status_invalid(self, client, test_batch):
        """测试无效的状态转换（直接从pending到completed）"""
        response = client.post(
            f"/api/v1/batches/{test_batch.id}/transition",
            json={
                "target_status": "completed",
                "operator": "test_user",
                "comment": "跳过审批直接完成",
            },
        )
        assert response.status_code == 400

    def test_cancel_batch(self, client, test_batch):
        """测试取消批次"""
        response = client.post(
            f"/api/v1/batches/{test_batch.id}/cancel",
            params={"operator": "test_user", "reason": "测试取消"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "cancelled"

    def test_audit_records_created(self, client, test_batch, db):
        """测试状态转换时自动创建审核记录"""
        client.post(
            f"/api/v1/batches/{test_batch.id}/transition",
            json={
                "target_status": "approving",
                "operator": "test_user",
                "comment": "提交审批",
            },
        )

        response = client.get(f"/api/v1/audit-records/?batch_id={test_batch.id}")
        assert response.status_code == 200
        records = response.json()
        assert len(records) >= 1
        assert records[0]["operator"] == "test_user"


class TestBatchLifecycle:
    def test_full_lifecycle(self, client, test_batch):
        """测试完整的批次生命周期"""
        # pending -> approving
        response = client.post(
            f"/api/v1/batches/{test_batch.id}/transition",
            json={
                "target_status": "approving",
                "operator": "dev_ops",
                "comment": "提交审批",
            },
        )
        assert response.status_code == 200
        assert response.json()["status"] == "approving"

        # approving -> approved
        response = client.post(
            f"/api/v1/batches/{test_batch.id}/transition",
            json={
                "target_status": "approved",
                "operator": "tech_lead",
                "comment": "审批通过",
            },
        )
        assert response.status_code == 200
        assert response.json()["status"] == "approved"

        # 检查审核记录数量
        response = client.get(f"/api/v1/audit-records/?batch_id={test_batch.id}")
        assert len(response.json()) == 2
