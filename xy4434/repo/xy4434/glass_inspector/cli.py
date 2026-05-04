"""CLI 命令行入口"""

import os
import sys
from pathlib import Path
from typing import Optional, List
from datetime import datetime

import click

from .config import get_config
from .io.importer import DataImporter, ImportResult
from .analysis.grouping import AnalysisEngine, AnalysisResult
from .storage.repository import DataRepository
from .io.exporter import export_markdown, export_json


@click.group()
@click.version_option(version='0.1.0', prog_name='glass-inspector')
@click.option('--db', 'db_path', help='数据库文件路径', default=None)
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
@click.pass_context
def main(ctx, db_path: Optional[str], verbose: bool):
    """玻璃吹制试样质检助手"""
    ctx.ensure_object(dict)
    ctx.obj['db_path'] = db_path
    ctx.obj['verbose'] = verbose
    ctx.obj['config'] = get_config()


@main.command()
@click.argument('image_dir', type=click.Path(exists=True, file_okay=False))
@click.option('--batch-id', '-b', help='批次ID', default=None)
@click.option('--temperature-csv', '-t', type=click.Path(exists=True), help='窑炉温度 CSV 文件')
@click.option('--notes-file', '-n', type=click.Path(exists=True), help='师傅文字备注文件')
@click.option('--no-save', is_flag=True, help='不保存到数据库，只显示分析结果')
@click.option('--export-md', type=click.Path(), help='导出 Markdown 复盘单路径')
@click.option('--export-json', type=click.Path(), help='导出 JSON 明细路径')
@click.pass_context
def scan(
    ctx,
    image_dir: str,
    batch_id: Optional[str],
    temperature_csv: Optional[str],
    notes_file: Optional[str],
    no_save: bool,
    export_md: Optional[str],
    export_json: Optional[str]
):
    """扫描图片目录并进行分析"""
    verbose = ctx.obj['verbose']
    config = ctx.obj['config']

    click.echo(f"开始扫描批次: {batch_id or Path(image_dir).name}")
    click.echo(f"图片目录: {image_dir}")

    importer = DataImporter(config)

    with click.progressbar(length=100, label='导入数据...') as bar:
        bar.update(10)
        import_result: ImportResult = importer.import_batch(
            image_dir=image_dir,
            batch_id=batch_id,
            temperature_csv=temperature_csv,
            notes_file=notes_file
        )
        bar.update(40)

    if import_result.errors:
        click.echo("\n错误:")
        for error in import_result.errors:
            click.echo(f"  ✗ {error}", err=True)

    if import_result.warnings and verbose:
        click.echo("\n警告:")
        for warning in import_result.warnings:
            click.echo(f"  ⚠ {warning}")

    if not import_result.samples:
        click.echo("\n错误: 没有成功导入任何试样", err=True)
        sys.exit(1)

    click.echo(f"\n成功导入 {len(import_result.samples)} 个试样")

    click.echo("\n开始分析...")
    with click.progressbar(length=100, label='分析中...') as bar:
        bar.update(10)
        engine = AnalysisEngine(config)
        bar.update(20)
        analysis_result: AnalysisResult = engine.analyze(
            import_result.samples,
            batch_id=import_result.batch_id
        )
        bar.update(80)

    display_analysis_summary(analysis_result, verbose)

    repo = None
    if not no_save:
        db_path = ctx.obj['db_path']
        repo = DataRepository(db_path, config)

        click.echo("\n保存到数据库...")
        with click.progressbar(length=100, label='保存中...') as bar:
            repo.save_analysis_result(analysis_result)
            bar.update(100)
        click.echo("✓ 已保存到数据库")

    if export_md or export_json:
        click.echo("\n导出文件...")
        if export_md:
            md_path = export_markdown(
                analysis_result,
                export_md,
                import_result=import_result
            )
            click.echo(f"✓ Markdown 复盘单: {md_path}")

        if export_json:
            json_path = export_json(
                analysis_result,
                export_json,
                import_result=import_result
            )
            click.echo(f"✓ JSON 明细: {json_path}")

    click.echo("\n分析完成!")
    click.echo(f"批次ID: {analysis_result.batch_id}")


def display_analysis_summary(result: AnalysisResult, verbose: bool = False):
    """显示分析摘要"""
    click.echo(f"\n{'='*50}")
    click.echo("分析摘要")
    click.echo('='*50)

    summary = result.summary

    click.echo(f"\n总试样数: {summary.get('total_samples', 0)}")
    click.echo(f"缺陷分组数: {summary.get('total_groups', 0)}")
    click.echo(f"异常检测数: {summary.get('total_anomalies', 0)}")

    bubble_abnormal = summary.get('bubble_abnormal_count', 0)
    bubble_normal = summary.get('bubble_normal_count', 0)
    click.echo(f"\n气泡检测:")
    click.echo(f"  异常: {bubble_abnormal} 个")
    click.echo(f"  正常: {bubble_normal} 个")

    defect_dist = summary.get('defect_distribution', {})
    if defect_dist:
        click.echo(f"\n缺陷分布:")
        for defect_type, count in defect_dist.items():
            click.echo(f"  {defect_type}: {count} 个")

    if verbose:
        click.echo(f"\n缺陷分组详情:")
        for group in result.groups:
            click.echo(f"\n  [{group.group_id}] {group.name}")
            click.echo(f"      试样数: {len(group.sample_ids)}")
            click.echo(f"      相似度: {group.similarity_score:.2f}")
            click.echo(f"      试样: {', '.join(group.sample_ids[:5])}")
            if len(group.sample_ids) > 5:
                click.echo(f"            ... 等共 {len(group.sample_ids)} 个")

        if result.anomalies:
            click.echo(f"\n异常检测详情:")
            for anomaly in result.anomalies:
                click.echo(f"\n  试样 {anomaly.sample_id}:")
                click.echo(f"      类型: {anomaly.anomaly_type}")
                click.echo(f"      严重程度: {anomaly.severity:.2f}")
                click.echo(f"      描述: {anomaly.description}")


@main.command('list')
@click.option('--limit', '-l', type=int, default=10, help='显示数量限制')
@click.pass_context
def list_batches(ctx, limit: int):
    """列出所有批次"""
    db_path = ctx.obj['db_path']
    config = ctx.obj['config']
    verbose = ctx.obj['verbose']

    repo = DataRepository(db_path, config)
    batches = repo.list_batches(limit)

    if not batches:
        click.echo("没有找到任何批次")
        return

    click.echo(f"\n{'='*60}")
    click.echo(f"{'批次ID':<20} {'名称':<20} {'创建时间':<20}")
    click.echo('-'*60)

    for batch in batches:
        created_at = batch.created_at.strftime('%Y-%m-%d %H:%M') if batch.created_at else '-'
        click.echo(f"{batch.batch_id:<20} {batch.name or '-':<20} {created_at:<20}")


@main.command()
@click.argument('batch_id')
@click.option('--export-md', type=click.Path(), help='导出 Markdown 复盘单路径')
@click.option('--export-json', type=click.Path(), help='导出 JSON 明细路径')
@click.pass_context
def show(ctx, batch_id: str, export_md: Optional[str], export_json: Optional[str]):
    """显示批次详情"""
    db_path = ctx.obj['db_path']
    config = ctx.obj['config']
    verbose = ctx.obj['verbose']

    repo = DataRepository(db_path, config)

    batch = repo.get_batch(batch_id)
    if not batch:
        click.echo(f"错误: 找不到批次 {batch_id}", err=True)
        sys.exit(1)

    samples = repo.get_samples_by_batch(batch_id)
    groups = repo.get_groups_by_batch(batch_id)
    anomalies = repo.get_anomalies_by_batch(batch_id)

    click.echo(f"\n{'='*50}")
    click.echo(f"批次详情: {batch_id}")
    click.echo('='*50)

    click.echo(f"\n批次名称: {batch.name or '-'}")
    click.echo(f"创建时间: {batch.created_at.strftime('%Y-%m-%d %H:%M:%S') if batch.created_at else '-'}")
    click.echo(f"试样数量: {len(samples)}")
    click.echo(f"分组数量: {len(groups)}")
    click.echo(f"异常数量: {len(anomalies)}")

    if verbose:
        click.echo(f"\n分组详情:")
        for group in groups:
            sample_count = len([s for s in samples if s.group_id == group.id])
            click.echo(f"\n  [{group.group_id}] {group.name}")
            click.echo(f"      试样数: {sample_count}")
            click.echo(f"      类型: {group.dominant_defect_type}")
            click.echo(f"      {'(手动)' if group.is_manual else '(自动)'}")

        if anomalies:
            click.echo(f"\n异常列表:")
            for anomaly in anomalies:
                status = "已复核" if anomaly.is_reviewed else "待复核"
                click.echo(f"\n  试样 {anomaly.sample_id}:")
                click.echo(f"      类型: {anomaly.anomaly_type}")
                click.echo(f"      严重程度: {anomaly.severity:.2f}")
                click.echo(f"      状态: {status}")

    if export_md or export_json:
        from .io.exporter import export_batch_markdown, export_batch_json

        click.echo("\n导出文件...")
        if export_md:
            md_path = export_batch_markdown(batch_id, export_md, repo)
            click.echo(f"✓ Markdown 复盘单: {md_path}")

        if export_json:
            json_path = export_batch_json(batch_id, export_json, repo)
            click.echo(f"✓ JSON 明细: {json_path}")


@main.command()
@click.argument('sample_id')
@click.argument('new_group_id')
@click.option('--notes', '-n', help='备注信息', default='')
@click.option('--user', '-u', help='操作人', default='user')
@click.pass_context
def reassign(ctx, sample_id: str, new_group_id: str, notes: str, user: str):
    """将试样重新分配到另一个分组"""
    db_path = ctx.obj['db_path']
    config = ctx.obj['config']

    repo = DataRepository(db_path, config)

    sample = repo.get_sample(sample_id)
    if not sample:
        click.echo(f"错误: 找不到试样 {sample_id}", err=True)
        sys.exit(1)

    old_group = repo.get_defect_group(sample.group_id) if sample.group_id else None

    result = repo.update_sample_group(
        sample_id=sample_id,
        new_group_id=new_group_id,
        notes=notes,
        performed_by=user
    )

    if result:
        click.echo(f"✓ 试样 {sample_id} 已重新分配")
        if old_group:
            click.echo(f"  从: {old_group.group_id} ({old_group.name})")
        new_group = repo.get_defect_group(new_group_id)
        if new_group:
            click.echo(f"  到: {new_group.group_id} ({new_group.name})")
    else:
        click.echo(f"错误: 重新分配失败", err=True)
        sys.exit(1)


@main.command()
@click.argument('sample_id')
@click.option('--verified/--not-verified', default=True, help='标记为已确认/未确认')
@click.option('--notes', '-n', help='备注信息', default='')
@click.option('--user', '-u', help='操作人', default='user')
@click.pass_context
def verify(ctx, sample_id: str, verified: bool, notes: str, user: str):
    """确认或取消确认试样"""
    db_path = ctx.obj['db_path']
    config = ctx.obj['config']

    repo = DataRepository(db_path, config)

    sample = repo.get_sample(sample_id)
    if not sample:
        click.echo(f"错误: 找不到试样 {sample_id}", err=True)
        sys.exit(1)

    result = repo.verify_sample(
        sample_id=sample_id,
        verified=verified,
        notes=notes,
        verified_by=user
    )

    if result:
        status = "已确认" if verified else "已取消确认"
        click.echo(f"✓ 试样 {sample_id} {status}")
    else:
        click.echo(f"错误: 操作失败", err=True)
        sys.exit(1)


@main.command()
@click.option('--host', '-H', help='API 服务主机', default=None)
@click.option('--port', '-p', type=int, help='API 服务端口', default=None)
@click.option('--debug', '-d', is_flag=True, help='调试模式')
@click.pass_context
def serve(ctx, host: Optional[str], port: Optional[int], debug: bool):
    """启动本地 API 服务"""
    from .api.server import create_app

    db_path = ctx.obj['db_path']
    config = ctx.obj['config']

    api_config = config.api

    use_host = host or api_config.host
    use_port = port or api_config.port
    use_debug = debug or api_config.debug

    click.echo(f"启动 API 服务...")
    click.echo(f"  主机: {use_host}")
    click.echo(f"  端口: {use_port}")
    click.echo(f"  调试: {'是' if use_debug else '否'}")
    click.echo(f"\n按 Ctrl+C 停止服务")

    app = create_app(db_path, config)
    app.run(
        host=use_host,
        port=use_port,
        debug=use_debug,
        threaded=True
    )


if __name__ == '__main__':
    main()
