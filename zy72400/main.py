#!/usr/bin/env python3
import sys
from typing import List
from models import EquipmentRecord, RecordStatus, HourlyVerification
from processor import (
    run_full_verification,
    process_tuner_message,
    manager_review,
)
from demo_data import create_step1_imported_records, create_step2_with_tuner_messages


def print_divider(char="=", length=70):
    print(char * length)


def print_header(title):
    print()
    print_divider()
    print(f"  {title}")
    print_divider()


def print_record(record: EquipmentRecord, show_details: bool = True):
    status_color = {
        RecordStatus.NORMAL: "\033[92m",
        RecordStatus.AREA_MISSING: "\033[93m",
        RecordStatus.PENDING_REVIEW: "\033[91m",
        RecordStatus.NEEDS_VERIFICATION: "\033[94m",
        RecordStatus.FROM_OLD_STANDARD: "\033[95m",
        RecordStatus.UPDATED: "\033[96m",
    }
    reset = "\033[0m"

    color = status_color.get(record.status, "")
    print(f"\n【{record.id}】{record.equipment_name}")
    print(f"  借用人: {record.borrower}")
    print(f"  状态: {color}{record.status.value}{reset}")
    print(f"  授权城市: {', '.join(record.authorized_cities)}")
    print(f"  实际城市: {', '.join(record.actual_cities)}")
    print(f"  授权期限: {record.authorized_start} 至 {record.authorized_end}")
    print(f"  使用日期: {record.actual_use_date}")
    print(f"  核销课时: {record.hours_used} 小时")

    if show_details:
        if record.tuner_message:
            print(f"  调音师留言: {record.tuner_message}")
        if record.review_note:
            print(f"  复核备注: {record.review_note}")
        if record.is_old_standard:
            print(f"  备注: 旧口径折算")


def print_verification_results(record: EquipmentRecord, results):
    print(f"\n  校验结果:")
    has_issues = False
    for result in results:
        if result.issues:
            has_issues = True
            for issue in result.issues:
                print(f"    ❗ {issue}")
        for suggestion in result.suggestions:
            print(f"    💡 {suggestion}")
    if not has_issues:
        print(f"    ✅ 校验通过")


def print_hourly_verification(verifications: List[HourlyVerification]):
    if not verifications:
        return
    print(f"\n  课时核销单变更:")
    for v in verifications:
        print(f"    [{v.id}] {v.equipment_name}")
        print(f"      原课时: {v.original_hours} → 现课时: {v.adjusted_hours}")
        print(f"      原因: {v.reason}")
        print(f"      操作人: {v.updated_by}")


def step1_first_import():
    print_header("第一步：授权期限页第一次导入")
    print("店长把巡演设备的授权书扫进来，系统自动核对。")
    print()

    records = create_step1_imported_records()
    results = run_full_verification(records)

    for record, verifications in results:
        print_record(record, show_details=False)
        print_verification_results(record, verifications)

    print()
    print("👉 注意看 EQ-2026-002，系统标出了授权地区少写了石家庄")
    print("👉 这时候别急着归正常，先留给店长复核")
    print("👉 EQ-2026-001 一切正常，EQ-2026-003 等调音师留言")

    return results


def step2_tuner_message_supplement(results_step1):
    print_header("第二步：录音师小段补看调音师留言")
    print("第二天早上，调音师的留言到了。小段逐条核对。")
    print()

    records_step2 = create_step2_with_tuner_messages()

    all_hourly_verifications = []
    processed_records_raw = []

    for record in records_step2:
        if record.id == "EQ-2026-003":
            processed_record, hourly_verifs = process_tuner_message(record)
            all_hourly_verifications.extend(hourly_verifs)
            processed_records_raw.append(processed_record)
        else:
            processed_records_raw.append(record)

    results_step2 = run_full_verification(processed_records_raw)

    for i, (record, verifications) in enumerate(results_step2):
        print_record(record)
        print_verification_results(record, verifications)
        if record.id == "EQ-2026-003":
            print_hourly_verification(all_hourly_verifications)

    print()
    print("👉 EQ-2026-003 从调音师留言里补到了旧口径，课时跟着变了")
    print("👉 原来10小时，旧口径打8折再加2小时，变成 10×0.8+2 = 10小时")
    print("👉 留言里还补了佛山的授权，所以地区问题自动消了")
    print("👉 EQ-2026-002 还在那儿等着店长复核石家庄的事")

    return results_step2, all_hourly_verifications


def step3_manager_review_and_update(results_step2):
    print_header("第三步：店长复核 + 课时核销单更新")
    print("店长看过授权书原件，确认石家庄确实在授权范围内。")
    print("同时确认 EQ-2026-001 信息完整，可以结案。")
    print()

    final_records = []
    for record, verifications in results_step2:
        if record.id == "EQ-2026-002":
            print(f"【店长复核】{record.id} - {record.equipment_name}")
            print(f"  原状态: {record.status.value}")
            print(f"  问题: 授权地区少写了石家庄")
            print()
            approved_record = manager_review(
                record,
                approved=True,
                review_note="经查授权书原件，石家庄确实在华北区授权范围内，补录",
            )
            final_records.append(approved_record)
            print_record(approved_record)
            print(f"  ✅ 店长复核通过，状态更新为：{approved_record.status.value}")
        elif record.id == "EQ-2026-001":
            record.status = RecordStatus.NORMAL
            record.review_note = "信息完整，直接结案"
            final_records.append(record)
            print_record(record)
            print(f"  ✅ 信息完整，状态更新为：{record.status.value}")
        else:
            final_records.append(record)
            print_record(record)

    print()
    print("👉 三条记录处理完毕，三种结果各不同：")
    print("   1. EQ-2026-001：全程顺利，一次通过")
    print("   2. EQ-2026-002：授权地区少写城市，店长复核后通过")
    print("   3. EQ-2026-003：从调音师留言补来旧口径，课时核销单自动更新")

    return final_records


def print_summary(final_records):
    print_header("流程总结")
    print("给新人讲的时候，就按这个顺序说：")
    print()
    print("1. 【导入】先扫授权期限页，系统自动查地区和日期")
    print("2. 【等留言】调音师经常熬夜，留言第二天才到，别着急结案")
    print("3. 【补信息】从小段那儿补调音师留言，旧口径的课时要重算")
    print("4. 【留复核】少写城市这种事，系统标出来就行，别自己改，等店长拍板")
    print("5. 【更新】店长复核过了，课时核销单就跟着变")
    print()
    print("核心原则：返工要留在明面上，每一步谁改的、为什么改，都要有记录")
    print()

    print("三种典型情况对照表:")
    print()
    print(f"{'记录ID':<12} {'情况':<20} {'处理方式':<25} {'最终状态'}")
    print("-" * 70)
    for r in final_records:
        if r.id == "EQ-2026-001":
            case = "一切正常"
            handling = "一次通过，无需改动"
        elif r.id == "EQ-2026-002":
            case = "授权地区少写城市"
            handling = "系统标出，店长复核"
        else:
            case = "调音师补旧口径"
            handling = "留言补录，课时重算"
        print(f"{r.id:<12} {case:<20} {handling:<25} {r.status.value}")


def run_demo(interactive=True):
    print_divider()
    print("  巡演设备借还清单 - 演示流程")
    print("  录音师小段给新人讲流程专用")
    print_divider()

    results_step1 = step1_first_import()
    if interactive:
        input("\n按回车键继续下一步...")
    else:
        print()

    results_step2, hourly_verifs = step2_tuner_message_supplement(results_step1)
    if interactive:
        input("\n按回车键继续下一步...")
    else:
        print()

    final_records = step3_manager_review_and_update(results_step2)

    print_summary(final_records)


def show_help():
    print("巡演设备借还清单")
    print()
    print("用法:")
    print("  python main.py demo      运行完整演示流程（推荐给新人讲）")
    print("  python main.py records   查看所有演示记录")
    print("  python main.py help      显示帮助")
    print()
    print("关键点说明:")
    print("  - 导入后自动标出授权地区少写的城市")
    print("  - 调音师留言补录后，课时核销单自动联动")
    print("  - 少写城市的情况不自动归正常，留给店长复核")
    print("  - 每一步改动都留痕，返工留在明面上")


def main():
    if len(sys.argv) < 2:
        run_demo(interactive=False)
        return

    cmd = sys.argv[1]

    if cmd == "demo":
        run_demo(interactive=True)
    elif cmd == "demo-auto":
        run_demo(interactive=False)
    elif cmd == "records":
        from demo_data import create_demo_records
        records = create_demo_records()
        for r in records:
            print_record(r)
    elif cmd == "help":
        show_help()
    else:
        print(f"未知命令: {cmd}")
        show_help()


if __name__ == "__main__":
    main()
