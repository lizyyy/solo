#!/usr/bin/env python3
import click
import os
from datetime import datetime
from typing import Optional

from .core.parser import DataParser
from .core.rules import RuleEngine
from .core.tracker import SourceTracker
from .core.reporter import ReportGenerator
from .core.models import SubleaseRecord


@click.group()
def cli():
    """车位转租门禁授权费用分摊排查工具"""
    pass


@cli.command()
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--output-dir', '-o', type=click.Path(), default=None, help='报告输出目录')
@click.option('--property-fee-rate', '-p', type=float, default=0.1, help='物业费率 (默认: 0.1 = 10%)')
@click.option('--check-date', '-d', type=str, default=None, help='检查日期 (格式: YYYY-MM-DD, 默认: 今天)')
@click.option('--no-cache', is_flag=True, help='不使用缓存，强制重新处理')
def check(file_path: str, output_dir: Optional[str], property_fee_rate: float, 
          check_date: Optional[str], no_cache: bool):
    """检查车位转租数据并生成报告"""
    try:
        check_date_obj = None
        if check_date:
            check_date_obj = datetime.strptime(check_date, "%Y-%m-%d")
        
        parser = DataParser()
        records, bad_records = parser.parse_file(file_path)
        
        tracker = SourceTracker()
        file_info = tracker.track_file(file_path)
        
        if not no_cache:
            compare_result = tracker.compare_with_previous(records, bad_records, file_path)
            if not compare_result.get("is_first_run"):
                click.echo(f"  新增记录: {compare_result.get('added', 0)}")
                click.echo(f"  删除记录: {compare_result.get('removed', 0)}")
                click.echo(f"  修改记录: {compare_result.get('modified', 0)}")
                click.echo(f"  未变记录: {compare_result.get('unchanged', 0)}")
        
        rule_engine = RuleEngine()
        result = rule_engine.process_all_records(records, property_fee_rate, check_date_obj)
        
        reporter = ReportGenerator(output_dir)
        
        reporter.generate_summary_report(
            result["summary"],
            result["records"],
            bad_records,
            result["validation_results"],
            result["fee_summary"],
            result["access_summary"]
        )
        
        reporter.generate_csv_report(
            result["records"],
            result["fee_summary"],
            result["access_summary"]
        )
        
        if bad_records:
            reporter.generate_bad_records_report(bad_records)
        
        reporter.generate_validation_report(result["validation_results"])
        
        reporter.generate_owner_summary(
            result["records"],
            result["fee_summary"]
        )
        
        reporter.print_console_summary(result["summary"], len(bad_records))
        
    except Exception as e:
        click.echo(f"错误: {str(e)}", err=True)
        raise


@cli.command()
@click.argument('file_path', type=click.Path(exists=True))
@click.argument('record_id', type=str)
@click.argument('terminate_date', type=str)
@click.option('--output-dir', '-o', type=click.Path(), default=None, help='报告输出目录')
def terminate(file_path: str, record_id: str, terminate_date: str, output_dir: Optional[str]):
    """提前终止转租记录"""
    try:
        terminate_date_obj = datetime.strptime(terminate_date, "%Y-%m-%d")
        
        parser = DataParser()
        records, bad_records = parser.parse_file(file_path)
        
        target_record = None
        for record in records:
            if record.record_id == record_id:
                target_record = record
                break
        
        if not target_record:
            click.echo(f"错误: 未找到记录ID {record_id}", err=True)
            return
        
        rule_engine = RuleEngine()
        termination_result = rule_engine.process_early_termination(target_record, terminate_date_obj)
        
        click.echo("\n" + "=" * 50)
        click.echo("提前终止处理结果")
        click.echo("=" * 50)
        click.echo(f"  记录ID: {termination_result['record_id']}")
        click.echo(f"  原结束日期: {termination_result['original_end_date']}")
        click.echo(f"  实际终止日期: {termination_result['actual_terminate_date']}")
        click.echo(f"  原租期天数: {termination_result['original_days']} 天")
        click.echo(f"  实际租期天数: {termination_result['actual_days']} 天")
        click.echo(f"  退款天数: {termination_result['refund_days']} 天")
        click.echo(f"  退款金额: {termination_result['refund_amount']:.2f} 元")
        click.echo(f"  状态: {termination_result['status']}")
        click.echo("=" * 50 + "\n")
        
        rule_engine.process_all_records(records)
        
        reporter = ReportGenerator(output_dir)
        reporter.generate_csv_report(records, rule_engine.fee_summary, rule_engine.access_summary)
        
        click.echo(f"更新后的报告已导出到: {reporter.output_dir}")
        
    except ValueError as e:
        click.echo(f"日期格式错误: {str(e)}", err=True)
    except Exception as e:
        click.echo(f"错误: {str(e)}", err=True)
        raise


@cli.command()
@click.argument('file_path', type=click.Path(exists=True))
def validate(file_path: str):
    """仅验证数据格式，不生成完整报告"""
    try:
        parser = DataParser()
        records, bad_records = parser.parse_file(file_path)
        
        click.echo(f"\n  有效记录: {len(records)} 条")
        click.echo(f"  坏记录: {len(bad_records)} 条")
        
        if bad_records:
            click.echo("\n  坏记录详情:")
            for bad in bad_records:
                click.echo(f"    行 {bad.row_number}: {bad.error_message}")
                click.echo(f"      原始数据: {bad.original_data}")
        
        click.echo("")
        
    except Exception as e:
        click.echo(f"错误: {str(e)}", err=True)
        raise


@cli.command()
def sample():
    """生成示例数据文件"""
    sample_data = """record_id,space_id,owner_id,owner_name,tenant_id,tenant_name,tenant_phone,start_date,end_date,monthly_fee,actual_terminate_date,access_grant_date,access_revoke_date
R001,A001,O001,张三,T001,李四,13800138001,2025-01-01,2025-03-31,500.00,,,
R002,A002,O002,王五,T002,赵六,13800138002,2025-02-15,2025-04-15,600.00,2025-03-31,2025-02-15,
R003,A003,O003,钱七,T003,孙八,13800138003,2025-01-10,2025-02-10,550.00,,,
R004,A001,O001,张三,T004,周九,13800138004,2025-04-01,2025-06-30,500.00,,,
R005,A005,O005,吴十,T005,郑十一,13800138005,2025-03-01,2025-03-15,450.00,,,
"""
    
    sample_file = os.path.join(os.getcwd(), "sample_sublease.csv")
    with open(sample_file, 'w', encoding='utf-8-sig') as f:
        f.write(sample_data)
    
    click.echo(f"示例数据已生成: {sample_file}")
    click.echo("使用以下命令检查示例数据:")
    click.echo(f"  python -m parking_sublease_cli.cli check {sample_file}")


if __name__ == '__main__':
    cli()
