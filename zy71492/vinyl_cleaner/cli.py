import click
import os
from pathlib import Path
from .models import DatabaseState, SourceType
from .importer import DataImporter
from .conflict_detector import ConflictDetector
from .reporter import Reporter


@click.group()
@click.version_option(version="0.1.0")
def cli():
    """黑胶清洗养护记录 - 本地CLI工具"""
    pass


@cli.command()
@click.option('--input-dir', '-i', required=True, type=click.Path(exists=True),
              help='输入数据目录')
@click.option('--output-dir', '-o', required=True, type=click.Path(),
              help='输出报告目录')
@click.option('--operator', '-u', default='system', help='操作员名称')
@click.option('--skip-conflicts', is_flag=True, help='跳过冲突检测')
def process(input_dir, output_dir, operator, skip_conflicts):
    """处理输入目录中的所有数据文件，生成报告"""

    db = DatabaseState()
    importer = DataImporter(db)

    click.echo(click.style("开始处理数据...", fg="cyan"))
    click.echo(f"输入目录: {input_dir}")
    click.echo(f"输出目录: {output_dir}")

    input_path = Path(input_dir)
    import_summary = {
        'vinyl_record': 0,
        'customer': 0,
        'cleaning_record': 0,
        'scratch': 0,
        'listening_test': 0
    }

    for source_type in SourceType:
        pattern = f"*{source_type.value}*.json"
        files = list(input_path.glob(pattern))
        pattern_csv = f"*{source_type.value}*.csv"
        files.extend(list(input_path.glob(pattern_csv)))

        for file_path in files:
            try:
                source_id, records = importer.import_file(
                    str(file_path), source_type, operator
                )
                import_summary[source_type.value] += len(records)
                click.echo(f"  ✓ 导入 {file_path.name}: {len(records)} 条记录 (来源ID: {source_id})")
            except Exception as e:
                click.echo(click.style(f"  ✗ 导入失败 {file_path.name}: {str(e)}", fg="red"))

    click.echo("")
    click.echo(click.style("导入完成:", fg="green"))
    for stype, count in import_summary.items():
        click.echo(f"  {stype}: {count} 条")

    if not skip_conflicts:
        click.echo("")
        click.echo(click.style("开始冲突检测...", fg="yellow"))
        detector = ConflictDetector(db)
        conflicts = detector.detect_all()
        click.echo(f"检测到 {len(conflicts)} 个冲突")

    reporter = Reporter(db, output_dir)

    click.echo("")
    reporter.print_terminal_summary()

    click.echo("")
    click.echo(click.style("生成详细报告...", fg="cyan"))

    report_path = reporter.generate_detailed_report()
    click.echo(f"  ✓ 详细报告: {report_path}")

    json_path = reporter.export_json_state()
    click.echo(f"  ✓ 完整数据: {json_path}")

    audit_path = reporter.export_source_audit_trail()
    click.echo(f"  ✓ 来源审计: {audit_path}")

    click.echo("")
    click.echo(click.style("处理完成！", fg="green", bold=True))


@cli.command()
@click.option('--input-dir', '-i', required=True, type=click.Path(exists=True),
              help='输入数据目录')
@click.option('--output-dir', '-o', required=True, type=click.Path(),
              help='输出报告目录')
@click.option('--file', '-f', required=True, help='要导入的文件路径')
@click.option('--type', '-t', required=True,
              type=click.Choice([st.value for st in SourceType]),
              help='数据类型')
@click.option('--operator', '-u', default='system', help='操作员名称')
def import_file(input_dir, output_dir, file, type, operator):
    """导入单个数据文件"""

    db_path = Path(output_dir) / "database_state.json"
    if db_path.exists():
        import json
        with open(db_path, 'r', encoding='utf-8') as f:
            db = DatabaseState.model_validate_json(f.read())
        click.echo(f"加载现有数据库: {db_path}")
    else:
        db = DatabaseState()
        click.echo("创建新数据库")

    importer = DataImporter(db)
    source_type = SourceType(type)

    try:
        source_id, records = importer.import_file(file, source_type, operator)
        click.echo(click.style(f"导入成功: {len(records)} 条记录", fg="green"))
        click.echo(f"来源ID: {source_id}")

        detector = ConflictDetector(db)
        conflicts = detector.detect_all()
        if conflicts:
            click.echo(click.style(f"检测到 {len(conflicts)} 个新冲突", fg="yellow"))

        reporter = Reporter(db, output_dir)
        json_path = reporter.export_json_state()
        click.echo(f"数据库已保存: {json_path}")

    except Exception as e:
        click.echo(click.style(f"导入失败: {str(e)}", fg="red"))
        raise click.Abort()


@cli.command()
@click.argument('conflict_id')
@click.argument('resolution')
@click.option('--output-dir', '-o', required=True, type=click.Path(),
              help='输出报告目录')
def resolve_conflict(conflict_id, resolution, output_dir):
    """标记冲突为已解决"""

    db_path = Path(output_dir) / "database_state.json"
    if not db_path.exists():
        click.echo(click.style(f"数据库不存在: {db_path}", fg="red"))
        raise click.Abort()

    import json
    with open(db_path, 'r', encoding='utf-8') as f:
        db = DatabaseState.model_validate_json(f.read())

    for conflict in db.conflicts:
        if conflict.conflict_id == conflict_id:
            conflict.resolved = True
            conflict.resolution = resolution
            click.echo(click.style(f"冲突 {conflict_id} 已标记为已解决", fg="green"))

            reporter = Reporter(db, output_dir)
            json_path = reporter.export_json_state()
            click.echo(f"数据库已更新: {json_path}")
            return

    click.echo(click.style(f"未找到冲突: {conflict_id}", fg="red"))
    raise click.Abort()


@cli.command()
@click.option('--output-dir', '-o', required=True, type=click.Path(),
              help='输出报告目录')
@click.option('--resolved', is_flag=True, help='显示已解决的冲突')
def list_conflicts(output_dir, resolved):
    """列出所有未解决的冲突"""

    db_path = Path(output_dir) / "database_state.json"
    if not db_path.exists():
        click.echo(click.style(f"数据库不存在: {db_path}", fg="red"))
        raise click.Abort()

    import json
    with open(db_path, 'r', encoding='utf-8') as f:
        db = DatabaseState.model_validate_json(f.read())

    if resolved:
        conflicts = [c for c in db.conflicts if c.resolved]
        click.echo(click.style(f"已解决冲突 ({len(conflicts)}):", fg="green"))
    else:
        conflicts = [c for c in db.conflicts if not c.resolved]
        click.echo(click.style(f"未解决冲突 ({len(conflicts)}):", fg="yellow"))

    for conflict in conflicts:
        click.echo("")
        click.echo(f"  ID: {conflict.conflict_id}")
        click.echo(f"  类型: {conflict.conflict_type.value}")
        click.echo(f"  消息: {conflict.message}")
        click.echo(f"  来源: {', '.join(conflict.source_ids)}")
        if conflict.resolution:
            click.echo(f"  解决方案: {conflict.resolution}")
        else:
            click.echo(f"  下一步: {conflict.details.get('next_step', '待确认')}")


if __name__ == '__main__':
    cli()
