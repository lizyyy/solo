import numpy as np
from scipy import signal
from typing import Dict, Any, Tuple
from config import (
    DEFAULT_WINDOW_SIZE, DEFAULT_WINDOW_TYPE, DEFAULT_N_FFT,
    VALID_WINDOW_TYPES, MIN_WINDOW_SIZE, MAX_WINDOW_SIZE
)


class SpectrumAnalyzer:
    def __init__(self, sample_rate: int, window_size: int = DEFAULT_WINDOW_SIZE,
                 window_type: str = DEFAULT_WINDOW_TYPE, n_fft: int = DEFAULT_N_FFT):
        self.sample_rate = sample_rate
        self.window_size = window_size
        self.window_type = window_type
        self.n_fft = n_fft
        self.warnings = []
        self.analysis_params = {}
        self.intermediate_results = {}

    def _validate_parameters(self) -> None:
        if self.window_size < MIN_WINDOW_SIZE:
            self.warnings.append(
                f"窗口大小 {self.window_size} 小于推荐最小值 {MIN_WINDOW_SIZE}，"
                f"频率分辨率将降低"
            )
        elif self.window_size > MAX_WINDOW_SIZE:
            self.warnings.append(
                f"窗口大小 {self.window_size} 大于推荐最大值 {MAX_WINDOW_SIZE}，"
                f"计算量将增加"
            )

        if self.window_type not in VALID_WINDOW_TYPES:
            raise ValueError(
                f"无效的窗函数类型: {self.window_type}，"
                f"可选类型: {VALID_WINDOW_TYPES}"
            )

        if self.n_fft < self.window_size:
            self.warnings.append(
                f"FFT点数 {self.n_fft} 小于窗口大小 {self.window_size}，"
                f"已自动调整为 {self.window_size}"
            )
            self.n_fft = self.window_size

        if self.n_fft & (self.n_fft - 1) != 0:
            next_pow2 = 1 << (self.n_fft - 1).bit_length()
            self.warnings.append(
                f"FFT点数 {self.n_fft} 不是2的幂，建议使用 {next_pow2} 以获得最佳性能"
            )

    def _generate_window(self) -> np.ndarray:
        if self.window_type == 'hann':
            window = np.hanning(self.window_size)
        elif self.window_type == 'hamming':
            window = np.hamming(self.window_size)
        elif self.window_type == 'blackman':
            window = np.blackman(self.window_size)
        elif self.window_type == 'rectangular':
            window = np.ones(self.window_size)
        else:
            window = np.hanning(self.window_size)

        window_power = np.sum(window ** 2)
        coherent_gain = np.sum(window) / self.window_size
        equivalent_noise_bw = window_power / (np.sum(window) ** 2) * self.window_size

        self.analysis_params['window_power'] = window_power
        self.analysis_params['coherent_gain'] = coherent_gain
        self.analysis_params['equivalent_noise_bw'] = equivalent_noise_bw
        self.analysis_params['window_enbw_hz'] = equivalent_noise_bw * (self.sample_rate / self.window_size)

        return window

    def _check_spectral_leakage(self, windowed_signal: np.ndarray, spectrum: np.ndarray) -> Dict:
        leakage_info = {}

        main_lobe_energy = np.sum(np.abs(spectrum) ** 2)
        total_energy = np.sum(windowed_signal ** 2) * self.n_fft / 2

        leakage_ratio = 1 - (main_lobe_energy / total_energy) if total_energy > 0 else 0
        leakage_ratio = max(0, min(1, leakage_ratio))
        leakage_info['leakage_ratio'] = leakage_ratio

        if leakage_ratio > 0.1:
            self.warnings.append(
                f"检测到频谱泄漏: 泄漏比例 {leakage_ratio:.2%}，"
                f"建议使用更宽的窗口或增加窗口大小"
            )
            leakage_info['severity'] = 'high'
        elif leakage_ratio > 0.05:
            leakage_info['severity'] = 'medium'
        else:
            leakage_info['severity'] = 'low'

        return leakage_info

    def analyze(self, audio_data: np.ndarray) -> Dict[str, Any]:
        self._validate_parameters()

        if len(audio_data) < self.window_size:
            padding = self.window_size - len(audio_data)
            audio_data = np.pad(audio_data, (0, padding), mode='constant')
            self.warnings.append(
                f"音频长度不足，已补零 {padding} 个采样点至窗口大小"
            )

        window = self._generate_window()
        windowed_signal = audio_data[:self.window_size] * window

        self.intermediate_results['windowed_signal'] = windowed_signal
        self.intermediate_results['window'] = window

        fft_result = np.fft.fft(windowed_signal, n=self.n_fft)
        fft_freqs = np.fft.fftfreq(self.n_fft, 1.0 / self.sample_rate)

        positive_mask = fft_freqs >= 0
        freqs = fft_freqs[positive_mask]
        spectrum_complex = fft_result[positive_mask]

        magnitude_raw = np.abs(spectrum_complex)
        magnitude_db = 20 * np.log10(magnitude_raw / np.max(magnitude_raw) + 1e-10)
        phase = np.angle(spectrum_complex)

        magnitude_normalized = magnitude_raw / (self.window_size / 2)
        magnitude_dbfs = 20 * np.log10(magnitude_normalized + 1e-10)

        freq_resolution = self.sample_rate / self.n_fft
        bin_bandwidth = self.sample_rate / self.window_size

        self.analysis_params.update({
            'freq_resolution_hz': freq_resolution,
            'bin_bandwidth_hz': bin_bandwidth,
            'n_fft_actual': self.n_fft,
            'window_size_actual': self.window_size,
            'nyquist_frequency': self.sample_rate / 2
        })

        leakage_info = self._check_spectral_leakage(windowed_signal, magnitude_raw)

        results = {
            'frequencies': freqs,
            'magnitude_raw': magnitude_raw,
            'magnitude_db': magnitude_db,
            'magnitude_dbfs': magnitude_dbfs,
            'phase': phase,
            'spectrum_complex': spectrum_complex,
            'params': self.analysis_params,
            'intermediate': self.intermediate_results,
            'leakage_info': leakage_info
        }

        return results

    def print_analysis_info(self) -> None:
        print("=" * 60)
        print("频谱分析参数")
        print("=" * 60)
        print(f"  采样率 (Fs):              {self.sample_rate} Hz")
        print(f"  窗口大小 (N):             {self.window_size} 采样点")
        print(f"  窗函数类型:               {self.window_type}")
        print(f"  FFT点数:                  {self.n_fft}")
        print(f"\n【关键公式】")
        print(f"  频率分辨率: Δf = Fs / N_FFT")
        print(f"           = {self.sample_rate} / {self.n_fft} = {self.analysis_params.get('freq_resolution_hz', 0):.4f} Hz")
        print(f"  奈奎斯特频率: F_nyquist = Fs / 2")
        print(f"              = {self.sample_rate} / 2 = {self.analysis_params.get('nyquist_frequency', 0):.1f} Hz")
        print(f"  等效噪声带宽 (ENBW): {self.analysis_params.get('window_enbw_hz', 0):.2f} Hz")
        print(f"\n【中间量】")
        print(f"  窗函数相干增益:         {self.analysis_params.get('coherent_gain', 0):.6f}")
        print(f"  窗函数能量:              {self.analysis_params.get('window_power', 0):.2f}")
        print(f"  频率分辨率 (每bin):      {self.analysis_params.get('freq_resolution_hz', 0):.4f} Hz")
        print(f"   bin带宽 (未插值):       {self.analysis_params.get('bin_bandwidth_hz', 0):.4f} Hz")

        if self.warnings:
            print(f"\n【分析警告】")
            for i, warning in enumerate(self.warnings, 1):
                print(f"  [{i}] {warning}")
        print("=" * 60)

    def get_warnings(self) -> list:
        return self.warnings
