import numpy as np
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from datetime import datetime

from .data_loader import Event, WaveformData
from .signal_processing import calculate_sta_lta


@dataclass
class ArrivalPick:
    phase: str
    time: float
    snr: float
    sta: float
    lta: float
    channel: str


@dataclass
class ArrivalComparison:
    phase: str
    pick_time: Optional[float]
    catalog_time: Optional[float]
    time_diff: Optional[float]
    is_anomaly: bool
    anomaly_reason: Optional[str]


class STA_LTA_Picker:
    def __init__(
        self,
        sta_length: float = 1.0,
        lta_length: float = 15.0,
        threshold_on: float = 3.0,
        threshold_off: float = 1.5,
        min_sta_duration: float = 0.5,
        event_window_start: float = -5.0,
        event_window_end: float = 30.0
    ):
        self.sta_length = sta_length
        self.lta_length = lta_length
        self.threshold_on = threshold_on
        self.threshold_off = threshold_off
        self.min_sta_duration = min_sta_duration
        self.event_window_start = event_window_start
        self.event_window_end = event_window_end

    def pick(
        self,
        waveform: WaveformData,
        event_origin_time: float
    ) -> List[ArrivalPick]:
        fs = waveform.sampling_rate
        data = waveform.data

        if len(data) < int(self.lta_length * fs):
            return []

        sta, lta = calculate_sta_lta(data, fs, self.sta_length, self.lta_length)
        ratio = sta / (lta + 1e-10)

        window_start_sample = max(0, int((event_origin_time + self.event_window_start) * fs))
        window_end_sample = min(len(data), int((event_origin_time + self.event_window_end) * fs))

        if window_start_sample >= window_end_sample:
            return []

        window_ratio = ratio[window_start_sample:window_end_sample]
        window_data = data[window_start_sample:window_end_sample]

        picks = self._find_picks_in_window(
            window_ratio, window_data, ratio, fs,
            window_start_sample, event_origin_time
        )

        return picks

    def _find_picks_in_window(
        self,
        window_ratio: np.ndarray,
        window_data: np.ndarray,
        full_ratio: np.ndarray,
        fs: float,
        window_offset: int,
        event_origin_time: float
    ) -> List[ArrivalPick]:
        picks = []
        in_event = False
        event_start_idx = 0

        threshold_on = self.threshold_on
        threshold_off = self.threshold_off

        for i in range(len(window_ratio)):
            if not in_event and window_ratio[i] > threshold_on:
                in_event = True
                event_start_idx = i
            elif in_event and window_ratio[i] < threshold_off:
                in_event = False
                event_duration = (i - event_start_idx) / fs

                if event_duration >= self.min_sta_duration:
                    peak_idx = event_start_idx + np.argmax(window_ratio[event_start_idx:i])
                    peak_ratio = window_ratio[peak_idx]

                    local_window = 50
                    noise_start = max(0, event_start_idx - local_window)
                    noise_end = event_start_idx
                    if noise_end > noise_start:
                        noise_level = np.mean(window_data[noise_start:noise_end]**2)
                    else:
                        noise_level = np.var(window_data)

                    signal_power = np.max(window_data[event_start_idx:i]**2)
                    snr = np.sqrt(signal_power / (noise_level + 1e-10)) if noise_level > 0 else 0

                    abs_peak_idx = window_offset + peak_idx
                    pick_time = event_origin_time + (abs_peak_idx - window_offset) / fs

                    picks.append(ArrivalPick(
                        phase="P",
                        time=pick_time,
                        snr=float(snr),
                        sta=float(peak_ratio),
                        lta=float(1.0),
                        channel=waveform.channel
                    ))

        if in_event:
            i = len(window_ratio)
            event_duration = (i - event_start_idx) / fs
            if event_duration >= self.min_sta_duration:
                peak_idx = event_start_idx + np.argmax(window_ratio[event_start_idx:i])
                peak_ratio = window_ratio[peak_idx]

                local_window = 50
                noise_start = max(0, event_start_idx - local_window)
                noise_end = event_start_idx
                if noise_end > noise_start:
                    noise_level = np.mean(window_data[noise_start:noise_end]**2)
                else:
                    noise_level = np.var(window_data)

                signal_power = np.max(window_data[event_start_idx:i]**2)
                snr = np.sqrt(signal_power / (noise_level + 1e-10)) if noise_level > 0 else 0

                abs_peak_idx = window_offset + peak_idx
                pick_time = event_origin_time + (abs_peak_idx - window_offset) / fs

                picks.append(ArrivalPick(
                    phase="P",
                    time=pick_time,
                    snr=float(snr),
                    sta=float(peak_ratio),
                    lta=float(1.0),
                    channel=waveform.channel
                ))

        return picks


def pick_arrivals(
    waveforms: Dict[str, Dict[str, WaveformData]],
    event: Event,
    picker: STA_LTA_Picker
) -> Dict[str, Dict[str, List[ArrivalPick]]]:
    import dateutil.parser

    event_time = dateutil.parser.parse(event.origin_time)
    origin_timestamp = event_time.timestamp()

    all_picks: Dict[str, Dict[str, List[ArrivalPick]]] = {}

    for station_key, channel_data in waveforms.items():
        all_picks[station_key] = {}
        for channel, waveform in channel_data.items():
            picks = picker.pick(waveform, origin_timestamp)
            if picks:
                all_picks[station_key][channel] = picks

    return all_picks


def compare_arrivals(
    picks: Dict[str, Dict[str, List[ArrivalPick]]],
    event: Event,
    tolerance: float = 2.0
) -> Tuple[List[Dict], List[Dict]]:
    import dateutil.parser

    event_time = dateutil.parser.parse(event.origin_time)
    origin_timestamp = event_time.timestamp()

    catalog_arrivals = {arr["phase"]: arr for arr in event.arrivals}
    anomalies = []
    matched_stations = []

    for station_key, channel_picks in picks.items():
        all_picks_for_station = []
        for channel, pick_list in channel_picks.items():
            all_picks_for_station.extend(pick_list)

        if not all_picks_for_station:
            anomalies.append({
                "station": station_key,
                "reason": "no_picks",
                "details": "No STA/LTA picks found for this station"
            })
            continue

        best_pick = min(all_picks_for_station, key=lambda p: p.time)
        pick_time_rel = best_pick.time - origin_timestamp

        matched_catalog = []
        for phase, cat_arr in catalog_arrivals.items():
            cat_time = dateutil.parser.parse(cat_arr["time"]).timestamp()
            cat_time_rel = cat_time - origin_timestamp

            time_diff = abs(best_pick.time - cat_time)

            is_match = time_diff <= tolerance
            matched_catalog.append({
                "phase": phase,
                "pick_time": best_pick.time,
                "catalog_time": cat_time,
                "time_diff": time_diff,
                "is_match": is_match,
                "pick_snr": best_pick.snr
            })

        any_match = any(m["is_match"] for m in matched_catalog)

        if not any_match:
            anomalies.append({
                "station": station_key,
                "reason": "arrival_mismatch",
                "details": f"No catalog arrival within {tolerance}s of pick",
                "pick_time_rel": pick_time_rel,
                "matched_catalog": matched_catalog
            })
        else:
            matched_stations.append({
                "station": station_key,
                "pick": best_pick,
                "matches": matched_catalog
            })

    return anomalies, matched_stations
