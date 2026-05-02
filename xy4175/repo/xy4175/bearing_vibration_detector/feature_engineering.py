"""
特征工程模块
- 时域特征提取
- 频域特征提取
- 分帧处理避免平均值掩盖
- 支持工况分组分析
"""

from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from scipy import signal
from scipy.fftpack import fft, fftfreq
from scipy.stats import kurtosis, skew


@dataclass
class FrameFeatures:
    """单帧特征"""
    frame_idx: int
    start_time: float
    end_time: float
    
    time_domain: Dict[str, float] = field(default_factory=dict)
    freq_domain: Dict[str, float] = field(default_factory=dict)
    
    anomaly_score: float = 0.0


@dataclass
class TripFeatures:
    """单趟特征"""
    trip_id: str
    sampling_rate: float
    total_samples: int
    
    frame_features: List[FrameFeatures] = field(default_factory=list)
    global_features: Dict[str, float] = field(default_factory=dict)
    
    peak_frames: List[int] = field(default_factory=list)
    suspicious_frames: List[int] = field(default_factory=list)


class FeatureEngineer:
    """特征工程师"""
    
    TIME_DOMAIN_FEATURES = [
        "mean", "rms", "peak", "peak2peak", "crest_factor",
        "kurtosis", "skewness", "margin_factor", "shape_factor",
        "impulse_factor", "variance", "std"
    ]
    
    FREQ_DOMAIN_FEATURES = [
        "freq_peak_1", "freq_peak_2", "freq_peak_3",
        "freq_peak_amp_1", "freq_peak_amp_2", "freq_peak_amp_3",
        "band_energy_low", "band_energy_mid", "band_energy_high",
        "freq_center", "freq_rms", "freq_kurtosis",
        "harmonic_ratio_1x", "harmonic_ratio_2x", "harmonic_ratio_3x"
    ]
    
    def __init__(self,
                 frame_size: int = 25600,
                 frame_overlap: float = 0.5,
                 sampling_rate: float = 25600.0,
                 bearing_params: Optional[Dict] = None):
        """
        初始化特征工程师
        
        参数:
            frame_size: 每帧样本数
            frame_overlap: 帧重叠比例
            sampling_rate: 采样率 (Hz)
            bearing_params: 轴承参数（用于计算故障特征频率）
                {
                    "roller_count": 16,
                    "pitch_diameter": 120.0,
                    "roller_diameter": 20.0,
                    "contact_angle": 0.0
                }
        """
        self.frame_size = frame_size
        self.frame_overlap = frame_overlap
        self.sampling_rate = sampling_rate
        self.bearing_params = bearing_params or {
            "roller_count": 16,
            "pitch_diameter": 120.0,
            "roller_diameter": 20.0,
            "contact_angle": 0.0
        }
        
    def extract_features(self,
                         vibration_data: pd.DataFrame,
                         speed_profile: Optional[pd.DataFrame] = None) -> TripFeatures:
        """
        提取振动数据的全部特征
        
        参数:
            vibration_data: 振动数据 DataFrame，需包含 timestamp 和 vibration_* 列
            speed_profile: 转速工况表（可选）
            
        返回:
            TripFeatures 对象
        """
        if vibration_data is None or len(vibration_data) < self.frame_size:
            return TripFeatures(
                trip_id="unknown",
                sampling_rate=self.sampling_rate,
                total_samples=0
            )
        
        vibration_cols = [col for col in vibration_data.columns if col.startswith("vibration_")]
        if not vibration_cols:
            vibration_cols = [vibration_data.columns[1]] if len(vibration_data.columns) > 1 else []
        
        if not vibration_cols:
            return TripFeatures(
                trip_id="unknown",
                sampling_rate=self.sampling_rate,
                total_samples=len(vibration_data)
            )
        
        main_signal = vibration_data[vibration_cols[0]].values
        main_signal = self._preprocess_signal(main_signal)
        
        frames = self._split_into_frames(main_signal)
        
        frame_features_list = []
        for i, frame in enumerate(frames):
            frame_feat = self._extract_frame_features(frame, i)
            frame_features_list.append(frame_feat)
        
        global_features = self._extract_global_features(main_signal, frame_features_list)
        
        peak_frames = self._find_peak_frames(frame_features_list)
        suspicious_frames = self._find_suspicious_frames(frame_features_list, peak_frames)
        
        trip_features = TripFeatures(
            trip_id="extracted",
            sampling_rate=self.sampling_rate,
            total_samples=len(main_signal),
            frame_features=frame_features_list,
            global_features=global_features,
            peak_frames=peak_frames,
            suspicious_frames=suspicious_frames
        )
        
        if speed_profile is not None and not speed_profile.empty:
            trip_features = self._add_speed_related_features(trip_features, speed_profile)
        
        return trip_features
    
    def _preprocess_signal(self, signal_data: np.ndarray) -> np.ndarray:
        """
        信号预处理：去趋势、去均值
        """
        signal_data = signal_data.copy()
        
        signal_data = signal_data - np.nanmean(signal_data)
        
        signal_data = signal.detrend(signal_data, type='linear')
        
        signal_data = np.nan_to_num(signal_data, nan=0.0)
        
        return signal_data
    
    def _split_into_frames(self, signal_data: np.ndarray) -> List[np.ndarray]:
        """
        将信号分割成重叠帧
        """
        step = int(self.frame_size * (1 - self.frame_overlap))
        
        frames = []
        n_samples = len(signal_data)
        
        start = 0
        while start + self.frame_size <= n_samples:
            frame = signal_data[start:start + self.frame_size]
            frames.append(frame)
            start += step
        
        if start < n_samples and n_samples - start > self.frame_size // 2:
            frame = signal_data[-self.frame_size:]
            frames.append(frame)
        
        return frames
    
    def _extract_frame_features(self, frame: np.ndarray, frame_idx: int) -> FrameFeatures:
        """
        提取单帧特征
        """
        frame_duration = self.frame_size / self.sampling_rate
        start_time = frame_idx * self.frame_size * (1 - self.frame_overlap) / self.sampling_rate
        end_time = start_time + frame_duration
        
        time_features = self._extract_time_domain_features(frame)
        freq_features = self._extract_freq_domain_features(frame)
        
        return FrameFeatures(
            frame_idx=frame_idx,
            start_time=start_time,
            end_time=end_time,
            time_domain=time_features,
            freq_domain=freq_features
        )
    
    def _extract_time_domain_features(self, signal_data: np.ndarray) -> Dict[str, float]:
        """
        提取时域特征
        """
        if len(signal_data) == 0:
            return {feat: 0.0 for feat in self.TIME_DOMAIN_FEATURES}
        
        mean_val = np.mean(signal_data)
        rms_val = np.sqrt(np.mean(signal_data ** 2))
        peak_val = np.max(np.abs(signal_data))
        peak2peak_val = np.max(signal_data) - np.min(signal_data)
        variance_val = np.var(signal_data)
        std_val = np.std(signal_data)
        
        crest_factor = peak_val / rms_val if rms_val > 0 else 0.0
        
        kurtosis_val = kurtosis(signal_data, fisher=False)
        skewness_val = skew(signal_data)
        
        abs_mean = np.mean(np.abs(signal_data))
        margin_factor = peak_val / (np.mean(np.abs(signal_data) ** 0.5) ** 2) if abs_mean > 0 else 0.0
        shape_factor = rms_val / abs_mean if abs_mean > 0 else 0.0
        impulse_factor = peak_val / abs_mean if abs_mean > 0 else 0.0
        
        return {
            "mean": float(mean_val),
            "rms": float(rms_val),
            "peak": float(peak_val),
            "peak2peak": float(peak2peak_val),
            "crest_factor": float(crest_factor),
            "kurtosis": float(kurtosis_val),
            "skewness": float(skewness_val),
            "margin_factor": float(margin_factor),
            "shape_factor": float(shape_factor),
            "impulse_factor": float(impulse_factor),
            "variance": float(variance_val),
            "std": float(std_val)
        }
    
    def _extract_freq_domain_features(self, signal_data: np.ndarray) -> Dict[str, float]:
        """
        提取频域特征
        """
        if len(signal_data) == 0:
            return {feat: 0.0 for feat in self.FREQ_DOMAIN_FEATURES}
        
        n_samples = len(signal_data)
        
        windowed = signal_data * signal.windows.hann(n_samples)
        
        yf = fft(windowed)
        xf = fftfreq(n_samples, 1 / self.sampling_rate)
        
        pos_mask = xf > 0
        freq_pos = xf[pos_mask]
        amp_pos = 2.0 / n_samples * np.abs(yf[pos_mask])
        
        if len(freq_pos) == 0:
            return {feat: 0.0 for feat in self.FREQ_DOMAIN_FEATURES}
        
        peak_indices = self._find_spectral_peaks(amp_pos, n_peaks=3)
        
        freq_peaks = [freq_pos[i] if i < len(freq_pos) else 0.0 for i in peak_indices]
        amp_peaks = [amp_pos[i] if i < len(amp_pos) else 0.0 for i in peak_indices]
        
        total_energy = np.sum(amp_pos ** 2) if np.sum(amp_pos ** 2) > 0 else 1.0
        
        nyquist = self.sampling_rate / 2
        low_band = (freq_pos <= nyquist * 0.1)
        mid_band = (freq_pos > nyquist * 0.1) & (freq_pos <= nyquist * 0.5)
        high_band = (freq_pos > nyquist * 0.5)
        
        band_energy_low = np.sum(amp_pos[low_band] ** 2) / total_energy
        band_energy_mid = np.sum(amp_pos[mid_band] ** 2) / total_energy
        band_energy_high = np.sum(amp_pos[high_band] ** 2) / total_energy
        
        if np.sum(amp_pos) > 0:
            freq_center = np.sum(freq_pos * amp_pos) / np.sum(amp_pos)
            freq_rms = np.sqrt(np.sum((freq_pos ** 2) * amp_pos) / np.sum(amp_pos))
        else:
            freq_center = 0.0
            freq_rms = 0.0
        
        freq_kurtosis_val = kurtosis(amp_pos) if len(amp_pos) > 3 else 3.0
        
        harmonic_ratios = self._calculate_harmonic_ratios(freq_pos, amp_pos)
        
        return {
            "freq_peak_1": float(freq_peaks[0]) if len(freq_peaks) > 0 else 0.0,
            "freq_peak_2": float(freq_peaks[1]) if len(freq_peaks) > 1 else 0.0,
            "freq_peak_3": float(freq_peaks[2]) if len(freq_peaks) > 2 else 0.0,
            "freq_peak_amp_1": float(amp_peaks[0]) if len(amp_peaks) > 0 else 0.0,
            "freq_peak_amp_2": float(amp_peaks[1]) if len(amp_peaks) > 1 else 0.0,
            "freq_peak_amp_3": float(amp_peaks[2]) if len(amp_peaks) > 2 else 0.0,
            "band_energy_low": float(band_energy_low),
            "band_energy_mid": float(band_energy_mid),
            "band_energy_high": float(band_energy_high),
            "freq_center": float(freq_center),
            "freq_rms": float(freq_rms),
            "freq_kurtosis": float(freq_kurtosis_val),
            "harmonic_ratio_1x": float(harmonic_ratios.get("1x", 0.0)),
            "harmonic_ratio_2x": float(harmonic_ratios.get("2x", 0.0)),
            "harmonic_ratio_3x": float(harmonic_ratios.get("3x", 0.0))
        }
    
    def _find_spectral_peaks(self, amplitude: np.ndarray, n_peaks: int = 3) -> List[int]:
        """
        寻找频谱峰值
        """
        if len(amplitude) < 3:
            return list(range(min(n_peaks, len(amplitude))))
        
        peaks = []
        for i in range(1, len(amplitude) - 1):
            if amplitude[i] > amplitude[i-1] and amplitude[i] > amplitude[i+1]:
                peaks.append((i, amplitude[i]))
        
        peaks.sort(key=lambda x: x[1], reverse=True)
        
        return [p[0] for p in peaks[:n_peaks]] if peaks else [0]
    
    def _calculate_harmonic_ratios(self, freq: np.ndarray, amp: np.ndarray) -> Dict[str, float]:
        """
        计算谐波比率（用于检测传感器松动等周期性故障）
        """
        if len(freq) == 0 or np.sum(amp) == 0:
            return {"1x": 0.0, "2x": 0.0, "3x": 0.0}
        
        max_amp_idx = np.argmax(amp)
        fundamental_freq = freq[max_amp_idx] if max_amp_idx < len(freq) else 0.0
        
        if fundamental_freq <= 0:
            return {"1x": 0.0, "2x": 0.0, "3x": 0.0}
        
        total_energy = np.sum(amp ** 2)
        
        ratios = {}
        for n in [1, 2, 3]:
            target_freq = fundamental_freq * n
            tolerance = fundamental_freq * 0.1
            
            mask = np.abs(freq - target_freq) <= tolerance
            harmonic_energy = np.sum(amp[mask] ** 2) if np.any(mask) else 0.0
            ratios[f"{n}x"] = harmonic_energy / total_energy if total_energy > 0 else 0.0
        
        return ratios
    
    def _extract_global_features(self,
                                  signal_data: np.ndarray,
                                  frame_features: List[FrameFeatures]) -> Dict[str, float]:
        """
        提取全局特征（基于所有帧的统计）
        """
        if not frame_features:
            return {}
        
        kurtosis_values = [f.time_domain.get("kurtosis", 0.0) for f in frame_features]
        crest_values = [f.time_domain.get("crest_factor", 0.0) for f in frame_features]
        rms_values = [f.time_domain.get("rms", 0.0) for f in frame_features]
        
        global_feat = {
            "global_kurtosis_mean": float(np.mean(kurtosis_values)),
            "global_kurtosis_std": float(np.std(kurtosis_values)),
            "global_kurtosis_max": float(np.max(kurtosis_values)),
            "global_crest_mean": float(np.mean(crest_values)),
            "global_crest_std": float(np.std(crest_values)),
            "global_crest_max": float(np.max(crest_values)),
            "global_rms_mean": float(np.mean(rms_values)),
            "global_rms_std": float(np.std(rms_values)),
            "global_rms_max": float(np.max(rms_values)),
            "frame_count": len(frame_features)
        }
        
        if np.mean(rms_values) > 0:
            global_feat["rms_variability"] = float(np.std(rms_values) / np.mean(rms_values))
        else:
            global_feat["rms_variability"] = 0.0
        
        if len(kurtosis_values) > 1:
            global_feat["kurtosis_spike_score"] = float(
                (np.max(kurtosis_values) - np.mean(kurtosis_values)) / 
                (np.std(kurtosis_values) + 1e-6)
            )
        else:
            global_feat["kurtosis_spike_score"] = 0.0
        
        return global_feat
    
    def _find_peak_frames(self, frame_features: List[FrameFeatures]) -> List[int]:
        """
        找出峰值帧（可能存在冲击信号的帧）
        """
        if not frame_features:
            return []
        
        kurtosis_values = [f.time_domain.get("kurtosis", 0.0) for f in frame_features]
        crest_values = [f.time_domain.get("crest_factor", 0.0) for f in frame_features]
        
        kurtosis_mean = np.mean(kurtosis_values)
        kurtosis_std = np.std(kurtosis_values) + 1e-6
        
        crest_mean = np.mean(crest_values)
        crest_std = np.std(crest_values) + 1e-6
        
        peak_frames = []
        for i, (k, c) in enumerate(zip(kurtosis_values, crest_values)):
            kurtosis_score = (k - kurtosis_mean) / kurtosis_std
            crest_score = (c - crest_mean) / crest_std
            
            if kurtosis_score > 2.0 or crest_score > 2.0:
                peak_frames.append(i)
        
        return peak_frames
    
    def _find_suspicious_frames(self,
                                 frame_features: List[FrameFeatures],
                                 peak_frames: List[int]) -> List[int]:
        """
        找出可疑帧（包括峰值帧及其相邻帧）
        """
        if not frame_features:
            return []
        
        suspicious = set(peak_frames)
        
        for pf in peak_frames:
            if pf > 0:
                suspicious.add(pf - 1)
            if pf < len(frame_features) - 1:
                suspicious.add(pf + 1)
        
        harmonic_threshold = 0.3
        for i, ff in enumerate(frame_features):
            harmonic_sum = sum([
                ff.freq_domain.get("harmonic_ratio_1x", 0.0),
                ff.freq_domain.get("harmonic_ratio_2x", 0.0),
                ff.freq_domain.get("harmonic_ratio_3x", 0.0)
            ])
            if harmonic_sum > harmonic_threshold:
                suspicious.add(i)
        
        return sorted(list(suspicious))
    
    def _add_speed_related_features(self,
                                     trip_features: TripFeatures,
                                     speed_profile: pd.DataFrame) -> TripFeatures:
        """
        添加转速相关特征
        """
        if "speed" not in speed_profile.columns:
            return trip_features
        
        speed_values = speed_profile["speed"].values
        
        for ff in trip_features.frame_features:
            start_idx = int(ff.start_time * len(speed_values) / 
                           (speed_profile.iloc[-1, 0] if len(speed_profile) > 0 else 1))
            end_idx = int(ff.end_time * len(speed_values) / 
                         (speed_profile.iloc[-1, 0] if len(speed_profile) > 0 else 1))
            
            start_idx = max(0, min(start_idx, len(speed_values) - 1))
            end_idx = max(start_idx, min(end_idx, len(speed_values) - 1))
            
            if start_idx < end_idx:
                frame_speed = speed_values[start_idx:end_idx]
                ff.time_domain["speed_mean"] = float(np.mean(frame_speed))
                ff.time_domain["speed_std"] = float(np.std(frame_speed))
        
        return trip_features
    
    def features_to_dataframe(self, trip_features: TripFeatures) -> pd.DataFrame:
        """
        将特征转换为 DataFrame
        """
        if not trip_features.frame_features:
            return pd.DataFrame()
        
        rows = []
        for ff in trip_features.frame_features:
            row = {
                "frame_idx": ff.frame_idx,
                "start_time": ff.start_time,
                "end_time": ff.end_time
            }
            
            for key, value in ff.time_domain.items():
                row[f"time_{key}"] = value
            
            for key, value in ff.freq_domain.items():
                row[f"freq_{key}"] = value
            
            row["is_peak"] = ff.frame_idx in trip_features.peak_frames
            row["is_suspicious"] = ff.frame_idx in trip_features.suspicious_frames
            
            rows.append(row)
        
        return pd.DataFrame(rows)
    
    def get_global_features_dataframe(self, trip_features: TripFeatures) -> pd.DataFrame:
        """
        获取全局特征 DataFrame
        """
        return pd.DataFrame([trip_features.global_features])
