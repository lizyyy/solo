"""偏见检测器测试"""

import pytest

from interview_bias_audit.engine.detector import BiasDetector, BiasFlag


class TestBiasDetector:
    def test_detect_scale_drift_high_std(self):
        detector = BiasDetector(high_threshold=85.0, low_threshold=50.0)
        candidates = [
            {"name": "A", "position": "后端", "score": 90},
            {"name": "B", "position": "后端", "score": 50},
            {"name": "C", "position": "后端", "score": 70},
            {"name": "D", "position": "后端", "score": 85},
            {"name": "E", "position": "后端", "score": 30},
        ]
        flags = detector.detect_scale_drift(candidates, "后端")

        assert len(flags) == 1
        assert flags[0].flag_type == "scale_drift"
        assert flags[0].severity == "high"

    def test_detect_scale_drift_low_std(self):
        detector = BiasDetector(high_threshold=85.0, low_threshold=50.0)
        candidates = [
            {"name": "A", "position": "后端", "score": 80},
            {"name": "B", "position": "后端", "score": 82},
            {"name": "C", "position": "后端", "score": 78},
        ]
        flags = detector.detect_scale_drift(candidates, "后端")

        assert len(flags) == 0

    def test_detect_conflict_in_rounds_high_diff(self):
        detector = BiasDetector(high_threshold=85.0, low_threshold=50.0)
        notes = [
            {"candidate_name": "张三", "position": "后端", "score": 90},
            {"candidate_name": "张三", "position": "后端", "score": 60},
        ]
        flags = detector.detect_conflict_in_rounds(notes)

        assert len(flags) == 1
        assert flags[0].flag_type == "round_conflict"
        assert flags[0].severity == "high"

    def test_detect_conflict_in_rounds_low_diff(self):
        detector = BiasDetector(high_threshold=85.0, low_threshold=50.0)
        notes = [
            {"candidate_name": "张三", "position": "后端", "score": 80},
            {"candidate_name": "张三", "position": "后端", "score": 78},
        ]
        flags = detector.detect_conflict_in_rounds(notes)

        assert len(flags) == 0

    def test_detect_same_name_different_position(self):
        detector = BiasDetector(high_threshold=85.0, low_threshold=50.0)
        candidates = [
            {"name": "张三", "position": "后端", "score": 80},
            {"name": "张三", "position": "前端", "score": 75},
            {"name": "李四", "position": "后端", "score": 85},
        ]
        flags = detector.detect_same_name_different_position(candidates)

        assert len(flags) == 1
        assert flags[0].flag_type == "same_name_different_position"
        assert "张三" in flags[0].candidate_name

    def test_detect_empty_notes(self):
        detector = BiasDetector(high_threshold=85.0, low_threshold=50.0)
        candidate = {"name": "张三", "position": "后端", "notes": ""}
        flags = detector.detect_empty_notes(candidate)

        assert len(flags) == 1
        assert flags[0].flag_type == "empty_notes"

    def test_detect_empty_notes_with_content(self):
        detector = BiasDetector(high_threshold=85.0, low_threshold=50.0)
        candidate = {"name": "张三", "position": "后端", "notes": "技术不错"}
        flags = detector.detect_empty_notes(candidate)

        assert len(flags) == 0


class TestBiasFlag:
    def test_bias_flag_creation(self):
        flag = BiasFlag(
            flag_type="test_type",
            candidate_id="C001",
            candidate_name="张三",
            position="后端",
            severity="high",
            description="测试标志",
            details={"key": "value"},
        )

        assert flag.flag_type == "test_type"
        assert flag.candidate_id == "C001"
        assert flag.severity == "high"
