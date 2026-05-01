import numpy as np
from scipy.signal import butter, filtfilt
from typing import Optional, Tuple
from dataclasses import dataclass

from .data_loader import WaveformData


@dataclass
class ProcessedWaveform:
    original_data: WaveformData
    processed_data: np.ndarray
    processing_info: dict


def demean(data: np.ndarray) -> np.ndarray:
    return data - np.mean(data)


def _butter_bandpass(
    lowcut: float,
    highcut: float,
    fs: float,
    order: int = 4
) -> Tuple[np.ndarray, np.ndarray]:
    nyquist = 0.5 * fs
    low = lowcut / nyquist
    high = highcut / nyquist
    b, a = butter(order, [low, high], btype="band")
    return b, a


def bandpass_filter(
    data: np.ndarray,
    lowcut: float,
    highcut: float,
    fs: float,
    order: int = 4
) -> np.ndarray:
    if lowcut <= 0 or highcut >= fs / 2:
        raise ValueError(f"Filter frequencies must be within (0, {fs/2})")
    if lowcut >= highcut:
        raise ValueError("lowcut must be less than highcut")

    b, a = _butter_bandpass(lowcut, highcut, fs, order)
    return filtfilt(b, a, data)


def process_waveform(
    waveform: WaveformData,
    lowcut: float = 1.0,
    highcut: float = 20.0,
    order: int = 4,
    remove_mean: bool = True
) -> ProcessedWaveform:
    data = waveform.data.copy()

    processing_info = {
        "remove_mean": remove_mean,
        "bandpass_lowcut": lowcut,
        "bandpass_highcut": highcut,
        "filter_order": order,
        "sampling_rate": waveform.sampling_rate
    }

    if remove_mean:
        data = demean(data)
        processing_info["demeaned"] = True

    data = bandpass_filter(data, lowcut, highcut, waveform.sampling_rate, order)
    processing_info["filtered"] = True

    return ProcessedWaveform(
        original_data=waveform,
        processed_data=data,
        processing_info=processing_info
    )


def calculate_sta_lta(
    data: np.ndarray,
    fs: float,
    sta_length: float = 1.0,
    lta_length: float = 15.0
) -> Tuple[np.ndarray, np.ndarray]:
    n = len(data)
    sta_samples = int(sta_length * fs)
    lta_samples = int(lta_length * fs)

    if sta_samples < 1:
        sta_samples = 1
    if lta_samples < 1:
        lta_samples = 1

    sta = np.zeros(n)
    lta = np.zeros(n)

    abs_data = np.abs(data)

    sta_sum = np.sum(abs_data[:sta_samples])
    sta[:sta_samples] = sta_sum / sta_samples

    for i in range(sta_samples, n):
        sta_sum = sta_sum - abs_data[i - sta_samples] + abs_data[i]
        sta[i] = sta_sum / sta_samples

    lta_sum = np.sum(abs_data[:lta_samples])
    lta[:lta_samples] = lta_sum / lta_samples

    for i in range(lta_samples, n):
        lta_sum = lta_sum - abs_data[i - lta_samples] + abs_data[i]
        lta[i] = lta_sum / lta_samples

    lta[lta == 0] = 1e-10

    return sta, lta
