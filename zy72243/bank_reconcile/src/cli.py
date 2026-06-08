import click
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src import init_db, BankStatementImporter, ReviewManager, AuditManager
from src.database import reset_session


@click.group()
@click.version_option(version="1.0.0")
def cli():
    """银行流水摘要归并系统 - 命令行工具"""
    pass


@cli.command()
@click.option("--reset", is_flag=True, help="清空旧数据后重新初始化")
def init(reset):
    """初始化数据库"""
    if reset:
        from src.database import _get_db_path
        db_path = _get_db_path()
        if os.path.exists(db_path):
            os.remove(db_path)
            click.echo("🗑️  已清空旧数据库")
        reset_session()
    init_db()
    click.echo("✅ 数据库初始化完成")


@cli.command("import-batch")
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--batch-no", required=True, help="清算批次号")
@click.option("--source-file", help="来源文件名称")
def import_batch(file_path, batch_no, source_file):
    """导入清算批次，自动检测港币人民币同列"""
    try:
        importer = BankStatementImporter()
        result = importer.import_batch(file_path, batch_no, source_file)
        click.echo(f"✅ 导入成功！")
        click.echo(f"   清算批次号: {result['batch_no']}")
        click.echo(f"   总记录数: {result['total_records']}")
        click.echo(f"   港币人民币同列数: {result['mixed_currency_count']}")
        if result['mixed_currency_count'] > 0:
            click.echo(f"   ⚠️  存在币种混合，需托管对接人复核")
    except ValueError as e:
        if "已存在" in str(e):
            click.echo(f"⚠️  {e}（如需重新导入，请先运行 python3 -m src.cli init --reset）")
        else:
            click.echo(f"❌ 导入失败: {e}", err=True)
    except Exception as e:
        click.echo(f"❌ 导入失败: {e}", err=True)


@cli.command()
@click.option("--batch-no", help="清算批次号")
@click.option("--review-type", type=click.Choice(["mixed_currency", "missing_holiday_note"]), help="复核类型")
def pending(batch_no, review_type):
    """查看待复核列表"""
    reviewer = ReviewManager()
    items = reviewer.get_pending_reviews(batch_no, review_type)

    if not items:
        click.echo("✅ 暂无待复核项")
        return

    click.echo(f"📋 待复核项 ({len(items)} 条):")
    click.echo("-" * 80)
    for idx, item in enumerate(items, 1):
        type_label = "🔴 币种混合" if item["audit_type"] == "mixed_currency" else "🟡 缺少节假日说明"
        click.echo(f"{idx}. {type_label}")
        click.echo(f"   批次ID: {item['batch_id']}, 交易ID: {item['transaction_id']}")
        click.echo(f"   原因: {item['reason']}")
        click.echo(f"   责任人: {item['responsible_party']}")
        click.echo(f"   下一步: {item['next_action']}")
        click.echo()


@cli.command("view-transaction")
@click.argument("transaction_id", type=int)
def view_transaction(transaction_id):
    """查看交易详情及关联信息"""
    reviewer = ReviewManager()
    data = reviewer.get_transaction_with_audit(transaction_id)

    if not data:
        click.echo(f"❌ 未找到交易 ID: {transaction_id}")
        return

    txn = data["transaction"]
    batch = data["batch"]
    audits = data["audits"]
    holidays = data["holiday_notes"]

    click.echo("=" * 80)
    click.echo("📊 交易详情")
    click.echo("=" * 80)
    click.echo(f"流水号: {txn['transaction_no']}")
    click.echo(f"日期: {txn['transaction_date']}")
    click.echo(f"摘要: {txn['summary']}")
    click.echo(f"金额列原始内容: {txn['amount_column_raw']}")
    click.echo(f"金额: {txn['amount']} {txn['currency']}")
    click.echo(f"币种混合: {'是 ⚠️' if txn['has_mixed_currency'] else '否'}")
    if txn["has_mixed_currency"]:
        click.echo(f"检测到币种: {txn['detected_currencies']}")
    click.echo(f"对方账户: {txn['counterparty']}")

    if batch:
        click.echo()
        click.echo("-" * 80)
        click.echo("📦 关联清算批次")
        click.echo("-" * 80)
        click.echo(f"批次号: {batch['batch_no']}")
        click.echo(f"来源文件: {batch['source_file']}")
        click.echo(f"状态: {batch['status']}")

    if holidays:
        click.echo()
        click.echo("-" * 80)
        click.echo("📅 节假日顺延说明")
        click.echo("-" * 80)
        for h in holidays:
            click.echo(f"{h['original_date']} → {h['adjusted_date']}: {h['reason']}")

    if audits:
        click.echo()
        click.echo("-" * 80)
        click.echo("📝 审计明细")
        click.echo("-" * 80)
        for audit in audits:
            status_icon = "✅" if audit["is_resolved"] else "⏳"
            type_label = "🔴 币种混合" if audit["audit_type"] == "mixed_currency" else "🟡 缺少节假日说明"
            click.echo(f"{status_icon} {type_label}, 状态: {audit['status']}")
            click.echo(f"   原因: {audit['reason']}")
            click.echo(f"   缺材料: {audit['missing_materials']}")
            click.echo(f"   下一步: {audit['next_action']}")
            click.echo(f"   责任人: {audit['responsible_party']}")
            click.echo()

    if txn["is_reviewed"]:
        click.echo("-" * 80)
        click.echo(f"✅ 已复核: {txn['reviewed_by']} at {txn['reviewed_at']}")
        if txn["review_note"]:
            click.echo(f"   复核意见: {txn['review_note']}")
    click.echo("=" * 80)


@cli.command("add-holiday")
@click.argument("batch_no")
@click.option("--original-date", required=True, help="原日期 (YYYY-MM-DD)")
@click.option("--adjusted-date", required=True, help="调整后日期 (YYYY-MM-DD)")
@click.option("--reason", required=True, help="顺延原因")
@click.option("--operator-note", help="运营备注")
def add_holiday(batch_no, original_date, adjusted_date, reason, operator_note):
    """补录节假日顺延说明（对账运营阿芬）"""
    try:
        orig_dt = datetime.strptime(original_date, "%Y-%m-%d")
        adj_dt = datetime.strptime(adjusted_date, "%Y-%m-%d")
    except ValueError:
        click.echo("❌ 日期格式错误，请使用 YYYY-MM-DD", err=True)
        return

    reviewer = ReviewManager()
    result = reviewer.add_holiday_adjustment(batch_no, orig_dt, adj_dt, reason, operator_note)

    if result:
        click.echo("✅ 节假日顺延说明已补录")
        click.echo(f"   原日期: {original_date} → {adjusted_date}")
        click.echo(f"   原因: {reason}")
        click.echo(f"   相关审计明细已自动更新")
    else:
        click.echo(f"❌ 未找到批次: {batch_no}", err=True)


@cli.command("review-mixed")
@click.argument("transaction_id", type=int)
@click.option("--review-note", required=True, help="复核意见")
@click.option("--reviewed-by", help="复核人，默认托管对接人")
@click.option("--mark-normal", is_flag=True, help="标记为正常（谨慎使用）")
def review_mixed(transaction_id, review_note, reviewed_by, mark_normal):
    """复核港币人民币同列问题（托管对接人）"""
    if not mark_normal:
        click.echo("⚠️  注意：此笔未标记为正常，将继续保留在待复核列表中")

    reviewer = ReviewManager()
    result = reviewer.review_mixed_currency(transaction_id, review_note, reviewed_by, mark_normal)

    if result:
        click.echo("✅ 复核完成")
        click.echo(f"   复核人: {result['reviewed_by']}")
        click.echo(f"   复核意见: {review_note}")
        if result["mark_normal"]:
            click.echo(f"   🟢 已标记为正常，审计明细已更新")
        else:
            click.echo(f"   ⚪ 未标记为正常，继续保留待复核状态")
    else:
        click.echo(f"❌ 未找到交易 ID: {transaction_id}", err=True)


@cli.command()
@click.argument("batch_no")
@click.option("--format", "output_format", type=click.Choice(["text", "json", "html"]), default="text", help="输出格式")
@click.option("--output", "-o", type=click.Path(), help="输出文件路径")
def report(batch_no, output_format, output):
    """生成审计报告"""
    auditor = AuditManager()
    result = auditor.generate_audit_report(batch_no, output_format)

    if not result:
        click.echo(f"❌ 未找到批次: {batch_no}", err=True)
        return

    if output:
        with open(output, "w", encoding="utf-8") as f:
            f.write(result)
        click.echo(f"✅ 报告已生成: {output}")
    else:
        click.echo(result)


@cli.command()
@click.option("--batch-no", help="清算批次号")
@click.option("--transaction-id", type=int, help="交易ID")
@click.option("--unresolved-only", is_flag=True, help="只显示未解决的")
def audits(batch_no, transaction_id, unresolved_only):
    """查看审计明细"""
    auditor = AuditManager()
    is_resolved = False if unresolved_only else None
    items = auditor.get_audit_trails(batch_no, transaction_id, is_resolved)

    if not items:
        click.echo("✅ 暂无审计记录")
        return

    click.echo(f"📝 审计明细 ({len(items)} 条):")
    click.echo("-" * 80)
    for idx, item in enumerate(items, 1):
        status_icon = "✅" if item["is_resolved"] else "⏳"
        type_label = "🔴 币种混合" if item["audit_type"] == "mixed_currency" else "🟡 缺少节假日说明"
        click.echo(f"{idx}. {status_icon} {type_label} | 状态: {item['status']}")
        click.echo(f"   创建时间: {item['created_at']}")
        click.echo(f"   原因: {item['reason']}")
        click.echo(f"   责任人: {item['responsible_party']}")
        click.echo(f"   下一步: {item['next_action']}")
        if item["missing_materials"]:
            click.echo(f"   缺材料: {item['missing_materials']}")
        click.echo()


@cli.command()
@click.option("--host", default="127.0.0.1", help="监听地址")
@click.option("--port", default=5000, type=int, help="监听端口")
def dashboard(host, port):
    """启动小看板（Web界面）"""
    from src.api import app
    click.echo(f"🚀 启动小看板: http://{host}:{port}")
    click.echo(f"   按 Ctrl+C 停止")
    app.run(host=host, port=port, debug=True)


if __name__ == "__main__":
    cli()
