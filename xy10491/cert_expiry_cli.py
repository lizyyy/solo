#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
员工证件到期管理 CLI 工具
用于管理员工证件到期提醒、补交记录和合规报告
"""

import argparse
import json
import os
import sys
from datetime import datetime, date, timedelta
from pathlib import Path

DATA_DIR = Path.home() / ".cert_expiry"
EMPLOYEES_FILE = DATA_DIR / "employees.json"
POSITIONS_FILE = DATA_DIR / "positions.json"
CERT_TYPES_FILE = DATA_DIR / "cert_types.json"
REMINDERS_FILE = DATA_DIR / "reminders.json"
SCHEDULES_FILE = DATA_DIR / "schedules.json"

DATE_FORMATS = ["%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d"]
EXPIRY_WARNING_DAYS = 30


def init_data_dir():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for f in [EMPLOYEES_FILE, POSITIONS_FILE, CERT_TYPES_FILE, REMINDERS_FILE, SCHEDULES_FILE]:
        if not f.exists():
            f.write_text("{}")


def load_json(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(filepath, data):
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def parse_date(date_str):
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(date_str.strip(), fmt).date()
        except ValueError:
            continue
    raise ValueError(f"日期格式错误: {date_str}，支持格式: YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD")


def format_date(d):
    return d.strftime("%Y-%m-%d") if d else "无"


def get_days_until_expiry(expiry_date):
    today = date.today()
    if isinstance(expiry_date, str):
        expiry_date = parse_date(expiry_date)
    return (expiry_date - today).days


def is_expired(expiry_date):
    return get_days_until_expiry(expiry_date) < 0


def is_expiring_soon(expiry_date, days=EXPIRY_WARNING_DAYS):
    days_left = get_days_until_expiry(expiry_date)
    return 0 <= days_left <= days


def cmd_init(args):
    init_data_dir()
    print("✅ 数据目录已初始化:", DATA_DIR)


def cmd_import_cert_types(args):
    init_data_dir()
    cert_types = load_json(CERT_TYPES_FILE)
    
    new_types = json.loads(args.types) if args.types else []
    
    for ct in new_types:
        name = ct.get("name")
        if not name:
            print(f"⚠️ 跳过无效证件类型: {ct}")
            continue
        cert_types[name] = {
            "name": name,
            "description": ct.get("description", ""),
            "required_for_positions": ct.get("required_for_positions", [])
        }
    
    save_json(CERT_TYPES_FILE, cert_types)
    print(f"✅ 已导入 {len(new_types)} 种证件类型")


def cmd_import_positions(args):
    init_data_dir()
    positions = load_json(POSITIONS_FILE)
    
    new_positions = json.loads(args.positions) if args.positions else []
    
    for pos in new_positions:
        name = pos.get("name")
        if not name:
            print(f"⚠️ 跳过无效岗位: {pos}")
            continue
        positions[name] = {
            "name": name,
            "description": pos.get("description", ""),
            "required_certs": pos.get("required_certs", [])
        }
    
    save_json(POSITIONS_FILE, positions)
    print(f"✅ 已导入 {len(new_positions)} 个岗位")


def cmd_import_employees(args):
    init_data_dir()
    employees = load_json(EMPLOYEES_FILE)
    
    new_employees = json.loads(args.employees) if args.employees else []
    errors = []
    warnings = []
    
    for emp in new_employees:
        emp_id = emp.get("id") or emp.get("employee_id")
        if not emp_id:
            errors.append(f"缺少员工ID: {emp}")
            continue
        
        name = emp.get("name", emp.get("employee_name", ""))
        position = emp.get("position", "")
        certs = emp.get("certificates", [])
        cert_records = []
        
        for cert in certs:
            cert_name = cert.get("type") or cert.get("cert_type", "")
            expiry_str = cert.get("expiry_date", "")
            try:
                expiry_date = parse_date(expiry_str) if expiry_str else None
                cert_records.append({
                    "type": cert_name,
                    "expiry_date": format_date(expiry_date),
                    "status": cert.get("status", "active"),
                    "submission_records": cert.get("submission_records", [])
                })
            except ValueError as e:
                errors.append(f"员工 {name}({emp_id}) 证件 {cert_name} 到期日格式错误: {expiry_str}")
        
        positions = load_json(POSITIONS_FILE)
        if position and position in positions:
            pos_data = positions[position]
            required_certs = set(pos_data.get("required_certs", []))
            employee_certs = set(c["type"] for c in cert_records)
            missing_certs = required_certs - employee_certs
            for mc in missing_certs:
                warnings.append(f"⚠️ 员工 {name}({emp_id}) 岗位 {position} 需要证件 {mc} 但未提供")
        
        existing = employees.get(emp_id, {})
        existing_certs = existing.get("certificates", [])
        
        merged_certs = {}
        for ec in existing_certs:
            merged_certs[ec["type"]] = ec
        for nc in cert_records:
            if nc["type"] in merged_certs:
                existing_record = merged_certs[nc["type"]]
                existing_submissions = existing_record.get("submission_records", [])
                nc["submission_records"] = list(set(existing_submissions + nc.get("submission_records", [])))
            merged_certs[nc["type"]] = nc
        
        employees[emp_id] = {
            "id": emp_id,
            "name": name,
            "position": position,
            "certificates": list(merged_certs.values()),
            "contact": emp.get("contact", existing.get("contact", "")),
            "department": emp.get("department", existing.get("department", ""))
        }
    
    save_json(EMPLOYEES_FILE, employees)
    
    for err in errors:
        print("❌", err)
    for warn in warnings:
        print(warn)
    
    print(f"✅ 已导入 {len(new_employees) - len(errors)} 名员工")


def cmd_list_expiring(args):
    init_data_dir()
    employees = load_json(EMPLOYEES_FILE)
    threshold = args.days or EXPIRY_WARNING_DAYS
    
    print(f"\n=== 即将到期证件 ({threshold} 天内) ===")
    found = False
    
    for emp_id, emp in employees.items():
        for cert in emp.get("certificates", []):
            if not cert.get("expiry_date"):
                continue
            if is_expiring_soon(cert["expiry_date"], threshold):
                days_left = get_days_until_expiry(cert["expiry_date"])
                found = True
                print(f"  员工: {emp['name']} ({emp_id})")
                print(f"    岗位: {emp.get('position', '无')}")
                print(f"    证件: {cert['type']}")
                print(f"    到期日: {cert['expiry_date']} (剩余 {days_left} 天)")
                print()
    
    if not found:
        print("  无即将到期证件")


def cmd_list_expired(args):
    init_data_dir()
    employees = load_json(EMPLOYEES_FILE)
    
    print("\n=== 已过期证件 ===")
    found = False
    
    for emp_id, emp in employees.items():
        for cert in emp.get("certificates", []):
            if not cert.get("expiry_date"):
                continue
            if is_expired(cert["expiry_date"]):
                days_over = abs(get_days_until_expiry(cert["expiry_date"]))
                found = True
                print(f"  员工: {emp['name']} ({emp_id})")
                print(f"    岗位: {emp.get('position', '无')}")
                print(f"    证件: {cert['type']}")
                print(f"    到期日: {cert['expiry_date']} (已过期 {days_over} 天)")
                print()
    
    if not found:
        print("  无已过期证件")


def cmd_list_restricted(args):
    init_data_dir()
    employees = load_json(EMPLOYEES_FILE)
    positions = load_json(POSITIONS_FILE)
    
    print("\n=== 受限岗位名单 ===")
    restricted = []
    
    for emp_id, emp in employees.items():
        pos_name = emp.get("position")
        if not pos_name or pos_name not in positions:
            continue
        
        pos_data = positions[pos_name]
        required_certs = set(pos_data.get("required_certs", []))
        
        has_invalid_cert = False
        missing_certs = set()
        
        for req_cert in required_certs:
            found = False
            for emp_cert in emp.get("certificates", []):
                if emp_cert["type"] == req_cert:
                    found = True
                    if is_expired(emp_cert.get("expiry_date", "")):
                        has_invalid_cert = True
                    break
            if not found:
                missing_certs.add(req_cert)
        
        if has_invalid_cert or missing_certs:
            restricted.append({
                "employee": emp,
                "has_invalid_cert": has_invalid_cert,
                "missing_certs": list(missing_certs)
            })
    
    if restricted:
        for r in restricted:
            emp = r["employee"]
            print(f"  员工: {emp['name']} ({emp['id']})")
            print(f"    岗位: {emp['position']}")
            if r["missing_certs"]:
                print(f"    缺失证件: {', '.join(r['missing_certs'])}")
            if r["has_invalid_cert"]:
                print(f"    存在已过期证件")
            print()
    else:
        print("  无受限岗位")
    
    schedules = load_json(SCHEDULES_FILE)
    today = date.today()
    
    for sch in schedules.values():
        sch_date_str = sch.get("date", "")
        try:
            sch_date = parse_date(sch_date_str)
        except:
            continue
        
        if sch_date >= today:
            emp_id = sch.get("employee_id")
            if emp_id in employees:
                emp = employees[emp_id]
                pos_name = emp.get("position")
                if pos_name and pos_name in positions:
                    required_certs = set(positions[pos_name].get("required_certs", []))
                    for cert in emp.get("certificates", []):
                        if cert["type"] in required_certs and is_expired(cert.get("expiry_date", "")):
                            print(f"⚠️ 警告: 员工 {emp['name']} 证件 {cert['type']} 已过期但仍有排班 ({sch_date_str})")


def cmd_employee(args):
    init_data_dir()
    employees = load_json(EMPLOYEES_FILE)
    
    emp_id = args.employee_id
    if emp_id not in employees:
        print(f"❌ 未找到员工: {emp_id}")
        return
    
    emp = employees[emp_id]
    print(f"\n=== 员工详情 ===")
    print(f"ID: {emp['id']}")
    print(f"姓名: {emp['name']}")
    print(f"岗位: {emp.get('position', '无')}")
    print(f"部门: {emp.get('department', '无')}")
    print(f"联系方式: {emp.get('contact', '无')}")
    print()
    
    print(f"=== 证件信息 ===")
    for cert in emp.get("certificates", []):
        exp_date = cert.get("expiry_date", "无")
        status = "有效"
        if exp_date and exp_date != "无":
            if is_expired(exp_date):
                days = abs(get_days_until_expiry(exp_date))
                status = f"已过期 ({days} 天)"
            elif is_expiring_soon(exp_date):
                days = get_days_until_expiry(exp_date)
                status = f"即将到期 ({days} 天)"
        
        print(f"  证件类型: {cert['type']}")
        print(f"  到期日: {exp_date}")
        print(f"  状态: {status}")
        
        submissions = cert.get("submission_records", [])
        if submissions:
            print(f"  补交记录:")
            for s in submissions:
                print(f"    - {s}")
        print()


def cmd_submit(args):
    init_data_dir()
    employees = load_json(EMPLOYEES_FILE)
    
    emp_id = args.employee_id
    cert_type = args.cert_type
    new_expiry = args.new_expiry_date
    
    if emp_id not in employees:
        print(f"❌ 未找到员工: {emp_id}")
        return
    
    emp = employees[emp_id]
    
    try:
        parsed_date = parse_date(new_expiry)
    except ValueError as e:
        print(f"❌ {e}")
        return
    
    cert_found = False
    for cert in emp.get("certificates", []):
        if cert["type"] == cert_type:
            cert_found = True
            old_expiry = cert.get("expiry_date", "无")
            cert["expiry_date"] = format_date(parsed_date)
            cert["status"] = "active"
            submission_record = f"补交于 {format_date(date.today())}，新到期日: {format_date(parsed_date)}"
            if "submission_records" not in cert:
                cert["submission_records"] = []
            cert["submission_records"].append(submission_record)
            print(f"✅ 已登记 {emp['name']} 的 {cert_type} 补交")
            print(f"   旧到期日: {old_expiry}")
            print(f"   新到期日: {format_date(parsed_date)}")
            break
    
    if not cert_found:
        print(f"❌ 员工 {emp['name']} 没有 {cert_type} 类型的证件")
        return
    
    save_json(EMPLOYEES_FILE, employees)


def cmd_remind(args):
    init_data_dir()
    employees = load_json(EMPLOYEES_FILE)
    reminders = load_json(REMINDERS_FILE)
    threshold = args.days or EXPIRY_WARNING_DAYS
    
    print("\n=== 生成提醒记录 ===")
    new_reminders = []
    
    for emp_id, emp in employees.items():
        for cert in emp.get("certificates", []):
            exp_date = cert.get("expiry_date")
            if not exp_date or exp_date == "无":
                continue
            
            needs_reminder = False
            if is_expired(exp_date):
                needs_reminder = True
                status = "已过期"
            elif is_expiring_soon(exp_date, threshold):
                needs_reminder = True
                status = "即将到期"
            
            if needs_reminder:
                reminder_key = f"{emp_id}_{cert['type']}_{exp_date}"
                reminder = {
                    "id": reminder_key,
                    "employee_id": emp_id,
                    "employee_name": emp["name"],
                    "position": emp.get("position", ""),
                    "certificate_type": cert["type"],
                    "expiry_date": exp_date,
                    "status": status,
                    "generated_at": format_date(date.today()),
                    "generated_time": datetime.now().strftime("%H:%M:%S"),
                    "notified_person": args.notified_person or "人事专员",
                    "notification_method": args.method or "系统通知",
                    "confirmed": False
                }
                reminders[reminder_key] = reminder
                new_reminders.append(reminder)
    
    save_json(REMINDERS_FILE, reminders)
    
    for r in new_reminders:
        print(f"  提醒 {r['employee_name']}({r['employee_id']}) - {r['certificate_type']} {r['status']}")
        print(f"    通知人: {r['notified_person']} | 方式: {r['notification_method']}")
        print(f"    生成时间: {r['generated_at']} {r['generated_time']}")
        print()
    
    print(f"\n✅ 共生成 {len(new_reminders)} 条提醒记录")
    if new_reminders:
        print(f"   提醒记录已保存，可作为通知证明")


def cmd_list_reminders(args):
    init_data_dir()
    reminders = load_json(REMINDERS_FILE)
    
    if args.employee_id:
        reminders = {k: v for k, v in reminders.items() if v["employee_id"] == args.employee_id}
    
    print(f"\n=== 提醒记录 ({len(reminders)} 条) ===")
    
    for r in reminders.values():
        print(f"  员工: {r['employee_name']} ({r['employee_id']})")
        print(f"    证件: {r['certificate_type']} | 状态: {r['status']}")
        print(f"    到期日: {r['expiry_date']}")
        print(f"    通知人: {r['notified_person']} | 方式: {r['notification_method']}")
        print(f"    生成时间: {r['generated_at']} {r['generated_time']}")
        print(f"    已确认: {'是' if r.get('confirmed') else '否'}")
        print()
    
    if not reminders:
        print("  无提醒记录")


def cmd_confirm_reminder(args):
    init_data_dir()
    reminders = load_json(REMINDERS_FILE)
    
    reminder_id = args.reminder_id
    if reminder_id not in reminders:
        print(f"❌ 未找到提醒: {reminder_id}")
        return
    
    reminders[reminder_id]["confirmed"] = True
    reminders[reminder_id]["confirmed_at"] = format_date(date.today())
    reminders[reminder_id]["confirmed_by"] = args.confirmed_by or "人事专员"
    
    save_json(REMINDERS_FILE, reminders)
    print(f"✅ 已确认提醒 {reminder_id}")


def cmd_import_schedule(args):
    init_data_dir()
    schedules = load_json(SCHEDULES_FILE)
    employees = load_json(EMPLOYEES_FILE)
    positions = load_json(POSITIONS_FILE)
    
    new_schedules = json.loads(args.schedules) if args.schedules else []
    warnings = []
    
    for sch in new_schedules:
        emp_id = sch.get("employee_id")
        sch_date = sch.get("date")
        
        if not emp_id or not sch_date:
            continue
        
        if emp_id in employees:
            emp = employees[emp_id]
            pos_name = emp.get("position")
            if pos_name and pos_name in positions:
                required_certs = set(positions[pos_name].get("required_certs", []))
                for cert in emp.get("certificates", []):
                    if cert["type"] in required_certs and is_expired(cert.get("expiry_date", "")):
                        warnings.append(f"⚠️ 员工 {emp['name']}({emp_id}) 证件 {cert['type']} 已过期，排班日期: {sch_date}")
        
        key = f"{emp_id}_{sch_date}"
        schedules[key] = {
            "employee_id": emp_id,
            "date": sch_date,
            "shift": sch.get("shift", "")
        }
    
    save_json(SCHEDULES_FILE, schedules)
    
    for w in warnings:
        print(w)
    print(f"✅ 已导入 {len(new_schedules)} 条排班记录")


def cmd_export_report(args):
    init_data_dir()
    employees = load_json(EMPLOYEES_FILE)
    positions = load_json(POSITIONS_FILE)
    reminders = load_json(REMINDERS_FILE)
    
    report = {
        "generated_at": format_date(date.today()),
        "generated_time": datetime.now().strftime("%H:%M:%S"),
        "summary": {
            "total_employees": len(employees),
            "expiring_soon": 0,
            "expired": 0,
            "restricted_positions": 0
        },
        "expiring_soon": [],
        "expired": [],
        "restricted_positions": [],
        "reminders": list(reminders.values())
    }
    
    for emp_id, emp in employees.items():
        for cert in emp.get("certificates", []):
            exp_date = cert.get("expiry_date", "")
            if not exp_date:
                continue
            if is_expiring_soon(exp_date):
                report["summary"]["expiring_soon"] += 1
                report["expiring_soon"].append({
                    "employee_id": emp_id,
                    "employee_name": emp["name"],
                    "position": emp.get("position", ""),
                    "certificate": cert["type"],
                    "expiry_date": exp_date,
                    "days_left": get_days_until_expiry(exp_date)
                })
            if is_expired(exp_date):
                report["summary"]["expired"] += 1
                report["expired"].append({
                    "employee_id": emp_id,
                    "employee_name": emp["name"],
                    "position": emp.get("position", ""),
                    "certificate": cert["type"],
                    "expiry_date": exp_date,
                    "days_overdue": abs(get_days_until_expiry(exp_date))
                })
        
        pos_name = emp.get("position")
        if pos_name and pos_name in positions:
            pos_data = positions[pos_name]
            required_certs = set(pos_data.get("required_certs", []))
            has_issue = False
            issues = []
            
            for req_cert in required_certs:
                found = False
                for emp_cert in emp.get("certificates", []):
                    if emp_cert["type"] == req_cert:
                        found = True
                        if is_expired(emp_cert.get("expiry_date", "")):
                            has_issue = True
                            issues.append(f"{req_cert} 已过期")
                        break
                if not found:
                    has_issue = True
                    issues.append(f"{req_cert} 缺失")
            
            if has_issue:
                report["summary"]["restricted_positions"] += 1
                report["restricted_positions"].append({
                    "employee_id": emp_id,
                    "employee_name": emp["name"],
                    "position": pos_name,
                    "issues": issues
                })
    
    output_file = args.output or "compliance_report.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    print(f"\n=== 合规报告 ===")
    print(f"总员工数: {report['summary']['total_employees']}")
    print(f"即将到期: {report['summary']['expiring_soon']}")
    print(f"已过期: {report['summary']['expired']}")
    print(f"受限岗位: {report['summary']['restricted_positions']}")
    print(f"\n✅ 报告已导出到: {output_file}")


def cmd_sample(args):
    print("\n=== 样例数据 ===")
    
    print("""
1. 证件类型 (样例):
[
  {"name": "健康证", "description": "食品行业从业必需", "required_for_positions": ["厨师", "服务员"]},
  {"name": "叉车证", "description": "特种设备操作证", "required_for_positions": ["叉车司机"]},
  {"name": "工作签证", "description": "外籍员工工作许可", "required_for_positions": ["外籍技术人员"]}
]
""")
    
    print("""
2. 岗位 (样例):
[
  {"name": "厨师", "description": "厨房工作人员", "required_certs": ["健康证"]},
  {"name": "叉车司机", "description": "仓库叉车操作员", "required_certs": ["叉车证"]},
  {"name": "外籍技术人员", "description": "外籍技术支持", "required_certs": ["工作签证"]},
  {"name": "服务员", "description": "餐厅服务员", "required_certs": ["健康证"]}
]
""")
    
    print("""
3. 员工 (样例):
[
  {
    "id": "E001",
    "name": "张三",
    "position": "厨师",
    "department": "厨房",
    "contact": "13800138001",
    "certificates": [
      {"type": "健康证", "expiry_date": "2026-06-15"}
    ]
  },
  {
    "id": "E002",
    "name": "李四",
    "position": "叉车司机",
    "department": "仓库",
    "contact": "13800138002",
    "certificates": [
      {"type": "叉车证", "expiry_date": "2025-03-20"}
    ]
  },
  {
    "id": "E003",
    "name": "John Smith",
    "position": "外籍技术人员",
    "department": "技术部",
    "contact": "john@company.com",
    "certificates": [
      {"type": "工作签证", "expiry_date": "2026-05-20"}
    ]
  }
]
""")
    
    print("""
4. 排班 (样例):
[
  {"employee_id": "E002", "date": "2026-05-15", "shift": "早班"}
]
""")
    
    print("""
=== 使用示例 ===

# 初始化
python cert_expiry_cli.py init

# 导入证件类型
python cert_expiry_cli.py import-cert-types --types '[
  {"name": "健康证"},
  {"name": "叉车证"},
  {"name": "工作签证"}
]'

# 导入岗位
python cert_expiry_cli.py import-positions --positions '[
  {"name": "厨师", "required_certs": ["健康证"]},
  {"name": "叉车司机", "required_certs": ["叉车证"]}
]'

# 导入员工
python cert_expiry_cli.py import-employees --employees '[
  {
    "id": "E001",
    "name": "张三",
    "position": "厨师",
    "certificates": [{"type": "健康证", "expiry_date": "2026-06-15"}]
  }
]'

# 查看即将到期
python cert_expiry_cli.py expiring --days 30

# 查看已过期
python cert_expiry_cli.py expired

# 查看受限岗位
python cert_expiry_cli.py restricted

# 登记补交
python cert_expiry_cli.py submit --employee-id E001 --cert-type 健康证 --new-expiry-date 2027-06-15

# 查看员工
python cert_expiry_cli.py employee --employee-id E001

# 生成提醒
python cert_expiry_cli.py remind --notified-person 王经理 --method 邮件

# 导出报告
python cert_expiry_cli.py export-report --output report.json
""")


def main():
    parser = argparse.ArgumentParser(description="员工证件到期管理 CLI 工具")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    subparsers.add_parser("init", help="初始化数据目录")
    
    p_import_cert = subparsers.add_parser("import-cert-types", help="导入证件类型")
    p_import_cert.add_argument("--types", required=True, help="JSON格式的证件类型列表")
    
    p_import_pos = subparsers.add_parser("import-positions", help="导入岗位")
    p_import_pos.add_argument("--positions", required=True, help="JSON格式的岗位列表")
    
    p_import_emp = subparsers.add_parser("import-employees", help="导入员工")
    p_import_emp.add_argument("--employees", required=True, help="JSON格式的员工列表")
    
    p_import_sch = subparsers.add_parser("import-schedules", help="导入排班记录")
    p_import_sch.add_argument("--schedules", required=True, help="JSON格式的排班列表")
    
    p_expiring = subparsers.add_parser("expiring", help="列出即将到期证件")
    p_expiring.add_argument("--days", type=int, help="到期天数阈值（默认30天）")
    
    subparsers.add_parser("expired", help="列出已过期证件")
    subparsers.add_parser("restricted", help="列出受限岗位")
    
    p_emp = subparsers.add_parser("employee", help="查看单个员工")
    p_emp.add_argument("--employee-id", required=True, help="员工ID")
    
    p_submit = subparsers.add_parser("submit", help="登记补交")
    p_submit.add_argument("--employee-id", required=True, help="员工ID")
    p_submit.add_argument("--cert-type", required=True, help="证件类型")
    p_submit.add_argument("--new-expiry-date", required=True, help="新到期日")
    
    p_remind = subparsers.add_parser("remind", help="生成提醒记录")
    p_remind.add_argument("--days", type=int, help="到期天数阈值")
    p_remind.add_argument("--notified-person", help="通知责任人")
    p_remind.add_argument("--method", help="通知方式")
    
    p_list_rem = subparsers.add_parser("list-reminders", help="列出提醒记录")
    p_list_rem.add_argument("--employee-id", help="按员工ID过滤")
    
    p_confirm = subparsers.add_parser("confirm-reminder", help="确认提醒")
    p_confirm.add_argument("--reminder-id", required=True, help="提醒ID")
    p_confirm.add_argument("--confirmed-by", help="确认人")
    
    p_export = subparsers.add_parser("export-report", help="导出合规报告")
    p_export.add_argument("--output", help="输出文件路径")
    
    subparsers.add_parser("sample", help="显示样例数据和使用方法")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    commands = {
        "init": cmd_init,
        "import-cert-types": cmd_import_cert_types,
        "import-positions": cmd_import_positions,
        "import-employees": cmd_import_employees,
        "import-schedules": cmd_import_schedule,
        "expiring": cmd_list_expiring,
        "expired": cmd_list_expired,
        "restricted": cmd_list_restricted,
        "employee": cmd_employee,
        "submit": cmd_submit,
        "remind": cmd_remind,
        "list-reminders": cmd_list_reminders,
        "confirm-reminder": cmd_confirm_reminder,
        "export-report": cmd_export_report,
        "sample": cmd_sample
    }
    
    commands[args.command](args)


if __name__ == "__main__":
    main()
