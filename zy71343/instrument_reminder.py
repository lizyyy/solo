#!/usr/bin/env python3
"""
乐器保养提醒工具 —— 琴行售后本地小工具
用法:
  python instrument_reminder.py check        # 全量检查(去重+超期+提醒刷新)
  python instrument_reminder.py remind       # 生成保养提醒报告
  python instrument_reminder.py repair-backfill  # 维修回写提醒刷新
  python instrument_reminder.py export       # 导出可转发报告(文本)
"""

import json
import argparse
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime, date, timedelta
from pathlib import Path
from typing import Optional

DATA_DIR = Path(__file__).parent / "data"
INSTRUMENTS_FILE = DATA_DIR / "instruments.json"
CUSTOMERS_FILE = DATA_DIR / "customers.json"
MAINTENANCE_FILE = DATA_DIR / "maintenance_items.json"
REPAIRS_FILE = DATA_DIR / "repairs.json"
REMINDERS_FILE = DATA_DIR / "reminders.json"

MAINTENANCE_CYCLES = {
    "guitar": {
        "换弦": 90,
        "指板保养": 180,
        "琴颈调节": 365,
    },
    "saxophone": {
        "垫片检查": 180,
        "按键润滑": 90,
        "管体清洁": 60,
    },
    "violin": {
        "弓毛更换": 180,
        "琴弦更换": 120,
        "琴体清洁保养": 90,
    },
}
CYCLE_RULE_EXPLANATION = (
    "【保养周期规则说明】\n"
    "  吉他: 换弦90天 | 指板保养180天 | 琴颈调节365天\n"
    "  萨克斯: 垫片检查180天 | 按键润滑90天 | 管体清洁60天\n"
    "  小提琴: 弓毛更换180天 | 琴弦更换120天 | 琴体清洁保养90天\n"
    "  周期从上次保养完成日期起算；若无保养记录则从购买日期起算。\n"
    "  超期判定: 当前日期 - 上次完成日期 > 周期天数 → 标记 OVERDUE\n"
)

DEDUP_RULE_EXPLANATION = (
    "【客户去重规则说明】\n"
    "  匹配优先级: 1) 手机号完全一致 → 2) 姓名相同且乐器档案有交集 → 标记为疑似重复\n"
    "  处理方式: 仅标记 CONFLICT，不做自动合并；需人工确认后手动合并。\n"
    "  手机号变更: 新旧号码共存时，同时标记两条记录为 CONFLICT_PHONE_CHANGE。\n"
)

REPAIR_WRITEBACK_RULE_EXPLANATION = (
    "【维修回写规则说明】\n"
    "  维修完成后，系统自动将维修日期回写为相关保养项目的最近完成日期，\n"
    "  并重新计算下次提醒时间。若回写后提醒状态未刷新(仍在 OVERDUE)，\n"
    "  标记 STALE_REMINDER，需人工检查。\n"
)

REMINDER_STATUS_RULE_EXPLANATION = (
    "【提醒状态规则说明】\n"
    "  PENDING    : 未到提醒时间，正常等待\n"
    "  DUE_SOON   : 距下次保养 ≤15天，即将到期\n"
    "  OVERDUE    : 已超过保养周期，需立即处理\n"
    "  DONE       : 已完成保养，等待下个周期\n"
    "  CONFLICT   : 数据冲突(去重/号码变更)，需人工确认\n"
    "  INCOMPLETE : 资料不完整，需补录\n"
)

EXPORT_RULE_EXPLANATION = (
    "【报告导出规则说明】\n"
    "  导出格式: 纯文本，方便微信/邮件直接转发\n"
    "  内容: 1) 待办汇总 2) 冲突清单 3) 超期明细 4) 提醒刷新异常 5) 补资料清单\n"
    "  每项均附带记录ID，可回溯到原始数据。\n"
)


@dataclass
class Customer:
    id: str
    name: str
    phone: str
    old_phones: list = field(default_factory=list)
    remark: str = ""


@dataclass
class Instrument:
    id: str
    customer_id: str
    type: str
    brand: str = ""
    model: str = ""
    purchase_date: str = ""


@dataclass
class MaintenanceItem:
    id: str
    instrument_id: str
    item_name: str
    last_done_date: str = ""
    cycle_days: int = 90
    status: str = "PENDING"
    note: str = ""


@dataclass
class Repair:
    id: str
    instrument_id: str
    repair_date: str
    repair_items: list = field(default_factory=list)
    description: str = ""


@dataclass
class Reminder:
    id: str
    maintenance_item_id: str
    remind_date: str
    status: str = "PENDING"
    sent: bool = False
    note: str = ""


def _load_json(path: Path, default=None):
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return default if default is not None else []


def _save_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_data():
    customers = [Customer(**c) for c in _load_json(CUSTOMERS_FILE, [])]
    instruments = [Instrument(**i) for i in _load_json(INSTRUMENTS_FILE, [])]
    items = [MaintenanceItem(**m) for m in _load_json(MAINTENANCE_FILE, [])]
    repairs = [Repair(**r) for r in _load_json(REPAIRS_FILE, [])]
    reminders = [Reminder(**r) for r in _load_json(REMINDERS_FILE, [])]
    return customers, instruments, items, repairs, reminders


def save_data(customers, instruments, items, repairs, reminders):
    _save_json(CUSTOMERS_FILE, [asdict(c) for c in customers])
    _save_json(INSTRUMENTS_FILE, [asdict(i) for i in instruments])
    _save_json(MAINTENANCE_FILE, [asdict(m) for m in items])
    _save_json(REPAIRS_FILE, [asdict(r) for r in repairs])
    _save_json(REMINDERS_FILE, [asdict(r) for r in reminders])


def today_str():
    return date.today().isoformat()


def parse_date(s: str) -> Optional[date]:
    if not s:
        return None
    return datetime.strptime(s, "%Y-%m-%d").date()


def find_customer_by_id(customers, cid):
    return next((c for c in customers if c.id == cid), None)


def find_instrument_by_id(instruments, iid):
    return next((i for i in instruments if i.id == iid), None)


def find_items_by_instrument(items, instrument_id):
    return [m for m in items if m.instrument_id == instrument_id]


def find_reminders_by_item(reminders, item_id):
    return [r for r in reminders if r.maintenance_item_id == item_id]


# ---------- 冲突标记(不自动合并) ----------

def detect_duplicate_customers(customers, instruments):
    """
    检测客户重复: 手机号完全一致 → 标记 CONFLICT
    姓名相同且有乐器交集 → 标记 CONFLICT
    新旧号码共存 → 标记 CONFLICT_PHONE_CHANGE
    只标记，不合并
    """
    conflicts = []
    seen_phones = {}
    seen_names = {}

    for c in customers:
        all_phones = [c.phone] + list(c.old_phones)
        for p in all_phones:
            if p in seen_phones and seen_phones[p] != c.id:
                other = find_customer_by_id(customers, seen_phones[p])
                conflicts.append({
                    "type": "DUPLICATE_PHONE",
                    "rule": "手机号完全一致 → 疑似重复客户",
                    "customer_ids": [c.id, other.id],
                    "detail": f"客户[{c.name}]与客户[{other.name}]共用手机号 {p}",
                    "action": "需人工确认后手动合并，不做自动合并",
                })

        if c.phone in c.old_phones:
            conflicts.append({
                "type": "CONFLICT_PHONE_CHANGE",
                "rule": "新手机号出现在旧号码列表 → 号码变更冲突",
                "customer_ids": [c.id],
                "detail": f"客户[{c.name}] 当前号码 {c.phone} 同时存在于 old_phones",
                "action": "确认号码变更是否完成，清理旧号码",
            })

        if c.name in seen_names and seen_names[c.name] != c.id:
            other = find_customer_by_id(customers, seen_names[c.name])
            c_insts = {i.id for i in instruments if i.customer_id == c.id}
            o_insts = {i.id for i in instruments if i.customer_id == other.id}
            overlap = c_insts & o_insts
            if overlap:
                conflicts.append({
                    "type": "DUPLICATE_NAME_INSTRUMENT",
                    "rule": "姓名相同且乐器档案有交集 → 疑似重复客户",
                    "customer_ids": [c.id, other.id],
                    "detail": f"客户[{c.name}]与客户[{other.name}]共有乐器 {overlap}",
                    "action": "需人工确认后手动合并，不做自动合并",
                })

        seen_phones[c.phone] = c.id
        for p in c.old_phones:
            seen_phones.setdefault(p, c.id)
        seen_names[c.name] = c.id

    return conflicts


def detect_overdue_maintenance(customers, instruments, items):
    """
    检测保养超期: 当前日期 - 上次完成日期 > 周期天数 → OVERDUE
    若无完成记录，从购买日期起算
    """
    today = date.today()
    overdue_list = []

    for item in items:
        inst = find_instrument_by_id(instruments, item.instrument_id)
        if not inst:
            continue

        last_done = parse_date(item.last_done_date)
        purchase = parse_date(inst.purchase_date)
        base_date = last_done if last_done else purchase

        if not base_date:
            overdue_list.append({
                "type": "INCOMPLETE_NO_DATE",
                "rule": "无上次保养日期也无购买日期 → 无法计算超期",
                "item_id": item.id,
                "instrument_id": item.instrument_id,
                "customer_id": inst.customer_id,
                "detail": f"保养项[{item.item_name}]缺少基准日期",
                "action": "补录购买日期或保养记录",
            })
            continue

        days_since = (today - base_date).days
        if days_since > item.cycle_days:
            cust = find_customer_by_id(customers, inst.customer_id)
            overdue_list.append({
                "type": "OVERDUE",
                "rule": f"距上次保养 {days_since}天 > 周期 {item.cycle_days}天 → 超期",
                "item_id": item.id,
                "instrument_id": item.instrument_id,
                "customer_id": inst.customer_id,
                "customer_name": cust.name if cust else "未知",
                "customer_phone": cust.phone if cust else "未知",
                "item_name": item.item_name,
                "overdue_days": days_since - item.cycle_days,
                "last_done_date": item.last_done_date or "(从购买日起算)",
                "instrument_type": inst.type,
                "brand": inst.brand,
                "action": "联系客户安排保养",
            })

    return overdue_list


def detect_stale_reminders(customers, instruments, items, repairs, reminders):
    """
    检测维修后提醒未刷新:
    若维修记录中包含某保养项，但该保养项的 last_done_date 早于维修日期，
    说明维修完成后未回写，标记 STALE_REMINDER
    """
    stale_list = []

    for repair in repairs:
        repair_date = parse_date(repair.repair_date)
        if not repair_date:
            continue
        inst = find_instrument_by_id(instruments, repair.instrument_id)
        if not inst:
            continue

        related_items = find_items_by_instrument(items, repair.instrument_id)
        for item in related_items:
            if item.item_name in repair.repair_items:
                last_done = parse_date(item.last_done_date)
                if not last_done or last_done < repair_date:
                    cust = find_customer_by_id(customers, inst.customer_id)
                    stale_list.append({
                        "type": "STALE_REMINDER",
                        "rule": f"维修[{repair.id}]含保养项[{item.item_name}]，但保养完成日期早于维修日期 → 提醒未刷新",
                        "repair_id": repair.id,
                        "repair_date": repair.repair_date,
                        "item_id": item.id,
                        "item_name": item.item_name,
                        "last_done_date": item.last_done_date or "(空)",
                        "instrument_id": repair.instrument_id,
                        "customer_id": inst.customer_id,
                        "customer_name": cust.name if cust else "未知",
                        "action": "将维修日期回写为保养完成日期，刷新提醒状态",
                    })

    return stale_list


def detect_incomplete_records(customers, instruments, items):
    """
    检测资料不完整的记录: 缺少关键字段 → INCOMPLETE
    """
    incomplete = []

    for c in customers:
        missing = []
        if not c.phone:
            missing.append("手机号")
        if not c.name:
            missing.append("姓名")
        if missing:
            incomplete.append({
                "type": "INCOMPLETE_CUSTOMER",
                "rule": "客户缺少关键字段 → 资料不完整",
                "record_type": "customer",
                "record_id": c.id,
                "detail": f"客户[{c.id}] 缺少: {', '.join(missing)}",
                "action": "补录客户信息",
            })

    for inst in instruments:
        missing = []
        if not inst.type:
            missing.append("乐器类型")
        if not inst.purchase_date:
            missing.append("购买日期")
        if not inst.customer_id:
            missing.append("客户ID")
        if missing:
            incomplete.append({
                "type": "INCOMPLETE_INSTRUMENT",
                "rule": "乐器档案缺少关键字段 → 资料不完整",
                "record_type": "instrument",
                "record_id": inst.id,
                "detail": f"乐器[{inst.id}] 缺少: {', '.join(missing)}",
                "action": "补录乐器档案信息",
            })

    for item in items:
        missing = []
        if not item.item_name:
            missing.append("保养项目名")
        if item.cycle_days <= 0:
            missing.append("有效保养周期")
        if not item.instrument_id:
            missing.append("乐器ID")
        if missing:
            incomplete.append({
                "type": "INCOMPLETE_MAINTENANCE",
                "rule": "保养项目缺少关键字段 → 资料不完整",
                "record_type": "maintenance_item",
                "record_id": item.id,
                "detail": f"保养项[{item.id}] 缺少: {', '.join(missing)}",
                "action": "补录保养项目信息",
            })

    return incomplete


# ---------- 提醒状态刷新 ----------

def refresh_reminder_statuses(customers, instruments, items, repairs, reminders):
    """
    根据当前日期刷新所有保养项和提醒的状态
    """
    today = date.today()

    for item in items:
        inst = find_instrument_by_id(instruments, item.instrument_id)
        if not inst:
            item.status = "INCOMPLETE"
            continue

        last_done = parse_date(item.last_done_date)
        purchase = parse_date(inst.purchase_date)
        base_date = last_done if last_done else purchase

        if not base_date:
            item.status = "INCOMPLETE"
            continue

        days_since = (today - base_date).days
        days_remaining = item.cycle_days - days_since

        if days_remaining < 0:
            item.status = "OVERDUE"
        elif days_remaining <= 15:
            item.status = "DUE_SOON"
        else:
            item.status = "PENDING"

    for reminder in reminders:
        item = next((m for m in items if m.id == reminder.maintenance_item_id), None)
        if not item:
            reminder.status = "INCOMPLETE"
            continue
        remind_date = parse_date(reminder.remind_date)
        if not remind_date:
            reminder.status = "INCOMPLETE"
            continue

        if item.status == "OVERDUE":
            reminder.status = "OVERDUE"
        elif item.status == "DUE_SOON":
            reminder.status = "DUE_SOON"
        elif today >= remind_date:
            reminder.status = "DUE_SOON"
        else:
            reminder.status = "PENDING"

    return items, reminders


# ---------- 维修回写 ----------

def repair_writeback(items, repairs, dry_run=True):
    """
    将维修记录回写到保养项目的 last_done_date
    仅回写维修日期晚于当前 last_done_date 的记录
    dry_run=True 时只输出将做的变更，不实际修改
    """
    changes = []

    for repair in repairs:
        repair_date = parse_date(repair.repair_date)
        if not repair_date:
            continue

        related_items = find_items_by_instrument(items, repair.instrument_id)
        for item in related_items:
            if item.item_name in repair.repair_items:
                last_done = parse_date(item.last_done_date)
                if not last_done or last_done < repair_date:
                    old_date = item.last_done_date or "(空)"
                    change = {
                        "repair_id": repair.id,
                        "item_id": item.id,
                        "item_name": item.item_name,
                        "old_last_done_date": old_date,
                        "new_last_done_date": repair.repair_date,
                    }
                    changes.append(change)
                    if not dry_run:
                        item.last_done_date = repair.repair_date

    return changes


# ---------- 报告生成 ----------

def generate_report(customers, instruments, items, repairs, reminders):
    """
    生成可转发的纯文本报告
    """
    conflicts = detect_duplicate_customers(customers, instruments)
    overdue = detect_overdue_maintenance(customers, instruments, items)
    stale = detect_stale_reminders(customers, instruments, items, repairs, reminders)
    incomplete = detect_incomplete_records(customers, instruments, items)

    lines = []
    lines.append("=" * 60)
    lines.append("  乐器保养提醒报告")
    lines.append(f"  生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    lines.append("=" * 60)

    lines.append("")
    lines.append(CYCLE_RULE_EXPLANATION)
    lines.append("")

    lines.append("-" * 40)
    lines.append(f"【待办汇总】")
    lines.append(f"  客户去重冲突: {len(conflicts)} 条")
    lines.append(f"  保养超期: {len(overdue)} 条")
    lines.append(f"  提醒未刷新: {len(stale)} 条")
    lines.append(f"  资料不完整: {len(incomplete)} 条")
    lines.append("")

    if conflicts:
        lines.append("-" * 40)
        lines.append("【冲突清单 - 客户重复/号码变更】")
        lines.append(DEDUP_RULE_EXPLANATION)
        for i, c in enumerate(conflicts, 1):
            lines.append(f"  {i}. [{c['type']}] {c['detail']}")
            lines.append(f"     规则: {c['rule']}")
            lines.append(f"     处理: {c['action']}")
            lines.append(f"     涉及ID: {c['customer_ids']}")
            lines.append("")

    if overdue:
        lines.append("-" * 40)
        lines.append("【保养超期明细】")
        overdue_real = [o for o in overdue if o["type"] == "OVERDUE"]
        overdue_nodate = [o for o in overdue if o["type"] != "OVERDUE"]
        if overdue_real:
            lines.append(f"  超期待处理: {len(overdue_real)} 条")
            for i, o in enumerate(overdue_real, 1):
                lines.append(f"  {i}. {o['customer_name']}({o['customer_phone']}) - {o['brand']}{o['instrument_type']}")
                lines.append(f"     保养项: {o['item_name']} | 超期 {o['overdue_days']} 天")
                lines.append(f"     上次完成: {o['last_done_date']}")
                lines.append(f"     规则: {o['rule']}")
                lines.append(f"     记录ID: 保养项={o['item_id']}, 乐器={o['instrument_id']}, 客户={o['customer_id']}")
                lines.append("")
        if overdue_nodate:
            lines.append(f"  缺少日期无法计算: {len(overdue_nodate)} 条")
            for i, o in enumerate(overdue_nodate, 1):
                lines.append(f"  {i}. {o['detail']}")
                lines.append(f"     处理: {o['action']}")
                lines.append("")

    if stale:
        lines.append("-" * 40)
        lines.append("【提醒未刷新 - 维修后需回写】")
        lines.append(REPAIR_WRITEBACK_RULE_EXPLANATION)
        for i, s in enumerate(stale, 1):
            lines.append(f"  {i}. 客户[{s['customer_name']}] - {s['item_name']}")
            lines.append(f"     维修ID: {s['repair_id']} 日期: {s['repair_date']}")
            lines.append(f"     当前完成日期: {s['last_done_date']}")
            lines.append(f"     规则: {s['rule']}")
            lines.append(f"     处理: {s['action']}")
            lines.append(f"     记录ID: 保养项={s['item_id']}, 维修={s['repair_id']}")
            lines.append("")

    if incomplete:
        lines.append("-" * 40)
        lines.append("【补资料清单】")
        for i, inc in enumerate(incomplete, 1):
            lines.append(f"  {i}. [{inc['type']}] {inc['detail']}")
            lines.append(f"     处理: {inc['action']}")
            lines.append(f"     记录ID: {inc['record_type']}={inc['record_id']}")
            lines.append("")

    lines.append("-" * 40)
    lines.append(REMINDER_STATUS_RULE_EXPLANATION)
    lines.append(EXPORT_RULE_EXPLANATION)
    lines.append("=" * 60)
    lines.append("报告结束 - 可直接转发同事")

    return "\n".join(lines)


# ---------- 样例数据 ----------

def init_sample_data():
    """构造样例数据，含一个需补资料的记录"""

    customers = [
        Customer(id="C001", name="张伟", phone="13800001111", old_phones=["13900002222"], remark="吉他+萨克斯客户"),
        Customer(id="C002", name="李娜", phone="13800002222", remark="小提琴客户"),
        Customer(id="C003", name="张伟", phone="13800001111", remark="可能和C001重复"),
        Customer(id="C004", name="王磊", phone="", remark="手机号待补"),
        Customer(id="C005", name="赵敏", phone="13800005555", old_phones=["13800005555"], remark="新旧号码冲突"),
    ]

    instruments = [
        Instrument(id="I001", customer_id="C001", type="guitar", brand="Yamaha", model="FG800", purchase_date="2025-03-15"),
        Instrument(id="I002", customer_id="C001", type="saxophone", brand="Selmer", model="AS42", purchase_date="2025-01-10"),
        Instrument(id="I003", customer_id="C002", type="violin", brand="Stentor", model="Student II", purchase_date="2025-02-20"),
        Instrument(id="I004", customer_id="C003", type="guitar", brand="Yamaha", model="FG800", purchase_date="2025-04-01"),
        Instrument(id="I005", customer_id="C004", type="guitar", brand="Taylor", model="", purchase_date=""),
    ]

    guitar_cycles = MAINTENANCE_CYCLES["guitar"]
    sax_cycles = MAINTENANCE_CYCLES["saxophone"]
    violin_cycles = MAINTENANCE_CYCLES["violin"]

    items = [
        MaintenanceItem(id="M001", instrument_id="I001", item_name="换弦", last_done_date="2025-08-01", cycle_days=guitar_cycles["换弦"]),
        MaintenanceItem(id="M002", instrument_id="I001", item_name="指板保养", last_done_date="2025-06-01", cycle_days=guitar_cycles["指板保养"]),
        MaintenanceItem(id="M003", instrument_id="I002", item_name="垫片检查", last_done_date="2025-09-01", cycle_days=sax_cycles["垫片检查"]),
        MaintenanceItem(id="M004", instrument_id="I002", item_name="按键润滑", last_done_date="2025-05-01", cycle_days=sax_cycles["按键润滑"]),
        MaintenanceItem(id="M005", instrument_id="I003", item_name="弓毛更换", last_done_date="2025-04-01", cycle_days=violin_cycles["弓毛更换"]),
        MaintenanceItem(id="M006", instrument_id="I003", item_name="琴弦更换", last_done_date="2025-09-01", cycle_days=violin_cycles["琴弦更换"]),
        MaintenanceItem(id="M007", instrument_id="I004", item_name="换弦", last_done_date="2025-07-01", cycle_days=guitar_cycles["换弦"]),
        MaintenanceItem(id="M008", instrument_id="I005", item_name="换弦", last_done_date="", cycle_days=guitar_cycles["换弦"]),
    ]

    repairs = [
        Repair(id="R001", instrument_id="I001", repair_date="2026-03-10", repair_items=["换弦"], description="琴弦断裂更换"),
        Repair(id="R002", instrument_id="I002", repair_date="2026-01-15", repair_items=["按键润滑"], description="按键卡顿维修"),
    ]

    reminders = [
        Reminder(id="RM001", maintenance_item_id="M001", remind_date="2025-11-01", status="PENDING", sent=True, note="第一次换弦提醒"),
        Reminder(id="RM002", maintenance_item_id="M002", remind_date="2025-12-01", status="PENDING", sent=False, note=""),
        Reminder(id="RM003", maintenance_item_id="M005", remind_date="2025-10-01", status="PENDING", sent=True, note="弓毛更换提醒"),
    ]

    save_data(customers, instruments, items, repairs, reminders)
    return customers, instruments, items, repairs, reminders


# ---------- CLI ----------

def cmd_check(args):
    customers, instruments, items, repairs, reminders = load_data()

    conflicts = detect_duplicate_customers(customers, instruments)
    overdue = detect_overdue_maintenance(customers, instruments, items)
    stale = detect_stale_reminders(customers, instruments, items, repairs, reminders)
    incomplete = detect_incomplete_records(customers, instruments, items)

    print(f"\n===== 全量检查结果 =====\n")
    print(f"客户去重冲突: {len(conflicts)} 条")
    for c in conflicts:
        print(f"  [{c['type']}] {c['detail']} → {c['action']}")

    print(f"\n保养超期: {len(overdue)} 条")
    for o in overdue:
        print(f"  [{o['type']}] {o.get('detail', o.get('item_name', ''))}")

    print(f"\n提醒未刷新: {len(stale)} 条")
    for s in stale:
        print(f"  [{s['type']}] {s['detail']}")

    print(f"\n资料不完整: {len(incomplete)} 条")
    for inc in incomplete:
        print(f"  [{inc['type']}] {inc['detail']}")

    print()
    print(DEDUP_RULE_EXPLANATION)
    print(CYCLE_RULE_EXPLANATION)
    print(REPAIR_WRITEBACK_RULE_EXPLANATION)


def cmd_remind(args):
    customers, instruments, items, repairs, reminders = load_data()
    items, reminders = refresh_reminder_statuses(customers, instruments, items, repairs, reminders)
    report = generate_report(customers, instruments, items, repairs, reminders)
    print(report)


def cmd_repair_backfill(args):
    customers, instruments, items, repairs, reminders = load_data()

    dry = not args.execute
    changes = repair_writeback(items, repairs, dry_run=dry)

    if not changes:
        print("无需回写的维修记录。")
        return

    print(f"\n===== 维修回写 {'(预览)' if dry else '(已执行)'} =====\n")
    for c in changes:
        print(f"  维修[{c['repair_id']}] → 保养项[{c['item_id']}]{c['item_name']}")
        print(f"    {c['old_last_done_date']} → {c['new_last_done_date']}")

    if not dry:
        save_data(customers, instruments, items, repairs, reminders)
        print("\n回写完成，数据已保存。")
    else:
        print(f"\n以上为预览，加 --execute 参数执行实际回写。")

    print()
    print(REPAIR_WRITEBACK_RULE_EXPLANATION)


def cmd_export(args):
    customers, instruments, items, repairs, reminders = load_data()
    items, reminders = refresh_reminder_statuses(customers, instruments, items, repairs, reminders)
    report = generate_report(customers, instruments, items, repairs, reminders)

    out_path = args.output or f"保养提醒报告_{today_str()}.txt"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(report)

    print(f"报告已导出: {out_path}")
    print(f"可直接转发给同事。\n")
    print(EXPORT_RULE_EXPLANATION)


def cmd_init(args):
    print("正在初始化样例数据...")
    customers, instruments, items, repairs, reminders = init_sample_data()
    print(f"  客户: {len(customers)} 条")
    print(f"  乐器: {len(instruments)} 条")
    print(f"  保养项: {len(items)} 条")
    print(f"  维修记录: {len(repairs)} 条")
    print(f"  提醒: {len(reminders)} 条")
    print(f"\n数据目录: {DATA_DIR}")
    print("样例说明:")
    print("  - C001和C003同名同号，疑似重复客户")
    print("  - C005新旧号码冲突(当前号码出现在old_phones)")
    print("  - C004手机号为空，需补资料")
    print("  - I005缺少购买日期，需补资料")
    print("  - M008(I005的换弦)缺少上次完成日期和购买日期，无法计算超期")
    print("  - R001(换弦维修)和R002(按键润滑维修)完成后未回写到保养项")


def main():
    parser = argparse.ArgumentParser(
        description="乐器保养提醒工具 - 琴行售后本地小工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("init", help="初始化样例数据")
    sub.add_parser("check", help="全量检查(去重+超期+提醒刷新)")
    sub.add_parser("remind", help="生成保养提醒报告(终端输出)")

    backfill = sub.add_parser("repair-backfill", help="维修回写提醒刷新")
    backfill.add_argument("--execute", action="store_true", help="实际执行回写(默认只预览)")

    export_parser = sub.add_parser("export", help="导出可转发报告(文本文件)")
    export_parser.add_argument("--output", "-o", help="输出文件路径")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    commands = {
        "init": cmd_init,
        "check": cmd_check,
        "remind": cmd_remind,
        "repair-backfill": cmd_repair_backfill,
        "export": cmd_export,
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()
