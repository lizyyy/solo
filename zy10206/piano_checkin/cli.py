import click
import csv
import json
from datetime import datetime
from .db import DataStore
from .engine import Engine, BusinessError
from .models import Member, Package, generate_id

@click.group()
@click.pass_context
def cli(ctx):
    """共享琴房课时核销管理系统"""
    ctx.ensure_object(dict)
    ctx.obj['db'] = DataStore()
    ctx.obj['engine'] = Engine(ctx.obj['db'])

# --- Member Commands ---

@cli.group()
def member():
    """会员管理"""
    pass

@member.command("add")
@click.option("--name", required=True, help="会员姓名")
@click.option("--phone", required=True, help="联系电话")
@click.option("--balance", default=0.0, type=float, help="初始余额(小时)")
@click.pass_context
def add_member(ctx, name, phone, balance):
    """添加新会员"""
    db = ctx.obj['db']
    m = Member(
        member_id=generate_id("M"),
        name=name,
        phone=phone,
        balance_hours=balance
    )
    db.save_member(m.to_dict())
    click.echo(f"会员创建成功: {m.member_id} ({name})")

@member.command("list")
@click.pass_context
def list_members(ctx):
    """列出所有会员"""
    data = ctx.obj['engine'].get_all_members_status()
    for m in data:
        click.echo(f"{m['member_id']} | {m['name']} | 余额: {m['balance_hours']}h | 电话: {m['phone']}")

# --- Package Commands ---

@cli.group()
def package():
    """套餐/权益管理"""
    pass

@package.command("add")
@click.option("--member-id", required=True, help="会员ID")
@click.option("--type", "pkg_type", type=click.Choice(['time_based', 'monthly']), required=True)
@click.option("--hours", default=0.0, type=float, help="充值课时 (仅按课时包)")
@click.option("--start", required=True, help="开始日期 YYYY-MM-DD")
@click.option("--end", required=True, help="结束日期 YYYY-MM-DD")
@click.pass_context
def add_package(ctx, member_id, pkg_type, hours, start, end):
    """
    添加充值或包月权益。
    包月权益不扣余额，只在有效期内核销。
    """
    db = ctx.obj['db']
    
    # 如果是充值，需要累加会员余额
    if pkg_type == "time_based":
        members = db.get_members()
        m = next((x for x in members if x["member_id"] == member_id), None)
        if not m:
            click.echo("会员不存在", err=True)
            return
        m['balance_hours'] += hours
        db.save_member(m)
        click.echo(f"已充值: +{hours} 小时")

    p = Package(
        package_id=generate_id("PKG"),
        member_id=member_id,
        type=pkg_type,
        total_hours=hours,
        remaining_hours=hours if pkg_type == "time_based" else 0, # 简化逻辑，包月不计数
        start_date=start,
        end_date=end
    )
    db.save_package(p.to_dict())
    click.echo(f"套餐记录创建: {p.package_id}")

# --- Checkin (Core) ---

@cli.command()
@click.option("--member-id", required=True, help="会员ID")
@click.option("--date", required=True, help="使用日期 YYYY-MM-DD")
@click.option("--start", "start_time", required=True, help="开始时间 HH:MM")
@click.option("--end", "end_time", required=True, help="结束时间 HH:MM")
@click.option("--duration", type=int, default=0, help="强制指定时长(分钟)，默认自动计算")
@click.option("--type", "tx_type", default="checkin", 
              type=click.Choice(['checkin', 'manual_entry', 'add_hours', 'penalty']),
              help="操作类型: checkin(正常核销), manual_entry(补录), add_hours(加时), penalty(预约取消扣费)")
@click.option("--ref-id", default="", help="关联原预约ID (用于补录/加时去重)")
@click.option("--notes", default="", help="备注/人工补录理由")
@click.option("--force", is_flag=True, help="余额不足时强制核销 (进入人工审核)")
@click.option("--yes", "-y", is_flag=True, help="跳过确认直接写入 (不推荐用于补录)")
@click.pass_context
def checkin(ctx, member_id, date, start_time, end_time, duration, tx_type, ref_id, notes, force, yes):
    """
    课时核销（核心流程）。
    
    步骤：1. 计算金额 2. 预览结果 3. 确认写入
    """
    engine = ctx.obj['engine']
    
    # 自动计算时长
    if not duration:
        try:
            fmt = "%H:%M"
            t1 = datetime.strptime(start_time, fmt)
            t2 = datetime.strptime(end_time, fmt)
            delta = t2 - t1
            duration = int(delta.total_seconds() / 60)
            if duration <= 0:
                raise ValueError
        except:
            click.echo("时间格式错误或结束时间早于开始时间，请手动指定 --duration", err=True)
            return

    no_show = (tx_type == "penalty")

    try:
        tx, report = engine.preview(
            member_id=member_id,
            tx_type=tx_type,
            date=date,
            duration_min=duration,
            start_time=start_time,
            end_time=end_time,
            ref_id=ref_id,
            notes=notes,
            no_show=no_show,
            ignore_balance=force
        )
    except BusinessError as e:
        click.echo(f"[错误] {e}", err=True)
        return

    # 打印预览
    click.echo("\n" + "="*30)
    click.echo("📋 操作预览")
    click.echo("="*30)
    click.echo(f"会员: {report['member_name']} ({member_id})")
    click.echo(f"时间: {date} {start_time}-{end_time} ({duration}分钟)")
    click.echo(f"类型: {tx_type}")
    click.echo(f"原余额: {report['original_balance']} 小时")
    
    if report['has_monthly']:
        click.echo(f"状态: 🟢 包月有效期内，免费核销 (余额不变)")
    else:
        click.echo(f"拟扣减: {report['calculated_deduction']} 小时")
        click.echo(f"新余额: {report['new_balance']} 小时")
    
    if report['requires_review']:
        click.echo(f"状态: 🔴 需人工审核 -> {report['review_reason']}")
    elif not report['has_monthly']:
        click.echo(f"状态: 🟢 余额充足")

    if notes:
        click.echo(f"备注: {notes}")
    click.echo("="*30)

    if yes:
        confirm = True
    else:
        confirm = click.confirm("确认写入历史记录？", default=False)

    if confirm:
        try:
            result = engine.confirm(tx)
            click.echo(f"✅ 操作成功! TX ID: {result['tx_id']}")
            if report['requires_review']:
                click.echo("⚠️  该记录已加入人工审核清单。")
        except BusinessError as e:
            click.echo(f"[确认失败] {e}", err=True)

# --- Query & Export ---

@cli.command()
@click.option("--member-id", default=None, help="筛选特定会员")
@click.option("--limit", default=10, help="显示条数")
@click.pass_context
def history(ctx, member_id, limit):
    """查询核销历史"""
    records = ctx.obj['engine'].get_history(member_id=member_id)
    for r in records[:limit]:
        tag = "🔴" if r['requires_review'] else "🟢"
        click.echo(f"{r['date']} {r['start_time']} | {r['type']} | {r['amount']}h | Balance: {r['balance_after']}h | {tag} {r.get('review_reason', '')} | {r['tx_id']}")

@cli.command()
@click.pass_context
def review(ctx):
    """列出所有需要人工审核的记录"""
    records = ctx.obj['engine'].get_review_list()
    if not records:
        click.echo("暂无待审核记录。")
        return
    
    click.echo(f"共发现 {len(records)} 条待审核记录：")
    for r in records:
        click.echo(f"- [{r['date']}] {r['member_id']} | {r['review_reason']} | 变动: {r['amount']}h | Ref: {r['ref_id']}")

@cli.command()
@click.option("--dir", "export_dir", default="./exports", help="导出目录")
@click.pass_context
def export(ctx, export_dir):
    """
    导出数据：
    1. members_balance.csv (会员余额表)
    2. review_pending.csv (待审核清单)
    """
    import os
    if not os.path.exists(export_dir):
        os.makedirs(export_dir)

    engine = ctx.obj['engine']

    # 1. Export Members
    members = engine.get_all_members_status()
    m_path = os.path.join(export_dir, "members_balance.csv")
    with open(m_path, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=list(members[0].keys()) if members else [])
        writer.writeheader()
        writer.writerows(members)
    click.echo(f"✅ 导出会员余额: {m_path}")

    # 2. Export Review List
    reviews = engine.get_review_list()
    r_path = os.path.join(export_dir, "review_pending.csv")
    if reviews:
        keys = list(reviews[0].keys())
        # 过滤掉太冗长的字段，保留关键字段
        show_keys = ['tx_id', 'member_id', 'date', 'start_time', 'type', 'amount', 'balance_before', 'balance_after', 'requires_review', 'review_reason', 'notes', 'ref_id']
        with open(r_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=show_keys, extrasaction='ignore')
            writer.writeheader()
            writer.writerows(reviews)
        click.echo(f"✅ 导出待审核清单: {r_path}")
    else:
        click.echo("ℹ️  没有待审核记录需要导出。")

if __name__ == "__main__":
    cli()
