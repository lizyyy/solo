import os
import sys
import json
from datetime import datetime
import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.syntax import Syntax

from .models import init_db, ReviewStatus, TrainingStatus
from .snapshot_import import SnapshotImporter
from .clustering import ClusteringEngine
from .result_service import ResultService

console = Console()


def get_db():
    db_path = os.environ.get("SCN_DB_PATH", "semantic_cluster.db")
    Session, _ = init_db(f"sqlite:///{db_path}")
    return Session()


@click.group()
@click.option("--db", default=None, help="数据库路径")
@click.option("--actor", default="system", help="操作人")
@click.pass_context
def cli(ctx, db, actor):
    """语义向量聚类命名系统 - 带自检和审计追踪的可复现聚类平台"""
    ctx.ensure_object(dict)
    ctx.obj["actor"] = actor
    if db:
        os.environ["SCN_DB_PATH"] = db


@cli.group()
def snapshot():
    """特征快照管理"""
    pass


@snapshot.command("import")
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--snapshot-id", default=None, help="快照ID，不指定则自动生成")
@click.option("--vector-column", default=None, help="向量列名")
@click.option("--supplement", is_flag=True, help="补录模式，追加版本")
@click.option("--supplement-version", type=int, default=None, help="指定补录版本号")
@click.pass_context
def import_snapshot(ctx, file_path, snapshot_id, vector_column, supplement, supplement_version):
    """导入特征快照CSV文件"""
    db = get_db()
    importer = SnapshotImporter(db, actor=ctx.obj["actor"])
    
    try:
        if supplement and snapshot_id:
            import pandas as pd
            df = pd.read_csv(file_path)
            snapshots, stats = importer.import_supplement(
                original_snapshot_id=snapshot_id,
                df=df,
                source_file=os.path.basename(file_path),
                vector_column=vector_column,
            )
        else:
            snapshots, stats = importer.import_from_csv(
                file_path=file_path,
                snapshot_id=snapshot_id,
                supplement_version=supplement_version or 1,
                vector_column=vector_column,
            )
        
        console.print(Panel.fit(
            f"[bold green]导入成功![/bold green]\n\n"
            f"快照ID: [cyan]{stats['snapshot_id']}[/cyan]\n"
            f"导入行数: [yellow]{stats['imported_rows']}[/yellow]\n"
            f"补录版本: [yellow]{stats['supplement_version']}[/yellow]\n"
            f"重复检测: [{'red' if stats['duplicate_detected'] else 'green'}]{'是' if stats['duplicate_detected'] else '否'}[/]\n"
            + (f"原快照ID: [yellow]{stats['duplicate_of_snapshot_id']}[/yellow]" if stats['duplicate_detected'] else "")
            , title="导入结果"
        ))
        
        console.print(f"\n[dim]可重跑命令:[/dim]")
        console.print(f"  scn snapshot import {file_path} --snapshot-id {stats['snapshot_id']}")
        
    except Exception as e:
        console.print(f"[bold red]导入失败:[/bold red] {e}")
        sys.exit(1)


@snapshot.command("list")
@click.option("--limit", default=20, help="显示数量")
def list_snapshots(limit):
    """列出所有特征快照"""
    db = get_db()
    importer = SnapshotImporter(db)
    snapshots = importer.list_snapshots(limit=limit)
    
    table = Table(title="特征快照列表")
    table.add_column("快照ID", style="cyan")
    table.add_column("总行数", style="yellow", justify="right")
    table.add_column("版本数", style="blue", justify="right")
    table.add_column("有重复", style="red")
    table.add_column("导入时间", style="green")
    
    for s in snapshots:
        if not s.get("exists"):
            continue
        table.add_row(
            s["snapshot_id"],
            str(s["total_rows"]),
            str(len(s["versions"])),
            "[red]是[/red]" if any(v["has_duplicate"] for v in s["versions"].values()) else "[green]否[/green]",
            s["imported_at"].strftime("%Y-%m-%d %H:%M") if s["imported_at"] else "-",
        )
    
    console.print(table)


@snapshot.command("show")
@click.argument("snapshot_id")
def show_snapshot(snapshot_id):
    """查看快照详情"""
    db = get_db()
    importer = SnapshotImporter(db)
    summary = importer.get_snapshot_summary(snapshot_id)
    
    if not summary["exists"]:
        console.print(f"[bold red]快照不存在:[/bold red] {snapshot_id}")
        sys.exit(1)
    
    console.print(Panel.fit(
        json.dumps(summary, indent=2, ensure_ascii=False, default=str),
        title=f"快照详情: {snapshot_id}",
        border_style="cyan"
    ))


@cli.group()
def cluster():
    """聚类训练管理"""
    pass


@cluster.command("run")
@click.argument("snapshot_id")
@click.option("--n-clusters", type=int, default=5, help="聚类数量")
@click.option("--algorithm", default="kmeans", help="聚类算法")
@click.option("--supplement-version", type=int, default=None, help="使用的补录版本")
@click.option("--force", is_flag=True, help="强制重新训练，跳过重复检测")
@click.pass_context
def run_cluster(ctx, snapshot_id, n_clusters, algorithm, supplement_version, force):
    """运行聚类训练"""
    db = get_db()
    engine = ClusteringEngine(db, actor=ctx.obj["actor"])
    
    try:
        run, stats = engine.run_clustering(
            snapshot_id=snapshot_id,
            n_clusters=n_clusters,
            algorithm=algorithm,
            supplement_version=supplement_version,
            force=force,
        )
        
        status_color = "yellow" if stats["requires_review"] else "green"
        
        console.print(Panel.fit(
            f"[bold green]训练完成![/bold green]\n\n"
            f"运行ID: [cyan]{stats['run_id']}[/cyan]\n"
            f"快照ID: [cyan]{stats['snapshot_id']}[/cyan]\n"
            f"聚类数: [yellow]{stats['n_clusters']}[/yellow]\n"
            f"结果行数: [yellow]{stats['row_count']}[/yellow]\n"
            f"重复训练: [{'red' if stats['is_duplicate'] else 'green'}]{'是' if stats['is_duplicate'] else '否'}[/]\n"
            f"复核状态: [{status_color}]{stats['review_status']}[/{status_color}]\n"
            + (f"[bold yellow]需要策略产品复核[/bold yellow]" if stats["requires_review"] else "")
            , title="训练结果"
        ))
        
        if stats["requires_review"]:
            console.print(f"\n[dim]复核命令:[/dim]")
            console.print(f"  scn review approve {stats['run_id']} --reviewer 策略产品")
            console.print(f"  scn review reject {stats['run_id']} --reviewer 策略产品")
        
        console.print(f"\n[dim]可重跑命令:[/dim]")
        console.print(f"  scn cluster run {snapshot_id} --n-clusters {n_clusters} --algorithm {algorithm}")
        
        if stats.get("metrics"):
            console.print(f"\n[dim]评估指标:[/dim]")
            for k, v in stats["metrics"].items():
                if isinstance(v, (int, float)):
                    console.print(f"  {k}: {v:.4f}" if isinstance(v, float) else f"  {k}: {v}")
        
    except Exception as e:
        console.print(f"[bold red]训练失败:[/bold red] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


@cluster.command("log")
@click.argument("run_id")
def show_training_log(run_id):
    """查看训练日志"""
    db = get_db()
    engine = ClusteringEngine(db)
    log = engine.get_training_log(run_id)
    
    if not log:
        console.print(f"[bold red]运行不存在或无日志:[/bold red] {run_id}")
        sys.exit(1)
    
    console.print(Panel(Syntax(log, "text", theme="monokai", line_numbers=True),
                        title=f"训练日志: {run_id}", border_style="yellow"))


@cluster.command("list")
@click.option("--snapshot-id", default=None, help="按快照ID过滤")
@click.option("--limit", default=20, help="显示数量")
def list_runs(snapshot_id, limit):
    """列出聚类训练运行"""
    db = get_db()
    engine = ClusteringEngine(db)
    runs = engine.list_runs(snapshot_id=snapshot_id, limit=limit)
    
    table = Table(title="聚类训练运行列表")
    table.add_column("运行ID", style="cyan")
    table.add_column("快照ID", style="blue")
    table.add_column("状态", style="yellow")
    table.add_column("复核状态", style="magenta")
    table.add_column("重复", style="red")
    table.add_column("聚类数", justify="right")
    table.add_column("开始时间", style="green")
    
    for r in runs:
        if not r.get("exists"):
            continue
        status_style = {
            TrainingStatus.SUCCESS.value: "green",
            TrainingStatus.FAILED.value: "red",
            TrainingStatus.DUPLICATE_TRAINING.value: "yellow",
            TrainingStatus.RUNNING.value: "blue",
        }.get(r["status"], "white")
        
        review_style = {
            ReviewStatus.PENDING_REVIEW.value: "yellow",
            ReviewStatus.APPROVED.value: "green",
            ReviewStatus.REJECTED.value: "red",
            ReviewStatus.NORMAL.value: "white",
        }.get(r["review_status"], "white")
        
        table.add_row(
            r["run_id"],
            r["snapshot_id"],
            f"[{status_style}]{r['status']}[/{status_style}]",
            f"[{review_style}]{r['review_status']}[/{review_style}]",
            "[red]是[/red]" if r["is_duplicate_run"] else "[green]否[/green]",
            str(r["params"].get("n_clusters", "-")),
            r["started_at"].strftime("%Y-%m-%d %H:%M") if r["started_at"] else "-",
        )
    
    console.print(table)


@cli.group()
def result():
    """聚类结果管理"""
    pass


@result.command("show")
@click.argument("run_id")
@click.option("--cluster", type=int, default=None, help="只显示指定簇")
@click.option("--limit", type=int, default=20, help="显示结果行数")
def show_result(run_id, cluster, limit):
    """查看聚类结果"""
    db = get_db()
    service = ResultService(db)
    data = service.get_results_for_display(run_id)
    
    console.print(Panel.fit(
        f"运行ID: [cyan]{data['run_id']}[/cyan]\n"
        f"快照ID: [cyan]{data['snapshot_id']}[/cyan]\n"
        f"状态: [yellow]{data['status']}[/yellow]\n"
        f"复核状态: [magenta]{data['review_status']}[/magenta]\n"
        f"总行数: [yellow]{data['total_rows']}[/yellow]\n"
        f"簇数量: [yellow]{len(data['clusters'])}[/yellow]",
        title="运行概览", border_style="cyan"
    ))
    
    table = Table(title="簇信息")
    table.add_column("簇ID", style="cyan", justify="right")
    table.add_column("簇名称", style="green")
    table.add_column("已编辑", style="yellow")
    table.add_column("样本数", style="blue", justify="right")
    
    for c in data["clusters"]:
        table.add_row(
            str(c["cluster_id"]),
            c["cluster_name"],
            "[green]是[/green]" if c["cluster_name_edited"] else "[dim]否[/dim]",
            str(c["count"]),
        )
    
    console.print(table)
    
    results = data["results"]
    if cluster is not None:
        results = [r for r in results if r["cluster_id"] == cluster]
    
    if results:
        detail_table = Table(title=f"结果明细 (前{min(limit, len(results))}条)")
        detail_table.add_column("行号", style="cyan", justify="right")
        detail_table.add_column("簇ID", style="blue", justify="right")
        detail_table.add_column("簇名称", style="green")
        detail_table.add_column("人工调整", style="yellow")
        
        for r in results[:limit]:
            detail_table.add_row(
                str(r["original_row_number"]),
                str(r["cluster_id"]),
                r["cluster_name"],
                "[red]是[/red]" if r["is_manual_override"] else "[dim]否[/dim]",
            )
        
        console.print(detail_table)


@result.command("export")
@click.argument("run_id")
@click.argument("output_path", type=click.Path())
@click.option("--format", "fmt", default="csv", type=click.Choice(["csv", "json", "xlsx"]), help="导出格式")
@click.option("--no-verify", is_flag=True, help="跳过一致性校验")
def export_result(run_id, output_path, fmt, no_verify):
    """导出聚类结果（与页面/API同一份数据）"""
    db = get_db()
    service = ResultService(db)
    
    try:
        result = service.export_results(
            run_id=run_id,
            output_path=output_path,
            format=fmt,
            verify_consistency=not no_verify,
        )
        
        console.print(Panel.fit(
            f"[bold green]导出成功![/bold green]\n\n"
            f"导出ID: [cyan]{result['export_id']}[/cyan]\n"
            f"输出文件: [yellow]{result['output_path']}[/yellow]\n"
            f"格式: [blue]{result['format']}[/blue]\n"
            f"行数: [yellow]{result['row_count']}[/yellow]\n"
            f"一致性校验: [{'green' if result['consistency_verified'] else 'red'}]{'通过' if result['consistency_verified'] else '失败'}[/]",
            title="导出结果"
        ))
        
        console.print(f"\n[dim]可重跑命令:[/dim]")
        console.print(f"  scn result export {run_id} {output_path} --format {fmt}")
        
    except Exception as e:
        console.print(f"[bold red]导出失败:[/bold red] {e}")
        sys.exit(1)


@result.command("edit-name")
@click.argument("run_id")
@click.argument("cluster_id", type=int)
@click.argument("new_name")
@click.option("--editor", default=None, help="编辑人")
@click.pass_context
def edit_cluster_name(ctx, run_id, cluster_id, new_name, editor):
    """编辑簇名称"""
    db = get_db()
    service = ResultService(db, actor=ctx.obj["actor"])
    
    if service.edit_cluster_name(run_id, cluster_id, new_name, edited_by=editor):
        console.print(f"[green]簇 {cluster_id} 名称已更新为: {new_name}[/green]")
    else:
        console.print("[red]更新失败，请检查运行ID和簇ID[/red]")
        sys.exit(1)


@result.command("override")
@click.argument("run_id")
@click.argument("snapshot_id")
@click.argument("row_number", type=int)
@click.argument("new_cluster", type=int)
@click.option("--reason", required=True, help="调整原因")
@click.option("--operator", default=None, help="操作人")
@click.pass_context
def override_cluster(ctx, run_id, snapshot_id, row_number, new_cluster, reason, operator):
    """人工调整某行的簇归属"""
    db = get_db()
    service = ResultService(db, actor=ctx.obj["actor"])
    
    if service.manual_override_cluster(
        run_id=run_id,
        snapshot_id=snapshot_id,
        original_row_number=row_number,
        new_cluster_id=new_cluster,
        reason=reason,
        overridden_by=operator,
    ):
        console.print(f"[green]已调整行 {row_number} 到簇 {new_cluster}[/green]")
    else:
        console.print("[red]调整失败[/red]")
        sys.exit(1)


@cli.group()
def review():
    """策略产品复核"""
    pass


@review.command("list")
def list_pending():
    """列出待复核的运行"""
    db = get_db()
    service = ResultService(db)
    pending = service.get_pending_reviews()
    
    if not pending:
        console.print("[green]暂无待复核项[/green]")
        return
    
    table = Table(title="待策略产品复核列表", style="yellow")
    table.add_column("运行ID", style="cyan")
    table.add_column("快照ID", style="blue")
    table.add_column("重复训练", style="red")
    table.add_column("原运行ID", style="magenta")
    table.add_column("提交时间", style="green")
    table.add_column("提交人", style="yellow")
    
    for p in pending:
        table.add_row(
            p["run_id"],
            p["snapshot_id"],
            "[red]是[/red]" if p["is_duplicate_run"] else "[green]否[/green]",
            p["duplicate_of_run_id"] or "-",
            p["started_at"].strftime("%Y-%m-%d %H:%M") if p["started_at"] else "-",
            p["created_by"],
        )
    
    console.print(table)


@review.command("approve")
@click.argument("run_id")
@click.option("--reviewer", required=True, help="复核人")
@click.option("--comments", default=None, help="复核意见")
@click.pass_context
def approve_review(ctx, run_id, reviewer, comments):
    """通过复核"""
    db = get_db()
    service = ResultService(db, actor=ctx.obj["actor"])
    
    if service.review_duplicate_run(run_id, "approve", reviewer, comments):
        console.print(f"[green]运行 {run_id} 复核通过[/green]")
    else:
        console.print("[red]操作失败[/red]")
        sys.exit(1)


@review.command("reject")
@click.argument("run_id")
@click.option("--reviewer", required=True, help="复核人")
@click.option("--comments", default=None, help="复核意见")
@click.pass_context
def reject_review(ctx, run_id, reviewer, comments):
    """驳回复核"""
    db = get_db()
    service = ResultService(db, actor=ctx.obj["actor"])
    
    if service.review_duplicate_run(run_id, "reject", reviewer, comments):
        console.print(f"[red]运行 {run_id} 复核驳回[/red]")
    else:
        console.print("[red]操作失败[/red]")
        sys.exit(1)


@cli.group()
def version():
    """特征版本管理"""
    pass


@version.command("create")
@click.argument("snapshot_id")
@click.argument("run_id")
@click.option("--change-log", default=None, help="变更说明")
@click.pass_context
def create_version(ctx, snapshot_id, run_id, change_log):
    """创建特征版本（更新特征版本表）"""
    db = get_db()
    service = ResultService(db, actor=ctx.obj["actor"])
    
    try:
        result = service.create_feature_version(
            snapshot_id=snapshot_id,
            run_id=run_id,
            change_log=change_log,
        )
        
        console.print(Panel.fit(
            f"[bold green]特征版本创建成功![/bold green]\n\n"
            f"版本ID: [cyan]{result['version_id']}[/cyan]\n"
            f"版本号: [yellow]{result['version_number']}[/yellow]\n"
            f"快照ID: [cyan]{result['snapshot_id']}[/cyan]\n"
            f"运行ID: [cyan]{result['run_id']}[/cyan]\n"
            f"是否激活: [green]是[/green]",
            title="特征版本"
        ))
        
        console.print(f"\n[dim]可重跑命令:[/dim]")
        console.print(f"  scn version create {snapshot_id} {run_id}" + (f' --change-log "{change_log}"' if change_log else ""))
        
    except Exception as e:
        console.print(f"[bold red]创建失败:[/bold red] {e}")
        sys.exit(1)


@cli.command("audit")
@click.option("--run-id", default=None, help="按运行ID过滤")
@click.option("--snapshot-id", default=None, help="按快照ID过滤")
@click.option("--limit", default=50, help="显示条数")
def show_audit(run_id, snapshot_id, limit):
    """查看审计追踪日志"""
    db = get_db()
    service = ResultService(db)
    logs = service.get_audit_trail(run_id=run_id, snapshot_id=snapshot_id, limit=limit)
    
    table = Table(title="审计追踪")
    table.add_column("时间", style="green")
    table.add_column("操作", style="cyan")
    table.add_column("操作人", style="yellow")
    table.add_column("字段", style="blue")
    table.add_column("旧值", style="red")
    table.add_column("新值", style="green")
    
    for l in logs:
        table.add_row(
            l["timestamp"].strftime("%Y-%m-%d %H:%M:%S") if l["timestamp"] else "-",
            l["action"],
            l["actor"],
            l["field_changed"] or "-",
            (l["old_value"] or "")[:30],
            (l["new_value"] or "")[:30],
        )
    
    console.print(table)


@cli.command("replay")
@click.option("--run-id", help="重放指定运行的完整流程")
@click.option("--snapshot-id", help="重放指定快照的完整流程")
def replay(run_id, snapshot_id):
    """生成可重跑的命令清单（复盘记录）"""
    db = get_db()
    
    if run_id:
        engine = ClusteringEngine(db)
        run = engine.get_run_summary(run_id)
        if not run.get("exists"):
            console.print(f"[red]运行不存在: {run_id}[/red]")
            sys.exit(1)
        
        service = ResultService(db)
        audit = service.get_audit_trail(run_id=run_id, limit=200)
        
        console.print(Panel.fit(
            f"[bold]运行ID:[/bold] [cyan]{run_id}[/cyan]\n"
            f"[bold]快照ID:[/bold] [cyan]{run['snapshot_id']}[/cyan]\n"
            f"[bold]算法:[/bold] {run['algorithm']}\n"
            f"[bold]参数:[/bold] {json.dumps(run['params'], ensure_ascii=False)}\n"
            f"[bold]状态:[/bold] {run['status']}\n"
            f"[bold]复核状态:[/bold] {run['review_status']}",
            title="复盘记录", border_style="magenta"
        ))
        
        console.print("\n[bold yellow]可重跑命令:[/bold yellow]")
        console.print(f"  # 1. 聚类训练")
        n_clusters = run['params'].get('n_clusters', 5)
        console.print(f"  scn cluster run {run['snapshot_id']} --n-clusters {n_clusters} --algorithm {run['algorithm']}")
        
        service2 = ResultService(db)
        display = service2.get_results_for_display(run_id)
        edited_clusters = [c for c in display["clusters"] if c["cluster_name_edited"]]
        if edited_clusters:
            console.print(f"\n  # 2. 簇名称人工编辑")
            for c in edited_clusters:
                console.print(f'  scn result edit-name {run_id} {c["cluster_id"]} "{c["cluster_name"]}"')
        
        console.print(f"\n  # 3. 导出结果")
        console.print(f"  scn result export {run_id} ./results_{run_id}.csv")
        
        if run["review_status"] == ReviewStatus.APPROVED.value:
            console.print(f"\n  # 4. 创建特征版本")
            console.print(f"  scn version create {run['snapshot_id']} {run_id}")
        
        console.print("\n[bold]审计记录:[/bold]")
        for a in audit[:20]:
            console.print(f"  [{a['timestamp'].strftime('%H:%M:%S')}] {a['actor']} - {a['action']}")
    
    elif snapshot_id:
        importer = SnapshotImporter(db)
        summary = importer.get_snapshot_summary(snapshot_id)
        if not summary["exists"]:
            console.print(f"[red]快照不存在: {snapshot_id}[/red]")
            sys.exit(1)
        
        engine = ClusteringEngine(db)
        runs = engine.list_runs(snapshot_id=snapshot_id, limit=10)
        
        console.print(Panel.fit(
            f"[bold]快照ID:[/bold] [cyan]{snapshot_id}[/cyan]\n"
            f"[bold]总行数:[/bold] {summary['total_rows']}\n"
            f"[bold]版本数:[/bold] {len(summary['versions'])}\n"
            f"[bold]训练次数:[/bold] {len(runs)}",
            title=f"快照复盘: {snapshot_id}", border_style="magenta"
        ))
        
        console.print("\n[bold yellow]完整流程命令:[/bold yellow]")
        console.print(f"  # 1. 导入快照")
        console.print(f"  scn snapshot import <数据文件.csv> --snapshot-id {snapshot_id}")
        
        for i, run in enumerate(runs, 1):
            console.print(f"\n  # {i+1}. 第{i}次训练")
            n_clusters = run['params'].get('n_clusters', 5)
            console.print(f"  scn cluster run {snapshot_id} --n-clusters {n_clusters}")
            
            if run.get("requires_review"):
                console.print(f"  # 复核")
                console.print(f"  scn review approve {run['run_id']} --reviewer 策略产品")
        
        if runs:
            console.print(f"\n  # 导出与版本")
            console.print(f"  scn result export {runs[0]['run_id']} ./results.csv")
            console.print(f"  scn version create {snapshot_id} {runs[0]['run_id']}")
    
    else:
        console.print("[yellow]请指定 --run-id 或 --snapshot-id[/yellow]")


@cli.command("serve")
@click.option("--host", default="127.0.0.1", help="监听地址")
@click.option("--port", default=8765, type=int, help="监听端口")
@click.option("--db", "db_path", default=None, help="数据库路径")
def serve(host, port, db_path):
    """启动 HTTP 页面和 API 服务"""
    from .api import run_server
    console.print(f"[green]启动语义向量聚类命名服务:[/green] http://{host}:{port}")
    console.print(f"  页面入口: http://{host}:{port}/")
    console.print(f"  API 健康检查: http://{host}:{port}/health")
    console.print(f"  数据库: {db_path or os.environ.get('SCN_DB_PATH', 'semantic_cluster.db')}")
    run_server(host=host, port=port, db_path=db_path)


def main():
    cli()


if __name__ == "__main__":
    main()
