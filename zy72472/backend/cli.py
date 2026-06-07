#!/usr/bin/env python3
import os
import sys
import json
from datetime import datetime

import click

sys.path.insert(0, os.path.dirname(__file__))

from models import (
    load_points, save_points, get_point_by_id,
    load_streets, load_bus_data, build_street_tree,
    detect_street_membership, calculate_score,
    PointRecord, ScoreRecord
)


@click.group()
def cli():
    """儿童友好街区评分 - 命令行工具"""
    pass


@cli.command()
@click.option('--force', is_flag=True, help='强制重新初始化')
def init(force):
    """初始化演示数据"""
    points_file = os.path.join(os.path.dirname(__file__), 'data', 'points.json')
    if os.path.exists(points_file) and not force:
        click.echo("⚠️  数据已存在，使用 --force 强制重新初始化")
        return

    from init_demo import init_demo_data
    init_demo_data()


@cli.command('list')
def list_points():
    """列出所有点位"""
    points = load_points()
    click.echo(f"\n📋 共 {len(points)} 条点位记录\n")
    for p in points:
        boundary_icon = "🟡 边界" if p.is_boundary else "🟢 正常"
        bus_icon = "🚌" if p.bus_swipes_added else "❌"
        status_map = {
            'pending': '待处理',
            'processed': '已处理',
            'bus_added': '已补公交',
            'pending_review': '待复核',
            'completed': '已完成',
            'manually_corrected': '已修正'
        }
        status = status_map.get(p.status, p.status)
        click.echo(f"  [{p.id}] {p.name}")
        click.echo(f"       {boundary_icon} | 公交{bus_icon} | 状态: {status}")
        click.echo(f"       评分: {p.current_score.total} ({p.current_score.level}) | 方法: {p.current_score.method}")
        if p.is_boundary:
            click.echo(f"       涉及街道: {', '.join(p.boundary_streets)}")
        else:
            click.echo(f"       所属街道: {', '.join(p.streets)}")
        click.echo()


@cli.command()
@click.argument('point_id')
def show(point_id):
    """查看点位详情"""
    points = load_points()
    point = get_point_by_id(points, point_id)
    if not point:
        click.echo(f"❌ 点位 {point_id} 不存在")
        return

    click.echo(f"\n📍 {point.name} ({point.id})")
    click.echo(f"   坐标: {point.lng}, {point.lat}")
    click.echo(f"   路口: {point.cross_road}")
    click.echo(f"   边界: {'是' if point.is_boundary else '否'}")
    if point.is_boundary:
        click.echo(f"   涉及街道: {', '.join(point.boundary_streets)}")
    else:
        click.echo(f"   所属街道: {', '.join(point.streets)}")

    click.echo(f"\n📊 当前评分:")
    click.echo(f"   总分: {point.current_score.total} ({point.current_score.level})")
    click.echo(f"   交通安全: {point.current_score.traffic_safety}")
    click.echo(f"   步行设施: {point.current_score.pedestrian_facility}")
    click.echo(f"   公交可达: {point.current_score.bus_access}")
    click.echo(f"   游戏空间: {point.current_score.play_space}")
    click.echo(f"   计算方法: {point.current_score.method}")
    if point.current_score.note:
        click.echo(f"   备注: {point.current_score.note}")

    if point.score_history:
        click.echo(f"\n📜 评分历史 ({len(point.score_history)} 条):")
        for i, h in enumerate(reversed(point.score_history[-5:])):
            click.echo(f"   [{len(point.score_history)-i}] {h.calculated_at[:19]}")
            click.echo(f"       {h.total} ({h.level}) | 方法: {h.method}")
            if h.note:
                click.echo(f"       备注: {h.note}")

    if point.manual_correction:
        click.echo(f"\n✏️  人工修正: {point.manual_correction.get('reason', '')}")

    bus_list = load_bus_data()
    for b in bus_list:
        if b.get('point_id') == point_id:
            click.echo(f"\n🚌 公交数据:")
            click.echo(f"   线路: {b.get('route')} | 站点: {b.get('stop_name')}")
            click.echo(f"   刷卡时段: {', '.join(b.get('swipe_hours', []))}")
            click.echo(f"   高峰儿童数: {b.get('peak_children_count')}")
            click.echo(f"   口径: {'旧' if b.get('old_calculation') else '新'}")
            break

    click.echo()


@cli.command('add-bus')
@click.argument('point_id')
@click.option('--bus-id', help='公交数据ID')
def add_bus(point_id, bus_id):
    """为点位补录公交刷卡时段"""
    points = load_points()
    point = get_point_by_id(points, point_id)
    if not point:
        click.echo(f"❌ 点位 {point_id} 不存在")
        return

    bus_list = load_bus_data()
    bus_data = None
    for b in bus_list:
        if b['id'] == bus_id or b.get('point_id') == point_id:
            bus_data = b
            break

    if not bus_data:
        click.echo(f"❌ 未找到公交数据")
        return

    point.bus_data_id = bus_data['id']
    point.bus_swipes_added = True
    point.status = 'bus_added'

    old_score = ScoreRecord(**point.current_score.__dict__)
    point.score_history.append(old_score)

    point.current_score = calculate_score(point, bus_data)
    point.updated_at = datetime.now().isoformat()

    save_points(points)
    click.echo(f"✅ 已为 {point.name} 补录公交数据")
    click.echo(f"   新评分: {point.current_score.total} ({point.current_score.level})")
    click.echo(f"   方法: {point.current_score.method}")


@cli.command('correct')
@click.argument('point_id')
@click.option('--traffic', type=float, help='交通安全分')
@click.option('--pedestrian', type=float, help='步行设施分')
@click.option('--bus', type=float, help='公交可达分')
@click.option('--play', type=float, help='游戏空间分')
@click.option('--reason', default='人工复核调整', help='修正原因')
def manual_correct(point_id, traffic, pedestrian, bus, play, reason):
    """人工修正评分"""
    points = load_points()
    point = get_point_by_id(points, point_id)
    if not point:
        click.echo(f"❌ 点位 {point_id} 不存在")
        return

    override = {}
    if traffic is not None:
        override['traffic_safety'] = traffic
    if pedestrian is not None:
        override['pedestrian_facility'] = pedestrian
    if bus is not None:
        override['bus_access'] = bus
    if play is not None:
        override['play_space'] = play
    override['reason'] = reason

    if not override:
        click.echo("⚠️  未指定任何修正项")
        return

    bus_list = load_bus_data()
    bus_data = None
    if point.bus_data_id:
        for b in bus_list:
            if b['id'] == point.bus_data_id:
                bus_data = b
                break

    point.manual_correction = override
    old_score = ScoreRecord(**point.current_score.__dict__)
    point.score_history.append(old_score)

    point.current_score = calculate_score(point, bus_data, override)
    point.status = 'manually_corrected'
    point.updated_at = datetime.now().isoformat()

    save_points(points)
    click.echo(f"✅ 已人工修正 {point.name}")
    click.echo(f"   原因: {reason}")
    click.echo(f"   新评分: {point.current_score.total} ({point.current_score.level})")


@cli.command()
@click.argument('point_id')
def rerun(point_id):
    """重跑评分计算"""
    points = load_points()
    point = get_point_by_id(points, point_id)
    if not point:
        click.echo(f"❌ 点位 {point_id} 不存在")
        return

    bus_list = load_bus_data()
    bus_data = None
    if point.bus_data_id:
        for b in bus_list:
            if b['id'] == point.bus_data_id:
                bus_data = b
                break

    manual_override = point.manual_correction

    old_score = ScoreRecord(**point.current_score.__dict__)
    point.score_history.append(old_score)

    point.current_score = calculate_score(point, bus_data, manual_override)
    if point.is_boundary:
        point.status = 'pending_review'
        click.echo(f"⚠️  点位位于街道边界，状态设为待复核")
    else:
        point.status = 'completed'
    point.updated_at = datetime.now().isoformat()

    save_points(points)
    click.echo(f"✅ 已重跑评分: {point.current_score.total} ({point.current_score.level})")


@cli.command()
@click.option('--format', 'fmt', default='geojson', help='导出格式')
@click.option('--output', help='输出文件路径')
def export(fmt, output):
    """导出地图数据"""
    points = load_points()
    features = []
    for p in points:
        feature = {
            'type': 'Feature',
            'geometry': {'type': 'Point', 'coordinates': [p.lng, p.lat]},
            'properties': {
                'id': p.id,
                'name': p.name,
                'is_boundary': p.is_boundary,
                'score_total': p.current_score.total,
                'score_level': p.current_score.level,
                'score_method': p.current_score.method,
                'status': p.status
            }
        }
        features.append(feature)

    geojson = {'type': 'FeatureCollection', 'features': features}

    if output:
        with open(output, 'w', encoding='utf-8') as f:
            json.dump(geojson, f, ensure_ascii=False, indent=2)
        click.echo(f"✅ 已导出到 {output}")
    else:
        click.echo(json.dumps(geojson, ensure_ascii=False, indent=2))


@cli.command()
def demo():
    """运行完整演示流程"""
    click.echo("=" * 60)
    click.echo("🎬 儿童友好街区评分 - 完整流程演示")
    click.echo("=" * 60)
    click.echo()

    click.echo("步骤 1: 初始化演示数据...")
    from init_demo import init_demo_data
    points = init_demo_data()
    click.echo()

    click.echo("步骤 2: 查看点位列表...")
    click.echo("-" * 40)
    points = load_points()
    for p in points:
        boundary_icon = "🟡" if p.is_boundary else "🟢"
        click.echo(f"  {boundary_icon} {p.id}: {p.name}")
    click.echo()

    click.echo("步骤 3: 查看点位详情 - point_002 (边界点位)...")
    click.echo("-" * 40)
    p2 = get_point_by_id(points, 'point_002')
    click.echo(f"  {p2.name}")
    click.echo(f"  边界: {'是 - 涉及: ' + ', '.join(p2.boundary_streets) if p2.is_boundary else '否'}")
    click.echo(f"  状态: 待项目经理复核")
    click.echo()

    click.echo("步骤 4: 为 point_003 补录公交刷卡时段（旧口径）...")
    click.echo("-" * 40)
    p3 = get_point_by_id(points, 'point_003')
    old_score = p3.current_score.total
    click.echo(f"  补录前评分: {old_score}")

    bus_list = load_bus_data()
    bus_data = None
    for b in bus_list:
        if b.get('point_id') == 'point_003':
            bus_data = b
            break

    p3.bus_data_id = bus_data['id']
    p3.bus_swipes_added = True
    p3.status = 'bus_added'
    p3.score_history.append(ScoreRecord(**p3.current_score.__dict__))
    p3.current_score = calculate_score(p3, bus_data)
    p3.updated_at = datetime.now().isoformat()
    save_points(points)

    click.echo(f"  补录后评分: {p3.current_score.total}")
    click.echo(f"  计算方法: {p3.current_score.method}")
    click.echo(f"  备注: {p3.current_score.note}")
    click.echo()

    click.echo("步骤 5: 人工修正 point_002...")
    click.echo("-" * 40)
    p2 = get_point_by_id(load_points(), 'point_002')
    override = {'traffic_safety': 72.0, 'reason': '项目经理复核：边界点位实际归解放路街道'}
    p2.manual_correction = override
    p2.score_history.append(ScoreRecord(**p2.current_score.__dict__))
    p2.current_score = calculate_score(p2, None, override)
    p2.status = 'manually_corrected'
    p2.updated_at = datetime.now().isoformat()
    save_points(load_points())
    click.echo(f"  修正后评分: {p2.current_score.total}")
    click.echo(f"  状态: 已人工修正")
    click.echo()

    click.echo("步骤 6: 重跑 point_001 评分...")
    click.echo("-" * 40)
    points = load_points()
    p1 = get_point_by_id(points, 'point_001')
    p1.score_history.append(ScoreRecord(**p1.current_score.__dict__))
    bus1 = None
    for b in load_bus_data():
        if b['id'] == p1.bus_data_id:
            bus1 = b
            break
    p1.current_score = calculate_score(p1, bus1)
    p1.status = 'completed'
    save_points(points)
    click.echo(f"  重跑后评分: {p1.current_score.total} ({p1.current_score.level})")
    click.echo()

    click.echo("步骤 7: 导出地图数据...")
    click.echo("-" * 40)
    export_path = os.path.join(os.path.dirname(__file__), '..', 'exports', 'demo_export.geojson')
    points = load_points()
    features = []
    for p in points:
        features.append({
            'type': 'Feature',
            'geometry': {'type': 'Point', 'coordinates': [p.lng, p.lat]},
            'properties': {
                'id': p.id, 'name': p.name,
                'is_boundary': p.is_boundary,
                'score': p.current_score.total,
                'level': p.current_score.level
            }
        })
    with open(export_path, 'w', encoding='utf-8') as f:
        json.dump({'type': 'FeatureCollection', 'features': features}, f, ensure_ascii=False, indent=2)
    click.echo(f"  已导出: {export_path}")
    click.echo()

    click.echo("=" * 60)
    click.echo("✅ 演示流程完成！三种处理结果对比：")
    click.echo("=" * 60)
    points = load_points()
    for p in points:
        tag = "顺利" if p.id == 'point_001' else "边界" if p.id == 'point_002' else "旧口径"
        click.echo(f"  [{tag}] {p.name}: {p.current_score.total} ({p.current_score.level}) - {p.current_score.method}")
    click.echo()


if __name__ == '__main__':
    cli()
