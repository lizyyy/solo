import click
from pathlib import Path
from datetime import datetime
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich import box

from tour_meal_allowance import TourMealAllowanceChecker

console = Console()


@click.group()
def cli():
    """合唱团巡演餐补表 - 曲目数据检查与餐补管理工具
    """
    pass


@cli.command()
@click.argument('excel_path', type=click.Path(exists=True))
def check(excel_path):
    """检查曲目Excel数据并显示问题汇总
    """
    console.print(Panel.fit(
        "[bold blue]🎵 合唱团巡演餐补表 - 数据检查[/bold blue]",
        border_style="blue"
    ))
    
    checker = TourMealAllowanceChecker(excel_path)
    
    with console.status("[bold green]正在分析数据...[/bold green]"):
        if not checker.run_all_checks():
            console.print("[red]数据加载失败，请检查文件格式[/red]")
            return
    
    summary = checker.get_summary()
    
    console.print(f"\n[bold]📊 检查概览[/bold]")
    console.print(f"   总记录数: {summary['总记录数']} 条")
    console.print(f"   问题记录: [red]{summary['问题总数']}[/red] 个问题点")
    console.print(f"   顺利记录: [green]{summary['顺利记录数']}[/green] 条")
    
    console.print(f"\n[bold yellow]📋 处理建议[/bold yellow]")
    for suggestion in summary['处理建议']:
        console.print(f"   {suggestion}")
    
    console.print(f"\n[bold magenta]🔍 详细问题列表[/bold magenta]")
    
    issue_names = {
        'duplicate_tracks': '🔁 重复曲目编号',
        'expired_license': '🔴 授权过期/即将到期',
        'missing_license': '🟡 授权待确认',
        'old_master_tapes': '🔵 旧版母带',
        'timecode_mismatch': '⚡ 时码错位',
        'empty_values': '📝 空值缺失',
        'manual_rename': '📋 人工改名记录',
        'old_format': '📚 旧口径数据',
        'need_confirmation': '👀 需要林老师确认'
    }
    
    for key, title in issue_names.items():
        issues_list = checker.issues[key]
        if issues_list:
            console.print(f"\n[bold]{title} ({len(issues_list)}条)[/bold]")
            for issue in issues_list:
                if '涉及曲目' in issue:
                    track_info = f"{issue['曲目编号']} - {', '.join(issue['涉及曲目'])}"
                else:
                    track_info = f"{issue['曲目编号']} - {issue['曲目名称']}"
                console.print(f"  [cyan]{track_info}[/cyan]")
                for k, v in issue.items():
                    if k not in ['曲目编号', '曲目名称', '涉及曲目']:
                        console.print(f"    {k}: {v}")
    
    if checker.smooth_records:
        console.print(f"\n[bold green]✅ 顺利通过检查的记录[/bold green]")
        for record in checker.smooth_records:
            console.print(f"  [green]{record['曲目编号']} - {record['曲目名称']}: {record['说明']}[/green]")


@cli.command()
@click.argument('excel_path', type=click.Path(exists=True))
@click.option('--output', '-o', default=None, help='输出文件路径')
def export(excel_path, output):
    """导出餐补清单（给演出/发行同事用
    """
    if output is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output = f"合唱团巡演餐补清单_{timestamp}.xlsx"
    
    checker = TourMealAllowanceChecker(excel_path)
    
    with console.status("[bold green]正在导出餐补清单...[/bold green]"):
        if not checker.run_all_checks():
            console.print("[red]数据加载失败[/red]")
            return
        
        result = checker.export_meal_allowance_list(output)
    
    console.print(Panel.fit(
        f"[bold green]🎉 餐补清单已导出[/bold green]\n{result}",
        border_style="green"
    ))
    console.print(f"输出文件: [blue]{output}[/blue]")


@cli.command()
@click.argument('excel_path', type=click.Path(exists=True))
def report(excel_path):
    """生成业务友好的报表（月底复盘专用
    """
    checker = TourMealAllowanceChecker(excel_path)
    
    with console.status("[bold green]正在生成复盘报表...[/bold green]"):
        if not checker.run_all_checks():
            console.print("[red]数据加载失败[/red]")
            return
    
    console.print(Panel.fit(
        "[bold blue]📊 合唱团巡演餐补表 - 复盘报表[/bold blue]",
        border_style="blue"
    ))
    
    console.print(f"\n[bold]📅 生成时间:[/bold] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    console.print(f"[bold]📁 源文件:[/bold] {excel_path}")
    
    summary = checker.get_summary()
    
    table = Table(title="数据统计", box=box.SIMPLE)
    table.add_column("项目")
    table.add_column("数量")
    table.add_row("总曲目数", str(summary['总记录数']))
    table.add_row("问题记录", f"[red]{summary['问题总数']}[/red]")
    table.add_row("正常记录", f"[green]{summary['顺利记录数']}[/green]")
    console.print(table)
    
    console.print(f"\n[bold yellow]📋 需要处理的事项[/bold yellow]")
    
    for i, suggestion in enumerate(summary['处理建议'], 1):
        console.print(f"{i}. {suggestion}")
    
    console.print(f"\n[bold cyan]📝 问题详情（可直接用于会议纪要[/bold cyan]")
    
    issue_details = []
    
    for issue in checker.issues['duplicate_tracks']:
        issue_details.append(f"【重复编号】{issue['曲目编号']}: 有{issue['重复次数']}条重复 - {issue['建议']}")
    
    for issue in checker.issues['expired_license']:
        days = issue.get('剩余天数', '已过期')
        days_text = f"剩余{days}天" if days != '已过期' else days
        issue_details.append(f"【授权问题】{issue['曲目编号']} - {issue['曲目名称']}: 授权{days_text} - {issue['建议']}")
    
    for issue in checker.issues['missing_license']:
        issue_details.append(f"【待确认】{issue['曲目编号']} - {issue['曲目名称']}: {issue['建议']}")
    
    for issue in checker.issues['old_master_tapes']:
        issue_details.append(f"【旧版母带】{issue['曲目编号']} - {issue['曲目名称']}({issue['版本']}): {issue['建议']}")
    
    for issue in checker.issues['timecode_mismatch']:
        issue_details.append(f"【时码问题】{issue['曲目编号']} - {issue['曲目名称']}: {issue['问题']} - {issue['建议']}")
    
    for issue in checker.issues['empty_values']:
        issue_details.append(f"【信息缺失】{issue['曲目编号']} - {issue['曲目名称']}: 缺{', '.join(issue['缺失字段'])} - {issue['建议']}")
    
    for detail in issue_details:
        console.print(f"  • {detail}")
    
    if checker.smooth_records:
        console.print(f"\n[bold green]✅ 已确认正常[/bold green]")
        for record in checker.smooth_records:
            console.print(f"  • {record['曲目编号']} - {record['曲目名称']}: 正常可用")


if __name__ == '__main__':
    cli()
