import pytest
from datetime import datetime, timedelta
from app.models.models import BatchStatus


class TestCompleteWorkflow:
    def test_full_backfill_workflow(self, client, complete_batch_setup, db):
        """测试完整的回填工作流"""
        batch_id = complete_batch_setup["batch"].id

        # 1. 提审
        response = client.post(
            f"/api/v1/batches/{batch_id}/transition",
            json={
                "target_status": "approving",
                "operator": "dev_ops",
                "comment": "申请审批",
            },
        )
        assert response.status_code == 200
        assert response.json()["status"] == "approving"

        # 2. 审批通过
        response = client.post(
            f"/api/v1/batches/{batch_id}/transition",
            json={
                "target_status": "approved",
                "operator": "tech_lead",
                "comment": "审批通过",
            },
        )
        assert response.status_code == 200
        assert response.json()["status"] == "approved"

        # 3. 执行处理
        response = client.post(
            f"/api/v1/batches/{batch_id}/process",
            params={"operator": "dev_ops"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"

        # 4. 验证缺口标记为已回填
        gap_id = complete_batch_setup["gap"].id
        response = client.get(
            f"/api/v1/gap-segments/?metric_window_id={complete_batch_setup['window'].id}")
        assert response.status_code == 200
        gaps = response.json()
        backfilled_gap = next((g for g in gaps if g["id"] == gap_id), None)
        assert backfilled_gap is not None
        assert backfilled_gap["is_backfilled"] is True

        # 5. 验证创建了快照
        response = client.get(f"/api/v1/snapshots/?batch_id={batch_id}")
        assert response.status_code == 200
        snapshots = response.json()
        assert len(snapshots) >= 1

        # 6. 导出快照
        snapshot_id = snapshots[0]["id"]
        response = client.get(f"/api/v1/snapshots/{snapshot_id}/export")
        assert response.status_code == 200
        export_data = response.json()
        assert export_data["snapshot_id"] == snapshot_id
        assert "data" in export_data

        # 7. 验证审核记录数量
        response = client.get(f"/api/v1/audit-records/?batch_id={batch_id}")
        assert response.status_code == 200
        records = response.json()
        assert len(records) >= 4  # approving, approved, processing, completed

    def test_process_unapproved_batch_fails(self, client, complete_batch_setup):
        """测试处理未审批的批次应该失败"""
        batch_id = complete_batch_setup["batch"].id

        response = client.post(
            f"/api/v1/batches/{batch_id}/process",
            params={"operator": "dev_ops"}
        )
        assert response.status_code == 400


class TestManualCorrection:
    def test_manual_correction(self, client, test_gap_segment, test_batch, db):
        """测试人工修正"""
        # 在session关闭前获取id
        batch_id = test_batch.id
        gap_id = test_gap_segment.id
        
        response = client.post(
            "/api/v1/manual-correction",
            json={
                "gap_segment_id": gap_id,
                "corrected_data": '{"value": 100, "confidence": 0.95}',
                "operator": "data_engineer",
                "reason": "原始数据异常，人工校准",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data

        # 验证创建了修正快照
        response = client.get(
            f"/api/v1/snapshots/?batch_id={batch_id}")
        assert response.status_code == 200
        snapshots = response.json()
        assert len(snapshots) >= 1


class TestExceptionHandling:
    def test_list_exception_logs(self, client):
        """测试获取异常日志列表"""
        response = client.get("/api/v1/exception-logs/")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_handle_exception_log(self, client, db):
        """测试处理异常日志"""
        from app.models.models import ExceptionLog
        from datetime import datetime

        # 创建异常日志
        exception_log = ExceptionLog(
            operation="test_operation",
            original_input='{"test": "data"}',
            error_message="测试错误",
        )
        db.add(exception_log)
        db.commit()
        db.refresh(exception_log)

        # 处理异常
        response = client.post(
            f"/api/v1/exception-logs/{exception_log.id}/handle",
            params={
                "handler": "dev_ops",
                "conclusion": "已确认，不影响生产环境",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["handler"] == "dev_ops"
        assert data["handled_at"] is not None

    def test_filter_exception_logs(self, client, db):
        """测试过滤异常日志"""
        from app.models.models import ExceptionLog, GrayBatch

        # 创建一个批次
        batch = GrayBatch(
            batch_code="FILTER-TEST-001",
            batch_name="过滤测试批次",
            created_by="test_user",
            status=BatchStatus.PENDING,
            override_strategy="protect",
        )
        db.add(batch)
        db.commit()
        db.refresh(batch)

        # 创建已处理和未处理的异常日志
        handled_log = ExceptionLog(
            batch_id=batch.id,
            operation="test1",
            error_message="已处理的错误",
            handler="dev_ops",
            conclusion="已解决",
            handled_at=datetime.now(),
        )
        unhandled_log = ExceptionLog(
            batch_id=batch.id,
            operation="test2",
            error_message="未处理的错误",
        )
        db.add(handled_log)
        db.add(unhandled_log)
        db.commit()

        # 测试按批次过滤
        response = client.get(f"/api/v1/exception-logs/?batch_id={batch.id}")
        assert response.status_code == 200
        assert len(response.json()) == 2

        # 测试按已处理过滤
        response = client.get("/api/v1/exception-logs/?handled=true")
        assert response.status_code == 200
        assert len(response.json()) >= 1

        # 测试按未处理过滤
        response = client.get("/api/v1/exception-logs/?handled=false")
        assert response.status_code == 200
        assert len(response.json()) >= 1
