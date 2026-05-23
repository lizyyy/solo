import os
import json
import csv
from datetime import datetime
from typing import List
from pathlib import Path
from jinja2 import Template
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import box
from .models import FinalReport, ValidationErrorItem


REPORT_TEMPLATE = """
# 餐饮原料损耗分析报告

生成时间: {{ generated_at }}

## 一、总体摘要

| 指标 | 数值 |
|------|------|
| 门店数量 | {{ summary.total_stores }} |
| 原料种类 | {{ summary.total_materials }} |
| 原料分类 | {{ summary.total_categories }} |
| 总采购金额 | ¥{{ summary.total_purchase_amount }} |
| 总损耗金额 | ¥{{ summary.total_waste_amount }} |
| 整体损耗率 | {{ summary.overall_waste_rate }}% |
| 异常损耗项 | {{ summary.abnormal_items_count }} |
| 数据错误数 | {{ summary.validation_errors_count }} |

## 二、损耗率阈值设置

当前阈值: {{ config.threshold_waste_rate }}%
{% if config.date_start %}
统计开始日期: {{ config.date_start }}
{% endif %}
{% if config.date_end %}
统计结束日期: {{ config.date_end }}
{% endif %}
{% if config.target_store %}
指定门店: {{ config.target_store }}
{% endif %}
{% if config.target_category %}
指定分类: {{ config.target_category }}
{% endif %}

## 三、门店损耗排行（按损耗率降序）

| 排名 | 门店ID | 门店名称 | 采购金额 | 损耗金额 | 损耗率 |
|------|--------|----------|----------|----------|--------|
{% for item in store_rankings %}
| {{ item.rank }} | {{ item.store_id }} | {{ item.store_name }} | ¥{{ item.total_purchase }} | ¥{{ item.waste_amount }} | {{ item.waste_rate }}% |
{% endfor %}

## 四、原料分类损耗分析

| 分类 | 采购金额 | 损耗金额 | 损耗率 |
|------|----------|----------|--------|
{% for item in category_analysis %}
| {{ item.category }} | ¥{{ item.total_purchase }} | ¥{{ item.waste_amount }} | {{ item.waste_rate }}% |
{% endfor %}

## 五、异常损耗明细（损耗率 > {{ config.threshold_waste_rate }}%）

| 门店名称 | 原料名称 | 分类 | 采购量 | 采购金额 | 损耗量 | 损耗金额 | 损耗率 | 单位 |
|----------|----------|------|--------|----------|--------|----------|--------|------|
{% for item in abnormal_items %}
| {{ item.store_name }} | {{ item.material_name }} | {{ item.category }} | {{ item.purchase_quantity }} | ¥{{ item.purchase_amount }} | {{ item.waste_quantity }} | ¥{{ item.waste_amount }} | {{ item.waste_rate }}% | {{ item.unit }} |
{% endfor %}

## 六、数据校验错误记录

| 行号 | 错误类型 | 错误信息 |
|------|----------|----------|
{% for error in validation_errors %}
| {{ error.row_number }} | {{ error.error_type }} | {{ error.error_message }} |
{% endfor %}

---
*本报告由餐饮原料损耗分析工具自动生成*
"""


class OutputGenerator:
    def __init__(self, report: FinalReport, output_dir: str, overwrite: bool = False):
        self.report = report
        self.output_dir = Path(output_dir)
        self.overwrite = overwrite
        self.console = Console()
        
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _get_file_path(self, filename: str) -> Path:
        file_path = self.output_dir / filename
        if file_path.exists() and not self.overwrite:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            name, ext = os.path.splitext(filename)
            file_path = self.output_dir / f"{name}_{timestamp}{ext}"
        return file_path

    def print_terminal_summary(self):
        self.console.print("\n")
        self.console.print(Panel.fit(
            "[bold green]餐饮原料损耗分析报告[/bold green]",
            border_style="green",
            box=box.ROUNDED
        ))
        
        self.console.print(f"\n[bold yellow]生成时间:[/bold yellow] {self.report.generated_at}")
        
        summary_table = Table(title="总体摘要", box=box.SIMPLE)
        summary_table.add_column("指标", style="cyan")
        summary_table.add_column("数值", style="white", justify="right")
        
        summary = self.report.summary
        summary_table.add_row("门店数量", str(summary['total_stores']))
        summary_table.add_row("原料种类", str(summary['total_materials']))
        summary_table.add_row("原料分类", str(summary['total_categories']))
        summary_table.add_row("总采购金额", f"¥{summary['total_purchase_amount']:,.2f}")
        summary_table.add_row("总损耗金额", f"¥{summary['total_waste_amount']:,.2f}")
        summary_table.add_row("整体损耗率", f"{summary['overall_waste_rate']}%")
        summary_table.add_row("异常损耗项", f"[red]{summary['abnormal_items_count']}[/red]")
        summary_table.add_row("数据错误数", f"[yellow]{summary['validation_errors_count']}[/yellow]")
        
        self.console.print(summary_table)
        
        if self.report.store_rankings:
            ranking_table = Table(title="门店损耗排行 (Top 5)", box=box.SIMPLE)
            ranking_table.add_column("排名", style="magenta")
            ranking_table.add_column("门店名称", style="cyan")
            ranking_table.add_column("采购金额", style="white", justify="right")
            ranking_table.add_column("损耗金额", style="red", justify="right")
            ranking_table.add_column("损耗率", style="yellow", justify="right")
            
            for item in self.report.store_rankings[:5]:
                ranking_table.add_row(
                    str(item.rank),
                    item.store_name,
                    f"¥{item.total_purchase:,.2f}",
                    f"¥{item.waste_amount:,.2f}",
                    f"{item.waste_rate}%"
                )
            
            self.console.print(ranking_table)
        
        if self.report.abnormal_items:
            abnormal_table = Table(title="异常损耗明细 (Top 10)", box=box.SIMPLE)
            abnormal_table.add_column("门店", style="cyan")
            abnormal_table.add_column("原料", style="magenta")
            abnormal_table.add_column("采购量", style="white", justify="right")
            abnormal_table.add_column("损耗量", style="red", justify="right")
            abnormal_table.add_column("损耗率", style="yellow", justify="right")
            
            for item in self.report.abnormal_items[:10]:
                abnormal_table.add_row(
                    item.store_name,
                    item.material_name,
                    f"{item.purchase_quantity}",
                    f"{item.waste_quantity}",
                    f"[red]{item.waste_rate}%[/red]"
                )
            
            self.console.print(abnormal_table)
        
        if self.report.validation_errors:
            error_table = Table(title="数据校验错误", box=box.SIMPLE)
            error_table.add_column("行号", style="magenta")
            error_table.add_column("错误类型", style="red")
            error_table.add_column("错误信息", style="yellow")
            
            for error in self.report.validation_errors[:10]:
                error_table.add_row(
                    str(error.row_number),
                    error.error_type,
                    error.error_message[:50]
                )
            
            self.console.print(error_table)
        
        self.console.print(f"\n[bold green]报告输出目录:[/bold green] {self.output_dir.absolute()}")
        self.console.print("\n")

    def export_json(self) -> Path:
        file_path = self._get_file_path("waste_report.json")
        
        report_dict = {
            'summary': self.report.summary,
            'store_rankings': [dict(item) for item in self.report.store_rankings],
            'category_analysis': [dict(item) for item in self.report.category_analysis],
            'abnormal_items': [dict(item) for item in self.report.abnormal_items],
            'validation_errors': [dict(item) for item in self.report.validation_errors],
            'config': dict(self.report.config),
            'generated_at': self.report.generated_at.isoformat()
        }
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(report_dict, f, ensure_ascii=False, indent=2, default=str)
        
        return file_path

    def export_csv(self) -> List[Path]:
        exported_files = []
        
        summary_path = self._get_file_path("summary.csv")
        with open(summary_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['指标', '数值'])
            for k, v in self.report.summary.items():
                writer.writerow([k, v])
        exported_files.append(summary_path)
        
        rankings_path = self._get_file_path("store_rankings.csv")
        with open(rankings_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['rank', 'store_id', 'store_name', 'total_purchase', 'total_waste', 'waste_rate', 'waste_amount'])
            writer.writeheader()
            for item in self.report.store_rankings:
                writer.writerow(dict(item))
        exported_files.append(rankings_path)
        
        category_path = self._get_file_path("category_analysis.csv")
        with open(category_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['category', 'total_purchase', 'total_waste', 'waste_rate', 'waste_amount'])
            writer.writeheader()
            for item in self.report.category_analysis:
                writer.writerow(dict(item))
        exported_files.append(category_path)
        
        abnormal_path = self._get_file_path("abnormal_items.csv")
        with open(abnormal_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['store_id', 'store_name', 'material_id', 'material_name', 'category', 'purchase_quantity', 'purchase_amount', 'usage_quantity', 'waste_quantity', 'waste_amount', 'waste_rate', 'is_abnormal', 'unit'])
            writer.writeheader()
            for item in self.report.abnormal_items:
                writer.writerow(dict(item))
        exported_files.append(abnormal_path)
        
        errors_path = self._get_file_path("validation_errors.csv")
        with open(errors_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['row_number', 'error_type', 'error_message', 'raw_data'])
            writer.writeheader()
            for item in self.report.validation_errors:
                writer.writerow(dict(item))
        exported_files.append(errors_path)
        
        return exported_files

    def generate_markdown_report(self) -> Path:
        file_path = self._get_file_path("waste_report.md")
        
        template = Template(REPORT_TEMPLATE)
        report_content = template.render(
            generated_at=self.report.generated_at,
            summary=self.report.summary,
            config=self.report.config,
            store_rankings=self.report.store_rankings,
            category_analysis=self.report.category_analysis,
            abnormal_items=self.report.abnormal_items,
            validation_errors=self.report.validation_errors
        )
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(report_content)
        
        return file_path

    def generate_all(self) -> dict:
        self.print_terminal_summary()
        
        json_path = self.export_json()
        csv_paths = self.export_csv()
        md_path = self.generate_markdown_report()
        
        return {
            'json': json_path,
            'csv': csv_paths,
            'markdown': md_path
        }
