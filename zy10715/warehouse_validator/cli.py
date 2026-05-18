"""仓库冻结快照库存释放校验 CLI 入口"""

import click
import pandas as pd
from pathlib import Path
import sys
import os
from datetime import datetime

from .validator import WarehouseSnapshotValidator, ValidationResult


@click.group(invoke_without_command=True)
@click.version_option(version='0.1.0', prog_name='仓库冻结快照库存释放校验')
@click.pass_context
def cli(ctx):
    """仓库冻结快照库存释放校验 CLI 工具
    
    用于校验仓库冻结快照中的库存批次，计算可释放和不可释放批次，
    并重点处理批次拆分、负库存、在途占用等异常情况。
    """
    if ctx.invoked_subcommand is None:
        click.echo(ctx.get_help())


@cli.command()
@click.argument('input_path', type=click.Path(exists=True))
@click.option('--rules', '-r', type=click.Path(exists=True), help='规则文件路径 (JSON格式)')
@click.option('--output', '-o', type=click.Path(), help='输出目录路径', default='./output')
@click.option('--dry-run', '-d', is_flag=True, help='试运行模式，不生成输出文件')
@click.option('--force', '-f', is_flag=True, help='覆盖已存在的输出文件')
def validate(input_path, rules, output, dry_run, force):
    """执行仓库冻结快照库存释放校验
    
    INPUT_PATH: 输入文件路径（支持 CSV 和 Excel 格式）
    """
    click.echo("=" * 60)
    click.echo("        仓库冻结快照库存释放校验 CLI 工具")
    click.echo("=" * 60)
    click.echo(f"输入文件: {input_path}")
    click.echo(f"规则文件: {rules or '使用默认规则'}")
    click.echo(f"输出目录: {output}")
    click.echo(f"试运行模式: {'是' if dry_run else '否'}")
    click.echo(f"覆盖模式: {'是' if force else '否'}")
    click.echo("-" * 60)

    output_dir = Path(output)
    if not dry_run and not output_dir.exists():
        output_dir.mkdir(parents=True)
        click.echo(f"创建输出目录: {output_dir}")

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    input_name = Path(input_path).stem

    try:
        validator = WarehouseSnapshotValidator(rules_file=rules)
        result = validator.validate(input_path)
        
        _print_statistics(result)
        
        if not dry_run:
            _write_output_files(result, output_dir, input_name, timestamp, force)
            click.echo(f"\n输出文件已保存至: {output_dir.absolute()}")
        
        click.echo("\n" + "=" * 60)
        click.echo("                  校验完成！")
        click.echo("=" * 60)
        
    except Exception as e:
        click.echo(f"\n错误: {str(e)}", err=True)
        sys.exit(1)


def _print_statistics(result: ValidationResult):
    """打印统计信息"""
    click.echo("\n📊 校验统计:")
    click.echo("-" * 40)
    
    stats = result.statistics
    click.echo(f"总记录数: {stats['总记录数']}")
    click.echo(f"有效记录数: {stats['有效记录数']}")
    click.echo(f"异常记录数: {stats['异常记录数']}")
    
    click.echo("\n📦 批次分类:")
    click.echo(f"  可释放批次: {stats['可释放批次数量']} 条")
    click.echo(f"    可释放库存总数: {stats['可释放库存总数']}")
    click.echo(f"  不可释放批次: {stats['不可释放批次数量']} 条")
    click.echo(f"    不可释放库存总数: {stats['不可释放库存总数']}")
    
    click.echo("\n⚠️  异常情况:")
    click.echo(f"  负库存批次: {stats['负库存批次数量']} 条")
    click.echo(f"  在途/占用批次: {stats['在途占用批次数量']} 条")
    click.echo(f"  拆分批次涉及: {stats['拆分批次涉及行数']} 行")
    
    if not result.bad_rows.empty:
        click.echo("\n❌ 数据异常行:")
        for _, row in result.bad_rows.iterrows():
            click.echo(f"  第{row['行号']}行: {row['异常原因']}")


def _write_output_files(result: ValidationResult, output_dir: Path, 
                       input_name: str, timestamp: str, force: bool):
    """写入输出文件"""
    prefix = f"仓库冻结快照库存释放校验_{input_name}_{timestamp}"
    
    files_to_write = [
        ("_可释放批次.xlsx", result.releasable_batches, "可释放批次"),
        ("_不可释放批次.xlsx", result.unreleasable_batches, "不可释放批次"),
        ("_异常情况_负库存.xlsx", result.negative_inventory, "负库存批次"),
        ("_异常情况_在途占用.xlsx", result.in_transit_occupied, "在途占用批次"),
        ("_异常情况_批次拆分.xlsx", result.split_batches, "批次拆分记录"),
        ("_数据异常行.xlsx", result.bad_rows, "数据异常行"),
    ]
    
    for suffix, df, sheet_name in files_to_write:
        if df.empty:
            continue
            
        filename = f"{prefix}{suffix}"
        filepath = output_dir / filename
        
        if filepath.exists() and not force:
            click.echo(f"跳过已存在文件: {filename} (使用 -f 强制覆盖)")
            continue
            
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name=sheet_name, index=False)
        
        click.echo(f"已生成: {filename} ({len(df)} 条)")


def main():
    cli()


if __name__ == '__main__':
    main()
