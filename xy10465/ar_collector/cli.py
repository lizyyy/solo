import os
from datetime import date
from typing import Optional
import click
from tabulate import tabulate
from .storage import Storage
from .service import CollectorService, ValidationError


DATA_DIR = os.environ.get("AR_DATA_DIR", os.path.join(os.getcwd(), "ar_data"))


def get_service() -> CollectorService:
    storage = Storage(DATA_DIR)
    return CollectorService(storage)


def format_amount(amount: float) -> str:
    return f"¥{amount:,.2f}"


def format_date(d: date) -> str:
    return d.strftime("%Y-%m-%d") if d else "-"


@click.group()
def cli():
    """应收催款分层 CLI - 管理应收账款和催款优先级"""
    pass


@cli.command()
def init():
    """初始化数据目录"""
    Storage(DATA_DIR)
    click.echo(f"✓ 数据目录已初始化: {DATA_DIR}")
    click.echo("")
    click.echo("下一步:")
    click.echo("  1. 创建 sample_data/ 目录并准备 CSV 文件")
    click.echo("  2. 使用 'import' 命令导入数据")
    click.echo("  3. 使用 'report priority' 查看催款优先列表")


@cli.group()
def import_cmd():
    """从 CSV 导入数据"""
    pass


@import_cmd.command("customers")
@click.argument("csv_path")
def import_customers(csv_path: str):
    """导入客户等级数据"""
    try:
        service = get_service()
        added, skipped = service.import_customers_from_csv(csv_path)
        click.echo(f"✓ 成功导入 {added} 个客户")
        if skipped:
            click.echo(f"⚠ 跳过 {len(skipped)} 条记录:")
            for msg in skipped[:5]:
                click.echo(f"  - {msg}")
            if len(skipped) > 5:
                click.echo(f"  ... 还有 {len(skipped) - 5} 条")
    except ValidationError as e:
        click.echo(f"✗ 错误: {e}", err=True)
    except Exception as e:
        click.echo(f"✗ 意外错误: {e}", err=True)


@import_cmd.command("receivables")
@click.argument("csv_path")
def import_receivables(csv_path: str):
    """导入应收清单数据"""
    try:
        service = get_service()
        added, skipped = service.import_receivables_from_csv(csv_path)
        click.echo(f"✓ 成功导入 {added} 条应收")
        if skipped:
            click.echo(f"⚠ 跳过 {len(skipped)} 条记录:")
            for msg in skipped[:5]:
                click.echo(f"  - {msg}")
            if len(skipped) > 5:
                click.echo(f"  ... 还有 {len(skipped) - 5} 条")
    except ValidationError as e:
        click.echo(f"✗ 错误: {e}", err=True)
    except Exception as e:
        click.echo(f"✗ 意外错误: {e}", err=True)


@import_cmd.command("logs")
@click.argument("csv_path")
def import_logs(csv_path: str):
    """导入催款记录数据"""
    try:
        service = get_service()
        added, skipped = service.import_collection_logs_from_csv(csv_path)
        click.echo(f"✓ 成功导入 {added} 条催款记录")
        if skipped:
            click.echo(f"⚠ 跳过 {len(skipped)} 条记录:")
            for msg in skipped[:5]:
                click.echo(f"  - {msg}")
            if len(skipped) > 5:
                click.echo(f"  ... 还有 {len(skipped) - 5} 条")
    except ValidationError as e:
        click.echo(f"✗ 错误: {e}", err=True)
    except Exception as e:
        click.echo(f"✗ 意外错误: {e}", err=True)


@import_cmd.command("promises")
@click.argument("csv_path")
def import_promises(csv_path: str):
    """导入承诺付款日期数据"""
    try:
        service = get_service()
        added, skipped = service.import_promises_from_csv(csv_path)
        click.echo(f"✓ 成功导入 {added} 条承诺")
        if skipped:
            click.echo(f"⚠ 跳过 {len(skipped)} 条记录:")
            for msg in skipped[:5]:
                click.echo(f"  - {msg}")
            if len(skipped) > 5:
                click.echo(f"  ... 还有 {len(skipped) - 5} 条")
    except ValidationError as e:
        click.echo(f"✗ 错误: {e}", err=True)
    except Exception as e:
        click.echo(f"✗ 意外错误: {e}", err=True)


@cli.command()
@click.argument("customer_id")
def customer(customer_id: str):
    """查看客户详情"""
    try:
        service = get_service()
        detail = service.get_customer_detail(customer_id)
        
        if not detail:
            click.echo(f"✗ 客户不存在: {customer_id}", err=True)
            return
        
        c = detail["customer"]
        click.echo("=" * 60)
        click.echo(f"客户详情 - {c.name}")
        click.echo("=" * 60)
        click.echo(f"客户编号: {c.customer_id}")
        click.echo(f"客户等级: {c.tier.value if hasattr(c.tier, 'value') else c.tier}")
        click.echo(f"信用额度: {format_amount(c.credit_limit)}")
        if c.contact_person:
            click.echo(f"联系人: {c.contact_person}")
        if c.phone:
            click.echo(f"电话: {c.phone}")
        if c.email:
            click.echo(f"邮箱: {c.email}")
        click.echo("")
        
        click.echo(f"总应收余额: {format_amount(detail['total_balance'])}")
        click.echo(f"逾期余额: {format_amount(detail['overdue_balance'])}")
        click.echo("")
        
        if detail["receivables"]:
            click.echo("应收账单:")
            headers = ["发票号", "开票日期", "到期日", "金额", "已付", "余额", "逾期天数", "状态"]
            rows = []
            for r in detail["receivables"]:
                rows.append([
                    r.invoice_no,
                    format_date(r.invoice_date),
                    format_date(r.due_date),
                    format_amount(r.amount),
                    format_amount(r.paid_amount),
                    format_amount(r.balance),
                    r.overdue_days if r.overdue_days > 0 else "-",
                    r.status.value if hasattr(r.status, "value") else r.status,
                ])
            click.echo(tabulate(rows, headers=headers, tablefmt="simple"))
            click.echo("")
        
        if detail["active_promises"]:
            click.echo("有效付款承诺:")
            headers = ["发票号", "承诺日期", "承诺付款日", "承诺金额", "失约天数"]
            rows = []
            for r, p in detail["active_promises"]:
                rows.append([
                    r.invoice_no,
                    format_date(p.promise_date),
                    format_date(p.promised_payment_date),
                    format_amount(p.promised_amount),
                    p.days_overdue if p.is_missed else "-",
                ])
            click.echo(tabulate(rows, headers=headers, tablefmt="simple"))
            click.echo("")
        
        if detail["collection_logs"]:
            click.echo(f"催款记录 (共 {len(detail['collection_logs'])} 条):")
            headers = ["日期", "方式", "结果", "备注"]
            rows = []
            logs_sorted = sorted(detail["collection_logs"], key=lambda x: x.contact_date, reverse=True)
            for log in logs_sorted[:10]:
                rows.append([
                    format_date(log.contact_date),
                    log.contact_method,
                    log.contact_result,
                    (log.notes or "")[:40],
                ])
            click.echo(tabulate(rows, headers=headers, tablefmt="simple"))
            if len(logs_sorted) > 10:
                click.echo(f"... 还有 {len(logs_sorted) - 10} 条历史记录")
        
    except Exception as e:
        click.echo(f"✗ 错误: {e}", err=True)


@cli.command()
@click.argument("invoice_no")
@click.option("--date", "contact_date_str", default=None, help="催款日期 (YYYY-MM-DD)，默认今天")
@click.option("--method", default="phone", help="联系方式: phone/email/visit/letter")
@click.option("--result", default="contacted", help="结果: contacted/answered/no_answer/voicemail")
@click.option("--notes", default=None, help="备注")
@click.option("--promise-date", "promise_date_str", default=None, help="客户承诺付款日期 (YYYY-MM-DD)")
@click.option("--promise-amount", type=float, default=None, help="客户承诺付款金额")
def collect(
    invoice_no: str,
    contact_date_str: Optional[str],
    method: str,
    result: str,
    notes: Optional[str],
    promise_date_str: Optional[str],
    promise_amount: Optional[float],
):
    """记录一次催款"""
    try:
        service = get_service()
        
        contact_date = date.fromisoformat(contact_date_str) if contact_date_str else date.today()
        promise_date = date.fromisoformat(promise_date_str) if promise_date_str else None
        
        log = service.record_collection(
            invoice_no=invoice_no,
            contact_date=contact_date,
            contact_method=method,
            contact_result=result,
            notes=notes,
            promised_payment_date=promise_date,
            promised_amount=promise_amount,
        )
        
        click.echo(f"✓ 催款记录已保存")
        click.echo(f"  发票: {log.invoice_no}")
        click.echo(f"  日期: {format_date(log.contact_date)}")
        click.echo(f"  方式: {log.contact_method}")
        click.echo(f"  结果: {log.contact_result}")
        if notes:
            click.echo(f"  备注: {notes}")
        if promise_date:
            click.echo(f"  承诺付款: {format_date(promise_date)}")
        
    except ValidationError as e:
        click.echo(f"✗ 错误: {e}", err=True)
    except Exception as e:
        click.echo(f"✗ 意外错误: {e}", err=True)


@cli.command()
@click.argument("invoice_no")
@click.option("--reason", required=True, help="争议原因")
@click.option("--date", "dispute_date_str", default=None, help="争议日期 (YYYY-MM-DD)，默认今天")
def dispute(invoice_no: str, reason: str, dispute_date_str: Optional[str]):
    """标记账款为争议状态"""
    try:
        service = get_service()
        dispute_date = date.fromisoformat(dispute_date_str) if dispute_date_str else date.today()
        
        rec = service.mark_dispute(invoice_no, reason, dispute_date)
        
        click.echo(f"✓ 已标记为争议")
        click.echo(f"  发票: {rec.invoice_no}")
        click.echo(f"  争议日期: {format_date(rec.dispute_date)}")
        click.echo(f"  争议原因: {rec.dispute_reason}")
        click.echo(f"  余额: {format_amount(rec.balance)}")
        
    except ValidationError as e:
        click.echo(f"✗ 错误: {e}", err=True)
    except Exception as e:
        click.echo(f"✗ 意外错误: {e}", err=True)


@cli.command()
@click.argument("invoice_no")
@click.option("--notes", default=None, help="解决备注")
@click.option("--date", "resolved_date_str", default=None, help="解决日期 (YYYY-MM-DD)，默认今天")
def resolve(invoice_no: str, notes: Optional[str], resolved_date_str: Optional[str]):
    """解除争议状态"""
    try:
        service = get_service()
        resolved_date = date.fromisoformat(resolved_date_str) if resolved_date_str else date.today()
        
        rec = service.resolve_dispute(invoice_no, notes, resolved_date)
        
        click.echo(f"✓ 争议已解除")
        click.echo(f"  发票: {rec.invoice_no}")
        click.echo(f"  解决日期: {format_date(rec.dispute_resolved_date)}")
        if notes:
            click.echo(f"  备注: {notes}")
        
    except ValidationError as e:
        click.echo(f"✗ 错误: {e}", err=True)
    except Exception as e:
        click.echo(f"✗ 意外错误: {e}", err=True)


@cli.command()
@click.argument("invoice_no")
@click.option("--amount", type=float, required=True, help="回款金额")
@click.option("--date", "payment_date_str", default=None, help="回款日期 (YYYY-MM-DD)，默认今天")
@click.option("--notes", default=None, help="备注")
def payment(
    invoice_no: str,
    amount: float,
    payment_date_str: Optional[str],
    notes: Optional[str],
):
    """更新回款"""
    try:
        service = get_service()
        payment_date = date.fromisoformat(payment_date_str) if payment_date_str else date.today()
        
        pay = service.record_payment(invoice_no, amount, payment_date, notes)
        rec = service.storage.get_receivable(invoice_no)
        
        click.echo(f"✓ 回款已记录")
        click.echo(f"  发票: {pay.invoice_no}")
        click.echo(f"  回款日期: {format_date(pay.payment_date)}")
        click.echo(f"  回款金额: {format_amount(pay.amount)}")
        click.echo(f"  剩余余额: {format_amount(rec.balance) if rec else '-'}")
        if rec and rec.balance <= 0:
            click.echo("  ✓ 该发票已结清")
        if notes:
            click.echo(f"  备注: {notes}")
        
    except ValidationError as e:
        click.echo(f"✗ 错误: {e}", err=True)
    except Exception as e:
        click.echo(f"✗ 意外错误: {e}", err=True)


@cli.group()
def report():
    """生成报告"""
    pass


@report.command("priority")
@click.option("--include-paid", is_flag=True, help="包含已结清的账单")
def priority_report(include_paid: bool):
    """催款优先列表"""
    try:
        service = get_service()
        tiered = service.get_tiered_receivables()
        
        click.echo("=" * 80)
        click.echo("催款优先列表")
        click.echo("=" * 80)
        
        levels = ["紧急", "高", "中", "低"]
        level_symbols = {"紧急": "🔴", "高": "🟠", "中": "🟡", "低": "🟢", "争议": "⚠️"}
        
        for level in levels:
            items = tiered.get(level, [])
            if not items:
                continue
            
            click.echo("")
            click.echo(f"{level_symbols.get(level, '')} {level}优先级 ({len(items)} 条)")
            click.echo("-" * 80)
            
            headers = ["#", "发票号", "客户", "余额", "逾期天数", "客户等级", "最后联系", "承诺付款"]
            rows = []
            
            for i, tr in enumerate(items, 1):
                customer_name = tr.customer.name if tr.customer else tr.receivable.customer_id
                tier_val = tr.customer.tier.value if (tr.customer and hasattr(tr.customer.tier, "value")) else (tr.customer.tier if tr.customer else "-")
                
                last_log = tr.collection_logs[-1] if tr.collection_logs else None
                last_contact = format_date(last_log.contact_date) if last_log else "未联系"
                
                promise_date = format_date(tr.active_promise.promised_payment_date) if tr.active_promise else "-"
                if tr.active_promise and tr.active_promise.is_missed:
                    promise_date = f"⚠️ {promise_date} (失约{tr.active_promise.days_overdue}天)"
                
                rows.append([
                    i,
                    tr.receivable.invoice_no,
                    customer_name,
                    format_amount(tr.receivable.balance),
                    tr.receivable.overdue_days if tr.receivable.overdue_days > 0 else "-",
                    tier_val,
                    last_contact,
                    promise_date,
                ])
            
            click.echo(tabulate(rows, headers=headers, tablefmt="simple"))
        
        disputed = tiered.get("争议", [])
        if disputed:
            click.echo("")
            click.echo(f"{level_symbols['争议']} 争议账款 ({len(disputed)} 条) - 需单独处理")
            click.echo("-" * 80)
            
            headers = ["#", "发票号", "客户", "余额", "争议日期", "争议原因"]
            rows = []
            
            for i, tr in enumerate(disputed, 1):
                customer_name = tr.customer.name if tr.customer else tr.receivable.customer_id
                rows.append([
                    i,
                    tr.receivable.invoice_no,
                    customer_name,
                    format_amount(tr.receivable.balance),
                    format_date(tr.receivable.dispute_date),
                    tr.receivable.dispute_reason or "-",
                ])
            
            click.echo(tabulate(rows, headers=headers, tablefmt="simple"))
        
        if include_paid:
            paid = tiered.get("已结清", [])
            if paid:
                click.echo("")
                click.echo(f"已结清 ({len(paid)} 条)")
                click.echo("-" * 80)
                headers = ["#", "发票号", "客户", "金额"]
                rows = []
                for i, tr in enumerate(paid, 1):
                    customer_name = tr.customer.name if tr.customer else tr.receivable.customer_id
                    rows.append([i, tr.receivable.invoice_no, customer_name, format_amount(tr.receivable.amount)])
                click.echo(tabulate(rows, headers=headers, tablefmt="simple"))
        
        click.echo("")
        click.echo("-" * 80)
        total_count = sum(len(v) for k, v in tiered.items() if k != "已结清" or include_paid)
        total_balance = sum(
            tr.receivable.balance
            for level, items in tiered.items()
            for tr in items
            if level != "已结清" or include_paid
        )
        click.echo(f"总计: {total_count} 条, 余额: {format_amount(total_balance)}")
        
    except Exception as e:
        click.echo(f"✗ 错误: {e}", err=True)


@report.command("missed")
def missed_report():
    """承诺失约名单"""
    try:
        service = get_service()
        missed = service.get_missed_promises()
        
        click.echo("=" * 80)
        click.echo("承诺失约名单")
        click.echo("=" * 80)
        
        if not missed:
            click.echo("✓ 暂无失约承诺")
            return
        
        headers = ["#", "失约天数", "发票号", "客户", "余额", "承诺付款日", "承诺金额"]
        rows = []
        
        for i, (promise, rec, customer) in enumerate(missed, 1):
            customer_name = customer.name if customer else rec.customer_id
            rows.append([
                i,
                promise.days_overdue,
                rec.invoice_no,
                customer_name,
                format_amount(rec.balance),
                format_date(promise.promised_payment_date),
                format_amount(promise.promised_amount),
            ])
        
        click.echo(tabulate(rows, headers=headers, tablefmt="simple"))
        
        click.echo("")
        click.echo("-" * 80)
        total_amount = sum(p.promised_amount for p, _, _ in missed)
        total_balance = sum(r.balance for _, r, _ in missed)
        click.echo(f"失约承诺: {len(missed)} 条, 承诺金额: {format_amount(total_amount)}, 应收余额: {format_amount(total_balance)}")
        
    except Exception as e:
        click.echo(f"✗ 错误: {e}", err=True)


@report.command("weekly")
def weekly_report():
    """回款周报"""
    try:
        service = get_service()
        report_data = service.get_weekly_report()
        
        click.echo("=" * 80)
        click.echo("回款周报")
        click.echo("=" * 80)
        click.echo(f"报告周期: {format_date(report_data['week_start'])} 至 {format_date(report_data['week_end'])}")
        click.echo("")
        
        click.echo("【本周回款汇总】")
        click.echo(f"  回款笔数: {report_data['payment_count']}")
        click.echo(f"  回款金额: {format_amount(report_data['total_paid'])}")
        click.echo(f"  催款次数: {report_data['collection_count']}")
        click.echo("")
        
        if report_data['payment_details']:
            click.echo("【回款明细】")
            headers = ["日期", "发票号", "客户", "金额"]
            rows = []
            for pd in report_data['payment_details']:
                customer_name = pd['customer'].name if pd['customer'] else (pd['receivable'].customer_id if pd['receivable'] else "-")
                rows.append([
                    format_date(pd['payment'].payment_date),
                    pd['payment'].invoice_no,
                    customer_name,
                    format_amount(pd['payment'].amount),
                ])
            click.echo(tabulate(rows, headers=headers, tablefmt="simple"))
            click.echo("")
        
        click.echo("【当前应收概览】")
        click.echo(f"  总应收余额: {format_amount(report_data['total_receivables'])}")
        click.echo(f"  逾期笔数: {report_data['overdue_count']}, 金额: {format_amount(report_data['overdue_amount'])}")
        click.echo(f"  争议笔数: {report_data['disputed_count']}, 金额: {format_amount(report_data['disputed_amount'])}")
        
        if report_data['overdue_amount'] > 0:
            click.echo("")
            click.echo("⚠️ 建议: 重点关注逾期账款，优先联系高优先级客户")
        if report_data['disputed_count'] > 0:
            click.echo("")
            click.echo("⚠️ 建议: 尽快处理争议账款，避免影响回款")
        
    except Exception as e:
        click.echo(f"✗ 错误: {e}", err=True)


@cli.command()
def stats():
    """查看数据统计"""
    try:
        service = get_service()
        stats_data = service.storage.get_stats()
        tiered = service.get_tiered_receivables()
        
        click.echo("=" * 60)
        click.echo("数据统计")
        click.echo("=" * 60)
        
        click.echo(f"客户数: {stats_data['customers']}")
        click.echo(f"应收账单数: {stats_data['receivables']}")
        click.echo(f"催款记录数: {stats_data['collection_logs']}")
        click.echo(f"承诺记录数: {stats_data['promises']}")
        click.echo(f"回款记录数: {stats_data['payments']}")
        
        click.echo("")
        click.echo("优先级分布:")
        for level in ["紧急", "高", "中", "低", "争议", "已结清"]:
            items = tiered.get(level, [])
            if items:
                total_balance = sum(tr.receivable.balance for tr in items)
                click.echo(f"  {level}: {len(items)} 条, 余额 {format_amount(total_balance)}")
        
    except Exception as e:
        click.echo(f"✗ 错误: {e}", err=True)


if __name__ == "__main__":
    cli()
