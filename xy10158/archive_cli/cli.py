import click
import json
import os
from typing import Optional
from colorama import init, Fore, Style

from .config import AppConfig
from .executor import ArchiveExecutor
from .report import ReportGenerator
from .rollback import RollbackManager

init(autoreset=True)


@click.group()
@click.version_option(version='0.1.0', prog_name='archive-cli')
def main():
    """数据表分区归档预演 CLI - 帮助你在归档前了解影响范围"""
    pass


@main.group()
def dryrun():
    """执行归档预演相关操作"""
    pass


@dryrun.command('run')
@click.option('--config', '-c', required=True, type=click.Path(exists=True),
              help='配置文件路径 (YAML格式)')
@click.option('--verbose', '-v', is_flag=True, help='显示详细输出')
@click.option('--save-report/--no-save-report', default=True,
              help='是否保存报告到文件')
def dryrun_run(config: str, verbose: bool, save_report: bool):
    """执行 dry-run 预演：分析分区影响，生成报告"""
    
    import sys
    exec_command = ' '.join(sys.argv)
    abs_config_path = os.path.abspath(config)
    
    click.echo(f"{Fore.CYAN}正在加载配置文件: {config}{Style.RESET_ALL}")
    click.echo(f"  绝对路径: {abs_config_path}")
    
    try:
        app_config = AppConfig.from_yaml(config)
    except Exception as e:
        click.echo(f"{Fore.RED}配置文件加载失败: {e}{Style.RESET_ALL}")
        raise click.Abort()
    
    click.echo(f"{Fore.GREEN}配置加载成功{Style.RESET_ALL}")
    click.echo(f"源表: {app_config.archive.source_table}")
    click.echo(f"目标表: {app_config.archive.target_table}")
    click.echo(f"分区策略: {app_config.archive.partition.type}")
    
    executor = ArchiveExecutor(app_config)
    
    click.echo(f"\n{Fore.CYAN}开始执行 dry-run 预演...{Style.RESET_ALL}")
    result = executor.run_dry_run()
    
    report_generator = ReportGenerator(app_config.report.output_dir)
    
    config_dict = {
        'database': {
            'connection_string': app_config.database.connection_string[:50] + '...' if len(app_config.database.connection_string) > 50 else app_config.database.connection_string,
            'schema': app_config.database.schema
        },
        'archive': {
            'source_table': app_config.archive.source_table,
            'target_table': app_config.archive.target_table,
            'primary_key': app_config.archive.primary_key,
            'partition_type': app_config.archive.partition.type,
            'partition_column': app_config.archive.partition.column,
            'batch_size': app_config.archive.batch_size,
            'archive_condition': app_config.archive.archive_condition,
            'validate_columns': app_config.archive.validate_columns
        },
        'report': {
            'output_dir': app_config.report.output_dir,
            'include_sample_data': app_config.report.include_sample_data,
            'sample_limit': app_config.report.sample_limit
        }
    }
    
    report = report_generator.generate_dry_run_report(
        result, 
        config_dict,
        config_file_path=abs_config_path,
        execution_command=exec_command
    )
    
    report_generator.print_console_report(report)
    
    if save_report:
        click.echo(f"\n{Fore.CYAN}正在保存报告...{Style.RESET_ALL}")
        
        json_path = report_generator.save_report_json(report)
        click.echo(f"{Fore.GREEN}✓ JSON报告已保存: {json_path}{Style.RESET_ALL}")
        
        sql_path = report_generator.save_sql_snippets(report)
        click.echo(f"{Fore.GREEN}✓ SQL片段已保存: {sql_path}{Style.RESET_ALL}")
        
        rollback_path = report_generator.save_rollback_plan(report)
        click.echo(f"{Fore.GREEN}✓ 回滚计划已保存: {rollback_path}{Style.RESET_ALL}")
    
    if result.success:
        click.echo(f"\n{Fore.GREEN}Dry-run 预演完成，无错误。{Style.RESET_ALL}")
    else:
        click.echo(f"\n{Fore.RED}Dry-run 预演发现错误，请查看报告。{Style.RESET_ALL}")
        raise click.Abort()


@main.group()
def archive():
    """执行实际归档操作"""
    pass


@archive.command('execute')
@click.option('--config', '-c', required=True, type=click.Path(exists=True),
              help='配置文件路径 (YAML格式)')
@click.option('--confirm', '-y', is_flag=True, help='跳过确认提示')
@click.option('--dry-run', is_flag=True, help='仅执行预演，不实际操作')
def archive_execute(config: str, confirm: bool, dry_run: bool):
    """执行实际归档操作（生产环境请谨慎使用）"""
    
    app_config = AppConfig.from_yaml(config)
    
    if not confirm:
        click.echo(f"{Fore.YELLOW}警告: 这将执行实际的归档操作！{Style.RESET_ALL}")
        click.echo(f"源表: {app_config.archive.source_table}")
        click.echo(f"目标表: {app_config.archive.target_table}")
        if not click.confirm('是否继续？'):
            click.echo("操作已取消。")
            return
    
    if dry_run:
        click.echo(f"{Fore.CYAN}执行归档预演模式...{Style.RESET_ALL}")
        executor = ArchiveExecutor(app_config)
        result = executor.run_dry_run()
        
        report_generator = ReportGenerator(app_config.report.output_dir)
        config_dict = {
            'database': {'schema': app_config.database.schema},
            'archive': {
                'source_table': app_config.archive.source_table,
                'target_table': app_config.archive.target_table,
                'partition_type': app_config.archive.partition.type
            }
        }
        report = report_generator.generate_dry_run_report(result, config_dict)
        report_generator.print_console_report(report)
        
        json_path = report_generator.save_report_json(report)
        click.echo(f"{Fore.GREEN}预演报告已保存: {json_path}{Style.RESET_ALL}")
        return
    
    click.echo(f"{Fore.CYAN}开始执行归档操作...{Style.RESET_ALL}")
    
    executor = ArchiveExecutor(app_config)
    success, records, errors, stats = executor.execute_archive()
    
    rollback_manager = RollbackManager(app_config)
    
    if records:
        rollback_file = rollback_manager.save_archive_record(records)
        click.echo(f"{Fore.GREEN}✓ 回滚记录已保存: {rollback_file}{Style.RESET_ALL}")
    
    click.echo(f"\n{Fore.CYAN}幂等性检查统计:{Style.RESET_ALL}")
    click.echo(f"  检查的总记录数: {stats['total_checked']:,}")
    click.echo(f"  已存在的记录数(跳过): {Fore.YELLOW}{stats['already_exists']:,}{Style.RESET_ALL}")
    click.echo(f"  新归档的记录数: {Fore.GREEN}{stats['newly_archived']:,}{Style.RESET_ALL}")
    
    if success:
        total_rows = sum(r.count for r in records)
        click.echo(f"\n{Fore.GREEN}归档成功完成！{Style.RESET_ALL}")
        click.echo(f"已归档分区数: {len(records)}")
        click.echo(f"已归档记录数: {total_rows}")
        if stats['already_exists'] > 0:
            click.echo(f"{Fore.YELLOW}注意: {stats['already_exists']} 条记录已存在于目标表，已跳过(保证幂等性){Style.RESET_ALL}")
    else:
        click.echo(f"\n{Fore.RED}归档过程中出现错误:{Style.RESET_ALL}")
        for error in errors:
            click.echo(f"  - {error}")
        if records:
            click.echo(f"\n{Fore.YELLOW}部分分区已成功归档，可使用回滚功能恢复。{Style.RESET_ALL}")


@main.group()
def rollback():
    """回滚管理命令"""
    pass


@rollback.command('list')
@click.option('--config', '-c', required=True, type=click.Path(exists=True),
              help='配置文件路径 (YAML格式)')
def rollback_list(config: str):
    """列出可用的回滚记录"""
    
    app_config = AppConfig.from_yaml(config)
    rollback_manager = RollbackManager(app_config)
    
    rollbacks = rollback_manager.list_available_rollbacks()
    
    if not rollbacks:
        click.echo(f"{Fore.YELLOW}未找到任何回滚记录。{Style.RESET_ALL}")
        return
    
    click.echo(f"{Fore.CYAN}可用的回滚记录:{Style.RESET_ALL}")
    click.echo("-" * 80)
    
    for rb in rollbacks:
        click.echo(f"\n时间戳: {rb['timestamp']}")
        click.echo(f"  源表: {rb['source_table']}")
        click.echo(f"  目标表: {rb['target_table']}")
        click.echo(f"  分区数: {rb['total_records']}")
        click.echo(f"  总行数: {rb['total_rows']:,}")
        click.echo(f"  记录文件: {rb['file_path']}")


@rollback.command('validate')
@click.option('--config', '-c', required=True, type=click.Path(exists=True),
              help='配置文件路径 (YAML格式)')
@click.option('--timestamp', '-t', required=True, help='归档时间戳')
def rollback_validate(config: str, timestamp: str):
    """验证回滚记录的有效性"""
    
    app_config = AppConfig.from_yaml(config)
    rollback_manager = RollbackManager(app_config)
    
    click.echo(f"{Fore.CYAN}验证回滚记录: {timestamp}{Style.RESET_ALL}")
    
    validation = rollback_manager.validate_rollback(timestamp)
    
    if validation['valid']:
        click.echo(f"{Fore.GREEN}回滚记录有效{Style.RESET_ALL}")
    else:
        click.echo(f"{Fore.RED}回滚记录无效{Style.RESET_ALL}")
    
    click.echo(f"\n{Fore.CYAN}检查结果:{Style.RESET_ALL}")
    for check in validation.get('checks', []):
        status_color = Fore.GREEN if check['status'] == 'passed' else Fore.RED
        click.echo(f"  [{status_color}{check['status'].upper()}{Style.RESET_ALL}] {check['message']}")
    
    if 'summary' in validation:
        click.echo(f"\n{Fore.CYAN}摘要:{Style.RESET_ALL}")
        for key, value in validation['summary'].items():
            click.echo(f"  {key}: {value}")


@rollback.command('execute')
@click.option('--config', '-c', required=True, type=click.Path(exists=True),
              help='配置文件路径 (YAML格式)')
@click.option('--timestamp', '-t', required=True, help='归档时间戳')
@click.option('--dry-run', is_flag=True, default=True, help='预演模式（默认）')
@click.option('--force', '-f', is_flag=True, help='实际执行回滚（谨慎使用）')
@click.option('--confirm', '-y', is_flag=True, help='跳过确认提示')
def rollback_execute(config: str, timestamp: str, dry_run: bool, force: bool, confirm: bool):
    """执行回滚操作"""
    
    app_config = AppConfig.from_yaml(config)
    rollback_manager = RollbackManager(app_config)
    
    if force:
        dry_run = False
    
    if not dry_run and not confirm:
        click.echo(f"{Fore.YELLOW}警告: 这将执行实际的回滚操作！{Style.RESET_ALL}")
        if not click.confirm('是否继续？'):
            click.echo("操作已取消。")
            return
    
    mode = "预演模式" if dry_run else "实际模式"
    click.echo(f"{Fore.CYAN}执行回滚操作 [{mode}]{Style.RESET_ALL}")
    click.echo(f"时间戳: {timestamp}")
    
    result = rollback_manager.execute_rollback(timestamp, dry_run=dry_run)
    
    if result.success:
        click.echo(f"\n{Fore.GREEN}回滚{'预演' if dry_run else ''}成功！{Style.RESET_ALL}")
        click.echo(f"恢复的分区: {len(result.restored_partitions)}")
        click.echo(f"恢复的记录数: {result.total_restored_rows:,}")
    else:
        click.echo(f"\n{Fore.RED}回滚过程中出现错误:{Style.RESET_ALL}")
        for error in result.errors:
            click.echo(f"  - {error}")
    
    if result.warnings:
        click.echo(f"\n{Fore.YELLOW}警告信息:{Style.RESET_ALL}")
        for warning in result.warnings:
            click.echo(f"  - {warning}")
    
    if dry_run:
        click.echo(f"\n{Fore.CYAN}提示: 使用 --force 参数执行实际回滚操作。{Style.RESET_ALL}")


@main.command('validate-config')
@click.option('--config', '-c', required=True, type=click.Path(exists=True),
              help='配置文件路径 (YAML格式)')
def validate_config(config: str):
    """验证配置文件的有效性"""
    
    click.echo(f"{Fore.CYAN}正在验证配置文件: {config}{Style.RESET_ALL}")
    
    try:
        app_config = AppConfig.from_yaml(config)
    except Exception as e:
        click.echo(f"{Fore.RED}配置文件语法错误: {e}{Style.RESET_ALL}")
        raise click.Abort()
    
    click.echo(f"{Fore.GREEN}配置文件语法正确{Style.RESET_ALL}")
    
    executor = ArchiveExecutor(app_config)
    executor.initialize()
    
    strategy_validation = executor.validate_strategy()
    
    if strategy_validation.valid:
        click.echo(f"{Fore.GREEN}分区策略验证通过{Style.RESET_ALL}")
    else:
        click.echo(f"{Fore.RED}分区策略验证失败:{Style.RESET_ALL}")
        for error in strategy_validation.errors:
            click.echo(f"  - {error}")
        raise click.Abort()
    
    structure_issues = executor.validate_table_structure()
    
    if structure_issues:
        click.echo(f"\n{Fore.YELLOW}表结构检查发现问题:{Style.RESET_ALL}")
        for issue in structure_issues:
            severity_color = Fore.RED if issue.severity == 'error' else Fore.YELLOW
            click.echo(f"  [{severity_color}{issue.severity.upper()}{Style.RESET_ALL}] {issue.message}")
    
    click.echo(f"\n{Fore.GREEN}配置验证完成{Style.RESET_ALL}")


if __name__ == '__main__':
    main()
