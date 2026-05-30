import unittest
import tempfile
import os
import json
import numpy as np
from pathlib import Path

from drum_analyzer.analyzer import BeatAnalyzer
from drum_analyzer.models import (
    BeatType,
    DeviationType,
    EventSeverity,
    BeatEvent,
    BPMEvidence,
)


class TestBeatAnalyzer(unittest.TestCase):
    def setUp(self):
        self.analyzer = BeatAnalyzer(
            time_signature=(4, 4),
            reference_bpm=120,
            lag_threshold_ms=30,
            lead_threshold_ms=-30,
        )

    def test_deviation_classification_lag(self):
        result = self.analyzer._analyze_measures(
            beats=[
                BeatEvent(
                    time=0.05,
                    beat_type=BeatType.DOWNBEAT,
                    measure=1,
                    beat_in_measure=1,
                    confidence=0.9,
                )
            ],
            bpm=120,
            duration=10,
        )

        self.assertEqual(len(result), 1)
        measure = result[0]
        self.assertEqual(measure.measure_number, 1)
        self.assertTrue(measure.has_lag)
        self.assertFalse(measure.has_lead)
        self.assertFalse(measure.has_missed)

        deviation = measure.deviations[0]
        self.assertEqual(deviation.deviation_type, DeviationType.LAG)
        self.assertGreater(deviation.deviation_ms, 30)

    def test_deviation_classification_lead(self):
        result = self.analyzer._analyze_measures(
            beats=[
                BeatEvent(
                    time=0.45,
                    beat_type=BeatType.DOWNBEAT,
                    measure=1,
                    beat_in_measure=2,
                    confidence=0.9,
                )
            ],
            bpm=120,
            duration=10,
        )

        self.assertEqual(len(result), 1)
        measure = result[0]
        self.assertFalse(measure.has_lag)
        self.assertTrue(measure.has_lead)

        deviation = measure.deviations[0]
        self.assertEqual(deviation.deviation_type, DeviationType.LEAD)
        self.assertLess(deviation.deviation_ms, -30)

    def test_deviation_classification_on_time(self):
        result = self.analyzer._analyze_measures(
            beats=[
                BeatEvent(
                    time=0.0,
                    beat_type=BeatType.DOWNBEAT,
                    measure=1,
                    beat_in_measure=1,
                    confidence=0.9,
                )
            ],
            bpm=120,
            duration=10,
        )

        self.assertEqual(len(result), 1)
        measure = result[0]
        self.assertFalse(measure.has_lag)
        self.assertFalse(measure.has_lead)

        deviation = measure.deviations[0]
        self.assertEqual(deviation.deviation_type, DeviationType.ON_TIME)
        self.assertAlmostEqual(deviation.deviation_ms, 0, delta=30)

    def test_deviation_classification_noise(self):
        result = self.analyzer._analyze_measures(
            beats=[
                BeatEvent(
                    time=0.02,
                    beat_type=BeatType.DOWNBEAT,
                    measure=1,
                    beat_in_measure=1,
                    confidence=0.2,
                )
            ],
            bpm=120,
            duration=10,
        )

        deviation = result[0].deviations[0]
        self.assertEqual(deviation.deviation_type, DeviationType.NOISE)
        self.assertEqual(deviation.severity, EventSeverity.INFO)

    def test_missed_beat_detection(self):
        result = self.analyzer._analyze_measures(
            beats=[
                BeatEvent(
                    time=0.0,
                    beat_type=BeatType.DOWNBEAT,
                    measure=1,
                    beat_in_measure=1,
                    confidence=0.0,
                )
            ],
            bpm=120,
            duration=10,
        )

        self.assertTrue(result[0].has_missed)
        deviation = result[0].deviations[0]
        self.assertEqual(deviation.deviation_type, DeviationType.MISSED)
        self.assertEqual(deviation.severity, EventSeverity.ERROR)

    def test_significant_deviation_severity(self):
        result = self.analyzer._analyze_measures(
            beats=[
                BeatEvent(
                    time=0.1,
                    beat_type=BeatType.DOWNBEAT,
                    measure=1,
                    beat_in_measure=1,
                    confidence=0.9,
                )
            ],
            bpm=120,
            duration=10,
        )

        deviation = result[0].deviations[0]
        self.assertEqual(deviation.deviation_type, DeviationType.LAG)
        self.assertEqual(deviation.severity, EventSeverity.ERROR)
        self.assertGreater(deviation.deviation_ms, 50)

    def test_beat_alignment(self):
        detected_beats = [
            BeatEvent(time=0.51, beat_type=BeatType.DOWNBEAT, measure=0, beat_in_measure=1, confidence=0.9),
            BeatEvent(time=1.02, beat_type=BeatType.WEAK_BEAT, measure=0, beat_in_measure=2, confidence=0.85),
            BeatEvent(time=1.53, beat_type=BeatType.WEAK_BEAT, measure=0, beat_in_measure=3, confidence=0.8),
        ]

        reference_beats = [
            BeatEvent(time=0.5, beat_type=BeatType.DOWNBEAT, measure=1, beat_in_measure=1, confidence=1.0, is_reference=True),
            BeatEvent(time=1.0, beat_type=BeatType.WEAK_BEAT, measure=1, beat_in_measure=2, confidence=1.0, is_reference=True),
            BeatEvent(time=1.5, beat_type=BeatType.WEAK_BEAT, measure=1, beat_in_measure=3, confidence=1.0, is_reference=True),
        ]

        aligned = self.analyzer._align_beats(detected_beats, reference_beats)

        self.assertEqual(len(aligned), len(reference_beats))
        for i, beat in enumerate(aligned):
            self.assertEqual(beat.measure, 1)
            self.assertEqual(beat.beat_in_measure, i + 1)
            self.assertAlmostEqual(beat.time, detected_beats[i].time, delta=0.01)

    def test_load_reference_beats_txt(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write("# 测试节拍点\n")
            f.write("0.5 1\n")
            f.write("1.0 2\n")
            f.write("1.5 3\n")
            f.write("2.0 4\n")
            temp_path = f.name

        try:
            beats = self.analyzer._load_reference_beats(temp_path)
            self.assertEqual(len(beats), 4)
            self.assertEqual(beats[0].time, 0.5)
            self.assertEqual(beats[0].beat_in_measure, 1)
            self.assertEqual(beats[0].beat_type, BeatType.DOWNBEAT)
            self.assertTrue(beats[0].is_reference)
        finally:
            os.unlink(temp_path)

    def test_load_reference_beats_json(self):
        beat_data = {
            "beats": [
                {"time": 0.5, "beat_type": "downbeat", "measure": 1, "beat_in_measure": 1},
                {"time": 1.0, "beat_type": "weak_beat", "measure": 1, "beat_in_measure": 2},
            ]
        }

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as f:
            json.dump(beat_data, f)
            temp_path = f.name

        try:
            beats = self.analyzer._load_reference_beats(temp_path)
            self.assertEqual(len(beats), 2)
            self.assertEqual(beats[0].time, 0.5)
            self.assertEqual(beats[0].beat_type, BeatType.DOWNBEAT)
            self.assertEqual(beats[1].beat_type, BeatType.WEAK_BEAT)
        finally:
            os.unlink(temp_path)

    def test_consistency_check_agreement(self):
        detected_beats = [
            BeatEvent(time=t, beat_type=BeatType.DOWNBEAT, measure=i // 4 + 1, beat_in_measure=i % 4 + 1, confidence=0.9)
            for i, t in enumerate(np.arange(0.5, 5.0, 0.5))
        ]
        reference_beats = [
            BeatEvent(time=t, beat_type=BeatType.DOWNBEAT, measure=i // 4 + 1, beat_in_measure=i % 4 + 1, confidence=1.0, is_reference=True)
            for i, t in enumerate(np.arange(0.5, 5.0, 0.5))
        ]

        check = self.analyzer._check_consistency(
            detected_beats, reference_beats, 120.0, []
        )

        self.assertTrue(check.is_consistent)
        self.assertIn("一致", check.resolution_reason)

    def test_consistency_check_disagreement(self):
        detected_beats = [
            BeatEvent(time=t + 0.1, beat_type=BeatType.DOWNBEAT, measure=i // 4 + 1, beat_in_measure=i % 4 + 1, confidence=0.9)
            for i, t in enumerate(np.arange(0.5, 5.0, 0.5))
        ]
        reference_beats = [
            BeatEvent(time=t, beat_type=BeatType.DOWNBEAT, measure=i // 4 + 1, beat_in_measure=i % 4 + 1, confidence=1.0, is_reference=True)
            for i, t in enumerate(np.arange(0.5, 5.0, 0.5))
        ]

        check = self.analyzer._check_consistency(
            detected_beats, reference_beats, 120.0, []
        )

        self.assertFalse(check.is_consistent)
        self.assertGreater(len(check.bpm_evidences), 0)
        self.assertIn("BPM", check.resolution_reason)

    def test_compare_with_previous_improvement(self):
        prev_data = {
            "overall_avg_deviation_ms": 80.0,
            "lag_measures": [1, 3, 5],
            "lead_measures": [2, 4],
        }

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as f:
            json.dump(prev_data, f)
            temp_path = f.name

        try:
            progress = self.analyzer._compare_with_previous(
                temp_path,
                current_avg_deviation=40.0,
                current_lag_measures=[1],
                current_lead_measures=[],
            )

            self.assertTrue(progress.has_previous)
            self.assertEqual(progress.previous_avg_deviation, 80.0)
            self.assertEqual(progress.current_avg_deviation, 40.0)
            self.assertGreater(progress.improvement_percent, 40)
            self.assertIn("进步", progress.human_reason)
        finally:
            os.unlink(temp_path)

    def test_compare_with_previous_no_improvement(self):
        prev_data = {
            "overall_avg_deviation_ms": 40.0,
            "lag_measures": [1],
            "lead_measures": [],
        }

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as f:
            json.dump(prev_data, f)
            temp_path = f.name

        try:
            progress = self.analyzer._compare_with_previous(
                temp_path,
                current_avg_deviation=80.0,
                current_lag_measures=[1, 3, 5],
                current_lead_measures=[2, 4],
            )

            self.assertTrue(progress.has_previous)
            self.assertLess(progress.improvement_percent, -40)
            self.assertIn("不如上次", progress.human_reason)
        finally:
            os.unlink(temp_path)

    def test_generate_human_summary_good(self):
        measures = self.analyzer._analyze_measures(
            beats=[
                BeatEvent(time=t, beat_type=BeatType.DOWNBEAT, measure=i // 4 + 1, beat_in_measure=i % 4 + 1, confidence=0.9)
                for i, t in enumerate(np.arange(0.5, 5.0, 0.5))
            ],
            bpm=120,
            duration=10,
        )

        summary = self.analyzer._generate_human_summary(
            measures, [], [], [], 20.0, None
        )

        self.assertIn("节拍很稳", summary)
        self.assertIn("20ms", summary)

    def test_generate_human_summary_with_problems(self):
        beats = []
        for i, t in enumerate(np.arange(0.5, 5.0, 0.5)):
            if i in [0, 4, 8]:
                t += 0.1
            beats.append(
                BeatEvent(
                    time=t,
                    beat_type=BeatType.DOWNBEAT,
                    measure=i // 4 + 1,
                    beat_in_measure=i % 4 + 1,
                    confidence=0.9,
                )
            )

        measures = self.analyzer._analyze_measures(beats, bpm=120, duration=10)

        summary = self.analyzer._generate_human_summary(
            measures, [1, 2, 3], [], [], 60.0, None
        )

        self.assertIn("加强", summary)
        self.assertIn("拖拍", summary)

    def test_timeline_tracking(self):
        self.analyzer._analyze_measures(
            beats=[
                BeatEvent(
                    time=0.1,
                    beat_type=BeatType.DOWNBEAT,
                    measure=1,
                    beat_in_measure=1,
                    confidence=0.9,
                ),
                BeatEvent(
                    time=1.05,
                    beat_type=BeatType.WEAK_BEAT,
                    measure=1,
                    beat_in_measure=3,
                    confidence=0.2,
                ),
            ],
            bpm=120,
            duration=10,
        )

        events = self.analyzer.timeline_tracker.get_sorted_events()
        self.assertGreater(len(events), 0)

        has_measure_start = any("小节开始" in e.description for e in events)
        has_significant = any("显著" in e.description for e in events)
        has_noise = any("噪声" in e.description for e in events)

        self.assertTrue(has_measure_start)
        self.assertTrue(has_significant)
        self.assertTrue(has_noise)

    def test_weak_beat_miss_detection(self):
        detected_beats = [
            BeatEvent(time=0.5, beat_type=BeatType.DOWNBEAT, measure=1, beat_in_measure=1, confidence=0.9),
        ]

        reference_beats = [
            BeatEvent(time=0.5, beat_type=BeatType.DOWNBEAT, measure=1, beat_in_measure=1, confidence=1.0, is_reference=True),
            BeatEvent(time=1.0, beat_type=BeatType.WEAK_BEAT, measure=1, beat_in_measure=2, confidence=1.0, is_reference=True),
        ]

        self.analyzer._align_beats(detected_beats, reference_beats)

        events = self.analyzer.timeline_tracker.get_sorted_events()
        weak_miss_events = [e for e in events if "弱拍漏检" in e.description]
        self.assertGreater(len(weak_miss_events), 0)

    def test_timeline_order(self):
        for i in range(5):
            self.analyzer.timeline_tracker.add_event(
                event_type="measure_start",
                time=float(i),
                measure=i + 1,
                description=f"第 {i + 1} 小节开始",
            )

        events = self.analyzer.timeline_tracker.get_sorted_events()
        for i in range(len(events) - 1):
            self.assertLessEqual(events[i].time, events[i + 1].time)
            self.assertEqual(events[i].order, i)


if __name__ == "__main__":
    unittest.main()
