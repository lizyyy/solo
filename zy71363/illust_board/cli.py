from datetime import datetime
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table

from .storage import StorageManager
from . import commands

app = typer.Typer(
    name="illust-board",
    help="插画委托进度看板 CLI - 管理草图、修改轮次、付款节点和客户确认",
    add_completion=False,
)
console = Console()


def get_storage(input_dir: Optional[Path] = None) -> StorageManager:
    base_dir = input_dir or Path.cwd()
    storage = StorageManager(base_dir)
    return storage


@app.callback()
def main(
    input_dir: Optional[Path] = typer.Option(
        None, "--input-dir", "-i", help="输入目录（默认当前目录）"
    ),
    output_dir: Optional[Path] = typer.Option(
        None, "--output-dir", "-o", help="输出目录（默认同输入目录）"
    ),
):
    """插画委托进度看板 CLI"""
    pass


@app.command()
def init(
    input_dir: Optional[Path] = typer.Option(
        None, "--input-dir", "-i", help="工作目录（默认当前目录）"
    ),
):
    """初始化工作目录"""
    storage = get_storage(input_dir)
    if storage.is_initialized():
        console.print("[yellow]⚠️  目录已初始化，跳过[/yellow]")
        raise typer.Exit(0)
    storage.init_directories()
    console.print("[green]✓ 工作目录初始化成功[/green]")
    console.print(f"  数据目录: {storage.data_dir}")
    console.print(f"  截图目录: {storage.screenshots_dir}")
    console.print(f"  导出目录: {storage.exports_dir}")
    console.print(f"  备份目录: {storage.backups_dir}")


@app.command()
def create(
    title: str = typer.Argument(..., help="委托标题"),
    client: str = typer.Argument(..., help="客户名称"),
    description: str = typer.Option("", "--desc", "-d", help="委托描述"),
    max_revisions: int = typer.Option(3, "--max-rev", help="最大修改轮次"),
    input_dir: Optional[Path] = typer.Option(None, "--input-dir", "-i"),
):
    """创建新委托单"""
    storage = get_storage(input_dir)
    commission = commands.create_commission(storage, title, client, description, max_revisions)
    console.print(f"[green]✓ 委托单创建成功: {commission.id}[/green]")
    console.print(f"  标题: {commission.title}")
    console.print(f"  客户: {commission.client_name}")
    console.print(f"  最大修改轮次: {commission.max_revisions}")


@app.command(name="list")
def list_commissions(
    status: Optional[str] = typer.Option(None, "--status", "-s", help="按状态筛选"),
    client: Optional[str] = typer.Option(None, "--client", "-c", help="按客户筛选"),
    input_dir: Optional[Path] = typer.Option(None, "--input-dir", "-i"),
):
    """列出所有委托单"""
    storage = get_storage(input_dir)
    commissions = commands.list_commissions(storage, status, client)
    
    if not commissions:
        console.print("[yellow]暂无委托单[/yellow]")
        return
    
    table = Table(title="委托单列表", show_lines=True)
    table.add_column("ID", style="cyan")
    table.add_column("标题", style="magenta")
    table.add_column("客户", style="green")
    table.add_column("状态", style="yellow")
    table.add_column("草图", justify="center")
    table.add_column("修改", justify="center")
    table.add_column("付款", justify="center")
    table.add_column("⚠️", justify="center")
    
    for c in commissions:
        warnings = []
        if c.is_over_revision_limit:
            warnings.append("🔴 超限")
        if not c.has_final_paid and c.status == "completed":
            warnings.append("💰 尾款")
        if c.has_missing_screenshots:
            warnings.append("📷 缺图")
        warning_str = "\n".join(warnings) if warnings else "-"
        
        table.add_row(
            c.id,
            c.title,
            c.client_name,
            c.status.value,
            str(len(c.sketches)),
            f"{c.total_revisions}/{c.max_revisions}",
            c.payment_status.value,
            warning_str,
        )
    
    console.print(table)


@app.command()
def show(
    commission_id: str = typer.Argument(..., help="委托ID"),
    input_dir: Optional[Path] = typer.Option(None, "--input-dir", "-i"),
):
    """查看委托详情"""
    storage = get_storage(input_dir)
    commission = storage.load_commission(commission_id)
    
    if not commission:
        console.print(f"[red]✗ 委托单不存在: {commission_id}[/red]")
        raise typer.Exit(1)
    
    from .display import display_commission_detail
    display_commission_detail(console, commission)


@app.command()
def sketch(
    commission_id: str = typer.Argument(..., help="委托ID"),
    file_path: str = typer.Argument(..., help="草图文件路径"),
    description: str = typer.Option("", "--desc", "-d", help="版本描述"),
    input_dir: Optional[Path] = typer.Option(None, "--input-dir", "-i"),
):
    """添加草图版本"""
    storage = get_storage(input_dir)
    commission = commands.add_sketch(storage, commission_id, file_path, description)
    console.print(f"[green]✓ 草图版本 v{commission.current_sketch_version.version} 已添加[/green]")


@app.command()
def revise(
    commission_id: str = typer.Argument(..., help="委托ID"),
    feedback: str = typer.Argument(..., help="修改意见"),
    sketch_version: Optional[int] = typer.Option(None, "--sketch", "-s", help="草图版本（默认最新）"),
    input_dir: Optional[Path] = typer.Option(None, "--input-dir", "-i"),
):
    """添加修改意见"""
    storage = get_storage(input_dir)
    revision, commission = commands.add_revision(storage, commission_id, feedback, sketch_version)
    
    console.print(f"[green]✓ 修改意见已添加[/green]")
    console.print(f"  草图版本: v{revision.version}")
    console.print(f"  累计修改: {commission.total_revisions}/{commission.max_revisions}")
    
    if commission.is_over_revision_limit:
        console.print("[red]⚠️  警告：已超出最大修改轮次！[/red]")
        console.print("  建议：与客户沟通额外收费或终止修改")


@app.command()
def payment(
    commission_id: str = typer.Argument(..., help="委托ID"),
    node_type: str = typer.Argument(..., help="节点类型: deposit/final 或自定义"),
    amount: float = typer.Argument(..., help="金额"),
    paid: bool = typer.Option(False, "--paid", "-p", help="标记为已付款"),
    due_date: Optional[str] = typer.Option(None, "--due", help="截止日期 YYYY-MM-DD"),
    input_dir: Optional[Path] = typer.Option(None, "--input-dir", "-i"),
):
    """添加付款节点"""
    storage = get_storage(input_dir)
    due = datetime.strptime(due_date, "%Y-%m-%d") if due_date else None
    payment = commands.add_payment(storage, commission_id, node_type, amount, paid, due)
    
    status = "✅ 已付" if payment.paid else "⏳ 待付"
    console.print(f"[green]✓ 付款节点已添加[/green]")
    console.print(f"  类型: {payment.node_type}")
    console.print(f"  金额: ¥{payment.amount:.2f}")
    console.print(f"  状态: {status}")


@app.command()
def confirm(
    commission_id: str = typer.Argument(..., help="委托ID"),
    stage: str = typer.Argument(..., help="确认阶段: sketch/lineart/color/final"),
    screenshot: Optional[Path] = typer.Option(None, "--screenshot", "-s", help="确认截图路径"),
    input_dir: Optional[Path] = typer.Option(None, "--input-dir", "-i"),
):
    """添加客户确认记录"""
    storage = get_storage(input_dir)
    confirmation = commands.add_confirmation(storage, commission_id, stage, screenshot)
    
    if confirmation.screenshot_path:
        console.print(f"[green]✓ 确认记录已添加（含截图）[/green]")
    else:
        console.print(f"[yellow]⚠️  确认记录已添加，但缺少截图[/yellow]")
    console.print(f"  阶段: {confirmation.stage}")
    console.print(f"  截图: {confirmation.screenshot_path or '未提供'}")


@app.command()
def status(
    commission_id: str = typer.Argument(..., help="委托ID"),
    new_status: str = typer.Argument(..., help="新状态"),
    input_dir: Optional[Path] = typer.Option(None, "--input-dir", "-i"),
):
    """更新委托状态"""
    storage = get_storage(input_dir)
    commission = commands.update_status(storage, commission_id, new_status)
    console.print(f"[green]✓ 状态已更新: {commission.status.value}[/green]")


@app.command()
def export(
    commission_id: Optional[str] = typer.Option(None, "--id", help="导出单个委托（默认全部）"),
    format: str = typer.Option("markdown", "--format", "-f", help="导出格式: json/markdown/html"),
    output_dir: Optional[Path] = typer.Option(None, "--output-dir", "-o", help="输出目录"),
    input_dir: Optional[Path] = typer.Option(None, "--input-dir", "-i"),
):
    """导出进度报告"""
    storage = get_storage(input_dir)
    if output_dir:
        storage.exports_dir = Path(output_dir)
        storage.exports_dir.mkdir(parents=True, exist_ok=True)
    
    path = commands.export_report(storage, commission_id, format)
    console.print(f"[green]✓ 报告已导出:[/green]")
    console.print(f"  {path}")


@app.command()
def alerts(
    input_dir: Optional[Path] = typer.Option(None, "--input-dir", "-i"),
):
    """查看所有告警（修改超限、尾款未到、截图缺失）"""
    storage = get_storage(input_dir)
    alert_data = commands.get_alerts(storage)
    
    if not any(alert_data.values()):
        console.print("[green]✓ 无待处理告警[/green]")
        return
    
    from .display import display_alerts
    display_alerts(console, alert_data)


@app.command()
def sample(
    input_dir: Optional[Path] = typer.Option(None, "--input-dir", "-i"),
):
    """创建样例数据（包含边界案例）"""
    storage = get_storage(input_dir)
    if not storage.is_initialized():
        storage.init_directories()
    
    from .sample_data import create_sample_data
    commissions = create_sample_data(storage)
    
    console.print("[green]✓ 样例数据已创建[/green]")
    console.print(f"  共创建 {len(commissions)} 个委托单，包含以下边界案例:")
    console.print("  • 正常进行中的委托")
    console.print("  • 修改轮次超限的委托（需额外收费）")
    console.print("  • 已完成但尾款未付的委托")
    console.print("  • 有确认但缺少截图的委托")
    console.print("  • 已完成并全额付款的委托")


if __name__ == "__main__":
    app()
