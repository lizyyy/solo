"""主流程控制器 - 协调整个处理流程"""

import pandas as pd
import os
import json
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import asdict

from .types import (
    ProcessedData, ExperimentGroup, Formula, Measurement,
    Issue, CorrectionRecord, PropagationResult
)
from .data_cleaner import DataCleaner
from .unit_validator import UnitValidator
from .propagation_engine import PropagationEngine
from .step_explainer import StepExplainer
from .chart_exporter import ChartExporter
from .history_tracker import HistoryTracker


class ErrorPropagationProcessor:
    """误差传播处理主控制器"""

    def __init__(self, output_dir: str = "output", history_db: Optional[str] = None):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

        self.cleaner = DataCleaner()
        self.validator = UnitValidator()
        self.engine = PropagationEngine()
        self.explainer = StepExplainer()
        self.chart_exporter = ChartExporter(output_dir=os.path.join(output_dir, "charts"))
        self.history_tracker = HistoryTracker(history_db) if history_db else HistoryTracker()

        self.corrections: List[CorrectionRecord] = []
        self.processing_order = [
            "数据导入与清洗",
            "单位校验与相关性检查",
            "误差传播计算",
            "步骤解释生成",
            "图表导出",
            "历史保存"
        ]

    def process_file(
        self,
        file_path: str,
        formulas: Optional[List[Formula]] = None,
        assume_independent: bool = True,
        processed_by: str = "teacher",
        save_history: bool = True
    ) -> ProcessedData:
        """处理单个数据文件"""
        file_name = os.path.basename(file_path)
        original_data = self._read_file(file_path)

        df = self._load_dataframe(original_data, file_path)
        df, cleaning_issues = self.cleaner.clean_dataframe(df)

        groups = self.cleaner.parse_measurements_from_dataframe(df)

        if formulas:
            for group in groups.values():
                group.formulas = formulas.copy()

        groups = self._validate_units(groups)
        groups = self._check_correlations(groups)
        groups = self._propagate_errors(groups, assume_independent)

        all_issues = (
            cleaning_issues +
            self.validator.issues +
            [issue for group in groups.values() for issue in group.issues]
        )

        processed_data = ProcessedData(
            groups=groups,
            all_issues=all_issues,
            cleaning_log=self.cleaner.cleaning_log.copy(),
            processing_order=self.processing_order,
            metadata={
                'file_name': file_name,
                'file_path': file_path,
                'processed_by': processed_by,
                'assume_independent': assume_independent
            }
        )

        if save_history:
            issues_resolved = len(self.corrections)
            summary = self._generate_summary(processed_data)
            report_path = self.export_reports(processed_data, file_name)
            self.history_tracker.save_entry(
                file_name=file_name,
                original_data=original_data,
                corrections=self.corrections,
                issues_found=len(all_issues),
                issues_resolved=issues_resolved,
                summary=summary,
                processed_by=processed_by,
                report_path=report_path
            )

        return processed_data

    def _read_file(self, file_path: str) -> str:
        """读取原始文件内容"""
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            return f.read()

    def _load_dataframe(self, data: str, file_path: str) -> pd.DataFrame:
        """加载数据为DataFrame"""
        ext = os.path.splitext(file_path)[1].lower()

        if ext in ['.csv']:
            return pd.read_csv(file_path)
        elif ext in ['.xlsx', '.xls']:
            return pd.read_excel(file_path)
        elif ext in ['.json']:
            return pd.read_json(file_path)
        else:
            return pd.read_csv(file_path)

    def _validate_units(self, groups: Dict[str, ExperimentGroup]) -> Dict[str, ExperimentGroup]:
        """验证所有测量值的单位"""
        for group_name, group in groups.items():
            for idx, (name, measurement) in enumerate(group.measurements.items()):
                issue = self.validator.validate_measurement(measurement, idx)
                if issue:
                    group.issues.append(issue)

            for formula in group.formulas:
                unit_issues = self.validator.validate_formula_units(
                    formula.expression,
                    group.measurements
                )
                group.issues.extend(unit_issues)

        return groups

    def _check_correlations(self, groups: Dict[str, ExperimentGroup]) -> Dict[str, ExperimentGroup]:
        """检查变量相关性"""
        for group in groups.values():
            corr_issues = self.validator.check_correlation(group.measurements)
            group.issues.extend(corr_issues)
        return groups

    def _propagate_errors(
        self,
        groups: Dict[str, ExperimentGroup],
        assume_independent: bool
    ) -> Dict[str, ExperimentGroup]:
        """执行误差传播计算"""
        for group in groups.values():
            group = self.engine.process_group(group, assume_independent)

            for result in group.results.values():
                result.target_value = self.validator.round_result(result).target_value
                result.target_uncertainty = self.validator.round_result(result).target_uncertainty

        return groups

    def apply_correction(
        self,
        field: str,
        old_value: Any,
        new_value: Any,
        reason: str,
        corrected_by: str = "teacher"
    ):
        """应用人工修正并记录"""
        import time
        correction = CorrectionRecord(
            field=field,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
            corrected_by=corrected_by,
            timestamp=time.time()
        )
        self.corrections.append(correction)

    def export_reports(
        self,
        processed_data: ProcessedData,
        base_filename: str
    ) -> str:
        """导出所有报告"""
        reports = []

        for group_name, group in processed_data.groups.items():
            for target_name, result in group.results.items():
                safe_name = f"{base_filename}_{group_name}_{target_name}"
                safe_name = safe_name.replace('/', '_').replace('\\', '_')

                html_report = self.explainer.generate_html_report(
                    result,
                    group.measurements,
                    group_name,
                    group.issues
                )
                html_path = os.path.join(self.output_dir, f"{safe_name}.html")
                with open(html_path, 'w', encoding='utf-8') as f:
                    f.write(html_report)
                reports.append(html_path)

                md_report = self.explainer.generate_markdown_report(
                    result,
                    group.measurements,
                    group_name,
                    group.issues
                )
                md_path = os.path.join(self.output_dir, f"{safe_name}.md")
                with open(md_path, 'w', encoding='utf-8') as f:
                    f.write(md_report)

                charts = self.chart_exporter.export_all(
                    result,
                    group.measurements,
                    safe_name
                )

        if len(processed_data.groups) > 1:
            first_group = list(processed_data.groups.values())[0]
            for target_name in first_group.results.keys():
                self.chart_exporter.export_group_comparison(
                    processed_data.groups,
                    target_name,
                    f"{base_filename}_comparison_{target_name}.png"
                )

        summary_path = self._export_summary(processed_data, base_filename)
        reports.append(summary_path)

        return reports[0] if reports else ""

    def _export_summary(
        self,
        processed_data: ProcessedData,
        base_filename: str
    ) -> str:
        """导出汇总报告"""
        summary_path = os.path.join(self.output_dir, f"{base_filename}_summary.html")

        html = []
        html.append("<!DOCTYPE html>")
        html.append("<html lang='zh-CN'>")
        html.append("<head>")
        html.append("<meta charset='UTF-8'>")
        html.append(f"<title>误差传播分析汇总 - {base_filename}</title>")
        html.append("<style>")
        html.append("""
            body { font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
            h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
            h2 { color: #34495e; margin-top: 30px; }
            .processing-flow { display: flex; justify-content: space-between; margin: 30px 0; }
            .flow-step { flex: 1; text-align: center; padding: 15px; background: #f8f9fa; margin: 0 5px; border-radius: 10px; position: relative; }
            .flow-step.active { background: #3498db; color: white; }
            .flow-step.completed { background: #2ecc71; color: white; }
            .flow-step:not(:last-child):after { content: '→'; position: absolute; right: -15px; top: 50%; transform: translateY(-50%); font-size: 24px; color: #3498db; }
            table { border-collapse: collapse; width: 100%; margin: 15px 0; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background: #3498db; color: white; }
            tr:nth-child(even) { background: #f2f2f2; }
            .issue { padding: 10px; margin: 10px 0; border-radius: 5px; }
            .issue-error { background: #ffebee; border-left: 4px solid #f44336; }
            .issue-warning { background: #fff3e0; border-left: 4px solid #ff9800; }
            .issue-info { background: #e3f2fd; border-left: 4px solid #2196f3; }
            .severity-critical { color: #c0392b; font-weight: bold; }
            .severity-error { color: #e74c3c; font-weight: bold; }
            .severity-warning { color: #f39c12; font-weight: bold; }
            .severity-info { color: #3498db; }
            .result-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; margin: 15px 0; }
            .cleaning-log { background: #f8f9fa; padding: 15px; border-radius: 5px; font-family: monospace; font-size: 12px; max-height: 200px; overflow-y: auto; }
        """)
        html.append("</style>")
        html.append("</head>")
        html.append("<body>")

        html.append(f"<h1>🔬 误差传播分析汇总报告</h1>")
        html.append(f"<p><strong>文件:</strong> {base_filename} | <strong>处理时间:</strong> {processed_data.metadata.get('processed_by', 'teacher')}</p>")

        html.append("<h2>📋 处理流程</h2>")
        html.append("<div class='processing-flow'>")
        for i, step in enumerate(processed_data.processing_order):
            html.append(f"<div class='flow-step completed'>{i + 1}. {step}</div>")
        html.append("</div>")

        html.append("<h2>📊 处理结果汇总</h2>")
        for group_name, group in processed_data.groups.items():
            html.append(f"<h3>实验组: {group_name}</h3>")
            if group.results:
                html.append("<table>")
                html.append("<tr><th>目标量</th><th>计算结果</th><th>相对不确定度</th><th>主要来源</th><th>单位</th></tr>")
                for target_name, result in group.results.items():
                    html.append("<tr>")
                    html.append(f"<td><strong>{target_name}</strong></td>")
                    html.append(f"<td>{result.target_value:.6g} ± {result.target_uncertainty:.6g}</td>")
                    html.append(f"<td>{result.relative_uncertainty*100:.2f}%</td>")
                    html.append(f"<td>{result.dominant_source}</td>")
                    html.append(f"<td>{result.target_unit}</td>")
                    html.append("</tr>")
                html.append("</table>")
            else:
                html.append("<p>未找到计算结果，请检查公式是否正确配置。</p>")

        html.append("<h2>⚠️ 发现的问题</h2>")
        if processed_data.all_issues:
            for issue in processed_data.all_issues:
                severity_class = f"issue-{issue.severity.value}"
                severity_text = f"severity-{issue.severity.value}"
                html.append(f"<div class='issue {severity_class}'>")
                html.append(f"<strong class='{severity_text}'>[{issue.severity.value.upper()}] {issue.issue_type.value}</strong>")
                if issue.location:
                    html.append(f" <em>({issue.location})</em>")
                html.append(f"<br>{issue.message}")
                if issue.details:
                    html.append(f"<br><small>详情: {json.dumps(issue.details, ensure_ascii=False)}</small>")
                html.append("</div>")
        else:
            html.append("<p>✅ 未发现任何问题</p>")

        html.append("<h2>🧹 数据清洗日志</h2>")
        if processed_data.cleaning_log:
            html.append("<div class='cleaning-log'>")
            for log in processed_data.cleaning_log:
                html.append(f"{log}<br>")
            html.append("</div>")
        else:
            html.append("<p>无需清洗</p>")

        if self.corrections:
            html.append("<h2>✏️ 人工修正记录</h2>")
            html.append("<table>")
            html.append("<tr><th>字段</th><th>原值</th><th>新值</th><th>原因</th><th>修改人</th><th>时间</th></tr>")
            from datetime import datetime
            for corr in self.corrections:
                html.append("<tr>")
                html.append(f"<td>{corr.field}</td>")
                html.append(f"<td>{corr.old_value}</td>")
                html.append(f"<td>{corr.new_value}</td>")
                html.append(f"<td>{corr.reason}</td>")
                html.append(f"<td>{corr.corrected_by}</td>")
                html.append(f"<td>{datetime.fromtimestamp(corr.timestamp).strftime('%Y-%m-%d %H:%M:%S')}</td>")
                html.append("</tr>")
            html.append("</table>")

        html.append("</body>")
        html.append("</html>")

        with open(summary_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(html))

        return summary_path

    def _generate_summary(self, processed_data: ProcessedData) -> str:
        """生成处理摘要"""
        parts = []

        parts.append(f"处理了 {len(processed_data.groups)} 个实验组")

        total_measurements = sum(len(g.measurements) for g in processed_data.groups.values())
        parts.append(f"包含 {total_measurements} 个测量值")

        total_results = sum(len(g.results) for g in processed_data.groups.values())
        parts.append(f"生成 {total_results} 个计算结果")

        issue_counts = {}
        for issue in processed_data.all_issues:
            issue_counts[issue.severity.value] = issue_counts.get(issue.severity.value, 0) + 1

        if issue_counts:
            parts.append("问题统计: " + ", ".join(f"{k}={v}" for k, v in issue_counts.items()))

        if self.corrections:
            parts.append(f"包含 {len(self.corrections)} 个人工修正")

        return "; ".join(parts)

    def get_history(self, file_name: Optional[str] = None, limit: int = 50) -> List:
        """获取历史记录"""
        return self.history_tracker.list_entries(file_name=file_name, limit=limit)

    def compare_history(self, entry_id1: int, entry_id2: int) -> Dict[str, Any]:
        """比较两条历史记录"""
        return self.history_tracker.compare_entries(entry_id1, entry_id2)

    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        return self.history_tracker.get_statistics()
