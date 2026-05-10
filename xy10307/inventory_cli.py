#!/usr/bin/env python3
import csv
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from collections import defaultdict


DATA_DIR = Path("./inventory_data")
EQUIPMENT_FILE = DATA_DIR / "equipment.json"
BORROW_RECORDS_FILE = DATA_DIR / "borrow_records.json"
DAMAGE_RECORDS_FILE = DATA_DIR / "damage_records.json"
ANOMALIES_FILE = DATA_DIR / "anomalies.json"


STATUS_GOOD = "完好"
STATUS_BORROWED = "借出"
STATUS_DAMAGED = "损坏"
STATUS_LOST = "遗失"
STATUS_ANOMALY = "异常"


def ensure_data_dir():
    DATA_DIR.mkdir(exist_ok=True)


def load_json(filepath, default):
    if filepath.exists():
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    return default


def save_json(filepath, data):
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def parse_date(date_str):
    if not date_str:
        return None
    formats = ["%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d", "%Y-%m-%d %H:%M", "%Y/%m/%d %H:%M"]
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    return None


def format_date(dt):
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d")
    return dt


def record_hash(record, fields):
    key_parts = [str(record.get(f, "")).strip() for f in fields]
    return "|".join(key_parts)


def cmd_init(args):
    ensure_data_dir()
    if EQUIPMENT_FILE.exists() and not args.force:
        print("错误：台账已存在，使用 --force 覆盖初始化")
        sys.exit(1)
    
    save_json(EQUIPMENT_FILE, {})
    save_json(BORROW_RECORDS_FILE, [])
    save_json(DAMAGE_RECORDS_FILE, [])
    save_json(ANOMALIES_FILE, [])
    print(f"已初始化台账系统于 {DATA_DIR.resolve()}")


def cmd_add(args):
    ensure_data_dir()
    equipment = load_json(EQUIPMENT_FILE, {})
    
    if args.id in equipment:
        print(f"错误：器材编号 {args.id} 已存在")
        sys.exit(1)
    
    equipment[args.id] = {
        "id": args.id,
        "name": args.name,
        "category": args.category or "",
        "owner": args.owner or "",
        "status": STATUS_GOOD,
        "notes": args.notes or "",
        "created_at": format_date(datetime.now()),
        "updated_at": format_date(datetime.now())
    }
    
    save_json(EQUIPMENT_FILE, equipment)
    print(f"已添加器材：{args.id} - {args.name}")


def cmd_list(args):
    equipment = load_json(EQUIPMENT_FILE, {})
    if not equipment:
        print("暂无器材")
        return
    
    print(f"{'编号':<12} {'名称':<15} {'类别':<10} {'负责人':<10} {'状态':<8} {'备注'}")
    print("-" * 80)
    for eq_id, eq in sorted(equipment.items()):
        print(f"{eq_id:<12} {eq['name']:<15} {eq['category']:<10} {eq['owner']:<10} {eq['status']:<8} {eq['notes']}")


def cmd_import_borrow(args):
    ensure_data_dir()
    equipment = load_json(EQUIPMENT_FILE, {})
    records = load_json(BORROW_RECORDS_FILE, [])
    anomalies = load_json(ANOMALIES_FILE, [])
    
    existing_hashes = {
        record_hash(r, ["equipment_id", "borrower", "borrow_date"])
        for r in records
    }
    
    added_count = 0
    skipped_count = 0
    anomaly_count = 0
    
    with open(args.file, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            row = {k.strip(): str(v).strip() if v else "" for k, v in row.items()}
            
            eq_id = row.get("器材编号", "").strip()
            borrower = row.get("借用人", "").strip()
            borrow_date_str = row.get("借出日期", "").strip()
            return_date_str = row.get("归还日期", "").strip()
            
            current = {
                "equipment_id": eq_id,
                "borrower": borrower,
                "borrow_date": borrow_date_str,
                "return_date": return_date_str,
                "notes": row.get("备注", "").strip(),
                "imported_at": format_date(datetime.now())
            }
            
            is_anomaly = False
            anomaly_reasons = []
            
            if not eq_id:
                is_anomaly = True
                anomaly_reasons.append("器材编号缺失")
            elif eq_id not in equipment:
                is_anomaly = True
                anomaly_reasons.append(f"器材编号 {eq_id} 不存在于台账")
            
            borrow_date = parse_date(borrow_date_str)
            return_date = parse_date(return_date_str)
            
            if return_date and borrow_date and return_date < borrow_date:
                is_anomaly = True
                anomaly_reasons.append(f"归还时间({return_date_str})早于借出时间({borrow_date_str})")
            
            h = record_hash(current, ["equipment_id", "borrower", "borrow_date"])
            if h in existing_hashes:
                skipped_count += 1
                continue
            
            if is_anomaly:
                anomalies.append({
                    **current,
                    "anomaly_reasons": anomaly_reasons,
                    "source": "borrow_import"
                })
                anomaly_count += 1
            else:
                records.append(current)
                existing_hashes.add(h)
                added_count += 1
    
    save_json(BORROW_RECORDS_FILE, records)
    save_json(ANOMALIES_FILE, anomalies)
    print(f"导入完成：新增 {added_count} 条，跳过重复 {skipped_count} 条，异常 {anomaly_count} 条")


def cmd_damage(args):
    ensure_data_dir()
    equipment = load_json(EQUIPMENT_FILE, {})
    damage_records = load_json(DAMAGE_RECORDS_FILE, [])
    anomalies = load_json(ANOMALIES_FILE, [])
    
    if args.id not in equipment:
        print(f"错误：器材编号 {args.id} 不存在")
        sys.exit(1)
    
    eq = equipment[args.id]
    damage_type = "遗失" if args.lost else "损坏"
    
    is_anomaly = False
    anomaly_reasons = []
    
    if eq["status"] in [STATUS_DAMAGED, STATUS_LOST]:
        is_anomaly = True
        anomaly_reasons.append(f"器材已处于 {eq['status']} 状态")
    
    if args.lost and args.damaged:
        is_anomaly = True
        anomaly_reasons.append("不能同时标记为损坏和遗失")
    
    record = {
        "equipment_id": args.id,
        "equipment_name": eq["name"],
        "damage_type": damage_type,
        "reported_by": args.by or "",
        "reported_at": format_date(datetime.now()),
        "description": args.desc or "",
        "compensation_needed": bool(args.compensation)
    }
    
    if is_anomaly:
        anomalies.append({
            **record,
            "anomaly_reasons": anomaly_reasons,
            "source": "damage_report"
        })
        save_json(ANOMALIES_FILE, anomalies)
        print(f"警告：记录已进入异常列表 - {', '.join(anomaly_reasons)}")
    else:
        damage_records.append(record)
        eq["status"] = STATUS_LOST if args.lost else STATUS_DAMAGED
        eq["updated_at"] = format_date(datetime.now())
        
        save_json(DAMAGE_RECORDS_FILE, damage_records)
        save_json(EQUIPMENT_FILE, equipment)
        print(f"已登记 {damage_type}：{args.id} - {eq['name']}")


def cmd_anomalies(args):
    anomalies = load_json(ANOMALIES_FILE, [])
    if not anomalies:
        print("暂无异常记录")
        return
    
    print(f"共 {len(anomalies)} 条异常记录：")
    print("=" * 60)
    for i, a in enumerate(anomalies, 1):
        print(f"\n【异常 #{i}】来源: {a.get('source', 'unknown')}")
        if a.get('equipment_id'):
            print(f"  器材: {a['equipment_id']}")
        print(f"  原因: {', '.join(a.get('anomaly_reasons', []))}")
        if a.get('borrower'):
            print(f"  借用人: {a['borrower']}")


def cmd_report(args):
    ensure_data_dir()
    equipment = load_json(EQUIPMENT_FILE, {})
    borrow_records = load_json(BORROW_RECORDS_FILE, [])
    damage_records = load_json(DAMAGE_RECORDS_FILE, [])
    anomalies = load_json(ANOMALIES_FILE, [])
    
    by_owner = defaultdict(list)
    for eq_id, eq in equipment.items():
        owner = eq["owner"] or "(未分配)"
        by_owner[owner].append(eq)
    
    lines = []
    lines.append("=" * 80)
    lines.append("校园社团器材盘点交接报告")
    lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("=" * 80)
    lines.append("")
    
    lines.append("-" * 80)
    lines.append("一、整体统计")
    lines.append("-" * 80)
    total = len(equipment)
    good = sum(1 for eq in equipment.values() if eq["status"] == STATUS_GOOD)
    borrowed = sum(1 for eq in equipment.values() if eq["status"] == STATUS_BORROWED)
    damaged = sum(1 for eq in equipment.values() if eq["status"] == STATUS_DAMAGED)
    lost = sum(1 for eq in equipment.values() if eq["status"] == STATUS_LOST)
    
    lines.append(f"器材总数: {total}")
    lines.append(f"  - 完好: {good}")
    lines.append(f"  - 借出中: {borrowed}")
    lines.append(f"  - 损坏: {damaged}")
    lines.append(f"  - 遗失: {lost}")
    lines.append(f"待复核异常: {len(anomalies)}")
    lines.append("")
    
    lines.append("-" * 80)
    lines.append("二、按责任人汇总")
    lines.append("-" * 80)
    
    for owner in sorted(by_owner.keys()):
        eqs = by_owner[owner]
        good_list = [e for e in eqs if e["status"] == STATUS_GOOD]
        borrowed_list = [e for e in eqs if e["status"] == STATUS_BORROWED]
        damaged_list = [e for e in eqs if e["status"] == STATUS_DAMAGED]
        lost_list = [e for e in eqs if e["status"] == STATUS_LOST]
        
        lines.append(f"\n【责任人】{owner} (共 {len(eqs)} 件)")
        lines.append(f"  完好: {len(good_list)} | 借出: {len(borrowed_list)} | 损坏: {len(damaged_list)} | 遗失: {len(lost_list)}")
        
        if good_list:
            lines.append("  ▶ 完好器材:")
            for e in good_list:
                lines.append(f"    {e['id']} - {e['name']} ({e['category'] or '未分类'})")
        
        if borrowed_list:
            lines.append("  ▶ 借出中器材 (需追回):")
            for e in borrowed_list:
                related = [r for r in borrow_records if r["equipment_id"] == e["id"] and not r["return_date"]]
                for r in related:
                    lines.append(f"    {e['id']} - {e['name']} | 借用人: {r['borrower']} | 借出日期: {r['borrow_date']}")
        
        if damaged_list or lost_list:
            lines.append("  ▶ 待赔偿器材:")
            for e in damaged_list + lost_list:
                dmg = next((d for d in damage_records if d["equipment_id"] == e["id"]), None)
                comp = "(需赔偿)" if (dmg and dmg.get("compensation_needed")) else "(待确认)"
                lines.append(f"    {e['id']} - {e['name']} | 状态: {e['status']} {comp}")
                if dmg and dmg.get("description"):
                    lines.append(f"      说明: {dmg['description']}")
    
    lines.append("")
    lines.append("-" * 80)
    lines.append("三、待人工复核的异常记录")
    lines.append("-" * 80)
    
    if anomalies:
        for i, a in enumerate(anomalies, 1):
            lines.append(f"\n[异常 #{i}]")
            lines.append(f"  来源: {a.get('source', 'unknown')}")
            if a.get('equipment_id'):
                lines.append(f"  器材编号: {a['equipment_id']}")
            lines.append(f"  异常原因: {', '.join(a.get('anomaly_reasons', []))}")
            if a.get('borrower'):
                lines.append(f"  借用人: {a['borrower']}")
    else:
        lines.append("  无异常记录")
    
    lines.append("")
    lines.append("=" * 80)
    lines.append("报告结束")
    lines.append("=" * 80)
    
    report = "\n".join(lines)
    
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"报告已导出至: {args.output}")
    else:
        print(report)


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="校园社团器材盘点 CLI")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    init_parser = subparsers.add_parser("init", help="初始化台账系统")
    init_parser.add_argument("--force", action="store_true", help="覆盖已有数据")
    
    add_parser = subparsers.add_parser("add", help="添加器材到台账")
    add_parser.add_argument("id", help="器材编号")
    add_parser.add_argument("name", help="器材名称")
    add_parser.add_argument("--category", help="器材类别(相机/音箱/帐篷/展板等)")
    add_parser.add_argument("--owner", help="负责人")
    add_parser.add_argument("--notes", help="备注")
    
    list_parser = subparsers.add_parser("list", help="列出所有器材")
    
    import_parser = subparsers.add_parser("import", help="导入借出归还记录")
    import_parser.add_argument("file", help="CSV 文件路径")
    
    damage_parser = subparsers.add_parser("damage", help="登记损坏或遗失")
    damage_parser.add_argument("id", help="器材编号")
    damage_group = damage_parser.add_mutually_exclusive_group(required=True)
    damage_group.add_argument("--damaged", action="store_true", help="登记损坏")
    damage_group.add_argument("--lost", action="store_true", help="登记遗失")
    damage_parser.add_argument("--by", help="报备人")
    damage_parser.add_argument("--desc", help="情况描述")
    damage_parser.add_argument("--compensation", action="store_true", help="需要赔偿")
    
    anomalies_parser = subparsers.add_parser("anomalies", help="查看异常列表")
    
    report_parser = subparsers.add_parser("report", help="生成盘点报告")
    report_parser.add_argument("--output", help="输出文件路径(可选)")
    
    args = parser.parse_args()
    
    if args.command == "init":
        cmd_init(args)
    elif args.command == "add":
        cmd_add(args)
    elif args.command == "list":
        cmd_list(args)
    elif args.command == "import":
        cmd_import_borrow(args)
    elif args.command == "damage":
        cmd_damage(args)
    elif args.command == "anomalies":
        cmd_anomalies(args)
    elif args.command == "report":
        cmd_report(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
