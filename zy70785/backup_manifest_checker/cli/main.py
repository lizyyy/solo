import click
import sys
from pathlib import Path

from ..core.parser import ManifestParser
from ..core.checksum import ChecksumVerifier
from ..core.attribution import MissingAttributor
from ..core.report import FullReport, ReportGenerator


@click.group()
@click.version_option(version="1.0.0", prog_name="bmcheck")
def main():
    """备份 Manifest 校验排查工具"""
    pass


@main.command()
@click.argument("manifest_path", type=click.Path(exists=True, file_okay=True, dir_okay=False))
@click.argument("backup_dir", type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.option("--skip-checksum", "-s", is_flag=True, help="跳过校验和计算，仅检查文件存在性")
@click.option("--output", "-o", type=click.Path(), help="输出报告文件路径")
@click.option("--format", "-f", "output_format", type=click.Choice(["text", "json", "csv"]), default="text", help="输出格式")
@click.option("--verbose", "-v", is_flag=True, help="显示详细信息")
def check(manifest_path, backup_dir, skip_checksum, output, output_format, verbose):
    """执行完整的 manifest 校验流程"""
    manifest_path = Path(manifest_path)
    backup_dir = Path(backup_dir)

    click.echo(f"正在解析 manifest: {manifest_path}")
    parser = ManifestParser(str(manifest_path), str(backup_dir))
    parse_result = parser.parse()

    click.echo(f"  - 解析完成: {len(parse_result.chunks)} 个块, {len(parse_result.errors)} 个错误")

    if parse_result.errors:
        click.secho(f"  警告: 发现 {len(parse_result.errors)} 个解析错误", fg="yellow")

    click.echo(f"正在校验文件和校验和...")
    verifier = ChecksumVerifier(str(backup_dir))
    checksum_report = verifier.verify_all(parse_result.chunks, skip_checksum=skip_checksum)

    click.echo(f"  - 校验完成:")
    click.echo(f"    通过: {checksum_report.passed}")
    click.echo(f"    失败: {checksum_report.failed}")
    click.echo(f"    缺失: {checksum_report.missing}")
    click.echo(f"    跳过: {checksum_report.skipped}")

    click.echo(f"正在进行归因分析...")
    attributor = MissingAttributor(str(backup_dir))
    attribution_report = attributor.analyze_all(checksum_report.results)

    parse_error_attrs = attributor.analyze_parse_errors(parse_result.errors)
    attribution_report.attributions.extend(parse_error_attrs)
    for attr in parse_error_attrs:
        attribution_report.summary[attr.cause.value] += 1

    attributor._analyze_patterns(attribution_report)

    click.echo(f"  - 发现 {len(attribution_report.attributions)} 个问题")

    click.echo(f"正在查找额外文件...")
    extra_files = verifier.find_extra_files(parse_result.chunks)
    click.echo(f"  - 发现 {len(extra_files)} 个不在 manifest 中的文件")

    full_report = FullReport(
        manifest_path=str(manifest_path),
        backup_dir=str(backup_dir),
        parse_result=parse_result,
        checksum_report=checksum_report,
        attribution_report=attribution_report,
        extra_files=[str(f) for f in extra_files]
    )

    generator = ReportGenerator(full_report)

    if output:
        files = generator.save_report(output, format=output_format, verbose=verbose)
        click.echo(f"报告已保存到:")
        for f in files:
            click.echo(f"  {f}")
    else:
        click.echo()
        click.echo(generator.generate_text(verbose=verbose))

    has_errors = (checksum_report.failed > 0 or
                  checksum_report.missing > 0 or
                  len(parse_result.errors) > 0)
    sys.exit(1 if has_errors else 0)


@main.command()
@click.argument("manifest_path", type=click.Path(exists=True, file_okay=True, dir_okay=False))
def parse(manifest_path):
    """仅解析 manifest 文件，不进行校验"""
    parser = ManifestParser(manifest_path)
    result = parser.parse()

    click.echo(f"格式: {result.format.value}")
    click.echo(f"块数: {len(result.chunks)}")
    click.echo(f"错误数: {len(result.errors)}")

    if result.chunks:
        click.echo("\n前5个块:")
        for chunk in result.chunks[:5]:
            click.echo(f"  {chunk.chunk_id}: {chunk.file_path}")

    if result.errors:
        click.echo("\n解析错误:")
        for error in result.errors:
            click.echo(f"  [行 {error.line_number}] {error.error_type}: {error.error_message}")


@main.command()
@click.argument("backup_dir", type=click.Path(exists=True, file_okay=False, dir_okay=True))
def list_files(backup_dir):
    """列出备份目录中的所有文件"""
    verifier = ChecksumVerifier(backup_dir)
    files = verifier.list_all_files()

    click.echo(f"目录中共有 {len(files)} 个文件:")
    for f in files:
        click.echo(f"  {f.relative_to(Path(backup_dir))}")


if __name__ == "__main__":
    main()
