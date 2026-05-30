import numpy as np
from scipy.signal import find_peaks
from typing import Dict, Any, List, Tuple
from config import DEFAULT_PEAK_THRESHOLD, DEFAULT_FUNDAMENTAL_TOLERANCE, NOTE_NAMES, A4_FREQ


class PeakAnalyzer:
    def __init__(self, peak_threshold: float = DEFAULT_PEAK_THRESHOLD,
                 fundamental_tolerance: float = DEFAULT_FUNDAMENTAL_TOLERANCE):
        self.peak_threshold = peak_threshold
        self.fundamental_tolerance = fundamental_tolerance
        self.warnings = []
        self.analysis_decisions = []
        self.intermediate_results = {}

    def _freq_to_note(self, freq: float) -> Tuple[str, float]:
        if freq <= 0:
            return 'Unknown', 0.0
        
        midi_num = 12 * np.log2(freq / A4_FREQ) + 69
        midi_rounded = int(round(midi_num))
        cents = (midi_num - midi_rounded) * 100
        
        octave = (midi_rounded // 12) - 1
        note_idx = midi_rounded % 12
        note_name = NOTE_NAMES[note_idx]
        
        return f"{note_name}{octave}", cents

    def detect_peaks(self, freqs: np.ndarray, magnitude_db: np.ndarray,
                     magnitude_raw: np.ndarray) -> Dict[str, Any]:
        max_mag = np.max(magnitude_raw)
        threshold_linear = self.peak_threshold * max_mag
        threshold_db = 20 * np.log10(threshold_linear / max_mag + 1e-10)

        self.intermediate_results['threshold_linear'] = threshold_linear
        self.intermediate_results['threshold_db'] = threshold_db
        self.intermediate_results['max_magnitude'] = max_mag

        peaks, properties = find_peaks(
            magnitude_raw,
            height=threshold_linear,
            distance=3,
            prominence=threshold_linear * 0.5
        )

        if len(peaks) == 0:
            self.warnings.append("未检测到任何频谱峰值，请降低峰值阈值或检查音频信号")
            return {
                'peaks': [],
                'peak_count': 0,
                'threshold_db': threshold_db,
                'threshold_linear': threshold_linear
            }

        peak_freqs = freqs[peaks]
        peak_magnitudes_raw = magnitude_raw[peaks]
        peak_magnitudes_db = magnitude_db[peaks]

        sorted_indices = np.argsort(peak_magnitudes_raw)[::-1]
        peak_freqs = peak_freqs[sorted_indices]
        peak_magnitudes_raw = peak_magnitudes_raw[sorted_indices]
        peak_magnitudes_db = peak_magnitudes_db[sorted_indices]

        peak_data = []
        for i, (freq, mag_raw, mag_db) in enumerate(zip(peak_freqs, peak_magnitudes_raw, peak_magnitudes_db)):
            note, cents = self._freq_to_note(freq)
            relative_amp = mag_raw / max_mag
            peak_data.append({
                'index': i + 1,
                'frequency': freq,
                'magnitude_raw': mag_raw,
                'magnitude_db': mag_db,
                'relative_amplitude': relative_amp,
                'note': note,
                'cents_deviation': cents
            })

        duplicate_info = self._check_duplicate_peaks(peak_freqs, peak_magnitudes_raw)

        results = {
            'peaks': peak_data,
            'peak_count': len(peak_data),
            'threshold_db': threshold_db,
            'threshold_linear': threshold_linear,
            'duplicate_info': duplicate_info
        }

        return results

    def _check_duplicate_peaks(self, peak_freqs: np.ndarray, peak_magnitudes: np.ndarray) -> Dict:
        duplicate_info = {
            'found': False,
            'groups': [],
            'merged_count': 0
        }

        if len(peak_freqs) < 2:
            return duplicate_info

        freq_tolerance = 5.0
        used = set()
        groups = []

        for i in range(len(peak_freqs)):
            if i in used:
                continue
            group = [i]
            for j in range(i + 1, len(peak_freqs)):
                if abs(peak_freqs[i] - peak_freqs[j]) < freq_tolerance:
                    group.append(j)
                    used.add(j)
            if len(group) > 1:
                groups.append(group)
                duplicate_info['found'] = True
                duplicate_info['merged_count'] += len(group) - 1

        if duplicate_info['found']:
            self.warnings.append(
                f"检测到 {len(groups)} 组重复峰值（频率差 < {freq_tolerance} Hz），"
                f"共 {duplicate_info['merged_count']} 个冗余峰值"
            )
            self.analysis_decisions.append(
                f"检测到重复峰值，建议归并处理（已保留每组中幅度最大的峰值）"
            )

        duplicate_info['groups'] = groups
        return duplicate_info

    def merge_duplicate_peaks(self, peaks: List[Dict]) -> List[Dict]:
        if not peaks:
            return peaks

        freq_tolerance = 5.0
        merged_peaks = []
        used_indices = set()

        for i, peak in enumerate(peaks):
            if i in used_indices:
                continue

            current_group = [peak]
            used_indices.add(i)

            for j, other_peak in enumerate(peaks[i + 1:], start=i + 1):
                if j in used_indices:
                    continue
                if abs(peak['frequency'] - other_peak['frequency']) < freq_tolerance:
                    current_group.append(other_peak)
                    used_indices.add(j)

            if len(current_group) > 1:
                max_peak = max(current_group, key=lambda p: p['magnitude_raw'])
                avg_freq = sum(p['frequency'] for p in current_group) / len(current_group)
                total_amp = sum(p['magnitude_raw'] for p in current_group)
                
                merged_peak = max_peak.copy()
                merged_peak['frequency'] = avg_freq
                merged_peak['magnitude_raw'] = total_amp
                merged_peak['merged_from'] = len(current_group)
                merged_peaks.append(merged_peak)
                
                freq_strs = [f"{p['frequency']:.1f}Hz" for p in current_group]
                self.analysis_decisions.append(
                    f"归并峰值组: {', '.join(freq_strs)} "
                    f"→ {avg_freq:.1f}Hz, 幅度累加: {total_amp:.2f}"
                )
            else:
                merged_peaks.append(peak)

        merged_peaks.sort(key=lambda p: p['magnitude_raw'], reverse=True)
        for i, peak in enumerate(merged_peaks):
            peak['index'] = i + 1

        return merged_peaks

    def identify_harmonics(self, peaks: List[Dict]) -> Dict[str, Any]:
        if not peaks:
            return {'fundamental': None, 'harmonics': [], 'harmonic_count': 0}

        sorted_by_freq = sorted(peaks, key=lambda p: p['frequency'])
        max_amp = max(p['magnitude_raw'] for p in peaks)
        
        fundamental_candidates = []
        for peak in sorted_by_freq:
            harmonic_count = 0
            harmonic_amp_sum = 0.0
            for other_peak in sorted_by_freq:
                if other_peak == peak:
                    continue
                ratio = other_peak['frequency'] / peak['frequency']
                harmonic_num = round(ratio)
                if harmonic_num > 1 and abs(ratio - harmonic_num) < self.fundamental_tolerance:
                    harmonic_count += 1
                    harmonic_amp_sum += other_peak['magnitude_raw']

            amp_score = peak['magnitude_raw'] / max_amp
            freq_score = 1.0 / (1 + peak['frequency'] / 1000.0)
            harmonic_score = harmonic_count * 0.5 + (harmonic_amp_sum / max_amp) * 0.3
            
            total_score = amp_score * 0.4 + freq_score * 0.3 + harmonic_score * 0.3
            fundamental_candidates.append((peak, total_score, harmonic_count))

        fundamental_candidates.sort(key=lambda x: -x[1])
        fundamental = fundamental_candidates[0][0]

        harmonics = []
        for peak in sorted_by_freq:
            if peak == fundamental:
                harmonics.append({
                    **peak,
                    'harmonic_number': 1,
                    'type': 'fundamental',
                    'frequency_ratio': 1.0,
                    'ideal_frequency': peak['frequency']
                })
                continue

            ratio = peak['frequency'] / fundamental['frequency']
            harmonic_num = round(ratio)
            deviation = abs(ratio - harmonic_num)

            if harmonic_num >= 2 and deviation < self.fundamental_tolerance:
                harmonics.append({
                    **peak,
                    'harmonic_number': harmonic_num,
                    'type': 'harmonic',
                    'frequency_ratio': ratio,
                    'ideal_frequency': fundamental['frequency'] * harmonic_num,
                    'deviation_cents': (ratio - harmonic_num) * 100
                })
            else:
                harmonics.append({
                    **peak,
                    'harmonic_number': None,
                    'type': 'inharmonic',
                    'frequency_ratio': ratio
                })

        harmonics.sort(key=lambda p: p['frequency'])

        harmonic_count = sum(1 for h in harmonics if h['type'] == 'harmonic')
        inharmonic_count = sum(1 for h in harmonics if h['type'] == 'inharmonic')

        self.intermediate_results['fundamental_freq'] = fundamental['frequency']
        self.intermediate_results['harmonic_count'] = harmonic_count
        self.intermediate_results['inharmonic_count'] = inharmonic_count

        return {
            'fundamental': fundamental,
            'harmonics': harmonics,
            'harmonic_count': harmonic_count,
            'inharmonic_count': inharmonic_count
        }

    def print_peak_info(self, peak_results: Dict, harmonic_results: Dict) -> None:
        print("=" * 60)
        print("峰值检测与泛音分析")
        print("=" * 60)
        
        print(f"\n【检测参数】")
        print(f"  峰值阈值 (相对):       {self.peak_threshold:.3f} ({peak_results['threshold_db']:.1f} dB)")
        print(f"  泛音识别容差:          ±{self.fundamental_tolerance * 100:.1f}%")
        print(f"  检测到峰值数量:        {peak_results['peak_count']}")
        
        print(f"\n【峰值列表】")
        print(f"  {'序号':>4} {'频率(Hz)':>12} {'幅度(dB)':>10} {'相对幅度':>10} {'音符':>6} {'偏差(分)':>10}")
        print(f"  {'-'*4} {'-'*12} {'-'*10} {'-'*10} {'-'*6} {'-'*10}")
        
        for peak in peak_results['peaks'][:15]:
            print(f"  {peak['index']:4d} {peak['frequency']:12.2f} {peak['magnitude_db']:10.2f} "
                  f"{peak['relative_amplitude']:10.3f} {peak['note']:>6} {peak['cents_deviation']:+10.1f}")
        
        if len(peak_results['peaks']) > 15:
            print(f"  ... (仅显示前15个峰值，共{len(peak_results['peaks'])}个)")

        print(f"\n【泛音分析】")
        if harmonic_results['fundamental']:
            fund = harmonic_results['fundamental']
            fund_note, fund_cents = self._freq_to_note(fund['frequency'])
            print(f"  基频 (Fundamental):    {fund['frequency']:.2f} Hz ({fund_note}, {fund_cents:+.1f} 分)")
            print(f"  泛音数量:              {harmonic_results['harmonic_count']}")
            print(f"  非泛音峰值数量:        {harmonic_results['inharmonic_count']}")
            
            print(f"\n  {'谐波序':>6} {'频率(Hz)':>12} {'理想频率':>12} {'比率':>8} {'幅度(dB)':>10} {'类型':>10}")
            print(f"  {'-'*6} {'-'*12} {'-'*12} {'-'*8} {'-'*10} {'-'*10}")
            
            for h in harmonic_results['harmonics'][:12]:
                harm_num = h.get('harmonic_number')
                harm_num_str = str(harm_num) if harm_num is not None else '-'
                ideal_freq = h.get('ideal_frequency', h['frequency'])
                ratio = h.get('frequency_ratio', 1.0)
                print(f"  {harm_num_str:>6} {h['frequency']:12.2f} {ideal_freq:12.2f} "
                      f"{ratio:8.3f} {h['magnitude_db']:10.2f} {h['type']:>10}")

        if self.warnings:
            print(f"\n【分析警告】")
            for i, warning in enumerate(self.warnings, 1):
                print(f"  [{i}] {warning}")

        if self.analysis_decisions:
            print(f"\n【处理决策记录】")
            for i, decision in enumerate(self.analysis_decisions, 1):
                print(f"  [{i}] {decision}")

        print("=" * 60)

    def get_warnings(self) -> list:
        return self.warnings

    def get_decisions(self) -> list:
        return self.analysis_decisions
