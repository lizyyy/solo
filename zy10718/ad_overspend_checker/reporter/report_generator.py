import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List

from ..constants import ExitCode


class ReportGenerator:
    def __init__(self, output_dir: str = "./reports"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def generate_all_reports(
        self,
        summary: Dict[str, Any],
        overspend_details: List[Dict[str, Any]],
        delay_details: List[Dict[str, Any]],
        exit_code: ExitCode,
    ) -> Dict[str, str]:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        reports = {}

        reports["summary_report"] = self._generate_summary_report(summary, exit_code, timestamp)
        reports["overspend_report"] = self._generate_overspend_report(overspend_details, timestamp)
        reports["delay_report"] = self._generate_delay_report(delay_details, timestamp)
        reports["exception_report"] = self._generate_exception_report(summary, timestamp)
        reports["console_report"] = self._generate_console_output(summary, exit_code)

        return reports

    def _generate_summary_report(
        self, summary: Dict[str, Any], exit_code: ExitCode, timestamp: str
    ) -> str:
        report = {
            "report_name": "广告消耗日志超投计划筛查汇总报告",
            "report_version": "1.0",
            "generated_at": summary["generated_at"],
            "exit_code": exit_code.value,
            "exit_code_name": exit_code.name,
            "overall_statistics": {
                "total_records": summary["total_records"],
                "normal_records": summary["normal_records"],
                "overspend_records": summary["overspend_records"],
                "delay_records": summary["delay_records"],
                "has_parse_warnings": bool(summary["parse_warnings"]),
                "has_processing_issues": bool(summary["processing_issues"]),
            },
            "overspend_summary": summary["overspend_summary"],
            "delay_summary": summary["delay_summary"],
            "by_platform": summary["by_platform"],
            "by_date": summary["by_date"],
            "top_overspend_plans": summary["top_overspend_plans"],
            "top_delay_plans": summary["top_delay_plans"],
        }

        file_path = os.path.join(self.output_dir, f"summary_report_{timestamp}.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        return file_path

    def _generate_overspend_report(
        self, overspend_details: List[Dict[str, Any]], timestamp: str
    ) -> str:
        report = {
            "report_name": "广告消耗日志超投计划筛查-超投详情报告",
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "total_overspend_records": len(overspend_details),
            "overspend_records": overspend_details,
        }

        file_path = os.path.join(self.output_dir, f"overspend_report_{timestamp}.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        return file_path

    def _generate_delay_report(
        self, delay_details: List[Dict[str, Any]], timestamp: str
    ) -> str:
        report = {
            "report_name": "广告消耗日志超投计划筛查-延迟回传详情报告",
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "total_delay_records": len(delay_details),
            "delay_records": delay_details,
        }

        file_path = os.path.join(self.output_dir, f"delay_report_{timestamp}.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        return file_path

    def _generate_exception_report(
        self, summary: Dict[str, Any], timestamp: str
    ) -> str:
        parse_warnings_list = []
        for filename, warnings in summary.get("parse_warnings", {}).items():
            for warning in warnings:
                parse_warnings_list.append({"file": filename, "message": warning})

        report = {
            "report_name": "广告消耗日志超投计划筛查-异常报告",
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "summary": {
                "parse_warning_count": len(parse_warnings_list),
                "processing_issue_count": len(summary.get("processing_issues", [])),
            },
            "parse_warnings": parse_warnings_list,
            "processing_issues": summary.get("processing_issues", []),
        }

        file_path = os.path.join(self.output_dir, f"exception_report_{timestamp}.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        return file_path

    def _generate_console_output(
        self, summary: Dict[str, Any], exit_code: ExitCode
    ) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("广告消耗日志超投计划筛查")
        lines.append("AD OVERSPEND CHECKER")
        lines.append("=" * 80)
        lines.append(f"生成时间: {summary['generated_at']}")
        lines.append(f"退出码: {exit_code.value} ({exit_code.name})")
        lines.append("")
        lines.append("--- 总体统计 ---")
        lines.append(f"  总记录数: {summary['total_records']}")
        lines.append(f"  正常记录: {summary['normal_records']}")
        lines.append(f"  超投记录: {summary['overspend_records']}")
        lines.append(f"  延迟回传记录: {summary['delay_records']}")
        lines.append("")

        if summary["overspend_records"] > 0:
            lines.append("--- 超投统计 ---")
            os_summary = summary["overspend_summary"]
            lines.append(f"  超投总金额: {os_summary['total_overspend_amount']}")
            lines.append(f"  平均超投比例: {os_summary['avg_overspend_ratio']}x")
            lines.append(f"  最大超投比例: {os_summary['max_overspend_ratio']}x")
            lines.append(f"  受影响计划数: {os_summary['affected_plans_count']}")
            lines.append("")

        if summary["delay_records"] > 0:
            lines.append("--- 延迟回传统计 ---")
            d_summary = summary["delay_summary"]
            lines.append(f"  总延迟小时: {d_summary['total_delay_hours']}h")
            lines.append(f"  平均延迟: {d_summary['avg_delay_hours']}h")
            lines.append(f"  最大延迟: {d_summary['max_delay_hours']}h")
            lines.append(f"  受影响计划数: {d_summary['affected_plans_count']}")
            lines.append("")

        if summary["top_overspend_plans"]:
            lines.append("--- TOP 超投计划 ---")
            for i, plan in enumerate(summary["top_overspend_plans"][:5], 1):
                lines.append(
                    f"  {i}. {plan['plan_id']} ({plan['plan_name']}) - "
                    f"超投 {plan['total_overspend']}, 最大比例 {plan['max_overspend_ratio']}x"
                )
            lines.append("")

        if summary["top_delay_plans"]:
            lines.append("--- TOP 延迟回传计划 ---")
            for i, plan in enumerate(summary["top_delay_plans"][:5], 1):
                lines.append(
                    f"  {i}. {plan['plan_id']} ({plan['plan_name']}) - "
                    f"总延迟 {plan['total_delay_hours']}h, 最大 {plan['max_delay_hours']}h"
                )
            lines.append("")

        if summary["parse_warnings"] or summary["processing_issues"]:
            lines.append("--- 异常情况 ---")
            if summary["parse_warnings"]:
                lines.append(f"  解析警告: {sum(len(w) for w in summary['parse_warnings'].values())} 条")
            if summary["processing_issues"]:
                lines.append(f"  处理问题: {len(summary['processing_issues'])} 条")
            lines.append("  详细内容请查看异常报告")
            lines.append("")

        lines.append("报告文件已生成至: " + self.output_dir)
        lines.append("=" * 80)

        output = "\n".join(lines)
        print(output)

        console_file = os.path.join(self.output_dir, "console_output.txt")
        with open(console_file, "w", encoding="utf-8") as f:
            f.write(output)

        return output

    def generate_text_report(self, summary: Dict[str, Any]) -> str:
        lines = []
        lines.append("# 广告消耗日志超投计划筛查报告")
        lines.append("")
        lines.append(f"生成时间: {summary['generated_at']}")
        lines.append("")
        lines.append("## 1. 总体统计")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总记录数 | {summary['total_records']} |")
        lines.append(f"| 正常记录 | {summary['normal_records']} |")
        lines.append(f"| 超投记录 | {summary['overspend_records']} |")
        lines.append(f"| 延迟回传记录 | {summary['delay_records']} |")
        lines.append("")

        if summary["overspend_records"] > 0:
            lines.append("## 2. 超投统计")
            lines.append("")
            os_summary = summary["overspend_summary"]
            lines.append(f"- 超投总金额: {os_summary['total_overspend_amount']}")
            lines.append(f"- 平均超投比例: {os_summary['avg_overspend_ratio']}x")
            lines.append(f"- 最大超投比例: {os_summary['max_overspend_ratio']}x")
            lines.append(f"- 受影响计划数: {os_summary['affected_plans_count']}")
            lines.append("")

        if summary["delay_records"] > 0:
            lines.append("## 3. 延迟回传统计")
            lines.append("")
            d_summary = summary["delay_summary"]
            lines.append(f"- 总延迟小时: {d_summary['total_delay_hours']}h")
            lines.append(f"- 平均延迟: {d_summary['avg_delay_hours']}h")
            lines.append(f"- 最大延迟: {d_summary['max_delay_hours']}h")
            lines.append(f"- 受影响计划数: {d_summary['affected_plans_count']}")
            lines.append("")

        if summary["top_overspend_plans"]:
            lines.append("## 4. TOP 超投计划")
            lines.append("")
            lines.append("| 排名 | 计划ID | 计划名称 | 平台 | 超投金额 | 最大比例 | 影响天数 |")
            lines.append("|------|--------|----------|------|----------|----------|----------|")
            for i, plan in enumerate(summary["top_overspend_plans"], 1):
                lines.append(
                    f"| {i} | {plan['plan_id']} | {plan['plan_name']} | "
                    f"{plan['platform']} | {plan['total_overspend']} | "
                    f"{plan['max_overspend_ratio']}x | {plan['affected_days']} |"
                )
            lines.append("")

        if summary["top_delay_plans"]:
            lines.append("## 5. TOP 延迟回传计划")
            lines.append("")
            lines.append("| 排名 | 计划ID | 计划名称 | 平台 | 总延迟小时 | 最大延迟 | 影响天数 |")
            lines.append("|------|--------|----------|------|------------|----------|----------|")
            for i, plan in enumerate(summary["top_delay_plans"], 1):
                lines.append(
                    f"| {i} | {plan['plan_id']} | {plan['plan_name']} | "
                    f"{plan['platform']} | {plan['total_delay_hours']}h | "
                    f"{plan['max_delay_hours']}h | {plan['affected_days']} |"
                )
            lines.append("")

        lines.append("## 6. 按平台统计")
        lines.append("")
        lines.append("| 平台 | 记录数 | 总消耗 | 总预算 | 平均消耗预算比 |")
        lines.append("|------|--------|--------|--------|----------------|")
        for platform, data in summary["by_platform"].items():
            lines.append(
                f"| {platform} | {data['record_count']} | {data['total_cost']} | "
                f"{data['total_budget']} | {data['avg_cost_budget_ratio']} |"
            )
        lines.append("")

        report = "\n".join(lines)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_path = os.path.join(self.output_dir, f"report_{timestamp}.md")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(report)

        return file_path
