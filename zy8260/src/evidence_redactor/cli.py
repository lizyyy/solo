import click
import os
from pathlib import Path
from evidence_redactor.validator import Validator
from evidence_redactor.packager import Packager
from evidence_redactor.exporter import Exporter
from evidence_redactor.models import CaseConfig


@click.group()
@click.version_option(package_name="evidence-redactor")
@click.option("-v", "--verbose", is_flag=True, help="显示详细输出")
@click.pass_context
def cli(ctx, verbose):
    """电子证据材料脱敏打包工具 - 法院书记员专用"""
    ctx.ensure_object(dict)
    ctx.obj["VERBOSE"] = verbose


@cli.command()
@click.option(
    "--manifest",
    "-m",
    type=click.Path(exists=True, file_okay=True),
    required=True,
    help="案件清单文件 (case_manifest.yaml)",
)
@click.option(
    "--evidence-dir",
    "-e",
    type=click.Path(exists=True, file_okay=False),
    required=True,
    help="证据文件目录 (evidence_files/)",
)
@click.option(
    "--participants",
    "-p",
    type=click.Path(exists=True, file_okay=True),
    help="参与人员列表 (participants.csv)",
)
@click.pass_context
def validate(ctx, manifest, evidence_dir, participants):
    """
    校验案件清单与证据文件的一致性

    检查:
    - 清单中列出的文件是否实际存在
    - 是否有未列入清单但存在于目录中的文件
    - 参与者信息完整性
    """
    verbose = ctx.obj["VERBOSE"]

    click.echo("=" * 60)
    click.echo("证据材料一致性校验")
    click.echo("=" * 60)

    config = CaseConfig(
        manifest_path=Path(manifest),
        evidence_dir=Path(evidence_dir),
        participants_path=Path(participants) if participants else None,
    )

    validator = Validator(config, verbose=verbose)
    results = validator.validate()

    click.echo()
    click.echo("校验结果:")
    click.echo(f"  - 通过项目: {results['passed']} 项")
    click.echo(f"  - 警告: {results['warnings']} 项")
    click.echo(f"  - 错误: {results['errors']} 项")

    if results["errors"] > 0:
        click.echo()
        click.secho("❌ 校验发现错误，请检查后重试", fg="red")
        raise click.ClickException("校验失败")

    if results["warnings"] > 0:
        click.echo()
        click.secho("⚠️ 校验发现警告，打包时请留意", fg="yellow")

    click.echo()
    click.secho("✅ 基本校验通过", fg="green")


@cli.command()
@click.option(
    "--manifest",
    "-m",
    type=click.Path(exists=True, file_okay=True),
    required=True,
    help="案件清单文件 (case_manifest.yaml)",
)
@click.option(
    "--evidence-dir",
    "-e",
    type=click.Path(exists=True, file_okay=False),
    required=True,
    help="证据文件目录 (evidence_files/)",
)
@click.option(
    "--participants",
    "-p",
    type=click.Path(exists=True, file_okay=True),
    help="参与人员列表 (participants.csv)",
)
@click.option(
    "--rules",
    "-r",
    type=click.Path(exists=True, file_okay=True),
    required=True,
    help="脱敏规则文件 (redact_rules.yaml)",
)
@click.option(
    "--output",
    "-o",
    type=click.Path(file_okay=False),
    default="./output",
    help="输出目录 (默认: ./output)",
)
@click.pass_context
def pack(ctx, manifest, evidence_dir, participants, rules, output):
    """
    按角色生成脱敏资料包

    为原告、被告、法官分别生成:
    - 各自可见的脱敏证据文件
    - 自动遮盖身份证、手机号、住址、未授权证人姓名
    - 生成 ZIP 压缩包
    """
    verbose = ctx.obj["VERBOSE"]
    output_path = Path(output)

    click.echo("=" * 60)
    click.echo("证据材料脱敏打包")
    click.echo("=" * 60)

    config = CaseConfig(
        manifest_path=Path(manifest),
        evidence_dir=Path(evidence_dir),
        participants_path=Path(participants) if participants else None,
        rules_path=Path(rules),
        output_path=output_path,
    )

    packager = Packager(config, verbose=verbose)
    results = packager.pack()

    click.echo()
    click.echo("打包结果:")
    for role, info in results["packages"].items():
        click.echo(f"  - {role}: {info['file_count']} 个文件 -> {info['path']}")

    click.echo(f"  - 总计替换: {results['total_redactions']} 处敏感信息")

    if results["warnings"]:
        click.echo()
        click.secho(f"⚠️ 运行过程中发现 {len(results['warnings'])} 个警告:", fg="yellow")
        for warning in results["warnings"][:10]:
            click.echo(f"   - {warning}")
        if len(results["warnings"]) > 10:
            click.echo(f"   - ... 还有 {len(results['warnings']) - 10} 个警告")

    click.echo()
    click.secho(f"✅ 打包完成！输出目录: {output_path.absolute()}", fg="green")


@cli.command()
@click.option(
    "--manifest",
    "-m",
    type=click.Path(exists=True, file_okay=True),
    required=True,
    help="案件清单文件 (case_manifest.yaml)",
)
@click.option(
    "--evidence-dir",
    "-e",
    type=click.Path(exists=True, file_okay=False),
    required=True,
    help="证据文件目录 (evidence_files/)",
)
@click.option(
    "--participants",
    "-p",
    type=click.Path(exists=True, file_okay=True),
    help="参与人员列表 (participants.csv)",
)
@click.option(
    "--output",
    "-o",
    type=click.Path(file_okay=False),
    default="./output",
    help="输出目录 (默认: ./output)",
)
@click.option(
    "--pack-results",
    type=click.Path(exists=True, file_okay=True),
    help="打包结果映射文件 (可选)",
)
@click.pass_context
def export(ctx, manifest, evidence_dir, participants, output, pack_results):
    """
    导出报告和日志文件

    生成:
    - 脱敏报告 (PDF/HTML)
    - missing_files.csv - 缺失文件列表
    - redaction_mapping.json - 可复查的映射日志
    """
    verbose = ctx.obj["VERBOSE"]
    output_path = Path(output)

    click.echo("=" * 60)
    click.echo("导出报告和日志")
    click.echo("=" * 60)

    config = CaseConfig(
        manifest_path=Path(manifest),
        evidence_dir=Path(evidence_dir),
        participants_path=Path(participants) if participants else None,
        output_path=output_path,
    )

    exporter = Exporter(config, verbose=verbose)
    results = exporter.export(pack_results_path=Path(pack_results) if pack_results else None)

    click.echo()
    click.echo("导出结果:")
    for name, path in results["files"].items():
        click.echo(f"  - {name}: {path}")

    if results["missing_files"]:
        click.echo()
        click.secho(f"⚠️ 发现 {len(results['missing_files'])} 个缺失文件:", fg="yellow")
        for f in results["missing_files"][:10]:
            click.echo(f"   - {f}")

    click.echo()
    click.secho(f"✅ 导出完成！输出目录: {output_path.absolute()}", fg="green")


@cli.command(name="all")
@click.option(
    "--manifest",
    "-m",
    type=click.Path(exists=True, file_okay=True),
    required=True,
    help="案件清单文件 (case_manifest.yaml)",
)
@click.option(
    "--evidence-dir",
    "-e",
    type=click.Path(exists=True, file_okay=False),
    required=True,
    help="证据文件目录 (evidence_files/)",
)
@click.option(
    "--participants",
    "-p",
    type=click.Path(exists=True, file_okay=True),
    help="参与人员列表 (participants.csv)",
)
@click.option(
    "--rules",
    "-r",
    type=click.Path(exists=True, file_okay=True),
    required=True,
    help="脱敏规则文件 (redact_rules.yaml)",
)
@click.option(
    "--output",
    "-o",
    type=click.Path(file_okay=False),
    default="./output",
    help="输出目录 (默认: ./output)",
)
@click.option(
    "--skip-validate",
    is_flag=True,
    help="跳过一致性校验 (不推荐)",
)
@click.pass_context
def run_all(ctx, manifest, evidence_dir, participants, rules, output, skip_validate):
    """
    一键执行完整流程: 校验 -> 打包 -> 导出

    执行全部三个步骤，生成完整的脱敏资料包和报告。
    """
    verbose = ctx.obj["VERBOSE"]

    if not skip_validate:
        ctx.invoke(validate, manifest=manifest, evidence_dir=evidence_dir, participants=participants)

    ctx.invoke(pack, manifest=manifest, evidence_dir=evidence_dir, 
               participants=participants, rules=rules, output=output)
    
    ctx.invoke(export, manifest=manifest, evidence_dir=evidence_dir,
               participants=participants, output=output)

    click.echo()
    click.echo("=" * 60)
    click.secho("🎉 完整流程执行完毕！", fg="green")
    click.echo("=" * 60)


if __name__ == "__main__":
    cli(obj={})
