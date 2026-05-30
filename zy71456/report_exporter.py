import os
import json
from datetime import datetime
from typing import Dict, Any, List


class ReportExporter:
    def __init__(self, output_dir: str = 'output'):
        self.output_dir = output_dir
        self._ensure_output_dir()

    def _ensure_output_dir(self) -> None:
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    def generate_report(self, analysis_data: Dict[str, Any]) -> Dict[str, Any]:
        report = {
            'timestamp': datetime.now().isoformat(),
            'version': '1.0.0',
            'audio_info': self._extract_audio_info(analysis_data),
            'spectrum_analysis': self._extract_spectrum_info(analysis_data),
            'peak_analysis': self._extract_peak_info(analysis_data),
            'harmonic_analysis': self._extract_harmonic_info(analysis_data),
            'warnings': self._collect_warnings(analysis_data),
            'processing_decisions': self._collect_decisions(analysis_data),
            'intermediate_values': self._collect_intermediates(analysis_data)
        }
        return report

    def _extract_audio_info(self, data: Dict[str, Any]) -> Dict[str, Any]:
        audio_info = data.get('audio_metadata', {})
        return {
            'file_path': audio_info.get('file_path', 'N/A'),
            'sample_rate': audio_info.get('sample_rate', 0),
            'duration_seconds': audio_info.get('duration', 0),
            'num_samples': audio_info.get('num_samples', 0),
            'original_channels': audio_info.get('original_channels', 1),
            'peak_amplitude': audio_info.get('peak_amplitude', 0),
            'rms_amplitude': audio_info.get('rms_amplitude', 0),
            'dc_offset': audio_info.get('dc_offset', 0),
            'nyquist_frequency': audio_info.get('nyquist_frequency', 0)
        }

    def _extract_spectrum_info(self, data: Dict[str, Any]) -> Dict[str, Any]:
        spectrum = data.get('spectrum', {})
        params = spectrum.get('params', {})
        leakage = spectrum.get('leakage_info', {})
        
        return {
            'window_type': data.get('window_type', 'hann'),
            'window_size': params.get('window_size_actual', 0),
            'n_fft': params.get('n_fft_actual', 0),
            'freq_resolution_hz': params.get('freq_resolution_hz', 0),
            'bin_bandwidth_hz': params.get('bin_bandwidth_hz', 0),
            'window_enbw_hz': params.get('window_enbw_hz', 0),
            'coherent_gain': params.get('coherent_gain', 0),
            'spectral_leakage': {
                'ratio': leakage.get('leakage_ratio', 0),
                'severity': leakage.get('severity', 'unknown')
            }
        }

    def _extract_peak_info(self, data: Dict[str, Any]) -> Dict[str, Any]:
        peaks = data.get('peaks', {})
        duplicate_info = peaks.get('duplicate_info', {})
        
        return {
            'peak_threshold_db': peaks.get('threshold_db', 0),
            'peak_threshold_linear': peaks.get('threshold_linear', 0),
            'total_peaks_detected': peaks.get('peak_count', 0),
            'duplicate_peaks': {
                'found': duplicate_info.get('found', False),
                'groups_count': len(duplicate_info.get('groups', [])),
                'merged_count': duplicate_info.get('merged_count', 0)
            },
            'peaks_detail': peaks.get('peaks', [])[:30]
        }

    def _extract_harmonic_info(self, data: Dict[str, Any]) -> Dict[str, Any]:
        harmonics = data.get('harmonics', {})
        fundamental = harmonics.get('fundamental', {})
        
        return {
            'fundamental_frequency': fundamental.get('frequency', 0) if fundamental else 0,
            'fundamental_magnitude_db': fundamental.get('magnitude_db', 0) if fundamental else 0,
            'fundamental_note': fundamental.get('note', 'N/A') if fundamental else 'N/A',
            'harmonic_count': harmonics.get('harmonic_count', 0),
            'inharmonic_count': harmonics.get('inharmonic_count', 0),
            'fundamental_tolerance_percent': data.get('fundamental_tolerance', 0.02) * 100,
            'harmonics_detail': harmonics.get('harmonics', [])[:20]
        }

    def _collect_warnings(self, data: Dict[str, Any]) -> List[str]:
        all_warnings = []
        
        audio_warnings = data.get('audio_warnings', [])
        for w in audio_warnings:
            all_warnings.append({'category': 'audio', 'message': w})
        
        spectrum_warnings = data.get('spectrum_warnings', [])
        for w in spectrum_warnings:
            all_warnings.append({'category': 'spectrum', 'message': w})
        
        peak_warnings = data.get('peak_warnings', [])
        for w in peak_warnings:
            all_warnings.append({'category': 'peak', 'message': w})
        
        return all_warnings

    def _collect_decisions(self, data: Dict[str, Any]) -> List[str]:
        return data.get('processing_decisions', [])

    def _collect_intermediates(self, data: Dict[str, Any]) -> Dict[str, Any]:
        spectrum = data.get('spectrum', {})
        peaks = data.get('peaks', {})
        
        return {
            'fft': {
                'window_power': spectrum.get('params', {}).get('window_power', 0),
                'window_coherent_gain': spectrum.get('params', {}).get('coherent_gain', 0)
            },
            'peak_detection': {
                'max_magnitude': peaks.get('threshold_linear', 0) / (data.get('peak_threshold', 0.05) or 0.05)
                if peaks.get('threshold_linear', 0) > 0 else 0,
                'threshold_linear': peaks.get('threshold_linear', 0),
                'threshold_db': peaks.get('threshold_db', 0)
            },
            'conflicting_values': self._detect_conflicts(data)
        }

    def _detect_conflicts(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        conflicts = []
        
        audio_info = data.get('audio_metadata', {})
        sample_rate = audio_info.get('sample_rate', 0)
        window_size = data.get('window_size', 2048)
        
        freq_resolution = sample_rate / window_size if window_size > 0 else 0
        peaks = data.get('peaks', {}).get('peaks', [])
        
        if len(peaks) >= 2:
            min_peak_spacing = min(abs(peaks[i]['frequency'] - peaks[i-1]['frequency']) 
                                   for i in range(1, min(10, len(peaks))))
            if min_peak_spacing < freq_resolution * 2:
                conflicts.append({
                    'type': 'resolution_conflict',
                    'severity': 'medium',
                    'description': '频率分辨率可能不足以区分紧密相邻的峰值',
                    'evidence': {
                        'freq_resolution_hz': freq_resolution,
                        'min_peak_spacing_hz': min_peak_spacing,
                        'recommendation': '考虑增大窗口大小以提高频率分辨率'
                    }
                })
        
        spectral_leakage = data.get('spectrum', {}).get('leakage_info', {}).get('severity', 'low')
        if spectral_leakage == 'high':
            conflicts.append({
                'type': 'spectral_leakage',
                'severity': 'high',
                'description': '检测到严重频谱泄漏，可能影响峰值幅度准确性',
                'evidence': {
                    'leakage_ratio': data.get('spectrum', {}).get('leakage_info', {}).get('leakage_ratio', 0),
                    'recommendation': '使用不同窗函数或增加窗口大小，确保信号在窗口内整数周期'
                }
            })
        
        duplicate_info = data.get('peaks', {}).get('duplicate_info', {})
        if duplicate_info.get('found', False):
            conflicts.append({
                'type': 'duplicate_peaks',
                'severity': 'low',
                'description': '检测到重复峰值，已自动归并处理',
                'evidence': {
                    'duplicate_groups': len(duplicate_info.get('groups', [])),
                    'merged_count': duplicate_info.get('merged_count', 0),
                    'action_taken': '保留每组最大幅度峰值，幅度累加'
                }
            })
        
        return conflicts

    def export_json_report(self, report: Dict[str, Any], 
                           filename: str = 'analysis_report.json') -> str:
        filepath = os.path.join(self.output_dir, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        return filepath

    def export_text_report(self, report: Dict[str, Any],
                           filename: str = 'analysis_report.txt') -> str:
        filepath = os.path.join(self.output_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write("=" * 70 + "\n")
            f.write("傅里叶音色拆解分析报告\n")
            f.write("=" * 70 + "\n\n")
            
            f.write(f"生成时间: {report['timestamp']}\n")
            f.write(f"版本: {report['version']}\n\n")
            
            f.write("-" * 70 + "\n")
            f.write("一、音频文件信息\n")
            f.write("-" * 70 + "\n")
            audio = report['audio_info']
            f.write(f"  文件路径:          {audio['file_path']}\n")
            f.write(f"  采样率:            {audio['sample_rate']} Hz\n")
            f.write(f"  时长:              {audio['duration_seconds']:.4f} 秒\n")
            f.write(f"  采样点数:          {audio['num_samples']}\n")
            f.write(f"  原始通道数:        {audio['original_channels']}\n")
            f.write(f"  峰值振幅:          {audio['peak_amplitude']:.6f}\n")
            f.write(f"  RMS振幅:           {audio['rms_amplitude']:.6f}\n")
            f.write(f"  直流偏移:          {audio['dc_offset']:.6f}\n")
            f.write(f"  奈奎斯特频率:      {audio['nyquist_frequency']:.1f} Hz\n\n")
            
            f.write("-" * 70 + "\n")
            f.write("二、频谱分析参数\n")
            f.write("-" * 70 + "\n")
            spec = report['spectrum_analysis']
            f.write(f"  窗函数类型:        {spec['window_type']}\n")
            f.write(f"  窗口大小:          {spec['window_size']} 采样点\n")
            f.write(f"  FFT点数:           {spec['n_fft']}\n")
            f.write(f"\n【关键公式与计算】\n")
            f.write(f"  频率分辨率 Δf = Fs / N_FFT\n")
            f.write(f"     = {audio['sample_rate']} / {spec['n_fft']} = {spec['freq_resolution_hz']:.4f} Hz\n")
            f.write(f"  等效噪声带宽 (ENBW) = {spec['window_enbw_hz']:.2f} Hz\n")
            f.write(f"  窗函数相干增益 = {spec['coherent_gain']:.6f}\n")
            f.write(f"\n【频谱泄漏检测】\n")
            f.write(f"  泄漏比例:          {spec['spectral_leakage']['ratio']:.2%}\n")
            f.write(f"  严重程度:          {spec['spectral_leakage']['severity']}\n\n")
            
            f.write("-" * 70 + "\n")
            f.write("三、峰值检测结果\n")
            f.write("-" * 70 + "\n")
            peak = report['peak_analysis']
            f.write(f"  峰值阈值:          {peak['peak_threshold_db']:.1f} dB\n")
            f.write(f"  检测峰值总数:      {peak['total_peaks_detected']}\n")
            f.write(f"  重复峰值组数:      {peak['duplicate_peaks']['groups_count']}\n")
            f.write(f"  归并峰值数量:      {peak['duplicate_peaks']['merged_count']}\n\n")
            
            if peak['peaks_detail']:
                f.write(f"  {'序号':>4} {'频率(Hz)':>12} {'幅度(dB)':>10} {'相对幅度':>10} {'音符':>6}\n")
                f.write(f"  {'-'*4} {'-'*12} {'-'*10} {'-'*10} {'-'*6}\n")
                for p in peak['peaks_detail'][:15]:
                    f.write(f"  {p['index']:4d} {p['frequency']:12.2f} {p['magnitude_db']:10.2f} "
                            f"{p['relative_amplitude']:10.3f} {p['note']:>6}\n")
                if len(peak['peaks_detail']) > 15:
                    f.write(f"  ... (共 {len(peak['peaks_detail'])} 个峰值)\n")
            f.write("\n")
            
            f.write("-" * 70 + "\n")
            f.write("四、泛音分析结果\n")
            f.write("-" * 70 + "\n")
            harm = report['harmonic_analysis']
            f.write(f"  基频 (Fundamental): {harm['fundamental_frequency']:.2f} Hz\n")
            f.write(f"  基频对应音符:       {harm['fundamental_note']}\n")
            f.write(f"  基频幅度:           {harm['fundamental_magnitude_db']:.2f} dB\n")
            f.write(f"  泛音数量:           {harm['harmonic_count']}\n")
            f.write(f"  非泛音峰值数量:     {harm['inharmonic_count']}\n")
            f.write(f"  泛音识别容差:       ±{harm['fundamental_tolerance_percent']:.1f}%\n\n")
            
            if harm['harmonics_detail']:
                f.write(f"  {'谐波序':>6} {'频率(Hz)':>12} {'理想频率':>12} {'比率':>8} {'幅度(dB)':>10} {'类型':>10}\n")
                f.write(f"  {'-'*6} {'-'*12} {'-'*12} {'-'*8} {'-'*10} {'-'*10}\n")
                for h in harm['harmonics_detail'][:12]:
                    harm_num = h.get('harmonic_number')
                    harm_num_str = str(harm_num) if harm_num is not None else '-'
                    ideal_freq = h.get('ideal_frequency', h['frequency'])
                    ratio = h.get('frequency_ratio', 1.0)
                    f.write(f"  {harm_num_str:>6} {h['frequency']:12.2f} {ideal_freq:12.2f} "
                            f"{ratio:8.3f} {h['magnitude_db']:10.2f} {h['type']:>10}\n")
            f.write("\n")
            
            f.write("-" * 70 + "\n")
            f.write("五、警告信息汇总\n")
            f.write("-" * 70 + "\n")
            if report['warnings']:
                for i, w in enumerate(report['warnings'], 1):
                    f.write(f"  [{i}] [{w['category']}] {w['message']}\n")
            else:
                f.write("  无警告信息\n")
            f.write("\n")
            
            f.write("-" * 70 + "\n")
            f.write("六、处理决策记录\n")
            f.write("-" * 70 + "\n")
            if report['processing_decisions']:
                for i, d in enumerate(report['processing_decisions'], 1):
                    f.write(f"  [{i}] {d}\n")
            else:
                f.write("  无特殊处理决策\n")
            f.write("\n")
            
            f.write("-" * 70 + "\n")
            f.write("七、数据冲突与边界情况\n")
            f.write("-" * 70 + "\n")
            conflicts = report['intermediate_values']['conflicting_values']
            if conflicts:
                for i, c in enumerate(conflicts, 1):
                    f.write(f"\n  [{i}] {c['type']} (严重程度: {c['severity']})\n")
                    f.write(f"      描述: {c['description']}\n")
                    f.write(f"      证据: {json.dumps(c['evidence'], ensure_ascii=False)}\n")
            else:
                f.write("  未检测到明显的数据冲突\n")
            f.write("\n")
            
            f.write("=" * 70 + "\n")
            f.write("报告结束\n")
            f.write("=" * 70 + "\n")
        
        return filepath

    def print_report_summary(self, report: Dict[str, Any], files: Dict[str, str]) -> None:
        print("=" * 60)
        print("分析报告导出结果")
        print("=" * 60)
        for file_type, filepath in files.items():
            print(f"  {file_type:15s}: {filepath}")
        
        print(f"\n【报告摘要】")
        print(f"  分析时间: {report['timestamp']}")
        print(f"  基频检测: {report['harmonic_analysis']['fundamental_frequency']:.2f} Hz")
        print(f"  泛音数量: {report['harmonic_analysis']['harmonic_count']}")
        print(f"  警告数量: {len(report['warnings'])}")
        print(f"  数据冲突: {len(report['intermediate_values']['conflicting_values'])}")
        print("=" * 60)
