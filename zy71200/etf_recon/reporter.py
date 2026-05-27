import json
from dataclasses import asdict
from datetime import date, datetime
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .models import ReconResult, DifferenceItem


class ResultReporter:
    def __init__(self):
        self.console = Console()

    def _get_severity_color(self, severity: str) -> str:
        return {
            "critical": "bright_red",
            "error": "red",
            "warning": "yellow",
            "info": "blue",
        }.get(severity, "white")

    def _get_severity_icon(self, severity: str) -> str:
        return {
            "critical": "🔴",
            "error": "❌",
            "warning": "⚠️",
            "info": "ℹ️",
        }.get(severity, "•")

    def print_terminal_summary(self, result: ReconResult):
        console = self.console

        status = "✅ 通过" if result.is_pass else "❌ 不通过"
        status_color = "green" if result.is_pass else "red"

        console.print(
            Panel.fit(
                Text(f"ETF申赎成分券差异校验报告", style="bold blue"),
                subtitle=f"{result.etf_code} - {result.trade_date}",
            )
        )

        console.print(f"\n📊 校验结果: [{status_color}]{status}[/{status_color}]")
        console.print(f"🏦 券商: {result.broker_name}")
        console.print(f"🕐 分析时间: {result.analysis_time.strftime('%Y-%m-%d %H:%M:%S')}")

        console.print("\n📈 统计摘要:")
        match_rate = result.component_match_count / result.component_total_count if result.component_total_count > 0 else 0
        console.print(f"  • 成分券匹配: {result.component_match_count}/{result.component_total_count} ({match_rate:.1%})")
        console.print(f"  • 现金核对: {'✅ 通过' if result.cash_match else '❌ 不通过'}")
        console.print(f"  • 预期现金总额: {result.expected_cash_total:.2f}")
        console.print(f"  • 实际现金总额: {result.actual_cash_total:.2f}")
        console.print(f"  • 差异数量: {len(result.differences)}")
        console.print(f"  • 异常数量: {len(result.anomalies)}")

        if result.anomalies:
            console.print(f"\n🚨 重点异常 ({len(result.anomalies)} 项):")
            table = Table(show_header=True, header_style="bold magenta")
            table.add_column("严重程度", width=10)
            table.add_column("证券代码", width=12)
            table.add_column("证券名称", width=15)
            table.add_column("异常类型", width=18)
            table.add_column("说明")

            for anomaly in result.anomalies:
                color = self._get_severity_color(anomaly.severity)
                icon = self._get_severity_icon(anomaly.severity)
                table.add_row(
                    f"[{color}]{icon} {anomaly.severity}[/{color}]",
                    anomaly.code,
                    anomaly.name,
                    anomaly.difference_type,
                    anomaly.explanation[:40] + "..." if len(anomaly.explanation) > 40 else anomaly.explanation,
                )
            console.print(table)

        if result.differences:
            console.print(f"\n📋 差异明细 ({len(result.differences)} 项):")
            table = Table(show_header=True, header_style="bold blue")
            table.add_column("严重程度", width=10)
            table.add_column("证券代码", width=12)
            table.add_column("证券名称", width=15)
            table.add_column("差异类型", width=15)
            table.add_column("预期值", width=15)
            table.add_column("实际值", width=15)

            for diff in result.differences:
                color = self._get_severity_color(diff.severity)
                icon = self._get_severity_icon(diff.severity)
                table.add_row(
                    f"[{color}]{icon} {diff.severity}[/{color}]",
                    diff.code,
                    diff.name,
                    diff.difference_type,
                    diff.expected,
                    diff.actual,
                )
            console.print(table)

        console.print("\n📝 处理流程:")
        for step in result.processing_steps:
            if step.startswith("步骤"):
                console.print(f"  [{step[:2]}] {step[3:]}")
            else:
                console.print(f"      {step}")

    def export_json(self, result: ReconResult, output_path: str) -> str:
        def serialize(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            if isinstance(obj, date):
                return obj.isoformat()
            if hasattr(obj, "value"):
                return obj.value
            raise TypeError(f"Type {type(obj)} not serializable")

        result_dict = asdict(result)
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)

        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(result_dict, f, ensure_ascii=False, indent=2, default=serialize)

        return str(output_file)

    def export_html_report(self, result: ReconResult, output_path: str) -> str:
        status_class = "pass" if result.is_pass else "fail"
        status_text = "通过" if result.is_pass else "不通过"

        def diff_row(diff: DifferenceItem) -> str:
            return f"""
            <tr class="row-{diff.severity}">
                <td><span class="severity-{diff.severity}">{diff.severity.upper()}</span></td>
                <td>{diff.code}</td>
                <td>{diff.name}</td>
                <td>{diff.difference_type}</td>
                <td>{diff.expected}</td>
                <td>{diff.actual}</td>
                <td>{diff.explanation}</td>
            </tr>"""

        anomalies_rows = "\n".join([diff_row(a) for a in result.anomalies]) if result.anomalies else ""
        differences_rows = "\n".join([diff_row(d) for d in result.differences]) if result.differences else ""
        steps_html = "\n".join([f"<li>{step}</li>" for step in result.processing_steps])
        sources_html = "\n".join([f"<li><strong>{k}:</strong> {v}</li>" for k, v in result.source_files.items()])

        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ETF申赎成分券差异校验报告</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; background: #f5f5f5; }}
        .container {{ max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        h1 {{ color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }}
        h2 {{ color: #34495e; margin-top: 30px; }}
        .status-badge {{ display: inline-block; padding: 8px 20px; border-radius: 20px; font-weight: bold; font-size: 18px; }}
        .status-pass {{ background: #27ae60; color: white; }}
        .status-fail {{ background: #e74c3c; color: white; }}
        .summary-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }}
        .summary-card {{ background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #3498db; }}
        .summary-card strong {{ color: #7f8c8d; font-size: 14px; }}
        .summary-card .value {{ font-size: 24px; font-weight: bold; color: #2c3e50; margin-top: 5px; }}
        table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
        th {{ background: #34495e; color: white; padding: 12px; text-align: left; }}
        td {{ padding: 10px; border-bottom: 1px solid #ddd; }}
        tr:hover {{ background: #f8f9fa; }}
        .row-critical {{ background: #fdecea; }}
        .row-error {{ background: #fff5f5; }}
        .row-warning {{ background: #fffbeb; }}
        .severity-critical {{ background: #e74c3c; color: white; padding: 3px 8px; border-radius: 4px; font-size: 12px; }}
        .severity-error {{ background: #c0392b; color: white; padding: 3px 8px; border-radius: 4px; font-size: 12px; }}
        .severity-warning {{ background: #f39c12; color: white; padding: 3px 8px; border-radius: 4px; font-size: 12px; }}
        .severity-info {{ background: #3498db; color: white; padding: 3px 8px; border-radius: 4px; font-size: 12px; }}
        .processing-steps {{ background: #f8f9fa; padding: 20px; border-radius: 8px; }}
        .processing-steps ol {{ margin: 0; padding-left: 20px; }}
        .processing-steps li {{ margin: 8px 0; color: #34495e; }}
        .sources {{ background: #e8f4f8; padding: 15px; border-radius: 8px; margin-top: 20px; }}
        .sources ul {{ margin: 0; padding-left: 20px; }}
        .footer {{ margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #7f8c8d; font-size: 14px; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 ETF申赎成分券差异校验报告</h1>

        <div style="display: flex; justify-content: space-between; align-items: center; margin: 20px 0;">
            <div>
                <strong>ETF代码:</strong> {result.etf_code}<br>
                <strong>交易日期:</strong> {result.trade_date}<br>
                <strong>券商:</strong> {result.broker_name}
            </div>
            <div class="status-badge status-{status_class}">{status_text}</div>
        </div>

        <h2>📈 统计摘要</h2>
        <div class="summary-grid">
            <div class="summary-card">
                <strong>成分券匹配</strong>
                <div class="value">{result.component_match_count}/{result.component_total_count}</div>
            </div>
            <div class="summary-card">
                <strong>现金核对</strong>
                <div class="value">{'✅ 通过' if result.cash_match else '❌ 不通过'}</div>
            </div>
            <div class="summary-card">
                <strong>预期现金总额</strong>
                <div class="value">¥{result.expected_cash_total:,.2f}</div>
            </div>
            <div class="summary-card">
                <strong>实际现金总额</strong>
                <div class="value">¥{result.actual_cash_total:,.2f}</div>
            </div>
            <div class="summary-card">
                <strong>差异数量</strong>
                <div class="value">{len(result.differences)}</div>
            </div>
            <div class="summary-card">
                <strong>异常数量</strong>
                <div class="value">{len(result.anomalies)}</div>
            </div>
        </div>

        <h2>🚨 重点异常</h2>
        {"<table><tr><th>严重程度</th><th>证券代码</th><th>证券名称</th><th>异常类型</th><th>预期值</th><th>实际值</th><th>说明</th></tr>" + anomalies_rows + "</table>" if result.anomalies else "<p>无异常</p>"}

        <h2>📋 差异明细</h2>
        {"<table><tr><th>严重程度</th><th>证券代码</th><th>证券名称</th><th>差异类型</th><th>预期值</th><th>实际值</th><th>说明</th></tr>" + differences_rows + "</table>" if result.differences else "<p>无差异</p>"}

        <h2>📝 处理流程</h2>
        <div class="processing-steps">
            <ol>{steps_html}</ol>
        </div>

        <div class="sources">
            <strong>📁 数据源文件:</strong>
            <ul>{sources_html}</ul>
        </div>

        <div class="footer">
            报告生成时间: {result.analysis_time.strftime('%Y-%m-%d %H:%M:%S')}<br>
            ETF申赎成分券差异校验工具 v1.0
        </div>
    </div>
</body>
</html>"""

        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)

        with open(output_file, "w", encoding="utf-8") as f:
            f.write(html)

        return str(output_file)

    def export_csv(self, result: ReconResult, output_path: str) -> str:
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)

        lines = ["证券代码,证券名称,类型,严重程度,预期值,实际值,说明"]

        for anomaly in result.anomalies:
            lines.append(
                f"{anomaly.code},{anomaly.name},{anomaly.difference_type},{anomaly.severity},"
                f"{anomaly.expected},{anomaly.actual},{anomaly.explanation}"
            )

        for diff in result.differences:
            lines.append(
                f"{diff.code},{diff.name},{diff.difference_type},{diff.severity},"
                f"{diff.expected},{diff.actual},{diff.explanation}"
            )

        with open(output_file, "w", encoding="utf-8-sig") as f:
            f.write("\n".join(lines))

        return str(output_file)
