import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List

import pandas as pd
from rich.table import Table


class ReportGenerator:
    def __init__(self, console, output_dir: Path, dry_run: bool):
        self.console = console
        self.output_dir = output_dir
        self.dry_run = dry_run

    def generate(self, results: Dict, data_issues: Dict[str, List[str]]):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        self._generate_summary_report(results, data_issues, timestamp)
        self._generate_detailed_reports(results, timestamp)
        self._generate_data_issue_report(data_issues, timestamp)

        self.console.print("✓ 所有报告已生成", style="green")

    def _generate_summary_report(self, results: Dict, data_issues: Dict, timestamp: str):
        summary = results["统计摘要"]

        table = Table(title="直播课程资料回放权限核查 - 汇总报告", show_header=True)
        table.add_column("统计项", style="cyan")
        table.add_column("数量", style="magenta")
        table.add_column("说明", style="yellow")

        from rich.text import Text
        table.add_row("总观看记录", str(summary.get("总观看记录", 0)), "所有用户的观看记录总数")
        table.add_row("总订单数", str(summary.get("总订单数", 0)), "所有订单记录总数")
        table.add_row("授权用户数", str(summary.get("授权用户数", 0)), "授权名单中的用户数")
        table.add_row()
        table.add_row(
            Text("退款后观看", style="red"),
            Text(str(summary.get("退款后观看数", 0)), style="red"),
            "用户退款后仍继续观看课程，需终止权限"
        )
        table.add_row(
            Text("换班学员", style="yellow"),
            Text(str(summary.get("换班学员数", 0)), style="yellow"),
            "观看了非当前班级课程，需同步权限"
        )
        table.add_row(
            Text("补录订单", style="blue"),
            Text(str(summary.get("补录订单数", 0)), style="blue"),
            "后台补录订单，需人工核实授权"
        )
        table.add_row(
            Text("不该观看的用户", style="red"),
            Text(str(summary.get("不该观看数", 0)), style="red"),
            "无有效订单却观看了，需核查原因"
        )
        table.add_row(
            Text("漏授权用户", style="green"),
            Text(str(summary.get("漏授权数", 0)), style="green"),
            "已付款但未授权，需补充授权"
        )

        self.console.print("\n")
        self.console.print(table)

        if not self.dry_run:
            summary_file = self.output_dir / f"权限核查汇总_{timestamp}.json"
            with open(summary_file, 'w', encoding='utf-8') as f:
                json.dump({
                    "报告标题": "直播课程资料回放权限核查汇总报告",
                    "生成时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "统计摘要": summary,
                    "数据质量问题": data_issues
                }, f, ensure_ascii=False, indent=2)
            self.console.print(f"✓ 汇总报告已保存: {summary_file.name}", style="green")

    def _generate_detailed_reports(self, results: Dict, timestamp: str):
        report_categories = [
            ("退款后观看", "退款后观看明细", "red"),
            ("换班学员", "换班学员明细", "yellow"),
            ("补录订单", "补录订单明细", "blue"),
            ("不该观看的用户", "不该观看用户明细", "red"),
            ("漏授权用户", "漏授权用户明细", "green")
        ]

        for category, file_prefix, color in report_categories:
            data = results.get(category, [])
            if data:
                self._print_detailed_table(category, data, color)

                if not self.dry_run:
                    df = pd.DataFrame(data)
                    excel_file = self.output_dir / f"{file_prefix}_{timestamp}.xlsx"
                    df.to_excel(excel_file, index=False, sheet_name=category)
                    self.console.print(f"✓ {category}报告已保存: {excel_file.name}", style="green")

    def _print_detailed_table(self, title: str, data: List[Dict], color: str):
        if not data:
            return

        self.console.print(f"\n{title} - 前5条记录:", style=color)
        table = Table(show_header=True)

        sample = data[0]
        for key in sample.keys():
            if key != "异常类型":
                table.add_column(key, style="cyan")

        for item in data[:5]:
            row = [str(item.get(key, "")) for key in sample.keys() if key != "异常类型"]
            table.add_row(*row)

        self.console.print(table)
        if len(data) > 5:
            self.console.print(f"... 还有 {len(data) - 5} 条记录", style="dim")

    def _generate_data_issue_report(self, data_issues: Dict[str, List[str]], timestamp: str):
        total_issues = sum(len(issues) for issues in data_issues.values())
        if total_issues == 0:
            return

        self.console.print("\n数据质量问题详情:", style="bold magenta")
        for issue_type, issues in data_issues.items():
            if issues:
                self.console.print(f"  [{issue_type}]:")
                for issue in issues[:3]:
                    self.console.print(f"    - {issue}")
                if len(issues) > 3:
                    self.console.print(f"    ... 还有 {len(issues) - 3} 条", style="dim")

        if not self.dry_run:
            issues_file = self.output_dir / f"数据质量问题_{timestamp}.txt"
            with open(issues_file, 'w', encoding='utf-8') as f:
                f.write("直播课程资料回放权限核查 - 数据质量问题报告\n")
                f.write("=" * 60 + "\n\n")
                for issue_type, issues in data_issues.items():
                    if issues:
                        f.write(f"【{issue_type}】\n")
                        for issue in issues:
                            f.write(f"  - {issue}\n")
                        f.write("\n")
            self.console.print(f"✓ 数据质量报告已保存: {issues_file.name}", style="green")
