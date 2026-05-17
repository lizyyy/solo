import csv
import json
from typing import Dict, List, Any
from pathlib import Path
from datetime import datetime
from .models import CheckResult, SeverityLevel


class ReportGenerator:
    def __init__(self, output_dir: str = "reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_all_reports(self, result: CheckResult, prefix: str = "") -> Dict[str, str]:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        if prefix:
            prefix = f"{prefix}_"

        reports = {}

        reports["missing_items"] = self._generate_missing_items_report(
            result, f"{prefix}missing_items_{timestamp}.csv"
        )

        reports["box_summary"] = self._generate_box_summary(
            result, f"{prefix}box_summary_{timestamp}.csv"
        )

        reports["city_summary"] = self._generate_city_summary(
            result, f"{prefix}city_summary_{timestamp}.csv"
        )

        reports["invalid_rows"] = self._generate_invalid_rows_report(
            result, f"{prefix}invalid_rows_{timestamp}.csv"
        )

        reports["summary_json"] = self._generate_json_summary(
            result, f"{prefix}full_report_{timestamp}.json"
        )

        return reports

    def _generate_missing_items_report(self, result: CheckResult, filename: str) -> str:
        file_path = self.output_dir / filename

        with open(file_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "城市", "缺失配件", "缺失类型", "严重程度",
                "需要数量", "实际数量", "源行号", "所在箱号",
                "依赖物料", "备注"
            ])

            for item in result.missing_items:
                writer.writerow([
                    item.city,
                    item.material_name,
                    item.missing_type.value,
                    item.severity.value,
                    item.required_quantity,
                    item.actual_quantity,
                    item.source_line,
                    item.source_box,
                    item.depends_on,
                    item.notes,
                ])

        return str(file_path)

    def _generate_box_summary(self, result: CheckResult, filename: str) -> str:
        file_path = self.output_dir / filename

        with open(file_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["箱号", "城市", "物料种类数", "总数量", "包含物料"])

            for box_num in sorted(result.box_assignments.keys()):
                box = result.box_assignments[box_num]
                writer.writerow([
                    box.box_number,
                    box.city,
                    len(box.materials),
                    box.total_items,
                    ", ".join(sorted(m.material_name for m in box.materials)),
                ])

        return str(file_path)

    def _generate_city_summary(self, result: CheckResult, filename: str) -> str:
        file_path = self.output_dir / filename

        with open(file_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "城市", "物料种类数", "总数量", "缺失项总数",
                "严重(CRITICAL)", "高级(HIGH)", "中级(MEDIUM)", "低级(LOW)"
            ])

            for city in sorted(result.city_summary.keys()):
                summary = result.city_summary[city]
                writer.writerow([
                    city,
                    summary["material_count"],
                    summary["total_quantity"],
                    summary["missing_total"],
                    summary["missing_critical"],
                    summary["missing_high"],
                    summary["missing_medium"],
                    summary["missing_low"],
                ])

        return str(file_path)

    def _generate_invalid_rows_report(self, result: CheckResult, filename: str) -> str:
        file_path = self.output_dir / filename

        with open(file_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["行号", "城市", "物料名称", "数量", "错误信息", "原始数据"])

            for item in sorted(result.invalid_rows, key=lambda x: x.line_number):
                writer.writerow([
                    item.line_number,
                    item.city,
                    item.material_name,
                    item.quantity,
                    item.error_message,
                    item.raw_data,
                ])

        return str(file_path)

    def _generate_json_summary(self, result: CheckResult, filename: str) -> str:
        file_path = self.output_dir / filename

        summary = {
            "timestamp": result.timestamp,
            "summary": {
                "total_materials": len(result.materials),
                "invalid_rows": len(result.invalid_rows),
                "total_boxes": len(result.box_assignments),
                "total_missing": len(result.missing_items),
                "missing_by_severity": {
                    sev.value: len(items)
                    for sev, items in sorted(result.get_missing_by_severity().items(), key=lambda x: x[0].value)
                },
            },
            "cities": sorted(result.city_summary.keys()),
            "missing_items": [m.to_dict() for m in result.missing_items],
            "city_summary": result.city_summary,
        }

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)

        return str(file_path)

    def print_console_summary(self, result: CheckResult):
        print("\n" + "=" * 60)
        print("活动装箱配件检查报告".center(60))
        print("=" * 60)

        print(f"\n检查时间: {result.timestamp}")
        print(f"有效物料数: {len(result.materials)}")
        print(f"无效行数: {len(result.invalid_rows)}")
        print(f"分配箱数: {len(result.box_assignments)}")

        print("\n" + "-" * 60)
        print("缺失配件统计".center(60))
        print("-" * 60)

        missing_by_sev = result.get_missing_by_severity()
        for sev in sorted(SeverityLevel, key=lambda x: x.value):
            count = len(missing_by_sev.get(sev, []))
            if count > 0:
                print(f"  {sev.value}: {count} 项")

        if result.missing_items:
            print("\n" + "-" * 60)
            print("缺失配件详情".center(60))
            print("-" * 60)
            for item in result.missing_items:
                print(
                    f"  [{item.severity.value}] {item.city} - {item.material_name}: "
                    f"需{item.required_quantity}, 实{item.actual_quantity} "
                    f"(依赖: {item.depends_on}, 行{item.source_line})"
                )

        if result.invalid_rows:
            print("\n" + "-" * 60)
            print("无效行记录".center(60))
            print("-" * 60)
            for item in result.invalid_rows:
                print(f"  行{item.line_number}: {item.error_message}")
                print(f"    原始数据: {item.raw_data}")

        print("\n" + "=" * 60)
