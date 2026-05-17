#!/usr/bin/env python3
"""
衣物分拣消毒转赠追踪排查CLI
主命令行入口
"""

import sys
import click
from datetime import datetime
from models import (
    DonationBatch, ClothingItem, Organization,
    ClothingCategory, ClothingStatus, DisinfectMethod, EliminateReason
)
from tracker import DataStore, ClothingTracker
from report import ReportExporter


store = DataStore()
tracker = ClothingTracker(store)
exporter = ReportExporter(tracker)


@click.group()
@click.version_option(version="1.0.0", prog_name="clothing-tracker")
def cli():
    """
    衣物分拣消毒转赠追踪排查CLI
    
    用于管理公益衣物回收的分拣、消毒、转赠全流程追踪。
    支持批次管理、状态追踪、报告导出、数据验证。
    """
    pass


@cli.group()
def batch():
    """捐赠批次管理"""
    pass


@batch.command(name="add")
@click.option("--donor", required=True, help="捐赠人姓名")
@click.option("--contact", required=True, help="联系方式")
@click.option("--date", help="接收日期 (YYYY-MM-DD)")
@click.option("--count", type=int, required=True, help="申报衣物数量")
@click.option("--desc", default="", help="批次描述")
def batch_add(donor, contact, date, count, desc):
    """添加新捐赠批次"""
    if not date:
        date = datetime.now().strftime("%Y-%m-%d")
    
    batch = DonationBatch(
        batch_id="",
        donor_name=donor,
        donor_contact=contact,
        receive_date=date,
        total_count=count,
        description=desc
    )
    
    store.add_batch(batch)
    click.echo(f"✓ 批次创建成功: {batch.batch_id}")
    click.echo(f"  捐赠人: {donor}")
    click.echo(f"  申报数量: {count}件")


@batch.command(name="list")
def batch_list():
    """列出所有捐赠批次"""
    batches = store.list_batches()
    if not batches:
        click.echo("(无批次记录)")
        return
    
    click.echo(f"{'批次ID':<20} {'捐赠人':<15} {'接收日期':<12} {'申报数量':<8} {'已入库':<8}")
    click.echo("-" * 70)
    for b in batches:
        click.echo(f"{b['batch_id']:<20} {b['donor_name']:<15} {b['receive_date']:<12} {b['total_count']:<8} {b['received_count']:<8}")


@batch.command(name="show")
@click.argument("batch_id")
def batch_show(batch_id):
    """查看批次详情"""
    batch = store.get_batch(batch_id)
    if not batch:
        click.echo(f"✗ 批次不存在: {batch_id}")
        return
    
    click.echo(f"批次ID: {batch['batch_id']}")
    click.echo(f"捐赠人: {batch['donor_name']}")
    click.echo(f"联系方式: {batch['donor_contact']}")
    click.echo(f"接收日期: {batch['receive_date']}")
    click.echo(f"申报数量: {batch['total_count']}件")
    click.echo(f"已入库: {batch['received_count']}件")
    click.echo(f"描述: {batch['description']}")
    
    items = store.list_items(batch_id=batch_id)
    click.echo(f"\n衣物数量: {len(items)}件")
    if items:
        for item in items:
            click.echo(f"  - {item['item_id']}: {item['category']} [{item['status']}]")


@cli.group()
def item():
    """衣物管理"""
    pass


@item.command(name="add")
@click.option("--batch-id", required=True, help="所属批次ID")
@click.option("--category", required=True, type=click.Choice([c.value for c in ClothingCategory]),
              help="衣物分类")
@click.option("--desc", default="", help="衣物描述")
@click.option("--brand", default="", help="品牌")
@click.option("--size", default="", help="尺码")
@click.option("--color", default="", help="颜色")
def item_add(batch_id, category, desc, brand, size, color):
    """添加衣物"""
    if not store.get_batch(batch_id):
        click.echo(f"✗ 批次不存在: {batch_id}")
        return
    
    cat_enum = next(c for c in ClothingCategory if c.value == category)
    
    item = ClothingItem(
        item_id="",
        batch_id=batch_id,
        category=cat_enum,
        description=desc,
        brand=brand,
        size=size,
        color=color
    )
    
    store.add_item(item)
    click.echo(f"✓ 衣物添加成功: {item.item_id}")
    click.echo(f"  分类: {category}")


@item.command(name="list")
@click.option("--batch-id", help="按批次过滤")
@click.option("--status", type=click.Choice([s.value for s in ClothingStatus]), help="按状态过滤")
def item_list(batch_id, status):
    """列出衣物"""
    status_enum = next((s for s in ClothingStatus if s.value == status), None) if status else None
    items = store.list_items(batch_id=batch_id, status=status_enum)
    
    if not items:
        click.echo("(无衣物记录)")
        return
    
    click.echo(f"{'物品ID':<14} {'批次ID':<20} {'分类':<10} {'品牌':<12} {'尺码':<8} {'状态':<12}")
    click.echo("-" * 80)
    for i in items:
        click.echo(f"{i['item_id']:<14} {i['batch_id']:<20} {i['category']:<10} {i['brand']:<12} {i['size']:<8} {i['status']:<12}")


@item.command(name="sort")
@click.argument("item_id")
@click.option("--operator", required=True, help="分拣人")
@click.option("--notes", default="", help="备注")
def item_sort(item_id, operator, notes):
    """分拣衣物"""
    if tracker.sort_item(item_id, operator, notes):
        click.echo(f"✓ 分拣完成: {item_id}")
    else:
        click.echo(f"✗ 分拣失败，物品不存在")


@item.command(name="disinfect")
@click.argument("item_id")
@click.option("--method", required=True, type=click.Choice([m.value for m in DisinfectMethod]),
              help="消毒方式")
@click.option("--operator", required=True, help="操作人")
@click.option("--duration", type=int, default=0, help="持续时间(分钟)")
@click.option("--temp", type=float, help="温度(℃)")
@click.option("--notes", default="", help="备注")
def item_disinfect(item_id, method, operator, duration, temp, notes):
    """消毒衣物"""
    method_enum = next(m for m in DisinfectMethod if m.value == method)
    if tracker.disinfect_item(item_id, method_enum, operator, duration, temp, notes):
        click.echo(f"✓ 消毒完成: {item_id}")
    else:
        click.echo(f"✗ 消毒失败，物品或批次不存在")


@item.command(name="donate")
@click.argument("item_id")
@click.option("--org-id", required=True, help="转赠机构ID")
@click.option("--operator", required=True, help="操作人")
@click.option("--receiver", default="", help="接收人")
@click.option("--notes", default="", help="备注")
def item_donate(item_id, org_id, operator, receiver, notes):
    """转赠衣物"""
    if tracker.donate_item(item_id, org_id, operator, receiver, notes):
        click.echo(f"✓ 转赠完成: {item_id}")
    else:
        click.echo(f"✗ 转赠失败，物品或机构不存在")


@item.command(name="eliminate")
@click.argument("item_id")
@click.option("--reason", required=True, type=click.Choice([r.value for r in EliminateReason]),
              help="淘汰原因")
@click.option("--operator", required=True, help="操作人")
@click.option("--notes", default="", help="备注")
def item_eliminate(item_id, reason, operator, notes):
    """淘汰衣物"""
    reason_enum = next(r for r in EliminateReason if r.value == reason)
    if tracker.eliminate_item(item_id, reason_enum, operator, notes):
        click.echo(f"✓ 淘汰完成: {item_id}")
    else:
        click.echo(f"✗ 淘汰失败，物品不存在")


@item.command(name="trace")
@click.argument("item_id")
@click.option("--export", is_flag=True, help="导出报告")
def item_trace(item_id, export):
    """追踪衣物全流程"""
    history = tracker.get_item_full_history(item_id)
    if not history.get("item"):
        click.echo(f"✗ 物品不存在: {item_id}")
        return
    
    item = history["item"]
    click.echo(f"物品ID: {item_id}")
    click.echo(f"分类: {item['category']}")
    click.echo(f"当前状态: {item['status']}")
    click.echo(f"批次: {item['batch_id']}")
    
    click.echo(f"\n消毒记录 ({len(history['disinfect_records'])}条):")
    for rec in history['disinfect_records']:
        click.echo(f"  - {rec['disinfect_time']} {rec['method']} by {rec['operator']}")
    
    click.echo(f"\n转赠记录 ({len(history['donate_records'])}条):")
    for rec in history['donate_records']:
        click.echo(f"  - {rec['donate_time']} → {rec['organization_name']}")
    
    click.echo(f"\n淘汰记录 ({len(history['eliminate_records'])}条):")
    for rec in history['eliminate_records']:
        click.echo(f"  - {rec['eliminate_time']} 原因: {rec['reason']}")
    
    if export:
        json_file = exporter.export_item_trace_json(item_id)
        text_file = exporter.export_item_trace_text(item_id)
        click.echo(f"\n✓ 报告已导出:")
        click.echo(f"  JSON: {json_file}")
        click.echo(f"  文本: {text_file}")


@cli.group()
def org():
    """转赠机构管理"""
    pass


@org.command(name="add")
@click.option("--name", required=True, help="机构名称")
@click.option("--contact", required=True, help="联系人")
@click.option("--phone", required=True, help="电话")
@click.option("--address", default="", help="地址")
@click.option("--desc", default="", help="描述")
def org_add(name, contact, phone, address, desc):
    """添加转赠机构"""
    org = Organization(
        org_id="",
        name=name,
        contact=contact,
        phone=phone,
        address=address,
        description=desc
    )
    store.add_organization(org)
    click.echo(f"✓ 机构添加成功: {org.org_id}")
    click.echo(f"  名称: {name}")


@org.command(name="list")
def org_list():
    """列出所有转赠机构"""
    orgs = store.list_organizations()
    if not orgs:
        click.echo("(无机构记录)")
        return
    
    click.echo(f"{'机构ID':<14} {'名称':<20} {'联系人':<12} {'电话':<15} {'状态':<8}")
    click.echo("-" * 75)
    for o in orgs:
        status = "启用" if o['is_active'] else "停用"
        click.echo(f"{o['org_id']:<14} {o['name']:<20} {o['contact']:<12} {o['phone']:<15} {status:<8}")


@cli.group()
def report():
    """报告管理"""
    pass


@report.command(name="batch")
@click.argument("batch_id")
@click.option("--format", type=click.Choice(["json", "text", "both"]), default="both",
              help="导出格式")
@click.option("--output-dir", default="./reports", help="输出目录")
def report_batch(batch_id, format, output_dir):
    """生成分拣报告"""
    if not store.get_batch(batch_id):
        click.echo(f"✗ 批次不存在: {batch_id}")
        return
    
    json_file = None
    text_file = None
    
    if format in ["json", "both"]:
        json_file = exporter.export_batch_report_json(batch_id, output_dir)
    
    if format in ["text", "both"]:
        text_file = exporter.export_batch_report_text(batch_id, output_dir)
    
    click.echo(f"✓ 报告生成成功:")
    if json_file:
        click.echo(f"  机器可读 (JSON): {json_file}")
    if text_file:
        click.echo(f"  人读报告 (TXT): {text_file}")


@report.command(name="validate")
@click.argument("batch_id")
def report_validate(batch_id):
    """验证批次数据一致性"""
    result = tracker.validate_batch_consistency(batch_id)
    
    if result["valid"]:
        click.echo(f"✓ 数据验证通过")
        click.echo(f"  物品数量: {result['item_count']}")
        click.echo(f"  消毒记录: {result['disinfect_count']}")
        click.echo(f"  转赠记录: {result['donate_count']}")
        click.echo(f"  淘汰记录: {result['eliminate_count']}")
    else:
        click.echo(f"✗ 数据验证失败，发现 {len(result['issues'])} 个问题:")
        for i, issue in enumerate(result['issues'], 1):
            click.echo(f"  {i}. {issue}")


@report.command(name="verify")
@click.argument("json_file")
@click.argument("text_file")
def report_verify(json_file, text_file):
    """验证JSON和文本报告的一致性"""
    result = exporter.verify_report_consistency(json_file, text_file)
    
    if result["consistent"]:
        click.echo(f"✓ 报告一致性验证通过")
        click.echo(f"  已验证字段数: {len(result['verified_fields'])}")
    else:
        click.echo(f"✗ 报告一致性验证失败:")
        for mismatch in result['mismatches']:
            click.echo(f"  - {mismatch}")


@cli.command()
@click.argument("scenario", type=click.Choice(["normal", "dirty", "conflict", "empty"]))
def demo(scenario):
    """演示样例数据"""
    import subprocess
    
    if scenario == "normal":
        click.echo("加载正常流程样例数据...")
        subprocess.run([sys.executable, "sample_data.py", "normal"], check=True)
    elif scenario == "dirty":
        click.echo("加载脏数据样例...")
        subprocess.run([sys.executable, "sample_data.py", "dirty"], check=True)
    elif scenario == "conflict":
        click.echo("加载边界冲突样例...")
        subprocess.run([sys.executable, "sample_data.py", "conflict"], check=True)
    elif scenario == "empty":
        click.echo("空结果演示...")
        click.echo("(无数据)")


if __name__ == "__main__":
    cli()
