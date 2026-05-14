import json
import os
import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from typing import Optional
from .database import init_db, get_db
from .service import EnvSnapshotService
from .report import ReportGenerator
from .signature import SignatureService

app = typer.Typer(help="环境变量快照命令行工具")
console = Console()


@app.command()
def init():
    """初始化数据库"""
    init_db()
    console.print("[green]✓ 数据库初始化完成[/green]")


@app.command(name="add-supplier")
def add_supplier(
    name: str = typer.Argument(..., help="供应商名称"),
    algorithm: str = typer.Option("SHA256", help="签名算法"),
    contact: str = typer.Option("", help="联系方式"),
    operator: str = typer.Option("system", help="操作者")
):
    """添加单个供应商"""
    db = next(get_db())
    service = EnvSnapshotService(db)
    
    success, result = service.add_supplier(name, algorithm, contact)
    
    if success:
        console.print(f"[green]✓ 供应商 '{name}' 添加成功[/green]")
        console.print(f"  ID: {result['supplier_id']}")
        console.print(f"  算法: {result['algorithm']}")
    else:
        console.print(f"[red]✗ 添加失败: {result['error']}[/red]")


@app.command(name="batch-suppliers")
def batch_add_suppliers(
    file: str = typer.Argument(..., help="JSON文件路径"),
    preview: bool = typer.Option(False, help="仅预览，不执行"),
    operator: str = typer.Option("system", help="操作者")
):
    """批量补录供应商（支持预览）"""
    if not os.path.exists(file):
        console.print(f"[red]✗ 文件不存在: {file}[/red]")
        raise typer.Exit(1)

    with open(file, 'r', encoding='utf-8') as f:
        suppliers_data = json.load(f)

    db = next(get_db())
    service = EnvSnapshotService(db)
    
    result = service.batch_add_suppliers(suppliers_data, operator, preview_only=preview)
    
    mode = "[yellow]预览模式[/yellow]" if preview else "[green]执行模式[/green]"
    console.print(Panel(f"批量补录供应商 - {mode}", expand=False))
    
    table = Table(show_header=True)
    table.add_column("状态")
    table.add_column("供应商")
    table.add_column("算法")
    table.add_column("备注")
    
    for item in result["to_add"]:
        table.add_row("[green]添加[/green]", item["name"], item["algorithm"], "")
    
    for item in result["to_skip"]:
        table.add_row("[yellow]跳过[/yellow]", item["name"], item["existing_algorithm"], item["reason"])
    
    for item in result["algorithm_warnings"]:
        table.add_row("[red]警告[/red]", item["name"], item["algorithm"], item["warning"])
    
    console.print(table)
    console.print(f"总计: {result['total']} | 待添加: {len(result['to_add'])} | 跳过: {len(result['to_skip'])}")
    
    if not preview:
        console.print(f"[green]✓ 批次已创建: {result['batch_id']}[/green]")


@app.command()
def snapshot(
    supplier: str = typer.Argument(..., help="供应商名称"),
    env_file: str = typer.Argument(..., help="环境变量JSON文件"),
    signature: str = typer.Argument(..., help="签名值"),
    algorithm: str = typer.Argument(..., help="使用的签名算法"),
    operator: str = typer.Option("system", help="操作者"),
    batch: Optional[str] = typer.Option(None, help="批次ID")
):
    """创建环境变量快照并验证签名"""
    if not os.path.exists(env_file):
        console.print(f"[red]✗ 文件不存在: {env_file}[/red]")
        raise typer.Exit(1)

    with open(env_file, 'r', encoding='utf-8') as f:
        env_vars = json.load(f)

    db = next(get_db())
    service = EnvSnapshotService(db)
    
    is_valid, result = service.create_snapshot(supplier, env_vars, signature, algorithm, operator, batch)
    
    console.print(Panel(f"快照验证结果 - {result['snapshot_id']}", expand=False))
    
    verify_result = result["verification_result"]
    if verify_result["algorithm_match"]:
        console.print(f"[green]✓ 算法一致: {algorithm}[/green]")
    else:
        console.print(f"[red]✗ 算法不一致: 期望 {verify_result['expected_algorithm']}, 实际 {verify_result['actual_algorithm']}[/red]")
    
    if verify_result["signature_valid"]:
        console.print(f"[green]✓ 签名验证通过[/green]")
    else:
        console.print(f"[red]✗ 签名验证失败[/red]")
    
    if result["error_count"] > 0:
        console.print(f"[yellow]⚠ 检测到 {result['error_count']} 个错误，已记录到错误样本[/yellow]")


@app.command()
def list_suppliers():
    """列出所有供应商"""
    db = next(get_db())
    service = EnvSnapshotService(db)
    
    suppliers = service.get_suppliers()
    
    table = Table(show_header=True)
    table.add_column("ID")
    table.add_column("名称")
    table.add_column("算法")
    table.add_column("联系方式")
    table.add_column("创建时间")
    
    for s in suppliers:
        table.add_row(
            str(s["id"]),
            s["name"],
            s["algorithm"],
            s["contact_info"] or "-",
            s["created_at"][:19]
        )
    
    console.print(Panel("供应商目录", expand=False))
    console.print(table)


@app.command()
def history(
    batch: Optional[str] = typer.Option(None, help="按批次过滤"),
    operator: Optional[str] = typer.Option(None, help="按操作者过滤"),
    risk: Optional[str] = typer.Option(None, help="按风险类型过滤"),
    limit: int = typer.Option(50, help="最大返回数量"),
    format: str = typer.Option("table", help="输出格式: table/json/markdown")
):
    """查询历史快照（支持多维度过滤）"""
    db = next(get_db())
    service = EnvSnapshotService(db)
    
    snapshots = service.query_history(batch, operator, risk, limit)
    
    if format == "json":
        print(json.dumps(snapshots, ensure_ascii=False, indent=2))
    elif format == "markdown":
        report_gen = ReportGenerator(db)
        md = report_gen.generate_markdown({"snapshots": snapshots, "title": "历史快照查询"})
        print(md)
    else:
        table = Table(show_header=True)
        table.add_column("快照ID")
        table.add_column("供应商")
        table.add_column("算法")
        table.add_column("操作者")
        table.add_column("结论")
        table.add_column("错误数")
        table.add_column("重跑标记")
        
        for s in snapshots:
            error_style = "[red]" if s["error_count"] > 0 else ""
            table.add_row(
                s["snapshot_id"],
                s["supplier_name"],
                s["algorithm"],
                s["operator"],
                s["conclusion"],
                f"{error_style}{s['error_count']}[/red]",
                s["rerun_marker"] or "-"
            )
        
        console.print(Panel(f"历史快照 - {len(snapshots)} 条记录", expand=False))
        console.print(table)


@app.command()
def report(
    batch: Optional[str] = typer.Option(None, help="指定批次ID"),
    format: str = typer.Option("markdown", help="输出格式: json/markdown"),
    output: Optional[str] = typer.Option(None, help="输出文件路径"),
    no_evidence: bool = typer.Option(False, help="不包含法务证据页")
):
    """生成完整报告（含法务证据页）"""
    db = next(get_db())
    report_gen = ReportGenerator(db)
    
    data = report_gen.generate_full_report(batch, include_evidence=not no_evidence)
    
    if format == "json":
        content = report_gen.generate_json(data)
    else:
        content = report_gen.generate_markdown(data)
    
    if output:
        saved_path = report_gen.save_report(content, format, output)
        console.print(f"[green]✓ 报告已保存到: {saved_path}[/green]")
    else:
        print(content)


@app.command(name="sign")
def sign_env(
    env_file: str = typer.Argument(..., help="环境变量JSON文件"),
    algorithm: str = typer.Argument(..., help="签名算法"),
    key: Optional[str] = typer.Option(None, help="密钥（HMAC/RSA需要）")
):
    """对环境变量文件进行签名（用于测试）"""
    if not os.path.exists(env_file):
        console.print(f"[red]✗ 文件不存在: {env_file}[/red]")
        raise typer.Exit(1)

    with open(env_file, 'r', encoding='utf-8') as f:
        env_vars = json.load(f)

    signature, alg = SignatureService.sign(env_vars, algorithm, key)
    
    console.print(Panel("签名结果", expand=False))
    console.print(f"算法: {alg}")
    console.print(f"签名: [cyan]{signature}[/cyan]")


def main():
    init_db()
    app()


if __name__ == "__main__":
    main()
