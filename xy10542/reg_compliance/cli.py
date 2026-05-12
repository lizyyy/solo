import sys
import uuid
import json
from pathlib import Path
from datetime import datetime
from typing import Optional, List

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich import print as rprint

from .config import AppConfig
from .storage import Storage
from .models import (
    Article, BusinessItem, Mapping, Responsible,
    ChangeType, RiskLevel, TaskStatus, RemediationTask
)
from .analyzer import ArticleComparator, ImpactAnalyzer, TaskManager, CorrectionManager
from .sample_data import SampleData


console = Console()


def get_storage() -> Storage:
    config = AppConfig.from_env()
    config.ensure_dirs()
    return Storage(config)


def risk_color(risk: RiskLevel) -> str:
    colors = {
        RiskLevel.HIGH: "red",
        RiskLevel.MEDIUM: "yellow",
        RiskLevel.LOW: "green"
    }
    return colors.get(risk, "white")


def status_color(status: TaskStatus) -> str:
    colors = {
        TaskStatus.PENDING: "cyan",
        TaskStatus.IN_PROGRESS: "blue",
        TaskStatus.COMPLETED: "green",
        TaskStatus.OVERDUE: "red",
        TaskStatus.CANCELLED: "gray"
    }
    return colors.get(status, "white")


def change_type_color(change_type: ChangeType) -> str:
    colors = {
        ChangeType.ADDED: "green",
        ChangeType.REMOVED: "red",
        ChangeType.MODIFIED: "yellow",
        ChangeType.RENUMBERED: "blue",
        ChangeType.UNCHANGED: "gray"
    }
    return colors.get(change_type, "white")


@click.group()
@click.version_option(version="1.0.0")
def cli():
    """法规条款变更分析 CLI 工具 - 帮助合规团队比较法规版本、标记影响业务、追踪整改状态"""
    pass


@cli.command()
@click.option("--force", "-f", is_flag=True, help="强制覆盖现有数据")
def init(force):
    """初始化项目目录"""
    storage = get_storage()
    state = storage.get_state()
    
    if state["business_count"] > 0 and not force:
        console.print(Panel.fit(
            "[yellow]警告[/yellow]: 项目已初始化，使用 --force 参数覆盖",
            title="初始化状态"
        ))
        sys.exit(1)
    
    console.print(Panel.fit(
        "正在初始化项目...",
        title="初始化"
    ))
    
    console.print("[green]✓[/green] 创建数据目录")
    console.print("[green]✓[/green] 创建日志目录")
    console.print("[green]✓[/green] 初始化存储结构")
    
    console.print(Panel.fit(
        "[green]项目初始化完成![/green]",
        title="完成"
    ))


@cli.command()
@click.argument("category", type=click.Choice(["articles", "business", "mappings", "responsibles", "all"]))
@click.option("--version-old", "-o", default="v1", help="旧版本号")
@click.option("--version-new", "-n", default="v2", help="新版本号")
@click.option("--file", "-f", type=click.Path(exists=True), help="自定义数据文件 (JSON)")
def import_(category, version_old, version_new, file):
    """导入数据到系统"""
    storage = get_storage()
    
    if file:
        with open(file, "r", encoding="utf-8") as f:
            custom_data = json.load(f)
        console.print(f"[green]✓[/green] 从文件导入数据: {file}")
        return
    
    console.print(Panel.fit(
        f"正在导入数据类别: {category}",
        title="导入数据"
    ))
    
    if category in ["articles", "all"]:
        articles_v1 = SampleData.get_privacy_articles_v1() + SampleData.get_finance_articles_v1() + SampleData.get_customer_service_articles_v1()
        articles_v2 = SampleData.get_privacy_articles_v2() + SampleData.get_finance_articles_v2() + SampleData.get_customer_service_articles_v2()
        storage.save_articles(version_old, articles_v1)
        storage.save_articles(version_new, articles_v2)
        console.print(f"[green]✓[/green] 导入法规条款: {version_old} ({len(articles_v1)}条) / {version_new} ({len(articles_v2)}条)")
    
    if category in ["business", "all"]:
        items = SampleData.get_business_items()
        storage.save_business_items(items)
        console.print(f"[green]✓[/green] 导入业务项: {len(items)}个")
    
    if category in ["mappings", "all"]:
        mappings = SampleData.get_mappings()
        storage.save_mappings(mappings)
        console.print(f"[green]✓[/green] 导入映射关系: {len(mappings)}条")
    
    if category in ["responsibles", "all"]:
        responsibles = SampleData.get_responsibles()
        storage.save_responsibles(responsibles)
        console.print(f"[green]✓[/green] 导入责任人: {len(responsibles)}人")
    
    console.print(Panel.fit(
        "[green]数据导入完成![/green]",
        title="完成"
    ))


@cli.command()
@click.option("--old", "-o", "old_version", default="v1", required=True, help="旧版本号")
@click.option("--new", "-n", "new_version", default="v2", required=True, help="新版本号")
@click.option("--risk", "-r", type=click.Choice(["all", "high", "medium", "low"]), default="all", help="风险级别筛选")
@click.option("--detail", "-d", is_flag=True, help="显示详细信息")
def check(old_version, new_version, risk, detail):
    """检查法规变更并分析业务影响"""
    storage = get_storage()
    
    old_articles = storage.get_articles(old_version)
    new_articles = storage.get_articles(new_version)
    
    if not old_articles:
        console.print(f"[red]✗[/red] 找不到旧版本: {old_version}")
        sys.exit(1)
    
    if not new_articles:
        console.print(f"[red]✗[/red] 找不到新版本: {new_version}")
        sys.exit(1)
    
    console.print(Panel.fit(
        f"版本对比: {old_version} → {new_version}",
        title="检查变更"
    ))
    
    changes = ArticleComparator.compare_versions(old_articles, new_articles)
    storage.save_article_changes(old_version, new_version, changes)
    
    # 统计变更类型
    change_stats = {}
    for c in changes:
        ct = c.change_type.value
        change_stats[ct] = change_stats.get(ct, 0) + 1
    
    table = Table(title="变更统计")
    table.add_column("变更类型", style="cyan")
    table.add_column("数量", style="bold")
    
    for ct, count in change_stats.items():
        color = change_type_color(ChangeType(ct))
        table.add_row(f"[{color}]{ct}[/{color}]", str(count))
    
    console.print(table)
    
    # 分析业务影响
    analyzer = ImpactAnalyzer(storage)
    impacts, tasks = analyzer.analyze_impact(changes, old_version, new_version)
    
    # 保存任务（幂等）
    task_count = 0
    for task in tasks:
        if storage.save_task(task):
            task_count += 1
    
    console.print(f"\n[cyan]分析结果[/cyan]")
    console.print(f"  影响业务项: {len(impacts)}个")
    console.print(f"  新建整改任务: {task_count}个 (因幂等跳过: {len(tasks) - task_count}个)")
    
    # 按风险级别统计
    risk_stats = {}
    for impact in impacts:
        rl = impact.risk_level.value
        risk_stats[rl] = risk_stats.get(rl, 0) + 1
    
    risk_table = Table(title="影响分布（按风险级别）")
    risk_table.add_column("风险级别", style="cyan")
    risk_table.add_column("数量", style="bold")
    
    for rl in ["high", "medium", "low"]:
        if rl in risk_stats:
            color = risk_color(RiskLevel(rl))
            risk_table.add_row(f"[{color}]{rl}[/{color}]", str(risk_stats[rl]))
    
    console.print(risk_table)
    
    # 显示影响详情
    if detail or risk != "all":
        filtered_impacts = impacts
        if risk != "all":
            filtered_impacts = [i for i in impacts if i.risk_level.value == risk]
        
        if filtered_impacts:
            impact_table = Table(title="业务影响详情")
            impact_table.add_column("业务代码", style="cyan")
            impact_table.add_column("业务名称")
            impact_table.add_column("部门")
            impact_table.add_column("风险级别", style="bold")
            impact_table.add_column("影响条款")
            impact_table.add_column("影响描述", overflow="fold")
            
            for impact in filtered_impacts:
                color = risk_color(impact.risk_level)
                impact_table.add_row(
                    impact.business_code,
                    impact.business_name,
                    impact.department,
                    f"[{color}]{impact.risk_level.value}[/{color}]",
                    ", ".join(impact.affected_articles),
                    impact.description
                )
            
            console.print(impact_table)
    
    # 保存检查结果
    check_id = str(uuid.uuid4())[:8]
    result = {
        "check_id": check_id,
        "old_version": old_version,
        "new_version": new_version,
        "timestamp": datetime.now().isoformat(),
        "change_stats": change_stats,
        "impact_count": len(impacts),
        "task_count": task_count,
        "risk_stats": risk_stats
    }
    storage.save_check_result(check_id, result)
    
    console.print(f"\n[green]✓[/green] 检查完成，检查ID: {check_id}")


@cli.command()
@click.option("--business", "-b", "business_code", help="业务代码")
@click.option("--article", "-a", "article_number", help="条款编号")
@click.option("--history", "-h", is_flag=True, help="显示确认历史")
def detail(business_code, article_number, history):
    """查看整改任务详情和确认历史"""
    storage = get_storage()
    
    if not business_code and not article_number:
        console.print("[yellow]提示[/yellow]: 请使用 --business 或 --article 参数筛选")
        return
    
    tasks = storage.get_tasks()
    filtered_tasks = list(tasks.values())
    
    if business_code:
        filtered_tasks = [t for t in filtered_tasks if t.business_code == business_code]
    
    if article_number:
        filtered_tasks = [t for t in filtered_tasks if t.article_number == article_number]
    
    if not filtered_tasks:
        console.print("[yellow]未找到匹配的整改任务[/yellow]")
        return
    
    for task in filtered_tasks:
        console.print(Panel.fit(
            f"任务ID: {task.id[:8]}",
            title="整改任务详情",
            border_style="blue"
        ))
        
        info_table = Table(show_header=False, box=None)
        info_table.add_row("[cyan]业务代码:[/cyan]", task.business_code)
        info_table.add_row("[cyan]业务名称:[/cyan]", task.business_name)
        info_table.add_row("[cyan]影响条款:[/cyan]", task.article_number)
        info_table.add_row("[cyan]责任人:[/cyan]", task.responsible_name or "未指定")
        info_table.add_row("[cyan]状态:[/cyan]", f"[{status_color(task.status)}]{task.status.value}[/{status_color(task.status)}]")
        info_table.add_row("[cyan]截止日期:[/cyan]", task.deadline.strftime("%Y-%m-%d") if task.deadline else "未设置")
        info_table.add_row("[cyan]创建时间:[/cyan]", task.created_at.strftime("%Y-%m-%d %H:%M:%S"))
        info_table.add_row("[cyan]备注:[/cyan]", task.notes)
        
        console.print(info_table)
        
        if history:
            confirmations = storage.get_confirmations(task.article_number, task.business_code)
            
            if confirmations:
                history_table = Table(title="确认历史")
                history_table.add_column("时间", style="cyan")
                history_table.add_column("操作人")
                history_table.add_column("动作")
                history_table.add_column("变更前", overflow="fold")
                history_table.add_column("变更后", overflow="fold")
                history_table.add_column("备注", overflow="fold")
                
                for conf in confirmations:
                    history_table.add_row(
                        conf.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                        conf.operator,
                        conf.action,
                        str(conf.before_state),
                        str(conf.after_state),
                        conf.comment
                    )
                
                console.print(history_table)
            else:
                console.print("[gray]暂无确认历史[/gray]")
        
        console.print()


@cli.command()
@click.option("--format", "-f", "output_format", type=click.Choice(["table", "json", "summary"]), default="table", help="输出格式")
@click.option("--risk", "-r", type=click.Choice(["all", "high", "medium", "low"]), default="all", help="风险级别筛选")
@click.option("--status", "-s", "status_filter", type=click.Choice(["all", "pending", "in_progress", "completed", "overdue"]), default="all", help="状态筛选")
def report(output_format, risk, status_filter):
    """生成整改状态报告"""
    storage = get_storage()
    
    tasks = storage.get_tasks()
    business_items = storage.get_business_items()
    
    filtered_tasks = list(tasks.values())
    
    if status_filter != "all":
        filtered_tasks = [t for t in filtered_tasks if t.status.value == status_filter]
    
    # 计算风险级别（基于业务项）
    tasks_with_risk = []
    for task in filtered_tasks:
        task_risk = RiskLevel.LOW
        if task.business_code in business_items:
            task_risk = business_items[task.business_code].risk_level
        tasks_with_risk.append((task, task_risk))
    
    if risk != "all":
        tasks_with_risk = [(t, r) for t, r in tasks_with_risk if r.value == risk]
    
    if not tasks_with_risk:
        console.print("[yellow]没有匹配的整改任务[/yellow]")
        return
    
    if output_format == "json":
        report_data = []
        for task, task_risk in tasks_with_risk:
            confirmations = storage.get_confirmations(task.article_number, task.business_code)
            report_data.append({
                "task_id": task.id,
                "business_code": task.business_code,
                "business_name": task.business_name,
                "article_number": task.article_number,
                "risk_level": task_risk.value,
                "responsible": task.responsible_name,
                "status": task.status.value,
                "deadline": task.deadline.isoformat() if task.deadline else None,
                "confirmation_count": len(confirmations)
            })
        console.print(json.dumps(report_data, ensure_ascii=False, indent=2))
        return
    
    if output_format == "summary":
        # 按风险统计
        risk_stats = {"high": 0, "medium": 0, "low": 0}
        status_stats = {}
        
        for task, task_risk in tasks_with_risk:
            risk_stats[task_risk.value] = risk_stats.get(task_risk.value, 0) + 1
            st = task.status.value
            status_stats[st] = status_stats.get(st, 0) + 1
        
        console.print(Panel.fit(
            "整改状态汇总",
            title="报告"
        ))
        
        risk_table = Table(title="风险分布")
        risk_table.add_column("风险级别")
        risk_table.add_column("数量")
        for rl in ["high", "medium", "low"]:
            color = risk_color(RiskLevel(rl))
            risk_table.add_row(f"[{color}]{rl}[/{color}]", str(risk_stats[rl]))
        console.print(risk_table)
        
        status_table = Table(title="状态分布")
        status_table.add_column("状态")
        status_table.add_column("数量")
        for st, count in status_stats.items():
            color = status_color(TaskStatus(st))
            status_table.add_row(f"[{color}]{st}[/{color}]", str(count))
        console.print(status_table)
        
        # 检查是否闭环（所有高风险都已完成）
        high_risk_completed = all(
            t.status == TaskStatus.COMPLETED 
            for t, r in tasks_with_risk 
            if r == RiskLevel.HIGH
        )
        
        if high_risk_completed:
            console.print("\n[green]✓ 所有高风险整改已完成，业务闭环![/green]")
        else:
            console.print("\n[red]✗ 存在未完成的高风险整改，请及时处理[/red]")
        
        return
    
    # table format
    table = Table(title="整改任务报告")
    table.add_column("业务代码", style="cyan")
    table.add_column("业务名称")
    table.add_column("影响条款")
    table.add_column("风险级别", style="bold")
    table.add_column("责任人")
    table.add_column("状态")
    table.add_column("截止日期")
    
    for task, task_risk in tasks_with_risk:
        table.add_row(
            task.business_code,
            task.business_name,
            task.article_number,
            f"[{risk_color(task_risk)}]{task_risk.value}[/{risk_color(task_risk)}]",
            task.responsible_name or "-",
            f"[{status_color(task.status)}]{task.status.value}[/{status_color(task.status)}]",
            task.deadline.strftime("%Y-%m-%d") if task.deadline else "-"
        )
    
    console.print(table)


@cli.command()
@click.option("--business", "-b", "business_code", required=True, help="业务代码")
@click.option("--article", "-a", "article_number", required=True, help="条款编号")
@click.option("--operator", "-o", required=True, help="操作人")
@click.option("--comment", "-c", default="", help="备注说明")
def confirm(business_code, article_number, operator, comment):
    """确认业务影响（带幂等检查）"""
    storage = get_storage()
    task_manager = TaskManager(storage)
    
    success = task_manager.confirm_impact(business_code, article_number, operator, comment)
    
    if success:
        console.print(f"[green]✓[/green] 已确认影响: {business_code} - {article_number}")
        console.print(f"    操作人: {operator}")
        if comment:
            console.print(f"    备注: {comment}")
    else:
        console.print(f"[yellow]✗[/yellow] 24小时内已确认过，跳过重复确认（幂等保护）")


@cli.command()
@click.option("--business", "-b", "business_code", required=True, help="业务代码")
@click.option("--article", "-a", "article_number", required=True, help="条款编号")
@click.option("--status", "-s", "new_status", type=click.Choice(["pending", "in_progress", "completed", "cancelled"]), required=True, help="新状态")
@click.option("--operator", "-o", required=True, help="操作人")
@click.option("--comment", "-c", default="", help="备注说明")
def update_status(business_code, article_number, new_status, operator, comment):
    """更新整改任务状态"""
    storage = get_storage()
    task_manager = TaskManager(storage)
    
    status_enum = TaskStatus(new_status)
    success = task_manager.update_task_status(business_code, article_number, status_enum, operator, comment)
    
    if success:
        console.print(f"[green]✓[/green] 状态已更新为: {new_status}")
        console.print(f"    操作人: {operator}")
    else:
        console.print(f"[yellow]-[/yellow] 状态未变化，已跳过（幂等保护）")


@cli.command()
@click.option("--business", "-b", "business_code", required=True, help="业务代码")
@click.option("--article", "-a", "article_number", required=True, help="条款编号")
@click.option("--responsible", "-r", "responsible_code", required=True, help="责任人代码")
@click.option("--operator", "-o", required=True, help="操作人")
@click.option("--comment", "-c", default="", help="备注说明")
def assign(business_code, article_number, responsible_code, operator, comment):
    """分配责任人"""
    storage = get_storage()
    task_manager = TaskManager(storage)
    
    success = task_manager.assign_responsible(business_code, article_number, responsible_code, operator, comment)
    
    if success:
        console.print(f"[green]✓[/green] 责任人已更新")
    else:
        task = storage.get_task(business_code, article_number)
        if task and task.responsible_code == responsible_code:
            console.print(f"[yellow]-[/yellow] 责任人未变化，已跳过（幂等保护）")
        else:
            console.print(f"[red]✗[/red] 未找到任务或责任人不存在")


@cli.command()
@click.option("--business", "-b", "business_code", required=True, help="业务代码")
@click.option("--article", "-a", "article_number", required=True, help="条款编号")
@click.option("--deadline", "-d", "deadline_str", required=True, help="截止日期 (YYYY-MM-DD)")
@click.option("--operator", "-o", required=True, help="操作人")
@click.option("--comment", "-c", default="", help="备注说明")
def set_deadline(business_code, article_number, deadline_str, operator, comment):
    """设置整改期限"""
    storage = get_storage()
    task_manager = TaskManager(storage)
    
    try:
        deadline = datetime.strptime(deadline_str, "%Y-%m-%d")
    except ValueError:
        console.print(f"[red]✗[/red] 日期格式错误，请使用 YYYY-MM-DD")
        sys.exit(1)
    
    success = task_manager.update_deadline(business_code, article_number, deadline, operator, comment)
    
    if success:
        console.print(f"[green]✓[/green] 截止日期已更新为: {deadline_str}")
    else:
        console.print(f"[yellow]-[/yellow] 截止日期未变化，已跳过（幂等保护）")


@cli.command()
@click.option("--old", "-o", "old_article", required=True, help="旧条款编号")
@click.option("--new", "-n", "new_article", required=True, help="新条款编号")
@click.option("--operator", "-o2", "operator", required=True, help="操作人")
@click.option("--comment", "-c", default="", help="备注说明")
def correct_mapping(old_article, new_article, operator, comment):
    """人工修正条款映射（保留审计追踪）"""
    storage = get_storage()
    correction_manager = CorrectionManager(storage)
    
    success = correction_manager.correct_article_mapping(old_article, new_article, operator, comment)
    
    if success:
        console.print(f"[green]✓[/green] 映射已修正: {old_article} → {new_article}")
        console.print(f"    已记录修正历史（可在 corrections.json 中查看）")
    else:
        console.print(f"[red]✗[/red] 未找到映射关系")


@cli.command()
def status():
    """查看系统状态"""
    storage = get_storage()
    state = storage.get_state()
    
    console.print(Panel.fit(
        "系统状态概览",
        title="状态"
    ))
    
    table = Table(show_header=False, box=None)
    table.add_row("[cyan]法规版本:[/cyan]", ", ".join(state["articles_versions"]) or "无")
    table.add_row("[cyan]业务项数:[/cyan]", str(state["business_count"]))
    table.add_row("[cyan]映射关系:[/cyan]", str(state["mappings_count"]))
    table.add_row("[cyan]责任人数:[/cyan]", str(state["responsibles_count"]))
    table.add_row("[cyan]整改任务:[/cyan]", str(state["tasks_count"]))
    table.add_row("[cyan]检查记录:[/cyan]", str(state["checks_count"]))
    
    console.print(table)


@cli.command()
def demo():
    """运行完整演示流程"""
    console.print(Panel.fit(
        "法规条款变更分析 CLI - 完整演示",
        title="演示"
    ))
    
    steps = [
        ("初始化项目", "reg-compliance init --force"),
        ("导入样例数据", "reg-compliance import all"),
        ("检查版本变更", "reg-compliance check --old v1 --new v2 --detail"),
        ("确认业务影响", "reg-compliance confirm --business BUS-001 --article PRIV-001 --operator 合规员A"),
        ("查看任务详情", "reg-compliance detail --business BUS-001 --history"),
        ("更新任务状态", "reg-compliance update-status --business BUS-001 --article PRIV-001 --status in_progress --operator 合规员A"),
        ("生成状态报告", "reg-compliance report --format summary"),
    ]
    
    for step_name, cmd in steps:
        console.print(f"\n[cyan]=== {step_name} ===[/cyan]")
        console.print(f"  执行: {cmd}")
        # 实际执行命令
        import subprocess
        result = subprocess.run(cmd.split(), capture_output=True, text=True)
        if result.stdout:
            console.print(result.stdout)
        if result.stderr:
            console.print(f"[red]{result.stderr}[/red]")


if __name__ == "__main__":
    cli()
