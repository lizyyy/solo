#!/usr/bin/env python3
import sys
import argparse
from typing import Optional
from models import RECORD_STATUS, BattleMaterial
from engine import RecordManager
from version_diff import VersionDiff
from report_exporter import ReportExporter, STATUS_MAP
from sample_data import SAMPLE_MATERIALS


def print_record_brief(record):
    status_emoji = {
        "pending": "🔴",
        "processing": "🟡",
        "confirmed": "🟢",
        "on_hold": "⚪",
    }.get(record.status, "⚪")

    print(f"{status_emoji} {record.record_id}")
    print(f"   来源: {record.material.source} | 版本: {record.material.version}")
    print(f"   状态: {STATUS_MAP.get(record.status, record.status)} | 操作人: {record.operator}")
    print(f"   更新: {record.updated_at}")
    if record.result:
        winner_name = next(
            (u.name for u in record.material.units if u.unit_id == record.result.winner),
            record.result.winner
        )
        print(f"   结果: {winner_name} 胜 | 回合: {record.result.total_turns} | 平衡分: {record.result.balance_score}")
    else:
        print(f"   结果: 未运行")
    if record.pending_reason:
        print(f"   ❗ 待处理原因: {record.pending_reason}")
    print()


def cmd_list(args, manager):
    records = manager.list_records(status=args.status, source=args.source)
    if not records:
        print("没有找到记录")
        return
    print(f"找到 {len(records)} 条记录:\n")
    for i, record in enumerate(records, 1):
        print_record_brief(record)


def cmd_show(args, manager):
    record = manager.get_record(args.record_id)
    if not record:
        print(f"错误: 记录 {args.record_id} 不存在")
        return
    print_record_brief(record)

    print("--- 战斗配置 ---")
    print(f"地形: {record.material.terrain} | 天气: {record.material.weather}")
    print(f"回合顺序: {' → '.join(record.material.turn_order)}")
    if record.material.special_rules:
        print(f"特殊规则: {', '.join(record.material.special_rules)}")
    print()

    print("--- 参战单位 ---")
    for unit in record.material.units:
        print(f"  {unit.name}({unit.unit_id}): HP={unit.hp} ATK={unit.attack} DEF={unit.defense} SPD={unit.speed}")
        if unit.skills:
            print(f"    技能: {', '.join(unit.skills)}")
    print()

    if record.result and record.result.issues:
        print("--- 问题提示 ---")
        for issue in record.result.issues:
            print(f"  ⚠️  {issue}")
        print()

    print("--- 变更历史 (最近5条) ---")
    for i, change in enumerate(reversed(record.change_log[-5:]), 1):
        print(f"  {len(record.change_log) - i + 1}. [{change.timestamp}] {change.operator}")
        print(f"     {change.field_changed}: {change.reason}")
        if change.field_changed == "status":
            print(f"     {STATUS_MAP.get(change.old_value, change.old_value)} → {STATUS_MAP.get(change.new_value, change.new_value)}")
    print()


def cmd_add(args, manager):
    if args.sample:
        if args.sample not in SAMPLE_MATERIALS:
            print(f"错误: 未知的示例 {args.sample}，可用: {list(SAMPLE_MATERIALS.keys())}")
            return
        material = SAMPLE_MATERIALS[args.sample]()
    else:
        print("请使用 --sample 参数指定示例材料")
        return

    record, is_dup = manager.add_record(material, args.operator)
    if is_dup:
        print(f"⚠️  检测到重复材料，匹配到已有记录: {record.record_id}")
        print(f"   不会创建新记录，历史保留完整")
    else:
        print(f"✅ 创建新记录: {record.record_id}")
        print(f"   状态: 待处理")
    print_record_brief(record)


def cmd_run(args, manager):
    try:
        record = manager.run_battle(args.record_id, args.operator)
        print(f"✅ 战斗模拟完成: {record.record_id}")
        print_record_brief(record)
    except ValueError as e:
        print(f"错误: {e}")


def cmd_status(args, manager):
    try:
        record = manager.set_record_status(
            args.record_id, args.status, args.operator, args.reason
        )
        print(f"✅ 状态已更新: {STATUS_MAP.get(args.status, args.status)}")
        print_record_brief(record)
    except ValueError as e:
        print(f"错误: {e}")


def cmd_update(args, manager):
    if args.sample not in SAMPLE_MATERIALS:
        print(f"错误: 未知的示例 {args.sample}，可用: {list(SAMPLE_MATERIALS.keys())}")
        return

    new_material = SAMPLE_MATERIALS[args.sample]()
    record = manager.get_record(args.record_id)
    if not record:
        print(f"错误: 记录 {args.record_id} 不存在")
        return

    diff_tool = VersionDiff()
    report = diff_tool.generate_diff_report(record, new_material)

    if report["has_conflicts"]:
        print("⚠️  检测到材料变更，差异如下:")
        for warning in report["warnings"]:
            print(f"   {warning}")
        print()

        for field, data in report["material_diff"].items():
            impact = data.get("impact", "low")
            impact_color = {"high": "🔴", "medium": "🟡", "low": "⚪"}.get(impact, "⚪")
            print(f"   {impact_color} {field}:")
            if field == "units":
                for change in data["changes"]:
                    if change["action"] == "added":
                        print(f"      + 新增单位: {change['unit']['name']}")
                    elif change["action"] == "removed":
                        print(f"      - 移除单位: {change['unit']['name']}")
                    else:
                        print(f"      ~ 修改单位 {change['unit_id']}:")
                        for f, vals in change["fields"].items():
                            print(f"        {f}: {vals['old']} → {vals['new']}")
            elif field == "turn_order":
                print(f"      旧: {' → '.join(data['old'])}")
                print(f"      新: {' → '.join(data['new'])}")
            else:
                print(f"      {data.get('old')} → {data.get('new')}")
        print()

        if not args.force:
            confirm = input("确认应用这些变更吗？(y/N): ")
            if confirm.lower() != "y":
                print("已取消")
                return
    else:
        print("ℹ️  材料内容无实质变化")

    try:
        record, diff, is_dup = manager.update_record_material(
            args.record_id, new_material, args.operator, args.reason
        )
        if is_dup:
            print(f"⚠️  新材料与其他记录重复，操作已取消")
            return
        print(f"✅ 材料已更新")
        if diff:
            print(f"   变更字段: {list(diff.keys())}")
            if record.result is None and record.status == "pending":
                print(f"   状态已重置为待处理，请重新运行战斗")
        print_record_brief(record)
    except ValueError as e:
        print(f"错误: {e}")


def cmd_delete(args, manager):
    if not args.force:
        confirm = input(f"确认删除记录 {args.record_id} 吗？此操作不可撤销 (y/N): ")
        if confirm.lower() != "y":
            print("已取消")
            return
    if manager.delete_record(args.record_id):
        print(f"✅ 记录 {args.record_id} 已删除")
    else:
        print(f"错误: 记录 {args.record_id} 不存在")


def cmd_report(args, manager):
    exporter = ReportExporter()
    records = manager.list_records(status=args.status)

    if args.record_id:
        record = manager.get_record(args.record_id)
        if not record:
            print(f"错误: 记录 {args.record_id} 不存在")
            return
        path = exporter.export_detailed_report(record)
        print(f"✅ 详情报告已导出: {path}")
    elif args.json:
        path = exporter.export_json_report(records)
        print(f"✅ JSON报告已导出: {path}")
    else:
        shift_info = {
            "on_duty": args.on_duty or "未知",
            "next_duty": args.next_duty or "下一班",
            "notes": args.notes or "",
        }
        path = exporter.export_handover_report(records, shift_info)
        print(f"✅ 交接班报告已导出: {path}")


def cmd_demo(args, manager):
    print("=" * 60)
    print("  遗迹机关回合战 - 完整演示流程")
    print("=" * 60)
    print()

    print("📥 1. 添加三条示例材料")
    print("-" * 60)
    rec1, dup1 = manager.add_record(SAMPLE_MATERIALS["sample1"](), "张三")
    print(f"  记录1: {rec1.record_id} {'(重复匹配)' if dup1 else ''}")
    rec2, dup2 = manager.add_record(SAMPLE_MATERIALS["sample2"](), "张三")
    print(f"  记录2: {rec2.record_id} {'(重复匹配)' if dup2 else ''}")
    rec3, dup3 = manager.add_record(SAMPLE_MATERIALS["sample3"](), "李四")
    print(f"  记录3: {rec3.record_id} {'(重复匹配)' if dup3 else ''}")
    print()

    print("🔍 2. 尝试添加重复材料 (内容相同，ID不同)")
    print("-" * 60)
    dup_rec, is_dup = manager.add_record(SAMPLE_MATERIALS["duplicate1"](), "王五")
    print(f"  结果: {'匹配到已有记录 ' + dup_rec.record_id if is_dup else '创建新记录'}")
    print(f"  说明: 同一批材料不会洗掉历史，不会创建新的成功记录")
    print()

    print("⚔️  3. 运行战斗模拟")
    print("-" * 60)
    rec1 = manager.run_battle(rec1.record_id, "张三")
    print(f"  记录1: {rec1.result.winner} 胜 | 回合 {rec1.result.total_turns} | 平衡分 {rec1.result.balance_score}")
    if rec1.result.issues:
        for issue in rec1.result.issues:
            print(f"    ⚠️  {issue}")
    rec2 = manager.run_battle(rec2.record_id, "李四")
    print(f"  记录2: {rec2.result.winner} 胜 | 回合 {rec2.result.total_turns} | 平衡分 {rec2.result.balance_score}")
    print()

    print("📝 4. 标记一条为待处理，说明原因")
    print("-" * 60)
    rec3 = manager.set_record_status(rec3.record_id, "pending", "李四", "回合顺序需要和策划确认")
    print(f"  记录3: {rec3.status} - {rec3.pending_reason}")
    print()

    print("🔄 5. 补传修改后的材料 (版本1.0→1.1)")
    print("-" * 60)
    new_mat = SAMPLE_MATERIALS["modified1"]()
    diff_tool = VersionDiff()
    report = diff_tool.generate_diff_report(rec1, new_mat)
    if report["has_conflicts"]:
        print(f"  检测到变更，高影响字段: {report['high_impact_changes']}")
        for warning in report["warnings"]:
            print(f"  {warning}")
    rec1, diff, _ = manager.update_record_material(
        rec1.record_id, new_mat, "李四", "群聊2026-05-30调整: U001攻防上调，先手顺序调换"
    )
    print(f"  应用变更: {list(diff.keys())}")
    print(f"  状态重置: {rec1.status} - {rec1.pending_reason}")
    print(f"  结果已清空，需重新运行")
    print()

    print("⚔️  6. 重新运行修改后的战斗")
    print("-" * 60)
    rec1 = manager.run_battle(rec1.record_id, "李四")
    print(f"  记录1: {rec1.result.winner} 胜 | 回合 {rec1.result.total_turns} | 平衡分 {rec1.result.balance_score}")
    print()

    print("📋 7. 变更历史追溯")
    print("-" * 60)
    print(f"  记录 {rec1.record_id} 变更历史:")
    for i, change in enumerate(rec1.change_log, 1):
        print(f"    {i}. [{change.timestamp}] {change.operator}")
        print(f"       {change.field_changed}: {change.reason}")
    print()

    print("📤 8. 导出交接班报告")
    print("-" * 60)
    exporter = ReportExporter()
    shift_info = {"on_duty": "张三", "next_duty": "李四", "notes": "重点关注REC3的回合顺序"}
    path = exporter.export_handover_report(manager.list_records(), shift_info)
    print(f"  报告已导出: {path}")
    print()

    print("✅ 演示完成！核心特性总结:")
    print("   • 每条记录可见来源、状态、修改人、待处理原因")
    print("   • 重复材料自动匹配，不创建新记录")
    print("   • 补传旧版本时检测差异，主动提醒高风险变更")
    print("   • 所有变更留痕，支持完整审计追溯")
    print("   • 交接班报告结构化输出，无需翻聊天记录")
    print()


def main():
    parser = argparse.ArgumentParser(description="遗迹机关回合战 - 平衡性测试追踪系统")
    parser.add_argument("--operator", "-o", default="unknown", help="操作人姓名")
    subparsers = parser.add_subparsers(dest="command", required=True)

    list_parser = subparsers.add_parser("list", help="列出所有记录")
    list_parser.add_argument("--status", choices=RECORD_STATUS, help="按状态筛选")
    list_parser.add_argument("--source", help="按来源筛选")

    show_parser = subparsers.add_parser("show", help="查看记录详情")
    show_parser.add_argument("record_id", help="记录ID")

    add_parser = subparsers.add_parser("add", help="添加新记录")
    add_parser.add_argument("--sample", required=True, help="示例材料名: sample1|sample2|sample3|modified1|duplicate1")

    run_parser = subparsers.add_parser("run", help="运行战斗模拟")
    run_parser.add_argument("record_id", help="记录ID")

    status_parser = subparsers.add_parser("status", help="更新记录状态")
    status_parser.add_argument("record_id", help="记录ID")
    status_parser.add_argument("status", choices=RECORD_STATUS, help="新状态")
    status_parser.add_argument("--reason", default="", help="变更原因")

    update_parser = subparsers.add_parser("update", help="更新材料（补传）")
    update_parser.add_argument("record_id", help="记录ID")
    update_parser.add_argument("--sample", required=True, help="新的示例材料")
    update_parser.add_argument("--reason", default="材料更新", help="更新原因")
    update_parser.add_argument("--force", action="store_true", help="跳过确认直接应用")

    delete_parser = subparsers.add_parser("delete", help="删除记录")
    delete_parser.add_argument("record_id", help="记录ID")
    delete_parser.add_argument("--force", action="store_true", help="跳过确认")

    report_parser = subparsers.add_parser("report", help="导出报告")
    report_parser.add_argument("--record-id", help="导出单条记录详情")
    report_parser.add_argument("--status", choices=RECORD_STATUS, help="按状态筛选")
    report_parser.add_argument("--json", action="store_true", help="导出JSON格式")
    report_parser.add_argument("--on-duty", help="交班人")
    report_parser.add_argument("--next-duty", help="接班人")
    report_parser.add_argument("--notes", help="交班备注")

    demo_parser = subparsers.add_parser("demo", help="运行完整演示流程")

    args = parser.parse_args()

    manager = RecordManager()

    commands = {
        "list": cmd_list,
        "show": cmd_show,
        "add": cmd_add,
        "run": cmd_run,
        "status": cmd_status,
        "update": cmd_update,
        "delete": cmd_delete,
        "report": cmd_report,
        "demo": cmd_demo,
    }

    commands[args.command](args, manager)


if __name__ == "__main__":
    main()
