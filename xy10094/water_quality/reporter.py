"""HTML 报告生成模块"""

from dataclasses import dataclass
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
import json
import pandas as pd
from .charts import ChartGenerator, ChartResult


@dataclass
class ReportResult:
    """报告生成结果"""
    html_path: str
    success: bool
    message: str
    report_size_kb: float = 0


class ReportGenerator:
    """HTML 报告生成器"""

    def __init__(self, template_path: Optional[str] = None):
        self.chart_gen = ChartGenerator()

    def generate(
        self,
        output_path: str,
        data: pd.DataFrame,
        load_result,
        preprocess_result,
        qc_result,
        config_used: dict,
        title: str = "水质检测质控报告",
    ) -> ReportResult:
        """生成完整 HTML 报告"""
        try:
            charts = self.chart_gen.generate_all_charts(data, qc_result)

            sections = [
                self._section_header(title),
                self._section_overview(load_result, preprocess_result, qc_result),
            ]

            try:
                sections.append(self._section_charts(charts))
            except Exception as e:
                sections.append(f'<div class="section"><h2>📈 可视化分析</h2><p>图表生成失败: {str(e)}</p></div>')

            try:
                sections.append(self._section_data_preview(data))
            except Exception as e:
                sections.append(f'<div class="section"><h2>📋 数据预览</h2><p>预览生成失败: {str(e)}</p></div>')

            try:
                sections.append(self._section_load_issues(load_result))
            except Exception:
                pass

            try:
                sections.append(self._section_preprocess_issues(preprocess_result))
            except Exception:
                pass

            try:
                sections.append(self._section_qc_detail(qc_result))
            except Exception as e:
                sections.append(f'<div class="section"><h2>✅ 质控检查详情</h2><p>详情生成失败: {str(e)}</p></div>')

            try:
                sections.append(self._section_failures_detail(qc_result))
            except Exception as e:
                sections.append(f'<div class="section"><h2>❌ 失败样本</h2><p>失败详情生成失败: {str(e)}</p></div>')

            try:
                sections.append(self._section_config(config_used))
            except Exception:
                pass

            sections.append(self._section_footer())

            html = self._wrap_html(title, "\n".join(sections))

            path = Path(output_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(html, encoding="utf-8")

            size_kb = path.stat().st_size / 1024

            return ReportResult(
                html_path=str(path),
                success=True,
                message=f"报告已生成: {path}",
                report_size_kb=size_kb,
            )

        except Exception as e:
            import traceback
            tb_str = traceback.format_exc()
            return ReportResult(
                html_path=output_path,
                success=False,
                message=f"报告生成失败: {str(e)}\n{tb_str}",
            )

    def _build_html(
        self,
        title: str,
        data: pd.DataFrame,
        load_result,
        preprocess_result,
        qc_result,
        config_used: dict,
        charts: List[ChartResult],
    ) -> str:
        """构建完整 HTML"""
        sections = [
            self._section_header(title),
            self._section_overview(load_result, preprocess_result, qc_result),
            self._section_charts(charts),
            self._section_data_preview(data),
            self._section_load_issues(load_result),
            self._section_preprocess_issues(preprocess_result),
            self._section_qc_detail(qc_result),
            self._section_failures_detail(qc_result),
            self._section_config(config_used),
            self._section_footer(),
        ]

        return self._wrap_html(title, "\n".join(sections))

    def _wrap_html(self, title: str, content: str) -> str:
        """包装 HTML 模板"""
        return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        * {{ box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
            margin: 0;
            padding: 0;
            background: #f5f7fa;
            color: #333;
            line-height: 1.6;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }}
        .header {{
            background: linear-gradient(135deg, #1565C0 0%, #1976D2 100%);
            color: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 20px;
            box-shadow: 0 4px 12px rgba(21, 101, 192, 0.2);
        }}
        .header h1 {{ margin: 0; font-size: 28px; }}
        .header .meta {{ margin-top: 10px; opacity: 0.9; font-size: 14px; }}
        .section {{
            background: white;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }}
        .section h2 {{
            margin-top: 0;
            color: #1565C0;
            border-bottom: 2px solid #E3F2FD;
            padding-bottom: 12px;
            font-size: 20px;
        }}
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 16px;
            margin-top: 16px;
        }}
        .stat-card {{
            background: #FAFAFA;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
            border-left: 4px solid #1976D2;
        }}
        .stat-card.pass {{ border-left-color: #4CAF50; }}
        .stat-card.fail {{ border-left-color: #F44336; }}
        .stat-card.warning {{ border-left-color: #FF9800; }}
        .stat-card .value {{ font-size: 28px; font-weight: bold; color: #1565C0; }}
        .stat-card.pass .value {{ color: #4CAF50; }}
        .stat-card.fail .value {{ color: #F44336; }}
        .stat-card.warning .value {{ color: #FF9800; }}
        .stat-card .label {{ font-size: 14px; color: #666; margin-top: 4px; }}
        .charts-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
            margin-top: 16px;
        }}
        .chart-card {{
            background: #FAFAFA;
            border-radius: 8px;
            padding: 16px;
        }}
        .chart-card h3 {{ margin-top: 0; font-size: 14px; color: #555; }}
        .chart-card img {{ width: 100%; height: auto; border-radius: 4px; }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 16px;
            font-size: 13px;
        }}
        th, td {{
            padding: 12px 10px;
            text-align: left;
            border-bottom: 1px solid #EEE;
        }}
        th {{
            background: #F5F7FA;
            font-weight: 600;
            color: #333;
            position: sticky;
            top: 0;
        }}
        tr:hover {{ background: #FAFAFA; }}
        .table-container {{
            max-height: 400px;
            overflow-y: auto;
            border: 1px solid #EEE;
            border-radius: 8px;
        }}
        .badge {{
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
        }}
        .badge-pass {{ background: #E8F5E9; color: #2E7D32; }}
        .badge-fail {{ background: #FFEBEE; color: #C62828; }}
        .badge-warning {{ background: #FFF3E0; color: #E65100; }}
        .badge-info {{ background: #E3F2FD; color: #1565C0; }}
        .issue-list {{ list-style: none; padding: 0; margin: 16px 0 0 0; }}
        .issue-item {{
            padding: 12px;
            margin-bottom: 8px;
            border-radius: 8px;
            border-left: 4px solid;
        }}
        .issue-item.error {{ border-left-color: #F44336; background: #FFEBEE; }}
        .issue-item.warning {{ border-left-color: #FF9800; background: #FFF3E0; }}
        .issue-item.info {{ border-left-color: #2196F3; background: #E3F2FD; }}
        .issue-item .type {{ font-weight: 600; font-size: 13px; }}
        .issue-item .msg {{ font-size: 13px; margin-top: 4px; color: #555; }}
        .failure-card {{
            background: #FFF8F8;
            border: 1px solid #FFCDD2;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
        }}
        .failure-card .header-row {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }}
        .failure-card .sample-info {{ font-weight: 600; color: #C62828; }}
        .failure-card .rule {{ font-size: 12px; color: #666; }}
        .failure-card .message {{
            background: white;
            padding: 10px;
            border-radius: 6px;
            margin-top: 8px;
            font-family: monospace;
            font-size: 12px;
        }}
        .failure-card .details {{
            margin-top: 8px;
            font-size: 12px;
            color: #555;
        }}
        .config-json {{
            background: #FAFAFA;
            padding: 16px;
            border-radius: 8px;
            font-family: "Consolas", monospace;
            font-size: 12px;
            white-space: pre-wrap;
            overflow-x: auto;
            margin-top: 16px;
        }}
        .tabs {{ display: flex; border-bottom: 2px solid #EEE; margin-bottom: 16px; }}
        .tab {{
            padding: 10px 20px;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            margin-bottom: -2px;
        }}
        .tab.active {{ border-bottom-color: #1976D2; color: #1565C0; font-weight: 600; }}
        .tab-content {{ display: none; }}
        .tab-content.active {{ display: block; }}
        .footer {{
            text-align: center;
            padding: 20px;
            color: #888;
            font-size: 12px;
        }}
        .empty-state {{
            text-align: center;
            padding: 40px;
            color: #999;
        }}
    </style>
</head>
<body>
    <div class="container">
        {content}
    </div>
</body>
</html>
"""

    def _section_header(self, title: str) -> str:
        """报告头部"""
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return f"""
        <div class="header">
            <h1>💧 {title}</h1>
            <div class="meta">
                报告生成时间: {now} | 版本: 1.0.0
            </div>
        </div>
        """

    def _section_overview(self, load_result, preprocess_result, qc_result) -> str:
        """概览统计"""
        summary = qc_result.to_summary_dict()

        load_success = load_result.success if load_result else True
        total_rows = preprocess_result.original_rows if preprocess_result else 0
        valid_rows = preprocess_result.cleaned_rows if preprocess_result else 0

        stat_cards = [
            ("总数据行数", str(total_rows), ""),
            ("有效数据行", str(valid_rows), "pass" if valid_rows > 0 else ""),
            ("质控检查", f"{summary['passed_checks']}/{summary['total_checks']}", 
             "pass" if summary['passed_checks'] == summary['total_checks'] else "fail"),
            ("失败样本", str(summary['total_failures']), 
             "pass" if summary['total_failures'] == 0 else "fail"),
        ]

        cards_html = "\n".join([
            f"""
            <div class="stat-card{' ' + cls if cls else ''}">
                <div class="value">{value}</div>
                <div class="label">{label}</div>
            </div>
            """
            for label, value, cls in stat_cards
        ])

        return f"""
        <div class="section">
            <h2>📊 质控概览</h2>
            <div class="stats-grid">
                {cards_html}
            </div>
        </div>
        """

    def _section_charts(self, charts: List[ChartResult]) -> str:
        """图表区域"""
        if not charts:
            return ""

        chart_cards = []
        for chart in charts:
            if not chart.image_base64:
                continue
            chart_cards.append(f"""
            <div class="chart-card">
                <h3>{chart.title}</h3>
                <img src="data:image/png;base64,{chart.image_base64}" alt="{chart.title}">
                <p style="font-size:12px;color:#888;margin-top:8px;">{chart.description}</p>
            </div>
            """)

        if not chart_cards:
            return ""

        return f"""
        <div class="section">
            <h2>📈 可视化分析</h2>
            <div class="charts-grid">
                {"".join(chart_cards)}
            </div>
        </div>
        """

    def _section_data_preview(self, data: pd.DataFrame) -> str:
        """数据预览"""
        if data.empty:
            return ""

        preview_df = data.head(20).copy()

        rows_html = []
        for idx, row in preview_df.iterrows():
            cells = "".join([f"<td>{self._escape_html(str(v))}</td>" for v in row.values])
            rows_html.append(f"<tr>{cells}</tr>")

        header_html = "".join([f"<th>{self._escape_html(str(c))}</th>" for c in preview_df.columns])

        return f"""
        <div class="section">
            <h2>📋 数据预览 (前 {len(preview_df)} 行)</h2>
            <div class="table-container">
                <table>
                    <thead><tr>{header_html}</tr></thead>
                    <tbody>{"".join(rows_html)}</tbody>
                </table>
            </div>
            <p style="font-size:12px;color:#888;margin-top:10px;">共 {len(data)} 行数据</p>
        </div>
        """

    def _section_load_issues(self, load_result) -> str:
        """加载问题"""
        if not load_result or not load_result.issues:
            return ""

        issues_html = []
        for issue in load_result.issues:
            severity = "info"
            if issue.type.startswith("critical"):
                severity = "error"
            elif issue.type.startswith("warning"):
                severity = "warning"

            issues_html.append(f"""
            <li class="issue-item {severity}">
                <div class="type">{issue.type}</div>
                <div class="msg">{self._escape_html(issue.message)}</div>
                {f'<div style="font-size:11px;color:#777;margin-top:4px;">位置: {self._escape_html(str(issue.location))}</div>' if issue.location else ''}
            </li>
            """)

        return f"""
        <div class="section">
            <h2>⚠️ 数据加载问题</h2>
            <ul class="issue-list">
                {"".join(issues_html)}
            </ul>
        </div>
        """

    def _section_preprocess_issues(self, preprocess_result) -> str:
        """预处理问题"""
        if not preprocess_result or not preprocess_result.issues:
            return ""

        issues_html = []
        for issue in preprocess_result.issues:
            severity_map = {"error": "error", "warning": "warning", "info": "info"}
            severity = severity_map.get(issue.severity, "info")

            details = ""
            if issue.details:
                details_str = json.dumps(issue.details, ensure_ascii=False, indent=2)
                details = f'<div style="font-size:11px;color:#777;margin-top:4px;">详情: {self._escape_html(details_str)}</div>'

            issues_html.append(f"""
            <li class="issue-item {severity}">
                <div class="type">[{issue.severity.upper()}] {issue.type}</div>
                <div class="msg">{self._escape_html(issue.message)}</div>
                {details}
            </li>
            """)

        summary = preprocess_result.to_summary()
        summary_html = self._dict_to_html(summary)

        return f"""
        <div class="section">
            <h2>🔧 数据预处理</h2>
            {summary_html}
            <ul class="issue-list">
                {"".join(issues_html)}
            </ul>
        </div>
        """

    def _section_qc_detail(self, qc_result) -> str:
        """质控检查详情"""
        if not qc_result.checks:
            return ""

        checks_html = []
        for check in qc_result.checks:
            badge_class = "badge-pass" if check.passed else "badge-fail"
            badge_text = "通过" if check.passed else "不通过"

            calc_log = ""
            if check.calculation_log:
                calc_str = json.dumps(check.calculation_log, ensure_ascii=False, indent=2)
                calc_log = f"""
                <div style="margin-top:12px;">
                    <button onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='block'?'none':'block'" 
                            style="padding:6px 12px;background:#E3F2FD;border:none;border-radius:4px;cursor:pointer;color:#1565C0;font-size:12px;">
                        显示计算日志 ▼
                    </button>
                    <div style="display:none;background:#FAFAFA;padding:12px;font-family:monospace;font-size:11px;white-space:pre-wrap;margin-top:8px;border-radius:4px;">
                        {self._escape_html(calc_str)}
                    </div>
                </div>
                """

            checks_html.append(f"""
            <div class="stat-card {'pass' if check.passed else 'fail'}" style="text-align:left;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <strong>{check.rule_name}</strong>
                        <div style="font-size:12px;color:#666;">样品类型: {check.sample_type}</div>
                    </div>
                    <span class="badge {badge_class}">{badge_text}</span>
                </div>
                <div style="font-size:12px;color:#888;margin-top:8px;">
                    失败数量: {len(check.failures)}
                </div>
                {calc_log}
            </div>
            """)

        return f"""
        <div class="section">
            <h2>✅ 质控检查详情</h2>
            <div class="stats-grid">
                {"".join(checks_html)}
            </div>
        </div>
        """

    def _section_failures_detail(self, qc_result) -> str:
        """失败样本详情 - 保留失败原因"""
        if not qc_result.failures:
            return f"""
            <div class="section">
                <h2>❌ 失败样本</h2>
                <div class="empty-state">
                    🎉 所有样本均通过质控检查
                </div>
            </div>
            """

        failures_html = []
        for i, failure in enumerate(qc_result.failures, 1):
            range_text = ""
            if failure.expected_range:
                range_text = f"范围: [{failure.expected_range[0]}, {failure.expected_range[1]}]"

            calc_text = ""
            if failure.calculated_value is not None:
                calc_text = f"计算值: {failure.calculated_value}"

            raw_data_text = ""
            if failure.raw_data:
                raw_str = json.dumps(failure.raw_data, ensure_ascii=False, indent=2)
                raw_data_text = f"""
                <div class="details">
                    <strong>原始数据:</strong>
                    <pre style="background:white;padding:8px;border-radius:4px;margin:4px 0 0 0;font-size:11px;">
{self._escape_html(raw_str)}
                    </pre>
                </div>
                """

            failures_html.append(f"""
            <div class="failure-card">
                <div class="header-row">
                    <span class="sample-info">#{i} | {failure.sample_id} - {failure.parameter}</span>
                    <span class="badge badge-fail">{failure.sample_type}</span>
                </div>
                <div class="rule">
                    <span class="badge badge-info">{failure.rule_name}</span>
                    <span style="margin-left:8px;">失败类型: {failure.failure_type}</span>
                </div>
                <div class="message">{self._escape_html(failure.message)}</div>
                <div class="details">
                    {f'检测值: {failure.value}' if failure.value is not None else ''}
                    {f' | {range_text}' if range_text else ''}
                    {f' | {calc_text}' if calc_text else ''}
                    {f' | 阈值: {failure.threshold}' if failure.threshold is not None else ''}
                </div>
                <div class="details">
                    影响行号: {failure.affected_indices} | 时间: {failure.timestamp}
                </div>
                {raw_data_text}
            </div>
            """)

        return f"""
        <div class="section">
            <h2>❌ 失败样本详情 (共 {len(qc_result.failures)} 个)</h2>
            <p style="font-size:13px;color:#666;">所有失败样本均已保留详细原因，未被丢弃</p>
            {"".join(failures_html)}
        </div>
        """

    def _section_config(self, config_used: dict) -> str:
        """使用的配置 - 用于复算"""
        if not config_used:
            return ""

        import numpy as np

        def numpy_encoder(obj):
            if isinstance(obj, np.integer):
                return int(obj)
            elif isinstance(obj, np.floating):
                return float(obj)
            elif isinstance(obj, np.ndarray):
                return obj.tolist()
            elif isinstance(obj, np.bool_):
                return bool(obj)
            raise TypeError(f"Type {type(obj)} not serializable")

        try:
            config_json = json.dumps(config_used, ensure_ascii=False, indent=2, default=numpy_encoder)
        except Exception:
            config_json = str(config_used)

        return f"""
        <div class="section">
            <h2>⚙️ 质控配置 (可复算)</h2>
            <p style="font-size:13px;color:#666;">以下是本次质控使用的完整参数，可用于复现计算</p>
            <div class="config-json">{self._escape_html(config_json)}</div>
        </div>
        """

    def _section_footer(self) -> str:
        """页脚"""
        return """
        <div class="footer">
            本报告由「水质检测质控报告器」自动生成<br>
            所有失败样本均已记录在案，未被丢弃，可追溯 | 配置参数已保存，可复算
        </div>
        """

    def _dict_to_html(self, data: dict) -> str:
        """字典转简单 HTML"""
        import numpy as np

        def numpy_encoder(obj):
            if isinstance(obj, np.integer):
                return int(obj)
            elif isinstance(obj, np.floating):
                return float(obj)
            elif isinstance(obj, np.ndarray):
                return obj.tolist()
            elif isinstance(obj, np.bool_):
                return bool(obj)
            raise TypeError(f"Type {type(obj)} not serializable")

        items = []
        for k, v in data.items():
            if isinstance(v, dict):
                try:
                    v_str = json.dumps(v, ensure_ascii=False, default=numpy_encoder)
                except Exception:
                    v_str = str(v)
            else:
                v_str = str(v)
            items.append(f"<span style='margin-right:20px;'><strong>{k}:</strong> {self._escape_html(v_str)}</span>")
        return f"<div style='font-size:13px;color:#555;margin-top:8px;'>{' '.join(items)}</div>"

    def _escape_html(self, text: str) -> str:
        """HTML 转义"""
        if not isinstance(text, str):
            text = str(text)
        return (text.replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                    .replace('"', "&quot;")
                    .replace("'", "&#39;"))
