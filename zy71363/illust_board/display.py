from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from .models import Commission


def display_commission_detail(console: Console, c: Commission) -> None:
    status_colors = {
        "draft": "white",
        "sketch": "blue",
        "in_progress": "cyan",
        "waiting_confirm": "yellow",
        "revising": "magenta",
        "completed": "green",
        "cancelled": "red",
    }
    
    warnings = []
    if c.is_over_revision_limit:
        warnings.append(Text("🔴 修改轮次超限", style="bold red"))
    if not c.has_final_paid and c.status.value == "completed":
        warnings.append(Text("💰 尾款未付", style="bold yellow"))
    if c.has_missing_screenshots:
            warnings.append(Text(f"📷 缺少截图: {', '.join(c.has_missing_screenshots)}", style="bold yellow"))
    
    header = Text()
    header.append(f"📋 {c.title}\n", style="bold magenta")
    header.append(f"ID: {c.id} | 客户: {c.client_name}\n", style="dim")
    header.append(f"状态: ", style="dim")
    header.append(c.status.value, style=f"bold {status_colors.get(c.status.value, 'white')}")
    
    if warnings:
        header.append("\n")
        for w in warnings:
            header.append(w)
            header.append(" ")
    
    console.print(Panel(header, expand=False))
    
    if c.description:
        console.print(f"\n[dim]描述:[/dim] {c.description}")
    
    if c.tags:
        console.print(f"[dim]标签:[/dim] {', '.join(c.tags)}")
    
    console.print("\n[bold cyan]🎨 草图版本[/bold cyan]")
    if c.sketches:
        for s in c.sketches:
            sketch_title = f"v{s.version}"
            if s.description:
                sketch_title += f" - {s.description}"
            console.print(f"  [blue]{sketch_title}[/blue]")
            console.print(f"    文件: {s.file_path}")
            console.print(f"    创建: {s.created_at.strftime('%Y-%m-%d %H:%M')}")
            
            if s.revisions:
                console.print(f"    [magenta]修改意见 ({len(s.revisions)}):[/magenta]")
                for r in s.revisions:
                    status = "✅" if r.is_resolved else "⏳"
                    console.print(f"      {status} [v{r.version}] {r.date.strftime('%Y-%m-%d')}")
                    console.print(f"         {r.feedback}")
    else:
        console.print("  [dim]暂无草图[/dim]")
    
    console.print("\n[bold green]💳 付款节点[/bold green]")
    if c.payments:
        table = Table(show_header=True, header_style="bold", show_lines=False)
        table.add_column("节点", style="cyan")
        table.add_column("金额", justify="right")
        table.add_column("状态")
        table.add_column("付款日期")
        for p in c.payments:
            status = "✅ 已付" if p.paid else "⏳ 待付"
            status_style = "green" if p.paid else "yellow"
            paid_date = p.paid_at.strftime("%Y-%m-%d") if p.paid_at else "-"
            table.add_row(
                p.node_type,
                f"¥{p.amount:.2f}",
                Text(status, style=status_style),
                paid_date,
            )
        total_paid = sum(p.amount for p in c.payments if p.paid)
        total_amount = sum(p.amount for p in c.payments)
        table.add_row(
            "[bold]合计[/bold]",
            f"[bold]¥{total_amount:.2f}[/bold]",
            f"已付 ¥{total_paid:.2f}",
            "",
        )
        console.print(table)
    else:
        console.print("  [dim]暂无付款节点[/dim]")
    
    console.print("\n[bold yellow]✅ 客户确认[/bold yellow]")
    if c.confirmations:
        for conf in c.confirmations:
            has_screenshot = "✅" if conf.screenshot_path else "❌"
            console.print(f"  {has_screenshot} [yellow]{conf.stage}[/yellow]")
            console.print(f"    确认时间: {conf.confirmed_at.strftime('%Y-%m-%d %H:%M')}")
            if conf.screenshot_path:
                console.print(f"    截图: {conf.screenshot_path}")
            else:
                console.print("    [red]⚠️  缺少确认截图[/red]")
            if conf.notes:
                console.print(f"    备注: {conf.notes}")
    else:
        console.print("  [dim]暂无确认记录[/dim]")
    
    console.print(f"\n[dim]创建时间: {c.created_at.strftime('%Y-%m-%d %H:%M')}[/dim]")


def display_alerts(console: Console, alert_data: dict) -> None:
    console.print("[bold red]🚨 告警汇总[/bold red]\n")
    
    if alert_data["over_revision"]:
        console.print("[bold red]🔴 修改轮次超限[/bold red]")
        table = Table(show_header=True, header_style="bold")
        table.add_column("ID", style="cyan")
        table.add_column("标题", style="magenta")
        table.add_column("客户", style="green")
        table.add_column("当前/上限", justify="center")
        table.add_column("超限", justify="center", style="bold red")
        
        for item in alert_data["over_revision"]:
            table.add_row(
                item["id"],
                item["title"],
                item["client"],
                f"{item['total_revisions']}/{item['max_revisions']}",
                f"+{item['over_by']}",
            )
        console.print(table)
        console.print("[yellow]  建议: 与客户沟通额外收费标准，或签署终止修改协议[/yellow]\n")
    
    if alert_data["final_unpaid"]:
        console.print("[bold yellow]💰 尾款未到[/bold yellow]")
        table = Table(show_header=True, header_style="bold")
        table.add_column("ID", style="cyan")
        table.add_column("标题", style="magenta")
        table.add_column("客户", style="green")
        table.add_column("尾款金额", justify="right", style="yellow")
        
        for item in alert_data["final_unpaid"]:
            amount = item["final_amount"]
            amount_str = f"¥{amount:.2f}" if isinstance(amount, (int, float)) else str(amount)
            table.add_row(
                item["id"],
                item["title"],
                item["client"],
                amount_str,
            )
        console.print(table)
        console.print("[yellow]  建议: 发送催款通知，确认交稿前收到尾款[/yellow]\n")
    
    if alert_data["missing_screenshots"]:
        console.print("[bold yellow]📷 确认截图缺失[/bold yellow]")
        table = Table(show_header=True, header_style="bold")
        table.add_column("ID", style="cyan")
        table.add_column("标题", style="magenta")
        table.add_column("客户", style="green")
        table.add_column("缺失阶段", style="yellow")
        
        for item in alert_data["missing_screenshots"]:
            table.add_row(
                item["id"],
                item["title"],
                item["client"],
                ", ".join(item["missing_stages"]),
            )
        console.print(table)
        console.print("[yellow]  建议: 补传聊天记录截图，避免后续纠纷[/yellow]\n")
    
    if not any(alert_data.values()):
        console.print("[green]✓ 无待处理告警[/green]")
