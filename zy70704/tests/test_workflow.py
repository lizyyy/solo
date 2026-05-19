import pytest
from datetime import datetime, timedelta
from app.models.models import BatchStatus, OverrideStrategy


class TestOverrideProtection:
    """测试覆盖保护策略"""

    def test_protect_mode_preserves_existing_data(self, client, test_batch, db):
        """PROTECT模式下：缺口已有actual_points=25，执行process后应该保留，不会被覆盖"""
        # 将批次设为PROTECT模式
        test_batch.override_strategy = OverrideStrategy.PROTECT
        db.commit()

        # 创建指标窗口
        now = datetime.now()
        from app.models.models import MetricWindow, GapSegment, BackfillSource
        window = MetricWindow(
            batch_id=test_batch.id,
            metric_name="test_protection_metric",
            window_start=now - timedelta(hours=2),
            window_end=now,
        )
        db.add(window)
        db.flush()

        # 创建缺口，已有 actual_points=25
        gap = GapSegment(
            metric_window_id=window.id,
            gap_type="missing",
            gap_start=now - timedelta(hours=1, minutes=30),
            gap_end=now - timedelta(hours=1),
            expected_points=100,
            actual_points=25,  # 已有25个真实观测数据
            fill_rate=0.25,
            is_backfilled=False,
        )
        db.add(gap)
        db.flush()

        # 添加回填源 - 验证批处理流程需要它
        backfill_source = BackfillSource(
            gap_segment_id=gap.id,
            source_type="log_replay",
            source_name="test_source",
        )
        db.add(backfill_source)
        db.commit()

        # 将状态流转到 approved
        from app.services.batch_service import BatchService
        batch_service = BatchService(db)
        batch_service.transition_status(test_batch.id, BatchStatus.APPROVING, "test_user")
        batch_service.transition_status(test_batch.id, BatchStatus.APPROVED, "test_lead")

        # 保存id备用
        gap_id = gap.id
        batch_id = test_batch.id
        window_id = window.id

        # 执行回填
        response = client.post(
            f"/api/v1/batches/{batch_id}/process",
            params={"operator": "test_user"}
        )
        assert response.status_code == 200

        # 通过API查询来验证结果，避免session问题
        gap_response = client.get(f"/api/v1/gap-segments/?metric_window_id={window_id}")
        gaps = gap_response.json()
        gap_from_api = next((g for g in gaps if g["id"] == gap_id), None)
        assert gap_from_api is not None
        assert gap_from_api["actual_points"] == 25  # 关键验证：保留原有数据，没有被覆盖！
        assert gap_from_api["is_backfilled"] == True  # 仍然标记为已处理
        assert gap_from_api["fill_rate"] == 0.25  # 保持原有填充率

        # 验证返回结果中应该有保护模式的信息
        data = response.json()
        assert data["override_strategy"] == "protect"
        assert "processing_details" in data
        assert len(data["processing_details"]) >= 1
        assert "保护模式" in data["processing_details"][0]["message"]

    def test_force_mode_overwrites_existing_data(self, client, test_batch, db):
        """FORCE模式下：缺口已有actual_points=25，执行process后应该被覆盖为expected_points"""
        # 将批次设为FORCE模式
        test_batch.override_strategy = OverrideStrategy.FORCE
        db.commit()

        # 创建指标窗口和缺口
        now = datetime.now()
        from app.models.models import MetricWindow, GapSegment, BackfillSource
        window = MetricWindow(
            batch_id=test_batch.id,
            metric_name="test_force_metric",
            window_start=now - timedelta(hours=2),
            window_end=now,
        )
        db.add(window)
        db.flush()

        gap = GapSegment(
            metric_window_id=window.id,
            gap_type="missing",
            gap_start=now - timedelta(hours=1, minutes=30),
            gap_end=now - timedelta(hours=1),
            expected_points=100,
            actual_points=25,
            fill_rate=0.25,
            is_backfilled=False,
        )
        db.add(gap)
        db.flush()

        # 添加回填源
        backfill_source = BackfillSource(
            gap_segment_id=gap.id,
            source_type="log_replay",
            source_name="test_source",
        )
        db.add(backfill_source)
        db.commit()

        # 保存id备用
        gap_id = gap.id
        batch_id = test_batch.id
        window_id = window.id

        # 状态流转
        from app.services.batch_service import BatchService
        batch_service = BatchService(db)
        batch_service.transition_status(batch_id, BatchStatus.APPROVING, "test_user")
        batch_service.transition_status(batch_id, BatchStatus.APPROVED, "test_lead")

        # 执行回填
        response = client.post(
            f"/api/v1/batches/{batch_id}/process",
            params={"operator": "test_user"}
        )
        assert response.status_code == 200

        # 通过API查询来验证结果
        gap_response = client.get(f"/api/v1/gap-segments/?metric_window_id={window_id}")
        gaps = gap_response.json()
        gap_from_api = next((g for g in gaps if g["id"] == gap_id), None)
        assert gap_from_api is not None
        assert gap_from_api["actual_points"] == 100  # 关键验证：被覆盖了！
        assert gap_from_api["fill_rate"] == 1.0

        # 验证返回结果中有强制模式的信息
        data = response.json()
        assert data["override_strategy"] == "force"
        assert "强制模式" in data["processing_details"][0]["message"]

    def test_merge_mode_preserves_existing_data(self, client, test_batch, db):
        """MERGE模式下：保留原有数据不覆盖"""
        test_batch.override_strategy = OverrideStrategy.MERGE
        db.commit()

        now = datetime.now()
        from app.models.models import MetricWindow, GapSegment, BackfillSource
        window = MetricWindow(
            batch_id=test_batch.id,
            metric_name="test_merge_metric",
            window_start=now - timedelta(hours=2),
            window_end=now,
        )
        db.add(window)
        db.flush()

        gap = GapSegment(
            metric_window_id=window.id,
            gap_type="missing",
            gap_start=now - timedelta(hours=1, minutes=30),
            gap_end=now - timedelta(hours=1),
            expected_points=100,
            actual_points=25,
            fill_rate=0.25,
            is_backfilled=False,
        )
        db.add(gap)
        db.flush()

        # 添加回填源
        backfill_source = BackfillSource(
            gap_segment_id=gap.id,
            source_type="log_replay",
            source_name="test_source",
        )
        db.add(backfill_source)
        db.commit()

        # 保存id备用
        gap_id = gap.id
        batch_id = test_batch.id
        window_id = window.id

        from app.services.batch_service import BatchService
        batch_service = BatchService(db)
        batch_service.transition_status(batch_id, BatchStatus.APPROVING, "test_user")
        batch_service.transition_status(batch_id, BatchStatus.APPROVED, "test_lead")

        response = client.post(
            f"/api/v1/batches/{batch_id}/process",
            params={"operator": "test_user"}
        )
        assert response.status_code == 200

        # 通过API查询来验证结果
        gap_response = client.get(f"/api/v1/gap-segments/?metric_window_id={window_id}")
        gaps = gap_response.json()
        gap_from_api = next((g for g in gaps if g["id"] == gap_id), None)
        assert gap_from_api is not None
        assert gap_from_api["actual_points"] == 25  # 保留原有数据
        assert gap_from_api["fill_rate"] == 0.25

        data = response.json()
        assert data["override_strategy"] == "merge"
        assert "合并模式" in data["processing_details"][0]["message"]

    def test_no_existing_data_always_allows_backfill_in_protect_mode(self, client, test_batch, db):
        """PROTECT模式下：没有actual_points时应该正常回填"""
        test_batch.override_strategy = OverrideStrategy.PROTECT
        db.commit()

        now = datetime.now()
        from app.models.models import MetricWindow, GapSegment, BackfillSource
        window = MetricWindow(
            batch_id=test_batch.id,
            metric_name="test_no_data_metric",
            window_start=now - timedelta(hours=2),
            window_end=now,
        )
        db.add(window)
        db.flush()

        gap = GapSegment(
            metric_window_id=window.id,
            gap_type="missing",
            gap_start=now - timedelta(hours=1, minutes=30),
            gap_end=now - timedelta(hours=1),
            expected_points=100,
            actual_points=None,  # 没有现有数据
            fill_rate=None,
            is_backfilled=False,
        )
        db.add(gap)
        db.flush()

        # 添加回填源
        backfill_source = BackfillSource(
            gap_segment_id=gap.id,
            source_type="log_replay",
            source_name="test_source",
        )
        db.add(backfill_source)
        db.commit()

        # 保存id备用
        gap_id = gap.id
        batch_id = test_batch.id
        window_id = window.id

        from app.services.batch_service import BatchService
        batch_service = BatchService(db)
        batch_service.transition_status(batch_id, BatchStatus.APPROVING, "test_user")
        batch_service.transition_status(batch_id, BatchStatus.APPROVED, "test_lead")

        response = client.post(
            f"/api/v1/batches/{batch_id}/process",
            params={"operator": "test_user"}
        )
        assert response.status_code == 200

        # 通过API查询来验证结果
        gap_response = client.get(f"/api/v1/gap-segments/?metric_window_id={window_id}")
        gaps = gap_response.json()
        gap_from_api = next((g for g in gaps if g["id"] == gap_id), None)
        assert gap_from_api is not None
        assert gap_from_api["actual_points"] == 100  # 没有现有数据，可以正常回填
        assert gap_from_api["fill_rate"] == 1.0

        data = response.json()
        assert "回填完成" in data["processing_details"][0]["message"]


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
        assert "processing_details" in data

        # 4. 验证缺口标记为已回填
        gap_id = complete_batch_setup["gap"].id
        response = client.get(
            f"/api/v1/gap-segments/?metric_window_id={complete_batch_setup['window'].id}"
        )
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
            f"/api/v1/snapshots/?batch_id={batch_id}"
        )
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