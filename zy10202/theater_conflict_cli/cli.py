"""命令行接口"""

import argparse
import hashlib
import json
import sys
from datetime import datetime, date
from typing import Any, Dict, List

from .core import (
    find_all_conflicts, find_available_slots, get_weekly_schedule,
    check_duplicate_import, safe_delete_booking, reschedule_booking,
    confirm_booking, pickup_key, return_key, parse_time, format_time,
    is_cross_midnight
)
from .data_store import (
    load_data, add_item, update_item, get_by_id, generate_id
)


def print_header(title: str):
    """打印标题"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def print_section(title: str):
    """打印小节标题"""
    print(f"\n--- {title} ---\n")


def cmd_rooms(args):
    """管理排练厅"""
    if args.action == "list":
        rooms = load_data("rooms")
        print_header("排练厅列表")
        if not rooms:
            print("暂无排练厅数据")
            return
        for r in rooms:
            print(f"ID: {r['id']}")
            print(f"  名称: {r['name']}")
            print(f"  容量: {r.get('capacity', 'N/A')}")
            print(f"  设备: {', '.join(r.get('features', [])) or '无'}")
            print()
    
    elif args.action == "add":
        room = {
            "name": args.name,
            "capacity": args.capacity,
            "features": args.features.split(",") if args.features else []
        }
        result = add_item("rooms", room)
        print(f"已添加排练厅: {result['id']} - {result['name']}")


def cmd_equipment(args):
    """管理设备包"""
    if args.action == "list":
        equipment = load_data("equipment")
        print_header("设备包列表")
        if not equipment:
            print("暂无设备数据")
            return
        for e in equipment:
            print(f"ID: {e['id']}")
            print(f"  名称: {e['name']}")
            print(f"  描述: {e.get('description', '')}")
            print(f"  状态: {'可用' if e.get('available', True) else '不可用'}")
            print()
    
    elif args.action == "add":
        equip = {
            "name": args.name,
            "description": args.description or "",
            "available": True
        }
        result = add_item("equipment", equip)
        print(f"已添加设备包: {result['id']} - {result['name']}")


def cmd_contacts(args):
    """管理剧组联系人"""
    if args.action == "list":
        contacts = load_data("contacts")
        print_header("剧组联系人列表")
        if not contacts:
            print("暂无联系人数据")
            return
        for c in contacts:
            print(f"ID: {c['id']}")
            print(f"  姓名: {c['name']}")
            print(f"  剧组: {c['crew_name']}")
            print(f"  电话: {c.get('phone', 'N/A')}")
            print(f"  邮箱: {c.get('email', 'N/A')}")
            print()
    
    elif args.action == "add":
        contact = {
            "name": args.name,
            "crew_name": args.crew,
            "phone": args.phone or "",
            "email": args.email or ""
        }
        result = add_item("contacts", contact)
        print(f"已添加联系人: {result['id']} - {result['name']} ({result['crew_name']})")


def generate_import_hash(booking_data: Dict[str, Any]) -> str:
    """生成导入哈希用于去重"""
    key_data = f"{booking_data['room_id']}-{booking_data['start_time']}-{booking_data['end_time']}-{booking_data['contact_id']}"
    return hashlib.md5(key_data.encode()).hexdigest()


def cmd_import(args):
    """导入预约数据"""
    print_header("导入预约数据")
    
    with open(args.file, "r", encoding="utf-8") as f:
        import_data = json.load(f)
    
    if not isinstance(import_data, list):
        import_data = [import_data]
    
    imported_count = 0
    duplicate_count = 0
    errors = []
    
    for item in import_data:
        try:
            booking = {
                "room_id": item["room_id"],
                "contact_id": item["contact_id"],
                "equipment_ids": item.get("equipment_ids", []),
                "start_time": item["start_time"],
                "end_time": item["end_time"],
                "notes": item.get("notes", ""),
                "status": item.get("status", "pending"),
                "source": "import"
            }
            
            import_hash = generate_import_hash(booking)
            booking["import_hash"] = import_hash
            
            if check_duplicate_import(import_hash):
                duplicate_count += 1
                print(f"[跳过] 重复导入: {booking['start_time']} - {booking['end_time']}")
                continue
            
            start = parse_time(booking["start_time"])
            end = parse_time(booking["end_time"])
            if is_cross_midnight(start, end):
                print(f"[提示] 检测到跨午夜排练: {booking['start_time']} - {booking['end_time']}")
            
            result = add_item("bookings", booking)
            imported_count += 1
            print(f"[成功] 已导入预约: {result['id']}")
            
        except Exception as e:
            errors.append(f"导入失败 {item}: {str(e)}")
    
    print_section("导入结果")
    print(f"成功导入: {imported_count}")
    print(f"跳过重复: {duplicate_count}")
    if errors:
        print(f"错误: {len(errors)}")
        for err in errors:
            print(f"  - {err}")


def cmd_check(args):
    """异常检查"""
    print_header("异常检查")
    
    conflicts = find_all_conflicts()
    bookings = load_data("bookings")
    key_records = load_data("key_records")
    
    issues = []
    
    print_section("排练厅冲突")
    if conflicts["room_conflicts"]:
        for c in conflicts["room_conflicts"]:
            b1 = get_by_id("bookings", c["booking1_id"])
            b2 = get_by_id("bookings", c["booking2_id"])
            room = get_by_id("rooms", c["room_id"])
            room_name = room["name"] if room else c["room_id"]
            
            print(f"冲突: 预约 {c['booking1_id']} 与 {c['booking2_id']}")
            print(f"  排练厅: {room_name}")
            print(f"  时段1: {b1['start_time']} - {b1['end_time']}")
            print(f"  时段2: {b2['start_time']} - {b2['end_time']}")
            print()
            issues.append(f"room_conflict:{c['booking1_id']}:{c['booking2_id']}")
    else:
        print("无排练厅冲突")
    
    print_section("设备包冲突")
    if conflicts["equipment_conflicts"]:
        for c in conflicts["equipment_conflicts"]:
            b1 = get_by_id("bookings", c["booking1_id"])
            b2 = get_by_id("bookings", c["booking2_id"])
            equip_names = []
            for eid in c["equipment_ids"]:
                equip = get_by_id("equipment", eid)
                equip_names.append(equip["name"] if equip else eid)
            
            print(f"冲突: 预约 {c['booking1_id']} 与 {c['booking2_id']}")
            print(f"  设备: {', '.join(equip_names)}")
            print(f"  时段1: {b1['start_time']} - {b1['end_time']}")
            print(f"  时段2: {b2['start_time']} - {b2['end_time']}")
            print()
            issues.append(f"equipment_conflict:{c['booking1_id']}:{c['booking2_id']}")
    else:
        print("无设备冲突")
    
    print_section("时间异常")
    for booking in bookings:
        if booking.get("status") in ("cancelled", "deleted"):
            continue
        try:
            start = parse_time(booking["start_time"])
            end = parse_time(booking["end_time"])
            if end <= start:
                print(f"时间异常: 预约 {booking['id']}")
                print(f"  结束时间早于或等于开始时间")
                print(f"  时段: {booking['start_time']} - {booking['end_time']}")
                print()
                issues.append(f"time_invalid:{booking['id']}")
        except Exception:
            print(f"时间格式异常: 预约 {booking['id']}")
            issues.append(f"time_format:{booking['id']}")
    
    print_section("检查摘要")
    if issues:
        print(f"发现 {len(issues)} 个问题需要处理")
        print("\n问题列表:")
        for issue in issues:
            print(f"  - {issue}")
    else:
        print("所有检查通过，未发现异常")
    
    return len(issues)


def cmd_fix(args):
    """人工修正"""
    print_header("人工修正")
    
    booking_id = args.booking_id
    booking = get_by_id("bookings", booking_id)
    
    if not booking:
        print(f"预约 {booking_id} 不存在")
        return 1
    
    print(f"当前预约信息:")
    print(f"  ID: {booking['id']}")
    print(f"  排练厅: {booking['room_id']}")
    print(f"  时段: {booking['start_time']} - {booking['end_time']}")
    print(f"  状态: {booking.get('status', 'unknown')}")
    print()
    
    if args.action == "reschedule":
        print("执行改期...")
        try:
            history = reschedule_booking(
                booking_id,
                args.new_start,
                args.new_end,
                args.reason
            )
            print(f"改期成功:")
            print(f"  原时段: {history['old_start']} - {history['old_end']}")
            print(f"  新时段: {history['new_start']} - {history['new_end']}")
            print(f"  原因: {history['reason']}")
        except ValueError as e:
            print(f"改期失败: {e}")
            return 1
    
    elif args.action == "cancel":
        update_item("bookings", booking_id, {"status": "cancelled", "cancelled_at": format_time(datetime.now())})
        print(f"预约 {booking_id} 已取消")
    
    elif args.action == "delete":
        success, message = safe_delete_booking(booking_id)
        print(message)
        if not success:
            return 1
    
    elif args.action == "update":
        updates = {}
        if args.room_id:
            updates["room_id"] = args.room_id
        if args.start_time:
            updates["start_time"] = args.start_time
        if args.end_time:
            updates["end_time"] = args.end_time
        if updates:
            update_item("bookings", booking_id, updates)
            print(f"预约 {booking_id} 已更新")
        else:
            print("未提供更新内容")
            return 1
    
    return 0


def cmd_confirm(args):
    """最终确认"""
    print_header("最终确认")
    
    booking_id = args.booking_id
    booking = get_by_id("bookings", booking_id)
    
    if not booking:
        print(f"预约 {booking_id} 不存在")
        return 1
    
    print("执行冲突预检查...")
    conflicts = find_all_conflicts()
    
    has_conflict = False
    for c_type, c_list in conflicts.items():
        for c in c_list:
            if c["booking1_id"] == booking_id or c["booking2_id"] == booking_id:
                print(f"发现冲突: {c_type}")
                has_conflict = True
    
    if has_conflict and not args.force:
        print("\n存在冲突，无法确认。请先解决冲突或使用 --force 强制确认。")
        return 1
    
    result = confirm_booking(booking_id)
    if result:
        print(f"预约 {booking_id} 已确认")
        print(f"确认时间: {result['confirmed_at']}")
    else:
        print("确认失败")
        return 1
    
    return 0


def cmd_key(args):
    """钥匙领取管理"""
    if args.action == "pickup":
        print_header("领取钥匙")
        record = pickup_key(args.booking_id, args.contact_id)
        print(f"钥匙已领取")
        print(f"  记录ID: {record['id']}")
        print(f"  预约ID: {record['booking_id']}")
        print(f"  领取时间: {record['pickup_time']}")
    
    elif args.action == "return":
        print_header("归还钥匙")
        result = return_key(args.record_id)
        if result:
            print(f"钥匙已归还")
            print(f"  记录ID: {result['id']}")
            print(f"  归还时间: {result['return_time']}")
        else:
            print(f"钥匙记录 {args.record_id} 不存在")
            return 1
    
    elif args.action == "list":
        print_header("钥匙领取记录")
        records = load_data("key_records")
        if not records:
            print("暂无钥匙记录")
            return
        
        for r in records:
            status_icon = "🔑" if r["status"] == "picked_up" else "✅"
            print(f"{status_icon} 记录ID: {r['id']}")
            print(f"   预约ID: {r['booking_id']}")
            print(f"   领取人: {r['contact_id']}")
            print(f"   领取时间: {r['pickup_time']}")
            if r.get("return_time"):
                print(f"   归还时间: {r['return_time']}")
            print()


def cmd_report(args):
    """报表输出"""
    
    if args.type == "conflicts":
        print_header("冲突清单")
        conflicts = find_all_conflicts()
        
        total = len(conflicts["room_conflicts"]) + len(conflicts["equipment_conflicts"])
        print(f"总计 {total} 个冲突\n")
        
        print_section("排练厅冲突")
        if conflicts["room_conflicts"]:
            for i, c in enumerate(conflicts["room_conflicts"], 1):
                b1 = get_by_id("bookings", c["booking1_id"])
                b2 = get_by_id("bookings", c["booking2_id"])
                room = get_by_id("rooms", c["room_id"])
                room_name = room["name"] if room else c["room_id"]
                
                print(f"{i}. 排练厅: {room_name}")
                print(f"   预约1: {c['booking1_id']} ({b1['start_time']} - {b1['end_time']})")
                print(f"   预约2: {c['booking2_id']} ({b2['start_time']} - {b2['end_time']})")
                print()
        else:
            print("无")
        
        print_section("设备冲突")
        if conflicts["equipment_conflicts"]:
            for i, c in enumerate(conflicts["equipment_conflicts"], 1):
                b1 = get_by_id("bookings", c["booking1_id"])
                b2 = get_by_id("bookings", c["booking2_id"])
                equip_names = []
                for eid in c["equipment_ids"]:
                    equip = get_by_id("equipment", eid)
                    equip_names.append(equip["name"] if equip else eid)
                
                print(f"{i}. 设备: {', '.join(equip_names)}")
                print(f"   预约1: {c['booking1_id']} ({b1['start_time']} - {b1['end_time']})")
                print(f"   预约2: {c['booking2_id']} ({b2['start_time']} - {b2['end_time']})")
                print()
        else:
            print("无")
    
    elif args.type == "available":
        print_header("可排时段")
        
        rooms = load_data("rooms")
        if not rooms:
            print("暂无排练厅数据")
            return
        
        if args.room_id:
            rooms = [r for r in rooms if r["id"] == args.room_id]
        
        for room in rooms:
            print_section(f"排练厅: {room['name']} ({room['id']})")
            
            start_date = parse_date(args.start) if args.start else date.today()
            end_date = parse_date(args.end) if args.end else start_date + timedelta(days=7)
            
            slots = find_available_slots(room["id"], start_date, end_date, args.min_hours)
            
            if slots:
                for slot in slots:
                    print(f"  {slot['date']}: {slot['start']} - {slot['end']} ({slot['hours']}小时)")
            else:
                print("  无可排时段")
            print()
    
    elif args.type == "weekly":
        print_header("本周排练表")
        
        start_date = parse_date(args.start) if args.start else date.today()
        start_of_week = start_date - timedelta(days=start_date.weekday())
        
        bookings = get_weekly_schedule(start_of_week)
        
        if not bookings:
            print("本周暂无排练安排")
            return
        
        current_day = None
        for booking in bookings:
            start = parse_time(booking["start_time"])
            day_key = start.strftime("%Y-%m-%d %A")
            
            if day_key != current_day:
                current_day = day_key
                print_section(f"{day_key}")
            
            room = get_by_id("rooms", booking["room_id"])
            room_name = room["name"] if room else booking["room_id"]
            contact = get_by_id("contacts", booking["contact_id"])
            contact_name = contact["name"] if contact else booking["contact_id"]
            crew_name = contact["crew_name"] if contact else ""
            
            status_mark = "✅" if booking.get("status") == "confirmed" else "⏳"
            cross_mark = "🌙" if is_cross_midnight(start, parse_time(booking["end_time"])) else ""
            
            print(f"{status_mark} {booking['start_time']} - {booking['end_time']} {cross_mark}")
            print(f"   预约ID: {booking['id']}")
            print(f"   排练厅: {room_name}")
            print(f"   剧组: {crew_name} ({contact_name})")
            if booking.get("equipment_ids"):
                equip_names = []
                for eid in booking["equipment_ids"]:
                    equip = get_by_id("equipment", eid)
                    equip_names.append(equip["name"] if equip else eid)
                print(f"   设备: {', '.join(equip_names)}")
            print()
    
    elif args.type == "reschedule":
        print_header("改期历史")
        
        history = load_data("reschedule_history")
        if not history:
            print("暂无改期记录")
            return
        
        history.sort(key=lambda x: x["created_at"], reverse=True)
        
        for i, record in enumerate(history, 1):
            booking = get_by_id("bookings", record["booking_id"])
            contact = get_by_id("contacts", booking["contact_id"]) if booking else None
            crew_name = contact["crew_name"] if contact else "未知"
            
            print(f"{i}. 预约ID: {record['booking_id']}")
            print(f"   剧组: {crew_name}")
            print(f"   改期时间: {record['created_at']}")
            print(f"   原时段: {record['old_start']} - {record['old_end']}")
            print(f"   新时段: {record['new_start']} - {record['new_end']}")
            print(f"   原因: {record['reason']}")
            print()


def parse_date(date_str: str) -> date:
    """解析日期字符串"""
    return datetime.strptime(date_str, "%Y-%m-%d").date()


from datetime import timedelta


def main():
    """主入口"""
    parser = argparse.ArgumentParser(
        description="小剧场排练场地冲突 CLI 工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  theater-cli rooms list
  theater-cli import bookings.json
  theater-cli check
  theater-cli fix reschedule b001 --new-start "2026-05-12 14:00" --new-end "2026-05-12 18:00" --reason "导演调整"
  theater-cli confirm b001
  theater-cli report conflicts
  theater-cli report available --room-id r001
  theater-cli report weekly
        """
    )
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    rooms_parser = subparsers.add_parser("rooms", help="管理排练厅")
    rooms_sub = rooms_parser.add_subparsers(dest="action")
    rooms_list = rooms_sub.add_parser("list", help="列出排练厅")
    rooms_add = rooms_sub.add_parser("add", help="添加排练厅")
    rooms_add.add_argument("--name", required=True, help="排练厅名称")
    rooms_add.add_argument("--capacity", type=int, help="容量")
    rooms_add.add_argument("--features", help="设施(逗号分隔)")
    
    equip_parser = subparsers.add_parser("equipment", help="管理设备包")
    equip_sub = equip_parser.add_subparsers(dest="action")
    equip_list = equip_sub.add_parser("list", help="列出设备包")
    equip_add = equip_sub.add_parser("add", help="添加设备包")
    equip_add.add_argument("--name", required=True, help="设备名称")
    equip_add.add_argument("--description", help="描述")
    
    contact_parser = subparsers.add_parser("contacts", help="管理剧组联系人")
    contact_sub = contact_parser.add_subparsers(dest="action")
    contact_list = contact_sub.add_parser("list", help="列出联系人")
    contact_add = contact_sub.add_parser("add", help="添加联系人")
    contact_add.add_argument("--name", required=True, help="姓名")
    contact_add.add_argument("--crew", required=True, help="剧组名称")
    contact_add.add_argument("--phone", help="电话")
    contact_add.add_argument("--email", help="邮箱")
    
    import_parser = subparsers.add_parser("import", help="导入预约数据")
    import_parser.add_argument("file", help="JSON文件路径")
    
    check_parser = subparsers.add_parser("check", help="异常检查")
    
    fix_parser = subparsers.add_parser("fix", help="人工修正")
    fix_parser.add_argument("--booking-id", required=True, help="预约ID")
    fix_sub = fix_parser.add_subparsers(dest="action")
    
    fix_reschedule = fix_sub.add_parser("reschedule", help="改期")
    fix_reschedule.add_argument("--new-start", required=True, help="新开始时间 (YYYY-MM-DD HH:MM)")
    fix_reschedule.add_argument("--new-end", required=True, help="新结束时间 (YYYY-MM-DD HH:MM)")
    fix_reschedule.add_argument("--reason", required=True, help="改期原因")
    
    fix_cancel = fix_sub.add_parser("cancel", help="取消预约")
    fix_delete = fix_sub.add_parser("delete", help="删除预约")
    
    fix_update = fix_sub.add_parser("update", help="更新预约信息")
    fix_update.add_argument("--room-id", help="新排练厅ID")
    fix_update.add_argument("--start-time", help="新开始时间")
    fix_update.add_argument("--end-time", help="新结束时间")
    
    confirm_parser = subparsers.add_parser("confirm", help="最终确认预约")
    confirm_parser.add_argument("booking_id", help="预约ID")
    confirm_parser.add_argument("--force", action="store_true", help="强制确认(忽略冲突)")
    
    key_parser = subparsers.add_parser("key", help="钥匙领取管理")
    key_sub = key_parser.add_subparsers(dest="action")
    key_pickup = key_sub.add_parser("pickup", help="领取钥匙")
    key_pickup.add_argument("--booking-id", required=True, help="预约ID")
    key_pickup.add_argument("--contact-id", required=True, help="联系人ID")
    key_return = key_sub.add_parser("return", help="归还钥匙")
    key_return.add_argument("record_id", help="钥匙记录ID")
    key_list = key_sub.add_parser("list", help="列出钥匙记录")
    
    report_parser = subparsers.add_parser("report", help="报表输出")
    report_parser.add_argument("type", choices=["conflicts", "available", "weekly", "reschedule"],
                              help="报表类型: conflicts(冲突清单), available(可排时段), weekly(本周表), reschedule(改期历史)")
    report_parser.add_argument("--room-id", help="排练厅ID (用于available)")
    report_parser.add_argument("--start", help="开始日期 (YYYY-MM-DD)")
    report_parser.add_argument("--end", help="结束日期 (YYYY-MM-DD)")
    report_parser.add_argument("--min-hours", type=int, default=1, help="最小时长(小时)")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 0
    
    handlers = {
        "rooms": cmd_rooms,
        "equipment": cmd_equipment,
        "contacts": cmd_contacts,
        "import": cmd_import,
        "check": cmd_check,
        "fix": cmd_fix,
        "confirm": cmd_confirm,
        "key": cmd_key,
        "report": cmd_report,
    }
    
    handler = handlers.get(args.command)
    if handler:
        return handler(args) or 0
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
