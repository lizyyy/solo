"""
报告导出模块
- 保留所有计算参数，确保可复现
- 支持多种导出格式（Excel、CSV、JSON、HTML）
- 支持筛选条件导出，换筛选条件后可复现
"""
import os
import json
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from datetime import datetime
import pandas as pd
import numpy as np

try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import matplotlib
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False

from .exceptions import ReportExportError, create_error_location
from .models import (
    CalibrationParams,
    DataSource,
)
from .probability_test import TestResult
from .data_cleaning import CleaningResult
from .utils import safe_json_dump, safe_json_dumps
from .anomaly_detection import AnomalyReport, AnomalyItem
from .config_comparison import ComparisonResult, ComparisonItem


@dataclass
class ExportConfig:
    """导出配置"""
    output_dir: str = "./reports"
    report_name: str = "drop_calibration_report"
    include_charts: bool = True
    include_raw_data: bool = False
    include_params: bool = True
    include_anomalies: bool = True
    include_data_sources: bool = True
    formats: List[str] = field(default_factory=lambda: ["xlsx", "json"])
    chart_dpi: int = 150
    language: str = "zh_CN"


class ReportExporter:
    """
    报告导出器
    保留所有计算参数，确保可复现
    """

    def __init__(self, fail_fast: bool = False):
        self.fail_fast = fail_fast

    def export(
        self,
        comparison_result: ComparisonResult,
        test_result: TestResult,
        cleaning_result: CleaningResult,
        anomaly_report: AnomalyReport,
        data_sources: List[DataSource],
        export_config: Optional[ExportConfig] = None,
    ) -> Dict[str, str]:
        """
        导出完整报告
        :return: 导出的文件路径字典
        """
        export_config = export_config or ExportConfig()

        os.makedirs(export_config.output_dir, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filter_hash = test_result.filter_hash[:8]
        base_name = f"{export_config.report_name}_{timestamp}_{filter_hash}"

        exported_files: Dict[str, str] = {}

        try:
            if "xlsx" in export_config.formats:
                xlsx_path = self._export_excel(
                    comparison_result, test_result, cleaning_result,
                    anomaly_report, data_sources, export_config, base_name
                )
                exported_files["xlsx"] = xlsx_path

            if "csv" in export_config.formats:
                csv_path = self._export_csv(
                    comparison_result, export_config, base_name
                )
                exported_files["csv"] = csv_path

            if "json" in export_config.formats:
                json_path = self._export_json(
                    comparison_result, test_result, cleaning_result,
                    anomaly_report, data_sources, export_config, base_name
                )
                exported_files["json"] = json_path

            if "html" in export_config.formats:
                html_path = self._export_html(
                    comparison_result, test_result, cleaning_result,
                    anomaly_report, data_sources, export_config, base_name
                )
                exported_files["html"] = html_path

            if export_config.include_charts and HAS_MATPLOTLIB:
                chart_files = self._export_charts(
                    comparison_result, test_result, export_config, base_name
                )
                exported_files.update(chart_files)

        except Exception as e:
            error = ReportExportError(
                f"导出报告失败: {str(e)}",
                location=create_error_location(
                    extra_info={"formats": export_config.formats}
                )
            )
            if self.fail_fast:
                raise error
            return {"error": str(error)}

        return exported_files

    def export_params(
        self,
        params: CalibrationParams,
        output_path: str,
    ) -> str:
        """
        导出计算参数为JSON，用于复现
        """
        try:
            params_dict = params.to_dict()
            params_dict["filter_hash"] = params.get_filter_hash()

            os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
            with open(output_path, "w", encoding="utf-8") as f:
                safe_json_dump(params_dict, f, indent=2, ensure_ascii=False)

            return output_path
        except Exception as e:
            error = ReportExportError(
                f"导出参数失败: {str(e)}",
                location=create_error_location(file_path=output_path)
            )
            if self.fail_fast:
                raise error
            return ""

    def load_params(
        self,
        input_path: str,
    ) -> Optional[CalibrationParams]:
        """
        从JSON加载参数，用于复现
        """
        try:
            with open(input_path, "r", encoding="utf-8") as f:
                params_dict = json.load(f)

            params = CalibrationParams()
            for key, value in params_dict.items():
                if key == "filter_hash":
                    continue
                if hasattr(params, key):
                    if key in ["start_time", "end_time", "created_time"] and value:
                        value = datetime.fromisoformat(value)
                    setattr(params, key, value)

            return params
        except Exception as e:
            error = ReportExportError(
                f"加载参数失败: {str(e)}",
                location=create_error_location(file_path=input_path)
            )
            if self.fail_fast:
                raise error
            return None

    def _export_excel(
        self,
        comparison_result: ComparisonResult,
        test_result: TestResult,
        cleaning_result: CleaningResult,
        anomaly_report: AnomalyReport,
        data_sources: List[DataSource],
        export_config: ExportConfig,
        base_name: str,
    ) -> str:
        """导出Excel报告"""
        output_path = os.path.join(export_config.output_dir, f"{base_name}.xlsx")

        with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
            df_comparison = comparison_result.to_dataframe()
            df_comparison.to_excel(writer, sheet_name="概率对比", index=False)

            if export_config.include_params:
                params_dict = test_result.params.to_dict()
                params_dict["filter_hash"] = test_result.filter_hash
                df_params = pd.DataFrame([
                    {"参数": k, "值": str(v)}
                    for k, v in params_dict.items()
                ])
                df_params.to_excel(writer, sheet_name="计算参数", index=False)

            if export_config.include_anomalies:
                anomaly_rows = []
                for anomaly in anomaly_report.anomalies:
                    row = anomaly.to_dict()
                    row["related_data"] = safe_json_dumps(
                        row.get("related_data", {}), ensure_ascii=False
                    )
                    anomaly_rows.append(row)
                if anomaly_rows:
                    df_anomalies = pd.DataFrame(anomaly_rows)
                    df_anomalies.to_excel(writer, sheet_name="异常检测", index=False)

                summary_rows = [
                    {"指标": "异常总数", "数值": anomaly_report.total_anomalies},
                    {"指标": "严重异常", "数值": anomaly_report.critical_count},
                    {"指标": "警告异常", "数值": anomaly_report.warning_count},
                    {"指标": "信息异常", "数值": anomaly_report.info_count},
                ]
                df_summary = pd.DataFrame(summary_rows)
                df_summary.to_excel(writer, sheet_name="异常汇总", index=False)

            if export_config.include_data_sources:
                source_rows = [s.to_dict() for s in data_sources]
                if source_rows:
                    df_sources = pd.DataFrame(source_rows)
                    df_sources.to_excel(writer, sheet_name="数据源", index=False)

            df_cleaning = pd.DataFrame([
                {"清洗步骤": "去重", "总记录数": cleaning_result.deduplicate.total_records,
                 "重复记录": cleaning_result.deduplicate.duplicate_count,
                 "唯一记录": cleaning_result.deduplicate.unique_count},
                {"清洗步骤": "活动加成", "总记录数": cleaning_result.activity_bonus.total_records,
                 "应用活动": cleaning_result.activity_bonus.records_with_activity,
                 "无活动": cleaning_result.activity_bonus.records_without_activity},
            ])
            df_cleaning.to_excel(writer, sheet_name="数据清洗", index=False)

            if export_config.include_raw_data and test_result.group_stats:
                group_rows = []
                for gs in test_result.group_stats:
                    row = dict(gs.group_labels)
                    row.update({
                        "总尝试次数": gs.total_attempts,
                        "总掉落次数": gs.total_drops,
                        "观测概率": gs.observed_probability,
                        "期望概率": gs.expected_probability,
                        "偏差": gs.deviation,
                        "偏差百分比": gs.deviation_percent,
                        "置信区间下限": gs.confidence_lower,
                        "置信区间上限": gs.confidence_upper,
                        "道具数量": gs.item_count,
                    })
                    if gs.chi_square:
                        row["卡方值"] = gs.chi_square.get("chi2_statistic", "")
                        row["P值"] = gs.chi_square.get("p_value", "")
                        row["显著"] = gs.chi_square.get("significant", "")
                    group_rows.append(row)
                if group_rows:
                    df_groups = pd.DataFrame(group_rows)
                    df_groups.to_excel(writer, sheet_name="分组统计", index=False)

            if cleaning_result.warnings:
                df_warnings = pd.DataFrame([
                    {"警告": w} for w in cleaning_result.warnings
                ])
                df_warnings.to_excel(writer, sheet_name="数据警告", index=False)

        return output_path

    def _export_csv(
        self,
        comparison_result: ComparisonResult,
        export_config: ExportConfig,
        base_name: str,
    ) -> str:
        """导出CSV报告"""
        output_path = os.path.join(export_config.output_dir, f"{base_name}.csv")
        df = comparison_result.to_dataframe()
        df.to_csv(output_path, index=False, encoding="utf-8-sig")
        return output_path

    def _export_json(
        self,
        comparison_result: ComparisonResult,
        test_result: TestResult,
        cleaning_result: CleaningResult,
        anomaly_report: AnomalyReport,
        data_sources: List[DataSource],
        export_config: ExportConfig,
        base_name: str,
    ) -> str:
        """导出JSON报告"""
        output_path = os.path.join(export_config.output_dir, f"{base_name}.json")

        report_data: Dict[str, Any] = {
            "report_info": {
                "generated_at": datetime.now().isoformat(),
                "filter_hash": test_result.filter_hash,
                "version": "1.0",
            },
            "summary": comparison_result.overall_summary,
            "params": test_result.params.to_dict(),
            "probability_comparison": [],
        }

        for pool_id, pool in comparison_result.pools.items():
            pool_data = {
                "pool_id": pool_id,
                "pool_name": pool.pool_name,
                "total_attempts": pool.total_attempts,
                "total_items": pool.total_items,
                "chi_square_statistic": pool.chi_square_statistic,
                "chi_square_p_value": pool.chi_square_p_value,
                "is_distribution_significant": pool.is_distribution_significant,
                "items": [],
            }

            for item in pool.items:
                pool_data["items"].append({
                    "item_id": item.item_id,
                    "item_name": item.item_name,
                    "config_probability": item.config_probability,
                    "actual_probability": item.actual_probability,
                    "deviation": item.deviation,
                    "deviation_percent": item.deviation_percent,
                    "confidence_interval": [item.confidence_lower, item.confidence_upper],
                    "p_value": item.p_value,
                    "is_significant": item.is_significant,
                    "status": item.status,
                    "total_attempts": item.total_attempts,
                    "drop_count": item.actual_drop_count,
                    "activity_multiplier": item.activity_multiplier,
                })

            report_data["probability_comparison"].append(pool_data)

        if export_config.include_anomalies:
            report_data["anomalies"] = [
                a.to_dict() for a in anomaly_report.anomalies
            ]
            report_data["anomaly_summary"] = {
                "total": anomaly_report.total_anomalies,
                "critical": anomaly_report.critical_count,
                "warning": anomaly_report.warning_count,
                "info": anomaly_report.info_count,
            }

        if export_config.include_data_sources:
            report_data["data_sources"] = [s.to_dict() for s in data_sources]

        if export_config.include_raw_data:
            report_data["cleaning_result"] = {
                "deduplicate": {
                    "total": cleaning_result.deduplicate.total_records,
                    "duplicates": cleaning_result.deduplicate.duplicate_count,
                    "unique": cleaning_result.deduplicate.unique_count,
                },
                "activity_bonus": {
                    "total": cleaning_result.activity_bonus.total_records,
                    "with_activity": cleaning_result.activity_bonus.records_with_activity,
                    "without_activity": cleaning_result.activity_bonus.records_without_activity,
                    "average_multiplier": cleaning_result.activity_bonus.average_multiplier,
                },
                "warnings": cleaning_result.warnings,
            }

        with open(output_path, "w", encoding="utf-8") as f:
            safe_json_dump(report_data, f, indent=2, ensure_ascii=False)

        return output_path

    def _export_html(
        self,
        comparison_result: ComparisonResult,
        test_result: TestResult,
        cleaning_result: CleaningResult,
        anomaly_report: AnomalyReport,
        data_sources: List[DataSource],
        export_config: ExportConfig,
        base_name: str,
    ) -> str:
        """导出HTML报告"""
        output_path = os.path.join(export_config.output_dir, f"{base_name}.html")

        html_content = self._generate_html_report(
            comparison_result, test_result, cleaning_result,
            anomaly_report, data_sources, export_config
        )

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html_content)

        return output_path

    def _generate_html_report(
        self,
        comparison_result: ComparisonResult,
        test_result: TestResult,
        cleaning_result: CleaningResult,
        anomaly_report: AnomalyReport,
        data_sources: List[DataSource],
        export_config: ExportConfig,
    ) -> str:
        """生成HTML报告内容"""
        summary = comparison_result.overall_summary

        level_colors = {
            "critical": "#dc2626",
            "warning": "#f59e0b",
            "info": "#3b82f6",
            "normal": "#10b981",
        }

        status_labels = {
            "critical": "严重异常",
            "warning": "警告",
            "critical_not_significant": "严重偏差(样本不足)",
            "warning_not_significant": "轻微偏差(样本不足)",
            "normal": "正常",
        }

        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>游戏掉落概率校准报告</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f8fafc; color: #1e293b; }}
        .container {{ max-width: 1400px; margin: 0 auto; }}
        h1 {{ color: #1e293b; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }}
        h2 {{ color: #334155; margin-top: 30px; border-left: 4px solid #3b82f6; padding-left: 10px; }}
        h3 {{ color: #475569; }}
        .summary-cards {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }}
        .card {{ background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
        .card-value {{ font-size: 28px; font-weight: bold; color: #3b82f6; }}
        .card-label {{ color: #64748b; font-size: 14px; }}
        .critical .card-value {{ color: #dc2626; }}
        .warning .card-value {{ color: #f59e0b; }}
        table {{ width: 100%; border-collapse: collapse; margin: 15px 0; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
        th, td {{ padding: 12px 15px; text-align: left; border-bottom: 1px solid #e2e8f0; }}
        th {{ background: #f1f5f9; font-weight: 600; color: #475569; }}
        tr:hover {{ background: #f8fafc; }}
        .status-badge {{ display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }}
        .status-critical {{ background: #fef2f2; color: #dc2626; }}
        .status-warning {{ background: #fefce8; color: #f59e0b; }}
        .status-normal {{ background: #f0fdf4; color: #16a34a; }}
        .anomaly-item {{ background: white; padding: 15px; margin: 10px 0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-left: 4px solid #ccc; }}
        .anomaly-critical {{ border-left-color: #dc2626; }}
        .anomaly-warning {{ border-left-color: #f59e0b; }}
        .anomaly-info {{ border-left-color: #3b82f6; }}
        .anomaly-title {{ font-weight: 600; margin-bottom: 8px; }}
        .anomaly-desc {{ color: #475569; margin-bottom: 8px; white-space: pre-line; }}
        .anomaly-meta {{ font-size: 12px; color: #64748b; }}
        .params-section {{ background: #f8fafc; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 13px; overflow-x: auto; }}
        .source-item {{ background: white; padding: 12px; margin: 8px 0; border-radius: 6px; border-left: 3px solid #94a3b8; }}
        .deviation-positive {{ color: #16a34a; }}
        .deviation-negative {{ color: #dc2626; }}
        .filter-hash {{ background: #1e293b; color: #e2e8f0; padding: 8px 12px; border-radius: 4px; font-family: monospace; display: inline-block; margin: 10px 0; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🎮 游戏掉落概率校准报告</h1>
        <p>生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        <p>筛选条件哈希 (用于复现): <span class="filter-hash">{test_result.filter_hash}</span></p>

        <h2>📊 概览摘要</h2>
        <div class="summary-cards">
            <div class="card"><div class="card-value">{summary.get('total_pools', 0)}</div><div class="card-label">道具池数量</div></div>
            <div class="card"><div class="card-value">{summary.get('total_items', 0)}</div><div class="card-label">道具总数</div></div>
            <div class="card"><div class="card-value">{summary.get('total_attempts', 0):,}</div><div class="card-label">总抽取次数</div></div>
            <div class="card critical"><div class="card-value">{summary.get('critical_items', 0)}</div><div class="card-label">严重异常道具</div></div>
            <div class="card warning"><div class="card-value">{summary.get('warning_items', 0)}</div><div class="card-label">警告道具</div></div>
            <div class="card"><div class="card-value">{summary.get('significant_items', 0)}</div><div class="card-label">统计显著道具</div></div>
            <div class="card"><div class="card-value">{summary.get('average_abs_deviation_percent', 0):.1f}%</div><div class="card-label">平均绝对偏差</div></div>
        </div>
"""

        if anomaly_report.total_anomalies > 0:
            html += f"""
        <h2>⚠️ 异常检测 ({anomaly_report.total_anomalies} 个)</h2>
        <div class="summary-cards">
            <div class="card critical"><div class="card-value">{anomaly_report.critical_count}</div><div class="card-label">严重异常</div></div>
            <div class="card warning"><div class="card-value">{anomaly_report.warning_count}</div><div class="card-label">警告</div></div>
            <div class="card"><div class="card-value">{anomaly_report.info_count}</div><div class="card-label">提示信息</div></div>
        </div>
"""

            for anomaly in sorted(anomaly_report.anomalies, key=lambda x: {"critical": 0, "warning": 1, "info": 2}.get(x.level, 3)):
                level_class = f"anomaly-{anomaly.level}"
                html += f"""
        <div class="anomaly-item {level_class}">
            <div class="anomaly-title">[{anomaly.level.upper()}] {anomaly.title}</div>
            <div class="anomaly-desc">{anomaly.description}</div>
            <div class="anomaly-desc"><strong>原因分析:</strong><br>{anomaly.reason_analysis}</div>
            <div class="anomaly-desc"><strong>处理建议:</strong><br>{anomaly.suggestion}</div>
            <div class="anomaly-meta">
                异常ID: {anomaly.anomaly_id} |
                类型: {anomaly.anomaly_type} |
                {f'池子: {anomaly.pool_id}' if anomaly.pool_id else ''}
                {f'道具: {anomaly.item_id}' if anomaly.item_id else ''}
                {f'来源文件: {anomaly.source_file}' if anomaly.source_file else ''}
                {f'行号: {anomaly.source_row}' if anomaly.source_row else ''}
            </div>
        </div>
"""

        html += f"""
        <h2>📈 概率对比详情</h2>
"""

        for pool_id, pool in comparison_result.pools.items():
            sig_class = "status-critical" if pool.is_distribution_significant else "status-normal"
            sig_text = "分布显著偏离" if pool.is_distribution_significant else "分布正常"
            html += f"""
        <h3>{pool.pool_name} ({pool_id})</h3>
        <p>
            总抽取次数: <strong>{pool.total_attempts:,}</strong> |
            道具数量: <strong>{pool.total_items}</strong> |
            卡方值: <strong>{pool.chi_square_statistic:.4f}</strong> |
            P值: <strong>{pool.chi_square_p_value:.6f}</strong> |
            <span class="status-badge {sig_class}">{sig_text}</span>
        </p>
        <table>
            <thead>
                <tr>
                    <th>道具ID</th>
                    <th>道具名称</th>
                    <th>配置概率</th>
                    <th>实际概率</th>
                    <th>偏差</th>
                    <th>偏差%</th>
                    <th>置信区间</th>
                    <th>P值</th>
                    <th>样本量</th>
                    <th>状态</th>
                </tr>
            </thead>
            <tbody>
"""

            for item in sorted(pool.items, key=lambda x: abs(x.deviation_percent), reverse=True):
                status_class = f"status-{item.status.split('_')[0]}"
                status_text = status_labels.get(item.status, item.status)

                dev_class = "deviation-positive" if item.deviation >= 0 else "deviation-negative"
                dev_sign = "+" if item.deviation >= 0 else ""

                html += f"""
                <tr>
                    <td><code>{item.item_id}</code></td>
                    <td>{item.item_name}</td>
                    <td>{item.config_probability*100:.4f}%</td>
                    <td>{item.actual_probability*100:.4f}%</td>
                    <td class="{dev_class}">{dev_sign}{item.deviation*100:.4f}pp</td>
                    <td class="{dev_class}">{dev_sign}{item.deviation_percent:.2f}%</td>
                    <td>[{item.confidence_lower*100:.4f}%, {item.confidence_upper*100:.4f}%]</td>
                    <td>{item.p_value:.6f}</td>
                    <td>{item.total_attempts:,}</td>
                    <td><span class="status-badge {status_class}">{status_text}</span></td>
                </tr>
"""

            html += """
            </tbody>
        </table>
"""

        if export_config.include_params:
            html += f"""
        <h2>⚙️ 计算参数 (可复现)</h2>
        <p>使用相同参数可复现此报告。筛选条件哈希: <code>{test_result.filter_hash}</code></p>
        <div class="params-section">
{safe_json_dumps(test_result.params.to_dict(), indent=2, ensure_ascii=False)}
        </div>
"""

        if export_config.include_data_sources:
            html += f"""
        <h2>📁 数据源</h2>
"""
            for source in data_sources:
                html += f"""
        <div class="source-item">
            <strong>{source.source_type.value}</strong> - {source.file_name}
            {f'(工作表: {source.sheet_name})' if source.sheet_name else ''}<br>
            版本: {source.version} | 导入时间: {source.import_time.strftime('%Y-%m-%d %H:%M:%S')}<br>
            原始行数: {source.original_row_count} | 成功导入: {source.imported_row_count} | 跳过: {source.skipped_row_count}<br>
            路径: <code>{source.file_path}</code>
            {f'<br>备注: {source.import_notes}' if source.import_notes else ''}
        </div>
"""

        if cleaning_result.warnings:
            html += f"""
        <h2>⚠️ 数据警告</h2>
        <ul>
"""
            for warning in cleaning_result.warnings:
                html += f"            <li>{warning}</li>\n"
            html += "        </ul>\n"

        html += """
    </div>
</body>
</html>
"""

        return html

    def _export_charts(
        self,
        comparison_result: ComparisonResult,
        test_result: TestResult,
        export_config: ExportConfig,
        base_name: str,
    ) -> Dict[str, str]:
        """导出图表"""
        chart_files: Dict[str, str] = {}

        for pool_id, pool in comparison_result.pools.items():
            chart_path = self._create_pool_chart(
                pool, export_config, base_name
            )
            if chart_path:
                chart_files[f"chart_{pool_id}"] = chart_path

        if len(comparison_result.pools) > 1:
            overall_chart = self._create_overall_chart(
                comparison_result, export_config, base_name
            )
            if overall_chart:
                chart_files["chart_overall"] = overall_chart

        return chart_files

    def _create_pool_chart(
        self,
        pool,
        export_config: ExportConfig,
        base_name: str,
    ) -> Optional[str]:
        """创建单个道具池的对比图表"""
        try:
            items = sorted(pool.items, key=lambda x: x.config_probability, reverse=True)
            if not items:
                return None

            fig, ax = plt.subplots(figsize=(max(10, len(items) * 0.8), 6))

            item_names = [f"{i.item_name}\n({i.item_id})" for i in items]
            x = np.arange(len(items))
            width = 0.35

            config_probs = [i.config_probability * 100 for i in items]
            actual_probs = [i.actual_probability * 100 for i in items]

            bars1 = ax.bar(x - width/2, config_probs, width, label='配置概率', color='#3b82f6', alpha=0.8)
            bars2 = ax.bar(x + width/2, actual_probs, width, label='实际概率', color='#10b981', alpha=0.8)

            for i, item in enumerate(items):
                if item.is_significant:
                    ax.plot(x[i] + width/2, actual_probs[i] + max(actual_probs) * 0.02,
                            '*', color='#dc2626', markersize=10, label='统计显著' if i == 0 else "")

            ax.set_xlabel('道具')
            ax.set_ylabel('概率 (%)')
            ax.set_title(f'{pool.pool_name} - 配置概率 vs 实际概率')
            ax.set_xticks(x)
            ax.set_xticklabels(item_names, rotation=45, ha='right', fontsize=8)
            ax.legend()
            ax.grid(axis='y', alpha=0.3)

            plt.tight_layout()

            safe_pool_id = "".join(c for c in pool.pool_id if c.isalnum() or c in ('_', '-'))
            chart_path = os.path.join(
                export_config.output_dir,
                f"{base_name}_chart_{safe_pool_id}.png"
            )
            plt.savefig(chart_path, dpi=export_config.chart_dpi, bbox_inches='tight')
            plt.close()

            return chart_path
        except Exception as e:
            return None

    def _create_overall_chart(
        self,
        comparison_result: ComparisonResult,
        export_config: ExportConfig,
        base_name: str,
    ) -> Optional[str]:
        """创建总体偏差图表"""
        try:
            all_items = []
            for pool in comparison_result.pools.values():
                all_items.extend(pool.items)

            all_items = sorted(all_items, key=lambda x: x.deviation_percent, reverse=True)
            all_items = all_items[:30] if len(all_items) > 30 else all_items

            if not all_items:
                return None

            fig, ax = plt.subplots(figsize=(12, 6))

            labels = [f"{i.item_name}" for i in all_items]
            deviations = [i.deviation_percent for i in all_items]
            colors = ['#dc2626' if i.is_significant else '#f59e0b'
                     if abs(i.deviation_percent) > 10 else '#10b981'
                     for i in all_items]

            x = np.arange(len(labels))
            bars = ax.bar(x, deviations, color=colors, alpha=0.8)

            ax.axhline(y=0, color='#334155', linewidth=0.5)
            ax.axhline(y=10, color='#f59e0b', linestyle='--', alpha=0.5, label='警告阈值(+10%)')
            ax.axhline(y=-10, color='#f59e0b', linestyle='--', alpha=0.5, label='警告阈值(-10%)')
            ax.axhline(y=30, color='#dc2626', linestyle='--', alpha=0.5, label='严重阈值(+30%)')
            ax.axhline(y=-30, color='#dc2626', linestyle='--', alpha=0.5, label='严重阈值(-30%)')

            ax.set_xlabel('道具')
            ax.set_ylabel('偏差 (%)')
            ax.set_title(f'道具掉落概率偏差排行 (Top {len(all_items)})')
            ax.set_xticks(x)
            ax.set_xticklabels(labels, rotation=45, ha='right', fontsize=8)
            ax.legend()
            ax.grid(axis='y', alpha=0.3)

            plt.tight_layout()

            chart_path = os.path.join(
                export_config.output_dir,
                f"{base_name}_chart_overall.png"
            )
            plt.savefig(chart_path, dpi=export_config.chart_dpi, bbox_inches='tight')
            plt.close()

            return chart_path
        except Exception as e:
            return None
