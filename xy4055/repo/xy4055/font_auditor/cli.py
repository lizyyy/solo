import sys
from pathlib import Path
from typing import Optional

import click

from .config import Client, ConfigManager, FontLicense, Project
from .version import __version__


def get_config_manager() -> ConfigManager:
    return ConfigManager()


@click.group()
@click.version_option(__version__, "-v", "--version")
@click.pass_context
def main(ctx: click.Context) -> None:
    """字体授权交付巡检员 - 品牌设计交付自动化工具
    
    用于检查设计交付物中的字体授权合规性。
    """
    ctx.ensure_object(dict)
    ctx.obj["config_manager"] = get_config_manager()


@main.command()
@click.option("-f", "--force", is_flag=True, help="强制初始化，覆盖现有配置")
@click.pass_context
def init(ctx: click.Context, force: bool) -> None:
    """初始化字体授权台账
    
    创建 font-auditor.json 配置文件，用于维护字体授权、客户和项目信息。
    """
    config_manager: ConfigManager = ctx.obj["config_manager"]
    
    if config_manager.config_path.exists() and not force:
        click.echo(f"配置文件已存在: {config_manager.config_path}")
        click.echo("使用 --force 选项覆盖现有配置")
        sys.exit(1)
    
    config = config_manager.init_config()
    click.echo(f"配置文件已创建: {config_manager.config_path}")
    click.echo(f"配置版本: {config.version}")


@main.group()
def add() -> None:
    """添加配置项"""
    pass


@add.command("font")
@click.option("--name", required=True, help="字体名称")
@click.option("--hash", "font_hash", help="字体文件哈希值")
@click.option("--license", "license_type", required=True, help="授权类型 (如: 商用授权, 开源, 免费)")
@click.option("--usage", multiple=True, default=["print", "web", "presentation"], help="允许的用途 (可多次指定)")
@click.option("--region", multiple=True, default=["CN", "US", "EU"], help="允许的区域 (可多次指定)")
@click.option("--start-date", help="授权开始日期 (YYYY-MM-DD)")
@click.option("--end-date", help="授权结束日期 (YYYY-MM-DD)")
@click.option("--perpetual", is_flag=True, help="是否永久授权")
@click.option("--notes", help="备注信息")
@click.pass_context
def add_font(
    ctx: click.Context,
    name: str,
    font_hash: Optional[str],
    license_type: str,
    usage: tuple,
    region: tuple,
    start_date: Optional[str],
    end_date: Optional[str],
    perpetual: bool,
    notes: Optional[str],
) -> None:
    """添加字体授权信息"""
    config_manager: ConfigManager = ctx.obj["config_manager"]
    
    font = FontLicense(
        font_name=name,
        font_hash=font_hash,
        license_type=license_type,
        allowed_usage=list(usage),
        allowed_regions=list(region),
        start_date=start_date,
        end_date=end_date,
        is_perpetual=perpetual,
        notes=notes,
    )
    
    try:
        config_manager.add_font(font)
        click.echo(f"字体授权已添加: {name}")
    except FileNotFoundError:
        click.echo("错误: 请先运行 'font-auditor init' 初始化配置")
        sys.exit(1)


@add.command("client")
@click.option("--id", "client_id", required=True, help="客户ID")
@click.option("--name", required=True, help="客户名称")
@click.option("--region", default="CN", help="默认区域")
@click.option("--allow-font", multiple=True, help="允许的字体 (可多次指定)")
@click.option("--deny-font", multiple=True, help="禁止的字体 (可多次指定)")
@click.option("--notes", help="备注信息")
@click.pass_context
def add_client(
    ctx: click.Context,
    client_id: str,
    name: str,
    region: str,
    allow_font: tuple,
    deny_font: tuple,
    notes: Optional[str],
) -> None:
    """添加客户信息"""
    config_manager: ConfigManager = ctx.obj["config_manager"]
    
    client = Client(
        client_id=client_id,
        client_name=name,
        default_region=region,
        allowed_fonts=list(allow_font),
        blacklisted_fonts=list(deny_font),
        notes=notes,
    )
    
    try:
        config_manager.add_client(client)
        click.echo(f"客户已添加: {name} ({client_id})")
    except FileNotFoundError:
        click.echo("错误: 请先运行 'font-auditor init' 初始化配置")
        sys.exit(1)


@add.command("project")
@click.option("--id", "project_id", required=True, help="项目ID")
@click.option("--name", required=True, help="项目名称")
@click.option("--client", required=True, help="所属客户ID")
@click.option("--usage", multiple=True, default=["print"], help="用途类型 (可多次指定)")
@click.option("--region", default="CN", help="项目区域")
@click.option("--start-date", help="项目开始日期")
@click.option("--end-date", help="项目结束日期")
@click.option("--font", multiple=True, help="指定字体 (可多次指定)")
@click.option("--output-dir", multiple=True, help="输出目录 (可多次指定)")
@click.option("--notes", help="备注信息")
@click.pass_context
def add_project(
    ctx: click.Context,
    project_id: str,
    name: str,
    client: str,
    usage: tuple,
    region: str,
    start_date: Optional[str],
    end_date: Optional[str],
    font: tuple,
    output_dir: tuple,
    notes: Optional[str],
) -> None:
    """添加项目信息"""
    config_manager: ConfigManager = ctx.obj["config_manager"]
    
    project = Project(
        project_id=project_id,
        project_name=name,
        client_id=client,
        usage_type=list(usage),
        region=region,
        start_date=start_date,
        end_date=end_date,
        fonts=list(font),
        output_directories=list(output_dir),
        notes=notes,
    )
    
    try:
        config_manager.add_project(project)
        click.echo(f"项目已添加: {name} ({project_id})")
    except FileNotFoundError:
        click.echo("错误: 请先运行 'font-auditor init' 初始化配置")
        sys.exit(1)


@main.command()
@click.argument("directory", type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.option("--output", "-o", type=click.Path(), help="扫描结果输出文件 (JSON)")
@click.option("--project", "-p", help="关联项目ID")
@click.pass_context
def scan(ctx: click.Context, directory: str, output: Optional[str], project: Optional[str]) -> None:
    """扫描素材目录中的字体使用情况
    
    扫描 pptx、svg、html/css、pdf 等文件，抽取字体名、文件来源和使用页面。
    """
    from .scanner import scan_directory, FontUsageResult
    
    dir_path = Path(directory)
    
    click.echo(f"开始扫描目录: {dir_path}")
    
    try:
        results = scan_directory(dir_path)
        
        click.echo(f"扫描完成，发现 {len(results)} 个字体使用项")
        
        if output:
            output_path = Path(output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_path, "w", encoding="utf-8") as f:
                import json
                json.dump([r.model_dump() for r in results], f, indent=2, ensure_ascii=False)
            
            click.echo(f"扫描结果已保存: {output_path}")
        else:
            for result in results:
                click.echo(f"  - {result.font_name} (文件: {result.file_path}, 页面: {result.page or 'N/A'})")
        
    except Exception as e:
        click.echo(f"扫描出错: {e}", err=True)
        sys.exit(1)


@main.command()
@click.argument("scan_result", type=click.Path(exists=True, file_okay=True, dir_okay=False))
@click.option("--project", "-p", help="关联项目ID，用于检查授权范围")
@click.option("--quarantine", "-q", type=click.Path(), default="quarantine.json", help="隔离区文件路径")
@click.option("--output", "-o", type=click.Path(), help="检查结果输出文件")
@click.pass_context
def check(
    ctx: click.Context,
    scan_result: str,
    project: Optional[str],
    quarantine: str,
    output: Optional[str],
) -> None:
    """对照授权规则检查字体合规性
    
    识别未知字体、授权过期、商用范围不符、同名字体不同哈希、缺少替代字体等问题。
    违规项写入隔离区文件。
    """
    config_manager: ConfigManager = ctx.obj["config_manager"]
    
    from .checker import check_font_usage, CheckResult
    from .quarantine import QuarantineManager
    
    click.echo("开始检查字体授权合规性...")
    
    try:
        config = config_manager.load()
        
        with open(scan_result, "r", encoding="utf-8") as f:
            import json
            from .scanner import FontUsageResult
            scan_data = json.load(f)
            font_usages = [FontUsageResult.model_validate(item) for item in scan_data]
        
        project_info = None
        if project:
            project_info = config_manager.get_project(project)
        
        results = check_font_usage(
            font_usages=font_usages,
            config=config,
            project=project_info,
        )
        
        quarantine_mgr = QuarantineManager(Path(quarantine))
        quarantine_mgr.add_violations(results.violations)
        
        click.echo(f"检查完成:")
        click.echo(f"  合规字体: {len(results.compliant)}")
        click.echo(f"  违规字体: {len(results.violations)}")
        click.echo(f"  警告: {len(results.warnings)}")
        
        if len(results.violations) > 0:
            click.echo(f"\n违规详情:")
            for violation in results.violations:
                click.echo(f"  - [{violation.violation_type}] {violation.font_name}: {violation.message}")
        
        if output:
            output_path = Path(output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, "w", encoding="utf-8") as f:
                import json
                json.dump(results.model_dump(), f, indent=2, ensure_ascii=False)
            click.echo(f"\n检查结果已保存: {output_path}")
        
        click.echo(f"\n隔离区文件: {quarantine_mgr.quarantine_path}")
        
    except FileNotFoundError as e:
        click.echo(f"错误: {e}")
        click.echo("请确保配置文件已初始化: font-auditor init")
        sys.exit(1)
    except Exception as e:
        click.echo(f"检查出错: {e}", err=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)


@main.command()
@click.option("--scan-result", "-s", type=click.Path(exists=True), help="扫描结果文件")
@click.option("--check-result", "-c", type=click.Path(exists=True), help="检查结果文件")
@click.option("--quarantine", "-q", type=click.Path(), help="隔离区文件")
@click.option("--output-dir", "-o", type=click.Path(), default="./reports", help="输出目录")
@click.option("--project", "-p", help="关联项目ID")
@click.option("--format", "-f", multiple=True, default=["markdown", "csv", "json"], 
              type=click.Choice(["markdown", "csv", "json"]), 
              help="输出格式 (可多次指定)")
@click.pass_context
def report(
    ctx: click.Context,
    scan_result: Optional[str],
    check_result: Optional[str],
    quarantine: Optional[str],
    output_dir: str,
    project: Optional[str],
    format: tuple,
) -> None:
    """生成巡检报告
    
    导出 Markdown 巡检报告、CSV 字体清单和 JSON 审计包。
    """
    config_manager: ConfigManager = ctx.obj["config_manager"]
    
    from .reporter import Reporter
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    click.echo(f"生成报告到: {output_path}")
    
    try:
        reporter = Reporter(output_dir=output_path)
        
        project_info = None
        if project:
            try:
                project_info = config_manager.get_project(project)
            except FileNotFoundError:
                pass
        
        if scan_result:
            with open(scan_result, "r", encoding="utf-8") as f:
                import json
                from .scanner import FontUsageResult
                scan_data = json.load(f)
                font_usages = [FontUsageResult.model_validate(item) for item in scan_data]
                reporter.set_scan_results(font_usages)
        
        check_data = None
        if check_result:
            with open(check_result, "r", encoding="utf-8") as f:
                import json
                check_data = json.load(f)
                reporter.set_check_results(check_data)
        
        if quarantine:
            from .quarantine import QuarantineManager
            qm = QuarantineManager(Path(quarantine))
            reporter.set_quarantine(qm.quarantine)
        
        if "markdown" in format:
            md_path = reporter.generate_markdown(project=project_info)
            click.echo(f"  - Markdown 报告: {md_path}")
        
        if "csv" in format:
            csv_path = reporter.generate_csv()
            click.echo(f"  - CSV 清单: {csv_path}")
        
        if "json" in format:
            json_path = reporter.generate_json_audit()
            click.echo(f"  - JSON 审计包: {json_path}")
        
        click.echo("\n报告生成完成!")
        
    except Exception as e:
        click.echo(f"生成报告出错: {e}", err=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)


@main.command()
@click.argument("target_dir", type=click.Path())
def demo(target_dir: str) -> None:
    """创建演示数据目录
    
    包含示例配置、测试文件和完整流程验证脚本。
    """
    from .demo import create_demo_directory
    
    target_path = Path(target_dir)
    
    click.echo(f"创建演示目录: {target_path}")
    
    try:
        create_demo_directory(target_path)
        click.echo(f"\n演示数据已创建完成!")
        click.echo(f"\n快速验证流程:")
        click.echo(f"  cd {target_path}")
        click.echo(f"  font-auditor init")
        click.echo(f"  font-auditor scan ./assets -o scan.json")
        click.echo(f"  font-auditor check scan.json -q quarantine.json")
        click.echo(f"  font-auditor report -s scan.json -q quarantine.json -o ./reports")
    except Exception as e:
        click.echo(f"创建演示数据出错: {e}", err=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
