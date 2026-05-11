"""主命令行入口"""
import click
import json
import os
from beehive_inspector.storage import FileStorage
from beehive_inspector.beehive_manager import BeehiveManager
from beehive_inspector.inspection_importer import InspectionImporter
from beehive_inspector.swap_manager import SwapManager
from beehive_inspector.report_generator import ReportGenerator


def get_storage(data_dir: str):
    return FileStorage(base_dir=data_dir)


@click.group()
@click.option("--data-dir", default="./data", help="数据目录路径")
@click.pass_context
def cli(ctx, data_dir):
    """蜂场蜂箱巡检分析 CLI 工具"""
    ctx.ensure_object(dict)
    ctx.obj["data_dir"] = data_dir
    ctx.obj["storage"] = get_storage(data_dir)


@cli.group()
@click.pass_context
def hive(ctx):
    """蜂箱档案管理"""
    pass


@hive.command("list")
@click.pass_context
def hive_list(ctx):
    """列出所有蜂箱档案"""
    storage = ctx.obj["storage"]
    manager = BeehiveManager(storage)
    beehives = manager.list_beehives()
    
    if not beehives:
        click.echo("暂无蜂箱档案")
        return
    
    click.echo(f"共 {len(beehives)} 个蜂箱:")
    click.echo("-" * 60)
    for hive in beehives:
        click.echo(f"编号: {hive['beehive_id']}")
        click.echo(f"  位置: {hive['location']}")
        click.echo(f"  建立日期: {hive['established_date']}")
        click.echo(f"  当前状态: {hive['current_status']}")
        click.echo(f"  蜂王状态: {hive['queen_status']}")
        click.echo(f"  最后巡检: {hive.get('last_inspection_date', '无')}")
        if hive.get("notes"):
            click.echo(f"  备注: {hive['notes']}")
        click.echo("")


@hive.command("add")
@click.argument("beehive_id")
@click.option("--location", required=True, help="蜂箱位置")
@click.option("--established-date", required=True, help="建立日期 (YYYY-MM-DD)")
@click.option("--queen-status", default="活跃", help="蜂王状态")
@click.option("--notes", default="", help="备注")
@click.pass_context
def hive_add(ctx, beehive_id, location, established_date, queen_status, notes):
    """添加新蜂箱档案"""
    storage = ctx.obj["storage"]
    manager = BeehiveManager(storage)
    
    try:
        hive = manager.add_beehive(beehive_id, location, established_date, queen_status, notes)
        click.echo(f"✅ 蜂箱 {beehive_id} 添加成功")
        click.echo(f"位置: {location}")
    except ValueError as e:
        click.echo(f"❌ 错误: {e}")
        exit(1)


@hive.command("update")
@click.argument("beehive_id")
@click.option("--location", help="新位置")
@click.option("--current-status", help="当前状态")
@click.option("--queen-status", help="蜂王状态")
@click.option("--notes", help="备注")
@click.pass_context
def hive_update(ctx, beehive_id, location, current_status, queen_status, notes):
    """更新蜂箱信息"""
    storage = ctx.obj["storage"]
    manager = BeehiveManager(storage)
    
    updates = {}
    if location:
        updates["location"] = location
    if current_status:
        updates["current_status"] = current_status
    if queen_status:
        updates["queen_status"] = queen_status
    if notes:
        updates["notes"] = notes
    
    if not updates:
        click.echo("❌ 请至少提供一个更新项")
        exit(1)
    
    try:
        manager.update_beehive(beehive_id, **updates)
        click.echo(f"✅ 蜂箱 {beehive_id} 更新成功")
    except ValueError as e:
        click.echo(f"❌ 错误: {e}")
        exit(1)


@hive.command("history")
@click.argument("beehive_id")
@click.pass_context
def hive_history(ctx, beehive_id):
    """查看蜂箱历史记录"""
    storage = ctx.obj["storage"]
    manager = BeehiveManager(storage)
    swap_manager = SwapManager(storage)
    
    hive = manager.get_beehive(beehive_id)
    if not hive:
        click.echo(f"❌ 蜂箱 {beehive_id} 不存在")
        exit(1)
    
    click.echo(f"蜂箱 {beehive_id} 历史记录")
    click.echo("=" * 60)
    
    if hive.get("history"):
        click.echo("\n📋 档案变更历史:")
        for event in hive["history"]:
            click.echo(f"  [{event.get('timestamp', '未知时间')}] {event.get('type', 'unknown')}")
            if event.get("changes"):
                click.echo(f"    变更: {event['changes']}")
            if event.get("description"):
                click.echo(f"    描述: {event['description']}")
    
    swaps = swap_manager.get_swaps_for_beehive(beehive_id)
    if swaps:
        click.echo("\n🔄 换箱记录:")
        for swap in sorted(swaps, key=lambda x: x["swap_date"]):
            direction = "→" if swap["from_beehive_id"] == beehive_id else "←"
            partner = swap["to_beehive_id"] if swap["from_beehive_id"] == beehive_id else swap["from_beehive_id"]
            click.echo(f"  [{swap['swap_date']}] {beehive_id} {direction} {partner}")
            click.echo(f"    原因: {swap['reason']}")
            if swap.get("notes"):
                click.echo(f"    备注: {swap['notes']}")
    
    inspections = storage.load_inspections()
    hive_insp = [i for i in inspections if i.get("beehive_id") == beehive_id]
    if hive_insp:
        click.echo("\n🔍 巡检记录:")
        for insp in sorted(hive_insp, key=lambda x: x.get("inspection_date", "")):
            click.echo(f"  [{insp.get('inspection_date')}] 蜂王:{insp.get('queen_status')} | 蜜量:{insp.get('honey_level')} | 病虫害:{insp.get('diseases')}")


@cli.group()
@click.pass_context
def inspection(ctx):
    """巡检数据管理"""
    pass


@inspection.command("import")
@click.argument("filepath")
@click.option("--skip-errors", is_flag=True, help="跳过错误记录继续导入")
@click.pass_context
def inspection_import(ctx, filepath, skip_errors):
    """导入巡检数据 (支持 CSV/Excel)"""
    storage = ctx.obj["storage"]
    manager = BeehiveManager(storage)
    importer = InspectionImporter(storage, manager)
    
    click.echo(f"正在导入: {filepath}")
    
    try:
        records = importer.load_from_file(filepath)
    except Exception as e:
        click.echo(f"❌ 文件读取失败: {e}")
        exit(1)
    
    click.echo(f"共 {len(records)} 条记录待处理")
    
    validation = importer.validate_records(records)
    
    validation_json_path = storage.save_json_report("inspection_validation", validation, "pre")
    click.echo(f"📄 校验报告已保存: {validation_json_path}")
    
    if validation["error_count"] > 0:
        click.echo(f"❌ 发现 {validation['error_count']} 个错误:")
        for error in validation["errors"][:10]:
            click.echo(f"  行 {error['row']}: {error['message']}")
        if len(validation["errors"]) > 10:
            click.echo(f"  ... 还有 {len(validation['errors']) - 10} 个错误")
    
    if validation["warning_count"] > 0:
        click.echo(f"⚠️  发现 {validation['warning_count']} 个警告:")
        for warning in validation["warnings"][:5]:
            click.echo(f"  行 {warning['row']}: {warning['message']}")
    
    if validation["error_count"] > 0 and not skip_errors:
        click.echo("\n❌ 导入已取消，请修正数据后重试（或使用 --skip-errors 跳过错误）")
        exit(1)
    
    result = importer.import_records(records, skip_errors=skip_errors)
    
    result_path = storage.save_json_report("inspection_import_result", result)
    click.echo(f"\n📄 导入结果已保存: {result_path}")
    
    if result["success"]:
        click.echo(f"\n✅ 导入完成！成功: {result['imported']} 条, 跳过: {result['skipped']} 条")
    else:
        click.echo(f"\n❌ 导入失败: {result['message']}")
        exit(1)


@inspection.command("list")
@click.option("--beehive-id", help="指定蜂箱编号")
@click.pass_context
def inspection_list(ctx, beehive_id):
    """列出巡检记录"""
    storage = ctx.obj["storage"]
    inspections = storage.load_inspections()
    
    if beehive_id:
        inspections = [i for i in inspections if i.get("beehive_id") == beehive_id]
    
    if not inspections:
        click.echo("暂无巡检记录")
        return
    
    click.echo(f"共 {len(inspections)} 条巡检记录:")
    click.echo("-" * 60)
    
    for insp in sorted(inspections, key=lambda x: (x.get("beehive_id", ""), x.get("inspection_date", ""))):
        click.echo(f"蜂箱: {insp.get('beehive_id')} | 日期: {insp.get('inspection_date')}")
        click.echo(f"  蜂王状态: {insp.get('queen_status')} | 蜜量: {insp.get('honey_level')}")
        click.echo(f"  病虫害: {insp.get('diseases')}")
        click.echo("")


@cli.group()
@click.pass_context
def swap(ctx):
    """换箱记录管理"""
    pass


@swap.command("list")
@click.pass_context
def swap_list(ctx):
    """列出所有换箱记录"""
    storage = ctx.obj["storage"]
    manager = SwapManager(storage)
    swaps = manager.list_swaps()
    
    if not swaps:
        click.echo("暂无换箱记录")
        return
    
    click.echo(f"共 {len(swaps)} 条换箱记录:")
    click.echo("-" * 60)
    for swap in sorted(swaps, key=lambda x: x["swap_date"]):
        click.echo(f"[{swap['swap_date']}] {swap['from_beehive_id']} → {swap['to_beehive_id']}")
        click.echo(f"  原因: {swap['reason']}")
        if swap.get("operator"):
            click.echo(f"  操作人: {swap['operator']}")
        if swap.get("notes"):
            click.echo(f"  备注: {swap['notes']}")
        click.echo("")


@swap.command("add")
@click.option("--from", "from_hive", required=True, help="源蜂箱编号")
@click.option("--to", "to_hive", required=True, help="目标蜂箱编号")
@click.option("--date", "swap_date", required=True, help="换箱日期 (YYYY-MM-DD)")
@click.option("--reason", required=True, help="换箱原因")
@click.option("--operator", default="", help="操作人")
@click.option("--notes", default="", help="备注")
@click.pass_context
def swap_add(ctx, from_hive, to_hive, swap_date, reason, operator, notes):
    """添加换箱记录"""
    storage = ctx.obj["storage"]
    manager = SwapManager(storage)
    
    if from_hive == to_hive:
        click.echo("❌ 源蜂箱和目标蜂箱不能相同")
        exit(1)
    
    record = manager.add_swap(from_hive, to_hive, swap_date, reason, notes, operator)
    click.echo(f"✅ 换箱记录已添加: {from_hive} → {to_hive} ({swap_date})")


@swap.command("import")
@click.argument("filepath")
@click.pass_context
def swap_import(ctx, filepath):
    """导入换箱记录 (支持 CSV/Excel)"""
    storage = ctx.obj["storage"]
    manager = SwapManager(storage)
    
    try:
        result = manager.import_swaps_from_file(filepath)
    except Exception as e:
        click.echo(f"❌ 导入失败: {e}")
        exit(1)
    
    if result["success"]:
        click.echo(f"✅ 成功导入 {result['imported']} 条换箱记录")
        if result["warnings"]:
            click.echo(f"⚠️  {len(result['warnings'])} 个警告:")
            for w in result["warnings"]:
                click.echo(f"  行 {w['row']}: {w['message']}")
    else:
        click.echo(f"❌ 导入失败，发现 {result['error_count']} 个错误:")
        for e in result["errors"]:
            click.echo(f"  行 {e['row']}: {e['message']}")
        exit(1)


@swap.command("chain")
@click.argument("beehive_id")
@click.pass_context
def swap_chain(ctx, beehive_id):
    """查看蜂箱的换箱历史链条"""
    storage = ctx.obj["storage"]
    manager = SwapManager(storage)
    
    chain = manager.get_swap_chain(beehive_id)
    
    if not chain:
        click.echo(f"蜂箱 {beehive_id} 暂无换箱记录")
        return
    
    click.echo(f"蜂箱 {beehive_id} 的换箱历史链条:")
    click.echo("-" * 60)
    
    current = beehive_id
    for swap in sorted(chain, key=lambda x: x["swap_date"]):
        direction = "→" if swap["from_beehive_id"] == current else "←"
        partner = swap["to_beehive_id"] if swap["from_beehive_id"] == current else swap["from_beehive_id"]
        click.echo(f"[{swap['swap_date']}] {current} {direction} {partner}")
        click.echo(f"  原因: {swap['reason']}")
        current = partner


@cli.group()
@click.pass_context
def report(ctx):
    """生成分析报告"""
    pass


@report.command("queen")
@click.option("--save/--no-save", default=True, help="是否保存报告到文件")
@click.pass_context
def report_queen(ctx, save):
    """生成蜂王状态分析报告"""
    storage = ctx.obj["storage"]
    swap_manager = SwapManager(storage)
    generator = ReportGenerator(storage, swap_manager)
    
    report_data = generator.generate_queen_status_report()
    text = generator.format_queen_report_text(report_data)
    
    click.echo(text)
    
    if save:
        report_path = storage.save_report("queen_status_report", text)
        click.echo(f"\n📄 报告已保存到: {report_path}")
        json_path = storage.save_json_report("queen_status_report", report_data)
        click.echo(f"📄 JSON数据已保存到: {json_path}")


@report.command("honey")
@click.option("--save/--no-save", default=True, help="是否保存报告到文件")
@click.pass_context
def report_honey(ctx, save):
    """生成产蜜风险分析报告"""
    storage = ctx.obj["storage"]
    swap_manager = SwapManager(storage)
    generator = ReportGenerator(storage, swap_manager)
    
    report_data = generator.generate_honey_risk_report()
    text = generator.format_honey_report_text(report_data)
    
    click.echo(text)
    
    if save:
        report_path = storage.save_report("honey_risk_report", text)
        click.echo(f"\n📄 报告已保存到: {report_path}")
        json_path = storage.save_json_report("honey_risk_report", report_data)
        click.echo(f"📄 JSON数据已保存到: {json_path}")


@report.command("disease")
@click.option("--save/--no-save", default=True, help="是否保存报告到文件")
@click.pass_context
def report_disease(ctx, save):
    """生成病虫害分析报告"""
    storage = ctx.obj["storage"]
    swap_manager = SwapManager(storage)
    generator = ReportGenerator(storage, swap_manager)
    
    report_data = generator.generate_disease_report()
    text = generator.format_disease_report_text(report_data)
    
    click.echo(text)
    
    if save:
        report_path = storage.save_report("disease_report", text)
        click.echo(f"\n📄 报告已保存到: {report_path}")
        json_path = storage.save_json_report("disease_report", report_data)
        click.echo(f"📄 JSON数据已保存到: {json_path}")


@report.command("all")
@click.option("--save/--no-save", default=True, help="是否保存报告到文件")
@click.pass_context
def report_all(ctx, save):
    """生成完整分析报告（蜂王+蜜量+病虫害）"""
    storage = ctx.obj["storage"]
    swap_manager = SwapManager(storage)
    generator = ReportGenerator(storage, swap_manager)
    
    queen_data = generator.generate_queen_status_report()
    honey_data = generator.generate_honey_risk_report()
    disease_data = generator.generate_disease_report()
    
    full_text = "\n".join([
        generator.format_queen_report_text(queen_data),
        "\n\n",
        generator.format_honey_report_text(honey_data),
        "\n\n",
        generator.format_disease_report_text(disease_data),
    ])
    
    click.echo(full_text)
    
    if save:
        report_path = storage.save_report("full_report", full_text)
        click.echo(f"\n📄 完整报告已保存到: {report_path}")
        
        full_json = {
            "queen_status": queen_data,
            "honey_risk": honey_data,
            "disease": disease_data,
        }
        json_path = storage.save_json_report("full_report", full_json)
        click.echo(f"📄 JSON数据已保存到: {json_path}")


def main():
    cli(obj={})


if __name__ == "__main__":
    main()
