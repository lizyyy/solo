import csv
from decimal import Decimal
from typing import Dict, List, Optional

from .models import (
    Inventory,
    Material,
    LedgerEntry,
    MaterialUsage,
)
from .ledger import LedgerManager


LOW_STOCK_THRESHOLD = Decimal("50")


class Reporter:
    def __init__(self, inventory: Optional[Inventory] = None, ledger_manager: Optional[LedgerManager] = None):
        self.inventory = inventory
        self.ledger_manager = ledger_manager

    def generate_markdown_report(self) -> str:
        lines = []

        lines.append("# 水培营养液配方报告")
        lines.append("")
        lines.append(f"生成时间: {self._get_timestamp()}")
        lines.append("")

        if self.inventory:
            lines.append("## 库存状态")
            lines.append("")
            lines.append("| 原料 | 剩余克数 | 单价(元/克) | 状态 |")
            lines.append("|------|----------|-------------|------|")

            low_stock_items = []
            for material in self.inventory.list_materials():
                status = "正常"
                if material.remaining_grams < LOW_STOCK_THRESHOLD:
                    status = "⚠️ 库存不足"
                    low_stock_items.append(material)

                lines.append(
                    f"| {material.name} | {float(material.remaining_grams):.4f} | "
                    f"{float(material.price_per_gram):.4f} | {status} |"
                )

            lines.append("")

            if low_stock_items:
                lines.append("### 库存预警")
                lines.append("")
                for item in low_stock_items:
                    lines.append(
                        f"- **{item.name}**: 剩余 {float(item.remaining_grams):.4f}g, "
                        f"低于阈值 {float(LOW_STOCK_THRESHOLD)}g"
                    )
                lines.append("")

        if self.ledger_manager:
            entries = self.ledger_manager.list_entries(limit=10)
            if entries:
                lines.append("## 最近批次记录")
                lines.append("")

                for entry in entries:
                    lines.append(f"### 批次: {entry.batch_id}")
                    lines.append("")
                    lines.append(f"- 时间: {entry.timestamp}")
                    lines.append(f"- 体积: {float(entry.volume_liters)}L")
                    lines.append(f"- 总成本: {float(entry.total_cost):.4f}元")

                    cost_per_liter = self.ledger_manager.get_total_cost_per_liter(entry)
                    lines.append(f"- 每升成本: {float(cost_per_liter):.6f}元/L")

                    if entry.notes:
                        lines.append(f"- 备注: {entry.notes}")

                    lines.append("")
                    lines.append("#### 元素实际含量")
                    lines.append("")
                    lines.append("| 元素 | 目标范围(ppm) | 实际(ppm) | 偏差(ppm) | 偏差(%) | 状态 |")
                    lines.append("|------|--------------|-----------|-----------|---------|------|")

                    for elem, actual in entry.element_actuals.items():
                        target = entry.element_targets.get(elem)
                        if target:
                            target_range = f"{float(target.min_ppm)}-{float(target.max_ppm)}"
                            target_mid = (target.min_ppm + target.max_ppm) / Decimal("2")
                            deviation = actual - target_mid
                            if target_mid > 0:
                                deviation_pct = (deviation / target_mid) * Decimal("100")
                            else:
                                deviation_pct = Decimal("0")

                            if actual < target.min_ppm:
                                status = "⬇️ 偏低"
                            elif actual > target.max_ppm:
                                status = "⬆️ 偏高"
                            else:
                                status = "✅ 正常"

                            lines.append(
                                f"| {elem} | {target_range} | {float(actual):.2f} | "
                                f"{float(deviation):.2f} | {float(deviation_pct):.2f}% | {status} |"
                            )

                    lines.append("")
                    lines.append("#### 原料使用")
                    lines.append("")
                    lines.append("| 原料 | 使用量(g) | 成本(元) | 使用前(g) | 使用后(g) |")
                    lines.append("|------|-----------|----------|-----------|-----------|")

                    for usage in entry.material_usages:
                        lines.append(
                            f"| {usage.material_name} | {float(usage.grams_used):.4f} | "
                            f"{float(usage.cost):.4f} | {float(usage.remaining_before):.4f} | "
                            f"{float(usage.remaining_after):.4f} |"
                        )

                    lines.append("")

                total_cost = sum(e.total_cost for e in entries)
                total_volume = sum(e.volume_liters for e in entries)
                if total_volume > 0:
                    avg_cost_per_liter = total_cost / total_volume
                    lines.append("## 汇总统计")
                    lines.append("")
                    lines.append(f"- 最近 {len(entries)} 批次")
                    lines.append(f"- 总体积: {float(total_volume)}L")
                    lines.append(f"- 总成本: {float(total_cost):.4f}元")
                    lines.append(f"- 平均每升成本: {float(avg_cost_per_liter):.6f}元/L")
                    lines.append("")

        return "\n".join(lines)

    def generate_csv_report(self, output_path: str) -> None:
        if not self.ledger_manager or not self.inventory:
            return

        entries = self.ledger_manager.list_entries(limit=100)

        with open(output_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)

            writer.writerow(["批次汇总"])
            writer.writerow([
                "批次ID", "时间", "体积(L)", "总成本(元)", "每升成本(元)", "备注"
            ])

            for entry in entries:
                cost_per_liter = self.ledger_manager.get_total_cost_per_liter(entry)
                writer.writerow([
                    entry.batch_id,
                    entry.timestamp,
                    float(entry.volume_liters),
                    float(entry.total_cost),
                    float(cost_per_liter),
                    entry.notes,
                ])

            writer.writerow([])
            writer.writerow(["原料使用详情"])
            writer.writerow([
                "批次ID", "原料", "使用量(g)", "成本(元)", "使用前(g)", "使用后(g)"
            ])

            for entry in entries:
                for usage in entry.material_usages:
                    writer.writerow([
                        entry.batch_id,
                        usage.material_name,
                        float(usage.grams_used),
                        float(usage.cost),
                        float(usage.remaining_before),
                        float(usage.remaining_after),
                    ])

            writer.writerow([])
            writer.writerow(["元素含量详情"])
            writer.writerow([
                "批次ID", "元素", "目标下限(ppm)", "目标上限(ppm)",
                "实际(ppm)", "偏差(ppm)", "偏差(%)", "状态"
            ])

            for entry in entries:
                for elem, actual in entry.element_actuals.items():
                    target = entry.element_targets.get(elem)
                    if target:
                        target_mid = (target.min_ppm + target.max_ppm) / Decimal("2")
                        deviation = actual - target_mid
                        if target_mid > 0:
                            deviation_pct = (deviation / target_mid) * Decimal("100")
                        else:
                            deviation_pct = Decimal("0")

                        if actual < target.min_ppm:
                            status = "偏低"
                        elif actual > target.max_ppm:
                            status = "偏高"
                        else:
                            status = "正常"

                        writer.writerow([
                            entry.batch_id,
                            elem,
                            float(target.min_ppm),
                            float(target.max_ppm),
                            float(actual),
                            float(deviation),
                            float(deviation_pct),
                            status,
                        ])

            writer.writerow([])
            writer.writerow(["当前库存"])
            writer.writerow(["原料", "剩余克数", "单价(元/克)", "状态"])

            for material in self.inventory.list_materials():
                if material.remaining_grams < LOW_STOCK_THRESHOLD:
                    status = "库存不足"
                else:
                    status = "正常"

                writer.writerow([
                    material.name,
                    float(material.remaining_grams),
                    float(material.price_per_gram),
                    status,
                ])

    def _get_timestamp(self) -> str:
        from datetime import datetime
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
