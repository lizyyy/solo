import unittest
import tempfile
import os
import json
from datetime import datetime

from drum_analyzer.report import ReportGenerator
from drum_analyzer.models import (
    AnalysisResult,
    MeasureAnalysis,
    BeatDeviation,
    BeatEvent,
    BPMEvidence,
    BeatType,
    DeviationType,
    EventSeverity,
    TimelineEvent,
    TimelineEventType,
)


class TestReportGenerator(unittest.TestCase):
    def setUp(self):
        self.sample_result = self._create_sample_result()

    def _create_sample_result(self) -> AnalysisResult:
        beats = [
            BeatEvent(
                time=0.5,
                beat_type=BeatType.DOWNBEAT,
                measure=1,
                beat_in_measure=1,
                confidence=0.9,
            ),
            BeatEvent(
                time=1.05,
                beat_type=BeatType.WEAK_BEAT,
                measure=1,
                beat_in_measure=2,
                confidence=0.85,
            ),
            BeatEvent(
                time=1.48,
                beat_type=BeatType.WEAK_BEAT,
                measure=1,
                beat_in_measure=3,
                confidence=0.8,
            ),
            BeatEvent(
                time=2.02,
                beat_type=BeatType.UPBEAT,
                measure=1,
                beat_in_measure=4,
                confidence=0.9,
            ),
        ]

        deviations = [
            BeatDeviation(
                beat_event=beats[0],
                expected_time=0.5,
                actual_time=0.5,
                deviation_ms=0,
                deviation_type=DeviationType.ON_TIME,
                severity=EventSeverity.INFO,
            ),
            BeatDeviation(
                beat_event=beats[1],
                expected_time=1.0,
                actual_time=1.05,
                deviation_ms=50,
                deviation_type=DeviationType.LAG,
                severity=EventSeverity.ERROR,
            ),
            BeatDeviation(
                beat_event=beats[2],
                expected_time=1.5,
                actual_time=1.48,
                deviation_ms=-20,
                deviation_type=DeviationType.ON_TIME,
                severity=EventSeverity.INFO,
            ),
            BeatDeviation(
                beat_event=beats[3],
                expected_time=2.0,
                actual_time=2.02,
                deviation_ms=20,
                deviation_type=DeviationType.LAG,
                severity=EventSeverity.WARNING,
            ),
        ]

        measures = [
            MeasureAnalysis(
                measure_number=1,
                start_time=0.0,
                end_time=2.0,
                deviations=deviations,
                avg_deviation_ms=22.5,
                has_lag=True,
                has_lead=False,
                has_missed=False,
                problem_summary="第 1 小节: 2 拍拖拍",
                beats=beats,
            ),
            MeasureAnalysis(
                measure_number=2,
                start_time=2.0,
                end_time=4.0,
                deviations=[
                    BeatDeviation(
                        beat_event=BeatEvent(
                            time=2.5,
                            beat_type=BeatType.DOWNBEAT,
                            measure=2,
                            beat_in_measure=1,
                            confidence=0.9,
                        ),
                        expected_time=2.5,
                        actual_time=2.5,
                        deviation_ms=0,
                        deviation_type=DeviationType.ON_TIME,
                        severity=EventSeverity.INFO,
                    )
                ],
                avg_deviation_ms=0.0,
                has_lag=False,
                has_lead=False,
                has_missed=False,
                problem_summary="第 2 小节: 节拍准确",
                beats=[
                    BeatEvent(
                        time=2.5,
                        beat_type=BeatType.DOWNBEAT,
                        measure=2,
                        beat_in_measure=1,
                        confidence=0.9,
                    )
                ],
            ),
        ]

        timeline = [
            TimelineEvent(
                event_type=TimelineEventType.MEASURE_START,
                time=0.0,
                measure=1,
                description="第 1 小节开始",
                severity=EventSeverity.INFO,
                details={"has_lag": True, "avg_deviation_ms": 22.5},
                order=0,
            ),
            TimelineEvent(
                event_type=TimelineEventType.SIGNIFICANT_DEVIATION,
                time=1.05,
                measure=1,
                description="显著拖拍: 第 1 小节第 2 拍",
                severity=EventSeverity.ERROR,
                details={"deviation_ms": 50, "deviation_type": "lag"},
                order=1,
            ),
        ]

        bpm_evidences = [
            BPMEvidence(
                source="global_onset_tracking",
                bpm=120.0,
                confidence=0.85,
                time_range=(0.0, 4.0),
                beat_count=8,
                support_reason="基于全局 onset 强度追踪",
            ),
            BPMEvidence(
                source="plp_pulse_analysis",
                bpm=119.5,
                confidence=0.80,
                time_range=(0.0, 4.0),
                beat_count=8,
                support_reason="基于 PLP 脉冲分析",
            ),
        ]

        return AnalysisResult(
            audio_file="/test/audio/song.wav",
            reference_file="/test/reference/beats.txt",
            analyzed_at=datetime(2024, 1, 15, 10, 30, 0),
            time_signature=(4, 4),
            reference_bpm=120.0,
            detected_bpm=119.8,
            bpm_evidences=bpm_evidences,
            consistency_check=None,
            measures=measures,
            timeline=timeline,
            total_measures=2,
            total_beats=5,
            lag_measures=[1],
            lead_measures=[],
            missed_beat_measures=[],
            overall_avg_deviation_ms=22.5,
            overall_deviation_std_ms=20.5,
            problem_measures_summary=[
                "拖拍最严重的是第 1 小节，平均偏差 22ms"
            ],
            progress=None,
            human_summary="整体节拍基本稳定，平均偏差 23ms；在第 1 小节有拖拍。",
        )

    def test_generate_terminal_summary(self):
        summary = ReportGenerator.generate_terminal_summary(self.sample_result)

        self.assertIn("鼓手节拍偏差分析", summary)
        self.assertIn("song.wav", summary)
        self.assertIn("120.0", summary)
        self.assertIn("119.8", summary)
        self.assertIn("22.5", summary)
        self.assertIn("拖拍小节", summary)
        self.assertIn("第 1 小节", summary)
        self.assertIn("BPM 证据链", summary)
        self.assertIn("全局 onset 强度追踪", summary)
        self.assertIn("显著拖拍", summary)
        self.assertIn("整体节拍基本稳定", summary)

    def test_generate_measure_details_table(self):
        table = ReportGenerator.generate_measure_details_table(
            self.sample_result.measures
        )

        self.assertIn("小节", table)
        self.assertIn("状态", table)
        self.assertIn("平均偏差", table)
        self.assertIn("拖拍", table)
        self.assertIn("抢拍", table)
        self.assertIn("第 1 小节: 2 拍拖拍", table)
        self.assertIn("节拍准确", table)
        self.assertIn("⚠️", table)
        self.assertIn("✅", table)

    def test_generate_deviation_details_table(self):
        all_deviations = [d for m in self.sample_result.measures for d in m.deviations]
        table = ReportGenerator.generate_deviation_details_table(all_deviations)

        self.assertIn("小节-拍", table)
        self.assertIn("类型", table)
        self.assertIn("偏差", table)
        self.assertIn("🐢", table)
        self.assertIn("✅", table)
        self.assertIn("+50 ms", table)
        self.assertIn("-20 ms", table)
        self.assertIn("downbeat", table)

    def test_generate_json_result(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            json_path = ReportGenerator.generate_json_result(
                self.sample_result, tmpdir
            )

            self.assertTrue(os.path.exists(json_path))
            self.assertTrue(json_path.endswith("song_analysis_result.json"))

            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            self.assertEqual(data["audio_file"], "/test/audio/song.wav")
            self.assertEqual(data["reference_bpm"], 120.0)
            self.assertEqual(data["detected_bpm"], 119.8)
            self.assertEqual(data["total_measures"], 2)
            self.assertEqual(data["lag_measures"], [1])
            self.assertEqual(len(data["measures"]), 2)
            self.assertEqual(len(data["timeline"]), 2)
            self.assertIn("human_summary", data)
            self.assertIn("bpm_evidences", data)

    def test_generate_detailed_report(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            report_path = ReportGenerator.generate_detailed_report(
                self.sample_result, tmpdir
            )

            self.assertTrue(os.path.exists(report_path))
            self.assertTrue(report_path.endswith("song_detailed_report.html"))

            with open(report_path, "r", encoding="utf-8") as f:
                content = f.read()

            self.assertIn("<html", content)
            self.assertIn("鼓手节拍偏差分析", content)
            self.assertIn("song.wav", content)
            self.assertIn("120.0", content)
            self.assertIn("119.8", content)
            self.assertIn("BPM 多源证据链", content)
            self.assertIn("事件时序追踪", content)
            self.assertIn("逐小节分析", content)
            self.assertIn("显著拖拍", content)
            self.assertIn("整体节拍基本稳定", content)
            self.assertIn("deviation-lag", content)
            self.assertIn("severity-error", content)

    def test_format_measure_list(self):
        short_list = [1, 2, 3]
        result = ReportGenerator._format_measure_list(short_list)
        self.assertEqual(result, "1、2、3")

        long_list = [1, 2, 3, 4, 5, 6, 7, 8]
        result = ReportGenerator._format_measure_list(long_list)
        self.assertEqual(result, "1、2、3、4、5 等 8 个")

        empty_list = []
        result = ReportGenerator._format_measure_list(empty_list)
        self.assertEqual(result, "")

    def test_result_to_dict_with_enums(self):
        result_dict = ReportGenerator._result_to_dict(self.sample_result)

        self.assertIsInstance(result_dict["measures"][0]["deviations"][0]["deviation_type"], str)
        self.assertEqual(result_dict["measures"][0]["deviations"][1]["deviation_type"], "lag")
        self.assertEqual(result_dict["timeline"][0]["event_type"], "measure_start")
        self.assertEqual(result_dict["time_signature"], [4, 4])
        self.assertIn("2024-01-15T10:30:00", result_dict["analyzed_at"])

    def test_generate_report_with_consistency_check(self):
        from drum_analyzer.models import ConsistencyCheck

        result = self._create_sample_result()
        result.consistency_check = ConsistencyCheck(
            audio_conclusion="录音整体节拍偏慢",
            reference_conclusion="参考节拍点稳定",
            is_consistent=False,
            bpm_evidences=[
                BPMEvidence(
                    source="reference_beats",
                    bpm=120.0,
                    confidence=0.95,
                    time_range=(0.0, 4.0),
                    beat_count=8,
                    support_reason="来自参考节拍点",
                )
            ],
            resolution_reason="检测到的 BPM 与参考 BPM 相差 5.2，以多源 BPM 分析的加权结果为准",
        )

        summary = ReportGenerator.generate_terminal_summary(result)
        self.assertIn("一致性检查", summary)
        self.assertIn("录音整体节拍偏慢", summary)
        self.assertIn("不一致", summary)
        self.assertIn("多源 BPM 分析", summary)

        with tempfile.TemporaryDirectory() as tmpdir:
            report_path = ReportGenerator.generate_detailed_report(result, tmpdir)
            with open(report_path, "r", encoding="utf-8") as f:
                content = f.read()
            self.assertIn("一致性检查", content)
            self.assertIn("补充 BPM 证据", content)

    def test_generate_report_with_progress(self):
        from drum_analyzer.models import ProgressComparison

        result = self._create_sample_result()
        result.progress = ProgressComparison(
            has_previous=True,
            previous_avg_deviation=45.0,
            current_avg_deviation=22.5,
            improvement_percent=50.0,
            problem_measures_reduced=2,
            human_reason="进步明显！平均偏差从 45ms 降到 22ms，改善了 50%",
        )

        summary = ReportGenerator.generate_terminal_summary(result)
        self.assertIn("进步分析", summary)
        self.assertIn("进步明显", summary)
        self.assertIn("50%", summary)

        with tempfile.TemporaryDirectory() as tmpdir:
            report_path = ReportGenerator.generate_detailed_report(result, tmpdir)
            with open(report_path, "r", encoding="utf-8") as f:
                content = f.read()
            self.assertIn("进步分析", content)
            self.assertIn("改善程度", content)
            self.assertIn("+50.0%", content)


if __name__ == "__main__":
    unittest.main()
