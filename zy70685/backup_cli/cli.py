#!/usr/bin/env python3
import click
import sys
from datetime import datetime
from typing import Optional

from backup_cli.parser.csv_parser import BackupCSVParser
from backup_cli.rules.engine import BusinessRuleEngine
from backup_cli.tracker.source_tracker import SourceTracker
from backup_cli.reports.generator import ReportGenerator


class ColorPrinter:
    @staticmethod
    def print_header(text: str):
        click.echo(click.style(f"\n{'=' * 60}", fg='cyan', bold=True))
        click.echo(click.style(f"  {text}", fg='cyan', bold=True))
        click.echo(click.style(f"{'=' * 60}", fg='cyan', bold=True))

    @staticmethod
    def print_success(text: str):
        click.echo(click.style(f"✓ {text}", fg='green'))

    @staticmethod
    def print_warning(text: str):
        click.echo(click.style(f"⚠ {text}", fg='yellow'))

    @staticmethod
    def print_error(text: str):
        click.echo(click.style(f"✗ {text}", fg='red'))

    @staticmethod
    def print_info(text: str):
        click.echo(click.style(f"  {text}", fg='white'))


@click.group()
@click.version_option(version='1.0.0', prog_name='backup-cli')
def cli():
    """备机借用押金归还检查排查工具 - 手机维修店管理系统"""
    pass


@cli.command()
@click.argument('csv_file', type=click.Path(exists=True, readable=True))
@click.option('--output-dir', '-o', default='./output', help='报告输出目录')
@click.option('--date-format', default='%Y-%m-%d', help='日期格式')
@click.option('--today', help='指定计算日期 (YYYY-MM-DD)')
@click.option('--overdue-days', default=0, type=int, help='逾期天数阈值')
def check(csv_file: str, output_dir: str, date_format: str, today: Optional[str], overdue_days: int):
    """检查CSV文件并生成完整报告"""
    printer = ColorPrinter()
    
    printer.print_header("备机借用押金归还检查排查")
    printer.print_info(f"输入文件: {csv_file}")
    printer.print_info(f"输出目录: {output_dir}")
    
    try:
        today_date = None
        if today:
            today_date = datetime.strptime(today, date_format).date()
            printer.print_info(f"指定计算日期: {today_date}")
        
        parser = BackupCSVParser(date_format=date_format)
        parse_result = parser.parse_file(csv_file)
        
        printer.print_success(f"解析完成: {len(parse_result.valid_records)} 有效, {len(parse_result.invalid_records)} 无效")
        
        rule_engine = BusinessRuleEngine(today=today_date, overdue_days_threshold=overdue_days)
        processed_records = rule_engine.process_records(parse_result.valid_records)
        
        tracker = SourceTracker()
        tracker.track_parse_result(parse_result)
        validation_summary = tracker.get_validation_summary(processed_records)
        
        report_gen = ReportGenerator(output_dir=output_dir)
        generated_files = report_gen.generate_all_reports(
            parse_result, processed_records, tracker, validation_summary
        )
        
        printer.print_header("检查结果")
        
        returned = sum(1 for r in processed_records if r.is_returned)
        overdue = sum(1 for r in processed_records if r.is_overdue)
        has_damage = sum(1 for r in processed_records if r.has_damage)
        
        printer.print_info(f"总记录: {validation_summary.total_records}")
        printer.print_success(f"已归还: {returned}")
        printer.print_warning(f"未归还: {len(processed_records) - returned}")
        printer.print_error(f"逾期: {overdue}")
        printer.print_error(f"有损坏: {has_damage}")
        
        if validation_summary.duplicate_ids:
            printer.print_warning(f"发现 {len(validation_summary.duplicate_ids)} 个重复/冲突:")
            for dup_type, lines in validation_summary.duplicate_ids:
                printer.print_warning(f"  {dup_type} - 行号: {lines}")
        
        printer.print_header("生成的报告")
        for report_type, filepath in generated_files.items():
            printer.print_success(f"{report_type}: {filepath}")
        
        printer.print_header("完成")
        printer.print_success("检查完成!")
        
    except Exception as e:
        printer.print_error(f"处理失败: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


@cli.command()
@click.argument('csv_file', type=click.Path(exists=True, readable=True))
def validate(csv_file: str):
    """仅验证CSV文件格式"""
    printer = ColorPrinter()
    
    printer.print_header("CSV格式验证")
    
    parser = BackupCSVParser()
    parse_result = parser.parse_file(csv_file)
    
    printer.print_success(f"总记录: {parse_result.total_lines - 1}")
    printer.print_success(f"有效记录: {len(parse_result.valid_records)}")
    printer.print_error(f"无效记录: {len(parse_result.invalid_records)}")
    
    if parse_result.invalid_records:
        printer.print_header("无效记录详情:")
        for record in parse_result.invalid_records:
            printer.print_error(f"行 {record.source.line_number}:")
            for error in record.errors:
                printer.print_error(f"  - {error}")
            printer.print_info(f"  原始内容: {record.source.raw_content}")


@cli.command()
def sample():
    """生成示例CSV数据文件"""
    import csv
    import os
    
    sample_file = './sample_backup_data.csv'
    
    sample_data = [
        ['customer_name', 'repair_order_id', 'backup_device_id', 'deposit_amount', 
         'borrow_date', 'expected_return_date', 'actual_return_date', 
         'damage_check_result', 'damage_description', 'damage_charge_amount', 'notes'],
        ['张三', 'WX2024001', 'BJ001', '500', '2024-05-01', '2024-05-10', '2024-05-09', '正常', '', '0', '正常归还'],
        ['李四', 'WX2024002', 'BJ002', '800', '2024-05-05', '2024-05-12', '', '', '', '未归还'],
        ['王五', 'WX2024003', 'BJ003', '600', '2024-05-08', '2024-05-15', '2024-05-20', '有损坏', '屏幕划痕', '100', '逾期10天'],
        ['赵六', 'WX2024004', 'BJ001', '500', '2024-05-10', '2024-05-17', '', '', '', '重复借用'],
        ['钱七', 'WX2024005', 'BJ005', '', '2024-05-12', '2024-05-19', '2024-05-18', '', '', '', '无效行测试'],
    ]
    
    with open(sample_file, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(sample_data)
    
    click.echo(click.style(f"✓ 示例数据已生成: {sample_file}", fg='green'))
    click.echo(click.style("  使用以下命令运行检查:", fg='cyan'))
    click.echo(click.style(f"  python -m backup_cli.cli check {sample_file}", fg='white'))


if __name__ == '__main__':
    cli()
