"""
Rules module - thresholds and rule definitions.
"""
from dataclasses import dataclass


@dataclass
class Thresholds:
    low_bitrate_kbps: int = 256
    frame_drop_gap_sec: float = 2.0
    overlap_tolerance_sec: float = 0.5
    min_clip_duration_sec: float = 1.0


@dataclass
class RuleSet:
    thresholds: Thresholds
    check_clock_rewind: bool = True
    check_low_bitrate: bool = True
    check_gaps: bool = True
    check_overlaps: bool = True
    check_dropped_frames: bool = True


def default_rules() -> RuleSet:
    return RuleSet(
        thresholds=Thresholds(),
        check_clock_rewind=True,
        check_low_bitrate=True,
        check_gaps=True,
        check_overlaps=True,
        check_dropped_frames=True,
    )


def load_rules_from_dict(data: dict) -> RuleSet:
    t = data.get("thresholds", {})
    thresholds = Thresholds(
        low_bitrate_kbps=t.get("low_bitrate_kbps", 256),
        frame_drop_gap_sec=t.get("frame_drop_gap_sec", 2.0),
        overlap_tolerance_sec=t.get("overlap_tolerance_sec", 0.5),
        min_clip_duration_sec=t.get("min_clip_duration_sec", 1.0),
    )
    return RuleSet(
        thresholds=thresholds,
        check_clock_rewind=data.get("check_clock_rewind", True),
        check_low_bitrate=data.get("check_low_bitrate", True),
        check_gaps=data.get("check_gaps", True),
        check_overlaps=data.get("check_overlaps", True),
        check_dropped_frames=data.get("check_dropped_frames", True),
    )
