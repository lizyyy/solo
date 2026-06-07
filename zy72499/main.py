import sys
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
from sample_data import (
    SAMPLE_RECORDS_NORMAL,
    SAMPLE_RECORDS_DETOUR,
    SAMPLE_RECORDS_SUPPLEMENTARY,
    SAMPLE_COMPLAINTS_ALL,
    PHOTO_MAPPINGS_ALL,
)


def run_full_demo():
    session_id = f"SESS-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    session = MergeSession(session_id=session_id, name="城中村门牌归并-完整演示")

    print("=" * 60)
    print("  城中村门牌归并工具 - 完整演示")
    print("=" * 60)
    print()

    print("[步骤1] 导入居民投诉编号...")
    session = step1_import_complaints(session, SAMPLE_COMPLAINTS_ALL)
    print(f"  ✓ 已导入 {len(session.records)} 条居民投诉记录")
    for r in session.records:
        print(f"    - {r.record_id}: {r.house_number} [{r.status.value}]")
    print()

    print("[步骤2] 社区书记周姐补看路口照片...")
    session = step2_review_photos(session, PHOTO_MAPPINGS_ALL, reviewer="周姐")
    print(f"  ✓ 已审核 {len(PHOTO_MAPPINGS_ALL)} 张路口照片")
    for r in session.records:
        photo_info = f"照片:{r.intersection_photo_id}" if r.intersection_photo_id else "无照片"
        flags = []
        if r.is_temporary_detour:
            flags.append("施工改道")
        if r.is_old_standard:
            flags.append("旧口径")
        flag_str = f" [{','.join(flags)}]" if flags else ""
        print(f"    - {r.record_id}: {photo_info}{flag_str}")
    print()

    print("[步骤3] 更新点位清单...")
    session, results = step3_update_points(session)
    print(f"  ✓ 处理完成，共 {len(results)} 条结果")
    for res in results:
        print(f"    - {res['record_id']}: {res['action']} → {res.get('status', 'N/A')}")
    print()

    print(generate_console_summary(session))
    print()

    report_path = generate_review_report(session)
    script_path = generate_replay_script(session)
    print(f"  📄 复盘记录: {report_path}")
    print(f"  🔄 重跑脚本: {script_path}")
    print()

    conflicts = [r for r in session.records if r.status == RecordStatus.CONFLICT]
    if conflicts:
        print("  ⚠️  存在冲突，需要周姐确认:")
        for r in conflicts:
            print(f"    - {r.record_id}: {len(r.conflicts)} 处冲突")
            for c in r.conflicts:
                print(f"      • {c.description}")
            print()
            choice = input(f"    请周姐确认 {r.record_id} (确认=1, 驳回=0, 跳过=s): ").strip()
            if choice == "1":
                session, point = resolve_conflict_interactive(session, r.record_id, confirm=True, operator="周姐")
                print(f"      ✓ 已确认，处理结果: {r.status.value}")
            elif choice == "0":
                session, point = resolve_conflict_interactive(session, r.record_id, confirm=False, operator="周姐")
                print(f"      ✗ 已驳回")
            else:
                print(f"      已跳过")

    pending_review = [r for r in session.records if r.status == RecordStatus.PENDING_RESIDENT_REVIEW]
    if pending_review:
        print()
        print("  👥 存在施工临时改道记录，待居民代表复核:")
        for r in pending_review:
            print(f"    - {r.record_id}: {r.house_number} - {r.address}")
            print()
            choice = input(f"    居民代表复核 {r.record_id} (通过=1, 不通过=0, 跳过=s): ").strip()
            if choice == "1":
                session = resident_review_complete(session, r.record_id, approved=True)
                print(f"      ✓ 复核通过")
            elif choice == "0":
                session = resident_review_complete(session, r.record_id, approved=False)
                print(f"      ✗ 复核不通过")
            else:
                print(f"      已跳过")

    print()
    print("=" * 60)
    print("  最终处理结果")
    print("=" * 60)
    print(generate_console_summary(session))

    report_path = generate_review_report(session)
    script_path = generate_replay_script(session)
    print(f"  📄 最终复盘记录: {report_path}")
    print(f"  🔄 最终重跑脚本: {script_path}")

    return session


def run_normal_scenario():
    session_id = f"SESS-NORMAL-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    session = MergeSession(session_id=session_id, name="正常材料测试")

    print("=" * 60)
    print("  场景1: 正常材料测试")
    print("=" * 60)
    print()

    session = step1_import_complaints(session, SAMPLE_RECORDS_NORMAL)
    photo_map = [{"record_id": "R-001", "photo_id": "PHOTO-N-001", "mark_detour": False, "mark_old_standard": False}]
    session = step2_review_photos(session, photo_map, reviewer="周姐")
    session, results = step3_update_points(session)

    print(generate_console_summary(session))
    report_path = generate_review_report(session)
    script_path = generate_replay_script(session)
    print(f"  📄 复盘记录: {report_path}")
    print(f"  🔄 重跑脚本: {script_path}")
    return session


def run_detour_scenario():
    session_id = f"SESS-DETOUR-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    session = MergeSession(session_id=session_id, name="施工临时改道测试")

    print("=" * 60)
    print("  场景2: 施工临时改道测试（地图未同步）")
    print("=" * 60)
    print()

    session = step1_import_complaints(session, SAMPLE_RECORDS_DETOUR)
    photo_map = [{"record_id": "R-001", "photo_id": "PHOTO-D-001", "mark_detour": True, "mark_old_standard": False}]
    session = step2_review_photos(session, photo_map, reviewer="周姐")
    session, results = step3_update_points(session)

    print(generate_console_summary(session))
    report_path = generate_review_report(session)
    script_path = generate_replay_script(session)
    print(f"  📄 复盘记录: {report_path}")
    print(f"  🔄 重跑脚本: {script_path}")
    return session


def run_supplementary_scenario():
    session_id = f"SESS-SUPP-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    session = MergeSession(session_id=session_id, name="路口照片补录旧口径测试")

    print("=" * 60)
    print("  场景3: 路口照片补录旧口径测试")
    print("=" * 60)
    print()

    session = step1_import_complaints(session, SAMPLE_RECORDS_SUPPLEMENTARY)
    photo_map = [{"record_id": "R-001", "photo_id": "PHOTO-S-001", "mark_detour": False, "mark_old_standard": True}]
    session = step2_review_photos(session, photo_map, reviewer="周姐")
    session, results = step3_update_points(session)

    print(generate_console_summary(session))
    report_path = generate_review_report(session)
    script_path = generate_replay_script(session)
    print(f"  📄 复盘记录: {report_path}")
    print(f"  🔄 重跑脚本: {script_path}")
    return session


def main():
    parser = argparse.ArgumentParser(description="城中村门牌归并工具")
    subparsers = parser.add_subparsers(dest="command", help="命令")

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
    else:
        parser.print_help()
        print()
        print("快速开始:")
        print("  python main.py demo    # 运行完整演示")
        print("  python main.py all     # 运行全部三个场景")
        print("  python main.py normal  # 仅正常材料场景")


if __name__ == "__main__":
    main()
