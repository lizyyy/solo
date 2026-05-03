"""
报告导出模块 - 生成CSV和Markdown报告
"""

import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path

from .analyzer import BoundaryType, BoundaryCase, DriftCase, PumpAnalyzer


class ReportExporter:
    """报告导出器"""
    
    def __init__(self, analyzer: PumpAnalyzer = None):
        self.analyzer = analyzer
        self.results: Dict[str, Any] = {}
    
    def set_analyzer(self, analyzer: PumpAnalyzer):
        """设置分析器实例"""
        self.analyzer = analyzer
    
    def export_drift_cases_csv(self, output_path: str) -> str:
        """
        导出漂移案例到CSV
        
        Args:
            output_path: 输出文件路径
            
        Returns:
            输出文件路径
        """
        if self.analyzer is None:
            raise ValueError("未设置分析器实例")
        
        df = self.analyzer.get_drift_cases_df()
        
        if df.empty:
            print("警告: 没有漂移案例可导出")
            df = pd.DataFrame(columns=[
                'pump_id', 'model', 'drift_start_time', 'drift_end_time',
                'baseline_score_mean', 'current_score_mean', 'score_change_pct',
                'cluster_before', 'cluster_after', 'feature_changes',
                'confidence', 'is_significant'
            ])
        
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        df.to_csv(output_file, index=False, encoding='utf-8-sig')
        print(f"漂移案例已导出到: {output_file}")
        
        return str(output_file)
    
    def export_boundary_cases_csv(self, output_path: str) -> str:
        """
        导出边界案例到CSV
        
        Args:
            output_path: 输出文件路径
            
        Returns:
            输出文件路径
        """
        if self.analyzer is None:
            raise ValueError("未设置分析器实例")
        
        df = self.analyzer.get_boundary_cases_df()
        
        if df.empty:
            print("警告: 没有边界案例可导出")
            df = pd.DataFrame(columns=[
                'pump_id', 'boundary_type', 'timestamp', 'description',
                'severity', 'details', 'recommendation'
            ])
        
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        df.to_csv(output_file, index=False, encoding='utf-8-sig')
        print(f"边界案例已导出到: {output_file}")
        
        return str(output_file)
    
    def generate_markdown_report(
        self,
        output_path: str,
        include_details: bool = True
    ) -> str:
        """
        生成Markdown格式的复核报告
        
        Args:
            output_path: 输出文件路径
            include_details: 是否包含详细信息
            
        Returns:
            输出文件路径
        """
        if self.analyzer is None:
            raise ValueError("未设置分析器实例")
        
        results = self.analyzer.analysis_results
        
        if not results:
            raise ValueError("分析结果为空，请先运行分析")
        
        summary = results.get('summary', {})
        drift_cases = results.get('drift_cases', [])
        boundary_cases = results.get('boundary_cases', [])
        shift_summaries = results.get('shift_summaries', {})
        cluster_results = results.get('cluster_results', {})
        
        report_lines = []
        
        report_lines.append("# 工业泵振动模型告警复核报告")
        report_lines.append("")
        report_lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append("")
        
        report_lines.append("## 1. 分析概览")
        report_lines.append("")
        
        overview_data = [
            ["指标", "数值"],
            ["泵总数", str(summary.get('total_pumps', 0))],
            ["型号总数", str(summary.get('total_models', 0))],
            ["漂移案例数", str(summary.get('drift_cases_count', 0))],
            ["边界案例数", str(summary.get('boundary_cases_count', 0))],
        ]
        report_lines.extend(self._format_markdown_table(overview_data))
        report_lines.append("")
        
        if cluster_results:
            report_lines.append("### 型号聚类分布")
            report_lines.append("")
            for model, cluster_info in cluster_results.items():
                info = cluster_info.get('info', {})
                n_clusters = info.get('n_clusters', 0)
                pumps_per_cluster = info.get('pumps_per_cluster', {})
                
                report_lines.append(f"**{model}** ({n_clusters} 个聚类):")
                report_lines.append("")
                for cluster_id, pumps in pumps_per_cluster.items():
                    report_lines.append(f"- 聚类 {cluster_id}: {', '.join(pumps)}")
                report_lines.append("")
        
        report_lines.append("## 2. 漂移案例分析")
        report_lines.append("")
        
        if not drift_cases:
            report_lines.append("*未检测到显著的分数漂移案例*")
            report_lines.append("")
        else:
            significant_cases = [c for c in drift_cases if c.is_significant]
            other_cases = [c for c in drift_cases if not c.is_significant]
            
            if significant_cases:
                report_lines.append("### 2.1 显著漂移案例")
                report_lines.append("")
                
                for case in significant_cases:
                    report_lines.append(f"#### {case.pump_id} ({case.model})")
                    report_lines.append("")
                    
                    report_lines.append(f"- **漂移开始时间**: {case.drift_start_time.strftime('%Y-%m-%d %H:%M')}")
                    report_lines.append(f"- **漂移结束时间**: {case.drift_end_time.strftime('%Y-%m-%d %H:%M') if case.drift_end_time else '持续中'}")
                    report_lines.append(f"- **基线平均分**: {case.baseline_score_mean:.4f}")
                    report_lines.append(f"- **当前平均分**: {case.current_score_mean:.4f}")
                    report_lines.append(f"- **分数变化**: {case.score_change_pct:+.2f}%")
                    report_lines.append(f"- **置信度**: {case.confidence:.2f}")
                    report_lines.append(f"- **聚类变化**: {case.cluster_before} -> {case.cluster_after}")
                    report_lines.append("")
                    
                    if case.feature_changes and include_details:
                        report_lines.append("**特征变化**:")
                        report_lines.append("")
                        feature_table = [["特征", "变化百分比"]]
                        for feature, change in case.feature_changes.items():
                            feature_table.append([feature, f"{change:+.2f}%"])
                        report_lines.extend(self._format_markdown_table(feature_table))
                        report_lines.append("")
                    
                    report_lines.append("---")
                    report_lines.append("")
            
            if other_cases:
                report_lines.append("### 2.2 潜在漂移案例")
                report_lines.append("")
                
                potential_table = [
                    ["泵ID", "型号", "分数变化", "置信度", "开始时间"]
                ]
                for case in other_cases:
                    potential_table.append([
                        case.pump_id,
                        case.model,
                        f"{case.score_change_pct:+.2f}%",
                        f"{case.confidence:.2f}",
                        case.drift_start_time.strftime('%Y-%m-%d %H:%M')
                    ])
                report_lines.extend(self._format_markdown_table(potential_table))
                report_lines.append("")
        
        report_lines.append("## 3. 边界案例分析")
        report_lines.append("")
        
        if not boundary_cases:
            report_lines.append("*未检测到边界案例*")
            report_lines.append("")
        else:
            boundary_by_type: Dict[BoundaryType, List[BoundaryCase]] = {}
            for case in boundary_cases:
                if case.boundary_type not in boundary_by_type:
                    boundary_by_type[case.boundary_type] = []
                boundary_by_type[case.boundary_type].append(case)
            
            if BoundaryType.POST_MAINTENANCE_HIGH_RISK in boundary_by_type:
                report_lines.append("### 3.1 检修后仍高风险")
                report_lines.append("")
                
                for case in boundary_by_type[BoundaryType.POST_MAINTENANCE_HIGH_RISK]:
                    report_lines.append(f"#### {case.pump_id}")
                    report_lines.append("")
                    report_lines.append(f"- **严重程度**: {case.severity}")
                    report_lines.append(f"- **描述**: {case.description}")
                    report_lines.append(f"- **建议**: {case.recommendation}")
                    report_lines.append("")
                    report_lines.append("---")
                    report_lines.append("")
            
            if BoundaryType.SENSOR_GAP in boundary_by_type:
                report_lines.append("### 3.2 传感器断采")
                report_lines.append("")
                
                sensor_table = [
                    ["泵ID", "时间", "描述", "严重程度"]
                ]
                for case in boundary_by_type[BoundaryType.SENSOR_GAP]:
                    sensor_table.append([
                        case.pump_id,
                        case.timestamp.strftime('%Y-%m-%d %H:%M') if case.timestamp else 'N/A',
                        case.description,
                        case.severity
                    ])
                report_lines.extend(self._format_markdown_table(sensor_table))
                report_lines.append("")
            
            if BoundaryType.CROSS_MIDNIGHT_SHIFT in boundary_by_type:
                report_lines.append("### 3.3 跨午夜班次归属")
                report_lines.append("")
                
                midnight_table = [
                    ["泵ID", "时间", "当前班次", "建议班次"]
                ]
                for case in boundary_by_type[BoundaryType.CROSS_MIDNIGHT_SHIFT]:
                    details = case.details or {}
                    midnight_table.append([
                        case.pump_id,
                        case.timestamp.strftime('%Y-%m-%d %H:%M') if case.timestamp else 'N/A',
                        details.get('current_shift', '未知'),
                        details.get('recommended_shift', '未知')
                    ])
                report_lines.extend(self._format_markdown_table(midnight_table))
                report_lines.append("")
        
        report_lines.append("## 4. 各泵班次汇总")
        report_lines.append("")
        
        shift_table = [
            ["泵ID", "总记录数", "白班记录", "夜班记录", "跨午夜数", "高分数数"]
        ]
        for pump_id, summary in shift_summaries.items():
            if not summary:
                continue
            
            shift_dist = summary.get('shift_distribution', {})
            shift_table.append([
                pump_id,
                str(summary.get('total_records', 0)),
                str(shift_dist.get('白班', 0)),
                str(shift_dist.get('夜班', 0)),
                str(summary.get('cross_midnight_count', 0)),
                str(summary.get('high_score_count', 0))
            ])
        report_lines.extend(self._format_markdown_table(shift_table))
        report_lines.append("")
        
        report_lines.append("## 5. 建议行动")
        report_lines.append("")
        
        recommendations = self._generate_recommendations(
            drift_cases, boundary_cases, shift_summaries
        )
        
        if recommendations:
            for i, rec in enumerate(recommendations, 1):
                report_lines.append(f"{i}. **{rec['priority']}**: {rec['action']}")
                if rec.get('details'):
                    report_lines.append(f"   - {rec['details']}")
                report_lines.append("")
        else:
            report_lines.append("*当前数据无特殊建议行动*")
            report_lines.append("")
        
        report_lines.append("---")
        report_lines.append("")
        report_lines.append("*报告由泵振动告警复核工具自动生成*")
        
        full_report = "\n".join(report_lines)
        
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(full_report)
        
        print(f"Markdown报告已导出到: {output_file}")
        
        return str(output_file)
    
    def _format_markdown_table(self, rows: List[List[str]]) -> List[str]:
        """
        格式化Markdown表格
        
        Args:
            rows: 表格行，第一行为表头
            
        Returns:
            Markdown表格行列表
        """
        if not rows:
            return []
        
        col_count = len(rows[0])
        col_widths = [max(len(str(row[i])) for row in rows) for i in range(col_count)]
        
        lines = []
        
        header_parts = [str(rows[0][i]).ljust(col_widths[i]) for i in range(col_count)]
        lines.append(f"| {' | '.join(header_parts)} |")
        
        separator_parts = ['-' * col_widths[i] for i in range(col_count)]
        lines.append(f"| {' | '.join(separator_parts)} |")
        
        for row in rows[1:]:
            row_parts = [str(row[i]).ljust(col_widths[i]) for i in range(col_count)]
            lines.append(f"| {' | '.join(row_parts)} |")
        
        return lines
    
    def _generate_recommendations(
        self,
        drift_cases: List[DriftCase],
        boundary_cases: List[BoundaryCase],
        shift_summaries: Dict[str, Any]
    ) -> List[Dict[str, str]]:
        """
        生成建议行动列表
        
        Returns:
            建议列表，每项包含 priority, action, details
        """
        recommendations = []
        
        significant_drifts = [c for c in drift_cases if c.is_significant]
        if significant_drifts:
            pump_ids = ", ".join([c.pump_id for c in significant_drifts])
            recommendations.append({
                'priority': '高优先级',
                'action': f'立即关注显著漂移的泵: {pump_ids}',
                'details': '这些泵的告警分数发生了显著变化，建议优先安排现场检查'
            })
        
        post_ma_high_risk = [
            c for c in boundary_cases 
            if c.boundary_type == BoundaryType.POST_MAINTENANCE_HIGH_RISK
        ]
        if post_ma_high_risk:
            pump_ids = ", ".join([c.pump_id for c in post_ma_high_risk])
            recommendations.append({
                'priority': '高优先级',
                'action': f'重新评估检修效果: {pump_ids}',
                'details': '这些泵在检修后仍持续高风险，建议检查检修是否彻底'
            })
        
        sensor_gaps_high = [
            c for c in boundary_cases 
            if c.boundary_type == BoundaryType.SENSOR_GAP and c.severity == 'medium'
        ]
        if sensor_gaps_high:
            pump_ids = ", ".join(set([c.pump_id for c in sensor_gaps_high]))
            recommendations.append({
                'priority': '中优先级',
                'action': f'检查传感器数据质量: {pump_ids}',
                'details': '这些泵存在较长时间的数据断采或高缺失率'
            })
        
        potential_drifts = [c for c in drift_cases if not c.is_significant]
        if potential_drifts:
            pump_ids = ", ".join([c.pump_id for c in potential_drifts])
            recommendations.append({
                'priority': '低优先级',
                'action': f'持续监控潜在漂移: {pump_ids}',
                'details': '这些泵显示出分数变化的迹象，建议增加监控频率'
            })
        
        return recommendations
    
    def export_all_reports(
        self,
        output_dir: str,
        drift_csv_name: str = "drift_cases.csv",
        boundary_csv_name: str = "boundary_cases.csv",
        report_name: str = "pump_drift_review.md"
    ) -> Dict[str, str]:
        """
        导出所有报告
        
        Args:
            output_dir: 输出目录
            drift_csv_name: 漂移案例CSV文件名
            boundary_csv_name: 边界案例CSV文件名
            report_name: Markdown报告文件名
            
        Returns:
            导出文件路径字典
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        results = {}
        
        results['drift_cases'] = self.export_drift_cases_csv(
            str(output_path / drift_csv_name)
        )
        
        results['boundary_cases'] = self.export_boundary_cases_csv(
            str(output_path / boundary_csv_name)
        )
        
        results['markdown_report'] = self.generate_markdown_report(
            str(output_path / report_name)
        )
        
        return results
