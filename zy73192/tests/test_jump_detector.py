import pytest
import math
from sequence_error_attribution.jump_detector import JumpDetector
from sequence_error_attribution.models import QuestionRecord
from sequence_error_attribution.config import DEFAULT_CONFIG, STABLE_MESSAGES


class TestJumpDetector:
    """测试结果跳变检测器"""

    @pytest.fixture
    def detector(self):
        """创建跳变检测器"""
        return JumpDetector()

    def test_get_magnitude_positive(self, detector):
        """测试获取正数值的数量级"""
        assert detector._get_magnitude(1.0) == 0
        assert detector._get_magnitude(10.0) == 1
        assert detector._get_magnitude(100.0) == 2
        assert detector._get_magnitude(0.1) == -1
        assert detector._get_magnitude(0.01) == -2

    def test_get_magnitude_negative(self, detector):
        """测试获取负数值的数量级"""
        assert detector._get_magnitude(-1.0) == 0
        assert detector._get_magnitude(-10.0) == 1
        assert detector._get_magnitude(-100.0) == 2

    def test_get_magnitude_special(self, detector):
        """测试特殊值的数量级"""
        assert detector._get_magnitude(0) == 0
        assert detector._get_magnitude(float('nan')) == 0
        assert detector._get_magnitude(float('inf')) == 0

    def test_calculate_statistics(self, detector):
        """测试计算统计量"""
        values = [1.0, 2.0, 3.0, 4.0, 5.0]
        mean, std, min_val, max_val = detector._calculate_statistics(values)
        assert abs(mean - 3.0) < 1e-6
        assert abs(std - 1.41421356) < 1e-6
        assert min_val == 1.0
        assert max_val == 5.0

    def test_calculate_statistics_with_nan(self, detector):
        """测试包含NaN的统计量计算"""
        values = [1.0, float('nan'), 3.0, float('inf'), 5.0]
        mean, std, min_val, max_val = detector._calculate_statistics(values)
        assert abs(mean - 3.0) < 1e-6
        assert abs(std - 1.63299316) < 1e-6
        assert min_val == 1.0
        assert max_val == 5.0

    def test_calculate_statistics_empty(self, detector):
        """测试空列表的统计量计算"""
        mean, std, min_val, max_val = detector._calculate_statistics([])
        assert mean == 0.0
        assert std == 0.0
        assert min_val == 0.0
        assert max_val == 0.0

    def test_detect_threshold_jump(self, detector):
        """测试阈值触发的跳变检测"""
        record = QuestionRecord(
            question_id="Q001",
            original_terms=[100.0, 200.0, 300.0],
        )
        all_means = [1.0, 2.0, 1.5, 2.5, 1.8]
        all_stds = [0.5, 0.8, 0.6, 0.7, 0.5]
        record_mean = 200.0

        has_jump, reason, ratio = detector._detect_threshold_jump(
            record, all_means, all_stds, record_mean
        )
        assert has_jump is True
        assert reason == STABLE_MESSAGES.JUMP_REASON_THRESHOLD
        assert ratio > 2.0

    def test_detect_threshold_jump_no_jump(self, detector):
        """测试无阈值跳变"""
        record = QuestionRecord()
        all_means = [1.0, 2.0, 1.5, 2.5, 1.8]
        all_stds = [0.5, 0.8, 0.6, 0.7, 0.5]
        record_mean = 2.0

        has_jump, reason, ratio = detector._detect_threshold_jump(
            record, all_means, all_stds, record_mean
        )
        assert has_jump is False
        assert reason == ""

    def test_detect_unit_jump(self, detector):
        """测试单位异常跳变检测"""
        record = QuestionRecord(
            question_id="Q001",
            calculated_terms=[1000.0, 2000.0, 3000.0],
        )
        all_magnitudes = [0, 0, 1, 0, 1, 0]
        record_magnitudes = [3, 3, 3]

        has_jump, reason, diff = detector._detect_unit_jump(
            record, all_magnitudes, record_magnitudes
        )
        assert has_jump is True
        assert reason == STABLE_MESSAGES.JUMP_REASON_UNIT
        assert diff >= 3

    def test_detect_unit_jump_no_jump(self, detector):
        """测试无单位跳变"""
        record = QuestionRecord()
        all_magnitudes = [0, 0, 1, 0, 1, 0]
        record_magnitudes = [0, 1, 0]

        has_jump, reason, diff = detector._detect_unit_jump(
            record, all_magnitudes, record_magnitudes
        )
        assert has_jump is False
        assert reason == ""

    def test_detect_normal_jump_by_category(self, detector):
        """测试按错误分类检测正常跳变"""
        record = QuestionRecord(
            question_id="Q001",
            error_category="计算错误",
        )
        all_categories = ["计算错误", "索引错误", "索引错误", "索引错误"]

        has_jump, reason = detector._detect_normal_jump(record, all_categories)
        assert has_jump is True
        assert reason == STABLE_MESSAGES.JUMP_REASON_NORMAL

    def test_detect_normal_jump_by_sequence(self, detector):
        """测试按数列特征检测正常跳变"""
        record = QuestionRecord(
            question_id="Q001",
            error_category="",
            calculated_terms=[1.0, 2.0, 4.0, 100.0, 101.0],
        )
        all_categories = []

        has_jump, reason = detector._detect_normal_jump(record, all_categories)
        assert has_jump is True
        assert reason == STABLE_MESSAGES.JUMP_REASON_NORMAL

    def test_detect_normal_jump_no_jump(self, detector):
        """测试无正常跳变"""
        record = QuestionRecord(
            question_id="Q001",
            error_category="索引错误",
        )
        all_categories = ["索引错误", "索引错误", "计算错误", "索引错误"]

        has_jump, reason = detector._detect_normal_jump(record, all_categories)
        assert has_jump is False
        assert reason == ""

    def test_detect_jump_threshold(self, detector):
        """测试完整跳变检测 - 阈值类型"""
        normal_records = [
            QuestionRecord(
                question_id=f"N{i:02d}",
                original_terms=[1.0, 2.0, 3.0],
                processing_status=STABLE_MESSAGES.STATUS_SUCCESS,
            )
            for i in range(10)
        ]

        jump_record = QuestionRecord(
            question_id="J001",
            original_terms=[100.0, 200.0, 300.0],
            processing_status=STABLE_MESSAGES.STATUS_SUCCESS,
        )

        all_records = normal_records + [jump_record]

        has_jump, reason, magnitude = detector.detect_jump(jump_record, all_records)
        assert has_jump is True
        assert reason == STABLE_MESSAGES.JUMP_REASON_THRESHOLD

    def test_detect_jump_unit(self, detector):
        """测试完整跳变检测 - 单位类型"""
        normal_records = [
            QuestionRecord(
                question_id=f"N{i:02d}",
                original_terms=[1.0, 2.0, 3.0],
                processing_status=STABLE_MESSAGES.STATUS_SUCCESS,
            )
            for i in range(10)
        ]

        jump_record = QuestionRecord(
            question_id="J001",
            original_terms=[1000.0, 2000.0, 3000.0],
            processing_status=STABLE_MESSAGES.STATUS_SUCCESS,
        )

        all_records = normal_records + [jump_record]

        has_jump, reason, magnitude = detector.detect_jump(jump_record, all_records)
        assert has_jump is True
        assert reason == STABLE_MESSAGES.JUMP_REASON_UNIT

    def test_detect_jump_normal(self, detector):
        """测试完整跳变检测 - 正常记录类型"""
        normal_records = [
            QuestionRecord(
                question_id=f"N{i:02d}",
                original_terms=[1.0, 2.0, 3.0],
                error_category="索引错误",
                processing_status=STABLE_MESSAGES.STATUS_SUCCESS,
            )
            for i in range(10)
        ]

        jump_record = QuestionRecord(
            question_id="J001",
            original_terms=[1.0, 100.0, 2.0],
            error_category="计算错误",
            processing_status=STABLE_MESSAGES.STATUS_SUCCESS,
        )

        all_records = normal_records + [jump_record]

        has_jump, reason, magnitude = detector.detect_jump(jump_record, all_records)
        assert has_jump is True
        assert reason == STABLE_MESSAGES.JUMP_REASON_NORMAL

    def test_detect_jump_no_terms(self, detector):
        """测试无数列项时不检测跳变"""
        record = QuestionRecord(question_id="Q001")
        has_jump, reason, magnitude = detector.detect_jump(record, [record])
        assert has_jump is False
        assert reason == ""
        assert magnitude == 0.0

    def test_detect_batch(self, detector):
        """测试批量跳变检测"""
        records = []
        for i in range(5):
            records.append(QuestionRecord(
                question_id=f"N{i:02d}",
                original_terms=[1.0, 2.0, 3.0],
                processing_status=STABLE_MESSAGES.STATUS_SUCCESS,
            ))

        records.append(QuestionRecord(
            question_id="J001",
            original_terms=[100.0, 200.0, 300.0],
            processing_status=STABLE_MESSAGES.STATUS_SUCCESS,
        ))

        records.append(QuestionRecord(
            question_id="F001",
            processing_status=STABLE_MESSAGES.STATUS_FAILED,
        ))

        results = detector.detect_batch(records)

        assert results[0].jump_detected is False
        assert results[5].jump_detected is True
        assert results[5].jump_reason == STABLE_MESSAGES.JUMP_REASON_THRESHOLD
        assert results[6].jump_detected is False

        jump_count = sum(1 for r in results if r.jump_detected)
        assert jump_count == 1

    def test_jump_reasons_stability(self, detector):
        """测试跳变原因消息保持稳定"""
        assert STABLE_MESSAGES.JUMP_REASON_THRESHOLD == "阈值触发: 结果超出预设阈值范围"
        assert STABLE_MESSAGES.JUMP_REASON_UNIT == "单位异常: 数值单位或数量级突变"
        assert STABLE_MESSAGES.JUMP_REASON_NORMAL == "正常记录: 数据本身特征导致的合理波动"
