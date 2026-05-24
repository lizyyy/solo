import os
import sys
import glob
from typing import List, Optional

import click

from .analyzer import LockRiskAnalyzer
from .reporter import Reporter
from .selftest import SelfTest
from . import __version__


def validate_inputs(
    sql_files: List[str],
    table_stats: Optional[str],
    index_info: Optional[str],
    exceptions: Optional[str],
    migration_order: Optional[List[str]]
) -> bool:
    if not sql_files:
        click.echo("错误: 未指定任何 SQL 文件", err=True)
        return False
    
    for f in sql_files:
        if not os.path.exists(f):
            click.echo(f"错误: SQL 文件不存在: {f}", err=True)
            return False
        if not os.path.isfile(f):
            click.echo(f"错误: 不是文件: {f}", err=True)
            return False
    
    if table_stats and not os.path.exists(table_stats):
        click.echo(f"错误: 表规模文件不存在: {table_stats}", err=True)
        return False
    
    if index_info and not os.path.exists(index_info):
        click.echo(f"错误: 索引信息文件不存在: {index_info}", err=True)
        return False
    
    if exceptions and not os.path.exists(exceptions):
        click.echo(f"错误: 例外说明文件不存在: {exceptions}", err=True)
        return False
    
    return True


def expand_globs(patterns: List[str]) -> List[str]:
    files = []
    for pattern in patterns:
        matched = glob.glob(pattern)
        if matched:
            files.extend(matched)
        elif os.path.exists(pattern):
            files.append(pattern)
    return sorted(set(files))


@click.group(invoke_without_command=True)
@click.version_option(__version__, '--version', '-v')
@click.pass_context
def main(ctx):
    """SQL 迁移锁风险分析 CLI 工具"""
    if ctx.invoked_subcommand is None:
        click.echo(ctx.get_help())


@main.command()
@click.argument('sql_files', nargs=-1)
@click.option('--table-stats', '-t', type=click.Path(exists=False), help='表规模信息文件 (YAML/CSV)')
@click.option('--index-info', '-i', type=click.Path(exists=False), help='索引信息文件 (YAML)')
@click.option('--exceptions', '-e', type=click.Path(exists=False), help='例外说明文件')
@click.option('--migration-order', '-o', multiple=True, help='迁移顺序 (可多次指定)')
@click.option('--output-dir', '-d', default='./reports', help='输出目录 (默认: ./reports)')
@click.option('--report-name', '-n', default='lock_risk_report', help='报告文件名前缀')
@click.option('--verbose', '-v', is_flag=True, help='详细输出')
@click.option('--no-terminal', is_flag=True, help='不输出终端摘要')
@click.option('--exit-zero', is_flag=True, help='总是以退出码 0 退出')
def analyze(
    sql_files,
    table_stats,
    index_info,
    exceptions,
    migration_order,
    output_dir,
    report_name,
    verbose,
    no_terminal,
    exit_zero
):
    """分析 SQL 迁移文件的锁风险"""
    
    expanded_files = expand_globs(list(sql_files))
    
    if not validate_inputs(expanded_files, table_stats, index_info, exceptions, migration_order):
        sys.exit(4)
    
    click.echo(f"正在分析 {len(expanded_files)} 个迁移文件...")
    
    try:
        analyzer = LockRiskAnalyzer()
        
        if table_stats:
            analyzer.load_table_stats(table_stats)
            click.echo(f"已加载表规模信息: {table_stats}")
        
        if index_info:
            analyzer.load_index_info(index_info)
            click.echo(f"已加载索引信息: {index_info}")
        
        if exceptions:
            analyzer.load_exceptions(exceptions)
            click.echo(f"已加载例外说明: {exceptions}")
        
        order_list = list(migration_order) if migration_order else None
        
        result = analyzer.analyze_files(expanded_files, order_list)
        
        reporter = Reporter(output_dir=output_dir, verbose=verbose)
        
        if not no_terminal:
            reporter.print_terminal_summary(result)
        
        os.makedirs(output_dir, exist_ok=True)
        
        json_path = os.path.join(output_dir, f"{report_name}.json")
        reporter.generate_json(result, json_path)
        click.echo(f"JSON 报告已生成: {json_path}")
        
        md_path = os.path.join(output_dir, f"{report_name}.md")
        reporter.generate_markdown(result, md_path)
        click.echo(f"Markdown 报告已生成: {md_path}")
        
        if exit_zero:
            sys.exit(0)
        else:
            sys.exit(result.exit_code)
        
    except Exception as e:
        click.echo(f"分析失败: {str(e)}", err=True)
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(5)


@main.command('self-test')
@click.option('--output-dir', '-d', default='./selftest_output', help='自检输出目录')
@click.option('--verbose', '-v', is_flag=True, help='详细输出')
def self_test(output_dir, verbose):
    """运行自检,验证解析、边界场景和报告生成"""
    
    click.echo("=" * 60)
    click.echo("SQL 迁移锁风险分析工具 - 自检")
    click.echo("=" * 60)
    click.echo()
    
    selftest = SelfTest(output_dir=output_dir, verbose=verbose)
    passed, failed = selftest.run_all()
    
    click.echo()
    click.echo("=" * 60)
    click.echo(f"自检完成: {passed} 通过, {failed} 失败")
    click.echo("=" * 60)
    
    if failed > 0:
        sys.exit(1)
    else:
        sys.exit(0)


@main.command()
def list_examples():
    """列出使用示例"""
    examples = """
使用示例:

1. 分析单个 SQL 文件:
   sql-lock-risk analyze migrations/001_add_column.sql

2. 分析多个 SQL 文件并指定表规模:
   sql-lock-risk analyze migrations/*.sql -t stats/table_stats.yaml

3. 指定迁移顺序:
   sql-lock-risk analyze migrations/*.sql -o 001.sql -o 002.sql -o 003.sql

4. 完整分析,带所有输入:
   sql-lock-risk analyze \\
     migrations/*.sql \\
     -t stats/table_stats.yaml \\
     -i stats/index_info.yaml \\
     -e exceptions.txt \\
     -d ./reports \\
     -v

5. 运行自检:
   sql-lock-risk self-test

退出码说明:
  0 - 无风险或低风险
  1 - 中风险或缺少回滚脚本
  2 - 高风险
  3 - 严重风险
  4 - 输入验证失败
  5 - 执行异常
    """
    click.echo(examples)


if __name__ == '__main__':
    main()
