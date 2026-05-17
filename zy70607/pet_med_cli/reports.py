import json
from datetime import date
from pathlib import Path
from typing import Dict, Any
from tabulate import tabulate

from .models import CareReport


class ReportExporter:
    @staticmethod
    def export_json(report: CareReport, output_dir: str = "./reports") -> str:
        Path(output_dir).mkdir(exist_ok=True)
        file_path = Path(output_dir) / f"{report.report_id}.json"
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(report.dict(), f, ensure_ascii=False, indent=2, default=str)
        
        return str(file_path)

    @staticmethod
    def export_text(report: CareReport, output_dir: str = "./reports") -> str:
        Path(output_dir).mkdir(exist_ok=True)
        file_path = Path(output_dir) / f"{report.report_id}.txt"
        
        lines = []
        lines.append("=" * 80)
        lines.append(f"护理报告: {report.report_id}")
        lines.append(f"订单ID: {report.order_id}")
        lines.append(f"宠物ID: {report.pet_id}")
        lines.append(f"报告周期: {report.start_date} 至 {report.end_date}")
        lines.append(f"生成时间: {report.generated_at}")
        lines.append("=" * 80)
        lines.append("")

        if report.alerts:
            lines.append("【⚠️ 告警信息】")
            for alert in report.alerts:
                lines.append(f"  ! {alert}")
            lines.append("")

        lines.append("【📊 执行汇总】")
        for status, count in report.summary.items():
            lines.append(f"  {status}: {count}")
        lines.append("")

        if report.items:
            lines.append("【📋 详细记录】")
            table_data = []
            headers = ["日期", "班次", "宠物", "药物", "剂量版本", "状态", "执行人", "变更", "备注"]
            for item in report.items:
                table_data.append([
                    str(item.date),
                    item.shift,
                    item.pet_name,
                    item.medication,
                    item.dosage,
                    item.status,
                    item.administered_by or "-",
                    "是" if item.has_change else "否",
                    item.notes or "-"
                ])
            lines.append(tabulate(table_data, headers=headers, tablefmt="simple"))
            lines.append("")
        else:
            lines.append("【📋 详细记录】")
            lines.append("  (无记录)")
            lines.append("")

        content = "\n".join(lines)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return str(file_path)

    @staticmethod
    def print_report(report: CareReport) -> None:
        print("=" * 80)
        print(f"护理报告: {report.report_id}")
        print(f"订单ID: {report.order_id}")
        print(f"宠物ID: {report.pet_id}")
        print(f"报告周期: {report.start_date} 至 {report.end_date}")
        print(f"生成时间: {report.generated_at}")
        print("=" * 80)
        print()

        if report.alerts:
            print("\033[93m【⚠️ 告警信息】\033[0m")
            for alert in report.alerts:
                print(f"  \033[91m! {alert}\033[0m")
            print()

        print("【📊 执行汇总】")
        for status, count in report.summary.items():
            print(f"  {status}: {count}")
        print()

        if report.items:
            print("【📋 详细记录】")
            table_data = []
            headers = ["日期", "班次", "宠物", "药物", "剂量版本", "状态", "执行人", "变更", "备注"]
            for item in report.items:
                table_data.append([
                    str(item.date),
                    item.shift,
                    item.pet_name,
                    item.medication,
                    item.dosage,
                    item.status,
                    item.administered_by or "-",
                    "是" if item.has_change else "否",
                    item.notes or "-"
                ])
            print(tabulate(table_data, headers=headers, tablefmt="simple"))
            print()
        else:
            print("【📋 详细记录】")
            print("  (无记录)")
            print()
