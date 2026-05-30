import numpy as np
import librosa
from typing import List, Tuple, Optional, Dict
from datetime import datetime
import os
import json

from .models import (
    BeatEvent,
    BeatDeviation,
    MeasureAnalysis,
    AnalysisResult,
    BPMEvidence,
    ConsistencyCheck,
    ProgressComparison,
    BeatType,
    DeviationType,
    EventSeverity,
)
from .timeline import TimelineTracker


class BeatAnalyzer:
    LAG_THRESHOLD_MS = 30
    LEAD_THRESHOLD_MS = -30
    SIGNIFICANT_DEVIATION_MS = 50
    MISSED_THRESHOLD_MS = 150
    NOISE_THRESHOLD_CONFIDENCE = 0.3

    def __init__(
        self,
        time_signature: Tuple[int, int] = (4, 4),
        reference_bpm: Optional[float] = None,
        lag_threshold_ms: int = 30,
        lead_threshold_ms: int = -30,
    ):
        self.time_signature = time_signature
        self.reference_bpm = reference_bpm
        self.LAG_THRESHOLD_MS = lag_threshold_ms
        self.LEAD_THRESHOLD_MS = lead_threshold_ms
        self.timeline_tracker = TimelineTracker()

    def analyze(
        self,
        audio_file: str,
        reference_beats_file: Optional[str] = None,
        previous_result_file: Optional[str] = None,
    ) -> AnalysisResult:
        if not os.path.exists(audio_file):
            raise FileNotFoundError(f"音频文件不存在: {audio_file}")

        y, sr = librosa.load(audio_file, sr=44100, mono=True)
        duration = librosa.get_duration(y=y, sr=sr)

        detected_beats, detected_bpm, bpm_evidences = self._detect_beats(y, sr, duration)

        reference_beats = None
        if reference_beats_file and os.path.exists(reference_beats_file):
            reference_beats = self._load_reference_beats(reference_beats_file)

        if reference_beats and len(reference_beats) > 0:
            aligned_beats = self._align_beats(detected_beats, reference_beats)
            consistency_check = self._check_consistency(
                detected_beats, reference_beats, detected_bpm, bpm_evidences
            )
        else:
            aligned_beats = self._assign_measure_positions(detected_beats, detected_bpm)
            consistency_check = None

        measures = self._analyze_measures(aligned_beats, detected_bpm, duration)

        all_deviations = [d for m in measures for d in m.deviations]
        lag_measures = [m.measure_number for m in measures if m.has_lag]
        lead_measures = [m.measure_number for m in measures if m.has_lead]
        missed_beat_measures = [m.measure_number for m in measures if m.has_missed]

        if all_deviations:
            deviations_ms = [d.deviation_ms for d in all_deviations]
            overall_avg_deviation = float(np.mean(np.abs(deviations_ms)))
            overall_std_deviation = float(np.std(deviations_ms))
        else:
            overall_avg_deviation = 0.0
            overall_std_deviation = 0.0

        problem_measures_summary = self._generate_problem_summary(measures)

        progress = None
        if previous_result_file and os.path.exists(previous_result_file):
            progress = self._compare_with_previous(
                previous_result_file, overall_avg_deviation, lag_measures, lead_measures
            )

        human_summary = self._generate_human_summary(
            measures,
            lag_measures,
            lead_measures,
            missed_beat_measures,
            overall_avg_deviation,
            progress,
        )

        timeline = self.timeline_tracker.get_sorted_events()

        return AnalysisResult(
            audio_file=audio_file,
            reference_file=reference_beats_file,
            analyzed_at=datetime.now(),
            time_signature=self.time_signature,
            reference_bpm=self.reference_bpm or detected_bpm,
            detected_bpm=detected_bpm,
            bpm_evidences=bpm_evidences,
            consistency_check=consistency_check,
            measures=measures,
            timeline=timeline,
            total_measures=len(measures),
            total_beats=len(aligned_beats),
            lag_measures=lag_measures,
            lead_measures=lead_measures,
            missed_beat_measures=missed_beat_measures,
            overall_avg_deviation_ms=overall_avg_deviation,
            overall_deviation_std_ms=overall_std_deviation,
            problem_measures_summary=problem_measures_summary,
            progress=progress,
            human_summary=human_summary,
        )

    def _detect_beats(
        self, y: np.ndarray, sr: int, duration: float
    ) -> Tuple[List[BeatEvent], float, List[BPMEvidence]]:
        bpm_evidences: List[BPMEvidence] = []

        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        tempo, beat_frames = librosa.beat.beat_track(
            onset_envelope=onset_env, sr=sr, units="frames"
        )
        beat_times = librosa.frames_to_time(beat_frames, sr=sr)
        detected_bpm = float(tempo)

        bpm_evidences.append(
            BPMEvidence(
                source="global_onset_tracking",
                bpm=detected_bpm,
                confidence=0.85,
                time_range=(0.0, duration),
                beat_count=len(beat_times),
                support_reason="基于全局 onset 强度追踪，覆盖整首曲目",
            )
        )

        window_size = 10.0
        hop_size = 5.0
        window_bpms = []
        for start in np.arange(0, duration - window_size, hop_size):
            end = start + window_size
            start_sample = int(start * sr)
            end_sample = int(end * sr)
            y_window = y[start_sample:end_sample]
            if len(y_window) < sr:
                continue
            try:
                onset_env_win = librosa.onset.onset_strength(y=y_window, sr=sr)
                tempo_win, _ = librosa.beat.beat_track(
                    onset_envelope=onset_env_win, sr=sr, units="frames"
                )
                window_bpms.append(float(tempo_win))
                if abs(float(tempo_win) - detected_bpm) > 10:
                    self.timeline_tracker.add_event(
                        event_type="bpm_change",
                        time=start,
                        measure=int(start * detected_bpm / 60 / self.time_signature[0]) + 1,
                        description=f"检测到局部 BPM 变化: {detected_bpm:.1f} -> {float(tempo_win):.1f}",
                        severity=EventSeverity.WARNING,
                        details={
                            "original_bpm": detected_bpm,
                            "window_bpm": float(tempo_win),
                            "time_range": (start, end),
                        },
                    )
            except Exception:
                pass

        if window_bpms:
            bpm_evidences.append(
                BPMEvidence(
                    source="sliding_window_analysis",
                    bpm=float(np.median(window_bpms)),
                    confidence=0.75,
                    time_range=(0.0, duration),
                    beat_count=len(window_bpms),
                    support_reason=f"基于 {len(window_bpms)} 个滑动窗口的 BPM 中位数",
                )
            )

        plp = librosa.beat.plp(onset_envelope=onset_env, sr=sr)
        plp_tempo = float(librosa.beat.tempo(onset_envelope=plp, sr=sr)[0])
        bpm_evidences.append(
            BPMEvidence(
                source="plp_pulse_analysis",
                bpm=plp_tempo,
                confidence=0.80,
                time_range=(0.0, duration),
                beat_count=len(beat_times),
                support_reason="基于周期性脉冲模式 (PLP) 的节拍检测",
            )
        )

        beats: List[BeatEvent] = []
        for i, beat_time in enumerate(beat_times):
            beat_in_measure = (i % self.time_signature[0]) + 1
            if beat_in_measure == 1:
                beat_type = BeatType.DOWNBEAT
            elif beat_in_measure == self.time_signature[0]:
                beat_type = BeatType.UPBEAT
            elif 2 <= beat_in_measure <= self.time_signature[0] - 1:
                beat_type = BeatType.WEAK_BEAT
            else:
                beat_type = BeatType.WEAK_BEAT

            measure = (i // self.time_signature[0]) + 1

            onset_strength = float(onset_env[beat_frames[i]]) if beat_frames[i] < len(onset_env) else 0.5
            confidence = min(1.0, max(0.1, onset_strength / np.max(onset_env) if np.max(onset_env) > 0 else 0.5))

            if confidence < self.NOISE_THRESHOLD_CONFIDENCE:
                self.timeline_tracker.add_event(
                    event_type="noise_false_positive",
                    time=beat_time,
                    measure=measure,
                    description=f"检测到疑似噪声误判，置信度仅 {confidence:.2f}",
                    severity=EventSeverity.INFO,
                    details={"confidence": confidence, "beat_index": i},
                )

            beats.append(
                BeatEvent(
                    time=float(beat_time),
                    beat_type=beat_type,
                    measure=measure,
                    beat_in_measure=beat_in_measure,
                    confidence=confidence,
                    is_reference=False,
                )
            )

        return beats, detected_bpm, bpm_evidences

    def _load_reference_beats(self, reference_file: str) -> List[BeatEvent]:
        ref_beats: List[BeatEvent] = []
        if reference_file.endswith(".json"):
            with open(reference_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            for beat_data in data.get("beats", []):
                ref_beats.append(
                    BeatEvent(
                        time=float(beat_data["time"]),
                        beat_type=BeatType(beat_data.get("beat_type", "weak_beat")),
                        measure=int(beat_data.get("measure", 0)),
                        beat_in_measure=int(beat_data.get("beat_in_measure", 1)),
                        confidence=1.0,
                        is_reference=True,
                    )
                )
        else:
            with open(reference_file, "r", encoding="utf-8") as f:
                for i, line in enumerate(f):
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    parts = line.split()
                    time = float(parts[0])
                    beat_in_measure = int(parts[1]) if len(parts) > 1 else (i % self.time_signature[0]) + 1
                    measure = (i // self.time_signature[0]) + 1
                    if beat_in_measure == 1:
                        beat_type = BeatType.DOWNBEAT
                    elif beat_in_measure == self.time_signature[0]:
                        beat_type = BeatType.UPBEAT
                    else:
                        beat_type = BeatType.WEAK_BEAT
                    ref_beats.append(
                        BeatEvent(
                            time=time,
                            beat_type=beat_type,
                            measure=measure,
                            beat_in_measure=beat_in_measure,
                            confidence=1.0,
                            is_reference=True,
                        )
                    )
        return ref_beats

    def _align_beats(
        self, detected_beats: List[BeatEvent], reference_beats: List[BeatEvent]
    ) -> List[BeatEvent]:
        aligned: List[BeatEvent] = []
        used_detected = set()

        for ref_beat in reference_beats:
            best_match = None
            best_diff = float("inf")
            for i, det_beat in enumerate(detected_beats):
                if i in used_detected:
                    continue
                diff = abs(det_beat.time - ref_beat.time)
                if diff < best_diff and diff < self.MISSED_THRESHOLD_MS / 1000:
                    best_diff = diff
                    best_match = i
            if best_match is not None:
                used_detected.add(best_match)
                det_beat = detected_beats[best_match]
                aligned.append(
                    BeatEvent(
                        time=det_beat.time,
                        beat_type=ref_beat.beat_type,
                        measure=ref_beat.measure,
                        beat_in_measure=ref_beat.beat_in_measure,
                        confidence=det_beat.confidence,
                        is_reference=False,
                    )
                )
            else:
                aligned.append(
                    BeatEvent(
                        time=ref_beat.time,
                        beat_type=ref_beat.beat_type,
                        measure=ref_beat.measure,
                        beat_in_measure=ref_beat.beat_in_measure,
                        confidence=0.0,
                        is_reference=False,
                    )
                )
                if ref_beat.beat_type in (BeatType.WEAK_BEAT, BeatType.GHOST_NOTE):
                    self.timeline_tracker.add_event(
                        event_type="weak_beat_miss",
                        time=ref_beat.time,
                        measure=ref_beat.measure,
                        description=f"弱拍漏检: 第 {ref_beat.measure} 小节第 {ref_beat.beat_in_measure} 拍",
                        severity=EventSeverity.WARNING,
                        details={
                            "beat_type": ref_beat.beat_type.value,
                            "expected_time": ref_beat.time,
                        },
                    )

        for i, det_beat in enumerate(detected_beats):
            if i not in used_detected:
                nearest_ref = min(
                    reference_beats, key=lambda b: abs(b.time - det_beat.time)
                )
                if abs(nearest_ref.time - det_beat.time) > self.MISSED_THRESHOLD_MS / 1000:
                    self.timeline_tracker.add_event(
                        event_type="noise_false_positive",
                        time=det_beat.time,
                        measure=nearest_ref.measure,
                        description=f"疑似噪声误判: 在 {det_beat.time:.2f}s 检测到额外节拍点",
                        severity=EventSeverity.INFO,
                        details={"detected_time": det_beat.time, "confidence": det_beat.confidence},
                    )

        return aligned

    def _assign_measure_positions(
        self, beats: List[BeatEvent], bpm: float
    ) -> List[BeatEvent]:
        beats_per_measure = self.time_signature[0]
        for i, beat in enumerate(beats):
            beat.measure = (i // beats_per_measure) + 1
            beat.beat_in_measure = (i % beats_per_measure) + 1
        return beats

    def _analyze_measures(
        self, beats: List[BeatEvent], bpm: float, duration: float
    ) -> List[MeasureAnalysis]:
        measures: Dict[int, List[BeatEvent]] = {}
        for beat in beats:
            if beat.measure not in measures:
                measures[beat.measure] = []
            measures[beat.measure].append(beat)

        beat_interval = 60.0 / bpm
        measure_duration = beat_interval * self.time_signature[0]

        result: List[MeasureAnalysis] = []
        for measure_num in sorted(measures.keys()):
            measure_beats = measures[measure_num]
            start_time = (measure_num - 1) * measure_duration
            end_time = measure_num * measure_duration

            deviations: List[BeatDeviation] = []
            for beat in measure_beats:
                expected_time = start_time + (beat.beat_in_measure - 1) * beat_interval
                deviation_ms = (beat.time - expected_time) * 1000

                if beat.confidence == 0.0 or deviation_ms > self.MISSED_THRESHOLD_MS:
                    dev_type = DeviationType.MISSED
                    severity = EventSeverity.ERROR
                elif beat.confidence < self.NOISE_THRESHOLD_CONFIDENCE:
                    dev_type = DeviationType.NOISE
                    severity = EventSeverity.INFO
                    self.timeline_tracker.add_event(
                        event_type="noise_false_positive",
                        time=beat.time,
                        measure=measure_num,
                        description=f"疑似噪声误判: 第 {measure_num} 小节第 {beat.beat_in_measure} 拍，置信度仅 {beat.confidence:.2f}",
                        severity=EventSeverity.INFO,
                        details={"confidence": beat.confidence},
                    )
                elif deviation_ms > self.LAG_THRESHOLD_MS:
                    dev_type = DeviationType.LAG
                    severity = (
                        EventSeverity.ERROR
                        if deviation_ms > self.SIGNIFICANT_DEVIATION_MS
                        else EventSeverity.WARNING
                    )
                    if deviation_ms > self.SIGNIFICANT_DEVIATION_MS:
                        self.timeline_tracker.add_event(
                            event_type="significant_deviation",
                            time=beat.time,
                            measure=measure_num,
                            description=f"显著拖拍: 第 {measure_num} 小节第 {beat.beat_in_measure} 拍，偏差 {deviation_ms:.0f}ms",
                            severity=EventSeverity.ERROR,
                            details={
                                "deviation_ms": deviation_ms,
                                "deviation_type": "lag",
                                "beat_type": beat.beat_type.value,
                            },
                        )
                elif deviation_ms < self.LEAD_THRESHOLD_MS:
                    dev_type = DeviationType.LEAD
                    severity = (
                        EventSeverity.ERROR
                        if abs(deviation_ms) > self.SIGNIFICANT_DEVIATION_MS
                        else EventSeverity.WARNING
                    )
                    if abs(deviation_ms) > self.SIGNIFICANT_DEVIATION_MS:
                        self.timeline_tracker.add_event(
                            event_type="significant_deviation",
                            time=beat.time,
                            measure=measure_num,
                            description=f"显著抢拍: 第 {measure_num} 小节第 {beat.beat_in_measure} 拍，偏差 {deviation_ms:.0f}ms",
                            severity=EventSeverity.ERROR,
                            details={
                                "deviation_ms": deviation_ms,
                                "deviation_type": "lead",
                                "beat_type": beat.beat_type.value,
                            },
                        )
                else:
                    dev_type = DeviationType.ON_TIME
                    severity = EventSeverity.INFO

                deviations.append(
                    BeatDeviation(
                        beat_event=beat,
                        expected_time=expected_time,
                        actual_time=beat.time,
                        deviation_ms=deviation_ms,
                        deviation_type=dev_type,
                        severity=severity,
                    )
                )

            has_lag = any(d.deviation_type == DeviationType.LAG for d in deviations)
            has_lead = any(d.deviation_type == DeviationType.LEAD for d in deviations)
            has_missed = any(d.deviation_type == DeviationType.MISSED for d in deviations)

            valid_deviations = [
                d for d in deviations if d.deviation_type != DeviationType.NOISE
            ]
            if valid_deviations:
                avg_dev = float(
                    np.mean([abs(d.deviation_ms) for d in valid_deviations])
                )
            else:
                avg_dev = 0.0

            problem_summary = self._generate_measure_problem_summary(
                deviations, measure_num
            )

            self.timeline_tracker.add_event(
                event_type="measure_start",
                time=start_time,
                measure=measure_num,
                description=f"第 {measure_num} 小节开始",
                severity=EventSeverity.INFO,
                details={
                    "has_lag": has_lag,
                    "has_lead": has_lead,
                    "has_missed": has_missed,
                    "avg_deviation_ms": avg_dev,
                },
            )

            result.append(
                MeasureAnalysis(
                    measure_number=measure_num,
                    start_time=start_time,
                    end_time=end_time,
                    deviations=deviations,
                    avg_deviation_ms=avg_dev,
                    has_lag=has_lag,
                    has_lead=has_lead,
                    has_missed=has_missed,
                    problem_summary=problem_summary,
                    beats=measure_beats,
                )
            )

        return result

    def _check_consistency(
        self,
        detected_beats: List[BeatEvent],
        reference_beats: List[BeatEvent],
        detected_bpm: float,
        bpm_evidences: List[BPMEvidence],
    ) -> ConsistencyCheck:
        ref_bpm = 60.0 / np.mean(
            np.diff([b.time for b in reference_beats[: min(10, len(reference_beats))]])
        )

        audio_deviations = []
        for i in range(min(len(detected_beats), len(reference_beats))):
            audio_deviations.append(
                (detected_beats[i].time - reference_beats[i].time) * 1000
            )
        audio_avg_dev = float(np.mean(np.abs(audio_deviations))) if audio_deviations else 0

        if audio_avg_dev > self.LAG_THRESHOLD_MS * 2:
            audio_conclusion = "录音整体节拍偏慢"
        elif audio_avg_dev < self.LEAD_THRESHOLD_MS * 2:
            audio_conclusion = "录音整体节拍偏快"
        else:
            audio_conclusion = "录音整体节拍稳定"

        ref_deviations = np.diff([b.time for b in reference_beats])
        ref_interval_std = float(np.std(ref_deviations))
        if ref_interval_std > 0.02:
            reference_conclusion = "参考节拍点本身有波动"
        else:
            reference_conclusion = "参考节拍点稳定"

        bpm_diff = abs(detected_bpm - ref_bpm)
        is_consistent = bpm_diff < 5 and audio_avg_dev < self.SIGNIFICANT_DEVIATION_MS

        if not is_consistent:
            if bpm_diff >= 5:
                resolution_reason = f"检测到的 BPM ({detected_bpm:.1f}) 与参考 BPM ({ref_bpm:.1f}) 相差 {bpm_diff:.1f}，以多源 BPM 分析的加权结果为准"
            else:
                resolution_reason = f"虽然 BPM 接近，但平均偏差 {audio_avg_dev:.0f}ms 超过阈值，需结合段落分析判断"
        else:
            resolution_reason = "录音分析与参考节拍点结论一致"

        bpm_evidences.append(
            BPMEvidence(
                source="reference_beats",
                bpm=ref_bpm,
                confidence=0.95,
                time_range=(reference_beats[0].time, reference_beats[-1].time),
                beat_count=len(reference_beats),
                support_reason="来自参考节拍点文件的基准 BPM",
            )
        )

        return ConsistencyCheck(
            audio_conclusion=audio_conclusion,
            reference_conclusion=reference_conclusion,
            is_consistent=is_consistent,
            bpm_evidences=bpm_evidences,
            resolution_reason=resolution_reason,
        )

    def _generate_measure_problem_summary(
        self, deviations: List[BeatDeviation], measure_num: int
    ) -> str:
        lag_count = sum(1 for d in deviations if d.deviation_type == DeviationType.LAG)
        lead_count = sum(1 for d in deviations if d.deviation_type == DeviationType.LEAD)
        missed_count = sum(1 for d in deviations if d.deviation_type == DeviationType.MISSED)
        noise_count = sum(1 for d in deviations if d.deviation_type == DeviationType.NOISE)

        problems = []
        if lag_count > 0:
            problems.append(f"{lag_count} 拍拖拍")
        if lead_count > 0:
            problems.append(f"{lead_count} 拍抢拍")
        if missed_count > 0:
            problems.append(f"{missed_count} 拍漏拍")
        if noise_count > 0:
            problems.append(f"{noise_count} 处疑似噪声")

        if not problems:
            return f"第 {measure_num} 小节: 节拍准确"
        return f"第 {measure_num} 小节: " + ", ".join(problems)

    def _generate_problem_summary(
        self, measures: List[MeasureAnalysis]
    ) -> List[str]:
        summaries = []
        lag_measures = [m for m in measures if m.has_lag]
        lead_measures = [m for m in measures if m.has_lead]
        missed_measures = [m for m in measures if m.has_missed]

        if lag_measures:
            worst_lag = max(lag_measures, key=lambda m: m.avg_deviation_ms)
            summaries.append(
                f"拖拍最严重的是第 {worst_lag.measure_number} 小节，平均偏差 {worst_lag.avg_deviation_ms:.0f}ms"
            )
        if lead_measures:
            worst_lead = max(lead_measures, key=lambda m: m.avg_deviation_ms)
            summaries.append(
                f"抢拍最严重的是第 {worst_lead.measure_number} 小节，平均偏差 {worst_lead.avg_deviation_ms:.0f}ms"
            )
        if missed_measures:
            summaries.append(
                f"共有 {len(missed_measures)} 个小节存在漏拍问题"
            )

        if len(lag_measures) > 0 and len(lag_measures) >= len(measures) * 0.3:
            summaries.append("整体有拖拍倾向，可能需要加强节奏稳定性练习")
        elif len(lead_measures) > 0 and len(lead_measures) >= len(measures) * 0.3:
            summaries.append("整体有抢拍倾向，可能需要放慢练习速度")

        return summaries

    def _compare_with_previous(
        self,
        previous_file: str,
        current_avg_deviation: float,
        current_lag_measures: List[int],
        current_lead_measures: List[int],
    ) -> ProgressComparison:
        with open(previous_file, "r", encoding="utf-8") as f:
            prev_data = json.load(f)

        prev_avg = prev_data.get("overall_avg_deviation_ms", None)
        if prev_avg is None:
            return ProgressComparison(
                has_previous=False,
                previous_avg_deviation=None,
                current_avg_deviation=current_avg_deviation,
                improvement_percent=0.0,
                problem_measures_reduced=0,
                human_reason="没有找到上次的有效分析数据，无法比较进步情况",
            )

        improvement = ((prev_avg - current_avg_deviation) / prev_avg) * 100 if prev_avg > 0 else 0

        prev_lag = prev_data.get("lag_measures", [])
        prev_lead = prev_data.get("lead_measures", [])
        prev_problem_count = len(prev_lag) + len(prev_lead)
        current_problem_count = len(current_lag_measures) + len(current_lead_measures)
        reduced = prev_problem_count - current_problem_count

        if improvement > 10:
            reason = f"进步明显！平均偏差从 {prev_avg:.0f}ms 降到 {current_avg_deviation:.0f}ms，改善了 {improvement:.0f}%"
        elif improvement > 0:
            reason = f"有进步，平均偏差减少了 {improvement:.1f}%，继续保持"
        elif improvement < -10:
            reason = f"这次表现不如上次，平均偏差增加了 {abs(improvement):.0f}%，建议放慢速度重新练习"
        else:
            reason = f"表现和上次差不多，平均偏差稳定在 {current_avg_deviation:.0f}ms 左右"

        if reduced > 0:
            reason += f"，有问题的小节减少了 {reduced} 个"
        elif reduced < 0:
            reason += f"，但有问题的小节增加了 {abs(reduced)} 个"

        return ProgressComparison(
            has_previous=True,
            previous_avg_deviation=prev_avg,
            current_avg_deviation=current_avg_deviation,
            improvement_percent=improvement,
            problem_measures_reduced=reduced,
            human_reason=reason,
        )

    def _generate_human_summary(
        self,
        measures: List[MeasureAnalysis],
        lag_measures: List[int],
        lead_measures: List[int],
        missed_measures: List[int],
        avg_deviation: float,
        progress: Optional[ProgressComparison],
    ) -> str:
        parts = []

        if avg_deviation < self.LAG_THRESHOLD_MS:
            parts.append(f"整体节拍很稳，平均偏差仅 {avg_deviation:.0f}ms")
        elif avg_deviation < self.SIGNIFICANT_DEVIATION_MS:
            parts.append(f"整体节拍基本稳定，平均偏差 {avg_deviation:.0f}ms")
        else:
            parts.append(f"节拍稳定性需要加强，平均偏差达 {avg_deviation:.0f}ms")

        if lag_measures and len(lag_measures) >= len(measures) * 0.5:
            parts.append("拖拍问题比较普遍")
        elif lag_measures:
            parts.append(f"在第 {self._format_measure_list(lag_measures)} 小节有拖拍")

        if lead_measures and len(lead_measures) >= len(measures) * 0.5:
            parts.append("抢拍问题比较普遍")
        elif lead_measures:
            parts.append(f"在第 {self._format_measure_list(lead_measures)} 小节有抢拍")

        if missed_measures:
            parts.append(f"第 {self._format_measure_list(missed_measures)} 小节有漏拍")

        if progress and progress.has_previous:
            parts.append(progress.human_reason)

        return "；".join(parts) + "。"

    def _format_measure_list(self, measures: List[int]) -> str:
        if not measures:
            return ""
        if len(measures) <= 5:
            return "、".join(str(m) for m in measures)
        else:
            return (
                "、".join(str(m) for m in measures[:5])
                + f" 等 {len(measures)} 个"
            )
