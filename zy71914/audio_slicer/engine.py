"""计算引擎核心 - 切片计算、时间轴对齐、静音段检测"""

from typing import List, Tuple, Optional, Dict, Any
from dataclasses import dataclass
import math

from .models import (
    AdSpot, RawAudioTrack, AudioSlice, SilenceIssue,
    generate_id
)


@dataclass
class AlignmentResult:
    """时间轴对齐结果"""
    aligned: bool
    drift_seconds: float
    drift_source: str
    confidence: float
    details: str


class SliceCalculator:
    """切片计算器"""

    @staticmethod
    def time_overlap(a_start: float, a_end: float, b_start: float, b_end: float) -> float:
        """计算两个时间段的重叠秒数"""
        overlap_start = max(a_start, b_start)
        overlap_end = min(a_end, b_end)
        return max(0.0, overlap_end - overlap_start)

    @staticmethod
    def has_overlap(a_start: float, a_end: float, b_start: float, b_end: float, threshold: float = 0.1) -> bool:
        """判断两个时间段是否有重叠（超过阈值）"""
        return SliceCalculator.time_overlap(a_start, a_end, b_start, b_end) > threshold

    @staticmethod
    def format_time(seconds: float) -> str:
        """格式化时间为 mm:ss.sss"""
        if seconds < 0:
            return f"-{SliceCalculator.format_time(-seconds)}"
        minutes = int(seconds // 60)
        secs = seconds % 60
        return f"{minutes:02d}:{secs:06.3f}"

    @staticmethod
    def parse_time(time_str: str) -> float:
        """解析 mm:ss.sss 格式为秒数"""
        try:
            time_str = time_str.strip()
            if time_str.startswith("-"):
                return -SliceCalculator.parse_time(time_str[1:])
            parts = time_str.split(":")
            if len(parts) == 2:
                minutes = float(parts[0])
                secs = float(parts[1])
                return minutes * 60 + secs
            elif len(parts) == 3:
                hours = float(parts[0])
                minutes = float(parts[1])
                secs = float(parts[2])
                return hours * 3600 + minutes * 60 + secs
            else:
                return float(time_str)
        except Exception:
            return 0.0


class TimeAxisAligner:
    """时间轴对齐器 - 检测并修正时间轴漂移"""

    def __init__(self, tolerance_seconds: float = 0.5):
        self.tolerance = tolerance_seconds

    def align_ad_to_track(
        self, ad: AdSpot, tracks: List[RawAudioTrack]
    ) -> AlignmentResult:
        """将广告口播时间与原始音轨对齐"""
        best_match = None
        best_overlap = 0.0
        best_drift = 0.0

        for track in tracks:
            if track.is_silence:
                continue

            overlap = SliceCalculator.time_overlap(
                ad.start_time, ad.end_time,
                track.start_time, track.end_time
            )

            if overlap > best_overlap:
                best_overlap = overlap
                best_match = track
                track_center = (track.start_time + track.end_time) / 2
                ad_center = (ad.start_time + ad.end_time) / 2
                best_drift = ad_center - track_center

        if best_match is None or best_overlap < 0.1:
            return AlignmentResult(
                aligned=False,
                drift_seconds=0.0,
                drift_source="no_match",
                confidence=0.0,
                details=f"广告口播[{ad.name}]未找到匹配的音轨片段"
            )

        if abs(best_drift) <= self.tolerance:
            return AlignmentResult(
                aligned=True,
                drift_seconds=round(best_drift, 3),
                drift_source="normal",
                confidence=min(1.0, best_overlap / ad.duration) if ad.duration > 0 else 0.8,
                details=f"广告口播[{ad.name}]与音轨[{best_match.name}]对齐成功，漂移{best_drift:.3f}秒"
            )
        else:
            return AlignmentResult(
                aligned=False,
                drift_seconds=round(best_drift, 3),
                drift_source="drift_detected",
                confidence=min(1.0, best_overlap / ad.duration) if ad.duration > 0 else 0.5,
                details=f"广告口播[{ad.name}]检测到时间轴漂移{best_drift:.3f}秒，"
                        f"广告时间{SliceCalculator.format_time(ad.start_time)}-{SliceCalculator.format_time(ad.end_time)}，"
                        f"匹配音轨时间{SliceCalculator.format_time(best_match.start_time)}-{SliceCalculator.format_time(best_match.end_time)}"
            )

    def calculate_drift_correction(
        self, ads: List[AdSpot], tracks: List[RawAudioTrack]
    ) -> float:
        """计算整体漂移修正值（取多个匹配点的中位数）"""
        drifts = []
        for ad in ads:
            result = self.align_ad_to_track(ad, tracks)
            if result.aligned or result.drift_source == "drift_detected":
                drifts.append(result.drift_seconds)

        if not drifts:
            return 0.0

        drifts.sort()
        return round(drifts[len(drifts) // 2], 3)


class SilenceDetector:
    """静音段检测器 - 检测并溯源静音段"""

    def __init__(self, min_silence_duration: float = 1.0, max_silence_gap: float = 0.3):
        self.min_silence_duration = min_silence_duration
        self.max_silence_gap = max_silence_gap

    def detect_silence_in_tracks(
        self, tracks: List[RawAudioTrack], context_slices: Optional[List[AudioSlice]] = None
    ) -> List[SilenceIssue]:
        """从原始音轨中检测静音段"""
        issues = []
        silence_segments = [t for t in tracks if t.is_silence and t.duration >= self.min_silence_duration]

        for seg in silence_segments:
            issue = SilenceIssue(
                slice_id="",
                start_time=seg.start_time,
                end_time=seg.end_time,
                duration=seg.duration,
                source_type="raw_track",
                source_id=seg.id,
                source_ref=f"原始音轨[{seg.name}]",
                detected_from="原始音轨静音标记",
                action_suggested="请联系内容审核员确认此静音段是否为误删或需要保留",
                contact_person="内容审核组",
                status="open",
                notes=f"静音段时长{seg.duration:.2f}秒，静音置信度{seg.silence_confidence:.2f}"
            )

            if context_slices:
                for s in context_slices:
                    if SliceCalculator.has_overlap(
                        s.start_time, s.end_time, seg.start_time, seg.end_time, 0.01
                    ):
                        issue.slice_id = s.id
                        issue.notes += f"，与切片[{s.name}]时间重叠"
                        break

            issues.append(issue)

        return issues

    def detect_silence_in_gaps(
        self, slices: List[AudioSlice], ad_spots: List[AdSpot], tracks: List[RawAudioTrack]
    ) -> List[SilenceIssue]:
        """检测切片之间的间隙中可能被误删的静音段"""
        issues = []
        if len(slices) < 2:
            return issues

        sorted_slices = sorted(slices, key=lambda s: s.start_time)

        for i in range(len(sorted_slices) - 1):
            current = sorted_slices[i]
            next_slice = sorted_slices[i + 1]
            gap_start = current.end_time
            gap_end = next_slice.start_time
            gap_duration = gap_end - gap_start

            if gap_duration >= self.min_silence_duration:
                source_type = "unknown"
                source_id = ""
                source_ref = ""
                detected_from = "切片间隙检测"

                for ad in ad_spots:
                    if SliceCalculator.has_overlap(ad.start_time, ad.end_time, gap_start, gap_end, 0.1):
                        source_type = "ad_spot"
                        source_id = ad.id
                        source_ref = f"广告口播表[{ad.name}]"
                        detected_from = "广告口播表匹配"
                        break

                if source_type == "unknown":
                    for track in tracks:
                        if SliceCalculator.has_overlap(track.start_time, track.end_time, gap_start, gap_end, 0.1):
                            if track.is_silence:
                                source_type = "raw_track"
                                source_id = track.id
                                source_ref = f"原始音轨[{track.name}]"
                                detected_from = "原始音轨匹配"
                                break

                if source_type == "unknown":
                    source_ref = "未找到明确来源"

                issue = SilenceIssue(
                    slice_id="",
                    start_time=gap_start,
                    end_time=gap_end,
                    duration=round(gap_duration, 3),
                    source_type=source_type,
                    source_id=source_id,
                    source_ref=source_ref,
                    detected_from=detected_from,
                    action_suggested=self._get_suggested_action(source_type),
                    contact_person=self._get_contact_person(source_type),
                    status="open",
                    notes=f"切片[{current.name}]与[{next_slice.name}]之间发现{gap_duration:.2f}秒间隙，"
                          f"可能存在静音段误删"
                )
                issues.append(issue)

        return issues

    def _get_suggested_action(self, source_type: str) -> str:
        if source_type == "ad_spot":
            return "此静音段关联广告口播，建议联系广告运营确认是否需要补回或调整切片"
        elif source_type == "raw_track":
            return "此静音段来自原始音轨，建议联系音频剪辑师确认是否为有意删除"
        else:
            return "来源不明确，建议同时联系广告运营和音频剪辑师共同确认"

    def _get_contact_person(self, source_type: str) -> str:
        if source_type == "ad_spot":
            return "广告运营组"
        elif source_type == "raw_track":
            return "音频剪辑组"
        else:
            return "广告运营组 + 音频剪辑组"


class AudioSlicingEngine:
    """音频切片主引擎"""

    def __init__(self):
        self.aligner = TimeAxisAligner()
        self.silence_detector = SilenceDetector()
        self.calculator = SliceCalculator()

    def create_slices_from_ads(
        self, ads: List[AdSpot], apply_drift_correction: bool = True
    ) -> Tuple[List[AudioSlice], List[str], float]:
        """从广告口播表创建切片"""
        slices = []
        warnings = []

        drift_correction = 0.0
        if apply_drift_correction and ads:
            drift_correction = self.aligner.calculate_drift_correction(ads, [])
            if abs(drift_correction) > 0:
                warnings.append(
                    f"检测到整体时间轴漂移{drift_correction:.3f}秒，已自动应用修正"
                )

        for idx, ad in enumerate(ads):
            adjusted_start = round(ad.start_time - drift_correction, 3)
            adjusted_end = round(ad.end_time - drift_correction, 3)

            slice_obj = AudioSlice(
                name=f"切片_{idx + 1:03d}_{ad.name}",
                start_time=adjusted_start,
                end_time=adjusted_end,
                duration=round(adjusted_end - adjusted_start, 3),
                content=ad.content,
                slice_type="ad" if "广告" in ad.name or "口播" in ad.name else "content",
                status="pending",
                source_type="ad_spot",
                source_id=ad.id,
                source_ref=f"广告口播表[{ad.name}]",
                warnings=[],
                subtitle_draft=ad.content,
                subtitle_final="",
                export_filename=f"slice_{idx + 1:03d}_{ad.id}.mp3",
                notes=f"来源：广告口播表，原始时间{SliceCalculator.format_time(ad.start_time)}-{SliceCalculator.format_time(ad.end_time)}"
            )

            if abs(drift_correction) > self.aligner.tolerance:
                slice_obj.warnings.append(
                    f"时间轴已修正{drift_correction:.3f}秒，修正后时间{SliceCalculator.format_time(adjusted_start)}-{SliceCalculator.format_time(adjusted_end)}"
                )

            slices.append(slice_obj)

        return slices, warnings, drift_correction

    def create_slices_from_tracks(
        self, tracks: List[RawAudioTrack], exclude_silence: bool = True
    ) -> List[AudioSlice]:
        """从原始音轨创建切片"""
        slices = []
        track_idx = 0

        for track in tracks:
            if exclude_silence and track.is_silence:
                continue

            track_idx += 1
            slice_obj = AudioSlice(
                name=f"切片_{track_idx:03d}_{track.name}",
                start_time=track.start_time,
                end_time=track.end_time,
                duration=track.duration,
                content=track.content or track.transcript,
                slice_type="silence" if track.is_silence else "content",
                status="pending",
                source_type="raw_track",
                source_id=track.id,
                source_ref=f"原始音轨[{track.name}]",
                warnings=[],
                subtitle_draft=track.transcript,
                subtitle_final="",
                export_filename=f"slice_{track_idx:03d}_{track.id}.mp3",
                notes=f"来源：原始音轨"
            )

            if track.is_silence:
                slice_obj.warnings.append(
                    f"此为静音段，时长{track.duration:.2f}秒，置信度{track.silence_confidence:.2f}"
                )
                slice_obj.issues.append("静音段需人工确认是否保留")

            slices.append(slice_obj)

        return slices

    def merge_slices(
        self, ad_slices: List[AudioSlice], track_slices: List[AudioSlice]
    ) -> Tuple[List[AudioSlice], List[str]]:
        """合并来自广告口播和原始音轨的切片，去重并标记来源"""
        merged = []
        warnings = []
        all_slices = ad_slices + track_slices

        all_slices.sort(key=lambda s: s.start_time)

        i = 0
        while i < len(all_slices):
            current = all_slices[i]
            j = i + 1

            while j < len(all_slices):
                next_slice = all_slices[j]
                overlap = SliceCalculator.time_overlap(
                    current.start_time, current.end_time,
                    next_slice.start_time, next_slice.end_time
                )

                if overlap > 0.5:
                    if current.source_type == "ad_spot" and next_slice.source_type == "raw_track":
                        current.source_ref = f"广告口播表 + 原始音轨（双源匹配）"
                        current.warnings.append(
                            f"与{next_slice.source_ref}重叠{overlap:.2f}秒，已合并来源信息"
                        )
                        if next_slice.subtitle_draft and not current.subtitle_draft:
                            current.subtitle_draft = next_slice.subtitle_draft
                    elif current.source_type == "raw_track" and next_slice.source_type == "ad_spot":
                        next_slice.source_ref = f"广告口播表 + 原始音轨（双源匹配）"
                        next_slice.warnings.append(
                            f"与{current.source_ref}重叠{overlap:.2f}秒，已合并来源信息"
                        )
                        current = next_slice
                    j += 1
                else:
                    break

            merged.append(current)
            i = j

        merged.sort(key=lambda s: s.start_time)
        for idx, s in enumerate(merged):
            old_name = s.name
            s.name = f"切片_{idx + 1:03d}_" + s.name.split("_", 2)[-1] if "_" in s.name else f"切片_{idx + 1:03d}_{s.name}"
            s.export_filename = f"slice_{idx + 1:03d}_{s.id}.mp3"

        return merged, warnings

    def detect_all_silence_issues(
        self, slices: List[AudioSlice], ads: List[AdSpot], tracks: List[RawAudioTrack]
    ) -> List[SilenceIssue]:
        """检测所有静音段问题"""
        issues = []
        issues.extend(self.silence_detector.detect_silence_in_tracks(tracks, slices))
        issues.extend(self.silence_detector.detect_silence_in_gaps(slices, ads, tracks))
        return issues
