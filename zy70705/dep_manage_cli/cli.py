import click
import sys
from pathlib import Path

from .parsers import DataParser
from .engine import RuleEngine
from .tracker import AuditTrail
from .reports import ReportGenerator


@click.group()
@click.version_option(version="0.1.0", prog_name="dep-manage")
def cli():
    """多仓库依赖升级许可延期管理排查CLI"""
    pass


@cli.command()
@click.option("--repos", "-r", type=click.Path(exists=True), help="仓库列表文件 (CSV/Excel)")
@click.option("--deps", "-d", type=click.Path(exists=True), help="依赖包列表文件 (CSV/Excel)")
@click.option("--opinions", "-o", type=click.Path(exists=True), help="负责人意见文件 (CSV/Excel)")
@click.option("--extensions", "-e", type=click.Path(exists=True), help="延期申请文件 (CSV/Excel)")
@click.option("--batches", "-b", type=click.Path(exists=True), help="升级批次文件 (CSV/Excel)")
@click.option("--output-dir", "-O", type=click.Path(), default="./reports", help="输出目录")
@click.option("--format", "-f", type=click.Choice(["json", "csv", "xlsx", "all"]), default="all", help="输出格式")
@click.option("--quiet", "-q", is_flag=True, help="静默模式，不打印控制台摘要")
def check(repos, deps, opinions, extensions, batches, output_dir, format, quiet):
    """执行依赖升级许可检查"""
    try:
        parser = DataParser()
        parse_result = parser.parse_all(
            repos_file=repos,
            deps_file=deps,
            opinions_file=opinions,
            extensions_file=extensions,
            batches_file=batches,
        )

        if not parse_result.repositories:
            click.echo("错误: 没有解析到任何仓库数据，请检查输入文件", err=True)
            sys.exit(1)

        engine = RuleEngine()
        validation_result = engine.validate(parse_result)

        audit_trail = AuditTrail(parse_result, validation_result)

        reporter = ReportGenerator(audit_trail)

        if not quiet:
            click.echo(reporter.generate_console_summary())

        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        exported_files = []
        if format == "json":
            json_path = output_path / "dep_report.json"
            reporter.export_full_report(str(json_path))
            exported_files.append(str(json_path))
        elif format == "csv":
            csv_path = output_path / "dep_report.csv"
            reporter.export_csv_report(str(csv_path))
            exported_files.append(str(csv_path))
        elif format == "xlsx":
            xlsx_path = output_path / "dep_report.xlsx"
            reporter.export_excel_report(str(xlsx_path))
            exported_files.append(str(xlsx_path))
        else:
            exported_files = reporter.export_all(output_dir)

        if not quiet:
            import os
            click.echo()
            click.echo(f"报告已导出到: {os.path.abspath(output_dir)}")
            for f in exported_files:
                click.echo(f"  - {f}")

    except Exception as e:
        click.echo(f"错误: {str(e)}", err=True)
        sys.exit(1)


@cli.command()
@click.option("--output-dir", "-O", type=click.Path(), default="./sample_data", help="示例数据输出目录")
def sample(output_dir):
    """生成示例数据文件"""
    import csv
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    repos_data = [
        ["name", "owner", "current_version"],
        ["service-user", "张三", "1.2.3"],
        ["service-order", "李四", "2.0.0"],
        ["service-payment", "王五", "1.5.0"],
        ["service-gateway", "赵六", "3.1.0"],
        ["service-notification", "钱七", "0.9.0"],
    ]

    with open(out_path / "repositories.csv", "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerows(repos_data)

    deps_data = [
        ["package_name", "target_version", "min_version"],
        ["commons-utils", "2.0.0", "1.8.0"],
        ["security-core", "3.0.0", "2.5.0"],
        ["database-driver", "1.5.0", "1.2.0"],
    ]

    with open(out_path / "dependencies.csv", "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerows(deps_data)

    opinions_data = [
        ["repo_name", "owner", "opinion", "comment", "date"],
        ["service-user", "张三", "同意", "已完成测试", "2024-01-15"],
        ["service-order", "李四", "不同意", "存在兼容性问题", "2024-01-16"],
        ["service-payment", "王五", "需要延期", "正在进行重构", "2024-01-17"],
        ["service-gateway", "赵六", "同意", "", "2024-01-18"],
    ]

    with open(out_path / "opinions.csv", "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerows(opinions_data)

    extensions_data = [
        ["repo_name", "owner", "requested_by", "reason", "requested_date", "new_target_date", "status"],
        ["service-notification", "钱七", "钱七", "业务高峰期，需要延期到Q2", "2024-01-10", "2024-04-01", "已批准"],
        ["service-payment", "王五", "王五", "重构工作尚未完成", "2024-01-15", "2024-02-15", "申请中"],
    ]

    with open(out_path / "extensions.csv", "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerows(extensions_data)

    batches_data = [
        ["batch_id", "name", "target_date", "packages", "status"],
        ["BATCH-001", "第一批次升级", "2024-02-01", "commons-utils,security-core", "进行中"],
        ["BATCH-002", "第二批次升级", "2024-03-01", "database-driver", "规划中"],
    ]

    with open(out_path / "batches.csv", "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerows(batches_data)

    import os
    abs_path = os.path.abspath(output_dir)
    click.echo(f"示例数据已生成到: {abs_path}")
    click.echo()
    click.echo("使用示例:")
    click.echo(f"  dep-manage check -r {abs_path}/repositories.csv -d {abs_path}/dependencies.csv -o {abs_path}/opinions.csv -e {abs_path}/extensions.csv -b {abs_path}/batches.csv")

@cli.command()
def license_only():
    """仅生成许可清单（需要配合 check 命令的参数使用）"""
    click.echo("请使用 dep-manage check 命令并指定 --format json 来获取许可清单")


main = cli

if __name__ == "__main__":
    cli()
