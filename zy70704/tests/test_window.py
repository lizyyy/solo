import pytest
from datetime import datetime, timedelta


class TestMetricWindowAPI:
    def test_create_metric_window(self, client, test_batch):
        """测试创建指标窗口"""
        now = datetime.now()
        response = client.post(
            "/api/v1/metric-windows/",
            json={
                "batch_id": test_batch.id,
                "metric_name": "test_latency_p99",
                "window_start": (now - timedelta(hours=2)).isoformat(),
                "window_end": now.isoformat(),
                "tags": '{"service": "test"}',
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["metric_name"] == "test_latency_p99"

    def test_create_metric_window_invalid_time(self, client, test_batch):
        """测试创建无效时间窗口（结束时间早于开始）"""
        now = datetime.now()
        response = client.post(
            "/api/v1/metric-windows/",
            json={
                "batch_id": test_batch.id,
                "metric_name": "test_latency_p99",
                "window_start": now.isoformat(),
                "window_end": (now - timedelta(hours=2)).isoformat(),
            },
        )
        assert response.status_code == 422  # Pydantic validator 会返回422

    def test_get_metric_window(self, client, test_metric_window):
        """测试获取指标窗口"""
        response = client.get(f"/api/v1/metric-windows/{test_metric_window.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_metric_window.id
        assert data["metric_name"] == "test_latency_p99"

    def test_list_metric_windows(self, client, test_metric_window):
        """测试获取指标窗口列表"""
        response = client.get("/api/v1/metric-windows/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1


class TestGapSegmentAPI:
    def test_create_gap_segment(self, client, test_metric_window):
        """测试创建缺口片段"""
        now = datetime.now()
        response = client.post(
            "/api/v1/gap-segments/",
            json={
                "metric_window_id": test_metric_window.id,
                "gap_type": "missing",
                "gap_start": (now - timedelta(hours=1, minutes=30)).isoformat(),
                "gap_end": (now - timedelta(hours=1)).isoformat(),
                "expected_points": 60,
                "actual_points": 0,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["gap_type"] == "missing"
        assert data["fill_rate"] == 0.0

    def test_create_gap_outside_window(self, client, test_metric_window, db):
        """测试创建超出指标窗口范围的缺口"""
        db.refresh(test_metric_window)
        window_start = test_metric_window.window_start

        response = client.post(
            "/api/v1/gap-segments/",
            json={
                "metric_window_id": test_metric_window.id,
                "gap_type": "missing",
                "gap_start": (window_start - timedelta(hours=1)).isoformat(),
                "gap_end": (window_start - timedelta(minutes=30)).isoformat(),
                "expected_points": 60,
                "actual_points": 0,
            },
        )
        assert response.status_code == 400

    def test_create_overlapping_gap(self, client, test_gap_segment, db):
        """测试创建重叠的缺口片段"""
        db.refresh(test_gap_segment)
        gap_start = test_gap_segment.gap_start
        gap_end = test_gap_segment.gap_end

        response = client.post(
            "/api/v1/gap-segments/",
            json={
                "metric_window_id": test_gap_segment.metric_window_id,
                "gap_type": "corrupted",
                "gap_start": (gap_start + timedelta(minutes=15)).isoformat(),
                "gap_end": (gap_end + timedelta(minutes=15)).isoformat(),
                "expected_points": 30,
                "actual_points": 15,
            },
        )
        assert response.status_code == 400

    def test_fill_rate_calculated(self, client, test_metric_window):
        """测试填充率自动计算"""
        now = datetime.now()
        response = client.post(
            "/api/v1/gap-segments/",
            json={
                "metric_window_id": test_metric_window.id,
                "gap_type": "corrupted",
                "gap_start": (now - timedelta(hours=1, minutes=30)).isoformat(),
                "gap_end": (now - timedelta(hours=1)).isoformat(),
                "expected_points": 100,
                "actual_points": 50,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["fill_rate"] == 0.5


class TestBackfillSourceAPI:
    def test_create_backfill_source(self, client, test_gap_segment):
        """测试创建回填来源"""
        response = client.post(
            "/api/v1/backfill-sources/",
            json={
                "gap_segment_id": test_gap_segment.id,
                "source_type": "log_replay",
                "source_name": "nginx日志重放",
                "data_hash": "unique_hash_12345",
                "record_count": 60,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["source_type"] == "log_replay"

    def test_duplicate_hash_deduplication(self, client, test_backfill_source):
        """测试相同哈希的数据去重"""
        response = client.post(
            "/api/v1/backfill-sources/",
            json={
                "gap_segment_id": test_backfill_source.gap_segment_id,
                "source_type": "history_restore",
                "source_name": "重复数据",
                "data_hash": "test_hash_12345",
                "record_count": 60,
            },
        )
        assert response.status_code == 400

    def test_list_backfill_sources(self, client, test_backfill_source):
        """测试获取回填来源列表"""
        response = client.get("/api/v1/backfill-sources/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
