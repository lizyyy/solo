import csv
import json
import os
from datetime import datetime
from typing import List, Dict, Any
from collections import Counter
from ..models.bond import CalculationResult, ProcessStatus
from ..models.params import CalculationParams


class ReportGenerator:
    def __init__(self, params: CalculationParams):
        self.params = params

    def generate_summary(self, results: List[CalculationResult], cleaning_summary: dict) -> Dict[str, Any]:
        status_counts = Counter(r.status.value for r in results)
        boundary_counts = Counter(r.boundary_decision for r in results if r.boundary_decision)

        success_results = [r for r in results if r.status == ProcessStatus.SUCCESS]
        if success_results:
            premium_rates = [r.conversion_premium_rate for r in success_results if r.conversion_premium_rate is not None]
            if premium_rates:
                avg_premium = sum(premium_rates) / len(premium_rates)
                min_premium = min(premium_rates)
                max_premium = max(premium_rates)
            else:
                avg_premium = min_premium = max_premium = None
        else:
            avg_premium = min_premium = max_premium = None

        summary = {
            "report_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "total_records": len(results),
            "status_breakdown": dict(status_counts),
            "boundary_breakdown": dict(boundary_counts),
            "premium_rate_stats": {
                "average": round(avg_premium, 4) if avg_premium is not None else None,
                "min": round(min_premium, 4) if min_premium is not None else None,
                "max": round(max_premium, 4) if max_premium is not None else None,
            },
            "data_cleaning": cleaning_summary,
            "calculation_params": {
                "boundary_premium_rate_low": self.params.boundary_premium_rate_low,
                "boundary_premium_rate_high": self.params.boundary_premium_rate_high,
                "default_face_value": self.params.default_face_value,
                "params_remarks": {item["key"]: item["remark"] for item in self.params.remarks},
            },
        }
        return summary

    def generate_text_report(self, results: List[CalculationResult], cleaning_summary: dict, output_file: str = None) -> str:
        summary = self.generate_summary(results, cleaning_summary)

        lines = []
        lines.append("=" * 80)
        lines.append("可转债转股边界计算报告")
        lines.append("=" * 80)
        lines.append(f"报告生成时间: {summary['report_time']}")
        lines.append(f"总记录数: {summary['total_records']}")
        lines.append("")

        lines.append("--- 状态统计 ---")
        for status, count in summary["status_breakdown"].items():
            lines.append(f"  {status}: {count} 条")
        lines.append("")

        lines.append("--- 边界判断统计 ---")
        for decision, count in summary["boundary_breakdown"].items():
            lines.append(f"  {decision}: {count} 条")
        lines.append("")

        lines.append("--- 转股溢价率统计 ---")
        stats = summary["premium_rate_stats"]
        lines.append(f"  平均值: {stats['average']:.4f}%" if stats["average"] is not None else "  平均值: 无")
        lines.append(f"  最小值: {stats['min']:.4f}%" if stats["min"] is not None else "  最小值: 无")
        lines.append(f"  最大值: {stats['max']:.4f}%" if stats["max"] is not None else "  最大值: 无")
        lines.append("")

        lines.append("--- 数据清洗情况 ---")
        dc = summary["data_cleaning"]
        lines.append(f"  重复记录数（已跳过）: {dc['duplicate_count']} 条")
        lines.append(f"  空值记录数: {dc['empty_field_count']} 条")
        lines.append(f"  单位混用记录数: {dc['unit_mixed_count']} 条")
        lines.append("")

        lines.append("--- 计算参数备注 ---")
        for key, remark in summary["calculation_params"]["params_remarks"].items():
            lines.append(f"  [{key}] {remark}")
        lines.append("")

        lines.append("=" * 80)
        lines.append("异常记录清单")
        lines.append("=" * 80)

        abnormal_results = [r for r in results if r.status != ProcessStatus.SUCCESS or r.warnings]
        if not abnormal_results:
            lines.append("  无异常记录")
        else:
            for r in abnormal_results:
                lines.append("")
                lines.append(f"--- 行号 {r.line_number}: {r.bond_code} {r.bond_name} ---")
                lines.append(f"  状态: {r.status.value}")
                lines.append(f"  来源: {r.original_source}")
                lines.append(f"  处理时间: {r.process_time}")
                if r.error_reason:
                    lines.append(f"  错误原因: {r.error_reason}")
                if r.warnings:
                    lines.append("  警告:")
                    for w in r.warnings:
                        lines.append(f"    - {w}")
                if r.remark:
                    lines.append(f"  原始备注: {r.remark}")

        lines.append("")
        lines.append("=" * 80)
        lines.append("详细计算结果")
        lines.append("=" * 80)

        for r in results:
            lines.append("")
            lines.append(f"【{r.status.value}】行号 {r.line_number}: {r.bond_code} {r.bond_name}")
            lines.append(f"  来源: {r.original_source} | 处理时间: {r.process_time}")

            if r.status == ProcessStatus.SUCCESS:
                lines.append(f"  转股价值: {r.conversion_value:.4f} 元")
                lines.append(f"  转股溢价率: {r.conversion_premium_rate:.4f}%")
                lines.append(f"  边界判断: {r.boundary_decision}")
                lines.append(f"  解释: {r.boundary_explanation}")
                lines.append("")
                lines.append("  --- 计算公式 ---")
                for name, formula in r.formulas.items():
                    lines.append(f"  {formula}")
                lines.append("")
                lines.append("  --- 使用单位 ---")
                for field, unit in r.units_used.items():
                    lines.append(f"  {field}: {unit}")
                lines.append("")
                lines.append("  --- 边界阈值 ---")
                for name, value in r.boundary_values.items():
                    lines.append(f"  {name}: {value}%")
            elif r.status == ProcessStatus.SKIPPED:
                lines.append(f"  跳过原因: {r.error_reason}")
            else:
                lines.append(f"  失败原因: {r.error_reason}")

            if r.warnings:
                lines.append("")
                lines.append("  --- 警告信息 ---")
                for w in r.warnings:
                    lines.append(f"  ! {w}")

            if r.remark:
                lines.append(f"  原始备注: {r.remark}")

        report_text = "\n".join(lines)

        if output_file:
            os.makedirs(os.path.dirname(output_file), exist_ok=True)
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(report_text)

        return report_text

    def generate_csv_detail(self, results: List[CalculationResult], output_file: str) -> None:
        os.makedirs(os.path.dirname(output_file), exist_ok=True)

        fieldnames = [
            "line_number", "bond_code", "bond_name", "status",
            "conversion_value", "conversion_premium_rate",
            "boundary_decision", "boundary_explanation",
            "formula_conversion_value", "formula_premium_rate", "formula_boundary_judge",
            "unit_bond_price", "unit_conversion_price", "unit_stock_price", "unit_face_value",
            "boundary_low", "boundary_high",
            "error_reason", "warnings", "process_time", "original_source", "remark"
        ]

        with open(output_file, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for r in results:
                row = {
                    "line_number": r.line_number,
                    "bond_code": r.bond_code,
                    "bond_name": r.bond_name,
                    "status": r.status.value,
                    "conversion_value": r.conversion_value,
                    "conversion_premium_rate": r.conversion_premium_rate,
                    "boundary_decision": r.boundary_decision,
                    "boundary_explanation": r.boundary_explanation,
                    "formula_conversion_value": r.formulas.get("conversion_value", ""),
                    "formula_premium_rate": r.formulas.get("premium_rate", ""),
                    "formula_boundary_judge": r.formulas.get("boundary_judge", ""),
                    "unit_bond_price": r.units_used.get("bond_price", ""),
                    "unit_conversion_price": r.units_used.get("conversion_price", ""),
                    "unit_stock_price": r.units_used.get("stock_price", ""),
                    "unit_face_value": r.units_used.get("face_value", ""),
                    "boundary_low": r.boundary_values.get("premium_rate_low", ""),
                    "boundary_high": r.boundary_values.get("premium_rate_high", ""),
                    "error_reason": r.error_reason or "",
                    "warnings": "; ".join(r.warnings) if r.warnings else "",
                    "process_time": r.process_time,
                    "original_source": r.original_source,
                    "remark": r.remark,
                }
                writer.writerow(row)

    def generate_json_report(self, results: List[CalculationResult], cleaning_summary: dict, output_file: str) -> None:
        os.makedirs(os.path.dirname(output_file), exist_ok=True)

        summary = self.generate_summary(results, cleaning_summary)
        report = {
            "summary": summary,
            "results": [r.to_dict() for r in results],
        }

        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
