#!/usr/bin/env python3
import os
import sys
import argparse
from typing import Dict, Any

from audio_loader import AudioLoader
from spectrum_analyzer import SpectrumAnalyzer
from peak_analyzer import PeakAnalyzer
from chart_exporter import ChartExporter
from report_exporter import ReportExporter
from config import (
    DEFAULT_WINDOW_SIZE, DEFAULT_WINDOW_TYPE, DEFAULT_N_FFT,
    DEFAULT_PEAK_THRESHOLD, DEFAULT_FUNDAMENTAL_TOLERANCE,
    VALID_WINDOW_TYPES
)


class FourierToneAnalyzer:
    def __init__(self):
        self.audio_loader = AudioLoader()
        self.spectrum_analyzer = None
        self.peak_analyzer = None
        self.chart_exporter = ChartExporter()
        self.report_exporter = ReportExporter()
        
        self.audio_data = None
        self.sample_rate = 0
        self.audio_metadata = {}
        self.spectrum_results = {}
        self.peak_results = {}
        self.harmonic_results = {}
        self.merged_peaks = []
        
        self.analysis_params = {}

    def load_audio(self, file_path: str, normalize: bool = True, trim_silence: bool = False) -> bool:
        try:
            self.audio_data, self.sample_rate, self.audio_metadata = self.audio_loader.load(file_path)
            
            if trim_silence:
                self.audio_data = self.audio_loader.trim_silence(self.audio_data)
            
            if normalize:
                self.audio_data = self.audio_loader.normalize_audio(self.audio_data)
            
            self.audio_loader.print_info()
            return True
        except Exception as e:
            print(f"加载音频失败: {e}")
            return False

    def analyze_spectrum(self, window_size: int = DEFAULT_WINDOW_SIZE,
                         window_type: str = DEFAULT_WINDOW_TYPE,
                         n_fft: int = DEFAULT_N_FFT) -> bool:
        if self.audio_data is None:
            print("错误: 请先加载音频文件")
            return False

        try:
            self.spectrum_analyzer = SpectrumAnalyzer(
                sample_rate=self.sample_rate,
                window_size=window_size,
                window_type=window_type,
                n_fft=n_fft
            )
            
            self.spectrum_results = self.spectrum_analyzer.analyze(self.audio_data)
            self.spectrum_analyzer.print_analysis_info()
            
            self.analysis_params.update({
                'window_size': window_size,
                'window_type': window_type,
                'n_fft': n_fft
            })
            
            return True
        except Exception as e:
            print(f"频谱分析失败: {e}")
            return False

    def analyze_peaks(self, peak_threshold: float = DEFAULT_PEAK_THRESHOLD,
                      fundamental_tolerance: float = DEFAULT_FUNDAMENTAL_TOLERANCE,
                      merge_duplicates: bool = True) -> bool:
        if not self.spectrum_results:
            print("错误: 请先执行频谱分析")
            return False

        try:
            self.peak_analyzer = PeakAnalyzer(
                peak_threshold=peak_threshold,
                fundamental_tolerance=fundamental_tolerance
            )
            
            freqs = self.spectrum_results['frequencies']
            magnitude_db = self.spectrum_results['magnitude_db']
            magnitude_raw = self.spectrum_results['magnitude_raw']
            
            self.peak_results = self.peak_analyzer.detect_peaks(freqs, magnitude_db, magnitude_raw)
            
            if merge_duplicates and self.peak_results['peaks']:
                self.merged_peaks = self.peak_analyzer.merge_duplicate_peaks(self.peak_results['peaks'])
                self.peak_results['original_peaks'] = self.peak_results['peaks']
                self.peak_results['peaks'] = self.merged_peaks
                self.peak_results['peak_count'] = len(self.merged_peaks)
            
            self.harmonic_results = self.peak_analyzer.identify_harmonics(self.peak_results['peaks'])
            
            self.peak_analyzer.print_peak_info(self.peak_results, self.harmonic_results)
            
            self.analysis_params.update({
                'peak_threshold': peak_threshold,
                'fundamental_tolerance': fundamental_tolerance,
                'merge_duplicates': merge_duplicates
            })
            
            return True
        except Exception as e:
            print(f"峰值分析失败: {e}")
            import traceback
            traceback.print_exc()
            return False

    def export_charts(self, base_filename: str = 'analysis') -> Dict[str, str]:
        analysis_data = {
            'spectrum': self.spectrum_results,
            'peaks': self.peak_results,
            'harmonics': self.harmonic_results,
            'audio_data': self.audio_data,
            'sample_rate': self.sample_rate
        }
        
        exported = self.chart_exporter.export_all_charts(analysis_data, base_filename)
        self.chart_exporter.print_export_summary(exported)
        return exported

    def export_report(self, base_filename: str = 'analysis_report') -> Dict[str, str]:
        analysis_data = {
            'audio_metadata': self.audio_metadata,
            'audio_warnings': self.audio_loader.get_warnings(),
            'spectrum': self.spectrum_results,
            'spectrum_warnings': self.spectrum_analyzer.get_warnings() if self.spectrum_analyzer else [],
            'peaks': self.peak_results,
            'peak_warnings': self.peak_analyzer.get_warnings() if self.peak_analyzer else [],
            'harmonics': self.harmonic_results,
            'processing_decisions': self.peak_analyzer.get_decisions() if self.peak_analyzer else [],
            'window_type': self.analysis_params.get('window_type', DEFAULT_WINDOW_TYPE),
            'window_size': self.analysis_params.get('window_size', DEFAULT_WINDOW_SIZE),
            'peak_threshold': self.analysis_params.get('peak_threshold', DEFAULT_PEAK_THRESHOLD),
            'fundamental_tolerance': self.analysis_params.get('fundamental_tolerance', DEFAULT_FUNDAMENTAL_TOLERANCE)
        }
        
        report = self.report_exporter.generate_report(analysis_data)
        
        files = {
            'json': self.report_exporter.export_json_report(report, f'{base_filename}.json'),
            'text': self.report_exporter.export_text_report(report, f'{base_filename}.txt')
        }
        
        self.report_exporter.print_report_summary(report, files)
        return files

    def run_full_analysis(self, audio_file: str, 
                          window_size: int = DEFAULT_WINDOW_SIZE,
                          window_type: str = DEFAULT_WINDOW_TYPE,
                          n_fft: int = DEFAULT_N_FFT,
                          peak_threshold: float = DEFAULT_PEAK_THRESHOLD,
                          fundamental_tolerance: float = DEFAULT_FUNDAMENTAL_TOLERANCE,
                          normalize: bool = True,
                          trim_silence: bool = False,
                          output_prefix: str = 'analysis') -> bool:
        
        print("\n" + "=" * 60)
        print("傅里叶音色拆解 CLI - 完整分析")
        print("=" * 60 + "\n")
        
        if not self.load_audio(audio_file, normalize, trim_silence):
            return False
        
        print()
        if not self.analyze_spectrum(window_size, window_type, n_fft):
            return False
        
        print()
        if not self.analyze_peaks(peak_threshold, fundamental_tolerance):
            return False
        
        print()
        self.export_charts(output_prefix)
        
        print()
        self.export_report(output_prefix)
        
        print("\n" + "=" * 60)
        print("分析完成! 结果已导出至 output/ 目录")
        print("=" * 60)
        
        return True


def print_menu():
    print("\n" + "=" * 60)
    print("傅里叶音色拆解 CLI")
    print("=" * 60)
    print("  1. 加载音频文件")
    print("  2. 频谱分析 (FFT)")
    print("  3. 峰值检测与泛音分析")
    print("  4. 导出图表")
    print("  5. 导出分析报告")
    print("  6. 完整分析流程 (1-5)")
    print("  0. 退出")
    print("=" * 60)


def interactive_mode():
    analyzer = FourierToneAnalyzer()
    
    while True:
        print_menu()
        choice = input("\n请选择操作 (0-6): ").strip()
        
        if choice == '0':
            print("再见!")
            break
        
        elif choice == '1':
            file_path = input("请输入音频文件路径: ").strip()
            normalize = input("是否归一化? (Y/n): ").strip().lower() != 'n'
            trim = input("是否裁剪静音? (y/N): ").strip().lower() == 'y'
            analyzer.load_audio(file_path, normalize, trim)
        
        elif choice == '2':
            window_size = input(f"窗口大小 (默认 {DEFAULT_WINDOW_SIZE}): ").strip()
            window_size = int(window_size) if window_size else DEFAULT_WINDOW_SIZE
            
            print(f"可用窗函数: {', '.join(VALID_WINDOW_TYPES)}")
            window_type = input(f"窗函数类型 (默认 {DEFAULT_WINDOW_TYPE}): ").strip()
            window_type = window_type if window_type else DEFAULT_WINDOW_TYPE
            
            n_fft = input(f"FFT点数 (默认 {DEFAULT_N_FFT}): ").strip()
            n_fft = int(n_fft) if n_fft else DEFAULT_N_FFT
            
            analyzer.analyze_spectrum(window_size, window_type, n_fft)
        
        elif choice == '3':
            threshold = input(f"峰值阈值 (默认 {DEFAULT_PEAK_THRESHOLD}): ").strip()
            threshold = float(threshold) if threshold else DEFAULT_PEAK_THRESHOLD
            
            tolerance = input(f"泛音识别容差 (默认 {DEFAULT_FUNDAMENTAL_TOLERANCE}): ").strip()
            tolerance = float(tolerance) if tolerance else DEFAULT_FUNDAMENTAL_TOLERANCE
            
            merge = input("是否归并重复峰值? (Y/n): ").strip().lower() != 'n'
            
            analyzer.analyze_peaks(threshold, tolerance, merge)
        
        elif choice == '4':
            prefix = input("输出文件名前缀 (默认 analysis): ").strip()
            prefix = prefix if prefix else 'analysis'
            analyzer.export_charts(prefix)
        
        elif choice == '5':
            prefix = input("输出文件名前缀 (默认 analysis): ").strip()
            prefix = prefix if prefix else 'analysis'
            analyzer.export_report(prefix)
        
        elif choice == '6':
            file_path = input("请输入音频文件路径: ").strip()
            if not file_path:
                print("请提供有效的文件路径")
                continue
            
            prefix = input("输出文件名前缀 (默认 analysis): ").strip()
            prefix = prefix if prefix else 'analysis'
            
            analyzer.run_full_analysis(file_path, output_prefix=prefix)
        
        else:
            print("无效的选择，请重新输入")


def main():
    parser = argparse.ArgumentParser(
        description='傅里叶音色拆解 CLI - 分析音频频谱，识别基频与泛音',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s                  # 交互模式
  %(prog)s -i audio.wav     # 完整分析指定音频
  %(prog)s -i audio.wav -w 4096 -t hann  # 指定分析参数
        """
    )
    
    parser.add_argument('-i', '--input', type=str, help='输入音频文件路径')
    parser.add_argument('-o', '--output', type=str, default='analysis', help='输出文件前缀')
    parser.add_argument('-w', '--window-size', type=int, default=DEFAULT_WINDOW_SIZE, 
                        help=f'窗口大小 (默认: {DEFAULT_WINDOW_SIZE})')
    parser.add_argument('-t', '--window-type', type=str, default=DEFAULT_WINDOW_TYPE,
                        choices=VALID_WINDOW_TYPES,
                        help=f'窗函数类型 (默认: {DEFAULT_WINDOW_TYPE})')
    parser.add_argument('-n', '--n-fft', type=int, default=DEFAULT_N_FFT,
                        help=f'FFT点数 (默认: {DEFAULT_N_FFT})')
    parser.add_argument('-p', '--peak-threshold', type=float, default=DEFAULT_PEAK_THRESHOLD,
                        help=f'峰值检测阈值 (默认: {DEFAULT_PEAK_THRESHOLD})')
    parser.add_argument('-f', '--fundamental-tolerance', type=float, default=DEFAULT_FUNDAMENTAL_TOLERANCE,
                        help=f'泛音识别容差 (默认: {DEFAULT_FUNDAMENTAL_TOLERANCE})')
    parser.add_argument('--no-normalize', action='store_true', help='不进行音频归一化')
    parser.add_argument('--trim-silence', action='store_true', help='裁剪静音部分')
    
    args = parser.parse_args()
    
    if args.input:
        analyzer = FourierToneAnalyzer()
        success = analyzer.run_full_analysis(
            audio_file=args.input,
            window_size=args.window_size,
            window_type=args.window_type,
            n_fft=args.n_fft,
            peak_threshold=args.peak_threshold,
            fundamental_tolerance=args.fundamental_tolerance,
            normalize=not args.no_normalize,
            trim_silence=args.trim_silence,
            output_prefix=args.output
        )
        sys.exit(0 if success else 1)
    else:
        interactive_mode()


if __name__ == '__main__':
    main()
