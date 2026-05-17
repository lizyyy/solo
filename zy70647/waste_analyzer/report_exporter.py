import json
import csv
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime

from .models import WasteRecord


class ReportExporter:
    @staticmethod
    def export_json(
        records: List[WasteRecord],
        store_ranking: List[Dict[str, Any]],
        category_summary: List[Dict[str, Any]],
        validation_report: Dict[str, Any],
        output_path: Path,
    ) -> None:
        data = {
            "export_time": datetime.now().isoformat(),
            "summary": {
                "total_records": len(records),
                "abnormal_records": sum(1 for r in records if r.is_abnormal),
                "normal_records": sum(1 for r in records if not r.is_abnormal),
            },
            "validation": validation_report,
            "waste_records": [r.dict() for r in records],
            "store_ranking": store_ranking,
            "category_summary": category_summary,
        }
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    @staticmethod
    def export_csv(
        records: List[WasteRecord],
        store_ranking: List[Dict[str, Any]],
        category_summary: List[Dict[str, Any]],
        output_dir: Path,
    ) -> None:
        output_dir.mkdir(parents=True, exist_ok=True)

        with open(output_dir / "waste_records.csv", "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "原料ID", "原料名称", "品类", "门店ID", "门店名称",
                "采购数量", "领用数量", "报损数量", "损耗率", "是否异常", "单位"
            ])
            for r in records:
                writer.writerow([
                    r.material_id, r.material_name, r.category, r.store_id, r.store_name,
                    r.purchase_quantity, r.usage_quantity, r.damage_quantity,
                    f"{r.waste_rate:.2%}", "是" if r.is_abnormal else "否", r.unit.value
                ])

        with open(output_dir / "store_ranking.csv", "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "门店ID", "门店名称", "区域", "总采购数量",
                "总报损数量", "损耗率", "记录数"
            ])
            for s in store_ranking:
                writer.writerow([
                    s["store_id"], s["store_name"], s["region"],
                    s["total_purchase"], s["total_damage"],
                    f"{s['waste_rate']:.2%}", s["record_count"]
                ])

        with open(output_dir / "category_summary.csv", "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["品类", "总采购数量", "总报损数量", "损耗率"])
            for c in category_summary:
                writer.writerow([
                    c["category"], c["total_purchase"],
                    c["total_damage"], f"{c['waste_rate']:.2%}"
                ])

    @staticmethod
    def export_human_readable(
        records: List[WasteRecord],
        store_ranking: List[Dict[str, Any]],
        category_summary: List[Dict[str, Any]],
        validation_report: Dict[str, Any],
        output_path: Path,
    ) -> None:
        lines = []
        lines.append("=" * 80)
        lines.append("原料损耗分析报告")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 80)
        lines.append("")

        lines.append("一、数据验证报告")
        lines.append("-" * 40)
        if validation_report["has_errors"]:
            lines.append("  错误:")
            for err in validation_report["errors"]:
                lines.append(f"    - {err}")
        if validation_report["has_warnings"]:
            lines.append("  警告:")
            for warn in validation_report["warnings"]:
                lines.append(f"    - {warn}")
        if not validation_report["has_errors"] and not validation_report["has_warnings"]:
            lines.append("  数据验证通过，无错误或警告")
        lines.append("")

        lines.append("二、总体统计")
        lines.append("-" * 40)
        total_records = len(records)
        abnormal_count = sum(1 for r in records if r.is_abnormal)
        normal_count = total_records - abnormal_count
        lines.append(f"  总记录数: {total_records}")
        lines.append(f"  正常记录: {normal_count}")
        lines.append(f"  异常记录: {abnormal_count}")
        if total_records > 0:
            lines.append(f"  异常率: {abnormal_count/total_records:.2%}")
        lines.append("")

        lines.append("三、门店损耗排行（按损耗率降序）")
        lines.append("-" * 40)
        for i, store in enumerate(store_ranking, 1):
            marker = "  !!!" if store["waste_rate"] > 0.05 else "     "
            lines.append(f"{marker}{i:2d}. {store['store_name']} ({store['region']})")
            lines.append(f"        损耗率: {store['waste_rate']:.2%}, 总报损: {store['total_damage']}")
        lines.append("")

        lines.append("四、品类损耗汇总")
        lines.append("-" * 40)
        for cat in category_summary:
            lines.append(f"  - {cat['category']}: 损耗率 {cat['waste_rate']:.2%}, "
                       f"总采购: {cat['total_purchase']}, 总报损: {cat['total_damage']}")
        lines.append("")

        lines.append("五、异常损耗明细")
        lines.append("-" * 40)
        abnormal_records = [r for r in records if r.is_abnormal]
        if abnormal_records:
            for r in abnormal_records:
                lines.append(f"  - {r.store_name} - {r.material_name} ({r.category}):")
                lines.append(f"    采购: {r.purchase_quantity}{r.unit.value}, "
                           f"报损: {r.damage_quantity}{r.unit.value}, "
                           f"损耗率: {r.waste_rate:.2%}")
        else:
            lines.append("  无异常损耗记录")
        lines.append("")

        lines.append("=" * 80)
        lines.append("报告结束")
        lines.append("=" * 80)

        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
