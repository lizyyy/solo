import os
import click
from datetime import datetime
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn

from kbcheck.utils import Storage, HistoryManager
from kbcheck.checkers import LinkChecker, DuplicateChecker, OwnerChecker
from kbcheck.models import Correction

console = Console()


@click.command()
@click.option("--path", default=".", help="知识库项目路径")
@click.option("--check-type", type=click.Choice(['all', 'links', 'duplicates', 'owners']), default='all', help="检查类型")
@click.option("--recheck", is_flag=True, help="强制重新检查已检查过的链接（保持幂等）")
def check(path: str, check_type: str, recheck: bool):
    """检查失效链接、重复页面和负责人归属"""
    storage = Storage(os.path.abspath(path))

    if not storage.exists():
        console.print("[red]工作区未初始化，请先运行 kbcheck init[/red]")
        return

    history = HistoryManager(storage)
    docs = storage.get_documents()
    links = storage.get_links()
    owners = storage.get_owners()

    if not docs:
        console.print("[yellow]没有找到文档，请先运行 kbcheck import[/yellow]")
        return

    existing_results = storage.get_check_results()
    checked_link_ids = {r.link_id for r in existing_results}

    console.print()
    console.print(f"[cyan]开始检查 (类型: {check_type})[/cyan]")
    console.print(f"  文档数: {len(docs)}")
    console.print(f"  链接数: {len(links)}")
    console.print(f"  负责人数: {len(owners)}")
    if not recheck:
        console.print(f"  已检查: {len(existing_results)} 条 (使用 --recheck 强制重检)")
    console.print()

    all_results = list(existing_results)
    new_results = []

    check_start = datetime.now()

    if check_type in ['all', 'links']:
        links_to_check = links
        if not recheck:
            links_to_check = [l for l in links if l.link_id not in checked_link_ids]

        if links_to_check:
            link_checker = LinkChecker(storage)
            console.print("[cyan]检查链接有效性...[/cyan]")
            results = link_checker.check_links(links_to_check, docs, owners)
            new_results.extend(results)
            console.print(f"  已检查 {len(results)} 个链接")

    if check_type in ['all', 'duplicates']:
        console.print("[cyan]检测重复页面...[/cyan]")
        dup_checker = DuplicateChecker()
        duplicates = dup_checker.detect_duplicates(docs, links)

        if duplicates:
            storage.save_duplicates(duplicates)
            for dup in duplicates:
                history.record(
                    command="check",
                    action="detect_duplicate",
                    entity_type="duplicate",
                    entity_id=dup.duplicate_id,
                    status="warning",
                    message=f"发现 {len(dup.duplicate_doc_ids) + 1} 个重复页面，相似度: {dup.similarity_score}",
                )
        console.print(f"  发现 {len(duplicates)} 组重复页面")

    if check_type in ['all', 'owners']:
        console.print("[cyan]分析负责人风险...[/cyan]")
        owner_checker = OwnerChecker()

        all_check_results = existing_results + new_results
        owner_analysis = owner_checker.analyze_owner_risks(docs, owners, all_check_results)

        inactive_count = len(owner_analysis["inactive_owners"])
        unassigned_count = len(owner_analysis["unassigned_docs"])

        console.print(f"  离职负责人: {inactive_count} 位")
        console.print(f"  未分配文档: {unassigned_count} 份")

    if new_results:
        storage.save_check_results(new_results)
        for result in new_results:
            if result.status != "passed":
                history.record(
                    command="check",
                    action="check_link",
                    entity_type="link",
                    entity_id=result.link_id,
                    status=result.status,
                    message=f"{result.error_type}: {result.error_message}",
                    old_value={"status": "unchecked"},
                    new_value={"status": result.status, "error_type": result.error_type},
                )

    check_end = datetime.now()
    storage.set_meta("last_check_at", check_end.isoformat())

    all_results = storage.get_check_results()
    _show_check_summary(all_results, duplicates if check_type in ['all', 'duplicates'] else [])


def _show_check_summary(results, duplicates):
    passed = sum(1 for r in results if r.status == "passed")
    failed = sum(1 for r in results if r.status == "failed")
    warnings = sum(1 for r in results if r.status == "warning")

    error_types = {}
    for r in results:
        if r.error_type:
            error_types[r.error_type] = error_types.get(r.error_type, 0) + 1

    console.print()
    table = Table(title="检查结果汇总", show_header=True)
    table.add_column("状态", style="cyan")
    table.add_column("数量", justify="right")
    table.add_column("占比", justify="right")

    total = len(results)
    if total > 0:
        table.add_row(
            "[green]通过[/green]",
            str(passed),
            f"{(passed/total)*100:.1f}%",
        )
        table.add_row(
            "[red]失败[/red]",
            str(failed),
            f"{(failed/total)*100:.1f}%",
        )
        table.add_row(
            "[yellow]警告[/yellow]",
            str(warnings),
            f"{(warnings/total)*100:.1f}%",
        )

    console.print(table)

    if error_types:
        console.print()
        et_table = Table(title="错误类型分布", show_header=True)
        et_table.add_column("错误类型", style="cyan")
        et_table.add_column("数量", justify="right")

        for err_type, count in sorted(error_types.items(), key=lambda x: -x[1]):
            et_table.add_row(err_type, str(count))

        console.print(et_table)

    if duplicates:
        console.print()
        dup_table = Table(title="重复页面", show_header=True)
        dup_table.add_column("原因", style="cyan")
        dup_table.add_column("相似度", justify="right")
        dup_table.add_column("涉及页面数", justify="right")

        for dup in duplicates:
            dup_table.add_row(
                dup.reason,
                f"{dup.similarity_score*100:.0f}%",
                str(len(dup.duplicate_doc_ids) + 1),
            )

        console.print(dup_table)

    console.print()
    console.print("[green]✓ 检查完成[/green]")
    console.print()
    console.print("下一步:")
    console.print("  - 运行 [cyan]kbcheck detail[/cyan] 查看详细信息")
    console.print("  - 运行 [cyan]kbcheck report[/cyan] 生成完整报告")
