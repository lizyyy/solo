import json
import csv
from pathlib import Path
from typing import List

from .models import ProcessResult, BadLine, MaintenancePlanResult


class ReportGenerator:
    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_all(self, result: ProcessResult) -> None:
        self.generate_summary_report(result)
        self.generate_gap_report(result)
        self.generate_bad_lines_report(result)
        self.generate_json_report(result)

    def generate_summary_report(self, result: ProcessResult) -> None:
        file_path = self.output_dir / "summary_report.txt"

        with open(file_path, "w", encoding="utf-8") as f:
            f.write("=" * 80 + "\n")
            f.write("           保养配件替代件库存预演排查 - 摘要报告\n")
            f.write("=" * 80 + "\n\n")
            f.write(f"生成时间: {result.timestamp}\n\n")

            f.write("-" * 80 + "\n")
            f.write("数据统计:\n")
            f.write("-" * 80 + "\n")
            f.write(f"  车型数量: {len(result.car_models)}\n")
            f.write(f"  保养项目: {len(result.maintenance_items)}\n")
            f.write(f"  库存配件: {len(result.inventory)}\n")
            f.write(f"  替代件关系: {len(result.alternatives)}\n")
            f.write(f"  坏行数量: {len(result.bad_lines)}\n")
            f.write(f"  保养计划: {len(result.plan_results)}\n\n")

            total_gaps = sum(r.total_gap_count for r in result.plan_results)
            total_critical = sum(r.critical_gap_count for r in result.plan_results)
            f.write("-" * 80 + "\n")
            f.write("缺口汇总:\n")
            f.write("-" * 80 + "\n")
            f.write(f"  总缺口数: {total_gaps}\n")
            f.write(f"  严重缺口: {total_critical}\n\n")

            f.write("-" * 80 + "\n")
            f.write("保养计划详情:\n")
            f.write("-" * 80 + "\n\n")

            for plan in sorted(result.plan_results, key=lambda x: (x.car_model, x.maintenance_id)):
                f.write(f"【{plan.car_model}】- {plan.maintenance_name} ({plan.maintenance_id})\n")
                f.write(f"  缺口配件: {plan.total_gap_count} / 严重: {plan.critical_gap_count}\n")

                for part in sorted(plan.parts_summary, key=lambda x: x.part_number):
                    status_icon = "✓" if part.gap_qty == 0 else "✗"
                    f.write(f"  {status_icon} {part.part_number} {part.part_name}\n")
                    f.write(f"    需求: {part.required_qty}, 可用: {part.available_qty}, 缺口: {part.gap_qty}\n")
                    if part.gap_qty > 0:
                        f.write(f"    缺口等级: {part.gap_level}\n")
                    if part.alternative_parts:
                        f.write(f"    可用替代件: {', '.join(part.alternative_parts)}\n")
                    for trace in part.source_trace:
                        f.write(f"      -> {trace}\n")
                f.write("\n")

    def generate_gap_report(self, result: ProcessResult) -> None:
        file_path = self.output_dir / "gap_report.csv"

        with open(file_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "车型",
                "保养项目ID",
                "保养项目名称",
                "配件编号",
                "配件名称",
                "需求数量",
                "可用数量",
                "缺口数量",
                "缺口等级",
                "可用替代件",
            ])

            for plan in sorted(result.plan_results, key=lambda x: (x.car_model, x.maintenance_id)):
                for part in sorted(plan.parts_summary, key=lambda x: x.part_number):
                    if part.gap_qty > 0:
                        writer.writerow([
                            plan.car_model,
                            plan.maintenance_id,
                            plan.maintenance_name,
                            part.part_number,
                            part.part_name,
                            part.required_qty,
                            part.available_qty,
                            part.gap_qty,
                            part.gap_level,
                            ";".join(part.alternative_parts),
                        ])

    def generate_bad_lines_report(self, result: ProcessResult) -> None:
        if not result.bad_lines:
            return

        file_path = self.output_dir / "bad_lines_report.csv"

        with open(file_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "文件路径",
                "行号",
                "原始内容",
                "错误信息",
            ])

            for bad_line in sorted(result.bad_lines, key=lambda x: (x.file_path, x.line_number)):
                writer.writerow([
                    bad_line.file_path,
                    bad_line.line_number,
                    bad_line.original_line,
                    bad_line.error_message,
                ])

    def generate_json_report(self, result: ProcessResult) -> None:
        file_path = self.output_dir / "full_report.json"

        data = {
            "timestamp": result.timestamp,
            "summary": {
                "car_models_count": len(result.car_models),
                "maintenance_items_count": len(result.maintenance_items),
                "inventory_count": len(result.inventory),
                "alternatives_count": len(result.alternatives),
                "bad_lines_count": len(result.bad_lines),
                "plan_results_count": len(result.plan_results),
            },
            "plan_results": [
                {
                    "car_model": plan.car_model,
                    "maintenance_id": plan.maintenance_id,
                    "maintenance_name": plan.maintenance_name,
                    "total_gap_count": plan.total_gap_count,
                    "critical_gap_count": plan.critical_gap_count,
                    "parts_summary": [
                        {
                            "part_number": p.part_number,
                            "part_name": p.part_name,
                            "required_qty": p.required_qty,
                            "available_qty": p.available_qty,
                            "gap_qty": p.gap_qty,
                            "gap_level": p.gap_level,
                            "alternative_parts": p.alternative_parts,
                            "source_trace": p.source_trace,
                        }
                        for p in sorted(plan.parts_summary, key=lambda x: x.part_number)
                    ],
                }
                for plan in sorted(result.plan_results, key=lambda x: (x.car_model, x.maintenance_id))
            ],
            "bad_lines": [
                {
                    "file_path": bl.file_path,
                    "line_number": bl.line_number,
                    "original_line": bl.original_line,
                    "error_message": bl.error_message,
                }
                for bl in sorted(result.bad_lines, key=lambda x: (x.file_path, x.line_number))
            ],
        }

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
