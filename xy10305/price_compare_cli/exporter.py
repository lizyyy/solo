from typing import List, Dict, Optional
from datetime import datetime
import csv
from io import StringIO

from .models import SupplierQuote, Item, Package
from .comparison import ComparisonResult, NormalizedProduct, generate_comparison_summary


def format_price(price: Optional[float]) -> str:
    if price is None:
        return "-"
    return f"¥{price:,.2f}"


def format_tax_rate(rate: Optional[float]) -> str:
    if rate is None:
        return "-"
    return f"{rate:.0f}%"


def format_date(dt: Optional[datetime]) -> str:
    if dt is None:
        return "-"
    return dt.strftime('%Y-%m-%d')


def generate_supplier_detail_markdown(quote: SupplierQuote) -> str:
    lines = []
    lines.append(f"# 供应商报价详情: {quote.supplier_name}")
    lines.append("")
    lines.append(f"**报价ID**: {quote.quote_id}")
    lines.append(f"**报价日期**: {format_date(quote.quote_date)}")
    lines.append("")
    
    lines.append("## 报价汇总")
    lines.append("")
    lines.append("| 项目 | 金额 |")
    lines.append("|------|------|")
    lines.append(f"| 商品小计 (不含税) | {format_price(quote.items_subtotal)} |")
    lines.append(f"| 商品税额 | {format_price(quote.items_tax)} |")
    lines.append(f"| 运费 | {format_price(quote.shipping_fee)} |")
    lines.append(f"| 运费税额 | {format_price(quote.shipping_tax)} |")
    lines.append(f"| **总价 (含税)** | **{format_price(quote.grand_total)}** |")
    lines.append("")
    
    if quote.items:
        lines.append("## 商品明细")
        lines.append("")
        lines.append("| SKU | 商品名称 | 数量 | 单位 | 单价(不含税) | 税率 | 小计(含税) | 备注 |")
        lines.append("|-----|----------|------|------|--------------|------|------------|------|")
        
        for item in quote.items:
            tax_display = format_tax_rate(item.tax_rate)
            note = ""
            if item.is_gift:
                note = "🎁 赠品"
            warnings_str = "、".join(w.value for w in item.warnings)
            if warnings_str:
                note = f"⚠️ {warnings_str}" if not note else f"{note} | ⚠️ {warnings_str}"
            
            lines.append(
                f"| {item.sku} | {item.name} | {item.quantity:g} | {item.unit} | "
                f"{format_price(item.unit_price)} | {tax_display} | "
                f"{format_price(item.total)} | {note} |"
            )
        lines.append("")
    
    if quote.packages:
        lines.append("## 套餐包")
        lines.append("")
        lines.append("| SKU | 套餐名称 | 数量 | 单位 | 套餐价 | 税率 | 备注 |")
        lines.append("|-----|----------|------|------|--------|------|------|")
        
        for pkg in quote.packages:
            warnings_str = "、".join(w.value for w in pkg.warnings)
            note = f"⚠️ {warnings_str}" if warnings_str else ""
            lines.append(
                f"| {pkg.sku} | {pkg.name} | {pkg.quantity:g} | {pkg.unit} | "
                f"{format_price(pkg.package_price)} | {format_tax_rate(pkg.tax_rate)} | {note} |"
            )
        lines.append("")
    
    if quote.corrections:
        lines.append("## 修正历史")
        lines.append("")
        lines.append("| 时间 | 字段 | 原值 | 新值 | 原因 |")
        lines.append("|------|------|------|------|------|")
        for corr in quote.corrections:
            lines.append(
                f"| {format_date(corr.timestamp)} {corr.timestamp.strftime('%H:%M:%S') if corr.timestamp else ''} | "
                f"{corr.field} | {corr.old_value} | {corr.new_value} | {corr.reason} |"
            )
        lines.append("")
    
    if quote.all_warnings:
        lines.append("## ⚠️ 警告信息")
        lines.append("")
        for w in quote.all_warnings:
            lines.append(f"- {w}")
        lines.append("")
    
    return "\n".join(lines)


def generate_comparison_markdown(
    result: ComparisonResult,
    quotes: List[SupplierQuote]
) -> str:
    lines = []
    summary = generate_comparison_summary(result)
    
    lines.append("# 采购报价比价报告")
    lines.append("")
    lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")
    
    lines.append("## 报告摘要")
    lines.append("")
    lines.append("| 指标 | 数值 |")
    lines.append("|------|------|")
    lines.append(f"| 参与比价的供应商数 | {len(result.supplier_totals)} |")
    lines.append(f"| 商品总数 | {summary['total_products']} |")
    lines.append(f"| 有多份报价的商品 | {summary['products_with_multiple_quotes']} |")
    lines.append(f"| 单位不一致的商品 | {summary['products_with_unit_issues']} |")
    lines.append(f"| 警告总数 | {summary['total_warnings']} |")
    lines.append(f"| 估算可节省金额 | {format_price(summary['estimated_savings'])} |")
    lines.append("")
    
    lines.append("## 供应商报价汇总")
    lines.append("")
    
    supplier_names = list(result.supplier_totals.keys())
    header = "| 项目 | " + " | ".join(supplier_names) + " |"
    separator = "|------|" + "|".join(["------" for _ in supplier_names]) + "|"
    
    lines.append(header)
    lines.append(separator)
    
    for label, key in [
        ("商品小计(不含税)", "items_subtotal"),
        ("商品税额", "items_tax"),
        ("运费", "shipping_fee"),
        ("运费税额", "shipping_tax"),
        ("**总价(含税)**", "grand_total"),
    ]:
        values = [format_price(result.supplier_totals[s].get(key, 0)) for s in supplier_names]
        lines.append(f"| {label} | " + " | ".join(values) + " |")
    
    lines.append("")
    
    lines.append("## 按商品比价明细")
    lines.append("")
    
    all_suppliers = list(result.supplier_totals.keys())
    
    lines.append("| 商品 | SKU | 标准单位 | " + " | ".join(f"{s} 含税单价" for s in all_suppliers) + " | 最优供应商 |")
    lines.append("|------|-----|----------|" + "|".join(["------" for _ in range(len(all_suppliers) + 1)]) + "|")
    
    for prod_key, product in result.products.items():
        unit_note = "" if product.all_same_unit else " ⚠️单位不一致"
        
        price_cells = []
        for supplier in all_suppliers:
            if supplier in product.supplier_quotations:
                data = product.supplier_quotations[supplier]
                price_str = format_price(data['unit_price_tax_incl'])
                if supplier == product.best_supplier:
                    price_str = f"**{price_str}** 🥇"
                if data['is_gift']:
                    price_str = "🎁 赠品"
                if not product.all_same_unit and supplier in product.unit_mismatch_suppliers:
                    price_str = f"{price_str} ({data['unit']})"
                price_cells.append(price_str)
            else:
                price_cells.append("-")
        
        best = product.best_supplier or "-"
        lines.append(
            f"| {product.name}{unit_note} | {product.sku} | {product.normalized_unit} | "
            + " | ".join(price_cells) + f" | {best} |"
        )
    
    lines.append("")
    
    if result.warnings:
        lines.append("## ⚠️ 警告与注意事项")
        lines.append("")
        for w in result.warnings:
            lines.append(f"- {w}")
        lines.append("")
    
    lines.append("## 供应商详细报价")
    lines.append("")
    for quote in quotes:
        lines.append(f"### {quote.supplier_name}")
        lines.append("")
        lines.append(f"- 报价ID: {quote.quote_id}")
        lines.append(f"- 报价日期: {format_date(quote.quote_date)}")
        lines.append(f"- 商品数: {len(quote.items)}")
        lines.append(f"- 套餐数: {len(quote.packages)}")
        lines.append(f"- 总价(含税): {format_price(quote.grand_total)}")
        if quote.corrections:
            lines.append(f"- 修正记录: {len(quote.corrections)} 条")
        lines.append("")
    
    return "\n".join(lines)


def generate_comparison_csv(result: ComparisonResult) -> str:
    output = StringIO()
    writer = csv.writer(output)
    
    all_suppliers = list(result.supplier_totals.keys())
    
    writer.writerow([
        "商品名称", "SKU", "标准单位", "单位一致性",
    ] + [f"{s}_数量" for s in all_suppliers] + [f"{s}_单位" for s in all_suppliers] +
      [f"{s}_不含税单价" for s in all_suppliers] + [f"{s}_税率" for s in all_suppliers] +
      [f"{s}_含税单价" for s in all_suppliers] + ["最优供应商"])
    
    for prod_key, product in result.products.items():
        row = [
            product.name,
            product.sku,
            product.normalized_unit,
            "一致" if product.all_same_unit else "不一致",
        ]
        
        for supplier in all_suppliers:
            if supplier in product.supplier_quotations:
                data = product.supplier_quotations[supplier]
                row.append(data['quantity'])
            else:
                row.append("")
        
        for supplier in all_suppliers:
            if supplier in product.supplier_quotations:
                data = product.supplier_quotations[supplier]
                row.append(data['unit'])
            else:
                row.append("")
        
        for supplier in all_suppliers:
            if supplier in product.supplier_quotations:
                data = product.supplier_quotations[supplier]
                row.append(f"{data['unit_price']:.4f}" if not data['is_gift'] else "0(赠品)")
            else:
                row.append("")
        
        for supplier in all_suppliers:
            if supplier in product.supplier_quotations:
                data = product.supplier_quotations[supplier]
                row.append(f"{data['tax_rate']:.0f}%" if data['tax_rate'] is not None else "")
            else:
                row.append("")
        
        for supplier in all_suppliers:
            if supplier in product.supplier_quotations:
                data = product.supplier_quotations[supplier]
                row.append(f"{data['unit_price_tax_incl']:.4f}" if not data['is_gift'] else "赠品")
            else:
                row.append("")
        
        row.append(product.best_supplier or "")
        writer.writerow(row)
    
    output.seek(0)
    return output.read()


def export_markdown(
    result: ComparisonResult,
    quotes: List[SupplierQuote],
    output_path: str
):
    content = generate_comparison_markdown(result, quotes)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(content)


def export_csv(result: ComparisonResult, output_path: str):
    content = generate_comparison_csv(result)
    with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
        f.write(content)
