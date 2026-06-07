import click
import json
import sys

from .storage import DataStore
from .analyzer import CoverageAnalyzer
from .replay import ThresholdReplayEngine
from .demo import DemoDataGenerator
from .models import RecordStatus


@click.group()
@click.option("--data-dir", default="./data", help="数据存储目录")
@click.pass_context
def cli(ctx, data_dir):
    """召回覆盖率缺口分析工具 - 快速识别少数类样本被总指标盖住的问题"""
    ctx.ensure_object(dict)
    ctx.obj["store"] = DataStore(data_dir)


@cli.command()
@click.argument("json_file", type=click.Path(exists=True))
@click.pass_context
def import_slice(ctx, json_file):
    """导入评测切片数据 (JSON格式)"""
    store = ctx.obj["store"]
    with open(json_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, list):
        for item in data:
            s = store.import_slice(item)
            click.echo(f"✓ 已导入: {s.slice_id} - {s.slice_name}")
    else:
        s = store.import_slice(data)
        click.echo(f"✓ 已导入: {s.slice_id} - {s.slice_name}")


@cli.command()
@click.pass_context
def analyze(ctx):
    """执行召回覆盖率缺口分析"""
    store = ctx.obj["store"]
    slices = store.list_slices()

    if not slices:
        click.echo("⚠️  没有找到评测切片数据，请先 import")
        return

    analyzer = CoverageAnalyzer()
    records = analyzer.analyze(slices)

    for gap in records:
        existing = store.get_gap_record(gap.record_id)
        if not existing:
            store.save_gap_record(gap)

    report = analyzer.generate_report(records, slices)
    click.echo(report["report_text"])


@cli.command(name="list")
@click.pass_context
def list_records(ctx):
    """列出所有评测切片和缺口记录"""
    store = ctx.obj["store"]
    slices = store.list_slices()
    gaps = store.list_gap_records()

    click.echo("=" * 70)
    click.echo("评测切片列表:")
    click.echo("-" * 70)
    for s in slices:
        snapshot = s.feature_snapshot_id or "未关联"
        click.echo(f"  {s.slice_id:10s} | {s.slice_name:30s} | 召回: {s.recall:6.2%} | 快照: {snapshot}")

    if gaps:
        click.echo("\n缺口记录:")
        click.echo("-" * 70)
        gap_map = {g.slice_id: g for g in gaps}
        for s in slices:
            g = gap_map.get(s.slice_id)
            if g:
                click.echo(f"  {g.record_id:12s} | {s.slice_name:30s} | 状态: {g.status.value:15s} | 缺口: {g.recall_gap:6.2%}")


@cli.command()
@click.argument("slice_id")
@click.argument("snapshot_id")
@click.pass_context
def snapshot(ctx, slice_id, snapshot_id):
    """补录特征快照编号: snapshot <slice_id> <snapshot_id>"""
    store = ctx.obj["store"]

    s = store.get_slice(slice_id)
    if not s:
        click.echo(f"❌ 切片 {slice_id} 不存在")
        return

    snap = store.get_feature_snapshot(snapshot_id)
    if not snap:
        click.echo(f"⚠️  快照 {snapshot_id} 未在库中找到，仍将关联")

    updated = store.update_slice_feature_snapshot(slice_id, snapshot_id)
    if updated:
        click.echo(f"✓ 已将 {slice_id} 关联到特征快照 {snapshot_id}")


@cli.command()
@click.argument("slice_id")
@click.argument("snapshot_id")
@click.option("--old-caliber", is_flag=True, help="是否为旧口径补录")
@click.pass_context
def replay(ctx, slice_id, snapshot_id, old_caliber):
    """执行阈值回放: replay <slice_id> <snapshot_id> [--old-caliber]"""
    store = ctx.obj["store"]
    engine = ThresholdReplayEngine(store)

    result = engine.replay_with_snapshot(
        slice_id, snapshot_id,
        is_old_caliber=old_caliber,
        note="命令行手动回放"
    )

    if not result:
        click.echo("❌ 回放失败，请检查 slice_id 和 snapshot_id 是否正确")
        return

    click.echo("=" * 70)
    click.echo("阈值回放结果:")
    click.echo("-" * 70)
    click.echo(f"  切片: {slice_id}")
    click.echo(f"  快照: {snapshot_id}")
    click.echo(f"  原召回率: {result.original_recall:.2%}")
    click.echo(f"  回放后: {result.replayed_recall:.2%}")
    change = "↑" if result.recall_change > 0 else "↓"
    click.echo(f"  变化: {change} {abs(result.recall_change):.2%}")
    if old_caliber:
        click.echo(f"  类型: 旧口径补录")
    click.echo("=" * 70)


@cli.command()
@click.argument("record_id")
@click.argument("status", type=click.Choice(["normal", "need_review", "fixed", "old_caliber"]))
@click.option("--note", help="状态变更备注")
@click.pass_context
def mark(ctx, record_id, status, note):
    """标记缺口记录状态: mark <record_id> <status> [--note]"""
    store = ctx.obj["store"]
    status_enum = RecordStatus(status)
    try:
        store.update_gap_status(record_id, status_enum, note)
        click.echo(f"✓ 已将 {record_id} 标记为 {status}")
    except ValueError as e:
        click.echo(f"❌ {e}")


@cli.command()
@click.pass_context
def demo(ctx):
    """运行完整演示流程（包含三种典型场景）"""
    store = ctx.obj["store"]
    generator = DemoDataGenerator(store)
    generator.run_full_demo()


@cli.command()
@click.argument("snapshot_file", type=click.Path(exists=True))
@click.pass_context
def load_snapshot(ctx, snapshot_file):
    """加载特征快照配置 (JSON格式)"""
    store = ctx.obj["store"]
    from .models import FeatureSnapshot
    import uuid as _uuid

    with open(snapshot_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, list):
        for item in data:
            snap = FeatureSnapshot(
                snapshot_id=item.get("snapshot_id", f"FS-{_uuid.uuid4().hex[:8]}"),
                snapshot_name=item["snapshot_name"],
                threshold_config=item["threshold_config"],
                recall_target=item.get("recall_target", 0.9),
                note=item.get("note")
            )
            store.save_feature_snapshot(snap)
            click.echo(f"✓ 已加载快照: {snap.snapshot_id} - {snap.snapshot_name}")


@cli.command()
@click.pass_context
def snapshots(ctx):
    """列出所有特征快照"""
    store = ctx.obj["store"]
    snaps = store.list_feature_snapshots()

    click.echo("=" * 70)
    click.echo("特征快照列表:")
    click.echo("-" * 70)
    for s in snaps:
        click.echo(f"  {s.snapshot_id:15s} | {s.snapshot_name:30s} | 目标召回: {s.recall_target:.2%}")
        if s.note:
            click.echo(f"                   备注: {s.note}")


def main():
    cli()


if __name__ == "__main__":
    main()
