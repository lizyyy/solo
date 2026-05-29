from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass


@dataclass
class EdgeCaseResult:
    category: str
    severity: str
    message: str
    suggestion: str
    details: Dict[str, Any]

    def to_dict(self) -> Dict[str, str]:
        return {
            "category": self.category,
            "severity": self.severity,
            "message": self.message,
            "suggestion": self.suggestion,
        }


NOISE_RMS_THRESHOLD = 0.015
NOISE_SPECTRAL_FLATNESS_THRESHOLD = 0.6
SHORT_RECORDING_SECONDS = 1.5
OCTAVE_CENTS_THRESHOLD = 600


def check_environmental_noise(
    rms: float,
    pitch_frames_count: int,
    total_frames: int,
) -> Optional[EdgeCaseResult]:
    if pitch_frames_count == 0 and total_frames > 0:
        return EdgeCaseResult(
            category="environmental_noise",
            severity="critical",
            message="未检测到有效音高，可能环境噪声过大或未唱歌",
            suggestion="请在安静环境中录音，确保麦克风正常工作，距离麦克风10-30厘米",
            details={"rms": rms, "detected_ratio": 0.0},
        )
    ratio = pitch_frames_count / total_frames if total_frames > 0 else 0
    if ratio < 0.3:
        return EdgeCaseResult(
            category="environmental_noise",
            severity="warning",
            message=f"有效音高帧占比仅{ratio:.0%}，环境可能存在干扰",
            suggestion="建议在更安静的环境中重新录音，减少背景音乐或人声干扰",
            details={"rms": rms, "detected_ratio": round(ratio, 3)},
        )
    return None


def check_octave_misjudgment(
    segment_errors: List[Tuple[str, float, float]],
) -> Optional[EdgeCaseResult]:
    for label, avg_cents, _ in segment_errors:
        if abs(avg_cents) > OCTAVE_CENTS_THRESHOLD:
            direction = "偏高" if avg_cents > 0 else "偏低"
            return EdgeCaseResult(
                category="octave_misjudgment",
                severity="warning",
                message=f"段落 '{label}' 平均偏差{direction}{abs(avg_cents):.0f}音分，可能存在八度误判",
                suggestion="请确认目标音高是否正确，或引导学生注意音区（高八度/低八度）",
                details={"segment": label, "avg_cents": round(avg_cents, 1)},
            )
    return None


def check_recording_too_short(
    duration: float,
    expected_duration: Optional[float] = None,
) -> Optional[EdgeCaseResult]:
    if duration < SHORT_RECORDING_SECONDS:
        return EdgeCaseResult(
            category="recording_too_short",
            severity="critical",
            message=f"录音时长仅{duration:.1f}秒，过短无法有效分析",
            suggestion="请确保完整唱完练习内容，录音时长至少2秒以上",
            details={"duration": round(duration, 2)},
        )
    if expected_duration and duration < expected_duration * 0.5:
        return EdgeCaseResult(
            category="recording_too_short",
            severity="warning",
            message=f"录音时长{duration:.1f}秒，明显短于预期{expected_duration:.1f}秒",
            suggestion="可能未唱完整个练习，建议重新完整录制",
            details={
                "duration": round(duration, 2),
                "expected_duration": round(expected_duration, 2),
            },
        )
    return None
