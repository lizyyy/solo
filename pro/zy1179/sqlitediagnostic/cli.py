import click
import os
from sqlitediagnostic.importer import Importer
from sqlitediagnostic.analyzer import Analyzer
from sqlitediagnostic.simulator import Simulator
from sqlitediagnostic.reporter import Reporter


@click.group()
@click.version_option()
def cli():
    """SQLite Diagnostic CLI - 诊断 SQLite 数据库锁问题、WAL 增长、迁移风险等"""
    pass


@cli.command()
@click.option("--output-dir", "-o", default="./samples", help="输出目录")
@click.option("--type", "-t", type=click.Choice(["normal", "bad", "both"]), default="both", help="生成样例类型")
def init(output_dir, type):
    """初始化样例数据（正常样例、坏样例）"""
    click.echo(f"初始化样例数据到 {output_dir}...")
    
    from sqlitediagnostic.samples import SampleGenerator
    generator = SampleGenerator(output_dir)
    
    if type in ["normal", "both"]:
        click.echo("生成正常样例...")
        generator.generate_normal_sample()
        click.echo("✓ 正常样例已生成")
    
    if type in ["bad", "both"]:
        click.echo("生成坏样例...")
        generator.generate_bad_samples()
        click.echo("✓ 坏样例已生成")
    
    click.echo(f"\n样例数据已生成在: {output_dir}")
    click.echo("使用 sqlite-diagnostic analyze 命令进行分析")


@cli.command()
@click.option("--db", "-d", required=True, help="SQLite 数据库文件路径 (app.db)")
@click.option("--trace-log", "-t", help="SQLite trace 日志文件路径")
@click.option("--migrations", "-m", help="迁移文件目录路径")
@click.option("--pragma", "-p", help="PRAGMA 配置文件路径")
@click.option("--workload", "-w", help="工作负载日志文件路径")
@click.option("--output", "-o", help="输出文件路径（不指定则打印到控制台）")
@click.option("--format", "-f", type=click.Choice(["markdown", "json", "csv"]), default="markdown", help="输出格式")
def analyze(db, trace_log, migrations, pragma, workload, output, format):
    """分析 SQLite 数据库问题
    
    分析内容包括：
    - 长读事务
    - 写锁互斥
    - Checkpoint 卡住
    - busy_timeout 不合理
    - 外键没开
    - 迁移表重建风险
    """
    click.echo("开始分析...")
    
    importer = Importer()
    
    if db:
        importer.import_database(db)
    
    if trace_log:
        importer.import_trace_log(trace_log)
    
    if migrations:
        importer.import_migrations(migrations)
    
    if pragma:
        importer.import_pragma_config(pragma)
    
    if workload:
        importer.import_workload_log(workload)
    
    data = importer.get_data()
    
    analyzer = Analyzer(data)
    analysis_results = analyzer.run_all_analyses()
    
    reporter = Reporter(analysis_results)
    
    if output:
        reporter.export(output, format)
        click.echo(f"✓ 分析报告已导出到: {output}")
    else:
        if format == "markdown":
            click.echo(reporter.generate_markdown())
        elif format == "json":
            click.echo(reporter.generate_json())
        elif format == "csv":
            click.echo(reporter.generate_csv())


@cli.command()
@click.option("--workload", "-w", required=True, help="工作负载日志文件路径")
@click.option("--db", "-d", help="基准数据库文件路径（可选）")
@click.option("--batch-size", "-b", multiple=True, type=int, default=[10, 50, 100, 500], help="测试的批处理大小（可多个）")
@click.option("--journal-mode", "-j", multiple=True, type=click.Choice(["wal", "delete", "truncate", "persist", "memory", "off"]), default=["wal", "delete"], help="测试的日志模式")
@click.option("--checkpoint-mode", "-c", multiple=True, type=click.Choice(["passive", "full", "restart", "truncate"]), default=["passive", "full"], help="测试的 Checkpoint 模式")
@click.option("--busy-timeout", "-t", multiple=True, type=int, default=[5000, 10000, 30000], help="测试的 busy_timeout (毫秒)")
@click.option("--output", "-o", help="输出文件路径")
@click.option("--format", "-f", type=click.Choice(["markdown", "json", "csv"]), default="markdown", help="输出格式")
def simulate(workload, db, batch_size, journal_mode, checkpoint_mode, busy_timeout, output, format):
    """回放请求时间线并模拟参数变化
    
    模拟不同配置下的表现：
    - batch size
    - journal_mode
    - checkpoint 策略
    - busy_timeout
    """
    click.echo("开始模拟...")
    
    importer = Importer()
    
    if db:
        importer.import_database(db)
    
    importer.import_workload_log(workload)
    
    data = importer.get_data()
    
    simulator = Simulator(data)
    
    test_params = {
        "batch_sizes": list(batch_size),
        "journal_modes": list(journal_mode),
        "checkpoint_modes": list(checkpoint_mode),
        "busy_timeouts": list(busy_timeout),
    }
    
    click.echo("运行模拟...")
    simulation_results = simulator.run_simulations(test_params)
    
    reporter = Reporter({"simulation": simulation_results})
    
    if output:
        reporter.export(output, format)
        click.echo(f"✓ 模拟报告已导出到: {output}")
    else:
        if format == "markdown":
            click.echo(reporter.generate_markdown())
        elif format == "json":
            click.echo(reporter.generate_json())
        elif format == "csv":
            click.echo(reporter.generate_csv())


@cli.command()
@click.option("--db", "-d", required=True, help="SQLite 数据库文件路径")
@click.option("--output", "-o", help="输出文件路径")
def inspect(db, output):
    """快速检查数据库基本信息和 pragma 配置"""
    click.echo(f"检查数据库: {db}")
    
    importer = Importer()
    importer.import_database(db)
    data = importer.get_data()
    
    analyzer = Analyzer(data)
    basic_info = analyzer.get_basic_info()
    
    reporter = Reporter({"basic_info": basic_info})
    
    if output:
        reporter.export(output, "markdown")
        click.echo(f"✓ 检查报告已导出到: {output}")
    else:
        click.echo(reporter.generate_markdown())


if __name__ == "__main__":
    cli()
