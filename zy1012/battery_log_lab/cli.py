#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import os
import sys
from datetime import datetime
from typing import List, Optional

from battery_log_lab.parser import CSVParser, DataSet
from battery_log_lab.calculator import (
    TrapezoidalIntegrator,
    InternalResistanceEstimator,
)
from battery_log_lab.anomaly import AnomalyDetector, AnomalySeverity
from battery_log_lab.segmenter import Segmenter, get_segments_summary
from battery_log_lab.reporter import (
    AnalysisResult,
    save_report,
    _format_duration,
)


def run_analysis(
    csv_files: List[str],
    output_dir: str = "./reports",
    voltage_min: float = 2.5,
    voltage_max: float = 4.5,
    current_spike_threshold: float = 2000.0,
    verbose: bool = False,
) -> int:
    if not csv_files:
        print("错误: 没有指定输入文件")
        return 1
    
    parser = CSVParser()
    anomaly_detector = AnomalyDetector(
        voltage_min_v=voltage_min,
        voltage_max_v=voltage_max,
        current_spike_threshold_ma=current_spike_threshold,
    )
    segmenter = Segmenter()
    resistance_estimator = InternalResistanceEstimator()
    
    total_files = 0
    success_files = 0
    
    for csv_file in csv_files:
        total_files += 1
        
        if verbose:
            print(f"\n{'='*60}")
            print(f"正在分析: {csv_file}")
            print(f"{'='*60}")
        
        try:
            ds = parser.parse_file(csv_file)
        except Exception as e:
            print(f"错误: 无法解析文件 '{csv_file}': {e}")
            continue
        
        if not ds.has_valid_data or ds.row_count < 2:
            print(f"警告: 文件 '{csv_file}' 没有足够的有效数据点")
            continue
        
        if verbose:
            print(f"  数据点数: {ds.row_count}")
            print(f"  总时长: {_format_duration(ds.duration_seconds)}")
            print(f"  识别的列: {ds.mapped_headers}")
        
        try:
            integration_result = TrapezoidalIntegrator.integrate_full(
                ds.time, ds.current, ds.voltage
            )
            
            segments = segmenter.segment(
                ds.time, ds.current, ds.voltage, resistance_estimator
            )
            
            segments_summary = get_segments_summary(segments)
            
            anomalies = anomaly_detector.detect_all(
                ds.time, ds.current, ds.voltage,
                ds.mapped_headers, ds.parse_errors
            )
            
            anomaly_summary = anomaly_detector.get_anomaly_summary(anomalies)
            
            if verbose:
                print(f"  分段数: {len(segments)}")
                print(f"  异常数: {anomaly_summary['total']}")
                
                if segments_summary['charge']['count'] > 0:
                    print(f"  充电容量: {segments_summary['charge']['total_capacity_mah']:.2f} mAh")
                
                if segments_summary['discharge']['count'] > 0:
                    print(f"  放电容量: {segments_summary['discharge']['total_capacity_mah']:.2f} mAh")
                
                if segments_summary['efficiency_percent'] is not None:
                    print(f"  充放电效率: {segments_summary['efficiency_percent']:.1f}%")
                
                if segments_summary['avg_resistance_ohm'] is not None:
                    print(f"  估算内阻: {segments_summary['avg_resistance_ohm'] * 1000:.2f} mΩ")
            
            result = AnalysisResult(
                dataset=ds,
                integration_result=integration_result,
                segments=segments,
                segments_summary=segments_summary,
                anomalies=anomalies,
                anomaly_summary=anomaly_summary,
                generated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            )
            
            md_file, html_file = save_report(result, output_dir)
            
            success_files += 1
            
            print(f"\n  ✅ 分析完成!")
            print(f"     Markdown报告: {md_file}")
            print(f"     HTML报告:     {html_file}")
            
            if anomaly_summary['has_critical']:
                print(f"  ⚠️  检测到 {anomaly_summary['critical_count']} 个严重异常!")
            elif anomaly_summary['high_count'] > 0:
                print(f"  ⚠️  检测到 {anomaly_summary['high_count']} 个高优先级异常")
            
        except Exception as e:
            print(f"错误: 分析文件 '{csv_file}' 时出错: {e}")
            import traceback
            if verbose:
                traceback.print_exc()
    
    print(f"\n{'='*60}")
    print(f"处理完成: 成功 {success_files}/{total_files} 个文件")
    print(f"{'='*60}")
    
    return 0 if success_files == total_files else 1


def run_self_test() -> int:
    print("=" * 60)
    print("battery-log-lab 自检/测试")
    print("=" * 60)
    print()
    
    test_passed = 0
    test_total = 0
    
    print("【测试 1】 CSV 解析器测试")
    test_total += 1
    try:
        import tempfile
        import os
        
        test_csv_content = """时间,电流(mA),电压(V)
0,500,3.7
1,500,3.71
2,500,3.72
3,500,3.73
4,500,3.74
5,500,3.75
6,500,3.76
7,500,3.77
8,500,3.78
9,500,3.79
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write(test_csv_content)
            temp_csv = f.name
        
        try:
            parser = CSVParser()
            ds = parser.parse_file(temp_csv)
            
            assert ds.row_count == 10, f"期望10行数据, 实际{ds.row_count}"
            assert 'time' in ds.mapped_headers, "未识别时间列"
            assert 'current' in ds.mapped_headers, "未识别电流列"
            assert 'voltage' in ds.mapped_headers, "未识别电压列"
            assert ds.current[0] == 500.0, f"电流值异常: {ds.current[0]}"
            assert ds.voltage[0] == 3.7, f"电压值异常: {ds.voltage[0]}"
            
            print(f"  ✅ 通过: 解析了 {ds.row_count} 行数据")
            test_passed += 1
        finally:
            os.unlink(temp_csv)
            
    except Exception as e:
        print(f"  ❌ 失败: {e}")
    
    print()
    print("【测试 2】 梯形积分计算测试")
    test_total += 1
    try:
        time = [0, 1, 2, 3, 4]
        current = [1000, 1000, 1000, 1000, 1000]
        voltage = [3.7, 3.7, 3.7, 3.7, 3.7]
        
        result = TrapezoidalIntegrator.integrate_full(time, current, voltage)
        
        expected_capacity = (1000 * 4) / 3600
        expected_energy = (3.7 * 1000 * 4) / (3600 * 1000)
        
        assert abs(result.capacity_mah - expected_capacity) < 0.01, \
            f"容量计算错误: 期望 {expected_capacity:.4f}, 实际 {result.capacity_mah:.4f}"
        
        assert abs(result.energy_wh - expected_energy) < 0.0001, \
            f"能量计算错误: 期望 {expected_energy:.6f}, 实际 {result.energy_wh:.6f}"
        
        print(f"  ✅ 通过: 容量 {result.capacity_mah:.4f} mAh, 能量 {result.energy_wh:.6f} Wh")
        test_passed += 1
        
    except Exception as e:
        print(f"  ❌ 失败: {e}")
    
    print()
    print("【测试 3】 分段器测试")
    test_total += 1
    try:
        n_points = 30
        time = list(range(n_points))
        
        current = []
        for i in range(n_points):
            if i < 8:
                current.append(1000)
            elif i < 15:
                current.append(0)
            elif i < 23:
                current.append(-500)
            else:
                current.append(0)
        
        voltage = [3.7 + i * 0.01 for i in range(n_points)]
        
        segmenter = Segmenter(current_threshold_ma=50.0)
        segments = segmenter.segment(time, current, voltage)
        
        charge_segments = [s for s in segments if s.is_charge]
        discharge_segments = [s for s in segments if s.is_discharge]
        
        assert len(charge_segments) >= 1, "未识别充电段"
        assert len(discharge_segments) >= 1, "未识别放电段"
        
        print(f"  ✅ 通过: 识别了 {len(segments)} 个分段")
        print(f"         - 充电段: {len(charge_segments)}")
        print(f"         - 放电段: {len(discharge_segments)}")
        test_passed += 1
        
    except Exception as e:
        print(f"  ❌ 失败: {e}")
    
    print()
    print("【测试 4】 异常检测测试")
    test_total += 1
    try:
        time = [0, 1, 2, 1, 3, 4, 5]
        current = [500, 500, 5000, 500, 500, 500, 500]
        voltage = [3.7, 3.7, 3.7, 3.7, 3.7, 5.0, 3.7]
        
        detector = AnomalyDetector(
            voltage_min_v=2.5,
            voltage_max_v=4.5,
            current_spike_threshold_ma=2000,
            current_spike_window=1,
        )
        
        anomalies = detector.detect_all(
            time, current, voltage,
            {'time': 'time', 'current': 'current', 'voltage': 'voltage'},
            []
        )
        
        anomaly_summary = detector.get_anomaly_summary(anomalies)
        
        assert len(anomalies) >= 2, f"期望至少2个异常, 实际{len(anomalies)}"
        
        print(f"  ✅ 通过: 检测到 {anomaly_summary['total']} 个异常")
        test_passed += 1
        
    except Exception as e:
        print(f"  ❌ 失败: {e}")
    
    print()
    print("【测试 5】 报告生成测试")
    test_total += 1
    try:
        import tempfile
        import os
        
        time = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
        current = [500 for _ in range(10)]
        voltage = [3.7 + i * 0.01 for i in range(10)]
        
        integration_result = TrapezoidalIntegrator.integrate_full(time, current, voltage)
        
        segmenter = Segmenter()
        segments = segmenter.segment(time, current, voltage)
        segments_summary = get_segments_summary(segments)
        
        detector = AnomalyDetector()
        anomalies = detector.detect_all(
            time, current, voltage,
            {'time': 'time', 'current': 'current', 'voltage': 'voltage'},
            []
        )
        anomaly_summary = detector.get_anomaly_summary(anomalies)
        
        ds = DataSet(
            filename="test.csv",
            source_headers=["time", "current", "voltage"],
            mapped_headers={'time': 'time', 'current': 'current', 'voltage': 'voltage'},
            time=time,
            current=current,
            voltage=voltage,
        )
        
        result = AnalysisResult(
            dataset=ds,
            integration_result=integration_result,
            segments=segments,
            segments_summary=segments_summary,
            anomalies=anomalies,
            anomaly_summary=anomaly_summary,
            generated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        )
        
        with tempfile.TemporaryDirectory() as temp_dir:
            md_file, html_file = save_report(result, temp_dir)
            
            assert os.path.exists(md_file), f"Markdown文件未生成: {md_file}"
            assert os.path.exists(html_file), f"HTML文件未生成: {html_file}"
            
            with open(md_file, 'r', encoding='utf-8') as f:
                md_content = f.read()
                assert "电池日志分析报告" in md_content, "报告标题缺失"
            
            with open(html_file, 'r', encoding='utf-8') as f:
                html_content = f.read()
                assert "<!DOCTYPE html>" in html_content, "HTML格式错误"
            
            print(f"  ✅ 通过: 报告生成成功")
            print(f"         - Markdown: {md_file}")
            print(f"         - HTML: {html_file}")
            test_passed += 1
            
    except Exception as e:
        print(f"  ❌ 失败: {e}")
        import traceback
        traceback.print_exc()
    
    print()
    print("=" * 60)
    print(f"自检结果: {test_passed}/{test_total} 测试通过")
    print("=" * 60)
    
    if test_passed == test_total:
        print()
        print("🎉 所有测试通过! 工具已就绪。")
        return 0
    else:
        print()
        print(f"⚠️  {test_total - test_passed} 个测试失败，请检查环境配置。")
        return 1


def main():
    parser = argparse.ArgumentParser(
        prog='battery-log-lab',
        description='电池充放电日志分析工具 - 分析USB电表导出的CSV数据',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  # 分析单个CSV文件
  battery-log-lab log.csv -o ./reports
  
  # 分析多个CSV文件
  battery-log-lab charge.csv discharge.csv -o ./reports
  
  # 自定义电压阈值
  battery-log-lab log.csv --voltage-min 2.0 --voltage-max 4.8
  
  # 运行自检
  battery-log-lab --self-test
        """,
    )
    
    parser.add_argument(
        'csv_files',
        nargs='*',
        help='一个或多个CSV文件路径',
    )
    
    parser.add_argument(
        '-o', '--output',
        dest='output_dir',
        default='./reports',
        help='输出目录 (默认: ./reports)',
    )
    
    parser.add_argument(
        '--voltage-min',
        type=float,
        default=2.5,
        help='电压下限阈值 (默认: 2.5V)',
    )
    
    parser.add_argument(
        '--voltage-max',
        type=float,
        default=4.5,
        help='电压上限阈值 (默认: 4.5V)',
    )
    
    parser.add_argument(
        '--spike-threshold',
        type=float,
        default=2000.0,
        help='电流尖峰检测阈值 (默认: 2000mA)',
    )
    
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='显示详细输出',
    )
    
    parser.add_argument(
        '--self-test',
        action='store_true',
        help='运行自检/测试命令',
    )
    
    parser.add_argument(
        '--version',
        action='version',
        version='battery-log-lab 1.0.0',
    )
    
    args = parser.parse_args()
    
    if args.self_test:
        sys.exit(run_self_test())
    
    if not args.csv_files:
        parser.print_help()
        sys.exit(1)
    
    sys.exit(
        run_analysis(
            csv_files=args.csv_files,
            output_dir=args.output_dir,
            voltage_min=args.voltage_min,
            voltage_max=args.voltage_max,
            current_spike_threshold=args.spike_threshold,
            verbose=args.verbose,
        )
    )
