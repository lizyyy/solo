#!/usr/bin/env python3
"""
Report Exporter CLI - 本地报表导出工具
"""

import click
import os
from datetime import datetime
from typing import Optional

from .data_loader import DataLoader
from .metrics_calculator import MetricsCalculator
from .report_generator import ReportGenerator
from .report_verifier import ReportVerifier
from .exceptions import DataValidationError


@click.group()
@click.version_option(version='1.0.0')
def cli():
    """本地报表导出工具 - 支持生成 Excel、PDF、Markdown 三种报告"""
    pass


@cli.command()
@click.option('--orders', '-o', required=True, type=click.Path(exists=True),
              help='订单数据 CSV 文件路径')
@click.option('--metrics', '-m', required=True, type=click.Path(exists=True),
              help='指标配置 YAML 文件路径')
@click.option('--template', '-t', required=True, type=click.Path(exists=True),
              help='报告模板 Markdown 文件路径')
@click.option('--output-dir', '-d', default='./reports',
              help='输出目录 (默认: ./reports)')
@click.option('--prefix', '-p', default='report',
              help='输出文件前缀 (默认: report)')
@click.option('--format', '-f', multiple=True, default=['excel', 'pdf', 'markdown'],
              type=click.Choice(['excel', 'pdf', 'markdown']),
              help='输出格式 (可多次指定，默认全部)')
def generate(orders, metrics, template, output_dir, prefix, format):
    """生成报表 - 基于订单数据计算指标并生成报告"""
    
    try:
        click.echo(f"📊 开始处理数据...")
        click.echo(f"   订单数据: {orders}")
        click.echo(f"   指标配置: {metrics}")
        click.echo(f"   模板文件: {template}")
        
        os.makedirs(output_dir, exist_ok=True)
        
        loader = DataLoader()
        orders_df, metrics_config, template_content = loader.load_all(
            orders_csv_path=orders,
            metrics_yaml_path=metrics,
            template_md_path=template
        )
        
        click.echo(f"   加载订单记录: {len(orders_df)} 条")
        
        calculator = MetricsCalculator(orders_df, metrics_config)
        metrics_result = calculator.calculate_all_metrics()
        
        click.echo(f"   计算完成: GMV={metrics_result['gmv']}, 退款率={metrics_result['refund_rate']}%")
        click.echo(f"   发现异常订单: {len(metrics_result['anomalous_orders'])} 条")
        
        generator = ReportGenerator(template_content, metrics_config)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_files = {}
        
        if 'excel' in format:
            excel_path = os.path.join(output_dir, f"{prefix}_{timestamp}.xlsx")
            generator.generate_excel(metrics_result, orders_df, excel_path)
            output_files['excel'] = excel_path
            click.echo(f"✅ Excel 报告已生成: {excel_path}")
        
        if 'pdf' in format:
            pdf_path = os.path.join(output_dir, f"{prefix}_{timestamp}.pdf")
            generator.generate_pdf(metrics_result, orders_df, pdf_path)
            output_files['pdf'] = pdf_path
            click.echo(f"✅ PDF 报告已生成: {pdf_path}")
        
        if 'markdown' in format:
            md_path = os.path.join(output_dir, f"{prefix}_{timestamp}.md")
            generator.generate_markdown(metrics_result, orders_df, md_path)
            output_files['markdown'] = md_path
            click.echo(f"✅ Markdown 报告已生成: {md_path}")
        
        click.echo(f"\n🎉 报告生成完成！共生成 {len(output_files)} 份报告。")
        click.echo(f"   输出目录: {os.path.abspath(output_dir)}")
        
        return output_files
        
    except DataValidationError as e:
        click.echo(f"\n❌ 数据验证错误: {e}", err=True)
        click.echo("\n💡 修复建议:")
        for suggestion in e.suggestions:
            click.echo(f"   - {suggestion}")
        raise click.Abort()
    except Exception as e:
        click.echo(f"\n❌ 处理失败: {e}", err=True)
        raise click.Abort()


@cli.command()
@click.option('--excel', '-e', type=click.Path(exists=True),
              help='Excel 报告文件路径')
@click.option('--pdf', '-p', type=click.Path(exists=True),
              help='PDF 报告文件路径')
@click.option('--markdown', '-m', type=click.Path(exists=True),
              help='Markdown 报告文件路径')
@click.option('--output', '-o', type=click.Path(),
              help='验证结果输出文件路径 (JSON 格式)')
def verify(excel, pdf, markdown, output):
    """验证报告一致性 - 检查三份报告的标题、章节、指标、表格、异常说明和结论是否一致"""
    
    if not any([excel, pdf, markdown]):
        click.echo("❌ 请至少指定一种报告格式进行验证", err=True)
        raise click.Abort()
    
    try:
        click.echo("🔍 开始验证报告一致性...")
        
        verifier = ReportVerifier()
        report_contents = {}
        
        if excel:
            click.echo(f"   读取 Excel 报告: {excel}")
            report_contents['excel'] = verifier.extract_report_content(excel, 'excel')
        
        if pdf:
            click.echo(f"   读取 PDF 报告: {pdf}")
            report_contents['pdf'] = verifier.extract_report_content(pdf, 'pdf')
        
        if markdown:
            click.echo(f"   读取 Markdown 报告: {markdown}")
            report_contents['markdown'] = verifier.extract_report_content(markdown, 'markdown')
        
        click.echo("   分析报告内容...")
        verification_result = verifier.verify_consistency(report_contents)
        
        if verification_result['consistent']:
            click.echo("\n✅ 所有报告内容一致！")
            click.echo(f"   报告数量: {len(report_contents)}")
            for fmt, content in report_contents.items():
                click.echo(f"   - {fmt.upper()}: {content.get('title', '未找到标题')}")
        else:
            click.echo("\n❌ 发现报告不一致！")
            click.echo(f"\n差异详情:")
            for diff in verification_result['differences']:
                click.echo(f"\n📍 差异类型: {diff['type']}")
                click.echo(f"   位置: {diff['location']}")
                if 'expected' in diff:
                    click.echo(f"   期望值: {diff['expected']}")
                if 'actual' in diff:
                    click.echo(f"   实际值: {diff['actual']}")
                if 'suggestion' in diff:
                    click.echo(f"\n💡 修复建议: {diff['suggestion']}")
        
        if output:
            import json
            with open(output, 'w', encoding='utf-8') as f:
                json.dump(verification_result, f, ensure_ascii=False, indent=2)
            click.echo(f"\n📝 验证结果已保存到: {output}")
        
        return verification_result
        
    except Exception as e:
        click.echo(f"\n❌ 验证失败: {e}", err=True)
        raise click.Abort()


@cli.command()
@click.option('--output-dir', '-d', default='./examples',
              help='样例数据输出目录 (默认: ./examples)')
@click.option('--include-bad-data', is_flag=True,
              help='是否包含坏数据样例')
def seed(output_dir, include_bad_data):
    """生成样例数据 - 创建 orders.csv、metrics.yaml 和 report-template.md 样例文件"""
    
    os.makedirs(output_dir, exist_ok=True)
    
    click.echo("🌱 生成样例数据...")
    
    orders_csv = """order_id,amount,status,channel,order_time,user_id,product_id
ORD001,199.99,completed,wechat,2026-05-01 09:30:00,USER001,PROD001
ORD002,399.00,completed,taobao,2026-05-01 10:15:00,USER002,PROD002
ORD003,59.90,completed,jingdong,2026-05-01 11:20:00,USER003,PROD003
ORD004,899.50,completed,wechat,2026-05-01 14:05:00,USER004,PROD004
ORD005,129.00,refunded,taobao,2026-05-01 15:30:00,USER005,PROD005
ORD006,2599.99,completed,wechat,2026-05-01 16:45:00,USER006,PROD006
ORD007,45.00,completed,jingdong,2026-05-02 09:00:00,USER007,PROD007
ORD008,789.00,completed,taobao,2026-05-02 10:30:00,USER008,PROD008
ORD009,1999.00,refunded,wechat,2026-05-02 11:15:00,USER009,PROD009
ORD010,69.90,completed,jingdong,2026-05-02 14:20:00,USER010,PROD010
"""
    
    metrics_yaml = """# 指标配置文件
report_title: "月度电商销售报告"
report_period:
  start: "2026-05-01"
  end: "2026-05-05"

# 核心指标定义
core_metrics:
  - name: "GMV"
    description: "商品交易总额"
    unit: "元"
  - name: "退款率"
    description: "退款订单占比"
    unit: "%"
  - name: "渠道转化率"
    description: "各渠道订单占比"
    unit: "%"

# 渠道配置
channels:
  - name: "wechat"
    display_name: "微信小程序"
  - name: "taobao"
    display_name: "淘宝"
  - name: "jingdong"
    display_name: "京东"

# 异常检测阈值
anomaly_thresholds:
  high_amount_multiplier: 3.0
  low_amount_threshold: 0

# 报告结论模板
conclusion_template: |
  本月销售表现{{if gmv > 5000}}良好{{else}}一般{{/if}}，GMV 达到 {{gmv}} 元。
  退款率为 {{refund_rate}}%，{{if refund_rate < 5}}处于健康水平{{else}}需要关注{{/if}}。
  主要销售渠道为 {{top_channel}}。
"""
    
    template_md = """# {{report_title}}

**报告周期**: {{report_period.start}} - {{report_period.end}}

---

## 1. 执行摘要

### 核心指标概览

| 指标 | 数值 | 单位 |
|------|------|------|
| GMV | {{gmv}} | 元 |
| 总订单数 | {{total_orders}} | 笔 |
| 平均客单价 | {{average_order_value}} | 元 |
| 退款率 | {{refund_rate}} | % |

---

## 2. 渠道分析

### 渠道分布

| 渠道 | 订单数 | 占比 |
|------|--------|------|
{{#channel_conversion}}
| {{display_name}} | {{order_count}} | {{rate}}% |
{{/channel_conversion}}

### 主要渠道表现

Top 3 渠道: {{top_channels}}

---

## 3. 异常订单分析

### 异常订单统计

- 异常订单总数: {{anomaly_count}}
- 异常订单占比: {{anomaly_rate}}%

### 异常订单详情

| 订单ID | 金额 | 状态 | 渠道 | 异常原因 |
|--------|------|------|------|----------|
{{#anomalous_orders}}
| {{order_id}} | {{amount}} | {{status}} | {{channel}} | {{reasons}} |
{{/anomalous_orders}}

---

## 4. 结论与建议

### 结论

{{conclusion}}

### 建议

1. {{suggestion_1}}
2. {{suggestion_2}}
3. {{suggestion_3}}

---

**报告生成时间**: {{generated_at}}
"""
    
    orders_path = os.path.join(output_dir, 'orders.csv')
    with open(orders_path, 'w', encoding='utf-8') as f:
        f.write(orders_csv)
    click.echo(f"✅ 创建订单样例: {orders_path}")
    
    metrics_path = os.path.join(output_dir, 'metrics.yaml')
    with open(metrics_path, 'w', encoding='utf-8') as f:
        f.write(metrics_yaml)
    click.echo(f"✅ 创建指标配置样例: {metrics_path}")
    
    template_path = os.path.join(output_dir, 'report-template.md')
    with open(template_path, 'w', encoding='utf-8') as f:
        f.write(template_md)
    click.echo(f"✅ 创建报告模板样例: {template_path}")
    
    if include_bad_data:
        bad_orders_csv = """order_id,amount,status,channel,order_time
ORD001,199.99,completed,wechat,2026-05-01 09:30:00
ORD002,399.00,completed,,2026-05-01 10:15:00
ORD003,-59.90,completed,jingdong,2026-05-01 11:20:00
,899.50,completed,wechat,2026-05-01 14:05:00
ORD005,129.00,refunded,taobao,
ORD006,99999.99,completed,wechat,2026-05-01 16:45:00
ORD007,0,completed,jingdong,2026-05-02 09:00:00
"""
        
        bad_orders_path = os.path.join(output_dir, 'orders_bad.csv')
        with open(bad_orders_path, 'w', encoding='utf-8') as f:
            f.write(bad_orders_csv)
        click.echo(f"⚠️  创建坏数据样例: {bad_orders_path}")
        click.echo("   包含的问题:")
        click.echo("   - 缺少 channel (ORD002)")
        click.echo("   - 负金额 (ORD003: -59.90)")
        click.echo("   - 缺少 order_id (第4行)")
        click.echo("   - 缺少 order_time (ORD005)")
        click.echo("   - 异常高金额 (ORD006: 99999.99)")
        click.echo("   - 零金额 (ORD007: 0)")
    
    click.echo(f"\n🌱 样例数据生成完成！")
    click.echo(f"   输出目录: {os.path.abspath(output_dir)}")
    click.echo(f"\n💡 使用示例:")
    click.echo(f"   report-exporter generate -o {orders_path} -m {metrics_path} -t {template_path}")


if __name__ == '__main__':
    cli()
