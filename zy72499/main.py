import sys
import os
import argparse
from datetime import datetime
from models import MergeSession, RecordStatus
from workflow import (
    step1_import_complaints,
    step2_review_photos,
    step3_update_points,
    resolve_conflict_interactive,
    resident_review_complete,
)
from report import generate_review_report, generate_replay_script, generate_console_summary
from storage import save_session, load_session
from sample_data import list_presets


def _get_or_create_session(session_id: str, name: str = None) -> MergeSession:
    session = load_session(session_id)
    if session is None:
        session = MergeSession(
            session_id=session_id,
            name=name or f"归并会话-{session_id}",
        )
    return session


def _persist_and_report(session: MergeSession, save: bool = True) -> MergeSession:
    if save:
        save_session(session)
    return session


def cmd_init(args):
    session = MergeSession(
        session_id=args.session,
        name=args.name or f"归并会话-{args.session}",
    )
    path = save_session(session)
    print(f"[初始化] 会话 {session.session_id} 已创建")
    print(f"  存档: {path}")


def cmd_import(args):
    session = _get_or_create_session(args.session, getattr(args, "name", None))
    print(f"[步骤1] 导入居民投诉编号... 会话={session.session_id}")

    if not args.data:
        print("  错误: --data 参数缺失（预设名或JSON文件路径）")
        print(f"  可用预设: {', '.join(list_presets()['complaint_presets'])}")
        sys.exit(1)

    session = step1_import_complaints(session, args.data)
    print(f"  ✓ 已导入 {len(session.records)} 条居民投诉记录")
    for r in session.records:
        print(f"    - {r.record_id}: {r.house_number} [{r.status.value}]")

    _persist_and_report(session)


def cmd_review_photos(args):
    session = load_session(args.session)
    if session is None:
        print(f"错误: 会话 {args.session} 不存在，请先运行 init 或 import")
        sys.exit(1)

    print(f"[步骤2] {args.reviewer}审核路口照片... 会话={session.session_id}")

    if not args.data:
        print("  错误: --data 参数缺失（预设名或JSON文件路径）")
        print(f"  可用预设: {', '.join(list_presets()['photo_presets'])}")
        sys.exit(1)

    session = step2_review_photos(session, args.data, reviewer=args.reviewer)
    reviewed = [r for r in session.records if r.intersection_photo_id]
    print(f"  ✓ 已审核 {len(reviewed)} 张路口照片")
    for r in reviewed:
        flags = []
        if r.is_temporary_detour:
            flags.append("施工改道")
        if r.is_old_standard:
            flags.append("旧口径")
        flag_str = f" [{','.join(flags)}]" if flags else ""
        print(f"    - {r.record_id}: 照片={r.intersection_photo_id}{flag_str}")

    _persist_and_report(session)


def cmd_update_points(args):
    session = load_session(args.session)
    if session is None:
        print(f"错误: 会话 {args.session} 不存在")
        sys.exit(1)

    print(f"[步骤3] 更新点位清单... 会话={session.session_id}")
    session, results = step3_update_points(session)
    print(f"  ✓ 处理完成，共 {len(results)} 条结果")
    for res in results:
        print(f"    - {res['record_id']}: {res['action']} → {res.get('status', 'N/A')}")

    _persist_and_report(session)
    print()
    print(generate_console_summary(session))


def cmd_resolve_conflict(args):
    session = load_session(args.session)
    if session is None:
        print(f"错误: 会话 {args.session} 不存在")
        sys.exit(1)

    record = None
    for r in session.records:
        if r.record_id == args.record:
            record = r
            break
    if record is None:
        print(f"错误: 记录 {args.record} 不存在")
        sys.exit(1)
    if record.status != RecordStatus.CONFLICT:
        print(f"警告: 记录 {args.record} 状态为 '{record.status.value}'，非冲突状态")

    confirm = args.confirm
    action = "确认" if confirm else "驳回"
    print(f"[冲突处理] {args.operator} {action} 记录 {args.record}")
    if record.conflicts:
        for c in record.conflicts:
            print(f"  - {c.description}")

    session, point = resolve_conflict_interactive(session, args.record, confirm, operator=args.operator)
    _persist_and_report(session)
    print(f"  ✓ 处理完成: {record.status.value}" + (f" → 点位 {point.point_id}" if point else ""))


def cmd_resident_review(args):
    session = load_session(args.session)
    if session is None:
        print(f"错误: 会话 {args.session} 不存在")
        sys.exit(1)

    record = None
    for r in session.records:
        if r.record_id == args.record:
            record = r
            break
    if record is None:
        print(f"错误: 记录 {args.record} 不存在")
        sys.exit(1)

    approved = args.approve
    action = "通过" if approved else "不通过"
    print(f"[居民复核] {args.operator} {action} 记录 {args.record}")

    session = resident_review_complete(session, args.record, approved, operator=args.operator)
    _persist_and_report(session)
    print(f"  ✓ 处理完成: {record.status.value}")


def cmd_generate_report(args):
    session = load_session(args.session)
    if session is None:
        print(f"错误: 会话 {args.session} 不存在")
        sys.exit(1)

    report_path = generate_review_report(session)
    script_path = generate_replay_script(session)
    print(f"[生成产物]")
    print(f"  📄 复盘记录: {report_path}")
    print(f"  🔄 重跑脚本: {script_path}")
    save_session(session)


def cmd_summary(args):
    session = load_session(args.session)
    if session is None:
        print(f"错误: 会话 {args.session} 不存在")
        sys.exit(1)
    print(generate_console_summary(session))


def cmd_list_presets(args):
    presets = list_presets()
    print("[可用预设]")
    print("  投诉数据 (--data for import):")
    for p in presets["complaint_presets"]:
        print(f"    - {p}")
    print("  照片映射 (--data for review-photos):")
    for p in presets["photo_presets"]:
        print(f"    - {p}")


def run_full_demo():
    session_id = f"DEMO-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    session = MergeSession(session_id=session_id, name="城中村门牌归并-完整演示")
    save_session(session)

    print("=" * 60)
    print("  城中村门牌归并工具 - 完整演示")
    print("=" * 60)
    print()

    print("[步骤1] 导入居民投诉编号...")
    session = step1_import_complaints(session, "all")
    print(f"  ✓ 已导入 {len(session.records)} 条居民投诉记录")
    for r in session.records:
        print(f"    - {r.record_id}: {r.house_number} [{r.status.value}]")
    print()
    save_session(session)

    print("[步骤2] 社区书记周姐补看路口照片...")
    session = step2_review_photos(session, "all", reviewer="周姐")
    reviewed = [r for r in session.records if r.intersection_photo_id]
    print(f"  ✓ 已审核 {len(reviewed)} 张路口照片")
    for r in reviewed:
        flags = []
        if r.is_temporary_detour:
            flags.append("施工改道")
        if r.is_old_standard:
            flags.append("旧口径")
        flag_str = f" [{','.join(flags)}]" if flags else ""
        print(f"    - {r.record_id}: 照片={r.intersection_photo_id}{flag_str}")
    print()
    save_session(session)

    print("[步骤3] 更新点位清单...")
    session, results = step3_update_points(session)
    print(f"  ✓ 处理完成，共 {len(results)} 条结果")
    for res in results:
        print(f"    - {res['record_id']}: {res['action']} → {res.get('status', 'N/A')}")
    save_session(session)
    print()

    print(generate_console_summary(session))
    print()

    report_path = generate_review_report(session)
    script_path = generate_replay_script(session)
    print(f"  📄 复盘记录: {report_path}")
    print(f"  🔄 重跑脚本: {script_path}")
    save_session(session)
    print()

    conflicts = [r for r in session.records if r.status == RecordStatus.CONFLICT]
    if conflicts and sys.stdin.isatty():
        print("  ⚠️  存在冲突，需要周姐确认:")
        for r in conflicts:
            print(f"    - {r.record_id}: {len(r.conflicts)} 处冲突")
            for c in r.conflicts:
                print(f"      • {c.description}")
            print()
            try:
                choice = input(f"    请周姐确认 {r.record_id} (确认=1, 驳回=0, 跳过=s): ").strip()
            except EOFError:
                choice = "s"
            if choice == "1":
                session, point = resolve_conflict_interactive(session, r.record_id, confirm=True, operator="周姐")
                print(f"      ✓ 已确认，处理结果: {r.status.value}")
            elif choice == "0":
                session, point = resolve_conflict_interactive(session, r.record_id, confirm=False, operator="周姐")
                print(f"      ✗ 已驳回")
            else:
                print(f"      已跳过")
        save_session(session)

    pending_review = [r for r in session.records if r.status == RecordStatus.PENDING_RESIDENT_REVIEW]
    if pending_review and sys.stdin.isatty():
        print()
        print("  👥 存在施工临时改道记录，待居民代表复核:")
        for r in pending_review:
            print(f"    - {r.record_id}: {r.house_number} - {r.address}")
            print()
            try:
                choice = input(f"    居民代表复核 {r.record_id} (通过=1, 不通过=0, 跳过=s): ").strip()
            except EOFError:
                choice = "s"
            if choice == "1":
                session = resident_review_complete(session, r.record_id, approved=True)
                print(f"      ✓ 复核通过")
            elif choice == "0":
                session = resident_review_complete(session, r.record_id, approved=False)
                print(f"      ✗ 复核不通过")
            else:
                print(f"      已跳过")
        save_session(session)

    print()
    print("=" * 60)
    print("  最终处理结果")
    print("=" * 60)
    print(generate_console_summary(session))

    report_path = generate_review_report(session)
    script_path = generate_replay_script(session)
    save_session(session)
    print(f"  📄 最终复盘记录: {report_path}")
    print(f"  🔄 最终重跑脚本: {script_path}")

    return session


def run_preset_scenario(scenario_key: str, scenario_name: str, complaint_key: str, photo_key: str):
    session_id = f"{scenario_key.upper()}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    session = MergeSession(session_id=session_id, name=scenario_name)
    save_session(session)

    print("=" * 60)
    print(f"  {scenario_name}")
    print("=" * 60)
    print()

    session = step1_import_complaints(session, complaint_key)
    session = step2_review_photos(session, photo_key, reviewer="周姐")
    session, results = step3_update_points(session)
    save_session(session)

    print(generate_console_summary(session))
    report_path = generate_review_report(session)
    script_path = generate_replay_script(session)
    save_session(session)
    print(f"  📄 复盘记录: {report_path}")
    print(f"  🔄 重跑脚本: {script_path}")
    return session


def run_normal_scenario():
    return run_preset_scenario("normal", "场景1: 正常材料测试", "normal", "normal")


def run_detour_scenario():
    return run_preset_scenario("detour", "场景2: 施工临时改道测试（地图未同步）", "detour", "detour")


def run_supplementary_scenario():
    return run_preset_scenario("supp", "场景3: 路口照片补录旧口径测试", "supplementary", "supplementary")


def main():
    parser = argparse.ArgumentParser(description="城中村门牌归并工具")
    subparsers = parser.add_subparsers(dest="command", help="命令")

    p_init = subparsers.add_parser("init", help="初始化一个新的归并会话")
    p_init.add_argument("--session", required=True, help="会话ID")
    p_init.add_argument("--name", default=None, help="会话名称")
    p_init.set_defaults(func=cmd_init)

    p_import = subparsers.add_parser("import", help="步骤1: 导入居民投诉编号")
    p_import.add_argument("--session", required=True, help="会话ID")
    p_import.add_argument("--data", required=True, help="数据来源：预设名(normal/detour/supplementary/all)或JSON文件路径")
    p_import.add_argument("--name", default=None, help="会话名称（仅新建时使用）")
    p_import.set_defaults(func=cmd_import)

    p_review = subparsers.add_parser("review-photos", help="步骤2: 社区书记审核路口照片")
    p_review.add_argument("--session", required=True, help="会话ID")
    p_review.add_argument("--data", required=True, help="照片映射来源：预设名或JSON文件路径")
    p_review.add_argument("--reviewer", default="周姐", help="审核人姓名")
    p_review.set_defaults(func=cmd_review_photos)

    p_update = subparsers.add_parser("update-points", help="步骤3: 更新点位清单")
    p_update.add_argument("--session", required=True, help="会话ID")
    p_update.set_defaults(func=cmd_update_points)

    p_resolve = subparsers.add_parser("resolve-conflict", help="处理冲突：周姐确认或驳回")
    p_resolve.add_argument("--session", required=True, help="会话ID")
    p_resolve.add_argument("--record", required=True, help="记录ID (如 R-001)")
    g_resolve = p_resolve.add_mutually_exclusive_group(required=True)
    g_resolve.add_argument("--confirm", action="store_true", help="确认冲突，以路口照片为准")
    g_resolve.add_argument("--reject", action="store_true", help="驳回冲突，不予归并")
    p_resolve.add_argument("--operator", default="周姐", help="操作人")
    p_resolve.set_defaults(func=cmd_resolve_conflict)

    p_resident = subparsers.add_parser("resident-review", help="居民代表复核施工临时改道")
    p_resident.add_argument("--session", required=True, help="会话ID")
    p_resident.add_argument("--record", required=True, help="记录ID")
    g_resident = p_resident.add_mutually_exclusive_group(required=True)
    g_resident.add_argument("--approve", action="store_true", help="复核通过")
    g_resident.add_argument("--reject", action="store_true", help="复核不通过")
    p_resident.add_argument("--operator", default="居民代表", help="操作人")
    p_resident.set_defaults(func=cmd_resident_review)

    p_report = subparsers.add_parser("generate-report", help="生成复盘记录和重跑脚本")
    p_report.add_argument("--session", required=True, help="会话ID")
    p_report.set_defaults(func=cmd_generate_report)

    p_summary = subparsers.add_parser("summary", help="查看会话处理摘要")
    p_summary.add_argument("--session", required=True, help="会话ID")
    p_summary.set_defaults(func=cmd_summary)

    p_presets = subparsers.add_parser("list-presets", help="列出可用的预设数据")
    p_presets.set_defaults(func=cmd_list_presets)

    subparsers.add_parser("demo", help="运行完整演示（三步流程+交互审核）")
    subparsers.add_parser("normal", help="场景1: 正常材料测试")
    subparsers.add_parser("detour", help="场景2: 施工临时改道测试")
    subparsers.add_parser("supplementary", help="场景3: 路口照片补录旧口径测试")
    subparsers.add_parser("all", help="运行全部三个场景")

    args = parser.parse_args()

    if args.command == "demo":
        run_full_demo()
    elif args.command == "normal":
        run_normal_scenario()
    elif args.command == "detour":
        run_detour_scenario()
    elif args.command == "supplementary":
        run_supplementary_scenario()
    elif args.command == "all":
        print("运行全部三个场景...\n")
        run_normal_scenario()
        print("\n" + "=" * 60 + "\n")
        run_detour_scenario()
        print("\n" + "=" * 60 + "\n")
        run_supplementary_scenario()
    elif hasattr(args, "func"):
        args.func(args)
    else:
        parser.print_help()
        print()
        print("三步流程快速开始（重跑脚本就是按这个顺序调用）:")
        print("  python3 main.py init --session MY_SESSION")
        print("  python3 main.py import --session MY_SESSION --data all")
        print("  python3 main.py review-photos --session MY_SESSION --data all")
        print("  python3 main.py update-points --session MY_SESSION")
        print("  python3 main.py generate-report --session MY_SESSION")
        print()
        print("或一键演示: python3 main.py demo")


if __name__ == "__main__":
    main()
