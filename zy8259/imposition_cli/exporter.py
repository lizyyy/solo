import csv
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from .models import ProductionPlan
from .units import format_imposition_count


class Exporter:
    def __init__(self, plans: List[ProductionPlan]):
        self.plans = plans
    
    def generate_imposition_plan_md(self, output_path: Path, today: Optional[datetime] = None) -> str:
        if today is None:
            today = datetime.now()
        
        lines = [
            "# 拼版生产计划",
            "",
            f"> 生成时间: {today.strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "---",
            "",
        ]
        
        total_sheets = sum(p.total_sheets for p in self.plans)
        total_wastage = sum(p.wastage_sheets for p in self.plans)
        total_items = sum(p.order.quantity for p in self.plans)
        high_risk_count = sum(
            1 for p in self.plans 
            if p.cross_day_risk or p.oversized_risk or p.stock_risk
        )
        
        lines.extend([
            "## 汇总概览",
            "",
            "| 指标 | 数值 |",
            "|------|------|",
            f"| 订单总数 | {len(self.plans)} |",
            f"| 总印数 | {total_items:,} |",
            f"| 总用纸量 | {total_sheets:,} 张 |",
            f"| 总损耗量 | {total_wastage:,} 张 |",
            f"| 高风险订单 | {high_risk_count} 个 |",
            "",
        ])
        
        if high_risk_count > 0:
            lines.extend([
                "### ⚠️ 风险提示",
                "",
            ])
            for plan in self.plans:
                risks = []
                if plan.cross_day_risk:
                    risks.append("交期紧张")
                if plan.oversized_risk:
                    risks.append("超规印刷")
                if plan.stock_risk:
                    risks.append("库存不足")
                
                if risks:
                    lines.append(f"- **{plan.order.order_id} ({plan.order.product_name})**: {', '.join(risks)}")
            lines.append("")
        
        lines.extend([
            "---",
            "",
            "## 订单详情",
            "",
        ])
        
        for idx, plan in enumerate(self.plans, 1):
            order = plan.order
            imposition = plan.imposition
            layout = imposition.layout
            
            lines.extend([
                f"### {idx}. {order.order_id} - {order.product_name}",
                "",
                "#### 基本信息",
                "",
                f"- **产品名称**: {order.product_name}",
                f"- **订单数量**: {order.quantity:,} 份",
                f"- **成品尺寸**: {order.finished_size.width.to_str()} × {order.finished_size.height.to_str()}",
                f"- **出血尺寸**: {order.bleed.to_str()}",
                f"- **有效尺寸（含出血）**: {order.effective_size.width.to_str()} × {order.effective_size.height.to_str()}",
                f"- **纸张类型**: {order.paper_type}",
                f"- **印刷模式**: {order.color_mode.value}",
                f"- **交期**: {order.due_date.strftime('%Y-%m-%d')}",
                "",
            ])
            
            lines.extend([
                "#### 拼版方案",
                "",
                f"- **推荐拼版方式**: {format_imposition_count(layout.total_count)} ({layout.layout_string})",
                f"- **是否旋转**: {'是' if layout.rotated else '否'}",
                f"- **每版拼数**: {layout.total_count} 份",
            ])
            
            if imposition.press:
                lines.append(f"- **推荐机台**: {imposition.press.name}")
            
            if imposition.paper_stock:
                lines.extend([
                    f"- **用纸规格**: {imposition.paper_stock.size.width.to_str()} × {imposition.paper_stock.size.height.to_str()}",
                    f"- **库存数量**: {imposition.paper_stock.stock_quantity:,} 张",
                    f"- **纸张单价**: ¥{imposition.paper_stock.price_per_sheet:.2f}/张",
                ])
            
            lines.extend([
                f"- **版面利用率**: {(1 - plan.imposition.waste_rate) * 100:.1f}%",
                f"- **纸张余料率**: {plan.imposition.waste_percentage:.1f}%",
                "",
            ])
            
            lines.extend([
                "#### 用纸估算",
                "",
                f"- **所需印版数**: {plan.sheets_required:,} 版",
                f"- **印刷损耗**: {plan.wastage_sheets:,} 张",
                f"- **总用纸量**: {plan.total_sheets:,} 张",
                f"- **损耗占比**: {plan.total_waste_percentage:.1f}%",
            ])
            
            if imposition.paper_stock:
                total_cost = plan.total_sheets * imposition.paper_stock.price_per_sheet
                lines.append(f"- **估算纸张成本**: ¥{total_cost:,.2f}")
            
            lines.append("")
            
            risks = []
            if plan.cross_day_risk:
                risks.append("🔴 交期紧张")
            if plan.oversized_risk:
                risks.append("🟠 超规印刷")
            if plan.stock_risk:
                risks.append("🟡 库存不足")
            
            if risks:
                lines.extend([
                    "#### ⚠️ 风险提示",
                    "",
                    *[f"- {r}" for r in risks],
                    "",
                ])
            
            lines.append("---")
            lines.append("")
        
        lines.extend([
            "## 术语说明",
            "",
            "- **有效尺寸**: 成品尺寸加上两侧出血后的尺寸",
            "- **版面利用率**: 印刷品实际占用面积与纸张有效印刷面积的比例",
            "- **余料率**: 印刷后剩余的空白纸张面积比例",
            "- **印刷损耗**: 印刷过程中因调试、废品等产生的纸张损耗",
            "- **自翻版**: 一张纸印一面后翻转再印另一面，适合小批量印刷",
            "",
        ])
        
        content = "\n".join(lines)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return content
    
    def generate_waste_items_csv(self, output_path: Path) -> str:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow([
                'order_id',
                'product_name',
                'paper_type',
                'paper_size',
                'imposition_count',
                'layout',
                'total_quantity',
                'sheets_required',
                'wastage_sheets',
                'total_sheets',
                'waste_percentage',
                'imposition_waste_rate',
                'cross_day_risk',
                'oversized_risk',
                'stock_risk',
                'due_date'
            ])
            
            for plan in self.plans:
                order = plan.order
                imposition = plan.imposition
                
                paper_size = ""
                if imposition.paper_stock:
                    paper_size = f"{imposition.paper_stock.size.width.to_mm()}x{imposition.paper_stock.size.height.to_mm()}"
                
                writer.writerow([
                    order.order_id,
                    order.product_name,
                    order.paper_type,
                    paper_size,
                    imposition.layout.total_count,
                    imposition.layout.layout_string,
                    order.quantity,
                    plan.sheets_required,
                    plan.wastage_sheets,
                    plan.total_sheets,
                    f"{plan.total_waste_percentage:.2f}%",
                    f"{plan.imposition.waste_percentage:.2f}%",
                    'Y' if plan.cross_day_risk else 'N',
                    'Y' if plan.oversized_risk else 'N',
                    'Y' if plan.stock_risk else 'N',
                    order.due_date.strftime('%Y-%m-%d')
                ])
        
        return str(output_path)
    
    def export_all(self, output_dir: Path) -> dict:
        imposition_md_path = output_dir / "imposition_plan.md"
        waste_csv_path = output_dir / "waste_items.csv"
        
        md_content = self.generate_imposition_plan_md(imposition_md_path)
        csv_path = self.generate_waste_items_csv(waste_csv_path)
        
        return {
            'imposition_plan_md': str(imposition_md_path),
            'waste_items_csv': str(csv_path)
        }
