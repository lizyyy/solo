import csv
import json
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path
from dataclasses import dataclass, asdict, is_dataclass
import pandas as pd

from .data_parser import ThermocoupleData, KilnPosition, GlazeRecipe
from .curve_calculator import CurveCalculationResult, HeatingRateResult, HoldingSegment
from .risk_rules import GlazeRiskAssessment, RiskItem, RiskLevel, RiskType
from .simulator import SimulationResult


class DataclassEncoder(json.JSONEncoder):
    """支持数据类的JSON编码器"""
    
    def default(self, obj):
        if is_dataclass(obj) and not isinstance(obj, type):
            return asdict(obj)
        if isinstance(obj, (pd.Timestamp, datetime)):
            return obj.isoformat()
        if isinstance(obj, pd.DatetimeIndex):
            return [ts.isoformat() for ts in obj]
        if isinstance(obj, pd.Series):
            return obj.to_list()
        if isinstance(obj, RiskLevel) or isinstance(obj, RiskType):
            return obj.value
        return super().default(obj)


@dataclass
class FullAnalysisReport:
    """完整分析报告"""
    report_id: str
    generated_at: datetime
    data_summary: Dict[str, Any]
    curve_analysis: Optional[CurveCalculationResult]
    risk_assessments: List[GlazeRiskAssessment]
    risk_summary: Dict[str, Any]
    simulation_results: List[SimulationResult]
    suggestions: List[Dict[str, Any]]


class ReportGenerator:
    """
    报告生成器 - 支持导出 Markdown、CSV、JSON 格式
    
    主要功能:
    1. 汇总所有分析结果
    2. 生成格式化的 Markdown 报告
    3. 导出 CSV 数据报告
    4. 导出 JSON 完整报告
    """
    
    def __init__(self):
        """初始化报告生成器"""
        self.report_id = f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    def generate_full_report(self,
                             thermocouples: Dict[str, ThermocoupleData],
                             positions: Dict[str, KilnPosition],
                             glaze_recipes: Dict[str, GlazeRecipe],
                             curve_analysis: Optional[CurveCalculationResult] = None,
                             risk_assessments: List[GlazeRiskAssessment] = None,
                             simulation_results: List[SimulationResult] = None,
                             suggestions: List[Dict[str, Any]] = None) -> FullAnalysisReport:
        """
        生成完整分析报告
        
        Args:
            thermocouples: 热电偶数据字典
            positions: 窑位数据字典
            glaze_recipes: 釉料配方字典
            curve_analysis: 曲线分析结果(可选)
            risk_assessments: 风险评估列表(可选)
            simulation_results: 模拟结果列表(可选)
            suggestions: 改进建议列表(可选)
            
        Returns:
            完整分析报告
        """
        data_summary = self._generate_data_summary(
            thermocouples, positions, glaze_recipes
        )
        
        from .risk_rules import RiskAnalyzer
        if risk_assessments:
            risk_analyzer = RiskAnalyzer()
            risk_summary = risk_analyzer.get_risk_summary(risk_assessments)
        else:
            risk_summary = {}
        
        return FullAnalysisReport(
            report_id=self.report_id,
            generated_at=datetime.now(),
            data_summary=data_summary,
            curve_analysis=curve_analysis,
            risk_assessments=risk_assessments or [],
            risk_summary=risk_summary,
            simulation_results=simulation_results or [],
            suggestions=suggestions or []
        )
    
    def _generate_data_summary(self,
                               thermocouples: Dict[str, ThermocoupleData],
                               positions: Dict[str, KilnPosition],
                               glaze_recipes: Dict[str, GlazeRecipe]) -> Dict[str, Any]:
        """生成数据摘要"""
        tc_summary = {}
        for name, tc in thermocouples.items():
            df = tc.data_frame
            tc_summary[name] = {
                'data_points': len(df),
                'missing_points': tc.metadata.get('missing_points_count', 0),
                'max_temperature': float(df['temperature'].max()),
                'min_temperature': float(df['temperature'].min()),
                'avg_temperature': float(df['temperature'].mean())
            }
        
        position_summary = {}
        for pos_id, pos in positions.items():
            position_summary[pos_id] = {
                'name': pos.name,
                'coordinates': (pos.position_x, pos.position_y, pos.position_z),
                'thermocouple_id': pos.thermocouple_id,
                'item_count': len(pos.items)
            }
        
        glaze_summary = {}
        for glaze_id, glaze in glaze_recipes.items():
            glaze_summary[glaze_id] = {
                'name': glaze.name,
                'target_temp': glaze.firing_profile.get('max_temp', '未知'),
                'holding_time': glaze.firing_profile.get('holding_time_min', '未知'),
                'component_count': len(glaze.components)
            }
        
        return {
            'thermocouples': tc_summary,
            'positions': position_summary,
            'glaze_recipes': glaze_summary,
            'total_thermocouples': len(thermocouples),
            'total_positions': len(positions),
            'total_glazes': len(glaze_recipes)
        }
    
    def export_markdown(self, report: FullAnalysisReport, output_path: str) -> str:
        """
        导出 Markdown 格式报告
        
        Args:
            report: 完整分析报告
            output_path: 输出文件路径
            
        Returns:
            导出的文件路径
        """
        content = self._generate_markdown_content(report)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return output_path
    
    def _generate_markdown_content(self, report: FullAnalysisReport) -> str:
        """生成 Markdown 内容"""
        lines = []
        
        lines.append("# 窑温曲线复盘报告")
        lines.append("")
        lines.append(f"> 报告ID: {report.report_id}")
        lines.append(f"> 生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## 1. 数据摘要")
        lines.append("")
        lines.append("### 1.1 热电偶数据")
        lines.append("")
        lines.append("| 名称 | 数据点数 | 缺测点 | 最高温度(℃) | 最低温度(℃) | 平均温度(℃) |")
        lines.append("|------|----------|--------|-------------|-------------|-------------|")
        for name, data in report.data_summary['thermocouples'].items():
            lines.append(f"| {name} | {data['data_points']} | {data['missing_points']} | {data['max_temperature']:.1f} | {data['min_temperature']:.1f} | {data['avg_temperature']:.1f} |")
        lines.append("")
        
        lines.append("### 1.2 窑位信息")
        lines.append("")
        lines.append("| 窑位ID | 名称 | 坐标 | 热电偶 | 物品数 |")
        lines.append("|--------|------|------|--------|--------|")
        for pos_id, data in report.data_summary['positions'].items():
            coords = f"({data['coordinates'][0]:.1f}, {data['coordinates'][1]:.1f}, {data['coordinates'][2]:.1f})"
            lines.append(f"| {pos_id} | {data['name']} | {coords} | {data['thermocouple_id']} | {data['item_count']} |")
        lines.append("")
        
        lines.append("### 1.3 釉料配方")
        lines.append("")
        lines.append("| 釉料ID | 名称 | 目标温度(℃) | 保温时间(分钟) | 成分数 |")
        lines.append("|--------|------|-------------|----------------|--------|")
        for glaze_id, data in report.data_summary['glaze_recipes'].items():
            lines.append(f"| {glaze_id} | {data['name']} | {data['target_temp']} | {data['holding_time']} | {data['component_count']} |")
        lines.append("")
        
        if report.curve_analysis:
            lines.append("## 2. 曲线分析结果")
            lines.append("")
            
            ca = report.curve_analysis
            lines.append("### 2.1 温度概要")
            lines.append("")
            lines.append(f"- **最高温度**: {ca.peak_temperature:.1f} ℃")
            lines.append(f"- **总烧成时长**: {ca.total_firing_duration_minutes:.1f} 分钟")
            lines.append(f"- **升温至峰值时长**: {ca.time_to_peak_minutes:.1f} 分钟")
            lines.append("")
            
            lines.append("### 2.2 升温速率分析")
            lines.append("")
            hr = ca.heating_rates
            lines.append(f"- **最大升温速率**: {hr.max_rate:.1f} ℃/小时")
            lines.append(f"- **平均升温速率**: {hr.avg_rate:.1f} ℃/小时")
            lines.append("")
            
            if hr.rate_periods:
                lines.append("**阶段分析**:")
                lines.append("")
                for period in hr.rate_periods:
                    phase_name = {
                        'heating': '升温',
                        'cooling': '冷却',
                        'holding': '保温'
                    }.get(period['phase'], period['phase'])
                    lines.append(f"- **{phase_name}阶段**: {period['start_time'].strftime('%H:%M')} - {period['end_time'].strftime('%H:%M')}")
                    lines.append(f"  - 时长: {period['duration_minutes']:.1f} 分钟")
                    lines.append(f"  - 平均速率: {period['avg_rate']:.1f} ℃/小时")
                    lines.append("")
            
            if ca.holding_segments:
                lines.append("### 2.3 保温段分析")
                lines.append("")
                for i, seg in enumerate(ca.holding_segments, 1):
                    status = "✓ 充足" if seg.is_sufficient else "✗ 不足"
                    lines.append(f"**保温段 {i}**: {status}")
                    lines.append(f"- 时间: {seg.start_time.strftime('%Y-%m-%d %H:%M')} - {seg.end_time.strftime('%Y-%m-%d %H:%M')}")
                    lines.append(f"- 时长: {seg.duration_minutes:.1f} 分钟")
                    lines.append(f"- 目标温度: {seg.target_temp:.1f} ℃")
                    lines.append(f"- 起始温度: {seg.start_temp:.1f} ℃")
                    lines.append(f"- 结束温度: {seg.end_temp:.1f} ℃")
                    lines.append(f"- 温度波动: {seg.temp_variation:.1f} ℃")
                    lines.append(f"- 与目标偏差: {seg.deviation_from_target:+.1f} ℃")
                    lines.append("")
        
        if report.risk_assessments:
            lines.append("## 3. 风险评估")
            lines.append("")
            
            lines.append("### 3.1 风险汇总")
            lines.append("")
            if report.risk_summary:
                rs = report.risk_summary
                lines.append(f"- **总评估数**: {rs['total_assessments']}")
                lines.append(f"- **最高风险等级**: {rs['highest_risk_level']}")
                lines.append("")
                
                lines.append("**风险分布**:")
                for level, count in rs['risk_distribution'].items():
                    lines.append(f"- {level}: {count}")
                lines.append("")
                
                if rs['risk_type_distribution']:
                    lines.append("**风险类型分布**:")
                    for risk_type, count in rs['risk_type_distribution'].items():
                        lines.append(f"- {risk_type}: {count}")
                    lines.append("")
            
            lines.append("### 3.2 详细风险评估")
            lines.append("")
            
            for assessment in report.risk_assessments:
                lines.append(f"#### {assessment.glaze_name} ({assessment.position_name})")
                lines.append("")
                lines.append(f"- **整体风险等级**: {assessment.overall_risk_level.value}")
                lines.append(f"- **摘要**: {assessment.summary}")
                lines.append("")
                
                if assessment.risks:
                    lines.append("**详细风险项**:")
                    lines.append("")
                    
                    for risk in assessment.risks:
                        risk_icon = {
                            RiskLevel.LOW: "🟢",
                            RiskLevel.MEDIUM: "🟡",
                            RiskLevel.HIGH: "🟠",
                            RiskLevel.CRITICAL: "🔴"
                        }.get(risk.risk_level, "⚪")
                        
                        lines.append(f"{risk_icon} **{risk.risk_type.value}** - {risk.risk_level.value}")
                        lines.append(f"> {risk.description}")
                        lines.append("")
                        
                        if risk.suggestions:
                            lines.append("**建议**:")
                            for suggestion in risk.suggestions:
                                lines.append(f"- {suggestion}")
                            lines.append("")
                
                lines.append("---")
                lines.append("")
        
        if report.simulation_results:
            lines.append("## 4. 模拟复盘结果")
            lines.append("")
            
            for i, result in enumerate(report.simulation_results, 1):
                lines.append(f"### 4.{i} 模拟 {result.simulation_id}")
                lines.append("")
                
                lines.append("**目标参数**:")
                lines.append(f"- 最高温度: {result.target_params.target_temp} ℃")
                lines.append(f"- 升温速率: {result.target_params.heating_rate} ℃/小时")
                lines.append(f"- 保温时间: {result.target_params.holding_time_min} 分钟")
                lines.append(f"- 冷却速率: {result.target_params.cooling_rate} ℃/小时")
                lines.append("")
                
                comp = result.comparison
                lines.append("**与实际曲线对比**:")
                lines.append(f"- 最高温度差异: {comp['differences']['max_temp_diff']:+.1f} ℃")
                lines.append(f"- 总时长差异: {comp['differences']['duration_diff']:+.1f} 分钟")
                lines.append("")
                
                if result.risk_assessments:
                    lines.append("**模拟风险评估**:")
                    for assessment in result.risk_assessments:
                        lines.append(f"- {assessment.glaze_name}: {assessment.overall_risk_level.value}")
                    lines.append("")
                
                lines.append("---")
                lines.append("")
        
        if report.suggestions:
            lines.append("## 5. 改进建议")
            lines.append("")
            
            for i, suggestion in enumerate(report.suggestions, 1):
                lines.append(f"### 5.{i} {suggestion['description']}")
                lines.append("")
                lines.append(f"**预期效果**: {suggestion['expected_benefit']}")
                lines.append("")
                
                lines.append("**参数调整**:")
                for key, value in suggestion['adjustments'].items():
                    if key == 'intermediate_holds':
                        lines.append(f"- 中间保温点:")
                        for hold in value:
                            lines.append(f"  - {hold['temperature']}℃ 保温 {hold['duration_min']} 分钟")
                    else:
                        lines.append(f"- {key}: {value}")
                lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*本报告由窑温曲线复盘器自动生成*")
        
        return '\n'.join(lines)
    
    def export_csv(self, report: FullAnalysisReport, output_prefix: str) -> List[str]:
        """
        导出 CSV 格式报告
        
        Args:
            report: 完整分析报告
            output_prefix: 输出文件前缀
            
        Returns:
            导出的文件路径列表
        """
        exported_files = []
        
        tc_data = []
        for name, data in report.data_summary['thermocouples'].items():
            tc_data.append({
                'name': name,
                'data_points': data['data_points'],
                'missing_points': data['missing_points'],
                'max_temp': data['max_temperature'],
                'min_temp': data['min_temperature'],
                'avg_temp': data['avg_temperature']
            })
        
        if tc_data:
            tc_df = pd.DataFrame(tc_data)
            tc_path = f"{output_prefix}_thermocouples.csv"
            tc_df.to_csv(tc_path, index=False, encoding='utf-8-sig')
            exported_files.append(tc_path)
        
        risk_data = []
        for assessment in report.risk_assessments:
            for risk in assessment.risks:
                risk_data.append({
                    'glaze_id': assessment.glaze_id,
                    'glaze_name': assessment.glaze_name,
                    'position_id': assessment.position_id,
                    'position_name': assessment.position_name,
                    'overall_risk': assessment.overall_risk_level.value,
                    'risk_type': risk.risk_type.value,
                    'risk_level': risk.risk_level.value,
                    'description': risk.description,
                    'severity_score': risk.severity_score
                })
        
        if risk_data:
            risk_df = pd.DataFrame(risk_data)
            risk_path = f"{output_prefix}_risks.csv"
            risk_df.to_csv(risk_path, index=False, encoding='utf-8-sig')
            exported_files.append(risk_path)
        
        if report.curve_analysis:
            ca = report.curve_analysis
            curve_data = [{
                'curve_name': ca.thermocouple_name,
                'peak_temperature': ca.peak_temperature,
                'total_duration_min': ca.total_firing_duration_minutes,
                'time_to_peak_min': ca.time_to_peak_minutes,
                'max_heating_rate': ca.heating_rates.max_rate,
                'avg_heating_rate': ca.heating_rates.avg_rate,
                'holding_segments_count': len(ca.holding_segments)
            }]
            
            curve_df = pd.DataFrame(curve_data)
            curve_path = f"{output_prefix}_curve_analysis.csv"
            curve_df.to_csv(curve_path, index=False, encoding='utf-8-sig')
            exported_files.append(curve_path)
        
        return exported_files
    
    def export_json(self, report: FullAnalysisReport, output_path: str) -> str:
        """
        导出 JSON 格式报告
        
        Args:
            report: 完整分析报告
            output_path: 输出文件路径
            
        Returns:
            导出的文件路径
        """
        report_dict = {
            'report_id': report.report_id,
            'generated_at': report.generated_at.isoformat(),
            'data_summary': report.data_summary,
            'risk_summary': report.risk_summary,
            'suggestions': report.suggestions
        }
        
        if report.curve_analysis:
            ca = report.curve_analysis
            report_dict['curve_analysis'] = {
                'thermocouple_name': ca.thermocouple_name,
                'peak_temperature': ca.peak_temperature,
                'total_firing_duration_minutes': ca.total_firing_duration_minutes,
                'time_to_peak_minutes': ca.time_to_peak_minutes,
                'thermal_summary': ca.thermal_summary,
                'heating_rates': {
                    'max_rate': ca.heating_rates.max_rate,
                    'avg_rate': ca.heating_rates.avg_rate,
                    'rate_periods': ca.heating_rates.rate_periods
                },
                'holding_segments': [
                    {
                        'start_time': seg.start_time.isoformat(),
                        'end_time': seg.end_time.isoformat(),
                        'duration_minutes': seg.duration_minutes,
                        'target_temp': seg.target_temp,
                        'start_temp': seg.start_temp,
                        'end_temp': seg.end_temp,
                        'temp_variation': seg.temp_variation,
                        'deviation_from_target': seg.deviation_from_target,
                        'is_sufficient': seg.is_sufficient
                    }
                    for seg in ca.holding_segments
                ]
            }
        
        if report.risk_assessments:
            report_dict['risk_assessments'] = [
                {
                    'glaze_id': a.glaze_id,
                    'glaze_name': a.glaze_name,
                    'position_id': a.position_id,
                    'position_name': a.position_name,
                    'overall_risk_level': a.overall_risk_level.value,
                    'summary': a.summary,
                    'risks': [
                        {
                            'risk_type': r.risk_type.value,
                            'risk_level': r.risk_level.value,
                            'description': r.description,
                            'severity_score': r.severity_score,
                            'contributing_factors': r.contributing_factors,
                            'suggestions': r.suggestions
                        }
                        for r in a.risks
                    ]
                }
                for a in report.risk_assessments
            ]
        
        if report.simulation_results:
            report_dict['simulation_results'] = [
                {
                    'simulation_id': r.simulation_id,
                    'original_curve_name': r.original_curve_name,
                    'target_params': {
                        'start_temp': r.target_params.start_temp,
                        'target_temp': r.target_params.target_temp,
                        'heating_rate': r.target_params.heating_rate,
                        'holding_time_min': r.target_params.holding_time_min,
                        'cooling_rate': r.target_params.cooling_rate,
                        'end_temp': r.target_params.end_temp,
                        'intermediate_holds': r.target_params.intermediate_holds
                    },
                    'comparison': r.comparison,
                    'risk_assessments': [
                        {
                            'glaze_name': a.glaze_name,
                            'overall_risk_level': a.overall_risk_level.value,
                            'summary': a.summary
                        }
                        for a in r.risk_assessments
                    ]
                }
                for r in report.simulation_results
            ]
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report_dict, f, ensure_ascii=False, indent=2, cls=DataclassEncoder)
        
        return output_path
