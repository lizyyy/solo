from dataclasses import dataclass
from typing import Dict, List, Optional, Set, Tuple, Any
from collections import defaultdict

import numpy as np

from ..models import (
    CalibrationState,
    Speaker,
    MeasurementPoint,
    ImpulseResponse,
    PeakInfo,
    SolverResult,
    SpeakerDelayResult,
    PointOverride,
    OverrideType,
    ClimateData,
)
from ..peak_detection.direct_peak import find_direct_peak, PeakDetectionConfig
from ..geometry.calculations import (
    calculate_distance,
    calculate_speed_of_sound,
    calculate_speed_of_sound_simple,
    calculate_expected_time,
    estimate_speed_of_sound_from_delays,
)


@dataclass
class SolverConfig:
    reference_speaker_id: Optional[str] = None
    speed_of_sound_override: Optional[float] = None
    use_geometric_hint: bool = True
    peak_detection_config: PeakDetectionConfig = None
    phase_risk_threshold_ms: float = 1.0
    phase_risk_warning_ms: float = 0.5
    min_confidence_for_delay: float = 0.3
    outlier_rejection_iqr_factor: float = 1.5

    def __post_init__(self):
        if self.peak_detection_config is None:
            self.peak_detection_config = PeakDetectionConfig()


def get_overrides_for_speaker(
    overrides: List[PointOverride],
    speaker_id: str,
) -> Tuple[Set[str], Set[str], Dict[str, str]]:
    locked_points: Set[str] = set()
    excluded_points: Set[str] = set()
    reasons: Dict[str, str] = {}

    for override in overrides:
        applies = (
            override.speaker_id is None
            or override.speaker_id == speaker_id
        )

        if not applies:
            continue

        if override.override_type == OverrideType.LOCK:
            locked_points.add(override.point_id)
        elif override.override_type == OverrideType.EXCLUDE:
            excluded_points.add(override.point_id)

        if override.reason:
            reasons[override.point_id] = override.reason

    return locked_points, excluded_points, reasons


def detect_all_peaks(
    state: CalibrationState,
    config: SolverConfig,
    expected_times: Optional[Dict[str, Dict[str, float]]] = None,
) -> Dict[str, Dict[str, Tuple[Optional[PeakInfo], List[PeakInfo]]]]:
    results: Dict[str, Dict[str, Tuple[Optional[PeakInfo], List[PeakInfo]]]] = {}

    for spk_id, points_data in state.impulse_responses.items():
        results[spk_id] = {}

        for pt_id, ir in points_data.items():
            expected_time = None
            if expected_times and spk_id in expected_times and pt_id in expected_times[spk_id]:
                expected_time = expected_times[spk_id][pt_id]

            direct_peak, all_peaks = find_direct_peak(
                ir,
                expected_time_sec=expected_time if config.use_geometric_hint else None,
                config=config.peak_detection_config,
            )

            results[spk_id][pt_id] = (direct_peak, all_peaks)

    return results


def build_peak_details(
    peak_results: Dict[str, Dict[str, Tuple[Optional[PeakInfo], List[PeakInfo]]]],
) -> Dict[str, Dict[str, PeakInfo]]:
    details: Dict[str, Dict[str, PeakInfo]] = {}

    for spk_id, points_data in peak_results.items():
        details[spk_id] = {}
        for pt_id, (direct_peak, _) in points_data.items():
            if direct_peak is not None:
                details[spk_id][pt_id] = direct_peak

    return details


def extract_measured_times(
    peak_results: Dict[str, Dict[str, Tuple[Optional[PeakInfo], List[PeakInfo]]]],
    excluded_points: Dict[str, Set[str]],
    min_confidence: float,
) -> Dict[str, Dict[str, float]]:
    measured: Dict[str, Dict[str, float]] = {}

    for spk_id, points_data in peak_results.items():
        measured[spk_id] = {}
        excluded = excluded_points.get(spk_id, set())

        for pt_id, (direct_peak, _) in points_data.items():
            if pt_id in excluded:
                continue

            if direct_peak is None:
                continue

            if direct_peak.confidence < min_confidence:
                continue

            measured[spk_id][pt_id] = direct_peak.time_sec

    return measured


def estimate_sos(
    state: CalibrationState,
    measured_times: Dict[str, Dict[str, float]],
    config: SolverConfig,
) -> Tuple[float, float]:
    if config.speed_of_sound_override is not None:
        return config.speed_of_sound_override, 1.0

    if state.climate_data:
        climate = state.climate_data
        sos_from_climate = calculate_speed_of_sound(
            temperature_c=climate.temperature_c,
            humidity_pct=climate.humidity_pct,
            pressure_kpa=climate.pressure_kpa or 101.325,
        )
    else:
        sos_from_climate = calculate_speed_of_sound_simple(20.0)

    if not state.speakers or not state.points:
        return sos_from_climate, 0.5

    distances: Dict[str, Dict[str, float]] = {}
    for spk_id, speaker in state.speakers.items():
        distances[spk_id] = {}
        for pt_id, point in state.points.items():
            distances[spk_id][pt_id] = calculate_distance(speaker.position, point.position)

    filtered_measured: Dict[str, Dict[str, float]] = {}
    for spk_id in measured_times:
        if spk_id not in distances:
            continue
        filtered_measured[spk_id] = {}
        for pt_id, time in measured_times[spk_id].items():
            if pt_id in distances.get(spk_id, {}):
                filtered_measured[spk_id][pt_id] = time

    if not filtered_measured or not any(filtered_measured.values()):
        return sos_from_climate, 0.3

    sos_estimated, confidence, _ = estimate_speed_of_sound_from_delays(
        distances, filtered_measured
    )

    if sos_estimated < 300 or sos_estimated > 400:
        return sos_from_climate, 0.2

    if confidence > 0.7:
        return sos_estimated, confidence
    else:
        combined_sos = sos_estimated * confidence + sos_from_climate * (1 - confidence)
        return combined_sos, confidence


def select_reference_speaker(
    state: CalibrationState,
    measured_times: Dict[str, Dict[str, float]],
    config: SolverConfig,
) -> str:
    if config.reference_speaker_id is not None:
        if config.reference_speaker_id in measured_times:
            return config.reference_speaker_id

    best_spk_id = None
    best_score = -1

    for spk_id, pt_times in measured_times.items():
        n_measurements = len(pt_times)

        if n_measurements == 0:
            continue

        times = np.array(list(pt_times.values()))
        variance = np.var(times) if len(times) > 1 else 0

        score = n_measurements * 10 - variance * 100

        if score > best_score:
            best_score = score
            best_spk_id = spk_id

    if best_spk_id is None:
        if measured_times:
            return next(iter(measured_times.keys()))
        if state.speakers:
            return next(iter(state.speakers.keys()))
        return "unknown"

    return best_spk_id


def calculate_delays_for_speaker(
    speaker_id: str,
    reference_id: str,
    measured_times: Dict[str, Dict[str, float]],
    locked_points: Set[str],
    excluded_points: Set[str],
    config: SolverConfig,
) -> Tuple[Optional[float], List[str], List[str], List[str], float]:
    if speaker_id not in measured_times:
        return None, [], list(excluded_points), list(locked_points), 0.0

    if reference_id not in measured_times:
        return None, [], list(excluded_points), list(locked_points), 0.0

    spk_times = measured_times[speaker_id]
    ref_times = measured_times[reference_id]

    common_points = set(spk_times.keys()) & set(ref_times.keys())
    usable_points = common_points - excluded_points

    if not usable_points:
        return None, [], list(excluded_points), list(locked_points), 0.0

    deltas: List[Tuple[str, float]] = []
    for pt_id in usable_points:
        delta = spk_times[pt_id] - ref_times[pt_id]
        deltas.append((pt_id, delta))

    if locked_points:
        locked_deltas = [d for pt_id, d in deltas if pt_id in locked_points]
        if locked_deltas:
            avg_delay = float(np.mean(locked_deltas))
            return avg_delay, list(locked_points & usable_points), list(excluded_points), list(locked_points), 1.0

    pt_ids = [p for p, _ in deltas]
    delta_values = np.array([d for _, d in deltas])

    if len(delta_values) >= 3:
        q25, q75 = np.percentile(delta_values, [25, 75])
        iqr = q75 - q25
        lower_bound = q25 - config.outlier_rejection_iqr_factor * iqr
        upper_bound = q75 + config.outlier_rejection_iqr_factor * iqr

        inlier_mask = (delta_values >= lower_bound) & (delta_values <= upper_bound)
        inlier_deltas = delta_values[inlier_mask]
        inlier_points = [pt_ids[i] for i in range(len(pt_ids)) if inlier_mask[i]]
        outlier_points = [pt_ids[i] for i in range(len(pt_ids)) if not inlier_mask[i]]
    else:
        inlier_deltas = delta_values
        inlier_points = pt_ids
        outlier_points = []

    if len(inlier_deltas) == 0:
        return None, [], list(excluded_points) + outlier_points, list(locked_points), 0.0

    avg_delay = float(np.mean(inlier_deltas))

    if len(inlier_deltas) > 1:
        std = float(np.std(inlier_deltas))
        confidence = 1.0 / (1.0 + std * 1000)
    else:
        confidence = 0.5

    return avg_delay, inlier_points, list(excluded_points) + outlier_points, list(locked_points), confidence


def calculate_phase_risk(
    delay_ms: float,
    sample_rate: float = 48000.0,
    threshold_ms: float = 1.0,
    warning_ms: float = 0.5,
) -> Tuple[float, str]:
    abs_delay = abs(delay_ms)

    sample_period_ms = 1000.0 / sample_rate

    risk_score = min(1.0, abs_delay / threshold_ms)

    if abs_delay >= threshold_ms:
        risk_level = "high"
    elif abs_delay >= warning_ms:
        risk_level = "medium"
    else:
        risk_level = "low"

    if abs_delay < sample_period_ms * 0.5:
        risk_score *= 0.3
        risk_level = "low"

    return risk_score, risk_level


def solve_delays(
    state: CalibrationState,
    config: Optional[SolverConfig] = None,
) -> SolverResult:
    if config is None:
        config = SolverConfig()

    excluded_by_speaker: Dict[str, Set[str]] = defaultdict(set)
    locked_by_speaker: Dict[str, Set[str]] = defaultdict(set)

    for spk_id in state.impulse_responses.keys():
        locked, excluded, _ = get_overrides_for_speaker(state.overrides, spk_id)
        locked_by_speaker[spk_id] = locked
        excluded_by_speaker[spk_id] = excluded

    all_speakers = set(state.speakers.keys())
    measured_speakers = set(state.impulse_responses.keys())
    speakers_to_process = all_speakers & measured_speakers

    if not speakers_to_process:
        speakers_to_process = measured_speakers or all_speakers

    expected_times: Optional[Dict[str, Dict[str, float]]] = None
    if config.use_geometric_hint and state.speakers and state.points:
        temp_sos = (
            config.speed_of_sound_override
            if config.speed_of_sound_override is not None
            else 343.0
        )
        expected_times = {}
        for spk_id, speaker in state.speakers.items():
            expected_times[spk_id] = {}
            for pt_id, point in state.points.items():
                dist = calculate_distance(speaker.position, point.position)
                expected_times[spk_id][pt_id] = dist / temp_sos

    peak_results = detect_all_peaks(state, config, expected_times)

    measured_times = extract_measured_times(
        peak_results,
        dict(excluded_by_speaker),
        config.min_confidence_for_delay,
    )

    sos, sos_confidence = estimate_sos(state, measured_times, config)

    reference_id = select_reference_speaker(state, measured_times, config)

    speaker_delays: Dict[str, SpeakerDelayResult] = {}

    sample_rate = 48000.0
    for spk_data in state.impulse_responses.values():
        for ir in spk_data.values():
            sample_rate = ir.sample_rate
            break
        break

    for spk_id in speakers_to_process:
        if spk_id == reference_id:
            ref_delay = 0.0
            phase_risk_score, phase_risk_level = calculate_phase_risk(
                0.0, sample_rate,
                config.phase_risk_threshold_ms,
                config.phase_risk_warning_ms,
            )
            speaker_delays[spk_id] = SpeakerDelayResult(
                speaker_id=spk_id,
                delay_ms=0.0,
                reference_delay_ms=0.0,
                delta_ms=0.0,
                phase_risk_score=phase_risk_score,
                phase_risk_level=phase_risk_level,
                confidence=1.0,
                used_points=list(measured_times.get(spk_id, {}).keys()),
                excluded_points=list(excluded_by_speaker.get(spk_id, set())),
                locked_points=list(locked_by_speaker.get(spk_id, set())),
            )
            continue

        delay_result = calculate_delays_for_speaker(
            spk_id,
            reference_id,
            measured_times,
            locked_by_speaker.get(spk_id, set()),
            excluded_by_speaker.get(spk_id, set()),
            config,
        )

        delay_ms, used, excluded, locked, confidence = delay_result

        if delay_ms is None:
            continue

        ref_delay = 0.0

        phase_risk_score, phase_risk_level = calculate_phase_risk(
            delay_ms, sample_rate,
            config.phase_risk_threshold_ms,
            config.phase_risk_warning_ms,
        )

        speaker_delays[spk_id] = SpeakerDelayResult(
            speaker_id=spk_id,
            delay_ms=delay_ms,
            reference_delay_ms=ref_delay,
            delta_ms=delay_ms - ref_delay,
            phase_risk_score=phase_risk_score,
            phase_risk_level=phase_risk_level,
            confidence=confidence,
            used_points=used,
            excluded_points=excluded,
            locked_points=locked,
        )

    peak_details = build_peak_details(peak_results)

    return SolverResult(
        reference_speaker_id=reference_id,
        estimated_speed_of_sound=sos,
        speed_of_sound_confidence=sos_confidence,
        speaker_delays=speaker_delays,
        peak_details=peak_details,
    )
