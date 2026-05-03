"""测试对齐算法模块"""
import pytest
from datetime import datetime, timedelta
from typing import List

from eeg_aligner.alignment import (
    ClockDriftEstimator,
    EventAligner,
)
from eeg_aligner.models import (
    StimulusEvent,
    ClockCalibration,
    EEGChannelSummary,
    EventType,
)


class TestClockDriftEstimator:
    """测试时钟漂移估计器"""
    
    def create_sync_event(self, code: int, timestamp: datetime, eeg_timestamp: datetime = None) -> StimulusEvent:
        """创建同步事件"""
        return StimulusEvent(
            event_id=f"sync_{code}",
            event_code=code,
            event_type=EventType.SYNC,
            timestamp=timestamp,
            eeg_timestamp=eeg_timestamp or timestamp,
        )
    
    def create_calibration(self, eeg_time: datetime, stim_time: datetime, drift: float) -> ClockCalibration:
        """创建校准记录"""
        return ClockCalibration(
            calibration_id=f"cal_{id(eeg_time)}",
            calibration_time=eeg_time,
            eeg_clock_time=eeg_time,
            stimulus_clock_time=stim_time,
            drift_ms=drift,
            sync_event_code=255,
        )
    
    def test_estimate_with_calibrations(self):
        """测试使用校准记录估计漂移"""
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        calibrations: List[ClockCalibration] = [
            self.create_calibration(
                base_time,
                base_time + timedelta(milliseconds=0),
                0.0
            ),
            self.create_calibration(
                base_time + timedelta(hours=2),
                base_time + timedelta(hours=2, milliseconds=200),
                200.0
            ),
            self.create_calibration(
                base_time + timedelta(hours=4),
                base_time + timedelta(hours=4, milliseconds=400),
                400.0
            ),
        ]
        
        estimator = ClockDriftEstimator()
        drift_estimate, sync_points, confidence = estimator.estimate(
            events=[],
            calibrations=calibrations,
            eeg_summaries=[],
        )
        
        assert confidence > 0.9
        assert drift_estimate > 0
    
    def test_estimate_with_sync_events(self):
        """测试使用同步事件估计漂移"""
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        events: List[StimulusEvent] = [
            self.create_sync_event(
                255,
                base_time + timedelta(milliseconds=0),
                base_time,
            ),
            self.create_sync_event(
                255,
                base_time + timedelta(hours=2, milliseconds=150),
                base_time + timedelta(hours=2),
            ),
            self.create_sync_event(
                255,
                base_time + timedelta(hours=4, milliseconds=300),
                base_time + timedelta(hours=4),
            ),
        ]
        
        estimator = ClockDriftEstimator()
        drift_estimate, sync_points, confidence = estimator.estimate(
            events=events,
            calibrations=[],
            eeg_summaries=[],
        )
        
        assert len(sync_points) == 3
        assert confidence > 0.5
    
    def test_estimate_without_sync_data(self):
        """测试没有同步数据的情况"""
        estimator = ClockDriftEstimator()
        drift_estimate, sync_points, confidence = estimator.estimate(
            events=[],
            calibrations=[],
            eeg_summaries=[],
        )
        
        assert drift_estimate == 0.0
        assert len(sync_points) == 0
        assert confidence == 0.0
    
    def test_outlier_detection(self):
        """测试离群点检测"""
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        calibrations: List[ClockCalibration] = [
            self.create_calibration(
                base_time,
                base_time + timedelta(milliseconds=0),
                0.0
            ),
            self.create_calibration(
                base_time + timedelta(hours=2),
                base_time + timedelta(hours=2, milliseconds=200),
                200.0
            ),
            self.create_calibration(
                base_time + timedelta(hours=4),
                base_time + timedelta(hours=4, milliseconds=5000),
                5000.0
            ),
            self.create_calibration(
                base_time + timedelta(hours=6),
                base_time + timedelta(hours=6, milliseconds=600),
                600.0
            ),
        ]
        
        estimator = ClockDriftEstimator()
        drift_estimate, sync_points, confidence = estimator.estimate(
            events=[],
            calibrations=calibrations,
            eeg_summaries=[],
        )
        
        assert len(sync_points) < len(calibrations)


class TestEventAligner:
    """测试事件对齐器"""
    
    def create_test_event(self, code: int, timestamp: datetime) -> StimulusEvent:
        """创建测试事件"""
        return StimulusEvent(
            event_id=f"evt_{code}",
            event_code=code,
            event_type=EventType.STIMULUS,
            timestamp=timestamp,
        )
    
    def test_align_with_linear_method(self):
        """测试线性对齐方法"""
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        events: List[StimulusEvent] = [
            self.create_test_event(1, base_time + timedelta(milliseconds=0)),
            self.create_test_event(2, base_time + timedelta(hours=2, milliseconds=200)),
            self.create_test_event(3, base_time + timedelta(hours=4, milliseconds=400)),
        ]
        
        calibrations: List[ClockCalibration] = [
            ClockCalibration(
                calibration_id="cal_1",
                calibration_time=base_time,
                eeg_clock_time=base_time,
                stimulus_clock_time=base_time,
                drift_ms=0.0,
                sync_event_code=255,
            ),
            ClockCalibration(
                calibration_id="cal_2",
                calibration_time=base_time + timedelta(hours=4),
                eeg_clock_time=base_time + timedelta(hours=4),
                stimulus_clock_time=base_time + timedelta(hours=4, milliseconds=400),
                drift_ms=400.0,
                sync_event_code=255,
            ),
        ]
        
        aligner = EventAligner()
        aligned_events, alignment_result = aligner.align_events(
            events=events,
            calibrations=calibrations,
            eeg_summaries=[],
        )
        
        assert len(aligned_events) == 3
        assert alignment_result.alignment_method == "linear"
        assert alignment_result.aligned_events_count == 3
        
        for event in aligned_events:
            assert event.aligned_timestamp is not None
    
    def test_align_with_single_point(self):
        """测试单点对齐方法"""
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        events: List[StimulusEvent] = [
            self.create_test_event(1, base_time + timedelta(milliseconds=250)),
            self.create_test_event(2, base_time + timedelta(hours=1, milliseconds=250)),
        ]
        
        calibrations: List[ClockCalibration] = [
            ClockCalibration(
                calibration_id="cal_1",
                calibration_time=base_time,
                eeg_clock_time=base_time,
                stimulus_clock_time=base_time + timedelta(milliseconds=250),
                drift_ms=250.0,
                sync_event_code=255,
            ),
        ]
        
        aligner = EventAligner()
        aligned_events, alignment_result = aligner.align_events(
            events=events,
            calibrations=calibrations,
            eeg_summaries=[],
        )
        
        assert alignment_result.alignment_method == "single_point"
        assert alignment_result.drift_estimate_ms == 250.0
        
        for event in aligned_events:
            assert event.aligned_timestamp is not None
            expected_aligned = event.timestamp - timedelta(milliseconds=250)
            assert abs((event.aligned_timestamp - expected_aligned).total_seconds()) < 0.001
    
    def test_align_without_calibration(self):
        """测试没有校准数据的对齐"""
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        events: List[StimulusEvent] = [
            self.create_test_event(1, base_time),
            self.create_test_event(2, base_time + timedelta(hours=1)),
        ]
        
        aligner = EventAligner()
        aligned_events, alignment_result = aligner.align_events(
            events=events,
            calibrations=[],
            eeg_summaries=[],
        )
        
        assert alignment_result.alignment_method == "none"
        assert alignment_result.drift_estimate_ms == 0.0
        
        for event in aligned_events:
            assert event.aligned_timestamp == event.timestamp
    
    def test_force_align_method(self):
        """测试强制指定对齐方法"""
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        events: List[StimulusEvent] = [
            self.create_test_event(1, base_time),
        ]
        
        calibrations: List[ClockCalibration] = [
            ClockCalibration(
                calibration_id="cal_1",
                calibration_time=base_time,
                eeg_clock_time=base_time,
                stimulus_clock_time=base_time + timedelta(milliseconds=100),
                drift_ms=100.0,
                sync_event_code=255,
            ),
        ]
        
        aligner = EventAligner()
        aligned_events, alignment_result = aligner.align_events(
            events=events,
            calibrations=calibrations,
            eeg_summaries=[],
            force_method="average",
        )
        
        assert alignment_result.alignment_method == "average"
    
    def test_align_eeg_timestamp(self):
        """测试使用EEG时间戳对齐"""
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        event = StimulusEvent(
            event_id="evt_1",
            event_code=1,
            event_type=EventType.STIMULUS,
            timestamp=base_time + timedelta(milliseconds=500),
            eeg_timestamp=base_time,
        )
        
        aligner = EventAligner()
        aligned_events, alignment_result = aligner.align_events(
            events=[event],
            calibrations=[],
            eeg_summaries=[],
        )
        
        assert len(aligned_events) == 1
        assert aligned_events[0].aligned_timestamp == base_time
