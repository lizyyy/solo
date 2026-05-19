import pytest
from app.services.validation_service import ValidationService
from app.models.models import BatchStatus, OverrideStrategy


class TestValidationService:
    def test_validate_time_window_valid(self):
        """测试有效时间窗口验证"""
        from datetime import datetime, timedelta
        now = datetime.now()
        valid, msg = ValidationService.validate_time_window(
            now - timedelta(hours=2), now)
        assert valid is True

    def test_validate_time_window_invalid(self):
        """测试无效时间窗口验证（结束时间早于开始）"""
        from datetime import datetime, timedelta
        now = datetime.now()
        valid, msg = ValidationService.validate_time_window(
            now, now - timedelta(hours=2))
        assert valid is False
        assert "必须大于" in msg

    def test_validate_gap_within_window_valid(self):
        """测试缺口在窗口内验证"""
        from datetime import datetime, timedelta
        now = datetime.now()
        window_start = now - timedelta(hours=4)
        window_end = now
        gap_start = now - timedelta(hours=2, minutes=30)
        gap_end = now - timedelta(hours=2)
        valid, msg = ValidationService.validate_gap_within_window(
            gap_start, gap_end, window_start, window_end)
        assert valid is True

    def test_validate_gap_within_window_invalid(self):
        """测试缺口超出窗口范围验证"""
        from datetime import datetime, timedelta
        now = datetime.now()
        window_start = now - timedelta(hours=4)
        window_end = now
        gap_start = now - timedelta(hours=5)
        gap_end = now - timedelta(hours=4, minutes=30)
        valid, msg = ValidationService.validate_gap_within_window(
            gap_start, gap_end, window_start, window_end)
        assert valid is False

    def test_validate_status_transition_valid(self):
        """测试有效的状态转换"""
        valid, msg = ValidationService.validate_status_transition(
            BatchStatus.PENDING, BatchStatus.APPROVING)
        assert valid is True

        valid, msg = ValidationService.validate_status_transition(
            BatchStatus.APPROVING, BatchStatus.APPROVED)
        assert valid is True

        valid, msg = ValidationService.validate_status_transition(
            BatchStatus.APPROVED, BatchStatus.PROCESSING)
        assert valid is True

        valid, msg = ValidationService.validate_status_transition(
            BatchStatus.PROCESSING, BatchStatus.COMPLETED)
        assert valid is True

    def test_validate_status_transition_invalid(self):
        """测试无效的状态转换"""
        valid, msg = ValidationService.validate_status_transition(
            BatchStatus.PENDING, BatchStatus.COMPLETED)
        assert valid is False

        valid, msg = ValidationService.validate_status_transition(
            BatchStatus.APPROVED, BatchStatus.PENDING)
        assert valid is False

    def test_calculate_fill_rate(self):
        """测试填充率计算"""
        assert ValidationService.calculate_fill_rate(100, 50) == 0.5
        assert ValidationService.calculate_fill_rate(100, 100) == 1.0
        assert ValidationService.calculate_fill_rate(0, 50) == 0.0
        assert ValidationService.calculate_fill_rate(100, 150) == 1.0

    def test_generate_data_hash(self):
        """测试数据哈希生成"""
        hash1 = ValidationService.generate_data_hash("test data 1")
        hash2 = ValidationService.generate_data_hash("test data 2")
        hash3 = ValidationService.generate_data_hash("test data 1")
        assert hash1 != hash2
        assert hash1 == hash3

    def test_check_override_permission(self, db, test_batch):
        """测试覆盖权限检查"""
        test_batch.override_strategy = OverrideStrategy.PROTECT
        db.commit()
        db.refresh(test_batch)

        valid, msg = ValidationService.check_override_permission(
            test_batch, existing_data_present=True)
        assert valid is False

        valid, msg = ValidationService.check_override_permission(
            test_batch, existing_data_present=False)
        assert valid is True

        test_batch.override_strategy = OverrideStrategy.MERGE
        db.commit()
        db.refresh(test_batch)

        valid, msg = ValidationService.check_override_permission(
            test_batch, existing_data_present=True)
        assert valid is True


class TestGapOverlap:
    def test_check_gap_overlap_no_overlap(self, db, test_gap_segment):
        """测试无重叠的缺口"""
        from datetime import datetime, timedelta
        db.refresh(test_gap_segment)

        gap_start = test_gap_segment.gap_end + timedelta(minutes=1)
        gap_end = test_gap_segment.gap_end + timedelta(minutes=31)

        valid, msg, overlaps = ValidationService.check_gap_overlap(
            db, test_gap_segment.metric_window_id, gap_start, gap_end)
        assert valid is True
        assert len(overlaps) == 0

    def test_check_gap_overlap_with_overlap(self, db, test_gap_segment):
        """测试有重叠的缺口"""
        from datetime import datetime, timedelta
        db.refresh(test_gap_segment)

        gap_start = test_gap_segment.gap_start
        gap_end = test_gap_segment.gap_end

        valid, msg, overlaps = ValidationService.check_gap_overlap(
            db, test_gap_segment.metric_window_id, gap_start, gap_end)
        assert valid is False
        assert len(overlaps) >= 1
