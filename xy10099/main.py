import argparse
import os
from pathlib import Path
from typing import Optional

from config import config
from logger import get_logger
from data_loader import DataLoader, DataPreprocessor
from quality_control import QualityControl
from energy_calculator import EnergyCalculator
from anomaly_attribution import AnomalyAttribution
from report_generator import ReportGenerator
from exporter import Exporter


class AirCompressorAnalyzer:
    def __init__(self):
        self.logger = get_logger()
        self.loader = DataLoader()
        self.preprocessor = DataPreprocessor(self.loader)
        self.quality_control = QualityControl(self.loader)
        self.energy_calculator = EnergyCalculator(self.loader)
        self.attribution = AnomalyAttribution(self.loader)
        self.reporter = ReportGenerator(self.loader)
        self.exporter = Exporter(self.loader)
    
    def run_analysis(self, data_path: str, baseline_period: Optional[tuple] = None) -> dict:
        self.logger.log_info("=" * 60)
        self.logger.log_info("空压机能耗异常归因分析系统")
        self.logger.log_info("=" * 60)
        
        df = self.loader.load_data(data_path)
        if df.empty:
            self.logger.log_error("数据加载失败，程序终止")
            return {'success': False, 'error': '数据加载失败'}
        
        self.logger.log_info("\n--- 步骤1: 数据预处理")
        df = self.preprocessor.preprocess_datetime(df)
        df = self.preprocessor.standardize_units(df)
        df = self.preprocessor.convert_to_numeric(df)
        
        self.logger.log_info("\n--- 步骤2: 质量控制")
        df = self.quality_control.run_all_checks(df)
        qc_report = self.quality_control.get_qc_report()
        
        self.logger.log_info("\n--- 步骤3: 能耗计算")
        df = self.energy_calculator.calculate_specific_energy(df)
        df = self.energy_calculator.establish_baseline(df, baseline_period)
        df = self.energy_calculator.calculate_expected_energy(df)
        
        self.logger.log_info("\n--- 步骤4: 异常归因分析")
        attributions = self.attribution.analyze_anomalies(df)
        attribution_summary = self.attribution.get_attribution_summary()
        
        self.logger.log_info("\n--- 步骤5: 生成报告")
        calculation_log = self.energy_calculator.get_calculation_log()
        failed_samples = self.logger.get_failed_samples()
        
        report_path = self.reporter.generate_html_report(
            df=df,
            qc_report=qc_report,
            attributions=attributions,
            calculation_log=calculation_log,
            failed_samples=failed_samples
        )
        
        self.logger.log_info("\n--- 步骤6: 导出结果")
        exported_files = self.exporter.export_results(
            df=df,
            qc_report=qc_report,
            attributions=attributions,
            calculation_log=calculation_log
        )
        
        self._print_final_summary(
            df=df,
            attribution_summary=attribution_summary,
            failed_samples=failed_samples,
            report_path=report_path,
            exported_files=exported_files
        )
        
        return {
            'success': True,
            'dataframe': df,
            'attributions': attributions,
            'attribution_summary': attribution_summary,
            'report_path': report_path,
            'exported_files': exported_files,
            'failed_samples_count': len(failed_samples)
        }
    
    def _print_final_summary(self, df, attribution_summary, failed_samples, 
                            report_path, exported_files):
        self.logger.log_info("\n" + "=" * 60)
        self.logger.log_info("分析完成 - 最终摘要")
        self.logger.log_info("=" * 60)
        
        self.logger.log_info(f"\n📊 数据统计:")
        self.logger.log_info(f"  - 总记录数: {len(df)}")
        
        if '_is_anomaly' in df.columns:
            anomaly_count = int(df['_is_anomaly'].sum())
            self.logger.log_info(f"  - 异常记录数: {anomaly_count} ({anomaly_count/len(df)*100:.1f}%")
        
        if self.energy_calculator.specific_energy_baseline:
            self.logger.log_info(f"  - 单位能耗基准: {self.energy_calculator.specific_energy_baseline:.4f} kWh/m³")
        
        self.logger.log_info(f"\n🎯 归因分析:")
        self.logger.log_info(f"  - {attribution_summary['summary']}")
        if attribution_summary.get('primary_cause'):
            self.logger.log_info(f"  - 最可能原因: {attribution_summary['primary_cause']}")
        
        if failed_samples:
            self.logger.log_info(f"\n⚠️  质量控制问题:")
            from collections import Counter
            categories = Counter(s['category'] for s in failed_samples)
            for category, count in categories.most_common():
                self.logger.log_info(f"  - {category}: {count} 条")
        
        self.logger.log_info(f"\n📁 输出文件:")
        self.logger.log_info(f"  - HTML报告: {report_path}")
        for key, path in exported_files.items():
            self.logger.log_info(f"  - {key}: {path}")
        
        self.logger.log_info("\n" + "=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description='空压机能耗异常归因分析系统',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例用法:
  python main.py --data sample_data.xlsx
  python main.py --data data.csv --baseline 2024-01-01 2024-01-31
        '''
    )
    
    parser.add_argument('--data', '-d', type=str, required=True,
                       help='数据文件路径 (支持 .xlsx, .csv 格式')
    parser.add_argument('--baseline', '-b', type=str, nargs=2, default=None,
                       metavar=('START_DATE', 'END_DATE'),
                       help='基准期日期范围，用于建立能耗基准')
    parser.add_argument('--output', '-o', type=str, default=None,
                       help='输出目录')
    parser.add_argument('--generate-sample', '-g', action='store_true',
                       help='先生成示例数据再运行分析')
    
    args = parser.parse_args()
    
    if args.output:
        config.output_dir = args.output
    
    if args.generate_sample:
        from generate_sample_data import generate_sample_data
        sample_path = 'sample_data.xlsx'
        generate_sample_data(sample_path)
        args.data = sample_path
    
    if not os.path.exists(args.data):
        print(f"错误: 文件不存在: {args.data}")
        print("提示: 使用 --generate-sample 生成示例数据")
        return 1
    
    analyzer = AirCompressorAnalyzer()
    
    baseline_period = None
    if args.baseline:
        baseline_period = tuple(args.baseline)
    
    result = analyzer.run_analysis(args.data, baseline_period)
    
    return 0 if result.get('success') else 1


if __name__ == '__main__':
    import sys
    sys.exit(main())
