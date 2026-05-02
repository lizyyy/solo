"""
命令行入口模块
- 扫描素材目录
- 检测重复和主题分组
- 管理素材状态
- 导出结果
"""

import sys
from pathlib import Path
from typing import Optional, Dict, Any
import click

from .reader import read_materials, MaterialItem
from .clusterer import process_materials, ProcessingResult
from .state_manager import StateManager, MaterialStatus
from .exporter import export_all


CONTEXT_SETTINGS = dict(help_option_names=['-h', '--help'])


@click.group(context_settings=CONTEXT_SETTINGS)
@click.version_option(version='0.1.0', prog_name='content-dedup')
def cli():
    """
    选题素材去重和分组助手
    
    扫描素材文件夹，使用本地 TF-IDF/余弦相似度算法找出重复想法，
    自动分组主题，管理素材状态。
    """
    pass


@cli.command()
@click.argument('source_dir', type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.option('--output-dir', '-o', 
              type=click.Path(file_okay=False, dir_okay=True),
              help='输出目录（默认：源目录下的 .dedup_output）')
@click.option('--similarity-threshold', '-t', 
              type=float, default=0.7,
              help='相似度阈值（0.0-1.0，默认 0.7）')
@click.option('--min-length', '-l', 
              type=int, default=5,
              help='素材最小字符长度（默认 5）')
@click.option('--n-topics', '-n', 
              type=int, default=None,
              help='主题数量（默认自动估计）')
@click.option('--preserve-status/--no-preserve-status', 
              default=True,
              help='保留历史状态（默认 True）')
@click.option('--verbose', '-v', 
              is_flag=True,
              help='显示详细输出')
def scan(
    source_dir: str,
    output_dir: Optional[str],
    similarity_threshold: float,
    min_length: int,
    n_topics: Optional[int],
    preserve_status: bool,
    verbose: bool
):
    """
    扫描素材目录，进行去重和分组
    
    SOURCE_DIR: 素材源目录路径
    """
    source_path = Path(source_dir).resolve()
    
    if output_dir is None:
        output_path = source_path / '.dedup_output'
    else:
        output_path = Path(output_dir).resolve()
    
    click.echo(f"📂 扫描素材目录: {source_path}")
    click.echo(f"📤 输出目录: {output_path}")
    click.echo("")
    
    if verbose:
        click.echo(f"   相似度阈值: {similarity_threshold}")
        click.echo(f"   最小长度: {min_length}")
        if n_topics:
            click.echo(f"   主题数量: {n_topics}")
        else:
            click.echo(f"   主题数量: 自动估计")
        click.echo("")
    
    click.echo("📖 读取素材文件...")
    try:
        materials = read_materials(str(source_path), min_length)
    except Exception as e:
        click.echo(f"❌ 读取素材失败: {e}", err=True)
        sys.exit(1)
    
    if not materials:
        click.echo("⚠️ 没有找到有效的素材")
        sys.exit(0)
    
    click.echo(f"   找到 {len(materials)} 条有效素材")
    click.echo("")
    
    click.echo("🧮 计算相似度和聚类...")
    try:
        result = process_materials(
            materials,
            n_topics=n_topics,
            similarity_threshold=similarity_threshold,
            min_duplicate_size=2
        )
    except Exception as e:
        click.echo(f"❌ 处理失败: {e}", err=True)
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)
    
    click.echo(f"   主题组: {len(result.topic_groups)} 个")
    click.echo(f"   重复簇: {len(result.duplicate_clusters)} 个")
    click.echo(f"   独立素材: {len(result.ungrouped_item_ids)} 条")
    click.echo("")
    
    click.echo("💾 加载状态管理...")
    try:
        state_manager = StateManager(
            output_directory=str(output_path),
            source_directory=str(source_path)
        )
        state_manager.merge_with_current_items(
            materials,
            preserve_existing=preserve_status
        )
    except Exception as e:
        click.echo(f"❌ 状态管理初始化失败: {e}", err=True)
        sys.exit(1)
    
    click.echo("")
    
    click.echo("📊 统计信息:")
    stats = state_manager.get_statistics()
    click.echo(f"   总素材: {stats['total']}")
    click.echo(f"   待写: {stats['by_status']['pending']}")
    click.echo(f"   已用: {stats['by_status']['used']}")
    click.echo(f"   先搁置: {stats['by_status']['shelved']}")
    click.echo(f"   未设置: {stats['by_status']['unset']}")
    click.echo("")
    
    click.echo("📤 导出结果...")
    try:
        exported = export_all(
            processing_result=result,
            state_manager=state_manager,
            output_dir=str(output_path),
            source_dir=str(source_path)
        )
    except Exception as e:
        click.echo(f"❌ 导出失败: {e}", err=True)
        sys.exit(1)
    
    click.echo(f"   Markdown 看板: {exported['markdown']}")
    click.echo(f"   JSON 明细: {exported['json']}")
    click.echo("")
    
    click.echo("✅ 完成！")
    click.echo("")
    click.echo(f"💡 提示: 使用 `content-dedup status` 管理素材状态")


@cli.command()
@click.option('--output-dir', '-o', 
              type=click.Path(exists=True, file_okay=False, dir_okay=True),
              required=True,
              help='输出目录（状态文件存放位置）')
@click.option('--id', 'item_id',
              type=str,
              required=True,
              help='素材 ID')
@click.option('--status', '-s',
              type=click.Choice(['pending', 'used', 'shelved', 'unset', '待写', '已用', '先搁置']),
              required=True,
              help='状态: pending/待写, used/已用, shelved/先搁置, unset/未设置')
@click.option('--notes', '-n',
              type=str,
              default="",
              help='备注信息')
def status(
    output_dir: str,
    item_id: str,
    status: str,
    notes: str
):
    """
    设置素材的状态
    """
    output_path = Path(output_dir).resolve()
    
    state_manager = StateManager(output_directory=str(output_path))
    
    material_status = MaterialStatus.from_string(status)
    
    record = state_manager.set_status(
        item_id=item_id,
        status=material_status,
        notes=notes
    )
    
    click.echo(f"✅ 已更新素材状态:")
    click.echo(f"   ID: {item_id}")
    click.echo(f"   状态: {MaterialStatus.get_display_name(material_status)}")
    if notes:
        click.echo(f"   备注: {notes}")
    click.echo(f"   更新时间: {record.updated_at}")


@cli.command()
@click.option('--output-dir', '-o', 
              type=click.Path(exists=True, file_okay=False, dir_okay=True),
              required=True,
              help='输出目录（状态文件存放位置）')
@click.option('--status', '-s',
              type=click.Choice(['all', 'pending', 'used', 'shelved', 'unset']),
              default='all',
              help='筛选状态（默认 all）')
def list(output_dir: str, status: str):
    """
    列出素材及状态
    """
    output_path = Path(output_dir).resolve()
    
    state_manager = StateManager(output_directory=str(output_path))
    
    stats = state_manager.get_statistics()
    
    click.echo("📊 状态统计:")
    click.echo(f"   总素材: {stats['total']}")
    for status_key, count in stats['by_status'].items():
        display_name = MaterialStatus.get_display_name(MaterialStatus(status_key))
        click.echo(f"   {display_name}: {count}")
    click.echo("")
    
    all_statuses = state_manager.get_all_statuses()
    
    if not all_statuses:
        click.echo("⚠️ 没有找到素材状态记录")
        return
    
    filtered_statuses = []
    if status == 'all':
        filtered_statuses = list(all_statuses.items())
    else:
        target_status = MaterialStatus(status)
        filtered_statuses = [
            (item_id, s) for item_id, s in all_statuses.items()
            if s == target_status
        ]
    
    if not filtered_statuses:
        click.echo(f"⚠️ 没有找到状态为 {MaterialStatus.get_display_name(MaterialStatus(status))} 的素材")
        return
    
    click.echo(f"📋 素材列表 ({len(filtered_statuses)} 条):")
    click.echo("")
    
    for item_id, item_status in filtered_statuses[:50]:
        record = state_manager.get_record(item_id)
        if record:
            display_status = MaterialStatus.get_display_name(item_status)
            click.echo(f"[{display_status}] {item_id}")
            if record.original_text:
                text = record.original_text[:60] + "..." if len(record.original_text) > 60 else record.original_text
                click.echo(f"    \"{text}\"")
            if record.source_file:
                click.echo(f"    来源: {record.source_file}:{record.line_number}")
            if record.notes:
                click.echo(f"    备注: {record.notes}")
            click.echo("")
    
    if len(filtered_statuses) > 50:
        click.echo(f"   ... 还有 {len(filtered_statuses) - 50} 条")


@cli.command()
@click.argument('source_dir', type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.option('--output-dir', '-o', 
              type=click.Path(file_okay=False, dir_okay=True),
              help='输出目录（默认：源目录下的 .dedup_output）')
@click.option('--min-length', '-l', 
              type=int, default=5,
              help='素材最小字符长度（默认 5）')
@click.option('--similarity-threshold', '-t', 
              type=float, default=0.7,
              help='相似度阈值（0.0-1.0，默认 0.7）')
@click.option('--top-n', '-n', 
              type=int, default=10,
              help='显示前 N 对相似素材（默认 10）')
def check_dup(
    source_dir: str,
    output_dir: Optional[str],
    min_length: int,
    similarity_threshold: float,
    top_n: int
):
    """
    检查重复素材（只显示相似对，不导出）
    """
    from .vectorizer import SimilarityCalculator
    
    source_path = Path(source_dir).resolve()
    
    click.echo(f"📂 扫描素材目录: {source_path}")
    click.echo("")
    
    click.echo("📖 读取素材文件...")
    try:
        materials = read_materials(str(source_path), min_length)
    except Exception as e:
        click.echo(f"❌ 读取素材失败: {e}", err=True)
        sys.exit(1)
    
    if not materials:
        click.echo("⚠️ 没有找到有效的素材")
        sys.exit(0)
    
    click.echo(f"   找到 {len(materials)} 条有效素材")
    click.echo("")
    
    if len(materials) < 2:
        click.echo("⚠️ 素材数量不足，无法检测重复")
        sys.exit(0)
    
    click.echo("🧮 计算相似度...")
    calc = SimilarityCalculator()
    similarities = calc.get_pairwise_similarity(
        materials, 
        threshold=similarity_threshold
    )
    
    if not similarities:
        click.echo(f"✅ 没有发现相似度 >= {similarity_threshold} 的素材对")
        sys.exit(0)
    
    click.echo(f"   找到 {len(similarities)} 对相似素材")
    click.echo("")
    
    click.echo(f"📊 最相似的 {min(top_n, len(similarities))} 对:")
    click.echo("")
    
    item_map = {item.id: item for item in materials}
    
    for idx, sim in enumerate(similarities[:top_n]):
        item1 = item_map.get(sim.item1_id)
        item2 = item_map.get(sim.item2_id)
        
        if item1 and item2:
            click.echo(f"=== 第 {idx + 1} 对 (相似度: {sim.similarity:.2%}) ===")
            click.echo("")
            click.echo(f"  素材 1 [{item1.id}]:")
            click.echo(f"    内容: \"{item1.text}\"")
            click.echo(f"    来源: {item1.source_file}:{item1.line_number}")
            click.echo("")
            click.echo(f"  素材 2 [{item2.id}]:")
            click.echo(f"    内容: \"{item2.text}\"")
            click.echo(f"    来源: {item2.source_file}:{item2.line_number}")
            click.echo("")


def main():
    """
    主函数入口
    """
    cli()


if __name__ == '__main__':
    main()
