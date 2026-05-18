import click
import os
import sys
from datetime import datetime
from .inspector import WhitelistInspector
from .report_generator import ReportGenerator


@click.group()
@click.version_option(version="0.1.0")
def cli():
    """网关配置快照白名单过期巡检 CLI"""
    pass


@cli.command()
@click.option("--input-path", "-i", required=True, type=click.Path(exists=True), help="输入目录路径，包含网关配置快照导出文件")
@click.option("--rules-file", "-r", required=True, type=click.Path(exists=True), help="巡检规则配置文件(YAML)")
@click.option("--output-dir", "-o", required=True, type=click.Path(), help="报告输出目录")
@click.option("--dry-run", "-n", is_flag=True, help="试运行模式，仅输出分析结果不生成报告文件")
@click.option("--force", "-f", is_flag=True, help="强制覆盖已存在的输出文件")
@click.option("--inspection-date", "-d", default=None, help="巡检基准日期(YYYY-MM-DD)，默认为今天")
def inspect(input_path, rules_file, output_dir, dry_run, force, inspection_date):
    """执行网关配置快照白名单过期巡检"""
    
    click.echo("=" * 60)
    click.echo("  网关配置快照白名单过期巡检 CLI")
    click.echo("=" * 60)
    
    if inspection_date:
        try:
            inspection_date = datetime.strptime(inspection_date, "%Y-%m-%d").date()
        except ValueError:
            click.echo(f"错误: 日期格式不正确，请使用 YYYY-MM-DD 格式", err=True)
            sys.exit(1)
    else:
        inspection_date = datetime.now().date()
    
    click.echo(f"巡检日期: {inspection_date}")
    click.echo(f"输入路径: {input_path}")
    click.echo(f"规则文件: {rules_file}")
    click.echo(f"输出目录: {output_dir}")
    click.echo(f"试运行模式: {'是' if dry_run else '否'}")
    click.echo(f"强制覆盖: {'是' if force else '否'}")
    click.echo("-" * 60)
    
    if not dry_run:
        if os.path.exists(output_dir) and not force:
            click.echo(f"错误: 输出目录 {output_dir} 已存在，使用 --force 参数覆盖", err=True)
            sys.exit(1)
        os.makedirs(output_dir, exist_ok=True)
    
    try:
        inspector = WhitelistInspector(input_path, rules_file, inspection_date)
        click.echo("正在加载配置文件...")
        inspector.load_configs()
        
        click.echo("正在分析白名单过期情况...")
        result = inspector.analyze()
        
        click.echo("-" * 60)
        click.echo("分析结果摘要:")
        click.echo(f"  总配置文件数: {result['total_files']}")
        click.echo(f"  总白名单规则数: {result['total_whitelists']}")
        click.echo(f"  过期仍生效的白名单: {result['expired_active_count']}")
        click.echo(f"  缓存配置相关: {result['cache_config_count']}")
        click.echo(f"  租户改名相关: {result['tenant_rename_count']}")
        click.echo(f"  接口组合相关: {result['api_combination_count']}")
        click.echo("-" * 60)
        
        type_map = {
            'cache_config': '缓存配置',
            'tenant_rename': '租户改名',
            'api_combination': '接口组合',
            'normal': '普通'
        }
        
        if not dry_run:
            click.echo("正在生成报告...")
            generator = ReportGenerator(output_dir)
            report_files = generator.generate(result, inspection_date)
            
            click.echo("报告生成完成:")
            for report_type, file_path in report_files.items():
                click.echo(f"  - {report_type}: {file_path}")
        else:
            click.echo("试运行模式: 不生成报告文件")
            click.echo("\n详细分析结果:")
            for item in result['expired_whitelists'][:10]:
                type_cn = type_map.get(item['type'], '未知')
                click.echo(f"  - [{type_cn}] {item['tenant']}: {item['api']} (过期: {item['expire_date']})")
        
        click.echo("=" * 60)
        click.echo("巡检完成!")
        
    except Exception as e:
        click.echo(f"错误: {str(e)}", err=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)


def main():
    cli()


if __name__ == "__main__":
    main()
