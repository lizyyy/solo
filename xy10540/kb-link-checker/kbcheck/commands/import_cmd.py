import os
import json
import glob
import click
from pathlib import Path
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn

from kbcheck.utils import Storage, HistoryManager
from kbcheck.parsers import MarkdownParser, HtmlParser
from kbcheck.models import Owner

console = Console()


@click.command("import")
@click.option("--path", default=".", help="知识库项目路径")
@click.option("--docs", help="文档目录或文件路径")
@click.option("--owners", help="负责人JSON文件路径")
@click.option("--sample", is_flag=True, help="使用内置样例数据")
@click.option("--default-owner", default="default", help="默认负责人ID")
def import_cmd(path: str, docs: str, owners: str, sample: bool, default_owner: str):
    """导入文档和负责人信息"""
    storage = Storage(os.path.abspath(path))

    if not storage.exists():
        console.print("[red]工作区未初始化，请先运行 kbcheck init[/red]")
        return

    history = HistoryManager(storage)

    if sample:
        _import_sample_data(storage, history)
        return

    all_docs = []
    all_links = []

    md_parser = MarkdownParser()
    html_parser = HtmlParser()

    if docs:
        docs_path = Path(docs)
        files = []
        if docs_path.is_file():
            files = [str(docs_path)]
        elif docs_path.is_dir():
            files = glob.glob(str(docs_path / "**/*.md"), recursive=True)
            files.extend(glob.glob(str(docs_path / "**/*.html"), recursive=True))

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("解析文档...", total=len(files))

            for file_path in files:
                try:
                    ext = Path(file_path).suffix.lower()
                    if ext == ".md":
                        doc, links = md_parser.parse_file(file_path, default_owner)
                    elif ext == ".html":
                        doc, links = html_parser.parse_file(file_path, default_owner)
                    else:
                        continue

                    all_docs.append(doc)
                    all_links.extend(links)
                    progress.advance(task)
                except Exception as e:
                    history.record(
                        command="import",
                        action="parse_document",
                        entity_type="document",
                        entity_id=file_path,
                        status="failed",
                        message=f"解析失败: {str(e)}",
                    )

    if owners:
        _import_owners_file(storage, owners, history)

    if all_docs:
        storage.save_documents(all_docs)
        for doc in all_docs:
            history.record(
                command="import",
                action="import_document",
                entity_type="document",
                entity_id=doc.doc_id,
                status="success",
                message=f"导入: {doc.title}",
            )

    if all_links:
        storage.save_links(all_links)

    _show_import_summary(storage, all_docs, all_links)


def _import_sample_data(storage: Storage, history: HistoryManager):
    from kbcheck.samples import generate_sample_data

    console.print("[cyan]生成内置样例数据...[/cyan]")

    data = generate_sample_data()

    storage.save_documents(data["documents"])
    storage.save_links(data["links"])
    storage.save_owners(data["owners"])

    for doc in data["documents"]:
        history.record(
            command="import",
            action="import_sample",
            entity_type="document",
            entity_id=doc.doc_id,
            status="success",
            message=f"导入样例: {doc.title}",
        )

    _show_import_summary(storage, data["documents"], data["links"])


def _import_owners_file(storage: Storage, file_path: str, history: HistoryManager):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        owners = []
        if isinstance(data, list):
            for item in data:
                owner = Owner.from_dict(item)
                owners.append(owner)
        elif isinstance(data, dict) and "owners" in data:
            for item in data["owners"]:
                owner = Owner.from_dict(item)
                owners.append(owner)

        storage.save_owners(owners)

        for owner in owners:
            history.record(
                command="import",
                action="import_owner",
                entity_type="owner",
                entity_id=owner.owner_id,
                status="success",
                message=f"导入负责人: {owner.name}",
            )

        console.print(f"[green]✓ 已导入 {len(owners)} 位负责人[/green]")

    except Exception as e:
        console.print(f"[red]导入负责人失败: {str(e)}[/red]")
        history.record(
            command="import",
            action="import_owners",
            entity_type="owner",
            entity_id="batch",
            status="failed",
            message=str(e),
        )


def _show_import_summary(storage: Storage, docs, links):
    existing_docs = storage.get_documents()
    existing_links = storage.get_links()
    existing_owners = storage.get_owners()

    table = Table(title="导入汇总", show_header=True)
    table.add_column("类型", style="cyan")
    table.add_column("本次导入", style="green")
    table.add_column("累计数量", style="yellow")

    table.add_row(
        "文档",
        str(len(docs)),
        str(len(existing_docs)),
    )
    table.add_row(
        "链接",
        str(len(links)),
        str(len(existing_links)),
    )
    table.add_row(
        "负责人",
        "0",
        str(len(existing_owners)),
    )

    console.print()
    console.print(table)
    console.print()
    console.print("[green]✓ 导入完成[/green]")
    console.print()
    console.print("下一步: 运行 [cyan]kbcheck check[/cyan] 检查链接")
