#!/usr/bin/env python3
"""命令行入口
提供简单直接的命令行接口，方便新人快速上手。
"""

import os
import sys
import click
from pathlib import Path
from pprint import pprint

from audio_spectrum_cluster import (
    AudioClusteringController,
    OperationType,
    __version__
)


def get_controller() -> AudioClusteringController:
    """获取控制器实例"""
    return AudioClusteringController(
        data_dir="./data",
        output_dir="./output"
    )


@click.group()
@click.version_option(version=__version__, prog_name="audio-cluster")
def cli():
    """🎵 音乐音频片段谱聚类系统
    
    按频谱特征自动分组，方便学生比较不同演奏版本。
    
    快速开始:
    \b
      1. 处理音频目录:  audio-cluster process ./audio_files
      2. 查看状态:      audio-cluster status
      3. 列出片段:      audio-cluster list
      4. 导出数据:      audio-cluster export
      5. 启动Web界面:   audio-cluster web
    """
    pass


@cli.command()
@click.argument('directory', type=click.Path(exists=True, file_okay=False))
@click.option('--operation', '-o', default='normal',
              type=click.Choice(['normal', 'supplement', 'duplicate']),
              help='操作类型: normal(正常), supplement(补录), duplicate(重复提交)')
@click.option('--operator', '-u', default='', help='操作人')
@click.option('--description', '-d', default='', help='操作说明')
@click.option('--pattern', '-p', default='*.wav,*.mp3,*.flac,*.ogg',
              help='文件匹配模式')
def process(directory, operation, operator, description, pattern):
    """处理目录下的音频文件并进行聚类
    
    DIRECTORY: 包含音频文件的目录路径
    """
    click.echo(f"🔍 扫描目录: {directory}")
    click.echo(f"📁 文件模式: {pattern}")
    click.echo(f"⚙️  操作类型: {operation}")

    controller = get_controller()
    op_type = OperationType(operation)

    with click.progressbar(length=100, label='处理中') as bar:
        result = controller.process_directory(
            directory=directory,
            file_pattern=pattern,
            operation_type=op_type,
            operator=operator,
            description=description
        )
        bar.update(100)

    click.echo("\n✅ 处理完成!")
    click.echo(f"   新增片段: {result.get('n_new_segments', 0)} 个")
    click.echo(f"   总片段数: {result.get('total_segments', 0)} 个")
    click.echo(f"   聚类数量: {result.get('n_clusters', 0)} 个")

    skipped = result.get('skipped_files', [])
    if skipped:
        click.echo(f"⏭️  跳过文件: {len(skipped)} 个")
        for s in skipped[:5]:
            click.echo(f"   - {s.get('file')}: {s.get('reason')}")

    anomalies = result.get('anomalies', [])
    if anomalies:
        click.echo(f"⚠️  检测到异常: {len(anomalies)} 个")
        for a in anomalies[:5]:
            sev = a.get('severity', 'info')
            sev_color = {'high': 'red', 'medium': 'yellow', 'low': 'green', 'info': 'blue'}
            click.secho(
                f"   [{sev}] {a.get('description')}",
                fg=sev_color.get(sev, 'white')
            )

    if result.get('charts'):
        click.echo(f"📊 图表已生成在 output 目录")


@cli.command("process-file")
@click.argument('files', nargs=-1, type=click.Path(exists=True, dir_okay=False))
@click.option('--operation', '-o', default='normal',
              type=click.Choice(['normal', 'supplement', 'duplicate']),
              help='操作类型')
@click.option('--tags', '-t', default='', help='乐器标签，逗号分隔')
@click.option('--operator', '-u', default='', help='操作人')
@click.option('--description', '-d', default='', help='操作说明')
def process_file(files, operation, tags, operator, description):
    """处理指定的音频文件
    
    FILES: 一个或多个音频文件路径
    """
    if not files:
        click.echo("❌ 请指定至少一个音频文件")
        sys.exit(1)

    click.echo(f"📄 处理文件: {len(files)} 个")
    click.echo(f"⚙️  操作类型: {operation}")

    controller = get_controller()
    op_type = OperationType(operation)

    instrument_tags = {}
    if tags:
        tag_list = [t.strip() for t in tags.split(',') if t.strip()]
        for f in files:
            instrument_tags[f] = tag_list

    result = controller.process_files(
        file_paths=list(files),
        operation_type=op_type,
        instrument_tags=instrument_tags if instrument_tags else None,
        operator=operator,
        description=description
    )

    click.echo("\n✅ 处理完成!")
    click.echo(f"   新增片段: {result.get('n_new_segments', 0)} 个")
    click.echo(f"   总片段数: {result.get('total_segments', 0)} 个")
    click.echo(f"   聚类数量: {result.get('n_clusters', 0)} 个")


@cli.command()
def status():
    """查看当前系统状态"""
    controller = get_controller()
    summary = controller.get_summary()

    click.echo("📊 系统状态")
    click.echo("=" * 50)
    click.echo(f"   音频片段总数: {summary['total_segments']}")
    click.echo(f"   聚类数量:     {summary['n_clusters']}")
    click.echo(f"   报告ID:       {summary.get('report_id', '无')}")

    if summary.get('silhouette_score') is not None:
        click.echo(f"   轮廓系数:     {summary['silhouette_score']:.4f}")

    click.echo(f"   异常数量:     {summary['total_anomalies']}")
    click.echo(f"   采样率:       {', '.join(map(str, summary.get('sample_rates', [])))}")

    if summary.get('tempo_range'):
        t = summary['tempo_range']
        click.echo(f"   节拍范围:     {t['min']:.1f} - {t['max']:.1f} BPM")

    if summary.get('clusters'):
        click.echo("\n📦 聚类详情:")
        for c in summary['clusters']:
            click.echo(f"   - {c['cluster_name']}: {c['size']} 个片段")

    if summary.get('charts'):
        click.echo("\n📈 图表文件:")
        for name, path in summary['charts'].items():
            click.echo(f"   - {name}: {path}")


@cli.command()
@click.option('--cluster', '-c', type=int, help='按聚类筛选')
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
def list(cluster, verbose):
    """列出所有音频片段"""
    controller = get_controller()
    segments = controller.list_segments()

    if cluster is not None:
        segments = [s for s in segments if s.get('cluster_label') == cluster]

    if not segments:
        click.echo("📭 没有音频片段")
        return

    click.echo(f"📋 音频片段列表 ({len(segments)} 个)")
    click.echo("=" * 80)

    for seg in segments:
        cluster_info = ''
        if seg.get('cluster_name'):
            cluster_info = f" [{seg['cluster_name']}]"
            if seg.get('confidence'):
                cluster_info += f" ({seg['confidence']*100:.0f}%)"

        duration = f"{seg['duration']:.2f}s"
        tags = ', '.join(seg.get('instrument_tags', []))

        line = f"  {seg['segment_id']} | {seg['file_name']} | {duration} | {seg['sample_rate']}Hz"
        if tags:
            line += f" | {tags}"
        line += cluster_info

        click.echo(line)

        if verbose and seg['segment_id']:
            try:
                detail = controller.explain_segment(seg['segment_id'])
                if detail.get('features'):
                    f = detail['features']
                    click.echo(f"     节拍: {f['tempo']['description']}")
                    click.echo(f"     音色: {f['spectral_centroid']['interpretation']}")
                    if detail.get('cluster'):
                        click.echo(f"     聚类: {detail['cluster']['cluster_name']} "
                                   f"(置信度 {detail['cluster']['confidence']*100:.1f}%)")
            except Exception:
                pass


@cli.command()
@click.argument('segment_id')
def detail(segment_id):
    """查看指定片段的详细信息
    
    SEGMENT_ID: 片段ID
    """
    controller = get_controller()

    try:
        data = controller.explain_segment(segment_id)
    except ValueError as e:
        click.echo(f"❌ {e}")
        sys.exit(1)

    seg = data['segment']
    click.echo(f"📄 片段详情: {seg['file_name']}")
    click.echo("=" * 50)
    click.echo(f"   片段ID:     {seg['segment_id']}")
    click.echo(f"   文件路径:   {seg['file_path']}")
    click.echo(f"   时长:       {seg['duration']:.2f} 秒")
    click.echo(f"   采样率:     {seg['sample_rate']} Hz")
    click.echo(f"   声道数:     {seg['channels']}")
    click.echo(f"   乐器标签:   {', '.join(seg.get('instrument_tags', [])) or '无'}")
    if seg.get('performance_version'):
        click.echo(f"   演奏版本:   {seg['performance_version']}")
    if seg.get('composer'):
        click.echo(f"   作曲家:     {seg['composer']}")

    if data.get('cluster'):
        c = data['cluster']
        click.echo(f"\n🎯 聚类信息")
        click.echo(f"   所属聚类:   {c['cluster_name']}")
        click.echo(f"   聚类标签:   {c['cluster_label']}")
        click.echo(f"   置信度:     {c['confidence']*100:.1f}%")
        click.echo(f"   到中心距离: {c['distance_to_centroid']:.4f}")

    if data.get('features'):
        f = data['features']
        click.echo(f"\n🎵 频谱特征解释")
        click.echo(f"   节拍:       {f['tempo']['description']}")
        click.echo(f"               → {f['tempo']['interpretation']}")
        click.echo(f"   频谱质心:   {f['spectral_centroid']['description']}")
        click.echo(f"               → {f['spectral_centroid']['interpretation']}")
        click.echo(f"   过零率:     {f['zero_crossing_rate']['description']}")
        click.echo(f"               → {f['zero_crossing_rate']['interpretation']}")
        click.echo(f"   RMS能量:    {f['rms_energy']['description']}")
        click.echo(f"               → {f['rms_energy']['interpretation']}")
        click.echo(f"   音色特性:   {f['timbre']}")

    if data.get('anomalies'):
        click.echo(f"\n⚠️  异常检测 ({len(data['anomalies'])} 个)")
        for a in data['anomalies']:
            sev = a.get('severity', 'info')
            sev_color = {'high': 'red', 'medium': 'yellow', 'low': 'green', 'info': 'blue'}
            click.secho(
                f"   [{sev}] {a.get('anomaly_type')}: {a.get('description')}",
                fg=sev_color.get(sev, 'white')
            )
            if a.get('affected_values'):
                for k, v in a['affected_values'].items():
                    click.echo(f"     - {k}: {v}")

    if data.get('nearest_neighbors'):
        click.echo(f"\n🔍 最相似的片段")
        for n in data['nearest_neighbors']:
            click.echo(f"   - {n['file_name']} (距离: {n['distance']:.4f})")


@cli.command()
@click.argument('segment_id_1')
@click.argument('segment_id_2')
def compare(segment_id_1, segment_id_2):
    """比较两个音频片段
    
    SEGMENT_ID_1: 第一个片段ID
    SEGMENT_ID_2: 第二个片段ID
    """
    controller = get_controller()

    try:
        result = controller.compare_segments(segment_id_1, segment_id_2)
    except ValueError as e:
        click.echo(f"❌ {e}")
        sys.exit(1)

    click.echo("🎼 片段比较")
    click.echo("=" * 50)
    click.echo(f"   片段1:      {segment_id_1}")
    click.echo(f"   片段2:      {segment_id_2}")
    click.echo(f"   同一聚类:   {'是' if result['same_cluster'] else '否'}")
    click.echo(f"   聚类1:      {result['cluster_1']}")
    click.echo(f"   聚类2:      {result['cluster_2']}")
    click.echo(f"   相似度:     {result['similarity_score']*100:.1f}%")
    click.echo(f"\n📊 特征差异:")
    for k, v in result['feature_differences'].items():
        click.echo(f"   - {k}: {v:.4f}")
    click.echo(f"\n💡 解释: {result['interpretation']}")


@cli.command()
@click.argument('segment_ids', nargs=-1)
@click.option('--operator', '-u', default='', help='操作人')
@click.option('--description', '-d', default='', help='撤回原因')
def withdraw(segment_ids, operator, description):
    """撤回指定片段（历史记录保留）
    
    SEGMENT_IDS: 一个或多个片段ID
    """
    if not segment_ids:
        click.echo("❌ 请指定至少一个片段ID")
        sys.exit(1)

    controller = get_controller()

    if not click.confirm(f"确定要撤回 {len(segment_ids)} 个片段吗？历史记录会保留。"):
        return

    result = controller.withdraw_segments(
        segment_ids=list(segment_ids),
        operator=operator,
        description=description or "命令行撤回"
    )

    click.echo(f"✅ 已撤回 {len(result.get('removed_ids', []))} 个片段")
    if result.get('not_found_ids'):
        click.echo(f"⚠️  未找到: {', '.join(result['not_found_ids'])}")
    click.echo(f"   当前总片段数: {result.get('total_segments', 0)}")


@cli.command()
def refresh():
    """重新计算所有聚类和图表"""
    controller = get_controller()

    click.echo("🔄 重新计算聚类...")
    result = controller.refresh_all()

    if result.get('success'):
        click.echo("✅ 刷新完成!")
        click.echo(f"   总片段数: {result.get('total_segments')}")
        click.echo(f"   聚类数量: {result.get('n_clusters')}")
        click.echo(f"   轮廓系数: {result.get('silhouette_score', 0):.4f}")
    else:
        click.echo(f"❌ {result.get('reason', '刷新失败')}")


@cli.command()
def export():
    """导出所有数据到 output 目录"""
    controller = get_controller()

    try:
        files = controller.export_data()
        click.echo("📥 导出完成!")
        click.echo(f"   导出目录: {os.path.abspath('./output')}")
        click.echo("\n   导出文件:")
        for name, path in files.items():
            click.echo(f"   - {name}: {os.path.basename(path)}")
    except ValueError as e:
        click.echo(f"❌ {e}")
        sys.exit(1)


@cli.command()
@click.option('--limit', '-n', default=10, help='显示最近N条记录')
def history(limit):
    """查看操作历史记录"""
    controller = get_controller()
    records = controller.get_history()

    if not records:
        click.echo("📭 没有历史记录")
        return

    click.echo(f"📜 操作历史 (最近 {min(limit, len(records))} 条)")
    click.echo("=" * 80)

    for record in records[-limit:]:
        op_type = record['operation_type']
        op_colors = {
            'normal': 'green',
            'supplement': 'blue',
            'withdraw': 'red',
            'duplicate': 'yellow'
        }
        ts = record['timestamp'].replace('T', ' ')[:19]
        desc = record.get('description', '')
        op = record['operation_type']
        count = len(record.get('segment_ids', []))
        operator = record.get('operator', '')

        line = f"  [{ts}] "
        line += click.style(f"{op_type:<10}", fg=op_colors.get(op, 'white'))
        line += f" {count:>3} 个片段 "
        if operator:
            line += f"by {operator} "
        if desc:
            line += f"- {desc}"
        click.echo(line)


@cli.command()
@click.option('--port', '-p', default=5000, help='端口号')
@click.option('--host', '-h', default='0.0.0.0', help='绑定地址')
@click.option('--debug', is_flag=True, help='调试模式')
def web(port, host, debug):
    """启动Web界面"""
    from audio_spectrum_cluster import create_app

    app = create_app()
    click.echo(f"🌐 启动Web界面: http://{host}:{port}")
    click.echo("   按 Ctrl+C 停止")
    app.run(host=host, port=port, debug=debug)


@cli.command()
def demo():
    """生成演示数据并运行完整流程（需要安装示例音频）"""
    click.echo("🎵 演示模式")
    click.echo("=" * 50)
    click.echo("请准备一些音频文件放在 ./demo_audio 目录下，然后运行:")
    click.echo("")
    click.echo("  # 1. 创建演示目录")
    click.echo("  mkdir -p demo_audio")
    click.echo("")
    click.echo("  # 2. 将音频文件复制到 demo_audio 目录")
    click.echo("  cp /path/to/your/audio/*.wav demo_audio/")
    click.echo("")
    click.echo("  # 3. 处理演示数据")
    click.echo("  audio-cluster process ./demo_audio")
    click.echo("")
    click.echo("  # 4. 查看结果")
    click.echo("  audio-cluster status")
    click.echo("  audio-cluster list")
    click.echo("  audio-cluster export")
    click.echo("")
    click.echo("  # 5. 启动Web界面")
    click.echo("  audio-cluster web")


if __name__ == '__main__':
    cli()
