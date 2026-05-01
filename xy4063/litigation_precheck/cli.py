import json
import sys
from pathlib import Path
from typing import Optional

import click

from litigation_precheck.config import ConfigManager, ProjectConfig
from litigation_precheck.scanner import FileScanner, ManifestManager
from litigation_precheck.csv_validator import EvidenceListParser, CSVValidator
from litigation_precheck.rules import RuleEngine, QuarantineManager
from litigation_precheck.packer import Packer
from litigation_precheck.reporter import Reporter


def get_config(ctx: click.Context) -> ProjectConfig:
    config_path = ctx.obj.get("config_path")
    if config_path and Path(config_path).exists():
        return ConfigManager.load_config(Path(config_path))
    return ConfigManager.create_default_config("default")


def find_evidence_csv(materials_dir: Path, config: ProjectConfig) -> Optional[Path]:
    evidence_list_files = list(materials_dir.glob("**/*证据目录*.csv"))
    if evidence_list_files:
        return evidence_list_files[0]
    
    csv_files = list(materials_dir.glob("**/*.csv"))
    for csv_file in csv_files:
        if "证据" in csv_file.name or "list" in csv_file.name.lower():
            return csv_file
    
    return None


@click.group()
@click.option("--config", "-c", type=click.Path(exists=False), help="配置文件路径")
@click.pass_context
def cli(ctx: click.Context, config: Optional[str]):
    """诉讼材料递交包预检器 - 法务助理本地自动化工具
    
    用于开庭前检查诉讼材料包的完整性和规范性。
    """
    ctx.ensure_object(dict)
    if config:
        ctx.obj["config_path"] = Path(config)
    else:
        found_config = ConfigManager.find_config(Path.cwd())
        if found_config:
            ctx.obj["config_path"] = found_config


@cli.command()
@click.argument("project_name")
@click.option("--case-number", "-n", help="案号")
@click.option("--court", "-C", help="法院名称")
@click.option("--output", "-o", type=click.Path(), help="输出配置文件路径")
@click.pass_context
def init(ctx: click.Context, project_name: str, case_number: Optional[str], 
         court: Optional[str], output: Optional[str]):
    """初始化项目配置
    
    创建默认的 litcheck_config.json 配置文件。
    
    PROJECT_NAME: 项目名称
    """
    config = ConfigManager.create_default_config(project_name, case_number, court)
    
    if output:
        config_path = Path(output)
    else:
        config_path = Path.cwd() / ConfigManager.DEFAULT_CONFIG_FILENAME
    
    if config_path.exists():
        click.confirm(f"配置文件 {config_path} 已存在，是否覆盖？", abort=True)
    
    ConfigManager.save_config(config, config_path)
    click.echo(f"✅ 配置文件已创建: {config_path}")
    click.echo(f"   项目名称: {project_name}")
    if case_number:
        click.echo(f"   案号: {case_number}")
    if court:
        click.echo(f"   法院: {court}")


@cli.command()
@click.argument("materials_dir", type=click.Path(exists=True, file_okay=False))
@click.option("--output", "-o", type=click.Path(), help="输出 manifest.json 路径")
@click.option("--recursive/--no-recursive", default=True, help="是否递归扫描子目录")
@click.pass_context
def scan(ctx: click.Context, materials_dir: str, output: Optional[str], recursive: bool):
    """扫描材料目录并生成 manifest
    
    扫描指定目录下的所有诉讼材料文件，生成文件清单 manifest.json。
    
    MATERIALS_DIR: 材料目录路径
    """
    config = get_config(ctx)
    materials_path = Path(materials_dir)
    
    scan_config = config.scan_config.copy()
    scan_config["recursive"] = recursive
    
    scanner = FileScanner(scan_config)
    
    click.echo(f"🔍 正在扫描目录: {materials_path}")
    
    manifest = scanner.scan_directory(materials_path)
    
    if output:
        manifest_path = Path(output)
    else:
        manifest_path = materials_path.parent / config.output_config["manifest_filename"]
    
    ManifestManager.save_manifest(manifest, manifest_path)
    
    click.echo(f"✅ 扫描完成！")
    click.echo(f"   扫描文件数: {manifest.total_files}")
    click.echo(f"   总文件大小: {manifest.total_size} 字节")
    click.echo(f"   输出文件: {manifest_path}")


@cli.command()
@click.argument("materials_dir", type=click.Path(exists=True, file_okay=False))
@click.option("--manifest", "-m", type=click.Path(exists=True), help="已有的 manifest.json 路径")
@click.option("--evidence-csv", "-e", type=click.Path(exists=True), help="证据目录 CSV 路径")
@click.option("--output", "-o", type=click.Path(), help="输出 quarantine.json 路径")
@click.pass_context
def check(ctx: click.Context, materials_dir: str, manifest: Optional[str], 
          evidence_csv: Optional[str], output: Optional[str]):
    """校验材料并生成问题报告
    
    校验证据目录CSV与文件编号、必备材料、签名页标记、重复哈希、
    页数范围和命名规则，问题写入 quarantine.json。
    
    MATERIALS_DIR: 材料目录路径
    """
    config = get_config(ctx)
    materials_path = Path(materials_dir)
    
    if manifest:
        manifest_path = Path(manifest)
        manifest_data = ManifestManager.load_manifest(manifest_path)
        click.echo(f"📋 使用已有的 manifest: {manifest_path}")
    else:
        scan_config = config.scan_config
        scanner = FileScanner(scan_config)
        click.echo(f"🔍 正在扫描目录: {materials_path}")
        manifest_data = scanner.scan_directory(materials_path)
    
    scanned_files = [f.to_dict() for f in manifest_data.files]
    
    csv_validation_result = None
    evidence_list = None
    
    if evidence_csv:
        csv_path = Path(evidence_csv)
    else:
        csv_path = find_evidence_csv(materials_path, config)
    
    if csv_path and csv_path.exists():
        click.echo(f"📊 使用证据目录: {csv_path}")
        
        parser = EvidenceListParser(config.evidence_csv_columns)
        validator = CSVValidator(parser)
        
        csv_validation_result = validator.validate(
            csv_path,
            scanned_files,
            config.check_rules.get("check_evidence_sequence", True)
        )
        evidence_list = csv_validation_result.evidence_list
        
        if not csv_validation_result.is_valid:
            click.echo(f"⚠️  证据目录校验发现问题")
    else:
        click.echo("⚠️  未找到证据目录CSV文件，跳过CSV校验")
    
    rule_engine = RuleEngine({
        "check_rules": config.check_rules,
        "material_types": [mt.model_dump() for mt in config.material_types],
        "naming_rules": [nr.model_dump() for nr in config.naming_rules]
    })
    
    click.echo("🔍 执行规则检查...")
    
    check_result = rule_engine.run_all_checks(
        scanned_files,
        [mt.model_dump() for mt in config.material_types],
        csv_validation_result.to_dict() if csv_validation_result else None
    )
    
    if output:
        quarantine_path = Path(output)
    else:
        quarantine_path = materials_path.parent / config.output_config["quarantine_filename"]
    
    QuarantineManager.save_quarantine(
        check_result,
        quarantine_path,
        manifest_data.to_dict(),
        csv_validation_result.to_dict() if csv_validation_result else None
    )
    
    click.echo("")
    click.echo("=" * 50)
    click.echo("预检结果")
    click.echo("=" * 50)
    
    if check_result.is_valid:
        click.echo("✅ 预检通过！")
    else:
        click.echo("❌ 预检发现问题，需要修复")
    
    click.echo(f"   总问题数: {check_result.total_issues}")
    click.echo(f"   错误数: {check_result.error_count} (必须修复)")
    click.echo(f"   警告数: {check_result.warning_count} (建议检查)")
    click.echo(f"   通过文件: {len(check_result.passed_files)}")
    click.echo(f"   未通过文件: {len(check_result.failed_files)}")
    click.echo("")
    click.echo(f"📄 问题报告已保存: {quarantine_path}")


@cli.command()
@click.argument("materials_dir", type=click.Path(exists=True, file_okay=False))
@click.option("--quarantine", "-q", type=click.Path(exists=True), help="quarantine.json 路径")
@click.option("--manifest", "-m", type=click.Path(exists=True), help="manifest.json 路径")
@click.option("--output-dir", "-o", type=click.Path(), help="输出目录路径")
@click.option("--force", "-f", is_flag=True, help="即使有错误也强制打包")
@click.pass_context
def pack(ctx: click.Context, materials_dir: str, quarantine: Optional[str], 
         manifest: Optional[str], output_dir: Optional[str], force: bool):
    """复制通过项到递交目录并生成提交清单
    
    只复制通过预检的文件到递交目录，并生成提交清单 CSV。
    
    MATERIALS_DIR: 材料目录路径
    """
    config = get_config(ctx)
    materials_path = Path(materials_dir)
    
    quarantine_data = None
    
    if quarantine:
        quarantine_path = Path(quarantine)
        quarantine_data = QuarantineManager.load_quarantine(quarantine_path)
        click.echo(f"📋 使用已有的 quarantine: {quarantine_path}")
    else:
        default_quarantine = materials_path.parent / config.output_config["quarantine_filename"]
        if default_quarantine.exists():
            quarantine_data = QuarantineManager.load_quarantine(default_quarantine)
            click.echo(f"📋 使用已有的 quarantine: {default_quarantine}")
        else:
            click.echo("⚠️  未找到 quarantine.json，请先运行 check 命令")
            sys.exit(1)
    
    check_result = quarantine_data.get("check_result", {})
    is_valid = check_result.get("is_valid", False)
    error_count = check_result.get("error_count", 0)
    
    if not is_valid and error_count > 0 and not force:
        click.echo(f"❌ 存在 {error_count} 个错误，无法打包")
        click.echo("   请先修复问题，或使用 --force 选项强制打包")
        sys.exit(1)
    
    if force and not is_valid:
        click.echo(f"⚠️  强制打包模式（忽略 {error_count} 个错误）")
    
    if output_dir:
        target_base = Path(output_dir)
    else:
        target_base = materials_path.parent
    
    passed_files = check_result.get("passed_files", [])
    
    manifest_data = None
    if manifest:
        manifest_path = Path(manifest)
        manifest_data = ManifestManager.load_manifest(manifest_path)
    else:
        default_manifest = materials_path.parent / config.output_config["manifest_filename"]
        if default_manifest.exists():
            manifest_data = ManifestManager.load_manifest(default_manifest)
    
    all_files = []
    if manifest_data:
        all_files = [f.to_dict() for f in manifest_data.files]
    
    evidence_list = None
    csv_validation = quarantine_data.get("csv_validation")
    if csv_validation:
        evidence_list = csv_validation.get("evidence_list")
    
    packer = Packer(config.output_config)
    
    click.echo(f"📦 正在打包 {len(passed_files)} 个文件...")
    
    pack_result = packer.pack(
        materials_path,
        target_base,
        passed_files,
        all_files,
        evidence_list
    )
    
    click.echo("")
    click.echo("=" * 50)
    click.echo("打包结果")
    click.echo("=" * 50)
    
    if pack_result.is_success:
        click.echo("✅ 打包成功！")
    else:
        click.echo("⚠️  打包部分成功")
        for skipped in pack_result.skipped_files:
            click.echo(f"   - 跳过: {skipped}")
    
    click.echo(f"   打包文件数: {pack_result.total_packed_files}")
    click.echo(f"   总大小: {pack_result.total_size} 字节")
    click.echo(f"   输出目录: {pack_result.packed_dir}")
    click.echo(f"   提交清单: {Path(pack_result.packed_dir) / config.output_config['packed_list_filename']}")


@cli.command()
@click.argument("output_dir", type=click.Path())
@click.option("--quarantine", "-q", type=click.Path(exists=True), help="quarantine.json 路径")
@click.option("--manifest", "-m", type=click.Path(exists=True), help="manifest.json 路径")
@click.option("--format", "-f", type=click.Choice(["md", "csv", "all"]), default="all",
              help="输出格式 (md/csv/all)")
@click.pass_context
def report(ctx: click.Context, output_dir: str, quarantine: Optional[str], 
           manifest: Optional[str], format: str):
    """导出 Markdown 和 CSV 预检报告
    
    基于 quarantine.json 生成预检报告。
    
    OUTPUT_DIR: 输出目录路径
    """
    config = get_config(ctx)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    quarantine_data = None
    
    if quarantine:
        quarantine_path = Path(quarantine)
        quarantine_data = QuarantineManager.load_quarantine(quarantine_path)
    else:
        default_quarantine = Path.cwd() / config.output_config["quarantine_filename"]
        if default_quarantine.exists():
            quarantine_data = QuarantineManager.load_quarantine(default_quarantine)
        else:
            click.echo("⚠️  未找到 quarantine.json，请先运行 check 命令")
            sys.exit(1)
    
    check_result = quarantine_data.get("check_result", {})
    manifest_summary = quarantine_data.get("manifest_summary")
    csv_validation = quarantine_data.get("csv_validation")
    
    manifest_data = None
    if manifest:
        manifest_path = Path(manifest)
        manifest_data = ManifestManager.load_manifest(manifest_path)
    
    project_info = None
    config_path = ctx.obj.get("config_path")
    if config_path and Path(config_path).exists():
        project_config = ConfigManager.load_config(Path(config_path))
        project_info = {
            "project_name": project_config.project_name,
            "case_number": project_config.case_number,
            "court": project_config.court
        }
    
    reporter = Reporter(config.output_config)
    
    generated_files = []
    
    if format in ["md", "all"]:
        md_path = output_path / config.output_config["report_md_filename"]
        reporter.save_markdown_report(
            md_path,
            check_result,
            manifest_data.to_dict() if manifest_data else manifest_summary,
            csv_validation,
            project_info
        )
        generated_files.append(str(md_path))
        click.echo(f"📄 Markdown 报告已生成: {md_path}")
    
    if format in ["csv", "all"]:
        csv_path = output_path / config.output_config["report_csv_filename"]
        reporter.save_csv_report(
            csv_path,
            check_result,
            manifest_data.to_dict() if manifest_data else manifest_summary,
            project_info
        )
        generated_files.append(str(csv_path))
        click.echo(f"📊 CSV 报告已生成: {csv_path}")
    
    click.echo("")
    click.echo("=" * 50)
    click.echo("报告生成完成")
    click.echo("=" * 50)
    
    is_valid = check_result.get("is_valid", False)
    if is_valid:
        click.echo("✅ 预检状态: 通过")
    else:
        click.echo("❌ 预检状态: 存在问题")
    
    click.echo(f"   总问题数: {check_result.get('total_issues', 0)}")
    click.echo(f"   错误数: {check_result.get('error_count', 0)}")
    click.echo(f"   警告数: {check_result.get('warning_count', 0)}")
    click.echo("")
    click.echo("生成的文件:")
    for f in generated_files:
        click.echo(f"   - {f}")


if __name__ == "__main__":
    cli()
