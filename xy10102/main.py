import os
import sys
import argparse
import traceback
import pandas as pd
from datetime import datetime
from typing import Optional


class PipelineRunner:
    def __init__(self, config_path: Optional[str] = None):
        from charging_forecast.config import load_config
        from charging_forecast.data_loader import DataLoader
        from charging_forecast.quality_control import QualityController
        from charging_forecast.feature_engineer import FeatureEngineer
        from charging_forecast.predictor import LoadPredictor
        from charging_forecast.report import ReportGenerator
        from charging_forecast.exporter import ResultExporter
        
        self.config = load_config(config_path)
        self.data_loader = DataLoader(self.config)
        self.quality_controller = QualityController(self.config)
        self.feature_engineer = FeatureEngineer(self.config)
        self.predictor = LoadPredictor(self.config)
        self.report_generator = ReportGenerator(self.config)
        self.exporter = ResultExporter(self.config)
        
        self.output_dir = self.config.data.output_dir
        os.makedirs(self.output_dir, exist_ok=True)
    
    def run(self, input_path: Optional[str] = None,
            output_prefix: str = "") -> dict:
        
        print("=" * 60)
        print("  充电站负荷峰谷预测系统")
        print(f"  运行时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)
        
        results = {}
        log_messages = []
        
        try:
            print("\n[1/5] 正在加载数据...")
            loaded_data = self.data_loader.load(input_path)
            print(f"    ✓ 成功加载 {len(loaded_data.raw_data)} 条记录")
            log_messages.append(f"数据加载: {len(loaded_data.raw_data)} 条记录")
            results['loaded_data'] = loaded_data
            
            print("\n[2/5] 正在执行质量控制...")
            qc_result = self.quality_controller.validate(loaded_data.data)
            print(f"    ✓ 有效记录: {qc_result.summary['clean_records']} 条")
            print(f"    ✓ 无效记录: {qc_result.summary['failed_records']} 条")
            print(f"    ✓ 有效率: {(qc_result.summary['clean_records'] / qc_result.summary['total_records'] * 100):.2f}%")
            
            if qc_result.failures:
                failure_types = {}
                for f in qc_result.failures:
                    failure_types[f.failure_type] = failure_types.get(f.failure_type, 0) + 1
                print(f"    ✓ 异常类型分布: {failure_types}")
            
            log_messages.append(f"质量控制: {qc_result.summary['clean_records']} 有效 / {qc_result.summary['failed_records']} 无效")
            results['qc_result'] = qc_result
            
            if len(qc_result.cleaned_data) < 100:
                print("    ⚠ 警告: 有效数据量较少，可能影响预测精度")
            
            print("\n[3/5] 正在构建特征...")
            feature_result = self.feature_engineer.transform(qc_result.cleaned_data)
            print(f"    ✓ 生成特征数量: {len(feature_result.feature_names)}")
            print(f"    ✓ 可用样本数: {len(feature_result.features)}")
            log_messages.append(f"特征工程: {len(feature_result.feature_names)} 个特征")
            results['feature_result'] = feature_result
            
            if len(feature_result.features) < 50:
                raise ValueError("特征数量不足，无法进行预测")
            
            print("\n[4/5] 正在训练预测模型...")
            timestamps = None
            if feature_result.timestamps is not None:
                test_size = self.config.model.test_size
                n_samples = len(feature_result.features)
                n_test = int(n_samples * test_size)
                if len(feature_result.timestamps) >= n_test:
                    timestamps = feature_result.timestamps.iloc[-n_test:].values
            
            prediction = self.predictor.train(feature_result, timestamps)
            print(f"    ✓ RMSE: {prediction.metrics.get('rmse', 'N/A'):.4f}")
            print(f"    ✓ MAE: {prediction.metrics.get('mae', 'N/A'):.4f}")
            print(f"    ✓ R²: {prediction.metrics.get('r2', 'N/A'):.4f}")
            log_messages.append(f"模型评估: RMSE={prediction.metrics.get('rmse', 'N/A'):.4f}")
            results['prediction'] = prediction
            
            print("\n[5/5] 正在生成报告...")
            report_output = self.report_generator.generate(
                loaded_data.raw_data,
                qc_result,
                prediction,
                self.output_dir
            )
            print(f"    ✓ 生成图表: {len(report_output.charts)} 个")
            print(f"    ✓ 生成表格: {len(report_output.tables)} 个")
            log_messages.append(f"报告生成: {len(report_output.charts)} 图表, {len(report_output.tables)} 表格")
            results['report'] = report_output
            
            print("\n[导出] 正在导出结果...")
            export_paths = self.exporter.export_all(
                report_output,
                qc_result,
                prediction,
                self.output_dir,
                output_prefix
            )
            print("    ✓ 导出完成:")
            for name, path in export_paths.items():
                if isinstance(path, dict):
                    for sub_name, sub_path in path.items():
                        print(f"      - {sub_name}: {sub_path}")
                else:
                    print(f"      - {name}: {path}")
            results['exports'] = export_paths
            
            print("\n" + "=" * 60)
            print("  ✓ 预测流程完成!")
            print(f"  输出目录: {os.path.abspath(self.output_dir)}")
            print("=" * 60)
            
            self._save_log(log_messages, success=True)
            results['success'] = True
            
        except Exception as e:
            error_msg = f"错误: {str(e)}"
            traceback_str = traceback.format_exc()
            
            print(f"\n✗ {error_msg}")
            print("\n详细错误信息:")
            print(traceback_str)
            
            log_messages.append(error_msg)
            log_messages.append(traceback_str)
            self._save_log(log_messages, success=False)
            
            results['success'] = False
            results['error'] = str(e)
            results['traceback'] = traceback_str
            
            if 'qc_result' in results and results['qc_result'].failures:
                self._export_failures_only(results['qc_result'])
        
        return results
    
    def _save_log(self, messages: list, success: bool):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        status = "success" if success else "failed"
        log_path = os.path.join(self.output_dir, f"run_{timestamp}_{status}.log")
        
        with open(log_path, 'w', encoding='utf-8') as f:
            f.write(f"充电站负荷预测运行日志\n")
            f.write(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"状态: {'成功' if success else '失败'}\n")
            f.write("=" * 60 + "\n\n")
            
            for msg in messages:
                f.write(f"{msg}\n\n")
        
        print(f"    ✓ 日志已保存: {log_path}")
    
    def _export_failures_only(self, qc_result):
        failures_df = pd.DataFrame([{
            '原始行号': f.row_index,
            '列名': f.column,
            '值': str(f.value),
            '异常类型': f.failure_type,
            '原因': f.reason
        } for f in qc_result.failures])
        path = os.path.join(self.output_dir, "failures_recovered.xlsx")
        failures_df.to_excel(path, index=False)
        print(f"    ✓ 失败样本已保存: {path}")


def main():
    parser = argparse.ArgumentParser(
        description="充电站负荷峰谷预测系统",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python main.py --input data/charging_data.csv
  python main.py --config custom_config.yaml
  python main.py --input data.csv --prefix station01
        """
    )
    
    parser.add_argument(
        "--input", "-i",
        type=str,
        help="输入数据文件路径 (CSV 或 Excel)"
    )
    parser.add_argument(
        "--config", "-c",
        type=str,
        help="配置文件路径 (YAML)"
    )
    parser.add_argument(
        "--prefix", "-p",
        type=str,
        default="",
        help="输出文件前缀"
    )
    
    args = parser.parse_args()
    
    runner = PipelineRunner(args.config)
    results = runner.run(args.input, args.prefix)
    
    sys.exit(0 if results.get('success') else 1)


if __name__ == "__main__":
    main()
