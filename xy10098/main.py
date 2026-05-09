import os
import sys
import argparse
from datetime import datetime

from data_loader import DataLoader
from preprocessor import DataPreprocessor
from quality_control import QualityControl
from irrigation_simulator import IrrigationSimulator
from report_generator import ReportGenerator
from data_exporter import DataExporter


class IrrigationThresholdPipeline:
    def __init__(self, threshold_low=None, threshold_high=None, noise_level=0.05):
        self.loader = DataLoader()
        self.preprocessor = DataPreprocessor()
        self.quality_control = QualityControl()
        self.simulator = IrrigationSimulator(threshold_low, threshold_high)
        self.report_generator = ReportGenerator()
        self.exporter = DataExporter()
        self.noise_level = noise_level
    
    def run(self, data_source=None, use_sample=True, output_prefix=None):
        print("=" * 70)
        print("温室灌溉阈值模拟系统")
        print(f"运行时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 70)
        
        if output_prefix is None:
            output_prefix = f"irrigation_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        print("\n[1/6] 加载数据...")
        df = self._load_data(data_source, use_sample)
        print(f"   原始数据样本数: {len(df)}")
        
        print("\n[2/6] 数据预处理...")
        preprocess_result = self.preprocessor.preprocess(df)
        self._print_preprocess_stats(preprocess_result)
        
        if preprocess_result['valid_count'] == 0:
            print("\n错误: 预处理后没有有效数据，无法继续")
            return self._create_empty_result(output_prefix)
        
        print("\n[3/6] 质量控制...")
        qc_result = self.quality_control.run_qc(preprocess_result['processed_data'])
        self._print_qc_stats(qc_result)
        
        pipeline_result = {
            **preprocess_result,
            'qc_result': qc_result
        }
        
        if qc_result['passed_count'] == 0:
            print("\n警告: 质控后没有有效数据，跳过模拟")
            return self._export_results(pipeline_result, {'simulation_data': None, 'statistics': {}}, output_prefix)
        
        print("\n[4/6] 灌溉阈值模拟...")
        simulation_result = self.simulator.simulate(qc_result['passed_data'], self.noise_level)
        self._print_simulation_stats(simulation_result)
        
        print("\n[5/6] 生成报告...")
        report_files = self.report_generator.generate_all_reports(pipeline_result, simulation_result, output_prefix)
        print(f"   生成报告文件: {len(report_files)} 个")
        for f in report_files:
            print(f"      - {f}")
        
        print("\n[6/6] 导出数据...")
        exported_files = self.exporter.export_all(pipeline_result, simulation_result, output_prefix)
        print(f"   导出数据文件: {len(exported_files)} 个")
        for f in exported_files:
            print(f"      - {f}")
        
        print("\n" + "=" * 70)
        print("处理完成!")
        print("=" * 70)
        
        return {
            'success': True,
            'output_prefix': output_prefix,
            'pipeline_result': pipeline_result,
            'simulation_result': simulation_result,
            'report_files': report_files,
            'exported_files': exported_files
        }
    
    def _load_data(self, data_source, use_sample):
        if data_source:
            print(f"   从文件加载: {data_source}")
            return self.loader.load_data(data_source)
        elif use_sample:
            print("   使用内置示例数据")
            return self.loader.load_sample_data()
        else:
            raise ValueError("必须提供数据来源或启用示例数据")
    
    def _print_preprocess_stats(self, result):
        stats = result['statistics']
        print(f"   原始样本数: {result['original_count']}")
        print(f"   有效样本数: {result['valid_count']}")
        print(f"   失败样本数: {result['failed_count']}")
        
        if stats.get('duplicates_removed', 0) > 0:
            print(f"   - 移除重复数据: {stats['duplicates_removed']} 条")
        if stats.get('timestamp_failed', 0) > 0:
            print(f"   - 时间戳问题: {stats['timestamp_failed']} 条")
        if stats.get('unit_failed', 0) > 0:
            print(f"   - 单位问题: {stats['unit_failed']} 条")
        if stats.get('missing_values_failed', 0) > 0:
            print(f"   - 缺失值问题: {stats['missing_values_failed']} 条")
    
    def _print_qc_stats(self, qc_result):
        report = qc_result['quality_report']
        print(f"   总样本数: {report['total_samples']}")
        print(f"   通过样本数: {report['passed_samples']}")
        print(f"   失败样本数: {report['failed_samples']}")
        print(f"   通过率: {report['pass_rate']*100:.2f}%")
        
        if report.get('range_failures', 0) > 0:
            print(f"   - 范围验证失败: {report['range_failures']} 条")
        if report.get('anomaly_failures', 0) > 0:
            print(f"   - 异常值检测: {report['anomaly_failures']} 条")
        if report.get('consistency_failures', 0) > 0:
            print(f"   - 一致性检查失败: {report['consistency_failures']} 条")
        
        if qc_result['failed_records']:
            print("\n   失败样本详情:")
            for i, record in enumerate(qc_result['failed_records'][:5], 1):
                print(f"      {i}. [{record['category']}] {record['reason']}")
            if len(qc_result['failed_records']) > 5:
                print(f"      ... 还有 {len(qc_result['failed_records']) - 5} 条失败记录")
    
    def _print_simulation_stats(self, result):
        stats = result['statistics']
        print(f"   阈值设置: 低={stats['threshold_low']}%, 高={stats['threshold_high']}%")
        print(f"   噪声水平: {stats['noise_level']}")
        print(f"   模拟样本数: {stats['total_samples']}")
        print(f"   灌溉开启次数: {stats['irrigation_activated']}")
        print(f"   过灌风险: {stats['over_irrigation_risk']}")
        print(f"   漏灌风险: {stats['under_irrigation_risk']}")
        print(f"   湿度范围: {stats['min_humidity']:.2f}% - {stats['max_humidity']:.2f}%")
    
    def _create_empty_result(self, output_prefix):
        return {
            'success': False,
            'output_prefix': output_prefix,
            'message': '没有有效数据进行模拟'
        }
    
    def _export_results(self, pipeline_result, simulation_result, output_prefix):
        report_files = self.report_generator.generate_all_reports(pipeline_result, simulation_result, output_prefix)
        exported_files = self.exporter.export_all(pipeline_result, simulation_result, output_prefix)
        
        return {
            'success': False,
            'output_prefix': output_prefix,
            'pipeline_result': pipeline_result,
            'simulation_result': simulation_result,
            'report_files': report_files,
            'exported_files': exported_files,
            'message': '模拟因数据问题跳过，但报告已生成'
        }


def main():
    parser = argparse.ArgumentParser(description='温室灌溉阈值模拟系统')
    parser.add_argument('--input', '-i', type=str, help='输入数据文件路径 (CSV或Excel)')
    parser.add_argument('--threshold-low', '-l', type=float, default=30.0, help='低灌溉阈值 (默认: 30%%)')
    parser.add_argument('--threshold-high', '-H', type=float, default=70.0, help='高灌溉阈值 (默认: 70%%)')
    parser.add_argument('--noise-level', '-n', type=float, default=0.05, help='噪声水平 (默认: 0.05)')
    parser.add_argument('--output-prefix', '-o', type=str, help='输出文件前缀')
    parser.add_argument('--sample', action='store_true', default=True, help='使用示例数据 (默认)')
    parser.add_argument('--no-sample', action='store_true', help='不使用示例数据')
    
    args = parser.parse_args()
    
    use_sample = args.sample and not args.no_sample
    
    if not args.input and not use_sample:
        print("错误: 必须提供输入文件 (--input) 或使用示例数据 (--sample)")
        sys.exit(1)
    
    pipeline = IrrigationThresholdPipeline(
        threshold_low=args.threshold_low,
        threshold_high=args.threshold_high,
        noise_level=args.noise_level
    )
    
    result = pipeline.run(
        data_source=args.input,
        use_sample=use_sample,
        output_prefix=args.output_prefix
    )
    
    if result.get('success'):
        print("\n" + "=" * 70)
        print("结果摘要")
        print("=" * 70)
        print(f"输出前缀: {result['output_prefix']}")
        print(f"报告文件: {len(result['report_files'])} 个")
        print(f"导出文件: {len(result['exported_files'])} 个")
    else:
        print(f"\n警告: {result.get('message', '处理未完成')}")
    
    return 0 if result.get('success', True) else 1


if __name__ == '__main__':
    sys.exit(main())
