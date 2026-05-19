import click
import uuid
from datetime import datetime
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from core.models import Sample, FixRecord, FixStatus, SampleStatus
from core.storage import StorageManager
from core.checker import SampleChecker
from core.report_generator import ReportGenerator

console = Console()
storage = StorageManager()
checker = SampleChecker()
report_gen = ReportGenerator(checker)


@click.group()
def cli():
    """开发门户样例保鲜运行检查排查CLI"""
    pass


@cli.command()
@click.argument('sample_id', required=False)
@click.option('--language', '-l', help='按语言筛选')
@click.option('--status', '-s', help='按状态筛选')
@click.option('--all', '-a', is_flag=True, help='检查所有样例')
def check(sample_id, language, status, all):
    """运行样例检查"""
    if sample_id:
        sample = storage.get_sample(sample_id)
        if not sample:
            console.print(f"[red]错误: 未找到样例 {sample_id}[/red]")
            return
        samples = [sample]
    elif all:
        samples = storage.list_samples(language=language, status=status)
    else:
        samples = storage.list_samples(language=language, status=status)
        if not samples:
            console.print("[yellow]提示: 没有找到样例，请使用 sample-add 添加样例[/yellow]")
            return

    if not samples:
        console.print("[red]没有符合条件的样例[/red]")
        return

    console.print(f"\n[bold blue]开始检查 {len(samples)} 个样例...[/bold blue]")

    results = []
    for sample in samples:
        console.print(f"\n检查样例: {sample.sample_id} - {sample.name}")
        result = checker.run_sample(sample)
        storage.save_run_result(result)
        results.append(result)

        if result.status == "passed":
            console.print(f"  [green]✓ 通过[/green] ({result.duration_ms}ms)")
        else:
            console.print(f"  [red]✗ 失败[/red] ({result.duration_ms}ms)")
            console.print(f"    原因: {result.error_message}")
            console.print(f"    分类: {result.failure_category.value if result.failure_category else 'N/A'}")

    passed = sum(1 for r in results if r.status == "passed")
    console.print(f"\n[bold]检查完成: {passed}/{len(samples)} 通过[/bold]")


@cli.command()
@click.argument('sample_id')
@click.argument('description')
@click.option('--fixer', '-f', help='修复人')
@click.option('--notes', '-n', help='修复备注')
def fix(sample_id, description, fixer, notes):
    """记录修复记录"""
    sample = storage.get_sample(sample_id)
    if not sample:
        console.print(f"[red]错误: 未找到样例 {sample_id}[/red]")
        return

    latest_run = storage.get_latest_run_result(sample_id)
    if not latest_run:
        console.print("[yellow]警告: 该样例暂无运行记录[/yellow]")
        run_id = "manual"
    else:
        run_id = latest_run.run_id

    fix_record = FixRecord(
        fix_id=f"fix_{uuid.uuid4().hex[:8]}",
        sample_id=sample_id,
        run_id=run_id,
        status=FixStatus.FIXED,
        description=description,
        fixer=fixer,
        fixed_at=datetime.now(),
        fix_notes=notes
    )
    storage.save_fix_record(fix_record)

    sample.status = SampleStatus.FIXED
    sample.updated_at = datetime.now()
    storage.save_sample(sample)

    console.print(f"[green]✓ 修复记录已保存: {fix_record.fix_id}[/green]")


@cli.command()
@click.option('--output', '-o', help='输出文件路径')
@click.option('--human', '-h', is_flag=True, help='生成人类可读格式')
def report(output, human):
    """生成保鲜报告"""
    samples = storage.list_samples()
    results = storage.get_run_results()
    fix_records = storage.get_fix_records()

    report = report_gen.generate_report(samples, results, fix_records)

    if human:
        report_text = report_gen.generate_human_readable(report)
        if output:
            with open(output, 'w', encoding='utf-8') as f:
                f.write(report_text)
            console.print(f"[green]✓ 报告已保存到 {output}[/green]")
        else:
            console.print(report_text)
    else:
        if output:
            storage.save_report(report, output)
        else:
            path = storage.save_report(report)
            console.print(f"[green]✓ 报告已保存到 {path}[/green]")


@cli.command()
@click.argument('sample_id', required=False)
@click.option('--limit', '-n', type=int, default=10, help='显示数量')
def history(sample_id, limit):
    """查看运行历史"""
    results = storage.get_run_results(sample_id=sample_id, limit=limit)
    fix_records = storage.get_fix_records(sample_id=sample_id)

    if not results and not fix_records:
        console.print("[yellow]暂无历史记录[/yellow]")
        return

    if results:
        table = Table(title="运行历史")
        table.add_column("运行ID")
        table.add_column("样例ID")
        table.add_column("状态")
        table.add_column("耗时")
        table.add_column("时间")

        for r in results:
            status_color = "green" if r.status == "passed" else "red"
            table.add_row(
                r.run_id,
                r.sample_id,
                f"[{status_color}]{r.status}[/{status_color}]",
                f"{r.duration_ms}ms",
                r.ran_at.strftime('%H:%M:%S')
            )

        console.print(table)

    if fix_records:
        table = Table(title="修复记录")
        table.add_column("修复ID")
        table.add_column("样例ID")
        table.add_column("状态")
        table.add_column("描述")

        for f in fix_records:
            table.add_row(
                f.fix_id,
                f.sample_id,
                f.status.value,
                f.description
            )

        console.print(table)


@cli.command()
@click.argument('sample_id')
@click.argument('name')
@click.argument('api_endpoint')
@click.argument('api_version')
@click.option('--language', '-l', default='python', help='编程语言')
@click.option('--description', '-d', default='', help='样例描述')
@click.option('--tag', '-t', multiple=True, help='标签')
def sample_add(sample_id, name, api_endpoint, api_version, language, description, tag):
    """添加样例"""
    sample = Sample(
        sample_id=sample_id,
        name=name,
        description=description,
        language=language,
        api_endpoint=api_endpoint,
        api_version=api_version,
        expected_api_version=api_version,
        code_content=f"# 样例代码: {name}",
        input_data={"test": "data"},
        expected_output={"success": True},
        tags=list(tag)
    )
    storage.save_sample(sample)
    console.print(f"[green]✓ 样例已添加: {sample_id}[/green]")


@cli.command()
def sample_list():
    """列出所有样例"""
    samples = storage.list_samples()

    if not samples:
        console.print("[yellow]暂无样例[/yellow]")
        return

    table = Table(title="样例列表")
    table.add_column("ID")
    table.add_column("名称")
    table.add_column("语言")
    table.add_column("接口")
    table.add_column("版本")
    table.add_column("状态")

    for s in samples:
        table.add_row(
            s.sample_id,
            s.name,
            s.language.value,
            s.api_endpoint,
            s.api_version,
            s.status.value
        )

    console.print(table)


if __name__ == '__main__':
    cli()
