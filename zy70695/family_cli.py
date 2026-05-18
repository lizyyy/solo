#!/usr/bin/env python3
import click
from rich.console import Console
from rich.table import Table
from datetime import datetime
import json
import os
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field, field_validator
from enum import Enum

console = Console()
DATA_DIR = "data"
os.makedirs(DATA_DIR, exist_ok=True)


class RegistrationStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    WAITLISTED = "waitlisted"


class PaymentStatus(str, Enum):
    UNPAID = "unpaid"
    PENDING = "pending"
    PAID = "paid"
    REFUNDED = "refunded"
    LOCKED = "locked"


class Child(BaseModel):
    name: str
    age: int = Field(ge=0, le=18)

    @field_validator('age')
    def validate_age(cls, v):
        if v < 0 or v > 18:
            raise ValueError('儿童年龄必须在0-18岁之间')
        return v


class Family(BaseModel):
    family_id: str
    parent_name: str
    phone: str
    children: List[Child]
    total_members: int = Field(ge=1)

    @field_validator('total_members')
    def validate_total_members(cls, v, values):
        children_count = len(values.data.get('children', []))
        if v < children_count + 1:
            raise ValueError('总人数必须至少是家长加儿童数量')
        return v


class Activity(BaseModel):
    activity_id: str
    name: str
    date: str
    max_capacity: int = Field(ge=1)
    min_age: int = Field(ge=0)
    max_age: int = Field(ge=0)
    price_per_person: float = Field(ge=0)
    payment_lock_hours: int = Field(default=24, ge=1)

    @field_validator('max_age')
    def validate_age_range(cls, v, values):
        if v < values.data.get('min_age', 0):
            raise ValueError('最大年龄不能小于最小年龄')
        return v


class Registration(BaseModel):
    registration_id: str
    activity_id: str
    family_id: str
    status: RegistrationStatus
    registered_at: str
    payment_status: PaymentStatus
    payment_expires_at: Optional[str] = None
    notes: Optional[str] = None


class Payment(BaseModel):
    payment_id: str
    registration_id: str
    amount: float
    paid_at: Optional[str] = None
    transaction_id: Optional[str] = None


class WaitlistQueue(BaseModel):
    activity_id: str
    queue: List[str] = []
    last_updated: str


def load_json(filename: str, default: Any) -> Any:
    path = os.path.join(DATA_DIR, filename)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return default


def save_json(filename: str, data: Any):
    path = os.path.join(DATA_DIR, filename)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_all_activities() -> Dict:
    return load_json('activities.json', {})


def get_all_families() -> Dict:
    return load_json('families.json', {})


def get_all_registrations() -> Dict:
    return load_json('registrations.json', {})


def get_all_payments() -> Dict:
    return load_json('payments.json', {})


def get_waitlist(activity_id: str) -> WaitlistQueue:
    waitlists = load_json('waitlists.json', {})
    if activity_id in waitlists:
        return WaitlistQueue(**waitlists[activity_id])
    return WaitlistQueue(activity_id=activity_id, last_updated=datetime.now().isoformat())


def save_waitlist(waitlist: WaitlistQueue):
    waitlists = load_json('waitlists.json', {})
    waitlists[waitlist.activity_id] = waitlist.model_dump()
    save_json('waitlists.json', waitlists)


def validate_child_age(activity: Activity, children: List[Child]) -> tuple[bool, List[str]]:
    errors = []
    for child in children:
        if child.age < activity.min_age or child.age > activity.max_age:
            errors.append(f"儿童 {child.name} 年龄 {child.age} 岁，不在活动要求的 {activity.min_age}-{activity.max_age} 岁范围内")
    return len(errors) == 0, errors


def get_confirmed_count(activity_id: str) -> int:
    registrations = get_all_registrations()
    count = 0
    for reg in registrations.values():
        if reg['activity_id'] == activity_id and reg['status'] == RegistrationStatus.CONFIRMED.value:
            count += 1
    return count


def check_payment_lock(registration: Registration) -> bool:
    if registration.payment_status == PaymentStatus.LOCKED.value:
        return True
    if registration.payment_expires_at:
        now = datetime.now()
        expires = datetime.fromisoformat(registration.payment_expires_at)
        if now < expires:
            return True
    return False


def auto_promote_waitlist(activity_id: str):
    activity_data = get_all_activities().get(activity_id)
    if not activity_data:
        return
    activity = Activity(**activity_data)
    waitlist = get_waitlist(activity_id)
    registrations = get_all_registrations()
    
    confirmed_count = get_confirmed_count(activity_id)
    promoted = []
    
    while confirmed_count < activity.max_capacity and waitlist.queue:
        next_reg_id = waitlist.queue.pop(0)
        if next_reg_id in registrations:
            reg = registrations[next_reg_id]
            if reg['status'] == RegistrationStatus.WAITLISTED.value:
                reg['status'] = RegistrationStatus.CONFIRMED.value
                registrations[next_reg_id] = reg
                confirmed_count += 1
                promoted.append(next_reg_id)
    
    if promoted:
        save_json('registrations.json', registrations)
        waitlist.last_updated = datetime.now().isoformat()
        save_waitlist(waitlist)
    
    return promoted


@click.group()
def cli():
    """亲子候补年龄限制付款锁定排查CLI"""
    pass


@cli.group()
def activity():
    """活动管理"""
    pass


@activity.command('add')
@click.option('--id', required=True, help='活动ID')
@click.option('--name', required=True, help='活动名称')
@click.option('--date', required=True, help='活动日期')
@click.option('--max-capacity', type=int, required=True, help='最大容量')
@click.option('--min-age', type=int, required=True, help='最小年龄')
@click.option('--max-age', type=int, required=True, help='最大年龄')
@click.option('--price', type=float, required=True, help='每人价格')
@click.option('--lock-hours', type=int, default=24, help='付款锁定小时数')
def add_activity(id, name, date, max_capacity, min_age, max_age, price, lock_hours):
    """添加新活动"""
    try:
        activity = Activity(
            activity_id=id,
            name=name,
            date=date,
            max_capacity=max_capacity,
            min_age=min_age,
            max_age=max_age,
            price_per_person=price,
            payment_lock_hours=lock_hours
        )
        activities = get_all_activities()
        activities[id] = activity.model_dump()
        save_json('activities.json', activities)
        console.print(f"✅ 活动添加成功: {name}", style="green")
    except Exception as e:
        console.print(f"❌ 添加失败: {e}", style="red")


@activity.command('list')
def list_activities():
    """列出所有活动"""
    activities = get_all_activities()
    if not activities:
        console.print("暂无活动", style="yellow")
        return
    
    table = Table(title="活动列表")
    table.add_column("ID")
    table.add_column("名称")
    table.add_column("日期")
    table.add_column("容量")
    table.add_column("年龄范围")
    table.add_column("价格")
    
    for act in activities.values():
        table.add_row(
            act['activity_id'],
            act['name'],
            act['date'],
            str(act['max_capacity']),
            f"{act['min_age']}-{act['max_age']}岁",
            f"¥{act['price_per_person']}"
        )
    console.print(table)


@cli.group()
def family():
    """家庭管理"""
    pass


@family.command('add')
@click.option('--id', required=True, help='家庭ID')
@click.option('--parent', required=True, help='家长姓名')
@click.option('--phone', required=True, help='联系电话')
@click.option('--total', type=int, required=True, help='总人数')
@click.option('--child', multiple=True, nargs=2, help='儿童信息: 姓名 年龄')
def add_family(id, parent, phone, total, child):
    """添加家庭信息"""
    try:
        children = []
        for name, age_str in child:
            children.append(Child(name=name, age=int(age_str)))
        
        family = Family(
            family_id=id,
            parent_name=parent,
            phone=phone,
            children=children,
            total_members=total
        )
        families = get_all_families()
        families[id] = family.model_dump()
        save_json('families.json', families)
        console.print(f"✅ 家庭添加成功: {parent}", style="green")
    except Exception as e:
        console.print(f"❌ 添加失败: {e}", style="red")


@family.command('list')
def list_families():
    """列出所有家庭"""
    families = get_all_families()
    if not families:
        console.print("暂无家庭信息", style="yellow")
        return
    
    table = Table(title="家庭列表")
    table.add_column("ID")
    table.add_column("家长")
    table.add_column("电话")
    table.add_column("总人数")
    table.add_column("儿童")
    
    for fam in families.values():
        children_info = ", ".join([f"{c['name']}({c['age']}岁)" for c in fam['children']])
        table.add_row(
            fam['family_id'],
            fam['parent_name'],
            fam['phone'],
            str(fam['total_members']),
            children_info
        )
    console.print(table)


@cli.group()
def register():
    """报名管理"""
    pass


@register.command('add')
@click.option('--id', required=True, help='报名ID')
@click.option('--activity-id', required=True, help='活动ID')
@click.option('--family-id', required=True, help='家庭ID')
def add_registration(id, activity_id, family_id):
    """添加报名"""
    try:
        activities = get_all_activities()
        families = get_all_families()
        registrations = get_all_registrations()
        
        if activity_id not in activities:
            console.print(f"❌ 活动不存在: {activity_id}", style="red")
            return
        if family_id not in families:
            console.print(f"❌ 家庭不存在: {family_id}", style="red")
            return
        if id in registrations:
            console.print(f"❌ 报名ID已存在: {id}", style="red")
            return
        
        activity = Activity(**activities[activity_id])
        family = Family(**families[family_id])
        
        age_valid, age_errors = validate_child_age(activity, [Child(**c) for c in families[family_id]['children']])
        if not age_valid:
            for err in age_errors:
                console.print(f"❌ {err}", style="red")
            return
        
        confirmed_count = get_confirmed_count(activity_id)
        is_waitlist = confirmed_count >= activity.max_capacity
        
        status = RegistrationStatus.WAITLISTED if is_waitlist else RegistrationStatus.CONFIRMED
        
        expires_at = None
        if status == RegistrationStatus.CONFIRMED:
            from datetime import timedelta
            expires = datetime.now() + timedelta(hours=activity.payment_lock_hours)
            expires_at = expires.isoformat()
        
        registration = Registration(
            registration_id=id,
            activity_id=activity_id,
            family_id=family_id,
            status=status,
            registered_at=datetime.now().isoformat(),
            payment_status=PaymentStatus.UNPAID,
            payment_expires_at=expires_at
        )
        
        registrations[id] = registration.model_dump()
        save_json('registrations.json', registrations)
        
        if status == RegistrationStatus.WAITLISTED:
            waitlist = get_waitlist(activity_id)
            if id not in waitlist.queue:
                waitlist.queue.append(id)
                waitlist.last_updated = datetime.now().isoformat()
                save_waitlist(waitlist)
            console.print(f"⚠️  活动已满员，已加入候补队列", style="yellow")
        
        console.print(f"✅ 报名成功，状态: {status.value}", style="green")
        
    except Exception as e:
        console.print(f"❌ 报名失败: {e}", style="red")


@register.command('cancel')
@click.argument('registration_id')
def cancel_registration(registration_id):
    """取消报名"""
    registrations = get_all_registrations()
    if registration_id not in registrations:
        console.print(f"❌ 报名不存在", style="red")
        return
    
    reg = registrations[registration_id]
    if reg['status'] == RegistrationStatus.CANCELLED.value:
        console.print(f"⚠️  该报名已取消", style="yellow")
        return
    
    activity_id = reg['activity_id']
    reg['status'] = RegistrationStatus.CANCELLED.value
    reg['payment_status'] = PaymentStatus.REFUNDED.value
    save_json('registrations.json', registrations)
    
    promoted = auto_promote_waitlist(activity_id)
    
    console.print(f"✅ 报名已取消", style="green")
    if promoted:
        console.print(f"🔄 已自动递补候补: {len(promoted)} 人", style="blue")


@register.command('list')
@click.option('--activity-id', help='按活动过滤')
@click.option('--family-id', help='按家庭过滤')
def list_registrations(activity_id, family_id):
    """列出报名信息"""
    registrations = get_all_registrations()
    families = get_all_families()
    activities = get_all_activities()
    
    filtered = registrations.values()
    if activity_id:
        filtered = [r for r in filtered if r['activity_id'] == activity_id]
    if family_id:
        filtered = [r for r in filtered if r['family_id'] == family_id]
    
    if not filtered:
        console.print("暂无报名信息", style="yellow")
        return
    
    table = Table(title="报名列表")
    table.add_column("报名ID")
    table.add_column("活动")
    table.add_column("家庭")
    table.add_column("状态")
    table.add_column("付款状态")
    
    for reg in filtered:
        activity = activities.get(reg['activity_id'], {})
        family = families.get(reg['family_id'], {})
        table.add_row(
            reg['registration_id'],
            activity.get('name', '未知'),
            family.get('parent_name', '未知'),
            reg['status'],
            reg['payment_status']
        )
    console.print(table)


@cli.group()
def payment():
    """付款管理"""
    pass


@payment.command('pay')
@click.option('--id', required=True, help='付款ID')
@click.option('--reg-id', required=True, help='报名ID')
@click.option('--amount', type=float, required=True, help='付款金额')
@click.option('--txn-id', help='交易ID')
def process_payment(id, reg_id, amount, txn_id):
    """处理付款"""
    registrations = get_all_registrations()
    payments = get_all_payments()
    
    if reg_id not in registrations:
        console.print(f"❌ 报名不存在", style="red")
        return
    
    reg = registrations[reg_id]
    if reg['status'] != RegistrationStatus.CONFIRMED.value:
        console.print(f"❌ 只有已确认的报名可以付款", style="red")
        return
    
    if check_payment_lock(Registration(**reg)) and reg['payment_status'] in [PaymentStatus.PAID.value, PaymentStatus.LOCKED.value]:
        console.print(f"⚠️  该报名已付款或付款已锁定", style="yellow")
        return
    
    payment = Payment(
        payment_id=id,
        registration_id=reg_id,
        amount=amount,
        paid_at=datetime.now().isoformat(),
        transaction_id=txn_id
    )
    
    payments[id] = payment.model_dump()
    save_json('payments.json', payments)
    
    reg['payment_status'] = PaymentStatus.PAID.value
    reg['payment_expires_at'] = None
    save_json('registrations.json', registrations)
    
    console.print(f"✅ 付款成功，金额: ¥{amount}", style="green")


@payment.command('lock')
@click.argument('registration_id')
def lock_payment(registration_id):
    """锁定付款"""
    registrations = get_all_registrations()
    if registration_id not in registrations:
        console.print(f"❌ 报名不存在", style="red")
        return
    
    reg = registrations[registration_id]
    if reg['payment_status'] == PaymentStatus.PAID.value:
        console.print(f"⚠️  已付款，无需锁定", style="yellow")
        return
    
    reg['payment_status'] = PaymentStatus.LOCKED.value
    save_json('registrations.json', registrations)
    console.print(f"✅ 付款已锁定", style="green")


@cli.group()
def waitlist():
    """候补管理"""
    pass


@waitlist.command('show')
@click.argument('activity_id')
def show_waitlist(activity_id):
    """显示候补队列"""
    waitlist = get_waitlist(activity_id)
    registrations = get_all_registrations()
    families = get_all_families()
    
    if not waitlist.queue:
        console.print("候补队列为空", style="yellow")
        return
    
    table = Table(title=f"活动 {activity_id} 候补队列")
    table.add_column("位置")
    table.add_column("报名ID")
    table.add_column("家庭")
    
    for idx, reg_id in enumerate(waitlist.queue, 1):
        reg = registrations.get(reg_id, {})
        family = families.get(reg.get('family_id', ''), {})
        table.add_row(str(idx), reg_id, family.get('parent_name', '未知'))
    
    console.print(table)


@waitlist.command('promote')
@click.argument('activity_id')
def promote_waitlist(activity_id):
    """手动触发候补递补"""
    promoted = auto_promote_waitlist(activity_id)
    if promoted:
        console.print(f"✅ 递补成功: {len(promoted)} 人", style="green")
        for pid in promoted:
            console.print(f"  - {pid}", style="blue")
    else:
        console.print("暂无待递补的候补", style="yellow")


@cli.group()
def report():
    """报告生成"""
    pass


@report.command('activity')
@click.argument('activity_id')
@click.option('--format', type=click.Choice(['json', 'text', 'both']), default='both')
def activity_report(activity_id, format):
    """生成活动报告"""
    activities = get_all_activities()
    if activity_id not in activities:
        console.print(f"❌ 活动不存在", style="red")
        return
    
    activity = Activity(**activities[activity_id])
    registrations = get_all_registrations()
    families = get_all_families()
    payments = get_all_payments()
    waitlist = get_waitlist(activity_id)
    
    activity_regs = [r for r in registrations.values() if r['activity_id'] == activity_id]
    confirmed = [r for r in activity_regs if r['status'] == RegistrationStatus.CONFIRMED.value]
    cancelled = [r for r in activity_regs if r['status'] == RegistrationStatus.CANCELLED.value]
    waitlisted = [r for r in activity_regs if r['status'] == RegistrationStatus.WAITLISTED.value]
    
    paid_count = sum(1 for r in confirmed if r['payment_status'] == PaymentStatus.PAID.value)
    locked_count = sum(1 for r in confirmed if r['payment_status'] == PaymentStatus.LOCKED.value)
    unpaid_count = len(confirmed) - paid_count - locked_count
    
    total_revenue = 0
    for p in payments.values():
        reg = registrations.get(p['registration_id'])
        if reg and reg['activity_id'] == activity_id and p.get('paid_at'):
            total_revenue += p['amount']
    
    report_data = {
        "activity": activity.model_dump(),
        "summary": {
            "total_registrations": len(activity_regs),
            "confirmed": len(confirmed),
            "cancelled": len(cancelled),
            "waitlisted": len(waitlisted),
            "paid": paid_count,
            "payment_locked": locked_count,
            "unpaid": unpaid_count,
            "remaining_spots": max(0, activity.max_capacity - len(confirmed)),
            "waitlist_length": len(waitlist.queue),
            "total_revenue": total_revenue
        },
        "registrations": activity_regs,
        "waitlist_queue": waitlist.queue
    }
    
    os.makedirs("reports", exist_ok=True)
    base_path = f"reports/activity_{activity_id}"
    
    if format in ['json', 'both']:
        json_path = f"{base_path}.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
        console.print(f"📄 JSON报告已保存: {json_path}", style="blue")
    
    if format in ['text', 'both']:
        text_path = f"{base_path}.txt"
        with open(text_path, 'w', encoding='utf-8') as f:
            f.write(f"=" * 60 + "\n")
            f.write(f"活动报告: {activity.name}\n")
            f.write(f"=" * 60 + "\n\n")
            f.write(f"活动ID: {activity.activity_id}\n")
            f.write(f"活动日期: {activity.date}\n")
            f.write(f"年龄限制: {activity.min_age}-{activity.max_age}岁\n")
            f.write(f"最大容量: {activity.max_capacity}人\n\n")
            
            f.write(f"--- 统计摘要 ---\n")
            f.write(f"总报名数: {len(activity_regs)}\n")
            f.write(f"已确认: {len(confirmed)}人\n")
            f.write(f"已取消: {len(cancelled)}人\n")
            f.write(f"候补中: {len(waitlisted)}人\n")
            f.write(f"已付款: {paid_count}人\n")
            f.write(f"付款锁定: {locked_count}人\n")
            f.write(f"未付款: {unpaid_count}人\n")
            f.write(f"剩余名额: {max(0, activity.max_capacity - len(confirmed))}个\n")
            f.write(f"候补队列: {len(waitlist.queue)}人\n")
            f.write(f"总收入: ¥{total_revenue:.2f}\n\n")
            
            f.write(f"--- 已确认报名列表 ---\n")
            for idx, reg in enumerate(confirmed, 1):
                family = families.get(reg['family_id'], {})
                f.write(f"{idx}. 家庭: {family.get('parent_name', '未知')}\n")
                f.write(f"   报名ID: {reg['registration_id']}\n")
                f.write(f"   付款状态: {reg['payment_status']}\n")
                f.write(f"\n")
        console.print(f"📄 文本报告已保存: {text_path}", style="blue")
    
    table = Table(title=f"活动 {activity.name} 摘要")
    table.add_column("项目")
    table.add_column("数值")
    table.add_row("总报名数", str(len(activity_regs)))
    table.add_row("已确认", str(len(confirmed)))
    table.add_row("已取消", str(len(cancelled)))
    table.add_row("候补中", str(len(waitlisted)))
    table.add_row("剩余名额", str(max(0, activity.max_capacity - len(confirmed))))
    console.print(table)


@report.command('verify')
@click.argument('activity_id')
def verify_report_consistency(activity_id):
    """验证JSON报告和文本报告一致性"""
    base_path = f"reports/activity_{activity_id}"
    json_path = f"{base_path}.json"
    text_path = f"{base_path}.txt"
    
    if not os.path.exists(json_path) or not os.path.exists(text_path):
        console.print(f"❌ 报告文件不存在，请先生成报告", style="red")
        return
    
    with open(json_path, 'r', encoding='utf-8') as f:
        json_data = json.load(f)
    
    with open(text_path, 'r', encoding='utf-8') as f:
        text_content = f.read()
    
    errors = []
    summary = json_data['summary']
    
    checks = [
        (f"总报名数: {summary['total_registrations']}", "总报名数不匹配"),
        (f"已确认: {summary['confirmed']}人", "已确认人数不匹配"),
        (f"已取消: {summary['cancelled']}人", "已取消人数不匹配"),
        (f"候补中: {summary['waitlisted']}人", "候补人数不匹配"),
        (f"已付款: {summary['paid']}人", "已付款人数不匹配"),
    ]
    
    for check_str, error_msg in checks:
        if check_str not in text_content:
            errors.append(error_msg)
    
    if errors:
        console.print(f"❌ 报告一致性检查失败:", style="red")
        for err in errors:
            console.print(f"  - {err}", style="red")
    else:
        console.print(f"✅ 报告一致性检查通过", style="green")


@cli.group()
def troubleshoot():
    """问题排查"""
    pass


@troubleshoot.command('age')
@click.argument('activity_id')
def check_age_violations(activity_id):
    """检查年龄违规"""
    activities = get_all_activities()
    families = get_all_families()
    registrations = get_all_registrations()
    
    if activity_id not in activities:
        console.print(f"❌ 活动不存在", style="red")
        return
    
    activity = Activity(**activities[activity_id])
    violations = []
    
    for reg in registrations.values():
        if reg['activity_id'] == activity_id:
            family = families.get(reg['family_id'])
            if family:
                for child in family['children']:
                    if child['age'] < activity.min_age or child['age'] > activity.max_age:
                        violations.append({
                            'registration_id': reg['registration_id'],
                            'family': family['parent_name'],
                            'child': child['name'],
                            'age': child['age'],
                            'allowed_range': f"{activity.min_age}-{activity.max_age}"
                        })
    
    if violations:
        console.print(f"⚠️  发现 {len(violations)} 例年龄违规:", style="yellow")
        table = Table()
        table.add_column("报名ID")
        table.add_column("家庭")
        table.add_column("儿童")
        table.add_column("年龄")
        table.add_column("允许范围")
        for v in violations:
            table.add_row(v['registration_id'], v['family'], v['child'], str(v['age']), v['allowed_range'])
        console.print(table)
    else:
        console.print(f"✅ 未发现年龄违规", style="green")


@troubleshoot.command('payment')
@click.argument('activity_id')
def check_payment_issues(activity_id):
    """检查付款问题"""
    registrations = get_all_registrations()
    activities = get_all_activities()
    
    if activity_id not in activities:
        console.print(f"❌ 活动不存在", style="red")
        return
    
    activity = Activity(**activities[activity_id])
    issues = []
    
    for reg in registrations.values():
        if reg['activity_id'] == activity_id and reg['status'] == RegistrationStatus.CONFIRMED.value:
            if reg['payment_expires_at']:
                expires = datetime.fromisoformat(reg['payment_expires_at'])
                if datetime.now() > expires and reg['payment_status'] == PaymentStatus.UNPAID.value:
                    issues.append({
                        'registration_id': reg['registration_id'],
                        'issue': "付款已逾期",
                        'expires_at': reg['payment_expires_at']
                    })
    
    if issues:
        console.print(f"⚠️  发现 {len(issues)} 个付款问题:", style="yellow")
        table = Table()
        table.add_column("报名ID")
        table.add_column("问题")
        table.add_column("到期时间")
        for issue in issues:
            table.add_row(issue['registration_id'], issue['issue'], issue['expires_at'])
        console.print(table)
    else:
        console.print(f"✅ 未发现付款问题", style="green")


@cli.command('load-samples')
def load_samples():
    """加载样例数据"""
    from datetime import timedelta
    
    activities = {
        "act001": Activity(
            activity_id="act001",
            name="周末亲子农场游",
            date="2026-05-25",
            max_capacity=3,
            min_age=3,
            max_age=12,
            price_per_person=199.0,
            payment_lock_hours=24
        ).model_dump(),
        "act002": Activity(
            activity_id="act002",
            name="空活动测试",
            date="2026-06-01",
            max_capacity=10,
            min_age=5,
            max_age=10,
            price_per_person=99.0
        ).model_dump()
    }
    save_json('activities.json', activities)
    
    families = {
        "fam001": Family(
            family_id="fam001",
            parent_name="张爸爸",
            phone="13800138001",
            children=[Child(name="小明", age=5), Child(name="小红", age=3)],
            total_members=4
        ).model_dump(),
        "fam002": Family(
            family_id="fam002",
            parent_name="李妈妈",
            phone="13800138002",
            children=[Child(name="小刚", age=8)],
            total_members=2
        ).model_dump(),
        "fam003": Family(
            family_id="fam003",
            parent_name="王爸爸",
            phone="13800138003",
            children=[Child(name="小华", age=6), Child(name="小美", age=4)],
            total_members=4
        ).model_dump(),
        "fam004": Family(
            family_id="fam004",
            parent_name="赵妈妈",
            phone="13800138004",
            children=[Child(name="小强", age=10)],
            total_members=2
        ).model_dump(),
        "fam005": Family(
            family_id="fam005",
            parent_name="脏数据测试",
            phone="invalid-phone",
            children=[Child(name="超龄儿童", age=15)],
            total_members=2
        ).model_dump()
    }
    save_json('families.json', families)
    
    now = datetime.now()
    registrations = {}
    
    for i, fam_id in enumerate(["fam001", "fam002", "fam003"], 1):
        expires = now + timedelta(hours=24) if i == 1 else None
        paid_status = PaymentStatus.PAID.value if i == 2 else PaymentStatus.UNPAID.value
        registrations[f"reg00{i}"] = Registration(
            registration_id=f"reg00{i}",
            activity_id="act001",
            family_id=fam_id,
            status=RegistrationStatus.CONFIRMED,
            registered_at=now.isoformat(),
            payment_status=paid_status,
            payment_expires_at=expires.isoformat() if expires else None
        ).model_dump()
    
    registrations["reg004"] = Registration(
        registration_id="reg004",
        activity_id="act001",
        family_id="fam004",
        status=RegistrationStatus.WAITLISTED,
        registered_at=now.isoformat(),
        payment_status=PaymentStatus.UNPAID
    ).model_dump()
    
    save_json('registrations.json', registrations)
    
    waitlists = {
        "act001": WaitlistQueue(
            activity_id="act001",
            queue=["reg004"],
            last_updated=now.isoformat()
        ).model_dump()
    }
    save_json('waitlists.json', waitlists)
    
    payments = {
        "pay001": Payment(
            payment_id="pay001",
            registration_id="reg002",
            amount=398.0,
            paid_at=now.isoformat(),
            transaction_id="TXN0012345"
        ).model_dump()
    }
    save_json('payments.json', payments)
    
    console.print("✅ 样例数据加载完成", style="green")
    console.print("包含:", style="blue")
    console.print("  - 2个活动（1个有报名，1个为空）", style="dim")
    console.print("  - 5个家庭（含1个脏数据测试）", style="dim")
    console.print("  - 4条报名（3条确认，1条候补）", style="dim")
    console.print("  - 1条付款记录", style="dim")
    console.print("  - 边界冲突：超龄儿童、已满员活动", style="dim")


if __name__ == '__main__':
    cli()
