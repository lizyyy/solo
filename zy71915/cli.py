#!/usr/bin/env python3
import sys
import uuid
from datetime import datetime, timedelta
from models import ScheduleDatabase, ScheduleRecord, Material, SilenceSegment, ConfirmationStatus
from operations import (
    import_records, withdraw_record, amend_record,
    filter_records, export_records, export_to_csv,
    get_record_history, get_controversial_records
)


def print_separator(char="=", length=60):
    print(char * length)


def print_header(title):
    print_separator()
    print(f"  {title}")
    print_separator()


def print_record_summary(record, show_issues=True):
    status_color = {
        "已确认": "\033[92m✓",
        "待确认": "\033[93m?",
        "需复核": "\033[91m!",
        "已撤回": "\033[90m×"
    }
    color_end = "\033[0m"
    
    status_icon = status_color.get(record.status.value, " ")
    print(f"{status_icon} {record.ad_name} {color_end}")
    print(f"   ID: {record.record_id} | 版本: v{record.version} | 状态: {record.status.value}")
    if record.slot_start and record.slot_end:
        print(f"   时段: {record.slot_start.strftime('%H:%M:%S')} - {record.slot_end.strftime('%H:%M:%S')}")
    
    if show_issues and record.issues:
        print(f"   问题 ({len(record.issues)} 个):")
        for issue in record.issues:
            severity_icon = "❌" if issue.severity == "error" else "⚠️"
            print(f"      {severity_icon} {issue.message}")
            if issue.reviewable_reason:
                reason_lines = issue.reviewable_reason.split("\n")
                for line in reason_lines:
                    print(f"         → {line}")


def print_import_result(result):
    if result["imported"]:
        print(f"\n✅ 新导入 {len(result['imported'])} 条:")
        for item in result["imported"]:
            print(f"   • {item['ad_name']} (状态: {item['status']})")
            if item["issues"]:
                for issue in item["issues"]:
                    print(f"     ⚠️  {issue}")
    
    if result["updated"]:
        print(f"\n🔄 更新 {len(result['updated'])} 条:")
        for item in result["updated"]:
            print(f"   • {item['ad_name']} (v{item['old_version']} → v{item['new_version']}, 状态: {item['status']})")
            if item["issues"]:
                for issue in item["issues"]:
                    print(f"     ⚠️  {issue}")
    
    if result["skipped"]:
        print(f"\n⏭️  跳过 {len(result['skipped'])} 条:")
        for item in result["skipped"]:
            print(f"   • {item['ad_name']}: {item['reason']}")


def create_demo_data(db):
    base_date = datetime(2026, 5, 31, 8, 0, 0)
    
    records = [
        ScheduleRecord(
            record_id=str(uuid.uuid4()),
            ad_name="早餐奶广告",
            slot_start=base_date + timedelta(minutes=0),
            slot_end=base_date + timedelta(minutes=1),
            expected_duration=timedelta(seconds=60),
            materials=[
                Material("m001", "30秒主音频", timedelta(seconds=30)),
                Material("m002", "30秒背景音乐", timedelta(seconds=30))
            ],
            silence_segments=[
                SilenceSegment(timedelta(seconds=29), timedelta(seconds=31))
            ],
            drift_threshold=timedelta(seconds=5)
        ),
        ScheduleRecord(
            record_id=str(uuid.uuid4()),
            ad_name="运动饮料广告",
            slot_start=base_date + timedelta(minutes=5),
            slot_end=base_date + timedelta(minutes=6, seconds=10),
            expected_duration=timedelta(seconds=60),
            materials=[
                Material("m003", "45秒主音频", timedelta(seconds=45)),
                Material("m004", "15秒结尾音效", timedelta(seconds=15), exists=False)
            ],
            silence_segments=[],
            drift_threshold=timedelta(seconds=5)
        ),
        ScheduleRecord(
            record_id=str(uuid.uuid4()),
            ad_name="汽车广告",
            slot_start=base_date + timedelta(minutes=10),
            slot_end=base_date + timedelta(minutes=11),
            expected_duration=timedelta(seconds=60),
            materials=[
                Material("m005", "引擎声", timedelta(seconds=20)),
                Material("m006", "旁白", timedelta(seconds=40))
            ],
            silence_segments=[
                SilenceSegment(timedelta(seconds=19), timedelta(seconds=21), preserved=False)
            ],
            drift_threshold=timedelta(seconds=5)
        ),
        ScheduleRecord(
            record_id=str(uuid.uuid4()),
            ad_name="手机广告",
            slot_start=base_date + timedelta(minutes=15),
            slot_end=base_date + timedelta(minutes=15, seconds=55),
            expected_duration=timedelta(seconds=60),
            materials=[
                Material("m007", "手机铃声", timedelta(seconds=10)),
                Material("m008", "产品介绍", timedelta(seconds=50))
            ],
            silence_segments=[],
            drift_threshold=timedelta(seconds=5)
        ),
        ScheduleRecord(
            record_id=str(uuid.uuid4()),
            ad_name="食品广告",
            slot_start=base_date + timedelta(minutes=20),
            slot_end=base_date + timedelta(minutes=21),
            expected_duration=timedelta(seconds=60),
            materials=[
                Material("m009", "咬脆声", timedelta(seconds=5)),
                Material("m010", "旁白", timedelta(seconds=55))
            ],
            silence_segments=[
                SilenceSegment(timedelta(seconds=4), timedelta(seconds=6), preserved=False),
                SilenceSegment(timedelta(seconds=29), timedelta(seconds=31))
            ],
            drift_threshold=timedelta(seconds=5)
        )
    ]
    
    result = import_records(db, records, "demo_user")
    return result


def show_menu():
    print_header("广播广告排期系统")
    print("请选择操作:")
    print("  1. 查看所有排期记录")
    print("  2. 导入示例数据")
    print("  3. 查看有争议的记录（时间轴漂移/静音段问题）")
    print("  4. 撤回一条记录")
    print("  5. 修正一条记录")
    print("  6. 筛选并导出记录")
    print("  7. 查看记录操作历史")
    print("  8. 查看系统统计")
    print("  0. 退出")
    print_separator()


def view_all_records(db):
    print_header("所有排期记录")
    records = list(db.records.values())
    if not records:
        print("暂无记录，请先导入数据。")
        return
    
    for i, record in enumerate(records, 1):
        print(f"\n[{i}] ", end="")
        print_record_summary(record)
    
    pending = len([r for r in records if r.status == ConfirmationStatus.PENDING])
    review = len([r for r in records if r.status == ConfirmationStatus.NEEDS_REVIEW])
    confirmed = len([r for r in records if r.status == ConfirmationStatus.CONFIRMED])
    rejected = len([r for r in records if r.status == ConfirmationStatus.REJECTED])
    
    print(f"\n📊 统计: 已确认 {confirmed} | 待确认 {pending} | 需复核 {review} | 已撤回 {rejected}")


def view_controversial(db):
    print_header("有争议的记录")
    records = list(db.records.values())
    controversial = get_controversial_records(records)
    
    if not controversial:
        print("✅ 目前没有有争议的记录。")
        return
    
    for item in controversial:
        print(f"\n📌 {item['ad_name']} (ID: {item['record_id']}, v{item['version']}, 状态: {item['status']})")
        for issue in item["issues"]:
            print(f"   问题类型: {issue['type']}")
            print(f"   描述: {issue['message']}")
            print(f"   复核原因:")
            for line in issue['review_reason'].split('\n'):
                print(f"      → {line}")
    
    print(f"\n⚠️  共发现 {len(controversial)} 条有争议的记录，建议人工复核后再导出。")


def withdraw_one(db):
    print_header("撤回记录")
    records = [r for r in db.records.values() if r.status != ConfirmationStatus.REJECTED]
    if not records:
        print("没有可撤回的记录。")
        return
    
    for i, record in enumerate(records, 1):
        print(f"[{i}] {record.ad_name} (ID: {record.record_id}, 状态: {record.status.value})")
    
    try:
        choice = int(input("\n请选择要撤回的记录编号: "))
        if 1 <= choice <= len(records):
            record = records[choice - 1]
            reason = input("请输入撤回原因: ").strip()
            if not reason:
                reason = "未填写原因"
            
            result = withdraw_record(db, record.record_id, "cli_user", reason)
            if result["success"]:
                print(f"\n✅ 已撤回「{result['ad_name']}」")
                print(f"   状态: {result['old_status']} → {result['new_status']}")
                print(f"   原因: {result['reason']}")
            else:
                print(f"❌ 撤回失败: {result['error']}")
        else:
            print("无效的选择。")
    except ValueError:
        print("请输入有效数字。")


def amend_one(db):
    print_header("修正记录")
    records = list(db.records.values())
    if not records:
        print("没有可修正的记录。")
        return
    
    for i, record in enumerate(records, 1):
        print(f"[{i}] {record.ad_name} (ID: {record.record_id}, v{record.version}, 状态: {record.status.value})")
    
    try:
        choice = int(input("\n请选择要修正的记录编号: "))
        if 1 <= choice <= len(records):
            record = records[choice - 1]
            print(f"\n当前记录: {record.ad_name}")
            print(f"开始时间: {record.slot_start.strftime('%H:%M:%S') if record.slot_start else '无'}")
            print(f"结束时间: {record.slot_end.strftime('%H:%M:%S') if record.slot_end else '无'}")
            print(f"预期时长: {record.expected_duration.total_seconds() if record.expected_duration else '无'} 秒")
            
            updates = {}
            new_start = input("新的开始时间 (HH:MM:SS，回车跳过): ").strip()
            if new_start:
                try:
                    h, m, s = map(int, new_start.split(":"))
                    updates["slot_start"] = record.slot_start.replace(hour=h, minute=m, second=s)
                except:
                    print("时间格式不正确，跳过。")
            
            new_end = input("新的结束时间 (HH:MM:SS，回车跳过): ").strip()
            if new_end:
                try:
                    h, m, s = map(int, new_end.split(":"))
                    updates["slot_end"] = record.slot_end.replace(hour=h, minute=m, second=s)
                except:
                    print("时间格式不正确，跳过。")
            
            new_duration = input("新的预期时长(秒，回车跳过): ").strip()
            if new_duration:
                try:
                    updates["expected_duration"] = timedelta(seconds=float(new_duration))
                except:
                    print("时长格式不正确，跳过。")
            
            if updates:
                reason = input("请输入修正原因: ").strip() or "未填写原因"
                result = amend_record(db, record.record_id, "cli_user", updates, reason)
                if result["success"]:
                    print(f"\n✅ 已修正「{result['ad_name']}」")
                    print(f"   版本: v{result['old_version']} → v{result['new_version']}")
                    print(f"   新状态: {result['status']}")
                    if result["issues"]:
                        print(f"   问题:")
                        for issue in result["issues"]:
                            print(f"      ⚠️  {issue}")
                else:
                    print(f"❌ 修正失败: {result['error']}")
            else:
                print("没有修改内容。")
        else:
            print("无效的选择。")
    except ValueError:
        print("请输入有效数字。")


def filter_and_export(db):
    print_header("筛选并导出")
    records = list(db.records.values())
    if not records:
        print("暂无记录。")
        return
    
    print("筛选条件（回车跳过）:")
    status_choice = input("状态筛选 [1=已确认, 2=待确认, 3=需复核, 4=除已撤回外全部]: ").strip()
    
    status_filter = None
    if status_choice == "1":
        status_filter = [ConfirmationStatus.CONFIRMED]
    elif status_choice == "2":
        status_filter = [ConfirmationStatus.PENDING]
    elif status_choice == "3":
        status_filter = [ConfirmationStatus.NEEDS_REVIEW]
    elif status_choice == "4":
        status_filter = [ConfirmationStatus.CONFIRMED, ConfirmationStatus.PENDING, ConfirmationStatus.NEEDS_REVIEW]
    
    ad_keyword = input("广告名称包含: ").strip() or None
    
    filtered = filter_records(records, status_filter=status_filter, ad_name_contains=ad_keyword)
    
    print(f"\n筛选结果: 共 {len(filtered)} 条记录")
    
    include_pending = input("是否包含待确认/需复核记录? (y/n): ").strip().lower() == "y"
    
    result = export_records(filtered, "cli_user", include_pending=include_pending)
    
    print(f"\n📤 导出结果:")
    print(f"   总记录数: {result['total_count']}")
    print(f"   已导出: {result['exported_count']} 条")
    print(f"   已确认: {result['confirmed_count']} 条")
    print(f"   待确认: {result['pending_count']} 条")
    print(f"   需复核: {result['review_needed_count']} 条")
    print(f"   已撤回: {result['rejected_count']} 条")
    
    if result["warnings"]:
        print(f"\n⚠️  导出说明:")
        for w in result["warnings"]:
            print(f"   {w}")
    
    if result["records"]:
        csv_content = export_to_csv(result)
        save = input("\n是否保存为CSV文件? (y/n): ").strip().lower() == "y"
        if save:
            filename = f"schedule_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            with open(filename, "w", encoding="utf-8-sig") as f:
                f.write(csv_content)
            print(f"✅ 已保存到 {filename}")
        else:
            print("\n" + csv_content[:500] + "..." if len(csv_content) > 500 else csv_content)


def view_history(db):
    print_header("记录操作历史")
    records = list(db.records.values())
    if not records:
        print("暂无记录。")
        return
    
    for i, record in enumerate(records, 1):
        print(f"[{i}] {record.ad_name} (ID: {record.record_id})")
    
    try:
        choice = int(input("\n请选择记录编号查看历史: "))
        if 1 <= choice <= len(records):
            record = records[choice - 1]
            history = get_record_history(db, record.record_id)
            if not history:
                print("暂无操作历史。")
                return
            
            print(f"\n📜 {record.ad_name} 的操作历史:")
            for h in history:
                print(f"\n  [{h['时间']}] {h['操作']} (v{h['版本']}) - {h['操作人']}")
                if h['详情']:
                    for k, v in h['详情'].items():
                        if isinstance(v, list) and v:
                            print(f"     {k}:")
                            for item in v:
                                print(f"       - {item}")
                        elif v:
                            print(f"     {k}: {v}")
        else:
            print("无效的选择。")
    except ValueError:
        print("请输入有效数字。")


def show_stats(db):
    print_header("系统统计")
    records = list(db.records.values())
    if not records:
        print("暂无数据。")
        return
    
    total = len(records)
    by_status = {}
    for r in records:
        by_status[r.status.value] = by_status.get(r.status.value, 0) + 1
    
    total_materials = sum(len(r.materials) for r in records)
    missing_materials = sum(
        len([m for m in r.materials if not m.exists]) for r in records
    )
    drifts = len([r for r in records if any(i.issue_type == "时间轴漂移" for i in r.issues)])
    silence_issues = len([r for r in records if any(i.issue_type == "静音段误删" for i in r.issues)])
    
    print(f"📊 排期记录统计:")
    print(f"   总记录数: {total}")
    for status, count in by_status.items():
        print(f"   {status}: {count} 条")
    
    print(f"\n🎬 素材统计:")
    print(f"   素材总数: {total_materials}")
    print(f"   缺失素材: {missing_materials}")
    
    print(f"\n⚠️  风险统计:")
    print(f"   时间轴漂移: {drifts} 条")
    print(f"   静音段误删: {silence_issues} 条")
    
    print(f"\n📝 操作日志: {len(db.logs)} 条")


def main():
    db = ScheduleDatabase()
    
    while True:
        show_menu()
        choice = input("请输入选项: ").strip()
        
        if choice == "1":
            view_all_records(db)
        elif choice == "2":
            print_header("导入示例数据")
            result = create_demo_data(db)
            print_import_result(result)
        elif choice == "3":
            view_controversial(db)
        elif choice == "4":
            withdraw_one(db)
        elif choice == "5":
            amend_one(db)
        elif choice == "6":
            filter_and_export(db)
        elif choice == "7":
            view_history(db)
        elif choice == "8":
            show_stats(db)
        elif choice == "0":
            print("👋 再见！")
            break
        else:
            print("无效选项，请重试。")
        
        input("\n按回车继续...")


if __name__ == "__main__":
    main()
