import click
import json
from datetime import datetime
from pathlib import Path
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from .config import Config
from .database import DatabaseManager
from .importer import DataImporter
from .hit_calculator import HitCalculator
from .report_generator import ReportGenerator
from . import sample_data


console = Console()


def get_components():
    config = Config.from_env()
    config.ensure_dirs()
    db = DatabaseManager(config)
    importer = DataImporter(db)
    calculator = HitCalculator(db)
    reporter = ReportGenerator(db, calculator)
    return config, db, importer, calculator, reporter


@click.group()
@click.version_option()
def main():
    """客服知识库命中率统计 CLI 工具"""
    pass


@main.command()
def init():
    """初始化数据库和目录结构"""
    config, db, _, _, _ = get_components()

    console.print(f"[cyan]初始化中...[/cyan]")
    console.print(f"  数据库路径: {config.db_path}")
    console.print(f"  数据目录: {config.data_dir}")

    db.init_database()
    db.log("info", "System initialized", {"db_path": config.db_path})

    console.print(f"[green]✓ 初始化完成[/green]")
    console.print()
    console.print("下一步操作:")
    console.print("  1. kbhr sample          生成样例数据")
    console.print("  2. kbhr import <file>   导入数据文件")
    console.print("  3. kbhr check           计算命中率")
    console.print("  4. kbhr report          查看报告")


@main.command()
def sample():
    """生成并导入内置样例数据"""
    _, db, importer, calculator, _ = get_components()

    console.print("[cyan]生成样例数据...[/cyan]")
    batch = sample_data.generate_sample_batch()

    console.print(f"  知识库文章: {len(batch.articles)} 篇")
    console.print(f"  客服会话: {len(batch.conversations)} 个")
    console.print(f"  机器人推荐: {len(batch.recommendations)} 条")
    console.print(f"  客服引用: {len(batch.citations)} 条")
    console.print(f"  用户反馈: {len(batch.feedbacks)} 条")

    console.print()
    console.print("[cyan]导入数据...[/cyan]")
    result = importer.import_batch(batch, source_file="sample_data")

    console.print(f"  总计: {result.total} 条")
    console.print(f"  [green]成功: {result.success}[/green]")
    console.print(f"  [yellow]跳过(重复): {result.skipped}[/yellow]")
    console.print(f"  [red]失败: {result.failed}[/red]")

    if result.errors:
        console.print()
        console.print("[red]错误详情:[/red]")
        for e in result.errors:
            console.print(f"  - {e}")

    console.print()
    console.print("[cyan]计算命中率...[/cyan]")
    stats = calculator.calculate_hits()
    console.print(f"  创建命中事件: {stats['hits_created']}")
    console.print(f"  跳过重复: {stats['duplicates_skipped']}")

    console.print()
    console.print("[green]✓ 样例数据准备完成[/green]")
    console.print()
    console.print("下一步:")
    console.print("  kbhr report    查看综合报告")


@main.command()
@click.argument("file_path")
def import_(file_path: str):
    """导入数据文件 (JSON格式)"""
    _, db, importer, calculator, _ = get_components()

    if not Path(file_path).exists():
        console.print(f"[red]文件不存在: {file_path}[/red]")
        raise click.Abort()

    console.print(f"[cyan]导入文件: {file_path}[/cyan]")

    try:
        result = importer.import_from_file(file_path)
    except Exception as e:
        console.print(f"[red]导入失败: {e}[/red]")
        db.log("error", "Import failed", {"error": str(e)})
        raise click.Abort()

    console.print(f"  总计: {result.total} 条")
    console.print(f"  [green]成功: {result.success}[/green]")
    console.print(f"  [yellow]跳过(重复): {result.skipped}[/yellow]")
    console.print(f"  [red]失败: {result.failed}[/red]")

    if result.errors:
        console.print()
        console.print("[red]错误详情:[/red]")
        for e in result.errors:
            console.print(f"  - {e}")

    console.print()
    console.print("[cyan]更新命中统计...[/cyan]")
    stats = calculator.calculate_hits()
    console.print(f"  命中事件: {stats['hits_created']} 新增, {stats['duplicates_skipped']} 跳过")

    console.print()
    console.print("[green]✓ 导入完成[/green]")


@main.command()
def check():
    """计算并更新命中率统计"""
    _, db, _, calculator, _ = get_components()

    console.print("[cyan]计算命中率...[/cyan]")
    stats = calculator.calculate_hits()

    console.print(f"  机器人推荐处理: {stats['recommendations_processed']}")
    console.print(f"  客服引用处理: {stats['citations_processed']}")
    console.print(f"  [green]新增命中事件: {stats['hits_created']}[/green]")
    console.print(f"  [yellow]跳过重复: {stats['duplicates_skipped']}[/yellow]")

    console.print()
    console.print("[green]✓ 计算完成[/green]")
    console.print("下一步:")
    console.print("  kbhr report          查看综合报告")
    console.print("  kbhr detail <id>     查看文章详情")


@main.command()
@click.option("--history", is_flag=True, help="查看导入历史")
@click.option("--logs", is_flag=True, help="查看系统日志")
def status(history: bool, logs: bool):
    """查看系统状态"""
    _, db, _, _, _ = get_components()

    if history:
        records = db.get_import_history(20)
        if not records:
            console.print("[yellow]暂无导入记录[/yellow]")
            return

        table = Table(title="导入历史记录")
        table.add_column("时间", style="cyan")
        table.add_column("类型", style="magenta")
        table.add_column("状态", style="green")
        table.add_column("总数")
        table.add_column("成功", style="green")
        table.add_column("跳过", style="yellow")
        table.add_column("失败", style="red")
        table.add_column("操作者")

        for r in records:
            status_color = "green" if r["status"] == "completed" else "yellow" if r["status"] == "partial" else "red"
            table.add_row(
                r["started_at"] or "-",
                r["source_type"],
                f"[{status_color}]{r['status']}[/{status_color}]",
                str(r["total"]),
                str(r["success"]),
                str(r["skipped"]),
                str(r["failed"]),
                r["operator"] or "-",
            )
            if r["error"]:
                table.add_row(f"[red]错误: {r['error']}[/red]", "", "", "", "", "", "", "")

        console.print(table)
        return

    if logs:
        logs_list = db.get_recent_logs(50)
        if not logs_list:
            console.print("[yellow]暂无日志[/yellow]")
            return

        for l in logs_list:
            color = {
                "info": "cyan",
                "warning": "yellow",
                "error": "red",
            }.get(l["level"], "white")
            console.print(f"[dim]{l['created_at']}[/dim] [{color}]{l['level'].upper():<7}[/{color}] {l['message']}")
            if l["context"]:
                console.print(f"      {l['context']}")
        return

    console.print("[cyan]系统状态[/cyan]")
    console.print()
    console.print("最近导入记录:")
    records = db.get_import_history(5)
    if not records:
        console.print("  [yellow]暂无[/yellow]")
    else:
        for r in records:
            status_color = "green" if r["status"] == "completed" else "red"
            console.print(f"  [{status_color}]{r['status']:<10}[/{status_color}] {r['started_at']} - {r['source_type']} ({r['success']}/{r['total']})")

    console.print()
    console.print("使用提示:")
    console.print("  kbhr status --history    查看完整导入历史")
    console.print("  kbhr status --logs       查看系统日志")


@main.command()
@click.argument("article_id")
@click.option("--diff", nargs=2, type=int, help="对比两个版本 (v1 v2)")
def detail(article_id: str, diff):
    """查看文章详情和版本差异"""
    _, _, _, _, reporter = get_components()

    if diff:
        v1, v2 = diff
        console.print(f"[cyan]对比版本: {article_id} v{v1} vs v{v2}[/cyan]")
        result = reporter.get_version_diff(article_id, v1, v2)

        if not result["found"]:
            console.print(f"[red]文章或版本不存在[/red]")
            raise click.Abort()

        d = result["diff"]
        for field in ["title", "category", "is_active"]:
            fd = d[field]
            if fd["changed"]:
                console.print(f"\n[yellow]{field.upper()} 变化:[/yellow]")
                console.print(f"  v{v1}: {fd['v1']}")
                console.print(f"  v{v2}: {fd['v2']}")
            else:
                console.print(f"\n[dim]{field} (未变化)[/dim]")

        if d["content"]["changed"]:
            console.print(f"\n[yellow]CONTENT 变化:[/yellow]")
            console.print(f"  v{v1}:\n    {d['content']['v1_preview']}")
            console.print(f"  v{v2}:\n    {d['content']['v2_preview']}")
        else:
            console.print(f"\n[dim]content (未变化)[/dim]")
        return

    console.print(f"[cyan]文章详情: {article_id}[/cyan]")
    result = reporter.get_article_detail(article_id)

    if not result["found"]:
        console.print(f"[red]文章不存在: {article_id}[/red]")
        raise click.Abort()

    curr = result["current_version"]

    console.print()
    console.print(Panel(
        f"[bold]{curr['title']}[/bold]\n"
        f"分类: {curr['category'] or '未分类'} | 版本: v{curr['version']} | 状态: {'[green]激活[/green]' if curr['is_active'] else '[red]停用[/red]'}",
        title="基本信息",
    ))

    table = Table(title="命中统计")
    table.add_column("指标")
    table.add_column("数值", justify="right")

    table.add_row("总命中次数", str(curr["total_hits"]))
    table.add_row("唯一会话数", str(curr["unique_conversations"]))
    table.add_row("机器人推荐", str(curr["bot_recommendations"]))
    table.add_row("客服引用", str(curr["agent_citations"]))
    table.add_row("直接复制", str(curr["copied_directly"]))
    table.add_row("改写后使用", str(curr["rewritten"]))
    table.add_row("有帮助反馈", f"[green]{curr['helpful_count']}[/green]")
    table.add_row("无帮助反馈", f"[red]{curr['not_helpful_count']}[/red]")
    conv = curr["conversion_rate_pct"]
    table.add_row("转化率", f"{conv}%" if conv is not None else "-")
    table.add_row("平均评分", str(curr["average_rating"]) if curr["average_rating"] else "-")
    needs_color = "red" if curr["needs_rewrite"] else "green"
    table.add_row("建议改写", f"[{needs_color}]{curr['needs_rewrite']}[/{needs_color}]")

    console.print(table)

    if result["version_history"] and len(result["version_history"]) > 1:
        console.print()
        vtable = Table(title="版本历史")
        vtable.add_column("版本", style="cyan")
        vtable.add_column("标题")
        vtable.add_column("状态")
        vtable.add_column("更新时间")
        for v in result["version_history"]:
            vtable.add_row(
                f"v{v['version']}",
                v["title"],
                "[green]激活[/green]" if v["is_active"] else "[red]停用[/red]",
                v["updated_at"] or "-",
            )
        console.print(vtable)
        console.print(f"\n[dim]提示: 用 --diff v1 v2 对比版本差异[/dim]")

    if result["manual_corrections"]:
        console.print()
        ctable = Table(title="人工修正记录")
        ctable.add_column("时间", style="cyan")
        ctable.add_column("操作者", style="magenta")
        ctable.add_column("原因")
        for c in result["manual_corrections"]:
            ctable.add_row(c["created_at"] or "-", c["operator"] or "-", c["reason"] or "-")
        console.print(ctable)

    if result["recent_hits"]:
        console.print()
        htable = Table(title="最近命中 (前20条)")
        htable.add_column("时间", style="cyan")
        htable.add_column("会话")
        htable.add_column("来源")
        htable.add_column("类型")
        htable.add_column("版本")
        htable.add_column("有帮助")
        htable.add_column("已解决")
        for h in result["recent_hits"]:
            source_color = "blue" if h["source"] == "bot" else "magenta"
            helpful = "[green]是[/green]" if h["is_helpful"] is True else "[red]否[/red]" if h["is_helpful"] is False else "-"
            resolved = "[green]是[/green]" if h["resolved"] is True else "[red]否[/red]" if h["resolved"] is False else "-"
            htable.add_row(
                h["occurred_at"] or "-",
                h["conversation_id"][:12] + "...",
                f"[{source_color}]{h['source']}[/{source_color}]",
                h["hit_type"],
                f"v{h['article_version']}",
                helpful,
                resolved,
            )
        console.print(htable)


@main.command()
@click.option("--json", "output_json", is_flag=True, help="输出JSON格式")
def report(output_json: bool):
    """生成综合命中率报告"""
    _, _, _, _, reporter = get_components()

    console.print("[cyan]生成报告...[/cyan]")
    data = reporter.generate_overview()

    if output_json:
        print(json.dumps(data, indent=2, ensure_ascii=False))
        return

    if not data["has_data"]:
        console.print("[yellow]暂无数据，请先导入数据[/yellow]")
        console.print()
        console.print("使用:")
        console.print("  kbhr sample    生成样例数据")
        console.print("  kbhr import    导入自定义数据")
        return

    s = data["summary"]

    console.print()
    console.print(Panel(
        f"知识库文章数: [bold]{s['total_articles']}[/bold]\n"
        f"总命中次数: [bold]{s['total_hits']}[/bold]\n"
        f"覆盖会话数: [bold]{s['unique_conversations']}[/bold]\n"
        f"反馈样本数: [bold]{s['total_feedback']}[/bold]\n"
        f"整体转化率: [bold][green]{s['overall_conversion_rate_pct']}%[/green][/bold]" if s["overall_conversion_rate_pct"] is not None else f"整体转化率: [bold][yellow]-[/yellow][/bold]",
        title="📊 知识库命中率综合报告",
        expand=False,
    ))

    if data["high_hit_articles"]:
        console.print()
        table = Table(title="🔥 高命中文章 TOP 5")
        table.add_column("文章ID", style="cyan")
        table.add_column("标题")
        table.add_column("分类")
        table.add_column("命中", justify="right")
        table.add_column("会话", justify="right")
        table.add_column("转化率")
        for a in data["high_hit_articles"]:
            conv = f"{a['conversion_rate_pct']}%" if a["conversion_rate_pct"] is not None else "-"
            table.add_row(
                a["article_id"],
                a["title"][:30] + ("..." if len(a["title"]) > 30 else ""),
                a["category"] or "-",
                str(a["total_hits"]),
                str(a["unique_conversations"]),
                conv,
            )
        console.print(table)

    if data["low_conversion_articles"]:
        console.print()
        table = Table(title="⚠️ 低转化文章 TOP 5")
        table.add_column("文章ID", style="cyan")
        table.add_column("标题")
        table.add_column("分类")
        table.add_column("命中", justify="right")
        table.add_column("有帮助", justify="right")
        table.add_column("无帮助", justify="right")
        table.add_column("转化率", style="red")
        for a in data["low_conversion_articles"]:
            table.add_row(
                a["article_id"],
                a["title"][:30] + ("..." if len(a["title"]) > 30 else ""),
                a["category"] or "-",
                str(a["total_hits"]),
                str(a["helpful_count"]),
                str(a["not_helpful_count"]),
                f"{a['conversion_rate_pct']}%",
            )
        console.print(table)

    if data["needs_rewrite_articles"]:
        console.print()
        table = Table(title="🔧 建议改写的文章")
        table.add_column("文章ID", style="cyan")
        table.add_column("标题")
        table.add_column("分类")
        table.add_column("无帮助率", style="red")
        table.add_column("版本")
        for a in data["needs_rewrite_articles"]:
            total = a["helpful_count"] + a["not_helpful_count"]
            bad_rate = (a["not_helpful_count"] / total * 100) if total > 0 else 0
            table.add_row(
                a["article_id"],
                a["title"][:40] + ("..." if len(a["title"]) > 40 else ""),
                a["category"] or "-",
                f"{bad_rate:.0f}%",
                f"v{a['version']}",
            )
        console.print(table)

    if data["by_category"]:
        console.print()
        table = Table(title="📁 按分类统计")
        table.add_column("分类", style="magenta")
        table.add_column("文章数", justify="right")
        table.add_column("命中数", justify="right")
        table.add_column("转化率")
        for c in data["by_category"]:
            conv = f"{c['conversion_rate_pct']}%" if c["conversion_rate_pct"] is not None else "-"
            table.add_row(
                c["category"],
                str(c["article_count"]),
                str(c["total_hits"]),
                conv,
            )
        console.print(table)

    console.print()
    console.print("[dim]报告生成时间: " + data["generated_at"] + "[/dim]")
    console.print()
    console.print("进一步分析:")
    console.print("  kbhr detail <article_id>           查看文章详情")
    console.print("  kbhr detail <article_id> --diff 1 2  对比版本差异")
    console.print("  kbhr report --json                 导出JSON格式")


if __name__ == "__main__":
    main()
