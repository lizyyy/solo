import os
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
import csv
import json

from data_parser import FlowmeterData, ConcentrationRecord, TitrationResult, CalibrationDataset
from fitting import FittingResult, PumpSpeedRecommendation
from anomaly_detection import AnomalyReport, AnomalyDiagnosis


@dataclass
class CalibrationSummary:
    calibration_date: str
    pump_id: str = ""
    pump_name: str = ""
    operator: str = ""
    
    flowmeter_data_summary: Dict = None
    concentration_summary: Dict = None
    titration_summary: Dict = None
    
    fitting_summary: Dict = None
    anomaly_summary: Dict = None
    recommendation_summary: Dict = None
    
    overall_status: str = "正常"
    notes: str = ""


class ReportExporter:
    def __init__(self):
        self.report_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.report_date = datetime.now().strftime("%Y-%m-%d")
    
    def generate_markdown_report(
        self,
        dataset: CalibrationDataset,
        fitting_result: FittingResult,
        anomaly_report: AnomalyReport,
        recommendation: Optional[PumpSpeedRecommendation] = None,
        calibration_summary: Optional[CalibrationSummary] = None,
        additional_info: Optional[Dict] = None
    ) -> str:
        lines = []
        
        lines.append("# 加药泵周校准报告")
        lines.append("")
        lines.append(f"**生成时间**: {self.report_time}")
        lines.append("")
        
        if calibration_summary:
            lines.append("## 基本信息")
            lines.append("")
            if calibration_summary.pump_id:
                lines.append(f"- **泵编号**: {calibration_summary.pump_id}")
            if calibration_summary.pump_name:
                lines.append(f"- **泵名称**: {calibration_summary.pump_name}")
            if calibration_summary.operator:
                lines.append(f"- **操作人员**: {calibration_summary.operator}")
            lines.append(f"- **校准日期**: {calibration_summary.calibration_date}")
            lines.append(f"- **整体状态**: {calibration_summary.overall_status}")
            lines.append("")
        
        lines.append("## 数据概览")
        lines.append("")
        
        if dataset.flowmeter_data:
            lines.append("### 流量计数据")
            lines.append("")
            lines.append(f"- **数据点数量**: {dataset.flowmeter_data.n_points}")
            lines.append(f"- **泵速范围**: {dataset.flowmeter_data.pump_speed_range[0]:.2f} - {dataset.flowmeter_data.pump_speed_range[1]:.2f} Hz")
            lines.append(f"- **流量范围**: {dataset.flowmeter_data.flow_rate_range[0]:.4f} - {dataset.flowmeter_data.flow_rate_range[1]:.4f} L/h")
            lines.append("")
            
            lines.append("#### 原始数据")
            lines.append("")
            lines.append("| 序号 | 泵速 (Hz) | 流量 (L/h) |")
            lines.append("|------|-----------|------------|")
            for i, (speed, flow) in enumerate(zip(dataset.flowmeter_data.pump_speed, dataset.flowmeter_data.flow_rate)):
                is_anomaly = any(a.index == i for a in anomaly_report.anomalies)
                marker = " ⚠️" if is_anomaly else ""
                lines.append(f"| {i+1} | {speed:.2f} | {flow:.4f}{marker} |")
            lines.append("")
        
        if dataset.concentration_record:
            lines.append("### 浓度记录")
            lines.append("")
            lines.append(f"- **母液浓度**: {dataset.concentration_record.stock_concentration} {dataset.concentration_record.stock_concentration_unit}")
            if dataset.concentration_record.target_concentration:
                lines.append(f"- **目标浓度**: {dataset.concentration_record.target_concentration} {dataset.concentration_record.target_concentration_unit}")
            lines.append("")
        
        if dataset.titration_results:
            lines.append("### 滴定结果")
            lines.append("")
            lines.append("| 序号 | 泵速 (Hz) | 实测浓度 | 备注 |")
            lines.append("|------|-----------|----------|------|")
            for i, tr in enumerate(dataset.titration_results):
                lines.append(f"| {i+1} | {tr.pump_speed:.2f} | {tr.measured_concentration:.4f} | {tr.notes} |")
            lines.append("")
        
        lines.append("## 曲线拟合结果")
        lines.append("")
        
        lines.append(f"### 模型类型: {fitting_result.model_type}")
        lines.append("")
        
        lines.append("#### 模型参数")
        lines.append("")
        lines.append("| 参数名称 | 估计值 | 标准误差 |")
        lines.append("|----------|--------|----------|")
        param_info = fitting_result.get_param_info()
        for name, info in param_info.items():
            se = f"{info['std_error']:.6f}" if info['std_error'] is not None else "N/A"
            lines.append(f"| {name} | {info['value']:.6f} | {se} |")
        lines.append("")
        
        lines.append("#### 拟合质量指标")
        lines.append("")
        lines.append(f"- **R² (决定系数)**: {fitting_result.r_squared:.6f}")
        lines.append(f"- **调整R²**: {fitting_result.adjusted_r_squared:.6f}")
        lines.append(f"- **RMSE (均方根误差)**: {fitting_result.rmse:.6f}")
        lines.append(f"- **MAE (平均绝对误差)**: {fitting_result.mae:.6f}")
        lines.append("")
        
        lines.append("## 异常检测结果")
        lines.append("")
        
        lines.append("### 检测概要")
        lines.append("")
        lines.append(f"- **总数据点数**: {anomaly_report.total_points}")
        lines.append(f"- **异常点数量**: {anomaly_report.anomaly_count}")
        lines.append(f"- **正常点数量**: {anomaly_report.normal_count}")
        lines.append(f"- **检测方法**: {anomaly_report.summary.get('detection_method', 'ensemble')}")
        lines.append(f"- **数据状态**: {anomaly_report.summary.get('status', '未知')}")
        lines.append("")
        
        severity_counts = anomaly_report.get_severity_counts()
        if any(severity_counts.values()):
            lines.append("### 异常严重程度分布")
            lines.append("")
            lines.append(f"- **高优先级**: {severity_counts['high']} 个")
            lines.append(f"- **中优先级**: {severity_counts['medium']} 个")
            lines.append(f"- **低优先级**: {severity_counts['low']} 个")
            lines.append("")
        
        if anomaly_report.anomalies:
            lines.append("### 异常点详情")
            lines.append("")
            
            high_anomalies = [a for a in anomaly_report.anomalies if a.severity == 'high']
            medium_anomalies = [a for a in anomaly_report.anomalies if a.severity == 'medium']
            low_anomalies = [a for a in anomaly_report.anomalies if a.severity == 'low']
            
            for anomalies, title in [
                (high_anomalies, "🔴 高优先级异常"),
                (medium_anomalies, "🟡 中优先级异常"),
                (low_anomalies, "🟢 低优先级异常"),
            ]:
                if anomalies:
                    lines.append(f"#### {title}")
                    lines.append("")
                    for a in anomalies:
                        lines.append(f"**序号 {a.index + 1}** (泵速: {a.pump_speed:.2f} Hz, 流量: {a.flow_rate:.4f} L/h)")
                        lines.append("")
                        lines.append(f"- **异常类型**: {a.anomaly_type}")
                        lines.append(f"- **描述**: {a.description}")
                        lines.append(f"- **建议操作**: {a.suggested_action}")
                        if a.metrics:
                            lines.append(f"- **诊断指标**: {json.dumps(a.metrics, ensure_ascii=False, indent=2)}")
                        lines.append("")
        
        lines.append("## 推荐泵速计算")
        lines.append("")
        
        if recommendation:
            lines.append(f"### 目标流量: {recommendation.target_flow_rate:.4f} {recommendation.target_flow_rate_unit}")
            lines.append("")
            lines.append(f"- **推荐泵速**: **{recommendation.recommended_pump_speed:.2f} {recommendation.pump_speed_unit}**")
            lines.append(f"- **置信区间**: [{recommendation.lower_bound:.2f}, {recommendation.upper_bound:.2f}] {recommendation.pump_speed_unit}")
            lines.append(f"- **置信水平**: {recommendation.confidence_level * 100:.0f}%")
            lines.append("")
            
            if recommendation.exceedance_probability is not None:
                lines.append("### 风险评估")
                lines.append("")
                lines.append(f"- **超限概率**: {recommendation.exceedance_probability * 100:.2f}%")
                lines.append(f"- **风险等级**: {recommendation.risk_assessment}")
                lines.append("")
            
            if recommendation.additional_info:
                lines.append("### 附加信息")
                lines.append("")
                info = recommendation.additional_info
                lines.append(f"- **预测流量**: {info.get('predicted_flow', 'N/A'):.4f} L/h")
                lines.append(f"- **相对误差**: {info.get('relative_error_percent', 'N/A'):.2f}%")
                lines.append(f"- **残差标准差**: {info.get('residual_std', 'N/A'):.6f}")
                lines.append("")
        else:
            lines.append("*未指定目标浓度，未计算推荐泵速*")
            lines.append("")
        
        lines.append("## 结论与建议")
        lines.append("")
        
        if fitting_result.r_squared > 0.99:
            fit_quality = "优秀"
        elif fitting_result.r_squared > 0.95:
            fit_quality = "良好"
        elif fitting_result.r_squared > 0.90:
            fit_quality = "一般"
        else:
            fit_quality = "较差"
        
        lines.append(f"- **拟合质量**: {fit_quality} (R² = {fitting_result.r_squared:.4f})")
        
        if anomaly_report.anomaly_count == 0:
            lines.append("- **数据质量**: 无异常点，数据质量良好")
        else:
            lines.append(f"- **数据质量**: 发现 {anomaly_report.anomaly_count} 个异常点，请关注上述异常诊断")
        
        if severity_counts.get('high', 0) > 0:
            lines.append("- **行动建议**: 建议复查高优先级异常点的数据，必要时重新测量")
        
        lines.append("")
        
        if additional_info:
            lines.append("## 附加信息")
            lines.append("")
            for key, value in additional_info.items():
                lines.append(f"- **{key}**: {value}")
            lines.append("")
        
        if calibration_summary and calibration_summary.notes:
            lines.append("## 备注")
            lines.append("")
            lines.append(calibration_summary.notes)
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append(f"*报告由泵校准系统自动生成于 {self.report_time}*")
        
        return "\n".join(lines)
    
    def export_markdown(
        self,
        filepath: str,
        dataset: CalibrationDataset,
        fitting_result: FittingResult,
        anomaly_report: AnomalyReport,
        recommendation: Optional[PumpSpeedRecommendation] = None,
        calibration_summary: Optional[CalibrationSummary] = None,
        additional_info: Optional[Dict] = None
    ) -> str:
        content = self.generate_markdown_report(
            dataset, fitting_result, anomaly_report,
            recommendation, calibration_summary, additional_info
        )
        
        os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return filepath
    
    def export_parameters_csv(
        self,
        filepath: str,
        fitting_result: FittingResult,
        recommendation: Optional[PumpSpeedRecommendation] = None,
        concentration_record: Optional[ConcentrationRecord] = None
    ) -> str:
        os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
        
        rows = []
        
        rows.append(['# 模型参数'])
        rows.append(['参数名称', '值', '标准误差'])
        param_info = fitting_result.get_param_info()
        for name, info in param_info.items():
            se = f"{info['std_error']:.6f}" if info['std_error'] is not None else ""
            rows.append([name, f"{info['value']:.6f}", se])
        
        rows.append([])
        rows.append(['# 拟合质量'])
        rows.append(['指标', '值'])
        rows.append(['R_squared', f"{fitting_result.r_squared:.6f}"])
        rows.append(['Adjusted_R_squared', f"{fitting_result.adjusted_r_squared:.6f}"])
        rows.append(['RMSE', f"{fitting_result.rmse:.6f}"])
        rows.append(['MAE', f"{fitting_result.mae:.6f}"])
        rows.append(['Model_Type', fitting_result.model_type])
        
        rows.append([])
        rows.append(['# 数据范围'])
        rows.append(['泵速范围_最小值', f"{fitting_result.pump_speed_range[0]:.2f}"])
        rows.append(['泵速范围_最大值', f"{fitting_result.pump_speed_range[1]:.2f}"])
        rows.append(['流量范围_最小值', f"{fitting_result.flow_rate_range[0]:.4f}"])
        rows.append(['流量范围_最大值', f"{fitting_result.flow_rate_range[1]:.4f}"])
        
        if recommendation:
            rows.append([])
            rows.append(['# 推荐参数'])
            rows.append(['目标流量', f"{recommendation.target_flow_rate:.4f}"])
            rows.append(['推荐泵速', f"{recommendation.recommended_pump_speed:.2f}"])
            rows.append(['置信区间下限', f"{recommendation.lower_bound:.2f}"])
            rows.append(['置信区间上限', f"{recommendation.upper_bound:.2f}"])
            rows.append(['置信水平', f"{recommendation.confidence_level}"])
            if recommendation.exceedance_probability is not None:
                rows.append(['超限概率', f"{recommendation.exceedance_probability:.6f}"])
        
        if concentration_record:
            rows.append([])
            rows.append(['# 浓度参数'])
            rows.append(['母液浓度', f"{concentration_record.stock_concentration}"])
            rows.append(['母液浓度单位', concentration_record.stock_concentration_unit])
            if concentration_record.target_concentration:
                rows.append(['目标浓度', f"{concentration_record.target_concentration}"])
                rows.append(['目标浓度单位', concentration_record.target_concentration_unit])
        
        rows.append([])
        rows.append(['# 导出信息'])
        rows.append(['导出时间', self.report_time])
        rows.append(['模型类型', fitting_result.model_type])
        
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            for row in rows:
                writer.writerow(row)
        
        return filepath
    
    def export_anomaly_csv(
        self,
        filepath: str,
        anomaly_report: AnomalyReport
    ) -> str:
        os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
        
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow(['# 异常检测汇总'])
            writer.writerow(['总数据点数', anomaly_report.total_points])
            writer.writerow(['异常点数量', anomaly_report.anomaly_count])
            writer.writerow(['正常点数量', anomaly_report.normal_count])
            writer.writerow(['检测方法', anomaly_report.summary.get('detection_method', 'ensemble')])
            writer.writerow(['数据状态', anomaly_report.summary.get('status', '未知')])
            writer.writerow([])
            
            if anomaly_report.anomalies:
                writer.writerow(['# 异常点详情'])
                writer.writerow([
                    '序号', '泵速(Hz)', '流量(L/h)', '异常类型', '严重程度',
                    '描述', '建议操作', '诊断指标'
                ])
                
                for a in anomaly_report.anomalies:
                    metrics_str = json.dumps(a.metrics, ensure_ascii=False)
                    writer.writerow([
                        a.index + 1,
                        f"{a.pump_speed:.2f}",
                        f"{a.flow_rate:.4f}",
                        a.anomaly_type,
                        a.severity,
                        a.description,
                        a.suggested_action,
                        metrics_str
                    ])
            
            writer.writerow([])
            writer.writerow(['# 正常点索引'])
            writer.writerow(['序号', '原始索引'])
            for i, idx in enumerate(anomaly_report.normal_indices):
                writer.writerow([i + 1, idx + 1])
        
        return filepath
    
    def generate_calibration_summary(
        self,
        dataset: CalibrationDataset,
        fitting_result: FittingResult,
        anomaly_report: AnomalyReport,
        recommendation: Optional[PumpSpeedRecommendation] = None,
        pump_id: str = "",
        pump_name: str = "",
        operator: str = ""
    ) -> CalibrationSummary:
        flowmeter_summary = None
        if dataset.flowmeter_data:
            flowmeter_summary = {
                'n_points': dataset.flowmeter_data.n_points,
                'pump_speed_range': dataset.flowmeter_data.pump_speed_range,
                'flow_rate_range': dataset.flowmeter_data.flow_rate_range,
            }
        
        concentration_summary = None
        if dataset.concentration_record:
            concentration_summary = {
                'stock_concentration': dataset.concentration_record.stock_concentration,
                'stock_concentration_unit': dataset.concentration_record.stock_concentration_unit,
                'target_concentration': dataset.concentration_record.target_concentration,
            }
        
        titration_summary = None
        if dataset.titration_results:
            titration_summary = {
                'n_results': len(dataset.titration_results),
                'pump_speeds': [t.pump_speed for t in dataset.titration_results],
                'concentrations': [t.measured_concentration for t in dataset.titration_results],
            }
        
        fitting_summary = {
            'model_type': fitting_result.model_type,
            'r_squared': fitting_result.r_squared,
            'adjusted_r_squared': fitting_result.adjusted_r_squared,
            'rmse': fitting_result.rmse,
            'params': fitting_result.get_param_info(),
        }
        
        anomaly_summary = {
            'total_points': anomaly_report.total_points,
            'anomaly_count': anomaly_report.anomaly_count,
            'normal_count': anomaly_report.normal_count,
            'severity_counts': anomaly_report.get_severity_counts(),
            'status': anomaly_report.summary.get('status', '未知'),
        }
        
        recommendation_summary = None
        if recommendation:
            recommendation_summary = {
                'target_flow_rate': recommendation.target_flow_rate,
                'recommended_pump_speed': recommendation.recommended_pump_speed,
                'confidence_interval': (recommendation.lower_bound, recommendation.upper_bound),
                'exceedance_probability': recommendation.exceedance_probability,
                'risk_assessment': recommendation.risk_assessment,
            }
        
        overall_status = "正常"
        if anomaly_report.summary.get('status') == '需要关注':
            overall_status = "需要关注"
        elif fitting_result.r_squared < 0.9:
            overall_status = "拟合质量较差"
        
        return CalibrationSummary(
            calibration_date=self.report_date,
            pump_id=pump_id,
            pump_name=pump_name,
            operator=operator,
            flowmeter_data_summary=flowmeter_summary,
            concentration_summary=concentration_summary,
            titration_summary=titration_summary,
            fitting_summary=fitting_summary,
            anomaly_summary=anomaly_summary,
            recommendation_summary=recommendation_summary,
            overall_status=overall_status
        )


report_exporter = ReportExporter()
