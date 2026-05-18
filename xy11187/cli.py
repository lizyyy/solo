#!/usr/bin/env python3
import click
import sys
from vending_machine_checker.config import config
from vending_machine_checker.file_processor import FileProcessor
from vending_machine_checker.report_generator import ReportGenerator

@click.group()
def cli():
    """无人售货机货道校验 CLI 工具"""
    pass

@cli.command()
@click.option('--input', '-i', 'input_dir', default='input', help='输入文件目录')
@click.option('--output', '-o', 'output_dir', default='output', help='输出报告目录')
@click.option('--force', '-f', is_flag=True, help='强制重新处理所有文件（忽略已处理记录）')
def run(input_dir, output_dir, force):
    """运行货道校验"""
    click.echo("=" * 60)
    click.echo("         无人售货机货道校验工具")
    click.echo("=" * 60)
    
    config.INPUT_DIR = input_dir
    config.OUTPUT_DIR = output_dir
    config.ensure_dirs()
    
    processor = FileProcessor()
    
    if force:
        click.echo("\n⚠️  强制模式：清除已处理记录，重新处理所有文件")
        processor.processed_files = {}
    
    files = processor.get_all_input_files()
    
    if not files:
        click.echo(f"\n❌ 在 {input_dir} 目录中未找到任何支持的文件")
        click.echo(f"支持的格式: {', '.join(config.VALID_FILE_TYPES)}")
        sys.exit(1)
    
    click.echo(f"\n📁 找到 {len(files)} 个待处理文件:")
    for f in files:
        click.echo(f"  - {f}")
    
    click.echo("\n⏳ 开始处理...")
    
    results = processor.process_all_files()
    
    click.echo("\n✅ 处理完成！")
    
    generator = ReportGenerator()
    summary_path, summary_text = generator.save_all_reports(results)
    
    click.echo("\n" + summary_text)
    
    click.echo(f"\n📄 报告已保存至: {summary_path}")
    click.echo(f"📂 所有输出文件位于: {output_dir}")

@cli.command()
def reset():
    """重置处理记录，下次运行将重新处理所有文件"""
    import os
    record_path = os.path.join(config.OUTPUT_DIR, config.PROCESSED_RECORD)
    if os.path.exists(record_path):
        os.remove(record_path)
        click.echo(f"✅ 已重置处理记录: {record_path}")
    else:
        click.echo("ℹ️  没有找到处理记录，无需重置")

@cli.command()
def status():
    """查看已处理文件状态"""
    processor = FileProcessor()
    
    if not processor.processed_files:
        click.echo("ℹ️  尚未处理任何文件")
        return
    
    click.echo("=" * 60)
    click.echo("         已处理文件记录")
    click.echo("=" * 60)
    
    for filename, info in processor.processed_files.items():
        status = "✅ 成功" if info.get("success", False) else "❌ 失败"
        click.echo(f"\n📄 {filename}")
        click.echo(f"   状态: {status}")
        click.echo(f"   处理时间: {info.get('processed_at', 'N/A')}")
        click.echo(f"   总行数: {info.get('total_rows', 0)}")
        click.echo(f"   通过: {info.get('passed_count', 0)}, 不通过: {info.get('failed_count', 0)}")

@cli.command()
def guide():
    """显示一线同事操作指南"""
    guide_text = """
======================================================================
                    无人售货机货道校验工具 - 操作指南
======================================================================

【前置准备】
1. 将所有待校验的 Excel/CSV 文件放入 input 目录
2. 确保文件包含以下列：
   - 售货机编号 (格式: VM + 6位数字，如 VM000001)
   - 货道编号 (格式: 大写字母 + 2位数字，如 A01)
   - 商品名称
   - 商品编码
   - 库存数量
   - 校验状态

【运行步骤】
1. 运行命令: python cli.py run
2. 等待程序处理完成
3. 查看 output 目录中的报告文件:
   - 校验汇总报告_*.txt: 整体汇总和操作指引
   - 问题明细_*.xlsx: 所有校验不通过的详细清单
   - 特殊情况处理_*.xlsx: 组合商品、临时换品、需复跑项

【常见问题处理】
1. 文件损坏/解析失败 → 修复文件后重新运行
2. 列缺失 → 补充必需列
3. 货道编号格式错误 → 统一改为 A01 格式
4. 负库存 → 核实实际库存数量

【特殊标记说明】
- 组合商品: 商品名称含"组合"/"套餐" → 需核对子商品配置
- 临时换品: 校验状态含"临时"/"换品" → 需登记换品记录
- 可复跑: 校验状态含"复跑"/"重跑"/"待确认" → 需人工确认后复跑

【注意事项】
- 同一文件内容不变时重复运行会自动跳过（幂等性）
- 如需强制重新处理: python cli.py run --force
- 如需清除处理记录: python cli.py reset

======================================================================
"""
    click.echo(guide_text)

if __name__ == '__main__':
    cli()
