import typer
from rich.console import Console
from rich.table import Table

from db_migration_rehearsal.config import load_config, init_config
from db_migration_rehearsal.importer import import_migrations, import_baseline_schema
from db_migration_rehearsal.sandbox import SandboxExecutor
from db_migration_rehearsal.rules import RuleEngine
from db_migration_rehearsal.exporter import Exporter
from db_migration_rehearsal.schema_diff import SchemaDiffer
from db_migration_rehearsal.sample_data import SampleDataValidator

app = typer.Typer(
    name="db-rehearsal",
    help="数据库迁移彩排工具 - 上线前的迁移脚本安全检查",
    no_args_is_help=True,
)
console = Console()


@app.command()
def init(
    target_dir: str = typer.Option(".", "--dir", "-d", help="目标目录"),
    database_type: str = typer.Option(
        "sqlite", "--db-type", "-t", help="数据库类型: sqlite, postgres"
    ),
):
    """
    初始化项目环境配置。
    
    创建默认配置文件和目录结构。
    """
    console.print("[bold blue]初始化项目配置...[/bold blue]")
    
    config = init_config(target_dir, database_type)
    
    table = Table(title="初始化完成")
    table.add_column("项目", style="cyan")
    table.add_column("值", style="green")
    table.add_row("配置文件", config.config_path)
    table.add_row("迁移目录", config.migrations_dir)
    table.add_row("基线 Schema 目录", config.baseline_schema_dir)
    table.add_row("样本数据目录", config.sample_data_dir)
    table.add_row("输出目录", config.output_dir)
    table.add_row("数据库类型", config.database_type)
    
    console.print(table)
    console.print("\n[bold green]✅ 初始化完成![/bold green]")
    console.print(f"配置文件已保存到: [yellow]{config.config_path}[/yellow]")


@app.command()
def import_migrations_command(
    migrations_path: str = typer.Argument(..., help="迁移脚本目录路径"),
    baseline_schema: str = typer.Option(None, "--baseline", "-b", help="基线 Schema 文件"),
    recursive: bool = typer.Option(False, "--recursive", "-r", help="递归查找迁移文件"),
):
    """
    导入迁移目录和基线 Schema。
    
    将迁移脚本复制到项目目录，并解析版本信息。
    """
    config = load_config()
    
    console.print("[bold blue]导入迁移脚本...[/bold blue]")
    
    migrations = import_migrations(
        source_dir=migrations_path,
        target_dir=config.migrations_dir,
        recursive=recursive,
    )
    
    console.print(f"[green]导入了 {len(migrations)} 个迁移文件[/green]")
    
    if baseline_schema:
        console.print("[bold blue]导入基线 Schema...[/bold blue]")
        schema_info = import_baseline_schema(
            schema_path=baseline_schema,
            target_dir=config.baseline_schema_dir,
        )
        console.print(f"[green]基线 Schema 已导入: {schema_info['name']}[/green]")
    
    table = Table(title="导入摘要")
    table.add_column("迁移版本", style="cyan")
    table.add_column("文件名", style="green")
    table.add_column("类型", style="yellow")
    
    for migration in migrations:
        table.add_row(migration.get("version", "N/A"), migration["filename"], migration["type"])
    
    console.print(table)


@app.command()
def dry_run(
    database_type: str = typer.Option(None, "--db-type", "-t", help="覆盖配置的数据库类型"),
    stop_on_error: bool = typer.Option(True, "--stop-on-error/--no-stop", help="遇到错误时停止"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="显示详细执行日志"),
):
    """
    在临时数据库中按顺序执行迁移并记录差异。
    
    使用沙箱环境执行迁移，比较执行前后的 Schema 差异。
    """
    config = load_config()
    
    if database_type:
        config.database_type = database_type
    
    console.print(f"[bold blue]开始 Dry-Run (使用 {config.database_type})[/bold blue]")
    
    executor = SandboxExecutor(config)
    differ = SchemaDiffer()
    
    console.print("[yellow]创建临时数据库...[/yellow]")
    executor.create_sandbox()
    
    try:
        console.print("[yellow]加载基线 Schema...[/yellow]")
        baseline_schema = executor.load_baseline_schema()
        
        if baseline_schema:
            console.print("[green]基线 Schema 已加载[/green]")
        
        console.print("[yellow]获取执行前 Schema...[/yellow]")
        before_schema = executor.get_current_schema()
        
        console.print("[bold yellow]执行迁移脚本...[/bold yellow]")
        execution_results = executor.execute_all_migrations(
            stop_on_error=stop_on_error,
            verbose=verbose,
        )
        
        console.print("[yellow]获取执行后 Schema...[/yellow]")
        after_schema = executor.get_current_schema()
        
        console.print("[yellow]计算 Schema 差异...[/yellow]")
        schema_diff = differ.compare(before_schema, after_schema)
        
        console.print("[bold green]Dry-Run 完成![/bold green]")
        
        if schema_diff.has_changes:
            diff_table = Table(title="Schema 变更摘要")
            diff_table.add_column("变更类型", style="cyan")
            diff_table.add_column("数量", style="green")
            diff_table.add_row("新增表", str(len(schema_diff.tables_added)))
            diff_table.add_row("删除表", str(len(schema_diff.tables_removed)))
            diff_table.add_row("修改表", str(len(schema_diff.tables_modified)))
            diff_table.add_row("新增列", str(len(schema_diff.columns_added)))
            diff_table.add_row("删除列", str(len(schema_diff.columns_removed)))
            diff_table.add_row("修改列", str(len(schema_diff.columns_modified)))
            diff_table.add_row("新增索引", str(len(schema_diff.indexes_added)))
            diff_table.add_row("删除索引", str(len(schema_diff.indexes_removed)))
            console.print(diff_table)
        
        success_count = sum(1 for r in execution_results if r.get("success"))
        total_count = len(execution_results)
        console.print(f"\n执行结果: [green]{success_count}/{total_count}[/green] 成功")
        
        results = {
            "execution_results": execution_results,
            "schema_diff": schema_diff.to_dict(),
            "before_schema": before_schema,
            "after_schema": after_schema,
        }
        
        executor.save_execution_results(results, config.output_dir)
        console.print(f"执行结果已保存到: [yellow]{config.output_dir}[/yellow]")
        
    finally:
        console.print("[yellow]清理临时数据库...[/yellow]")
        executor.cleanup()


@app.command()
def check(
    rules: str = typer.Option(None, "--rules", "-r", help="指定检查规则 (逗号分隔)"),
    skip_rules: str = typer.Option(None, "--skip", "-s", help="跳过检查规则 (逗号分隔)"),
    fail_on_warning: bool = typer.Option(False, "--fail-on-warning", help="警告也视为失败"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="显示详细检查日志"),
):
    """
    检查危险 DDL、不可逆迁移、外键/索引变化等问题。
    
    问题将记录到 quarantine.json。
    """
    config = load_config()
    
    console.print("[bold blue]开始检查迁移脚本...[/bold blue]")
    
    rule_engine = RuleEngine(config)
    
    enabled_rules = None
    if rules:
        enabled_rules = [r.strip() for r in rules.split(",")]
    
    skipped_rules = None
    if skip_rules:
        skipped_rules = [r.strip() for r in skip_rules.split(",")]
    
    console.print("[yellow]加载并解析迁移脚本...[/yellow]")
    check_results = rule_engine.run_all_checks(
        enabled_rules=enabled_rules,
        skipped_rules=skipped_rules,
        verbose=verbose,
    )
    
    console.print("[bold green]检查完成![/bold green]")
    
    issues = check_results.get("issues", [])
    errors = [i for i in issues if i.get("severity") == "error"]
    warnings = [i for i in issues if i.get("severity") == "warning"]
    
    console.print(f"\n检查结果:")
    console.print(f"  [red]错误: {len(errors)}[/red]")
    console.print(f"  [yellow]警告: {len(warnings)}[/yellow]")
    
    if issues:
        console.print("\n[bold]问题列表:[/bold]")
        issue_table = Table()
        issue_table.add_column("严重程度", style="bold")
        issue_table.add_column("规则", style="cyan")
        issue_table.add_column("迁移文件", style="green")
        issue_table.add_column("描述", style="white")
        
        for issue in issues:
            severity_style = "red" if issue.get("severity") == "error" else "yellow"
            issue_table.add_row(
                f"[{severity_style}]{issue.get('severity', 'unknown')}[/{severity_style}]",
                issue.get("rule", "N/A"),
                issue.get("migration_file", "N/A"),
                issue.get("description", "N/A")[:60] + "...",
            )
        
        console.print(issue_table)
    
    quarantine_path = rule_engine.save_quarantine(check_results, config.output_dir)
    console.print(f"\n问题报告已保存到: [yellow]{quarantine_path}[/yellow]")
    
    if errors or (fail_on_warning and warnings):
        raise typer.Exit(code=1)


@app.command()
def report(
    output_format: str = typer.Option(
        "all", "--format", "-f", help="输出格式: all, markdown, csv, json"
    ),
    output_dir: str = typer.Option(None, "--output", "-o", help="输出目录"),
    include_details: bool = typer.Option(True, "--details/--no-details", help="包含详细信息"),
):
    """
    导出 Markdown 风险报告、CSV 变更清单和 JSON 审计包。
    """
    config = load_config()
    
    if output_dir:
        target_dir = output_dir
    else:
        target_dir = config.output_dir
    
    console.print(f"[bold blue]生成报告...[/bold blue]")
    
    exporter = Exporter(config)
    
    generated_files = []
    
    formats = []
    if output_format == "all":
        formats = ["markdown", "csv", "json"]
    else:
        formats = [output_format]
    
    for fmt in formats:
        if fmt == "markdown":
            console.print("[yellow]生成 Markdown 报告...[/yellow]")
            md_path = exporter.export_markdown(
                output_dir=target_dir,
                include_details=include_details,
            )
            generated_files.append(md_path)
            console.print(f"[green]Markdown 报告: {md_path}[/green]")
        
        elif fmt == "csv":
            console.print("[yellow]生成 CSV 变更清单...[/yellow]")
            csv_paths = exporter.export_csv(
                output_dir=target_dir,
            )
            generated_files.extend(csv_paths)
            for path in csv_paths:
                console.print(f"[green]CSV 文件: {path}[/green]")
        
        elif fmt == "json":
            console.print("[yellow]生成 JSON 审计包...[/yellow]")
            json_path = exporter.export_json(
                output_dir=target_dir,
            )
            generated_files.append(json_path)
            console.print(f"[green]JSON 审计包: {json_path}[/green]")
    
    console.print(f"\n[bold green]✅ 报告生成完成![/bold green]")
    console.print(f"共生成 {len(generated_files)} 个文件")
    
    for f in generated_files:
        console.print(f"  - [cyan]{f}[/cyan]")


@app.command()
def validate_sample_data(
    sample_data_dir: str = typer.Option(None, "--samples", "-s", help="样本数据目录"),
    strict: bool = typer.Option(False, "--strict", help="严格模式，警告也视为错误"),
):
    """
    验证样本数据在迁移后的 Schema 上是否能正常插入。
    """
    config = load_config()
    
    if sample_data_dir:
        config.sample_data_dir = sample_data_dir
    
    console.print("[bold blue]验证样本数据...[/bold blue]")
    
    validator = SampleDataValidator(config)
    
    console.print("[yellow]在沙箱中执行迁移...[/yellow]")
    results = validator.validate_all_samples()
    
    console.print("[bold green]验证完成![/bold green]")
    
    success_count = sum(1 for r in results if r.get("success"))
    total_count = len(results)
    
    console.print(f"\n验证结果: [green]{success_count}/{total_count}[/green] 成功")
    
    has_failures = success_count < total_count
    if has_failures:
        console.print("\n[bold red]失败详情:[/bold red]")
        for r in results:
            if not r.get("success"):
                console.print(f"  [red]✗ {r['sample_file']}: {r.get('error', '未知错误')}[/red]")
    
    if has_failures or (strict and any(r.get("warnings") for r in results)):
        raise typer.Exit(code=1)


@app.command()
def status():
    """
    显示当前项目状态。
    """
    config = load_config()
    
    table = Table(title="项目状态")
    table.add_column("项目", style="cyan")
    table.add_column("值", style="green")
    
    table.add_row("配置文件", config.config_path)
    table.add_row("数据库类型", config.database_type)
    
    from db_migration_rehearsal.importer import MigrationImporter
    importer = MigrationImporter(config)
    migrations = importer.list_migrations()
    table.add_row("迁移文件数量", str(len(migrations)))
    
    import os
    baseline_files = []
    if os.path.exists(config.baseline_schema_dir):
        baseline_files = [f for f in os.listdir(config.baseline_schema_dir) if f.endswith((".sql", ".prisma", ".json"))]
    table.add_row("基线 Schema 文件", str(len(baseline_files)))
    
    sample_files = []
    if os.path.exists(config.sample_data_dir):
        sample_files = [f for f in os.listdir(config.sample_data_dir) if f.endswith((".sql", ".json", ".csv"))]
    table.add_row("样本数据文件", str(len(sample_files)))
    
    console.print(table)


if __name__ == "__main__":
    app()
