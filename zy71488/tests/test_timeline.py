import unittest

from drum_analyzer.timeline import TimelineTracker
from drum_analyzer.models import TimelineEventType, EventSeverity


class TestTimelineTracker(unittest.TestCase):
    def setUp(self):
        self.tracker = TimelineTracker()

    def test_add_event(self):
        event = self.tracker.add_event(
            event_type="bpm_change",
            time=5.0,
            measure=3,
            description="BPM 变化测试",
            severity=EventSeverity.WARNING,
            details={"old_bpm": 120, "new_bpm": 130},
        )

        self.assertEqual(event.event_type, TimelineEventType.BPM_CHANGE)
        self.assertEqual(event.time, 5.0)
        self.assertEqual(event.measure, 3)
        self.assertEqual(event.severity, EventSeverity.WARNING)
        self.assertEqual(event.details["old_bpm"], 120)
        self.assertEqual(event.order, 0)

    def test_get_sorted_events(self):
        times = [3.0, 1.0, 5.0, 2.0, 4.0]
        for i, t in enumerate(times):
            self.tracker.add_event(
                event_type="measure_start",
                time=t,
                measure=i + 1,
                description=f"第 {i + 1} 小节",
            )

        sorted_events = self.tracker.get_sorted_events()
        sorted_times = [e.time for e in sorted_events]

        self.assertEqual(sorted_times, sorted(times))

    def test_same_time_preserves_order(self):
        for i in range(3):
            self.tracker.add_event(
                event_type="measure_start",
                time=1.0,
                measure=1,
                description=f"事件 {i}",
            )

        sorted_events = self.tracker.get_sorted_events()
        for i, event in enumerate(sorted_events):
            self.assertEqual(event.order, i)
            self.assertEqual(event.description, f"事件 {i}")

    def test_get_events_by_type(self):
        self.tracker.add_event(
            event_type="bpm_change", time=1.0, measure=1, description="BPM 变化"
        )
        self.tracker.add_event(
            event_type="weak_beat_miss", time=2.0, measure=2, description="弱拍漏检"
        )
        self.tracker.add_event(
            event_type="bpm_change", time=3.0, measure=3, description="BPM 变化 2"
        )

        bpm_events = self.tracker.get_events_by_type(TimelineEventType.BPM_CHANGE)
        self.assertEqual(len(bpm_events), 2)

        miss_events = self.tracker.get_events_by_type(TimelineEventType.WEAK_BEAT_MISS)
        self.assertEqual(len(miss_events), 1)

    def test_get_events_by_measure(self):
        for measure in range(1, 6):
            self.tracker.add_event(
                event_type="measure_start",
                time=float(measure) * 2,
                measure=measure,
                description=f"第 {measure} 小节",
            )

        measure_3_events = self.tracker.get_events_by_measure(3)
        self.assertEqual(len(measure_3_events), 1)
        self.assertEqual(measure_3_events[0].measure, 3)

    def test_get_events_by_severity(self):
        self.tracker.add_event(
            event_type="significant_deviation",
            time=1.0,
            measure=1,
            description="严重拖拍",
            severity=EventSeverity.ERROR,
        )
        self.tracker.add_event(
            event_type="weak_beat_miss",
            time=2.0,
            measure=2,
            description="弱拍漏检",
            severity=EventSeverity.WARNING,
        )
        self.tracker.add_event(
            event_type="noise_false_positive",
            time=3.0,
            measure=3,
            description="噪声误判",
            severity=EventSeverity.INFO,
        )

        error_events = self.tracker.get_events_by_severity(EventSeverity.ERROR)
        warning_events = self.tracker.get_events_by_severity(EventSeverity.WARNING)
        info_events = self.tracker.get_events_by_severity(EventSeverity.INFO)

        self.assertEqual(len(error_events), 1)
        self.assertEqual(len(warning_events), 1)
        self.assertEqual(len(info_events), 1)

    def test_find_related_events(self):
        self.tracker.add_event(
            event_type="bpm_change",
            time=5.0,
            measure=3,
            description="BPM 变化",
            severity=EventSeverity.WARNING,
        )
        self.tracker.add_event(
            event_type="weak_beat_miss",
            time=5.2,
            measure=3,
            description="弱拍漏检",
            severity=EventSeverity.WARNING,
        )
        self.tracker.add_event(
            event_type="noise_false_positive",
            time=5.5,
            measure=3,
            description="噪声误判",
            severity=EventSeverity.INFO,
        )
        self.tracker.add_event(
            event_type="significant_deviation",
            time=10.0,
            measure=6,
            description="显著偏差",
            severity=EventSeverity.ERROR,
        )

        target = self.tracker.get_events_by_type(TimelineEventType.BPM_CHANGE)[0]
        related = self.tracker.find_related_events(target, time_window_sec=1.0)

        self.assertEqual(len(related), 2)
        event_types = [e.event_type for e in related]
        self.assertIn(TimelineEventType.WEAK_BEAT_MISS, event_types)
        self.assertIn(TimelineEventType.NOISE_FALSE_POSITIVE, event_types)

    def test_generate_timeline_analysis_chain(self):
        self.tracker.add_event(
            event_type="bpm_change",
            time=5.0,
            measure=3,
            description="BPM 从 120 变为 130",
            severity=EventSeverity.WARNING,
            details={"original_bpm": 120.0, "window_bpm": 130.0},
        )
        self.tracker.add_event(
            event_type="weak_beat_miss",
            time=5.1,
            measure=3,
            description="弱拍漏检: 第 3 小节第 2 拍",
            severity=EventSeverity.WARNING,
            details={"beat_type": "weak_beat"},
        )
        self.tracker.add_event(
            event_type="noise_false_positive",
            time=5.3,
            measure=3,
            description="疑似噪声误判",
            severity=EventSeverity.INFO,
        )

        analyses = self.tracker.generate_timeline_analysis()

        self.assertEqual(len(analyses), 3)
        self.assertIn("紧接在", analyses[1])
        self.assertIn("BPM 变化同时发生", analyses[1])
        self.assertIn("补偿性检测", analyses[2])

    def test_timeline_iteration(self):
        for i in range(5):
            self.tracker.add_event(
                event_type="measure_start",
                time=float(i),
                measure=i + 1,
                description=f"第 {i + 1} 小节",
            )

        events = list(self.tracker)
        self.assertEqual(len(events), 5)
        self.assertEqual(len(self.tracker), 5)

    def test_complex_event_chain_with_order(self):
        event_sequence = [
            ("measure_start", 0.0, 1, "第 1 小节开始", EventSeverity.INFO, {}),
            ("bpm_change", 2.5, 1, "BPM 变化: 120 -> 125", EventSeverity.WARNING, {"original_bpm": 120.0, "window_bpm": 125.0}),
            ("weak_beat_miss", 2.6, 1, "弱拍漏检: 第 1 小节第 3 拍", EventSeverity.WARNING, {"beat_type": "weak_beat"}),
            ("noise_false_positive", 2.8, 1, "噪声误判", EventSeverity.INFO, {}),
            ("significant_deviation", 3.0, 2, "显著拖拍: 第 2 小节第 1 拍", EventSeverity.ERROR, {"deviation_ms": 60.0, "deviation_type": "lag"}),
            ("measure_start", 4.0, 2, "第 2 小节开始", EventSeverity.INFO, {}),
        ]

        for event_type, time, measure, desc, severity, details in event_sequence:
            self.tracker.add_event(
                event_type=event_type,
                time=time,
                measure=measure,
                description=desc,
                severity=severity,
                details=details,
            )

        sorted_events = self.tracker.get_sorted_events()

        for i, (_, time, _, _, _, _) in enumerate(event_sequence):
            self.assertAlmostEqual(sorted_events[i].time, time, places=5)
            self.assertEqual(sorted_events[i].order, i)

        analyses = self.tracker.generate_timeline_analysis()
        self.assertEqual(len(analyses), len(event_sequence))

        self.assertIn("紧接在", analyses[2])
        self.assertIn("BPM 变化同时发生", analyses[2])
        self.assertIn("补偿性检测", analyses[3])
        self.assertIn("BPM 不稳定期间", analyses[4])

    def test_get_event_chain(self):
        for i in range(10):
            self.tracker.add_event(
                event_type="measure_start",
                time=float(i) * 2,
                measure=i + 1,
                description=f"第 {i + 1} 小节",
            )

        chain = self.tracker.get_event_chain(4.0, 12.0)
        self.assertEqual(len(chain), 5)
        self.assertEqual(chain[0].time, 4.0)
        self.assertEqual(chain[-1].time, 12.0)


if __name__ == "__main__":
    unittest.main()
