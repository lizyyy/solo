from dataclasses import dataclass
from typing import List, Optional, Tuple
import numpy as np

from ..models import ImpulseResponse, PeakInfo


@dataclass
class PeakDetectionConfig:
    min_peak_height_ratio: float = 0.05
    min_peak_distance_samples: int = 10
    prominence_threshold: float = 0.1
    max_peaks: int = 20
    direct_peak_search_window_ms: float = 50.0
    noise_floor_quantile: float = 0.05


def detect_peaks(
    amplitude: np.ndarray,
    sample_rate: float,
    config: Optional[PeakDetectionConfig] = None,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    if config is None:
        config = PeakDetectionConfig()

    amplitude = np.asarray(amplitude)
    if len(amplitude) < 3:
        return np.array([]), np.array([]), np.array([])

    abs_amp = np.abs(amplitude)
    noise_floor = np.quantile(abs_amp, config.noise_floor_quantile)
    max_amp = np.max(abs_amp)

    min_height = max(
        noise_floor * 3,
        max_amp * config.min_peak_height_ratio
    )

    peaks = _find_local_peaks(
        abs_amp,
        min_distance=config.min_peak_distance_samples,
        min_height=min_height,
    )

    if len(peaks) == 0:
        return np.array([]), np.array([]), np.array([])

    prominences = _calculate_prominence(abs_amp, peaks)

    valid_mask = prominences >= config.prominence_threshold * max_amp
    peaks = peaks[valid_mask]
    prominences = prominences[valid_mask]

    if len(peaks) > config.max_peaks:
        sorted_indices = np.argsort(prominences)[::-1][:config.max_peaks]
        peaks = peaks[sorted_indices]
        prominences = prominences[sorted_indices]

    sort_idx = np.argsort(peaks)
    peaks = peaks[sort_idx]
    prominences = prominences[sort_idx]

    heights = abs_amp[peaks]

    return peaks, heights, prominences


def _find_local_peaks(
    signal: np.ndarray,
    min_distance: int = 1,
    min_height: float = 0.0,
) -> np.ndarray:
    signal = np.asarray(signal)
    n = len(signal)

    if n < 3:
        return np.array([])

    dx = np.diff(signal)

    peaks = np.where((np.hstack([dx, 0]) < 0) & (np.hstack([0, dx]) >= 0))[0]

    if peaks.size == 0:
        return np.array([])

    peaks = peaks[signal[peaks] >= min_height]

    if peaks.size == 0:
        return np.array([])

    if min_distance > 1:
        heights = signal[peaks]
        peaks_to_remove = np.zeros_like(peaks, dtype=bool)

        for i in range(len(peaks)):
            if peaks_to_remove[i]:
                continue

            for j in range(i + 1, len(peaks)):
                if peaks[j] - peaks[i] < min_distance:
                    if heights[j] < heights[i]:
                        peaks_to_remove[j] = True
                    else:
                        peaks_to_remove[i] = True
                        break
                else:
                    break

        peaks = peaks[~peaks_to_remove]

    return peaks


def _calculate_prominence(
    signal: np.ndarray,
    peaks: np.ndarray,
) -> np.ndarray:
    prominences = np.zeros_like(peaks, dtype=float)
    n = len(signal)

    for i, peak in enumerate(peaks):
        peak_height = signal[peak]

        left_min = peak_height
        for j in range(peak - 1, -1, -1):
            if signal[j] < left_min:
                left_min = signal[j]
            if signal[j] >= peak_height:
                break

        right_min = peak_height
        for j in range(peak + 1, n):
            if signal[j] < right_min:
                right_min = signal[j]
            if signal[j] >= peak_height:
                break

        higher_saddle = max(left_min, right_min)
        prominences[i] = peak_height - higher_saddle

    return prominences


def find_direct_peak(
    ir: ImpulseResponse,
    expected_time_sec: Optional[float] = None,
    config: Optional[PeakDetectionConfig] = None,
) -> Tuple[Optional[PeakInfo], List[PeakInfo]]:
    if config is None:
        config = PeakDetectionConfig()

    amplitude = np.array(ir.amplitude)
    time_samples = np.array(ir.time_samples)

    if len(amplitude) == 0:
        return None, []

    peaks, heights, prominences = detect_peaks(
        amplitude, ir.sample_rate, config
    )

    if len(peaks) == 0:
        max_idx = np.argmax(np.abs(amplitude))
        peak_info = PeakInfo(
            sample_index=int(max_idx),
            time_sec=time_samples[max_idx],
            amplitude=float(amplitude[max_idx]),
            is_direct=True,
            confidence=0.5,
        )
        return peak_info, [peak_info]

    all_peaks: List[PeakInfo] = []
    for idx, peak_sample in enumerate(peaks):
        peak_info = PeakInfo(
            sample_index=int(peak_sample),
            time_sec=float(time_samples[peak_sample]),
            amplitude=float(heights[idx]),
            is_direct=False,
            confidence=0.0,
        )
        all_peaks.append(peak_info)

    max_amp = np.max(np.abs(amplitude))

    candidate_scores = []
    search_window_start = 0.0
    search_window_end = None

    if expected_time_sec is not None:
        search_window_sec = config.direct_peak_search_window_ms / 1000.0
        search_window_start = max(0.0, expected_time_sec - search_window_sec / 2)
        search_window_end = expected_time_sec + search_window_sec / 2

    for i, peak in enumerate(all_peaks):
        score = 0.0

        time_score = 1.0 - (peak.time_sec / max(0.1, time_samples[-1]))
        score += time_score * 0.3

        amp_score = peak.amplitude / max_amp
        score += amp_score * 0.4

        prominence_score = prominences[i] / max(prominences.max(), 1e-6)
        score += prominence_score * 0.3

        if expected_time_sec is not None:
            time_diff = abs(peak.time_sec - expected_time_sec)
            expected_match_score = 1.0 / (1.0 + time_diff * 100)
            score += expected_match_score * 0.5

            if search_window_start <= peak.time_sec <= (search_window_end or float('inf')):
                score += 0.3

        candidate_scores.append((i, score))

    if not candidate_scores:
        return all_peaks[0], all_peaks

    candidate_scores.sort(key=lambda x: x[1], reverse=True)
    best_idx, best_score = candidate_scores[0]

    direct_peak = all_peaks[best_idx]
    direct_peak.is_direct = True
    direct_peak.confidence = min(1.0, best_score / 1.6)

    return direct_peak, all_peaks


def find_direct_peak_simple(
    ir: ImpulseResponse,
    method: str = "first_significant",
    threshold_ratio: float = 0.1,
) -> Tuple[int, float]:
    amplitude = np.array(ir.amplitude)
    time_samples = np.array(ir.time_samples)
    abs_amp = np.abs(amplitude)

    max_amp = abs_amp.max()
    threshold = max_amp * threshold_ratio

    if method == "first_significant":
        above_threshold = np.where(abs_amp >= threshold)[0]
        if len(above_threshold) > 0:
            start_idx = max(0, above_threshold[0] - 5)
            end_idx = min(len(abs_amp), above_threshold[0] + 20)
            local_region = abs_amp[start_idx:end_idx]
            local_max_idx = np.argmax(local_region)
            peak_idx = start_idx + local_max_idx
            return int(peak_idx), float(time_samples[peak_idx])

    elif method == "earliest_max":
        max_indices = np.where(abs_amp == max_amp)[0]
        peak_idx = max_indices[0]
        return int(peak_idx), float(time_samples[peak_idx])

    peak_idx = np.argmax(abs_amp)
    return int(peak_idx), float(time_samples[peak_idx])
