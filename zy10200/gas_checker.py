#!/usr/bin/env python3
"""夜市摊位燃气瓶巡检 CLI"""

import argparse
import json
import os
import sys
from datetime import datetime, date
from pathlib import Path
from typing import Dict, List, Optional, Any

DATA_DIR = Path(os.environ.get("GAS_CHECKER_DATA_DIR", str(Path.home() / ".gas_checker")))
RECORDS_FILE = DATA_DIR / "records.json"
CONFIG_FILE = DATA_DIR / "config.json"


def ensure_data_dir():
    """确保数据目录存在"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def load_records() -> List[Dict[str, Any]]:
    """加载所有巡检记录"""
    if not RECORDS_FILE.exists():
        return []
    with open(RECORDS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_records(records: List[Dict[str, Any]]):
    """保存巡检记录"""
    ensure_data_dir()
    with open(RECORDS_FILE, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)


def generate_id(stall_id: str, gas_bottle_no: str, inspection_date: str, risk_desc: str) -> str:
    """生成记录唯一ID，用于去重"""
    import hashlib
    key = f"{stall_id}|{gas_bottle_no}|{inspection_date}|{risk_desc}"
    return hashlib.md5(key.encode("utf-8")).hexdigest()[:12]


def validate_date(date_str: str) -> bool:
    """验证日期格式是否正确"""
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
        return True
    except ValueError:
        return False


def parse_date(date_str: str) -> date:
    """解析日期字符串"""
    return datetime.strptime(date_str, "%Y-%m-%d").date()


def cmd_init(args):
    """初始化命令"""
    ensure_data_dir()
    
    if not CONFIG_FILE.exists():
        config = {
            "created_at": datetime.now().isoformat(),
            "description": "夜市摊位燃气瓶巡检系统",
            "statuses": ["待整改", "待复核", "已闭环"],
            "risk_levels": ["低", "中", "高"]
        }
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
    
    if not RECORDS_FILE.exists():
        save_records([])
    
    print(f"✅ 初始化完成")
    print(f"📁 数据目录: {DATA_DIR}")
    print(f"📋 记录文件: {RECORDS_FILE}")


def cmd_import(args):
    """导入命令"""
    if not args.file.endswith(".json"):
        print(f"❌ 错误：只支持 JSON 格式文件")
        return
    
    if not os.path.exists(args.file):
        print(f"❌ 错误：文件不存在: {args.file}")
        return
    
    try:
        with open(args.file, "r", encoding="utf-8") as f:
            import_data = json.load(f)
    except Exception as e:
        print(f"❌ 错误：文件解析失败: {e}")
        return
    
    records = load_records()
    existing_ids = {r["id"] for r in records}
    
    new_records = []
    duplicate_count = 0
    error_count = 0
    
    for idx, item in enumerate(import_data, 1):
        errors = validate_single_record(item, idx)
        if errors:
            error_count += 1
            for err in errors:
                print(f"⚠️ 第{idx}条记录: {err}")
            continue
        
        record_id = generate_id(
            item["stall_id"],
            item["gas_bottle_no"],
            item["inspection_date"],
            item.get("risk_description", "")
        )
        
        if record_id in existing_ids:
            duplicate_count += 1
            continue
        
        record = {
            "id": record_id,
            "stall_id": item["stall_id"],
            "gas_bottle_no": item["gas_bottle_no"],
            "inspector": item["inspector"],
            "inspection_date": item["inspection_date"],
            "photo_placeholder": item.get("photo_placeholder", ""),
            "risk_level": item.get("risk_level", "中"),
            "risk_description": item.get("risk_description", ""),
            "deadline": item.get("deadline", ""),
            "status": item.get("status", "待整改"),
            "rectification_date": item.get("rectification_date", ""),
            "rectification_photo": item.get("rectification_photo", ""),
            "reviewer": item.get("reviewer", ""),
            "review_result": item.get("review_result", ""),
            "review_date": item.get("review_date", ""),
            "fire_extinguisher_expiry": item.get("fire_extinguisher_expiry", ""),
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        new_records.append(record)
        existing_ids.add(record_id)
    
    if new_records:
        records.extend(new_records)
        save_records(records)
    
    print(f"\n📊 导入结果:")
    print(f"  ✅ 成功导入: {len(new_records)} 条")
    if duplicate_count > 0:
        print(f"  ⚠️  重复跳过: {duplicate_count} 条")
    if error_count > 0:
        print(f"  ❌ 校验失败: {error_count} 条")


def validate_single_record(item: Dict, line_num: int) -> List[str]:
    """校验单条记录"""
    errors = []
    
    required_fields = ["stall_id", "gas_bottle_no", "inspector", "inspection_date"]
    for field in required_fields:
        if not item.get(field):
            errors.append(f"缺少必填字段: {field}")
    
    if item.get("inspection_date") and not validate_date(item["inspection_date"]):
        errors.append(f"巡检日期格式错误: {item['inspection_date']}")
    
    if item.get("deadline") and not validate_date(item["deadline"]):
        errors.append(f"整改期限格式错误: {item['deadline']}")
    
    if item.get("rectification_date"):
        if not validate_date(item["rectification_date"]):
            errors.append(f"整改日期格式错误: {item['rectification_date']}")
        elif item.get("inspection_date"):
            insp_date = parse_date(item["inspection_date"])
            rect_date = parse_date(item["rectification_date"])
            if rect_date < insp_date:
                errors.append(f"整改日期({item['rectification_date']})早于发现日期({item['inspection_date']})")
    
    if item.get("review_date") and not validate_date(item["review_date"]):
        errors.append(f"复核日期格式错误: {item['review_date']}")
    
    if item.get("fire_extinguisher_expiry") and not validate_date(item["fire_extinguisher_expiry"]):
        errors.append(f"灭火器过期日期格式错误: {item['fire_extinguisher_expiry']}")
    
    return errors


def cmd_validate(args):
    """校验命令"""
    records = load_records()
    
    if not records:
        print("ℹ️ 暂无记录")
        return
    
    issues = []
    today = date.today()
    
    for record in records:
        issues.extend(validate_record_status(record, today))
    
    if issues:
        print(f"🔍 发现 {len(issues)} 个问题:\n")
        for issue in issues:
            print(f"  ⚠️  {issue}")
    else:
        print("✅ 所有记录状态正常")
    
    print(f"\n📊 统计信息:")
    print(f"  总记录数: {len(records)}")
    
    status_counts = {}
    for r in records:
        status = r["status"]
        status_counts[status] = status_counts.get(status, 0) + 1
    
    for status, count in status_counts.items():
        print(f"    {status}: {count} 条")


def validate_record_status(record: Dict, today: date) -> List[str]:
    """校验记录状态"""
    issues = []
    stall_info = f"[摊位{record['stall_id']}-{record['gas_bottle_no']}]"
    
    if record["status"] == "已闭环" and not record.get("review_result"):
        issues.append(f"{stall_info} 状态已闭环但无复核结果")
    
    if record["status"] in ["待整改", "待复核"]:
        if record.get("deadline"):
            deadline = parse_date(record["deadline"])
            if today > deadline:
                days_overdue = (today - deadline).days
                issues.append(f"{stall_info} 整改已超期 {days_overdue} 天（截止：{record['deadline']}）")
    
    if record.get("fire_extinguisher_expiry"):
        exp_date = parse_date(record["fire_extinguisher_expiry"])
        if today >= exp_date:
            issues.append(f"{stall_info} 灭火器已过期（过期日期：{record['fire_extinguisher_expiry']}）")
        elif (exp_date - today).days <= 30:
            days_left = (exp_date - today).days
            issues.append(f"{stall_info} 灭火器将在 {days_left} 天后过期（过期日期：{record['fire_extinguisher_expiry']}）")
    
    if record["status"] == "待复核" and not record.get("rectification_date"):
        issues.append(f"{stall_info} 状态为待复核但无整改日期")
    
    return issues


def cmd_confirm(args):
    """确认/更新记录状态"""
    records = load_records()
    
    if not records:
        print("ℹ️ 暂无记录")
        return
    
    if args.id:
        record = next((r for r in records if r["id"] == args.id), None)
        if not record:
            print(f"❌ 未找到记录 ID: {args.id}")
            return
        records_to_process = [record]
    else:
        records_to_process = [r for r in records if r["status"] in ["待整改", "待复核"]]
    
    if not records_to_process:
        print("ℹ️ 没有需要处理的记录")
        return
    
    updated_count = 0
    
    for record in records_to_process:
        print(f"\n{'='*50}")
        print(f"记录ID: {record['id']}")
        print(f"摊位: {record['stall_id']}  燃气瓶: {record['gas_bottle_no']}")
        print(f"巡检人: {record['inspector']}  日期: {record['inspection_date']}")
        print(f"当前状态: {record['status']}")
        print(f"风险等级: {record['risk_level']}")
        print(f"风险描述: {record['risk_description']}")
        print(f"整改期限: {record['deadline'] or '未设置'}")
        
        if args.status:
            new_status = args.status
        else:
            print("\n选择操作:")
            print("  1) 标记为已整改（待复核）")
            print("  2) 复核通过（已闭环）")
            print("  3) 复核不通过（返回待整改）")
            print("  4) 跳过")
            choice = input("请选择 (1-4): ").strip()
            
            if choice == "1":
                new_status = "待复核"
            elif choice == "2":
                new_status = "已闭环"
            elif choice == "3":
                new_status = "待整改"
            else:
                continue
        
        if new_status == "待复核":
            rect_date = args.rectification_date or input("整改日期 (YYYY-MM-DD，回车使用今天): ").strip() or today().isoformat()
            record["rectification_date"] = rect_date
            record["rectification_photo"] = args.rectification_photo or input("整改照片占位 (可选): ").strip()
        
        elif new_status == "已闭环":
            if not record.get("rectification_date"):
                print("⚠️  该记录还没有整改日期，请先标记为已整改")
                continue
            
            reviewer = args.reviewer or input("复核人: ").strip()
            review_result = args.review_result or input("复核结果: ").strip()
            review_date = args.review_date or input("复核日期 (YYYY-MM-DD，回车使用今天): ").strip() or today().isoformat()
            
            record["reviewer"] = reviewer
            record["review_result"] = review_result
            record["review_date"] = review_date
        
        record["status"] = new_status
        record["updated_at"] = datetime.now().isoformat()
        updated_count += 1
        print(f"✅ 状态已更新为: {new_status}")
    
    if updated_count > 0:
        save_records(records)
        print(f"\n📊 共更新 {updated_count} 条记录")


def today() -> date:
    """获取今天日期"""
    return date.today()


def cmd_history(args):
    """历史查询"""
    records = load_records()
    
    if not records:
        print("ℹ️ 暂无记录")
        return
    
    filtered = records
    
    if args.stall:
        filtered = [r for r in filtered if r["stall_id"] == args.stall]
    
    if args.status:
        filtered = [r for r in filtered if r["status"] == args.status]
    
    if args.start:
        filtered = [r for r in filtered if r["inspection_date"] >= args.start]
    
    if args.end:
        filtered = [r for r in filtered if r["inspection_date"] <= args.end]
    
    if args.gas_bottle:
        filtered = [r for r in filtered if r["gas_bottle_no"] == args.gas_bottle]
    
    if not filtered:
        print("ℹ️ 没有符合条件的记录")
        return
    
    filtered.sort(key=lambda r: r["inspection_date"], reverse=True)
    
    print(f"\n📋 查询结果（共 {len(filtered)} 条）:\n")
    
    for record in filtered:
        status_symbol = "✅" if record["status"] == "已闭环" else "⏳" if record["status"] == "待复核" else "🔴"
        print(f"{status_symbol} [{record['inspection_date']}] 摊位{record['stall_id']} | 燃气瓶:{record['gas_bottle_no']}")
        print(f"   巡检人: {record['inspector']} | 风险等级: {record['risk_level']}")
        print(f"   状态: {record['status']} | 整改期限: {record['deadline'] or '未设置'}")
        if record["risk_description"]:
            print(f"   风险描述: {record['risk_description']}")
        if record["status"] == "已闭环":
            print(f"   复核人: {record['reviewer']} | 复核结果: {record['review_result']}")
        print()


def cmd_export(args):
    """导出日报"""
    records = load_records()
    
    if not records:
        print("ℹ️ 暂无记录")
        return
    
    today_str = args.date or today().isoformat()
    
    open_risks = [r for r in records if r["status"] in ["待整改", "待复核"]]
    closed_count = len([r for r in records if r["status"] == "已闭环"])
    
    expired_extinguishers = []
    overdue_items = []
    today_date = parse_date(today_str)
    
    for record in records:
        if record.get("fire_extinguisher_expiry"):
            exp_date = parse_date(record["fire_extinguisher_expiry"])
            if today_date >= exp_date:
                expired_extinguishers.append(record)
        
        if record["status"] in ["待整改", "待复核"] and record.get("deadline"):
            deadline = parse_date(record["deadline"])
            if today_date > deadline:
                overdue_items.append(record)
    
    output = []
    output.append(f"# 夜市燃气巡检日报")
    output.append(f"**日期**: {today_str}")
    output.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    output.append("")
    
    output.append("## 📊 总览")
    output.append(f"| 指标 | 数量 |")
    output.append(f"|------|------|")
    output.append(f"| 巡检记录总数 | {len(records)} |")
    output.append(f"| 未闭环风险 | {len(open_risks)} |")
    output.append(f"| 已闭环 | {closed_count} |")
    output.append(f"| 超期待整改 | {len(overdue_items)} |")
    output.append(f"| 灭火器过期 | {len(expired_extinguishers)} |")
    output.append("")
    
    if open_risks:
        output.append("## 🔴 未闭环风险（重点关注）")
        open_risks.sort(key=lambda r: (
            0 if r["status"] == "待整改" and r.get("deadline") and parse_date(r["deadline"]) < today_date 
            else 1 if r["status"] == "待整改" else 2,
            r.get("deadline") or "9999-12-31"
        ))
        output.append("| 优先级 | 摊位 | 燃气瓶 | 风险等级 | 状态 | 整改期限 | 风险描述 |")
        output.append("|--------|------|--------|----------|------|----------|----------|")
        for r in open_risks:
            priority = "❗ 超期" if r.get("deadline") and parse_date(r["deadline"]) < today_date else "⏳"
            output.append(f"| {priority} | {r['stall_id']} | {r['gas_bottle_no']} | {r['risk_level']} | {r['status']} | {r['deadline'] or '-'} | {r['risk_description'] or '-'} |")
        output.append("")
    
    if expired_extinguishers:
        output.append("## ⚠️ 灭火器过期告警")
        output.append("| 摊位 | 燃气瓶 | 过期日期 |")
        output.append("|------|--------|----------|")
        for r in expired_extinguishers:
            output.append(f"| {r['stall_id']} | {r['gas_bottle_no']} | {r['fire_extinguisher_expiry']} |")
        output.append("")
    
    if overdue_items:
        output.append("## ❗ 超期待整改")
        output.append("| 摊位 | 燃气瓶 | 超期天数 | 整改期限 | 风险描述 |")
        output.append("|------|--------|----------|----------|----------|")
        for r in overdue_items:
            days = (today_date - parse_date(r["deadline"])).days
            output.append(f"| {r['stall_id']} | {r['gas_bottle_no']} | {days}天 | {r['deadline']} | {r['risk_description'] or '-'} |")
        output.append("")
    
    output.append("## 📋 今日巡检摘要")
    today_records = [r for r in records if r["inspection_date"] == today_str]
    if today_records:
        for r in today_records:
            status = "✅ 已闭环" if r["status"] == "已闭环" else "⏳ 待复核" if r["status"] == "待复核" else "🔴 待整改"
            output.append(f"- [{r['stall_id']}] {r['gas_bottle_no']} - {r['inspector']} - {status}")
    else:
        output.append("今日无新巡检记录")
    
    result = "\n".join(output)
    
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(result)
        print(f"✅ 日报已导出到: {args.output}")
    else:
        print(result)


def main():
    parser = argparse.ArgumentParser(description="夜市摊位燃气瓶巡检 CLI")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    subparsers.add_parser("init", help="初始化数据目录")
    
    import_parser = subparsers.add_parser("import", help="导入巡检记录 (JSON格式)")
    import_parser.add_argument("--file", "-f", required=True, help="JSON 文件路径")
    
    subparsers.add_parser("validate", help="校验所有记录状态")
    
    confirm_parser = subparsers.add_parser("confirm", help="确认/更新记录状态（交互式）")
    confirm_parser.add_argument("--id", help="指定记录ID处理")
    confirm_parser.add_argument("--status", choices=["待整改", "待复核", "已闭环"], help="目标状态")
    confirm_parser.add_argument("--rectification-date", help="整改日期 (YYYY-MM-DD)")
    confirm_parser.add_argument("--rectification-photo", help="整改照片占位")
    confirm_parser.add_argument("--reviewer", help="复核人")
    confirm_parser.add_argument("--review-result", help="复核结果")
    confirm_parser.add_argument("--review-date", help="复核日期 (YYYY-MM-DD)")
    
    history_parser = subparsers.add_parser("history", help="查询历史记录")
    history_parser.add_argument("--stall", help="按摊位编号筛选")
    history_parser.add_argument("--gas-bottle", help="按燃气瓶编号筛选")
    history_parser.add_argument("--status", choices=["待整改", "待复核", "已闭环"], help="按状态筛选")
    history_parser.add_argument("--start", help="开始日期 (YYYY-MM-DD)")
    history_parser.add_argument("--end", help="结束日期 (YYYY-MM-DD)")
    
    export_parser = subparsers.add_parser("export", help="导出巡检日报")
    export_parser.add_argument("--date", help="日报日期 (YYYY-MM-DD，默认今天)")
    export_parser.add_argument("--output", "-o", help="输出文件路径")
    
    args = parser.parse_args()
    
    if args.command == "init":
        cmd_init(args)
    elif args.command == "import":
        cmd_import(args)
    elif args.command == "validate":
        cmd_validate(args)
    elif args.command == "confirm":
        cmd_confirm(args)
    elif args.command == "history":
        cmd_history(args)
    elif args.command == "export":
        cmd_export(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
