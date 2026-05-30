import os
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from typing import Dict, Any, List
from config import FREQ_LABELS


class ChartExporter:
    def __init__(self, output_dir: str = 'output'):
        self.output_dir = output_dir
        self._ensure_output_dir()
        plt.rcParams['font.sans-serif'] = ['DejaVu Sans', 'Arial Unicode MS']
        plt.rcParams['axes.unicode_minus'] = False

    def _ensure_output_dir(self) -> None:
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    def _add_freq_band_labels(self, ax) -> None:
        y_min, y_max = ax.get_ylim()
        colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
                  '#FFEAA7', '#DDA0DD', '#98D8C8']
        
        for i, (band, (freq_low, freq_high)) in enumerate(FREQ_LABELS.items()):
            ax.axvspan(freq_low, freq_high, alpha=0.1, color=colors[i % len(colors)])
            band_label = band.replace('_', ' ').title()
            ax.text((freq_low + freq_high) / 2, y_max - 2, band_label,
                    ha='center', va='top', fontsize=8, alpha=0.7)

    def export_spectrum_chart(self, freqs: np.ndarray, magnitude_db: np.ndarray,
                              peak_results: Dict = None, harmonic_results: Dict = None,
                              filename: str = 'spectrum.png',
                              title: str = 'Spectrum Analysis') -> str:
        fig, ax = plt.subplots(figsize=(14, 8))
        
        ax.plot(freqs, magnitude_db, linewidth=1.0, color='#3498db', label='Spectrum')
        
        ax.axhline(y=-60, color='gray', linestyle='--', alpha=0.5, linewidth=0.8, label='-60 dB')
        
        self._add_freq_band_labels(ax)
        
        if peak_results and 'peaks' in peak_results:
            peak_freqs = [p['frequency'] for p in peak_results['peaks'][:20]]
            peak_dbs = [p['magnitude_db'] for p in peak_results['peaks'][:20]]
            ax.scatter(peak_freqs, peak_dbs, color='red', s=50, zorder=5, 
                       label='Peaks', edgecolors='black', linewidth=0.5)
            
            for i, (freq, db) in enumerate(zip(peak_freqs[:10], peak_dbs[:10])):
                ax.annotate(f'{freq:.1f}Hz', (freq, db),
                           textcoords="offset points", xytext=(0, 10),
                           ha='center', fontsize=8, color='darkred')

        if harmonic_results and 'harmonics' in harmonic_results:
            harmonics = [h for h in harmonic_results['harmonics'] if h['type'] == 'harmonic']
            for h in harmonics[:8]:
                if h.get('harmonic_number') and h['harmonic_number'] <= 10:
                    ax.axvline(x=h['frequency'], color='green', linestyle=':', 
                               alpha=0.5, linewidth=1.0)
        
        ax.set_xlabel('频率 (Hz)', fontsize=12)
        ax.set_ylabel('幅度 (dB)', fontsize=12)
        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.set_xscale('log')
        ax.set_xlim(20, 20000)
        ax.set_ylim(-80, 5)
        ax.grid(True, which='both', linestyle='--', alpha=0.5)
        ax.legend(loc='upper right')
        
        ax.xaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'{int(x)}' if x < 1000 else f'{x/1000:.1f}k'))
        
        filepath = os.path.join(self.output_dir, filename)
        plt.tight_layout()
        plt.savefig(filepath, dpi=150, bbox_inches='tight')
        plt.close()
        
        return filepath

    def export_harmonic_chart(self, harmonic_results: Dict,
                              filename: str = 'harmonics.png',
                              title: str = 'Harmonic Structure Analysis') -> str:
        if not harmonic_results or 'harmonics' not in harmonic_results:
            raise ValueError("无效的泛音分析结果")

        harmonics = harmonic_results['harmonics']
        fund_freq = harmonic_results['fundamental']['frequency']
        
        harmonic_numbers = []
        amplitudes = []
        labels = []
        colors = []
        
        for h in harmonics:
            if h['type'] == 'fundamental':
                harmonic_numbers.append(1)
                amplitudes.append(h['magnitude_db'])
                labels.append(f'基频\n{h["frequency"]:.1f}Hz')
                colors.append('#27ae60')
            elif h['type'] == 'harmonic' and h.get('harmonic_number'):
                harmonic_numbers.append(h['harmonic_number'])
                amplitudes.append(h['magnitude_db'])
                labels.append(f'{h["harmonic_number"]}次\n{h["frequency"]:.1f}Hz')
                colors.append('#3498db')
            else:
                harmonic_numbers.append(h.get('frequency_ratio', 0) * 10)
                amplitudes.append(h['magnitude_db'])
                labels.append(f'非泛音\n{h["frequency"]:.1f}Hz')
                colors.append('#e74c3c')

        fig, ax = plt.subplots(figsize=(12, 7))
        
        bars = ax.bar(range(len(harmonic_numbers)), amplitudes, color=colors, alpha=0.8,
                      edgecolor='black', linewidth=0.5)
        
        for i, (bar, label) in enumerate(zip(bars, labels)):
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height + 1,
                    label, ha='center', va='bottom', fontsize=8, rotation=0)
        
        ax.set_xlabel('谐波序号', fontsize=12)
        ax.set_ylabel('幅度 (dB)', fontsize=12)
        ax.set_title(f'{title}\n基频: {fund_freq:.2f} Hz', fontsize=14, fontweight='bold')
        ax.set_ylim(-80, 10)
        ax.grid(True, axis='y', linestyle='--', alpha=0.5)
        
        from matplotlib.patches import Patch
        legend_elements = [
            Patch(facecolor='#27ae60', label='Fundamental'),
            Patch(facecolor='#3498db', label='Harmonic'),
            Patch(facecolor='#e74c3c', label='Inharmonic')
        ]
        ax.legend(handles=legend_elements, loc='upper right')
        
        ax.set_xticks(range(len(harmonic_numbers)))
        ax.set_xticklabels([str(h) if isinstance(h, int) else 'In' for h in harmonic_numbers])
        
        filepath = os.path.join(self.output_dir, filename)
        plt.tight_layout()
        plt.savefig(filepath, dpi=150, bbox_inches='tight')
        plt.close()
        
        return filepath

    def export_waveform_comparison(self, audio_data: np.ndarray,
                                    windowed_signal: np.ndarray,
                                    sample_rate: int,
                                    filename: str = 'waveform.png',
                                    title: str = 'Waveform Comparison') -> str:
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 8))
        
        time = np.arange(len(audio_data)) / sample_rate
        ax1.plot(time, audio_data, linewidth=0.5, color='#3498db')
        ax1.set_xlabel('Time (s)', fontsize=10)
        ax1.set_ylabel('Amplitude', fontsize=10)
        ax1.set_title('Original Audio Waveform', fontsize=12)
        ax1.grid(True, linestyle='--', alpha=0.3)
        
        time_windowed = np.arange(len(windowed_signal)) / sample_rate
        ax2.plot(time_windowed, windowed_signal, linewidth=0.5, color='#e74c3c')
        ax2.set_xlabel('Time (s)', fontsize=10)
        ax2.set_ylabel('Amplitude', fontsize=10)
        ax2.set_title('Windowed Signal (Analysis Frame)', fontsize=12)
        ax2.grid(True, linestyle='--', alpha=0.3)
        
        plt.suptitle(title, fontsize=14, fontweight='bold')
        plt.tight_layout()
        
        filepath = os.path.join(self.output_dir, filename)
        plt.savefig(filepath, dpi=150, bbox_inches='tight')
        plt.close()
        
        return filepath

    def export_phase_spectrum(self, freqs: np.ndarray, phase: np.ndarray,
                              filename: str = 'phase.png',
                              title: str = 'Phase Spectrum') -> str:
        fig, ax = plt.subplots(figsize=(14, 6))
        
        ax.plot(freqs, phase, linewidth=0.5, color='#9b59b6')
        ax.set_xlabel('Frequency (Hz)', fontsize=12)
        ax.set_ylabel('Phase (rad)', fontsize=12)
        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.set_xscale('log')
        ax.set_xlim(20, 20000)
        ax.grid(True, which='both', linestyle='--', alpha=0.5)
        ax.xaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'{int(x)}' if x < 1000 else f'{x/1000:.1f}k'))
        
        filepath = os.path.join(self.output_dir, filename)
        plt.tight_layout()
        plt.savefig(filepath, dpi=150, bbox_inches='tight')
        plt.close()
        
        return filepath

    def export_all_charts(self, analysis_data: Dict, 
                          base_filename: str = 'analysis') -> Dict[str, str]:
        exported_files = {}
        
        spectrum_data = analysis_data.get('spectrum', {})
        freqs = spectrum_data.get('frequencies', [])
        magnitude_db = spectrum_data.get('magnitude_db', [])
        phase = spectrum_data.get('phase', [])
        
        peak_results = analysis_data.get('peaks', {})
        harmonic_results = analysis_data.get('harmonics', {})
        
        if len(freqs) > 0 and len(magnitude_db) > 0:
            exported_files['spectrum'] = self.export_spectrum_chart(
                freqs, magnitude_db, peak_results, harmonic_results,
                filename=f'{base_filename}_spectrum.png'
            )

        if harmonic_results and harmonic_results.get('harmonics'):
            exported_files['harmonics'] = self.export_harmonic_chart(
                harmonic_results,
                filename=f'{base_filename}_harmonics.png'
            )

        audio_data = analysis_data.get('audio_data')
        windowed_signal = spectrum_data.get('intermediate', {}).get('windowed_signal')
        sample_rate = analysis_data.get('sample_rate', 44100)
        
        if audio_data is not None and windowed_signal is not None:
            exported_files['waveform'] = self.export_waveform_comparison(
                audio_data, windowed_signal, sample_rate,
                filename=f'{base_filename}_waveform.png'
            )

        if len(freqs) > 0 and len(phase) > 0:
            exported_files['phase'] = self.export_phase_spectrum(
                freqs, phase,
                filename=f'{base_filename}_phase.png'
            )

        return exported_files

    def print_export_summary(self, exported_files: Dict[str, str]) -> None:
        print("=" * 60)
        print("图表导出结果")
        print("=" * 60)
        for chart_type, filepath in exported_files.items():
            print(f"  {chart_type:15s}: {filepath}")
        print(f"\n共导出 {len(exported_files)} 个图表文件")
        print("=" * 60)
