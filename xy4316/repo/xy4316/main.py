import os
import sys
import argparse
from datetime import datetime
from typing import Optional, Dict, Any

from data_parser import DataParser, CalibrationDataset, FlowmeterData, ConcentrationRecord, TitrationResult
from units import unit_converter, dosage_calculator
from fitting import curve_fitter, FittingResult, PumpSpeedRecommendation
from anomaly_detection import anomaly_detector, AnomalyReport
from report import report_exporter, CalibrationSummary


def parse_arguments():
    parser = argparse.ArgumentParser(
        description='加药泵周校准科学计算工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例用法:
  python main.py --flowmeter data/flowmeter.csv --concentration data/concentration.txt --titration data/titration.csv
  python main.py --flowmeter data/flowmeter.csv --concentration data/concentration.txt --target-conc 5.0
  python main.py --example --output ./output
        '''
    )
    
    parser.add_argument('--flowmeter', type=str, help='流量计CSV数据文件路径')
    parser.add_argument('--concentration', type=str, help='浓度记录文件路径 (CSV或TXT)')
    parser.add_argument('--titration', type=str, help='滴定结果CSV文件路径')
    
    parser.add_argument('--target-conc', type=float, help='目标浓度 (mg/L)，用于计算推荐泵速')
    parser.add_argument('--target-flow', type=float, help='目标流量 (L/h)，直接指定目标流量')
    
    parser.add_argument('--model', type=str, default='linear',
                        choices=['linear', 'quadratic', 'power', 'exponential'],
                        help='拟合模型类型 (默认: linear)')
    parser.add_argument('--confidence', type=float, default=0.95,
                        help='置信水平 (默认: 0.95)')
    parser.add_argument('--auto-select-model', action='store_true',
                        help='自动选择最优拟合模型')
    
    parser.add_argument('--output', type=str, default='./output',
                        help='输出目录路径 (默认: ./output)')
    parser.add_argument('--prefix', type=str, default='',
                        help='输出文件前缀')
    
    parser.add_argument('--pump-id', type=str, default='', help='泵编号')
    parser.add_argument('--pump-name', type=str, default='', help='泵名称')
    parser.add_argument('--operator', type=str, default='', help='操作人员')
    
    parser.add_argument('--example', action='store_true', help='使用示例数据运行演示')
    parser.add_argument('--verbose', '-v', action='store_true', help='显示详细输出')
    parser.add_argument('--no-report', action='store_true', help='不生成报告文件')
    parser.add_argument('--no-csv', action='store_true', help='不导出CSV参数表')
    
    return parser.parse_args()


def generate_sample_data() -> Dict[str, Any]:
    import numpy as np
    
    np.random.seed(42)
    
    pump_speeds = np.array([10.0, 15.0, 20.0, 25.0, 30.0, 35.0, 40.0, 45.0, 50.0])
    
    true_slope = 0.12
    true_intercept = 0.5
    noise = np.random.normal(0, 0.15, size=len(pump_speeds))
    flow_rates = true_slope * pump_speeds + true_intercept + noise
    
    flow_rates[3] += 0.8
    
    return {
        'pump_speeds': pump_speeds,
        'flow_rates': flow_rates,
        'stock_concentration': 10000.0,
        'stock_concentration_unit': 'mg/L',
        'target_concentration': 5.0,
        'target_concentration_unit': 'mg/L',
        'titration_results': [
            {'pump_speed': 20.0, 'measured_concentration': 4.8},
            {'pump_speed': 30.0, 'measured_concentration': 7.2},
            {'pump_speed': 40.0, 'measured_concentration': 9.5},
        ]
    }


def run_calibration(
    flowmeter_data: FlowmeterData,
    concentration_record: ConcentrationRecord,
    titration_results: list,
    model_type: str = 'linear',
    confidence_level: float = 0.95,
    auto_select_model: bool = False,
    target_concentration: Optional[float] = None,
    target_flow: Optional[float] = None,
    verbose: bool = False
) -> Dict[str, Any]:
    
    if verbose:
        print(f"数据点数: {flowmeter_data.n_points}")
        print(f"泵速范围: {flowmeter_data.pump_speed_range[0]:.1f} - {flowmeter_data.pump_speed_range[1]:.1f} Hz")
        print(f"流量范围: {flowmeter_data.flow_rate_range[0]:.4f} - {flowmeter_data.flow_rate_range[1]:.4f} L/h")
        print()
    
    x = flowmeter_data.pump_speed
    y = flowmeter_data.flow_rate
    
    if auto_select_model:
        if verbose:
            print("正在比较多个拟合模型...")
        
        model_results = curve_fitter.compare_models(
            x, y,
            models=['linear', 'quadratic', 'power'],
            confidence_level=confidence_level
        )
        
        best_model, fitting_result = curve_fitter.select_best_model(model_results)
        
        if verbose:
            print(f"  线性模型 R²: {model_results['linear'].r_squared:.6f}")
            print(f"  二次模型 R²: {model_results['quadratic'].r_squared:.6f}")
            if 'power' in model_results:
                print(f"  幂函数模型 R²: {model_results['power'].r_squared:.6f}")
            print(f"选择最优模型: {best_model}")
    else:
        if verbose:
            print(f"使用指定模型: {model_type}")
        
        fitting_result = curve_fitter.fit(
            x, y,
            model_type=model_type,
            confidence_level=confidence_level
        )
    
    if verbose:
        print()
        print("=" * 50)
        print("拟合结果")
        print("=" * 50)
        print(f"模型类型: {fitting_result.model_type}")
        print(f"R²: {fitting_result.r_squared:.6f}")
        print(f"调整R²: {fitting_result.adjusted_r_squared:.6f}")
        print(f"RMSE: {fitting_result.rmse:.6f}")
        print(f"MAE: {fitting_result.mae:.6f}")
        print()
        print("模型参数:")
        param_info = fitting_result.get_param_info()
        for name, info in param_info.items():
            se = f"± {info['std_error']:.6f}" if info['std_error'] else ""
            print(f"  {name}: {info['value']:.6f} {se}")
    
    if verbose:
        print()
        print("=" * 50)
        print("异常检测")
        print("=" * 50)
    
    anomaly_report = anomaly_detector.detect(
        x, y, fitting_result.residuals,
        method='ensemble',
        confidence_level=confidence_level
    )
    
    if verbose:
        print(f"总数据点: {anomaly_report.total_points}")
        print(f"异常点数量: {anomaly_report.anomaly_count}")
        print(f"正常点数量: {anomaly_report.normal_count}")
        print(f"数据状态: {anomaly_report.summary.get('status', '未知')}")
        
        if anomaly_report.anomalies:
            print()
            print("检测到的异常点:")
            for a in anomaly_report.anomalies:
                severity_marker = {
                    'high': '🔴',
                    'medium': '🟡',
                    'low': '🟢'
                }.get(a.severity, '⚪')
                print(f"  {severity_marker} 序号 {a.index + 1}: ({a.pump_speed:.2f} Hz, {a.flow_rate:.4f} L/h)")
                print(f"     类型: {a.anomaly_type}")
                print(f"     描述: {a.description}")
    
    recommendation = None
    target_flow_rate = None
    
    if target_flow is not None:
        target_flow_rate = target_flow
    elif target_concentration is not None:
        if verbose:
            print()
            print("=" * 50)
            print("计算推荐泵速")
            print("=" * 50)
        
        stock_conc = concentration_record.stock_concentration
        stock_unit = concentration_record.stock_concentration_unit
        
        target_flow_rate, _ = dosage_calculator.calculate_required_flow(
            target_concentration=target_concentration,
            target_concentration_unit='mg/L',
            stock_concentration=stock_conc,
            stock_concentration_unit=stock_unit,
            process_flow_rate=1.0,
            process_flow_unit='m3/h'
        )
        
        if verbose:
            print(f"目标浓度: {target_concentration} mg/L")
            print(f"母液浓度: {stock_conc} {stock_unit}")
            print(f"所需流量: {target_flow_rate:.4f} L/h (每 m³/h 处理水量)")
    
    if target_flow_rate is not None:
        try:
            y_min, y_max = fitting_result.flow_rate_range
            if target_flow_rate < y_min or target_flow_rate > y_max:
                if verbose:
                    print(f"警告: 目标流量 {target_flow_rate:.4f} 超出数据范围 [{y_min:.4f}, {y_max:.4f}]")
            
            recommendation = curve_fitter.calculate_recommended_pump_speed(
                fitting_result,
                target_flow_rate=target_flow_rate,
                confidence_level=confidence_level
            )
            
            if verbose:
                print()
                print(f"目标流量: {recommendation.target_flow_rate:.4f} L/h")
                print(f"推荐泵速: {recommendation.recommended_pump_speed:.2f} Hz")
                print(f"置信区间 ({recommendation.confidence_level*100:.0f}%): [{recommendation.lower_bound:.2f}, {recommendation.upper_bound:.2f}] Hz")
                if recommendation.exceedance_probability is not None:
                    print(f"超限概率: {recommendation.exceedance_probability*100:.2f}%")
                    print(f"风险评估: {recommendation.risk_assessment}")
        except Exception as e:
            if verbose:
                print(f"无法计算推荐泵速: {e}")
    
    dataset = CalibrationDataset(
        flowmeter_data=flowmeter_data,
        concentration_record=concentration_record,
        titration_results=titration_results
    )
    
    return {
        'dataset': dataset,
        'fitting_result': fitting_result,
        'anomaly_report': anomaly_report,
        'recommendation': recommendation,
    }


def main():
    args = parse_arguments()
    
    if args.example:
        print("使用示例数据运行演示...")
        print()
        
        sample_data = generate_sample_data()
        
        flowmeter_data = FlowmeterData(
            pump_speed=sample_data['pump_speeds'],
            flow_rate=sample_data['flow_rates']
        )
        
        concentration_record = ConcentrationRecord(
            stock_concentration=sample_data['stock_concentration'],
            stock_concentration_unit=sample_data['stock_concentration_unit'],
            target_concentration=sample_data['target_concentration'],
            target_concentration_unit=sample_data['target_concentration_unit']
        )
        
        titration_results = [
            TitrationResult(
                pump_speed=r['pump_speed'],
                measured_concentration=r['measured_concentration']
            )
            for r in sample_data['titration_results']
        ]
        
        target_concentration = args.target_conc if args.target_conc else sample_data['target_concentration']
        
    else:
        if not args.flowmeter:
            print("错误: 必须指定 --flowmeter 参数或使用 --example 模式")
            sys.exit(1)
        
        if not args.concentration:
            print("错误: 必须指定 --concentration 参数或使用 --example 模式")
            sys.exit(1)
        
        parser = DataParser()
        
        print(f"解析流量计数据: {args.flowmeter}")
        flowmeter_data = parser.parse_flowmeter_csv(args.flowmeter)
        
        print(f"解析浓度记录: {args.concentration}")
        concentration_record = parser.parse_concentration_record(args.concentration)
        
        titration_results = []
        if args.titration:
            print(f"解析滴定结果: {args.titration}")
            titration_results = parser.parse_titration_results(args.titration)
        
        target_concentration = args.target_conc
        if target_concentration is None and concentration_record.target_concentration:
            target_concentration = concentration_record.target_concentration
    
    print()
    print("=" * 60)
    print("加药泵校准分析")
    print("=" * 60)
    print()
    
    results = run_calibration(
        flowmeter_data=flowmeter_data,
        concentration_record=concentration_record,
        titration_results=titration_results,
        model_type=args.model,
        confidence_level=args.confidence,
        auto_select_model=args.auto_select_model,
        target_concentration=target_concentration,
        target_flow=args.target_flow,
        verbose=args.verbose
    )
    
    dataset = results['dataset']
    fitting_result = results['fitting_result']
    anomaly_report = results['anomaly_report']
    recommendation = results['recommendation']
    
    if not args.no_report or not args.no_csv:
        output_dir = args.output
        os.makedirs(output_dir, exist_ok=True)
        
        prefix = args.prefix
        if not prefix:
            prefix = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        calibration_summary = report_exporter.generate_calibration_summary(
            dataset=dataset,
            fitting_result=fitting_result,
            anomaly_report=anomaly_report,
            recommendation=recommendation,
            pump_id=args.pump_id,
            pump_name=args.pump_name,
            operator=args.operator
        )
        
        if not args.no_report:
            report_path = os.path.join(output_dir, f"{prefix}_calibration_report.md")
            report_exporter.export_markdown(
                filepath=report_path,
                dataset=dataset,
                fitting_result=fitting_result,
                anomaly_report=anomaly_report,
                recommendation=recommendation,
                calibration_summary=calibration_summary
            )
            print()
            print(f"报告已导出: {report_path}")
        
        if not args.no_csv:
            params_path = os.path.join(output_dir, f"{prefix}_calibration_params.csv")
            report_exporter.export_parameters_csv(
                filepath=params_path,
                fitting_result=fitting_result,
                recommendation=recommendation,
                concentration_record=concentration_record
            )
            print(f"参数表已导出: {params_path}")
            
            if anomaly_report.anomaly_count > 0:
                anomaly_path = os.path.join(output_dir, f"{prefix}_anomalies.csv")
                report_exporter.export_anomaly_csv(
                    filepath=anomaly_path,
                    anomaly_report=anomaly_report
                )
                print(f"异常报告已导出: {anomaly_path}")
    
    print()
    print("=" * 60)
    print("分析完成")
    print("=" * 60)
    
    return 0


if __name__ == '__main__':
    sys.exit(main())
