#!/usr/bin/env python3
import click
import sqlite3
import hashlib
import json
from datetime import datetime, date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Optional

DB_PATH = "pet_boarding.db"


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.executescript('''
    CREATE TABLE IF NOT EXISTS owners (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    
    CREATE TABLE IF NOT EXISTS pets (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        name TEXT NOT NULL,
        species TEXT NOT NULL,
        breed TEXT,
        age INTEGER,
        allergies TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (owner_id) REFERENCES owners(id)
    );
    
    CREATE TABLE IF NOT EXISTS stays (
        id TEXT PRIMARY KEY,
        pet_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        check_in_date TEXT NOT NULL,
        planned_check_out_date TEXT NOT NULL,
        actual_check_out_date TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        room_type TEXT NOT NULL,
        daily_rate REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (pet_id) REFERENCES pets(id),
        FOREIGN KEY (owner_id) REFERENCES owners(id)
    );
    
    CREATE TABLE IF NOT EXISTS add_on_services (
        id TEXT PRIMARY KEY,
        stay_id TEXT NOT NULL,
        service_type TEXT NOT NULL,
        name TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        total_cost REAL NOT NULL,
        unique_hash TEXT NOT NULL UNIQUE,
        service_date TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (stay_id) REFERENCES stays(id)
    );
    
    CREATE TABLE IF NOT EXISTS medications (
        id TEXT PRIMARY KEY,
        stay_id TEXT NOT NULL,
        name TEXT NOT NULL,
        dosage TEXT NOT NULL,
        frequency TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT,
        unique_hash TEXT NOT NULL UNIQUE,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (stay_id) REFERENCES stays(id)
    );
    
    CREATE TABLE IF NOT EXISTS medication_checkins (
        id TEXT PRIMARY KEY,
        medication_id TEXT NOT NULL,
        scheduled_date TEXT NOT NULL,
        scheduled_time TEXT NOT NULL,
        actual_time TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (medication_id) REFERENCES medications(id),
        UNIQUE(medication_id, scheduled_date, scheduled_time)
    );
    
    CREATE TABLE IF NOT EXISTS allergy_alerts (
        id TEXT PRIMARY KEY,
        stay_id TEXT NOT NULL,
        medication_id TEXT,
        alert_type TEXT NOT NULL,
        description TEXT NOT NULL,
        alert_time TEXT NOT NULL,
        acknowledged INTEGER NOT NULL DEFAULT 0,
        acknowledged_at TEXT,
        FOREIGN KEY (stay_id) REFERENCES stays(id),
        FOREIGN KEY (medication_id) REFERENCES medications(id)
    );
    
    CREATE TABLE IF NOT EXISTS refunds (
        id TEXT PRIMARY KEY,
        stay_id TEXT NOT NULL,
        bill_id TEXT,
        reason TEXT NOT NULL,
        amount REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (stay_id) REFERENCES stays(id)
    );
    
    CREATE TABLE IF NOT EXISTS bills (
        id TEXT PRIMARY KEY,
        stay_id TEXT NOT NULL,
        check_out_date TEXT NOT NULL,
        base_cost REAL NOT NULL,
        services_cost REAL NOT NULL,
        subtotal REAL NOT NULL,
        total_refunds REAL NOT NULL,
        tax REAL NOT NULL DEFAULT 0,
        grand_total REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (stay_id) REFERENCES stays(id)
    );
    
    CREATE TABLE IF NOT EXISTS bill_items (
        id TEXT PRIMARY KEY,
        bill_id TEXT NOT NULL,
        item_type TEXT NOT NULL,
        description TEXT NOT NULL,
        quantity REAL,
        unit_price REAL,
        amount REAL NOT NULL,
        FOREIGN KEY (bill_id) REFERENCES bills(id)
    );
    ''')
    
    conn.commit()
    conn.close()


def generate_id(*parts) -> str:
    content = "|".join(str(p) for p in parts)
    return hashlib.md5(content.encode()).hexdigest()[:16]


def generate_unique_hash(*parts) -> str:
    content = "|".join(str(p) for p in parts)
    return hashlib.sha256(content.encode()).hexdigest()


def money(value) -> float:
    return float(Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))


def parse_date(date_str: str) -> date:
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return datetime.strptime(date_str, "%Y/%m/%d").date()


def format_date(d: date) -> str:
    return d.strftime("%Y-%m-%d")


def parse_frequency(freq: str) -> List[str]:
    """解析频次，如 'tid' -> ['08:00', '12:00', '20:00']"""
    freq_map = {
        'qd': ['09:00'],
        'bid': ['09:00', '21:00'],
        'tid': ['08:00', '12:00', '20:00'],
        'qid': ['08:00', '12:00', '16:00', '20:00'],
    }
    if freq in freq_map:
        return freq_map[freq]
    return [f.strip() for f in freq.split(',')]


@click.group()
def cli():
    """宠物寄养加餐用药管理 CLI"""
    init_db()


@cli.group()
def owner():
    """主人管理"""
    pass


@owner.command('add')
@click.option('--name', required=True, help='主人姓名')
@click.option('--phone', required=True, help='联系电话（唯一标识）')
def owner_add(name, phone):
    """添加主人"""
    conn = get_db()
    cursor = conn.cursor()
    
    owner_id = generate_id('owner', phone)
    
    cursor.execute(
        "INSERT OR IGNORE INTO owners (id, name, phone) VALUES (?, ?, ?)",
        (owner_id, name, phone)
    )
    
    if cursor.rowcount > 0:
        click.echo(f"已添加主人: {name} (电话: {phone})")
    else:
        click.echo(f"主人已存在: {name} (电话: {phone})")
    
    conn.commit()
    conn.close()


@cli.group()
def pet():
    """宠物管理"""
    pass


@pet.command('add')
@click.option('--name', required=True, help='宠物名字')
@click.option('--owner-phone', required=True, help='主人电话')
@click.option('--species', required=True, help='种类（如：狗、猫）')
@click.option('--breed', help='品种')
@click.option('--age', type=int, help='年龄（岁）')
@click.option('--allergies', help='过敏史（逗号分隔）')
def pet_add(name, owner_phone, species, breed, age, allergies):
    """添加宠物"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM owners WHERE phone = ?", (owner_phone,))
    owner_row = cursor.fetchone()
    if not owner_row:
        click.echo(f"错误：未找到电话为 {owner_phone} 的主人")
        conn.close()
        return
    
    owner_id = owner_row['id']
    pet_id = generate_id('pet', owner_id, name, species)
    
    cursor.execute(
        "INSERT OR IGNORE INTO pets (id, owner_id, name, species, breed, age, allergies) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (pet_id, owner_id, name, species, breed, age, allergies)
    )
    
    if cursor.rowcount > 0:
        click.echo(f"已添加宠物: {name} ({species})")
    else:
        click.echo(f"宠物已存在: {name} ({species})")
    
    conn.commit()
    conn.close()


@cli.command('check-in')
@click.option('--owner-phone', required=True, help='主人电话')
@click.option('--pet-name', required=True, help='宠物名字')
@click.option('--check-in', required=True, help='入住日期 (YYYY-MM-DD)')
@click.option('--nights', type=int, required=True, help='寄养天数（晚）')
@click.option('--room-type', default='标准间', help='房间类型')
@click.option('--daily-rate', type=float, default=150.0, help='每日房费')
def check_in(owner_phone, pet_name, check_in, nights, room_type, daily_rate):
    """办理入住"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM owners WHERE phone = ?", (owner_phone,))
    owner_row = cursor.fetchone()
    if not owner_row:
        click.echo(f"错误：未找到主人 (电话: {owner_phone})")
        conn.close()
        return
    owner_id = owner_row['id']
    
    cursor.execute("SELECT id, allergies FROM pets WHERE owner_id = ? AND name = ?", (owner_id, pet_name))
    pet_row = cursor.fetchone()
    if not pet_row:
        click.echo(f"错误：未找到宠物 {pet_name}")
        conn.close()
        return
    pet_id = pet_row['id']
    allergies = pet_row['allergies']
    
    check_in_date = parse_date(check_in)
    planned_check_out = check_in_date + timedelta(days=nights)
    
    stay_id = generate_id('stay', pet_id, check_in_date.isoformat())
    
    cursor.execute(
        "SELECT id FROM stays WHERE id = ? AND status = 'active'",
        (stay_id,)
    )
    if cursor.fetchone():
        click.echo(f"错误：该宠物在 {check_in} 已有活跃的入住记录")
        conn.close()
        return
    
    cursor.execute(
        "INSERT INTO stays (id, pet_id, owner_id, check_in_date, planned_check_out_date, room_type, daily_rate, status) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, 'active')",
        (stay_id, pet_id, owner_id, format_date(check_in_date), format_date(planned_check_out), 
         room_type, daily_rate)
    )
    
    click.echo(f"✓ 办理入住成功!")
    click.echo(f"  宠物: {pet_name}")
    click.echo(f"  入住: {check_in_date}")
    click.echo(f"  计划离店: {planned_check_out} (共 {nights} 晚)")
    click.echo(f"  房间: {room_type} (¥{daily_rate}/晚)")
    
    if allergies:
        click.echo(f"  ⚠️  过敏提醒: {allergies}")
    
    conn.commit()
    conn.close()


@cli.group()
def service():
    """服务管理"""
    pass


@service.command('add-meal')
@click.option('--owner-phone', required=True, help='主人电话')
@click.option('--pet-name', required=True, help='宠物名字')
@click.option('--meal-type', required=True, help='加餐类型')
@click.option('--quantity', type=int, default=1, help='数量')
@click.option('--price', type=float, default=30.0, help='单价')
@click.option('--service-date', help='服务日期（默认今天）')
def add_meal(owner_phone, pet_name, meal_type, quantity, price, service_date):
    """添加加餐服务"""
    add_service('meal', owner_phone, pet_name, meal_type, quantity, price, service_date)


@service.command('add-grooming')
@click.option('--owner-phone', required=True, help='主人电话')
@click.option('--pet-name', required=True, help='宠物名字')
@click.option('--grooming-type', required=True, help='洗护类型（如：洗澡、美容、全套）')
@click.option('--quantity', type=int, default=1, help='数量')
@click.option('--price', type=float, required=True, help='价格')
@click.option('--service-date', help='服务日期（默认今天）')
def add_grooming(owner_phone, pet_name, grooming_type, quantity, price, service_date):
    """添加洗护服务"""
    add_service('grooming', owner_phone, pet_name, grooming_type, quantity, price, service_date)


def add_service(service_type, owner_phone, pet_name, name, quantity, price, service_date):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM owners WHERE phone = ?", (owner_phone,))
    owner_row = cursor.fetchone()
    if not owner_row:
        click.echo(f"错误：未找到主人")
        conn.close()
        return
    owner_id = owner_row['id']
    
    cursor.execute("SELECT id FROM pets WHERE owner_id = ? AND name = ?", (owner_id, pet_name))
    pet_row = cursor.fetchone()
    if not pet_row:
        click.echo(f"错误：未找到宠物")
        conn.close()
        return
    pet_id = pet_row['id']
    
    cursor.execute(
        "SELECT id, check_in_date, planned_check_out_date FROM stays "
        "WHERE pet_id = ? AND status = 'active'",
        (pet_id,)
    )
    stay_row = cursor.fetchone()
    if not stay_row:
        click.echo(f"错误：宠物 {pet_name} 当前没有活跃的入住记录")
        conn.close()
        return
    stay_id = stay_row['id']
    
    service_date = service_date or format_date(date.today())
    total_cost = money(quantity * price)
    
    unique_hash = generate_unique_hash(
        stay_id, service_type, name, quantity, price, service_date
    )
    
    cursor.execute(
        "SELECT id FROM add_on_services WHERE unique_hash = ?",
        (unique_hash,)
    )
    if cursor.fetchone():
        click.echo(f"⚠️  该服务已存在，未重复收费")
        conn.close()
        return
    
    service_id = generate_id('service', unique_hash)
    
    cursor.execute(
        "INSERT INTO add_on_services (id, stay_id, service_type, name, quantity, unit_price, total_cost, unique_hash, service_date) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (service_id, stay_id, service_type, name, quantity, price, total_cost, unique_hash, service_date)
    )
    
    type_label = '加餐' if service_type == 'meal' else '洗护'
    click.echo(f"✓ 已添加{type_label}: {name}")
    click.echo(f"  数量: {quantity}, 单价: ¥{price}, 小计: ¥{total_cost}")
    click.echo(f"  服务日期: {service_date}")
    
    conn.commit()
    conn.close()


@cli.command('add-medication')
@click.option('--owner-phone', required=True, help='主人电话')
@click.option('--pet-name', required=True, help='宠物名字')
@click.option('--name', required=True, help='药品名称')
@click.option('--dosage', required=True, help='剂量')
@click.option('--frequency', required=True, help='频次：qd/bid/tid/qid 或 时间列表(08:00,20:00)')
@click.option('--start-date', required=True, help='开始日期')
@click.option('--end-date', help='结束日期（默认到离店日）')
@click.option('--price', type=float, default=10.0, help='每次给药服务费')
def add_medication(owner_phone, pet_name, name, dosage, frequency, start_date, end_date, price):
    """添加用药计划（会自动检查过敏史）"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM owners WHERE phone = ?", (owner_phone,))
    owner_row = cursor.fetchone()
    if not owner_row:
        click.echo(f"错误：未找到主人")
        conn.close()
        return
    owner_id = owner_row['id']
    
    cursor.execute("SELECT id, allergies FROM pets WHERE owner_id = ? AND name = ?", (owner_id, pet_name))
    pet_row = cursor.fetchone()
    if not pet_row:
        click.echo(f"错误：未找到宠物")
        conn.close()
        return
    pet_id = pet_row['id']
    allergies = pet_row['allergies'] or ''
    
    cursor.execute(
        "SELECT id, planned_check_out_date FROM stays "
        "WHERE pet_id = ? AND status = 'active'",
        (pet_id,)
    )
    stay_row = cursor.fetchone()
    if not stay_row:
        click.echo(f"错误：宠物 {pet_name} 当前没有活跃的入住记录")
        conn.close()
        return
    stay_id = stay_row['id']
    planned_check_out = stay_row['planned_check_out_date']
    
    start = parse_date(start_date)
    end = parse_date(end_date) if end_date else parse_date(planned_check_out)
    
    unique_hash = generate_unique_hash(stay_id, name, dosage, frequency, start_date, end_date or planned_check_out)
    
    cursor.execute(
        "SELECT id FROM medications WHERE unique_hash = ?",
        (unique_hash,)
    )
    if cursor.fetchone():
        click.echo(f"⚠️  该用药计划已存在")
        conn.close()
        return
    
    if name.lower() in allergies.lower():
        alert_id = generate_id('alert', stay_id, name, start_date, frequency)
        cursor.execute(
            "INSERT OR IGNORE INTO allergy_alerts (id, stay_id, alert_type, description, alert_time) "
            "VALUES (?, ?, 'medication', ?, ?)",
            (alert_id, stay_id, f"宠物 {pet_name} 对 {name} 过敏！过敏史: {allergies}", datetime.now().isoformat())
        )
        click.echo(f"⚠️  ⚠️  ⚠️  严重过敏警告！")
        click.echo(f"   宠物 {pet_name} 的过敏史包含: {allergies}")
        click.echo(f"   您正在添加的药品: {name}")
        click.echo("   请确认后再继续！")
    
    med_id = generate_id('med', unique_hash)
    
    cursor.execute(
        "INSERT INTO medications (id, stay_id, name, dosage, frequency, start_date, end_date, unique_hash) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (med_id, stay_id, name, dosage, frequency, format_date(start), format_date(end) if end else None, unique_hash)
    )
    
    times = parse_frequency(frequency)
    current = start
    total_doses = 0
    
    while current <= end:
        for t in times:
            checkin_id = generate_id('checkin', med_id, current.isoformat(), t)
            cursor.execute(
                "INSERT OR IGNORE INTO medication_checkins "
                "(id, medication_id, scheduled_date, scheduled_time, status) "
                "VALUES (?, ?, ?, ?, 'pending')",
                (checkin_id, med_id, format_date(current), t)
            )
            total_doses += 1
        current += timedelta(days=1)
    
    if price > 0:
        total_cost = money(total_doses * price)
        service_hash = generate_unique_hash(stay_id, 'medication', name, total_doses, price)
        service_id = generate_id('med_service', service_hash)
        
        cursor.execute(
            "INSERT OR IGNORE INTO add_on_services "
            "(id, stay_id, service_type, name, quantity, unit_price, total_cost, unique_hash) "
            "VALUES (?, ?, 'medication', ?, ?, ?, ?, ?)",
            (service_id, stay_id, f"用药:{name}", total_doses, price, total_cost, service_hash)
        )
    
    click.echo(f"✓ 已添加用药计划")
    click.echo(f"  药品: {name}")
    click.echo(f"  剂量: {dosage}")
    click.echo(f"  频次: {frequency} ({len(times)}次/天)")
    click.echo(f"  周期: {start_date} 至 {format_date(end)}")
    click.echo(f"  总给药次数: {total_doses}")
    if price > 0:
        click.echo(f"  给药服务费: ¥{total_cost} (¥{price}/次)")
    
    conn.commit()
    conn.close()


@cli.command('check-med')
@click.option('--owner-phone', required=True, help='主人电话')
@click.option('--pet-name', required=True, help='宠物名字')
@click.option('--date', 'check_date', help='检查日期（默认今天）')
def check_med(owner_phone, pet_name, check_date):
    """打卡用药"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM owners WHERE phone = ?", (owner_phone,))
    owner_row = cursor.fetchone()
    if not owner_row:
        click.echo("错误：未找到主人")
        conn.close()
        return
    owner_id = owner_row['id']
    
    cursor.execute("SELECT id FROM pets WHERE owner_id = ? AND name = ?", (owner_id, pet_name))
    pet_row = cursor.fetchone()
    if not pet_row:
        click.echo("错误：未找到宠物")
        conn.close()
        return
    pet_id = pet_row['id']
    
    cursor.execute(
        "SELECT id FROM stays WHERE pet_id = ? AND status = 'active'",
        (pet_id,)
    )
    stay_row = cursor.fetchone()
    if not stay_row:
        click.echo("错误：没有活跃的入住记录")
        conn.close()
        return
    stay_id = stay_row['id']
    
    check_date = check_date or format_date(date.today())
    
    cursor.execute('''
        SELECT mc.id, mc.scheduled_time, mc.status, m.name as med_name, m.dosage
        FROM medication_checkins mc
        JOIN medications m ON mc.medication_id = m.id
        WHERE m.stay_id = ? AND mc.scheduled_date = ?
        ORDER BY mc.scheduled_time
    ''', (stay_id, check_date))
    
    checkins = cursor.fetchall()
    if not checkins:
        click.echo(f"{check_date} 没有用药计划")
        conn.close()
        return
    
    click.echo(f"📋 {check_date} 用药计划:")
    for i, c in enumerate(checkins, 1):
        status_mark = "✓" if c['status'] == 'completed' else " "
        click.echo(f"  [{status_mark}] {i}. {c['med_name']} ({c['dosage']}) - {c['scheduled_time']}")
    
    pending = [c for c in checkins if c['status'] != 'completed']
    if pending:
        click.echo(f"\n待打卡: {len(pending)} 项")
        choice = click.prompt("请输入序号打卡（输入 0 取消）", type=int)
        if 1 <= choice <= len(checkins):
            selected = checkins[choice - 1]
            if selected['status'] == 'completed':
                click.echo("该次用药已打卡")
            else:
                cursor.execute(
                    "UPDATE medication_checkins SET status = 'completed', actual_time = ? WHERE id = ?",
                    (datetime.now().strftime("%H:%M"), selected['id'])
                )
                click.echo(f"✓ {selected['med_name']} {selected['scheduled_time']} 已打卡")
    
    conn.commit()
    conn.close()


@cli.command('alerts')
@click.option('--show-all', is_flag=True, help='显示所有提醒（包括已处理）')
def list_alerts(show_all):
    """查看异常提醒"""
    conn = get_db()
    cursor = conn.cursor()
    
    today = format_date(date.today())
    yesterday = format_date(date.today() - timedelta(days=1))
    
    missed = cursor.execute('''
        SELECT mc.scheduled_date, mc.scheduled_time, m.name, m.dosage, p.name as pet_name, s.id as stay_id
        FROM medication_checkins mc
        JOIN medications m ON mc.medication_id = m.id
        JOIN stays s ON m.stay_id = s.id
        JOIN pets p ON s.pet_id = p.id
        WHERE mc.status = 'pending' 
        AND (mc.scheduled_date < ? OR (mc.scheduled_date = ? AND mc.scheduled_time < ?))
        ORDER BY mc.scheduled_date, mc.scheduled_time
    ''', (today, today, datetime.now().strftime("%H:%M"))).fetchall()
    
    allergy_query = "SELECT * FROM allergy_alerts"
    if not show_all:
        allergy_query += " WHERE acknowledged = 0"
    allergies = cursor.execute(allergy_query).fetchall()
    
    has_alerts = False
    
    if missed:
        has_alerts = True
        click.echo("🚨 用药漏打卡警告:")
        for m in missed:
            click.echo(f"   ⏰ {m['scheduled_date']} {m['scheduled_time']} - {m['pet_name']}: {m['name']} ({m['dosage']})")
    else:
        click.echo("✓ 用药打卡正常")
    
    if allergies:
        has_alerts = True
        click.echo("\n⚠️  过敏提醒:")
        for a in allergies:
            status = " [已处理]" if a['acknowledged'] else ""
            click.echo(f"   {a['alert_time']}{status}: {a['description']}")
    
    if not show_all and has_alerts:
        if click.confirm("是否标记过敏提醒为已处理？"):
            cursor.execute("UPDATE allergy_alerts SET acknowledged = 1, acknowledged_at = ? WHERE acknowledged = 0",
                         (datetime.now().isoformat(),))
            click.echo("已标记所有过敏提醒为已处理")
    
    conn.commit()
    conn.close()


@cli.command('check-out')
@click.option('--owner-phone', required=True, help='主人电话')
@click.option('--pet-name', required=True, help='宠物名字')
@click.option('--check-out-date', help='实际离店日期（默认今天）')
@click.option('--cancel', is_flag=True, help='取消入住（全额退款）')
def check_out(owner_phone, pet_name, check_out_date, cancel):
    """结账离店"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM owners WHERE phone = ?", (owner_phone,))
    owner_row = cursor.fetchone()
    if not owner_row:
        click.echo("错误：未找到主人")
        conn.close()
        return
    owner_id = owner_row['id']
    
    cursor.execute("SELECT id FROM pets WHERE owner_id = ? AND name = ?", (owner_id, pet_name))
    pet_row = cursor.fetchone()
    if not pet_row:
        click.echo("错误：未找到宠物")
        conn.close()
        return
    pet_id = pet_row['id']
    
    cursor.execute(
        "SELECT * FROM stays WHERE pet_id = ? AND status = 'active'",
        (pet_id,)
    )
    stay_row = cursor.fetchone()
    if not stay_row:
        click.echo("错误：没有活跃的入住记录")
        conn.close()
        return
    
    stay_id = stay_row['id']
    check_in = parse_date(stay_row['check_in_date'])
    planned_out = parse_date(stay_row['planned_check_out_date'])
    daily_rate = Decimal(str(stay_row['daily_rate']))
    
    actual_out = parse_date(check_out_date) if check_out_date else date.today()
    actual_nights = max(0, (actual_out - check_in).days)
    planned_nights = (planned_out - check_in).days
    
    bill_items = []
    
    if cancel:
        base_cost = 0.0
        base_description = "取消入住: 房费全免"
        base_qty = 0
    else:
        base_cost = money(planned_nights * daily_rate)
        base_description = f"房费: {stay_row['room_type']} × {planned_nights} 晚 (¥{float(daily_rate)}/晚)"
        base_qty = planned_nights
    
    bill_items.append({
        'type': 'base',
        'desc': base_description,
        'qty': base_qty,
        'unit': float(daily_rate),
        'amount': base_cost
    })
    
    cursor.execute('''
        SELECT service_type, name, quantity, unit_price, total_cost, service_date
        FROM add_on_services WHERE stay_id = ?
        ORDER BY created_at
    ''', (stay_id,))
    services = cursor.fetchall()
    
    services_cost = 0.0
    for s in services:
        services_cost = money(services_cost + s['total_cost'])
        bill_items.append({
            'type': s['service_type'],
            'desc': f"{s['name']}",
            'qty': s['quantity'],
            'unit': s['unit_price'],
            'amount': s['total_cost'],
            'date': s['service_date']
        })
    
    refunds = []
    if not cancel and actual_nights < planned_nights:
        refund_days = planned_nights - actual_nights
        refund_amount = money(refund_days * daily_rate)
        refund_id = generate_id('refund', stay_id, 'early_checkout', actual_out.isoformat())
        
        cursor.execute(
            "INSERT OR IGNORE INTO refunds (id, stay_id, reason, amount) "
            "VALUES (?, ?, '提前接走退款', ?)",
            (refund_id, stay_id, refund_amount)
        )
        refunds.append({'reason': f'提前 {refund_days} 天接走 (原计划{planned_nights}晚，实际{actual_nights}晚)', 'amount': refund_amount})
    
    if cancel:
        refund_id = generate_id('refund', stay_id, 'cancellation')
        cursor.execute(
            "INSERT OR IGNORE INTO refunds (id, stay_id, reason, amount) "
            "VALUES (?, ?, '取消入住', ?)",
            (refund_id, stay_id, money(planned_nights * daily_rate))
        )
        refunds.append({'reason': '取消入住退款', 'amount': money(planned_nights * daily_rate)})
    
    total_refunds = money(sum(r['amount'] for r in refunds))
    subtotal = money(base_cost + services_cost)
    grand_total = money(subtotal - total_refunds)
    
    bill_id = generate_id('bill', stay_id, actual_out.isoformat())
    
    cursor.execute(
        "INSERT INTO bills (id, stay_id, check_out_date, base_cost, services_cost, subtotal, total_refunds, grand_total) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (bill_id, stay_id, format_date(actual_out), base_cost, services_cost, subtotal, total_refunds, grand_total)
    )
    
    for item in bill_items:
        item_id = generate_id('bill_item', bill_id, item['desc'], item.get('date', ''))
        cursor.execute(
            "INSERT INTO bill_items (id, bill_id, item_type, description, quantity, unit_price, amount) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (item_id, bill_id, item['type'], item['desc'], item.get('qty'), item.get('unit'), item['amount'])
        )
    
    for r in refunds:
        item_id = generate_id('bill_item', bill_id, 'refund', r['reason'])
        cursor.execute(
            "INSERT INTO bill_items (id, bill_id, item_type, description, quantity, unit_price, amount) "
            "VALUES (?, ?, 'refund', ?, 1, ?, ?)",
            (item_id, bill_id, r['reason'], r['amount'], -r['amount'])
        )
    
    cursor.execute(
        "UPDATE stays SET status = 'checked_out', actual_check_out_date = ? WHERE id = ?",
        (format_date(actual_out), stay_id)
    )
    
    click.echo("=" * 60)
    click.echo("                      结  账  单")
    click.echo("=" * 60)
    click.echo(f"宠物: {pet_name} | 主人电话: {owner_phone}")
    click.echo(f"入住: {stay_row['check_in_date']} | 离店: {format_date(actual_out)}")
    click.echo(f"原计划: {planned_nights} 晚 | 实际: {actual_nights} 晚")
    click.echo("-" * 60)
    
    click.echo("\n【消费明细】")
    for item in bill_items:
        if item['qty'] and item['unit']:
            click.echo(f"  {item['desc']}")
            click.echo(f"    {item['qty']} × ¥{item['unit']:.2f} = ¥{item['amount']:.2f}")
        else:
            click.echo(f"  {item['desc']}: ¥{item['amount']:.2f}")
    
    if refunds:
        click.echo("\n【退款明细】")
        for r in refunds:
            click.echo(f"  ✓ {r['reason']}: -¥{r['amount']:.2f}")
    
    click.echo("-" * 60)
    click.echo(f"房费小计:           ¥{base_cost:.2f}")
    click.echo(f"服务小计:           ¥{services_cost:.2f}")
    click.echo(f"消费合计:           ¥{subtotal:.2f}")
    if total_refunds > 0:
        click.echo(f"退款合计:          -¥{total_refunds:.2f}")
    click.echo("=" * 60)
    click.echo(f"应付总额:           ¥{grand_total:.2f}")
    click.echo("=" * 60)
    
    conn.commit()
    conn.close()


if __name__ == '__main__':
    cli()
