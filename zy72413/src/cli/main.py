#!/usr/bin/env python3
"""
DJ 场次曲目能量曲线 - 命令行工具
"""
import sys
import os
import argparse
import uuid
from datetime import datetime
from pprint import pprint

from src.models import (
    DJShow,
    EnergyCurve,
    EnergyPoint,
    WorkflowStage,
    BatchStatus,
)
from src.importer import ImportEngine
from src.rules import BoundaryRuleEngine
from src.workflow import WorkflowEngine
from src.history import HistoryEngine
from src.trace import TraceEngine
from src.storage import ShowStorage


def cmd_init(args):
    storage = ShowStorage(args.data_dir)
    show = DJShow(
        id=f"show_{uuid.uuid4().hex[:8]}",
        name=args.name,
        date=datetime.fromisoformat(args.date) if args.date else datetime.now(),
        venue=args.venue,
        dj_name=args.dj_name,
    )
    path = storage.save_show(show)
    print(f"场次已创建: {show.id}")
    print(f"保存路径: {path}")
    return show.id


def cmd_import(args):
    storage = ShowStorage(args.data_dir)
    show = storage.load_show(args.show_id)
    if not show:
        print(f"错误: 未找到场次 {args.show_id}")
        return 1

    with open(args.file, "r", encoding="utf-8") as f:
        raw_content = f.read()

    result = ImportEngine.import_rehearsal(
        show=show,
        source_filename=os.path.basename(args.file),
        raw_content=raw_content,
        imported_by=args.operator or "阿梅",
    )

    storage.save_show(show)

    if result.is_duplicate:
        print(f"⚠️  检测到重复导入，已自动去重，票数未翻倍")
        print(f"   首次导入时间: {result.existing_import_time.strftime('%Y-%m-%d %H:%M') if result.existing_import_time else '未知'}")
        print(f"   首次导入人: {result.existing_imported_by or '未知'}")
        print(f"   已有导入记录ID: {result.existing_import_id}")
        print()
        print(f"📋 复用记录明细:")
        print(f"   复用批次数: {result.batches_reused}")
        print(f"   复用票数: {result.tickets_reused}")
        for name in result.reused_batch_names:
            print(f"     - {name}")
        print()
        print(f"   新增批次数: {result.batches_created}")
        print(f"   新增票数: {result.tickets_imported}")
        print()
        print(f"💡 明细、历史和后续结果都读取同一条记录，不会产生重复数据")
    else:
        print(f"✅ 导入成功")
        print(f"   创建批次: {result.batches_created}")
        print(f"   导入票数: {result.tickets_imported}")
        print(f"   新增批次:")
        for name in result.new_batch_names:
            print(f"     - {name}")

    if result.mixed_batches_found:
        print(f"\n⚠️  发现混票批次 (赠票售票混在一个批次):")
        for msg in result.mixed_batches_found:
            print(f"   - {msg}")
        print(f"\n   这些批次已标记为 MIXED，别急着归正常，留给录音师复核")

    for w in result.warnings:
        print(f"   警告: {w}")

    return 0


def cmd_status(args):
    storage = ShowStorage(args.data_dir)
    show = storage.load_show(args.show_id)
    if not show:
        print(f"错误: 未找到场次 {args.show_id}")
        return 1

    summary = WorkflowEngine.get_workflow_summary(show)
    print(f"\n=== 场次状态: {show.name} ===")
    for k, v in summary.items():
        if isinstance(v, list):
            print(f"{k}:")
            for item in v:
                print(f"  - {item}")
        else:
            print(f"{k}: {v}")

    print(f"\n=== 批次详情 ===")
    for batch in show.batches:
        status_icon = "⚠️" if batch.has_mixed_types else "✅"
        print(f"{status_icon} [{batch.status}] {batch.name}")
        print(f"   票数: {len(batch.tickets)}")
        for ttype, count in batch.ticket_counts.items():
            print(f"   - {ttype.value}: {count}")
        if batch.review_note:
            print(f"   复核备注: {batch.review_note}")

    return 0


def cmd_flag_review(args):
    storage = ShowStorage(args.data_dir)
    show = storage.load_show(args.show_id)
    if not show:
        print(f"错误: 未找到场次 {args.show_id}")
        return 1

    batch = WorkflowEngine.flag_batch_for_audio_engineer_review(
        show=show,
        batch_id=args.batch_id,
        operator=args.operator or "阿梅",
        review_note=args.note or "",
    )

    if batch:
        storage.save_show(show)
        print(f"✅ 批次 [{batch.name}] 已标记为待录音师复核")
    else:
        print(f"错误: 未找到批次 {args.batch_id}")
        return 1
    return 0


def cmd_review(args):
    storage = ShowStorage(args.data_dir)
    show = storage.load_show(args.show_id)
    if not show:
        print(f"错误: 未找到场次 {args.show_id}")
        return 1

    batch = WorkflowEngine.audio_engineer_review(
        show=show,
        batch_id=args.batch_id,
        reviewer=args.reviewer or "录音师",
        is_approved=args.approve,
        resolution=args.note or "",
    )

    if batch:
        storage.save_show(show)
        status = "通过" if args.approve else "需进一步处理"
        print(f"✅ 批次 [{batch.name}] 复核完成: {status}")
    else:
        print(f"错误: 未找到待复核批次 {args.batch_id}")
        return 1
    return 0


def cmd_advance(args):
    storage = ShowStorage(args.data_dir)
    show = storage.load_show(args.show_id)
    if not show:
        print(f"错误: 未找到场次 {args.show_id}")
        return 1

    success, blockers, new_stage = WorkflowEngine.advance_stage(
        show=show,
        operator=args.operator or "阿梅",
        reason=args.reason or "",
    )

    if success:
        storage.save_show(show)
        print(f"✅ 已推进到: {WorkflowEngine.get_stage_description(new_stage)}")
    else:
        print(f"❌ 推进受阻:")
        for b in blockers:
            print(f"   - {b}")
        return 1
    return 0


def cmd_upload_contract(args):
    storage = ShowStorage(args.data_dir)
    show = storage.load_show(args.show_id)
    if not show:
        print(f"错误: 未找到场次 {args.show_id}")
        return 1

    screenshot = WorkflowEngine.upload_contract_screenshot(
        show=show,
        image_path=args.image_path,
        uploaded_by=args.operator or "阿梅",
        note=args.note,
    )
    storage.save_show(show)
    print(f"✅ 合同截图已上传: {screenshot.id}")
    return 0


def cmd_history(args):
    storage = ShowStorage(args.data_dir)
    show = storage.load_show(args.show_id)
    if not show:
        print(f"错误: 未找到场次 {args.show_id}")
        return 1

    logs = HistoryEngine.get_full_audit_log(show)
    print(f"\n=== 修改历史审计记录: {show.name} ===")
    print(f"共 {len(logs)} 条修改记录\n")

    for i, log in enumerate(logs, 1):
        print(f"[{i}] {log['时间']} - 操作人: {log['操作人']}")
        print(f"    对象: {log['对象类型']} ({log['对象ID']}) - 字段: {log['字段']}")
        print(f"    📝 改前: {log['修改前'] if log['修改前'] else '(空)'}")
        print(f"    ✏️  改后: {log['修改后'] if log['修改后'] else '(空)'}")
        if log["原因"]:
            print(f"    💡 原因: {log['原因']}")
        print()
    return 0


def cmd_trace(args):
    storage = ShowStorage(args.data_dir)
    show = storage.load_show(args.show_id)
    if not show:
        print(f"错误: 未找到场次 {args.show_id}")
        return 1

    if args.batch_id:
        result = TraceEngine.trace_batch_origin(show, args.batch_id)
    elif args.ticket_id:
        result = TraceEngine.trace_ticket_origin(show, args.ticket_id)
    elif args.track_name:
        result = TraceEngine.trace_energy_point_origin(show, args.track_name)
    else:
        print("错误: 请指定 --batch-id, --ticket-id 或 --track-name")
        return 1

    pprint(result, width=80)
    return 0


def cmd_update_note(args):
    storage = ShowStorage(args.data_dir)
    show = storage.load_show(args.show_id)
    if not show:
        print(f"错误: 未找到场次 {args.show_id}")
        return 1

    old_note = None
    new_note = args.note
    reason = args.reason or ""
    entity_type = ""
    entity_id = ""
    entity_label = ""

    if args.import_id:
        entity_type = "导入记录"
        entity_id = args.import_id
        for imp in show.rehearsal_imports:
            if imp.id == args.import_id:
                old_note = imp.note
                entity_label = imp.source_filename
                ImportEngine.update_import_note(
                    show=show,
                    import_id=args.import_id,
                    new_note=new_note,
                    operator=args.operator or "阿梅",
                )
                break
        else:
            print(f"错误: 未找到导入记录 {args.import_id}")
            return 1

    elif args.batch_id:
        entity_type = "批次"
        entity_id = args.batch_id
        for batch in show.batches:
            if batch.id == args.batch_id:
                old_note = batch.note
                entity_label = batch.name
                HistoryEngine.update_batch_note(
                    show=show,
                    batch_id=args.batch_id,
                    field_name="note",
                    new_value=new_note,
                    operator=args.operator or "阿梅",
                    reason=reason or "更新批次备注",
                )
                break
        else:
            print(f"错误: 未找到批次 {args.batch_id}")
            return 1

    elif args.ticket_id:
        entity_type = "票"
        entity_id = args.ticket_id
        found = False
        for batch in show.batches:
            for ticket in batch.tickets:
                if ticket.id == args.ticket_id:
                    old_note = ticket.note
                    entity_label = f"{batch.name} - {ticket.guest_name or ticket.id}"
                    HistoryEngine.update_batch_ticket_note(
                        show=show,
                        batch_id=batch.id,
                        ticket_id=args.ticket_id,
                        new_note=new_note,
                        operator=args.operator or "阿梅",
                        reason=reason or "更新票备注",
                    )
                    found = True
                    break
            if found:
                break
        if not found:
            print(f"错误: 未找到票 {args.ticket_id}")
            return 1

    elif args.contract_id:
        entity_type = "合同截图"
        entity_id = args.contract_id
        for screenshot in show.contract_screenshots:
            if screenshot.id == args.contract_id:
                old_note = screenshot.note
                entity_label = screenshot.image_path
                screenshot.note = new_note
                HistoryEngine.record_modification(
                    show=show,
                    entity_type="contract_screenshot",
                    entity_id=args.contract_id,
                    field_name="note",
                    old_value=old_note,
                    new_value=new_note,
                    modified_by=args.operator or "阿梅",
                    reason=reason or "更新合同备注",
                )
                break
        else:
            print(f"错误: 未找到合同截图 {args.contract_id}")
            return 1

    else:
        print("错误: 请指定 --import-id, --batch-id, --ticket-id 或 --contract-id")
        return 1

    storage.save_show(show)

    print(f"✅ {entity_type}备注已更新")
    print(f"   对象: {entity_label} ({entity_id})")
    print(f"   修改人: {args.operator or '阿梅'}")
    if reason:
        print(f"   修改原因: {reason}")
    print()
    print(f"📝 改前改后对比:")
    print(f"   改前: {old_note if old_note else '(空)'}")
    print(f"   改后: {new_note if new_note else '(空)'}")
    print()
    print(f"💡 此修改已记入历史，可通过 history 命令查看完整审计记录")

    return 0


def cmd_set_energy(args):
    storage = ShowStorage(args.data_dir)
    show = storage.load_show(args.show_id)
    if not show:
        print(f"错误: 未找到场次 {args.show_id}")
        return 1

    points = []
    for i, (track, energy) in enumerate(zip(args.tracks, args.energies)):
        points.append(EnergyPoint(
            track_name=track,
            track_order=i + 1,
            energy_level=float(energy),
        ))

    curve = EnergyCurve(
        id=f"curve_{uuid.uuid4().hex[:8]}",
        show_id=show.id,
        points=points,
        modified_by=args.operator or "阿梅",
    )
    show.energy_curve = curve
    storage.save_show(show)
    print(f"✅ 能量曲线已设置，共 {len(points)} 首曲目")
    return 0


def cmd_export_replay(args):
    storage = ShowStorage(args.data_dir)
    path = storage.export_replay_script(args.show_id, args.output)
    print(f"✅ 复盘脚本已导出: {path}")
    print(f"   运行命令: python3 {path}")
    return 0


def cmd_list(args):
    storage = ShowStorage(args.data_dir)
    shows = storage.list_shows()
    if not shows:
        print("暂无场次")
        return 0

    print(f"\n{'ID':<15} {'名称':<20} {'日期':<12} {'场地':<15} {'阶段':<25} {'批次'}")
    print("-" * 90)
    for s in shows:
        stage_desc = WorkflowEngine.STAGE_DESCRIPTIONS.get(
            WorkflowStage(s["workflow_stage"]), s["workflow_stage"]
        )
        print(f"{s['id']:<15} {s['name']:<20} {s['date']:<12} {s['venue']:<15} {stage_desc:<25} {s['batches']}")
    return 0


def cmd_demo(args):
    """运行完整演示流程"""
    print("=" * 60)
    print("DJ 场次曲目能量曲线 - 完整演示")
    print("=" * 60)

    storage = ShowStorage(args.data_dir)

    print("\n[1/10] 创建场次...")
    show_id = cmd_init(argparse.Namespace(
        data_dir=args.data_dir,
        name="夏日电音节",
        date="2026-07-15",
        venue="上海体育馆",
        dj_name="DJ MAX",
    ))

    show = storage.load_show(show_id)

    print("\n[2/10] 第一次导入排练群接龙（含混票批次）...")
    demo_content = """
批次:A区VIP
张三 售票 ¥880 10排5座 备注:媒体嘉宾
李四 售票 ¥880 10排6座
王五 赠票  10排7座 备注:主办方邀请

批次:B区普通
赵六 售票 ¥380 20排1座
钱七 售票 ¥380 20排2座

批次:C区赠票
孙八 赠票  30排1座 备注:合作方
周九 赠票  30排2座
"""

    demo_file = os.path.join(storage.data_dir, "demo_rehearsal.txt")
    with open(demo_file, "w", encoding="utf-8") as f:
        f.write(demo_content)

    cmd_import(argparse.Namespace(
        data_dir=args.data_dir,
        show_id=show_id,
        file=demo_file,
        operator="阿梅",
    ))

    print("\n[3/10] 巡演统筹阿梅改了一条备注...")
    show = storage.load_show(show_id)
    if show.rehearsal_imports:
        import_id = show.rehearsal_imports[0].id
        cmd_update_note(argparse.Namespace(
            data_dir=args.data_dir,
            show_id=show_id,
            note="6月6日排练群接龙，共3个批次7张票，A区有混票待复核",
            reason="整理记录，方便后续追溯",
            import_id=import_id,
            batch_id=None,
            ticket_id=None,
            contract_id=None,
            operator="阿梅",
        ))

    print("\n[4/10] 尝试重复导入同一文件（测试去重，票数不翻倍）...")
    cmd_import(argparse.Namespace(
        data_dir=args.data_dir,
        show_id=show_id,
        file=demo_file,
        operator="阿梅",
    ))

    print("\n[5/10] 先服务复核：标记混票批次送录音师复核...")
    show = storage.load_show(show_id)
    mixed_batches = BoundaryRuleEngine.get_mixed_batches(show)
    if mixed_batches:
        cmd_flag_review(argparse.Namespace(
            data_dir=args.data_dir,
            show_id=show_id,
            batch_id=mixed_batches[0].id,
            operator="阿梅",
            note="A区发现赠票混入，请录音师确认",
        ))

    print("\n[6/10] 上传合同页截图（补看合同第二步）...")
    demo_contract = os.path.join(storage.data_dir, "contract_screenshot.jpg")
    with open(demo_contract, "w") as f:
        f.write("placeholder")
    cmd_upload_contract(argparse.Namespace(
        data_dir=args.data_dir,
        show_id=show_id,
        image_path=demo_contract,
        operator="阿梅",
        note="合同页第一页",
    ))

    print("\n[7/10] 设置 DJ 场次曲目能量曲线...")
    cmd_set_energy(argparse.Namespace(
        data_dir=args.data_dir,
        show_id=show_id,
        tracks=["暖场曲1", "暖场曲2", "主场曲1", "主场曲2", "收尾曲"],
        energies=["3.5", "5.0", "8.5", "9.0", "6.0"],
        operator="阿梅",
    ))

    print("\n[8/10] 录音师复核混票批次...")
    show = storage.load_show(show_id)
    pending = [b for b in show.batches if b.status == BatchStatus.PENDING_REVIEW]
    if pending:
        cmd_review(argparse.Namespace(
            data_dir=args.data_dir,
            show_id=show_id,
            batch_id=pending[0].id,
            reviewer="录音师老王",
            approve=True,
            note="已确认，没问题",
        ))

    print("\n[9/10] 推进工作流到第二步（合同补看完成）...")
    cmd_advance(argparse.Namespace(
        data_dir=args.data_dir,
        show_id=show_id,
        operator="阿梅",
        reason="合同已核对",
    ))

    print("\n[10/10] 推进工作流到第三步（授权更新）...")
    cmd_advance(argparse.Namespace(
        data_dir=args.data_dir,
        show_id=show_id,
        operator="阿梅",
        reason="授权更新",
    ))

    print("\n" + "=" * 60)
    print("演示完成! 验证命令:")
    print(f"  状态:   python3 -m src.cli status {show_id}")
    print(f"  历史:   python3 -m src.cli history {show_id}")
    print(f"  导出复盘: python3 -m src.cli export-replay {show_id} --output replay_demo.py")
    print(f"  溯源:   python3 -m src.cli trace {show_id} --batch-id <batch_id>")
    print("=" * 60)

    return 0


def main():
    parser = argparse.ArgumentParser(description="DJ 场次曲目能量曲线")
    parser.add_argument("--data-dir", default="data", help="数据目录")
    subparsers = parser.add_subparsers(dest="command", required=True)

    p_init = subparsers.add_parser("init", help="创建新场次")
    p_init.add_argument("name", help="场次名称")
    p_init.add_argument("--date", help="日期 (YYYY-MM-DD)")
    p_init.add_argument("--venue", default="未知场地", help="场地")
    p_init.add_argument("--dj-name", default="未知DJ", help="DJ名称")

    p_import = subparsers.add_parser("import", help="导入排练群接龙")
    p_import.add_argument("show_id", help="场次ID")
    p_import.add_argument("file", help="接龙文件路径")
    p_import.add_argument("--operator", default="阿梅", help="操作人")

    p_status = subparsers.add_parser("status", help="查看场次状态")
    p_status.add_argument("show_id", help="场次ID")

    p_flag = subparsers.add_parser("flag-review", help="标记批次待复核")
    p_flag.add_argument("show_id", help="场次ID")
    p_flag.add_argument("batch_id", help="批次ID")
    p_flag.add_argument("--note", help="复核备注")
    p_flag.add_argument("--operator", default="阿梅", help="操作人")

    p_review = subparsers.add_parser("review", help="录音师复核")
    p_review.add_argument("show_id", help="场次ID")
    p_review.add_argument("batch_id", help="批次ID")
    p_review.add_argument("--approve", action="store_true", help="审批通过")
    p_review.add_argument("--note", help="复核意见")
    p_review.add_argument("--reviewer", default="录音师", help="复核人")

    p_advance = subparsers.add_parser("advance", help="推进工作流阶段")
    p_advance.add_argument("show_id", help="场次ID")
    p_advance.add_argument("--reason", help="推进原因")
    p_advance.add_argument("--operator", default="阿梅", help="操作人")

    p_contract = subparsers.add_parser("upload-contract", help="上传合同截图")
    p_contract.add_argument("show_id", help="场次ID")
    p_contract.add_argument("image_path", help="图片路径")
    p_contract.add_argument("--note", help="备注")
    p_contract.add_argument("--operator", default="阿梅", help="操作人")

    p_history = subparsers.add_parser("history", help="查看修改历史")
    p_history.add_argument("show_id", help="场次ID")

    p_trace = subparsers.add_parser("trace", help="溯源查询")
    p_trace.add_argument("show_id", help="场次ID")
    p_trace.add_argument("--batch-id", help="批次ID")
    p_trace.add_argument("--ticket-id", help="票ID")
    p_trace.add_argument("--track-name", help="曲目名称")

    p_energy = subparsers.add_parser("set-energy", help="设置能量曲线")
    p_energy.add_argument("show_id", help="场次ID")
    p_energy.add_argument("--tracks", nargs="+", required=True, help="曲目列表")
    p_energy.add_argument("--energies", nargs="+", required=True, help="能量值列表 (0-10)")
    p_energy.add_argument("--operator", default="阿梅", help="操作人")

    p_note = subparsers.add_parser("update-note", help="修改备注（支持导入记录/批次/票/合同截图）")
    p_note.add_argument("show_id", help="场次ID")
    p_note.add_argument("--note", required=True, help="新备注内容")
    p_note.add_argument("--reason", help="修改原因")
    p_note.add_argument("--import-id", help="导入记录ID")
    p_note.add_argument("--batch-id", help="批次ID")
    p_note.add_argument("--ticket-id", help="票ID")
    p_note.add_argument("--contract-id", help="合同截图ID")
    p_note.add_argument("--operator", default="阿梅", help="操作人")

    p_export = subparsers.add_parser("export-replay", help="导出复盘脚本")
    p_export.add_argument("show_id", help="场次ID")
    p_export.add_argument("--output", default="replay.py", help="输出路径")

    subparsers.add_parser("list", help="列出所有场次")

    p_demo = subparsers.add_parser("demo", help="运行完整演示")

    args = parser.parse_args()

    commands = {
        "init": cmd_init,
        "import": cmd_import,
        "status": cmd_status,
        "flag-review": cmd_flag_review,
        "review": cmd_review,
        "advance": cmd_advance,
        "upload-contract": cmd_upload_contract,
        "history": cmd_history,
        "trace": cmd_trace,
        "set-energy": cmd_set_energy,
        "update-note": cmd_update_note,
        "export-replay": cmd_export_replay,
        "list": cmd_list,
        "demo": cmd_demo,
    }

    sys.exit(commands[args.command](args))


if __name__ == "__main__":
    main()
