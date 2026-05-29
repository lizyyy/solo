import numpy as np
import soundfile as sf
from typing import List, Optional, Tuple

from .models import PitchFrame, Provenance


MIDI_A4 = 69
FREQ_A4 = 440.0
MIN_FREQ = 60.0
MAX_FREQ = 1500.0
FRAME_SIZE = 2048
HOP_SIZE = 512
MIN_RMS = 0.008
MIN_CONFIDENCE = 0.3


def midi_to_freq(midi: float) -> float:
    return FREQ_A4 * (2.0 ** ((midi - MIDI_A4) / 12.0))


def freq_to_midi(freq: float) -> float:
    if freq <= 0:
        return 0.0
    return MIDI_A4 + 12.0 * np.log2(freq / FREQ_A4)


def freq_to_cents(freq: float, ref_freq: float) -> float:
    if freq <= 0 or ref_freq <= 0:
        return 0.0
    return 1200.0 * np.log2(freq / ref_freq)


def _rms(signal: np.ndarray) -> float:
    return float(np.sqrt(np.mean(signal ** 2)))


def _autocorrelation_pitch(frame: np.ndarray, sample_rate: int) -> Tuple[float, float]:
    n = len(frame)
    frame = frame - np.mean(frame)
    rms_val = _rms(frame)
    if rms_val < MIN_RMS:
        return 0.0, 0.0

    corr = np.correlate(frame, frame, mode="full")
    corr = corr[n - 1:]
    corr = corr / (corr[0] + 1e-10)

    min_lag = max(int(sample_rate / MAX_FREQ), 1)
    max_lag = min(int(sample_rate / MIN_FREQ), n - 1)

    if max_lag <= min_lag:
        return 0.0, 0.0

    search_range = corr[min_lag:max_lag + 1]
    if len(search_range) == 0:
        return 0.0, 0.0

    peak_idx = np.argmax(search_range)
    peak_val = search_range[peak_idx]
    best_lag = peak_idx + min_lag

    if peak_val < MIN_CONFIDENCE:
        return 0.0, float(peak_val)

    frequency = sample_rate / best_lag
    confidence = float(peak_val)
    return frequency, confidence


def detect_pitch(
    audio_path: str,
    frame_size: int = FRAME_SIZE,
    hop_size: int = HOP_SIZE,
) -> Tuple[List[PitchFrame], int, float]:
    data, sample_rate = sf.read(audio_path, dtype="float32")
    if data.ndim > 1:
        data = np.mean(data, axis=1)

    duration = len(data) / sample_rate
    frames: List[PitchFrame] = []
    pos = 0
    while pos + frame_size <= len(data):
        segment = data[pos : pos + frame_size]
        freq, conf = _autocorrelation_pitch(segment, sample_rate)
        time_offset = pos / sample_rate
        midi = freq_to_midi(freq) if freq > 0 else 0.0
        frames.append(PitchFrame(
            time_offset=time_offset,
            frequency=freq,
            midi_note=midi,
            confidence=conf,
        ))
        pos += hop_size

    return frames, sample_rate, duration


def detect_pitch_segment(
    frames: List[PitchFrame],
    start_time: float,
    end_time: float,
) -> List[PitchFrame]:
    return [
        f for f in frames
        if start_time <= f.time_offset < end_time and f.frequency > 0
    ]


def compute_segment_error(
    detected: List[PitchFrame],
    target_freq: float,
) -> List[Tuple[float, float]]:
    errors = []
    for f in detected:
        cents = freq_to_cents(f.frequency, target_freq)
        errors.append((f.time_offset, cents))
    return errors
