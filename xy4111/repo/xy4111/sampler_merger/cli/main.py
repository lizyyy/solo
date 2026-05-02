import os
import json
import click
from pathlib import Path

from sampler_merger.config import ConfigManager
from sampler_merger.ingest import IngestManager
from sampler_merger.merge import MergeManager
from sampler_merger.check import CheckManager
from sampler_merger.review import ReviewManager
from sampler_merger.export import ExportManager


@click.group()
@click.version_option(version="1.0.0")
def app():
    """离线采样包合并器 - 野外水文调查数据合并工具"""
    pass


@app.command()
@click.option(
    "--output", "-o",
    type=click.Path(),
    default=".",
    help="项目初始化目录 (默认: 当前目录)"
)
@click.option(
    "--timezone", "-t",
    default="UTC",
    help="项目默认时区 (默认: UTC)"
)
@click.option(
    "--coordinate-system", "-c",
    default="WGS84",
    help="项目坐标系 (默认: WGS84, 支持: WGS84, GCJ02, BD09)"
)
def init(output, timezone, coordinate_system):
    """初始化新项目配置"""
    output_path = Path(output).resolve()
    
    # 检查目录是否已存在配置
    config_file = output_path / "sampler_config.json"
    if config_file.exists():
        click.echo(f"错误: 配置文件已存在: {config_file}")
        return
    
    # 创建必要的目录结构
    dirs = [
        output_path / "raw",           # 原始数据
        output_path / "processed",     # 处理后数据
        output_path / "exports",       # 导出结果
        output_path / "reviews",       # 人工裁决记录
    ]
    
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)
    
    # 创建配置文件
    config = {
        "project_name": output_path.name,
        "created_at": None,
        "timezone": timezone,
        "coordinate_system": coordinate_system,
        "ingested_files": [],
        "merged_samples": None,
        "check_results": None,
        "reviews": [],
    }
    
    config_manager = ConfigManager(config_file)
    config_manager.save_config(config)
    
    click.echo(f"✓ 项目已初始化: {output_path}")
    click.echo(f"  配置文件: {config_file}")
    click.echo(f"  时区: {timezone}")
    click.echo(f"  坐标系: {coordinate_system}")


@app.command()
@click.option(
    "--source", "-s",
    type=click.Path(exists=True),
    required=True,
    help="要导入的源文件或目录"
)
@click.option(
    "--type", "-t",
    type=click.Choice(["csv", "gpx", "photos", "manual", "auto"]),
    default="auto",
    help="源文件类型 (默认: auto自动检测)"
)
@click.option(
    "--recursive", "-r",
    is_flag=True,
    help="递归扫描目录"
)
@click.option(
    "--dry-run",
    is_flag=True,
    help="试运行，不实际导入"
)
def ingest(source, type, recursive, dry_run):
    """导入多源文件并保留原件哈希"""
    # 查找配置文件
    config_file = find_config_file()
    if not config_file:
        click.echo("错误: 未找到项目配置文件，请先运行 'init' 命令")
        return
    
    config_manager = ConfigManager(config_file)
    config = config_manager.load_config()
    
    ingest_manager = IngestManager(config, config_file.parent)
    
    source_path = Path(source).resolve()
    
    if dry_run:
        click.echo(f"=== 试运行模式 ===")
    
    # 判断源类型
    if source_path.is_file():
        # 单个文件
        file_type = type if type != "auto" else auto_detect_type(source_path)
        if dry_run:
            click.echo(f"待导入文件: {source_path}")
            click.echo(f"检测类型: {file_type}")
        else:
            result = ingest_manager.ingest_file(source_path, file_type)
            click.echo(f"✓ 已导入: {result['original_name']} -> {result['stored_path']}")
            # 更新配置
            config["ingested_files"].append(result)
            config_manager.save_config(config)
    else:
        # 目录
        files = find_files_to_ingest(source_path, recursive)
        if dry_run:
            click.echo(f"发现 {len(files)} 个文件待导入:")
            for f in files:
                file_type = auto_detect_type(f)
                click.echo(f"  - {f.name} ({file_type})")
        else:
            for f in files:
                file_type = type if type != "auto" else auto_detect_type(f)
                if file_type != "unknown":
                    try:
                        result = ingest_manager.ingest_file(f, file_type)
                        click.echo(f"✓ 已导入: {result['original_name']}")
                        config["ingested_files"].append(result)
                    except Exception as e:
                        click.echo(f"✗ 导入失败 {f.name}: {e}")
            
            config_manager.save_config(config)
    
    if not dry_run:
        click.echo(f"✓ 导入完成，共 {len(config['ingested_files'])} 个文件")


@app.command()
@click.option(
    "--strategy", "-s",
    type=click.Choice(["merge_all", "keep_both", "first_wins", "last_wins"]),
    default="merge_all",
    help="冲突解决策略 (默认: merge_all全部合并)"
)
@click.option(
    "--time-tolerance",
    type=float,
    default=300.0,
    help="时间匹配容差(秒) (默认: 300秒=5分钟)"
)
@click.option(
    "--distance-tolerance",
    type=float,
    default=50.0,
    help="坐标匹配容差(米) (默认: 50米)"
)
def merge(strategy, time_tolerance, distance_tolerance):
    """生成统一样点库"""
    config_file = find_config_file()
    if not config_file:
        click.echo("错误: 未找到项目配置文件")
        return
    
    config_manager = ConfigManager(config_file)
    config = config_manager.load_config()
    
    if not config["ingested_files"]:
        click.echo("警告: 没有已导入的文件，请先运行 'ingest' 命令")
        return
    
    click.echo(f"开始合并，策略: {strategy}")
    click.echo(f"时间容差: {time_tolerance}秒")
    click.echo(f"坐标容差: {distance_tolerance}米")
    
    merge_manager = MergeManager(config, config_file.parent)
    
    # 执行合并
    merge_result = merge_manager.merge(
        strategy=strategy,
        time_tolerance=time_tolerance,
        distance_tolerance=distance_tolerance
    )
    
    # 更新配置
    config["merged_samples"] = merge_result
    config_manager.save_config(config)
    
    click.echo(f"✓ 合并完成")
    click.echo(f"  总样点数: {len(merge_result.get('samples', []))}")
    click.echo(f"  冲突组数: {len(merge_result.get('conflicts', []))}")


@app.command()
@click.option(
    "--output", "-o",
    type=click.Path(),
    help="检查报告输出路径 (默认: 控制台)"
)
@click.option(
    "--format", "-f",
    type=click.Choice(["text", "json", "markdown"]),
    default="text",
    help="报告格式 (默认: text)"
)
def check(output, format):
    """检查冲突、缺附件、异常坐标和时间倒序"""
    config_file = find_config_file()
    if not config_file:
        click.echo("错误: 未找到项目配置文件")
        return
    
    config_manager = ConfigManager(config_file)
    config = config_manager.load_config()
    
    if not config["merged_samples"]:
        click.echo("错误: 请先运行 'merge' 命令生成样点库")
        return
    
    check_manager = CheckManager(config, config_file.parent)
    
    # 执行检查
    check_result = check_manager.run_checks()
    
    # 更新配置
    config["check_results"] = check_result
    config_manager.save_config(config)
    
    # 生成报告
    report = check_manager.generate_report(check_result, format)
    
    if output:
        output_path = Path(output).resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(report, encoding="utf-8")
        click.echo(f"✓ 检查报告已保存: {output_path}")
    else:
        click.echo(report)
    
    # 显示统计
    total_issues = (
        len(check_result.get("id_conflicts", [])) +
        len(check_result.get("missing_attachments", [])) +
        len(check_result.get("coordinate_anomalies", [])) +
        len(check_result.get("time_issues", []))
    )
    click.echo(f"\n总计发现 {total_issues} 个问题")


@app.command()
@click.option(
    "--conflict-id",
    type=str,
    help="指定冲突ID进行裁决 (留空则交互式)"
)
@click.option(
    "--decision",
    type=click.Choice(["keep_first", "keep_last", "keep_both", "custom"]),
    help="裁决方式 (留空则交互式)"
)
@click.option(
    "--note",
    type=str,
    default="",
    help="裁决备注"
)
def review(conflict_id, decision, note):
    """记录人工裁决"""
    config_file = find_config_file()
    if not config_file:
        click.echo("错误: 未找到项目配置文件")
        return
    
    config_manager = ConfigManager(config_file)
    config = config_manager.load_config()
    
    review_manager = ReviewManager(config, config_file.parent)
    
    if not config.get("check_results"):
        click.echo("警告: 没有检查结果，请先运行 'check' 命令")
        click.echo("您仍可以手动添加裁决记录...")
    
    if conflict_id and decision:
        # 非交互模式
        result = review_manager.add_decision(conflict_id, decision, note)
        if result:
            config["reviews"].append(result)
            config_manager.save_config(config)
            click.echo(f"✓ 已记录裁决: {conflict_id} -> {decision}")
        else:
            click.echo(f"✗ 无法记录裁决: 冲突ID {conflict_id} 不存在或已裁决")
    else:
        # 交互式模式
        pending_conflicts = review_manager.get_pending_conflicts()
        
        if not pending_conflicts:
            click.echo("没有待裁决的冲突")
            return
        
        click.echo(f"发现 {len(pending_conflicts)} 个待裁决的冲突:")
        
        for idx, conflict in enumerate(pending_conflicts, 1):
            click.echo(f"\n=== 冲突 #{idx} ===")
            click.echo(f"ID: {conflict['id']}")
            click.echo(f"类型: {conflict['type']}")
            click.echo(f"描述: {conflict['description']}")
            
            # 显示选项
            click.echo("\n请选择裁决方式:")
            click.echo("  1. 保留第一个 (keep_first)")
            click.echo("  2. 保留最后一个 (keep_last)")
            click.echo("  3. 全部保留 (keep_both)")
            click.echo("  4. 自定义处理 (custom)")
            click.echo("  5. 跳过")
            
            choice = click.prompt("请输入选项", type=int, default=5)
            
            decisions_map = {
                1: "keep_first",
                2: "keep_last",
                3: "keep_both",
                4: "custom",
                5: None
            }
            
            chosen_decision = decisions_map.get(choice)
            
            if chosen_decision:
                decision_note = click.prompt("裁决备注 (可选)", default="", show_default=False)
                result = review_manager.add_decision(conflict['id'], chosen_decision, decision_note)
                if result:
                    config["reviews"].append(result)
                    config_manager.save_config(config)
                    click.echo(f"✓ 已记录裁决")


@app.command()
@click.option(
    "--output", "-o",
    type=click.Path(),
    required=True,
    help="输出目录路径"
)
@click.option(
    "--formats", "-f",
    type=click.Choice(["geojson", "csv", "markdown", "all"]),
    default="all",
    help="导出格式 (默认: all)"
)
@click.option(
    "--apply-reviews/--no-apply-reviews",
    default=True,
    help="是否应用已记录的裁决 (默认: 应用)"
)
def export(output, formats, apply_reviews):
    """导出GeoJSON、CSV和Markdown外业交接包"""
    config_file = find_config_file()
    if not config_file:
        click.echo("错误: 未找到项目配置文件")
        return
    
    config_manager = ConfigManager(config_file)
    config = config_manager.load_config()
    
    if not config["merged_samples"]:
        click.echo("错误: 请先运行 'merge' 命令生成样点库")
        return
    
    output_path = Path(output).resolve()
    output_path.mkdir(parents=True, exist_ok=True)
    
    export_manager = ExportManager(config, config_file.parent, output_path)
    
    click.echo(f"开始导出到: {output_path}")
    click.echo(f"格式: {formats}")
    click.echo(f"应用裁决: {'是' if apply_reviews else '否'}")
    
    # 准备导出数据
    export_data = export_manager.prepare_export_data(apply_reviews=apply_reviews)
    
    # 确定要导出的格式
    export_formats = []
    if formats == "all":
        export_formats = ["geojson", "csv", "markdown"]
    else:
        export_formats = [formats]
    
    # 执行导出
    for fmt in export_formats:
        if fmt == "geojson":
            result = export_manager.export_geojson(export_data)
            click.echo(f"✓ GeoJSON: {result}")
        elif fmt == "csv":
            result = export_manager.export_csv(export_data)
            click.echo(f"✓ CSV: {result}")
        elif fmt == "markdown":
            result = export_manager.export_markdown(export_data)
            click.echo(f"✓ Markdown: {result}")
    
    click.echo(f"\n✓ 导出完成! 输出目录: {output_path}")


def find_config_file():
    """查找当前目录及上级目录中的配置文件"""
    current = Path.cwd()
    while True:
        config_file = current / "sampler_config.json"
        if config_file.exists():
            return config_file
        parent = current.parent
        if parent == current:
            break
        current = parent
    return None


def auto_detect_type(file_path: Path) -> str:
    """自动检测文件类型"""
    ext = file_path.suffix.lower()
    
    if ext == ".csv":
        return "csv"
    elif ext == ".gpx":
        return "gpx"
    elif ext in [".jpg", ".jpeg", ".png", ".heic", ".raw"]:
        return "photos"
    elif ext in [".xlsx", ".xls"]:
        return "manual"
    
    # 检查文件名关键字
    name = file_path.name.lower()
    if "photo" in name or "image" in name:
        return "photos"
    if "manual" in name or "hand" in name or "record" in name:
        return "manual"
    
    return "unknown"


def find_files_to_ingest(directory: Path, recursive: bool = False):
    """查找目录中可导入的文件"""
    patterns = ["*.csv", "*.gpx", "*.jpg", "*.jpeg", "*.png", "*.xlsx", "*.xls"]
    
    files = []
    for pattern in patterns:
        if recursive:
            files.extend(directory.rglob(pattern))
        else:
            files.extend(directory.glob(pattern))
    
    return sorted(set(files))


if __name__ == "__main__":
    app()
