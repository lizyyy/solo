import os
from typing import Dict, List, Optional, Tuple

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import numpy as np

from .models import PitchFrame, RhythmSegment, TargetPitch
from .pitch_detector import freq_to_cents, midi_to_freq


_CJK_FONTS = [
    "PingFang SC", "Heiti SC", "STHeiti", "SimHei",
    "WenQuanYi Micro Hei", "Noto Sans CJK SC", "Microsoft YaHei",
]

_plt_font_configured = False


def _configure_fonts():
    global _plt_font_configured
    if _plt_font_configured:
        return
    available = {f.name for f in fm.fontManager.ttflist}
    for font in _CJK_FONTS:
        if font in available:
            plt.rcParams["font.sans-serif"] = [font, "DejaVu Sans"]
            plt.rcParams["axes.unicode_minus"] = False
            break
    _plt_font_configured = True


ACCURATE_CENTS = 50
TOLERANT_CENTS = 100


def compute_segment_scores(
    pitch_frames: List[PitchFrame],
    targets: List[TargetPitch],
    segments: List[RhythmSegment],
    bpm: float,
) -> Tuple[List[Dict], Dict[str, float]]:
    beat_duration = 60.0 / bpm if bpm > 0 else 0.5
    segment_scores = []
    all_cents_errors = []

    for target, seg in zip(targets, segments):
        start_time = seg.beat_start * beat_duration
        end_time = seg.beat_end * beat_duration

        seg_frames = [
            f for f in pitch_frames
            if start_time <= f.time_offset < end_time and f.frequency > 0
        ]

        if not seg_frames:
            segment_scores.append({
                "label": target.label,
                "target_midi": target.midi_note,
                "target_freq": round(target.frequency, 2),
                "avg_cents_error": 0.0,
                "max_cents_error": 0.0,
                "direction": "无数据",
                "detected_count": 0,
                "accuracy": "unknown",
            })
            continue

        cents_errors = [
            freq_to_cents(f.frequency, target.frequency)
            for f in seg_frames
        ]
        abs_errors = [abs(c) for c in cents_errors]
        avg_cents = float(np.mean(cents_errors))
        max_cents = float(max(abs_errors))
        all_cents_errors.extend(cents_errors)

        if avg_cents > 20:
            direction = "偏高"
        elif avg_cents < -20:
            direction = "偏低"
        else:
            direction = "准确"

        avg_abs = float(np.mean(abs_errors))
        if avg_abs <= ACCURATE_CENTS:
            accuracy = "accurate"
        elif avg_abs <= TOLERANT_CENTS:
            accuracy = "tolerant"
        else:
            accuracy = "off"

        segment_scores.append({
            "label": target.label,
            "target_midi": target.midi_note,
            "target_freq": round(target.frequency, 2),
            "avg_cents_error": round(avg_cents, 1),
            "max_cents_error": round(max_cents, 1),
            "direction": direction,
            "detected_count": len(seg_frames),
            "accuracy": accuracy,
        })

    error_stats = {}
    if all_cents_errors:
        abs_all = [abs(c) for c in all_cents_errors]
        error_stats = {
            "mean_cents": round(float(np.mean(all_cents_errors)), 2),
            "mean_abs_cents": round(float(np.mean(abs_all)), 2),
            "max_abs_cents": round(float(max(abs_all)), 2),
            "std_cents": round(float(np.std(all_cents_errors)), 2),
        }

    return segment_scores, error_stats


def compute_overall_score(error_stats: Dict[str, float]) -> float:
    if not error_stats:
        return 0.0
    mean_abs = error_stats.get("mean_abs_cents", 100)
    if mean_abs <= ACCURATE_CENTS:
        score = 100 - mean_abs
    elif mean_abs <= TOLERANT_CENTS:
        score = 50 - (mean_abs - ACCURATE_CENTS) * 0.5
    else:
        score = max(0, 25 - (mean_abs - TOLERANT_CENTS) * 0.1)
    return max(0.0, min(100.0, score))


def plot_error_curve(
    pitch_frames: List[PitchFrame],
    targets: List[TargetPitch],
    segments: List[RhythmSegment],
    bpm: float,
    output_path: str,
) -> str:
    _configure_fonts()
    beat_duration = 60.0 / bpm if bpm > 0 else 0.5

    fig, ax = plt.subplots(figsize=(12, 5))

    all_times = []
    all_cents = []
    for target, seg in zip(targets, segments):
        start_time = seg.beat_start * beat_duration
        end_time = seg.beat_end * beat_duration

        seg_frames = [
            f for f in pitch_frames
            if start_time <= f.time_offset < end_time and f.frequency > 0
        ]

        for f in seg_frames:
            cents = freq_to_cents(f.frequency, target.frequency)
            all_times.append(f.time_offset)
            all_cents.append(cents)

    if all_times:
        ax.plot(all_times, all_cents, "b-", linewidth=1.5, alpha=0.8, label="音准偏差")

    ax.axhline(y=0, color="green", linewidth=1, linestyle="-", alpha=0.5, label="标准音高")
    ax.axhspan(-ACCURATE_CENTS, ACCURATE_CENTS, alpha=0.1, color="green", label="准确区间")
    ax.axhspan(-TOLERANT_CENTS, TOLERANT_CENTS, alpha=0.05, color="yellow")
    ax.axhline(y=ACCURATE_CENTS, color="orange", linewidth=0.8, linestyle="--", alpha=0.5)
    ax.axhline(y=-ACCURATE_CENTS, color="orange", linewidth=0.8, linestyle="--", alpha=0.5)
    ax.axhline(y=TOLERANT_CENTS, color="red", linewidth=0.8, linestyle="--", alpha=0.5)
    ax.axhline(y=-TOLERANT_CENTS, color="red", linewidth=0.8, linestyle="--", alpha=0.5)

    for target, seg in zip(targets, segments):
        start_time = seg.beat_start * beat_duration
        end_time = seg.beat_end * beat_duration
        mid_time = (start_time + end_time) / 2
        ax.axvline(x=start_time, color="gray", linewidth=0.5, linestyle=":", alpha=0.5)
        ax.text(mid_time, ax.get_ylim()[1] * 0.9 if ax.get_ylim()[1] > 0 else 150,
                target.label, ha="center", fontsize=9, alpha=0.7)

    ax.set_xlabel("时间 (秒)")
    ax.set_ylabel("音准偏差 (音分)")
    ax.set_title("音准练习偏差曲线")
    ax.legend(loc="upper right", fontsize=8)
    ax.grid(True, alpha=0.3)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    fig.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return output_path
