import click
import os
import sys
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.database import SessionLocal, init_db
from src.workflow import (
    import_settlement_batch,
    add_holiday_note,
    update_supplementary_record,
    review_by_finance,
)
from src.report import generate_html_report, generate_supplementary_csv
from src.models import RecordStatus, NextOwner, SettlementRecord, SupplementaryRecord


@click.group()
def cli():
    """信用卡分期提前结清核对工具"""
    pass


@cli.command()
def init():
    """初始化数据库"""
    init_db()
    click.echo("✅ 数据库初始化完成")


@cli.command()
@click.argument("csv_path", type=click.Path(exists=True))
@click.option("--batch-no", required=True, help="清算批次号")
@click.option("--imported-by", default="system", help="导入人")
@click.option("--remark", default="", help="备注")
def import_batch(csv_path, batch_no, imported_by, remark):
    """导入清算批次数据"""
    db = SessionLocal()
    try:
        result = import_settlement_batch(db, csv_path, batch_no, imported_by, remark)
        click.echo(f"\n✅ 批次 [{batch_no}] 导入完成")
        click.echo(f"   总记录数: {result['total_records']}")
        click.echo(f"   机构简称不一致: {result['inconsistent_count']} 条")

        if result["issues"]:
            click.echo(f"\n⚠️  发现 {len(result['issues'])} 条机构简称不一致记录：")
            for issue in result["issues"]:
                click.echo(f"   - 流水号 {issue['serial_no']}: '{issue['org_name']}' → 期望 '{issue['expected_org']}'")

        click.echo(f"\n📋 不一致记录已标记为【异常待复核】状态，留给财务复核人处理。")
        click.echo(f"📋 一致记录已流转至【待基金会计处理】，等待林姐补录节假日顺延说明。")

    except Exception as e:
        click.echo(f"❌ 导入失败: {e}", err=True)
    finally:
        db.close()


@cli.command()
@click.argument("record_id", type=int)
@click.argument("note")
@click.option("--reviewed-by", default="fund_accounting_lin", help="补录人")
def add_holiday(record_id, note, reviewed_by):
    """基金会计林姐补录节假日顺延说明"""
    db = SessionLocal()
    try:
        result = add_holiday_note(db, record_id, note, reviewed_by)
        click.echo(f"\n✅ 节假日顺延说明已补录")
        click.echo(f"   记录ID: {result['record_id']}")
        click.echo(f"   流水号: {result['serial_no']}")
        click.echo(f"   当前状态: {result['status']}")
        click.echo(f"   说明: {result['holiday_note']}")
        click.echo(f"\n📋 补录记录已自动更新，流转至【待财务复核】状态。")
    except ValueError as e:
        click.echo(f"❌ {e}", err=True)
    finally:
        db.close()


@cli.command()
@click.argument("record_id", type=int)
@click.option("--reason", help="留下原因")
@click.option("--missing", help="缺什么材料")
@click.option("--next-owner", type=click.Choice(["fund_accounting_lin", "financial_reviewer"]), help="下一步找谁")
@click.option("--updated-by", default="system", help="更新人")
def update_supp(record_id, reason, missing, next_owner, updated_by):
    """更新补录记录"""
    db = SessionLocal()
    try:
        result = update_supplementary_record(
            db, record_id,
            reason_kept=reason,
            missing_materials=missing,
            next_owner=next_owner,
            updated_by=updated_by,
        )
        click.echo(f"\n✅ 补录记录已更新")
        click.echo(f"   记录ID: {result['record_id']}")
        click.echo(f"   留下原因: {result['reason_kept']}")
        click.echo(f"   缺材料: {result['missing_materials']}")
        click.echo(f"   下一步: {result['next_owner']}")
    except ValueError as e:
        click.echo(f"❌ {e}", err=True)
    finally:
        db.close()


@cli.command()
@click.argument("record_id", type=int)
@click.option("--approved/--rejected", required=True, help="通过或退回")
@click.option("--comment", required=True, help="复核意见")
@click.option("--reviewed-by", default="financial_reviewer", help="复核人")
def review(record_id, approved, comment, reviewed_by):
    """财务复核人复核"""
    db = SessionLocal()
    try:
        result = review_by_finance(db, record_id, approved, comment, reviewed_by)
        status = "通过" if result["approved"] else "退回"
        click.echo(f"\n✅ 复核完成 - {status}")
        click.echo(f"   记录ID: {result['record_id']}")
        click.echo(f"   流水号: {result['serial_no']}")
        click.echo(f"   当前状态: {result['status']}")
    except ValueError as e:
        click.echo(f"❌ {e}", err=True)
    finally:
        db.close()


@cli.command()
@click.option("--output", default="./output/report.html", help="报告输出路径")
@click.option("--batch-no", help="指定批次号")
@click.option("--view-type", default="table", type=click.Choice(["table", "chart"]), help="默认视图")
def report(output, batch_no, view_type):
    """生成 HTML 报告"""
    db = SessionLocal()
    try:
        path = generate_html_report(db, output, batch_no, view_type)
        click.echo(f"\n✅ 报告已生成: {path}")
        click.echo(f"\n📊 报告包含三种视图：")
        click.echo(f"   1. 表格视图 - 详细数据，机构简称不一致记录置顶")
        click.echo(f"   2. 图表视图 - 数据概览柱状图，点击可追溯明细")
        click.echo(f"   3. 补录记录视图 - 财务复核人快速查看，10分钟开会够用")
    except Exception as e:
        click.echo(f"❌ 生成失败: {e}", err=True)
    finally:
        db.close()


@cli.command()
@click.option("--output", default="./output/supplementary.csv", help="CSV输出路径")
@click.option("--batch-no", help="指定批次号")
def export_supp(output, batch_no):
    """导出补录记录CSV（临时会用）"""
    db = SessionLocal()
    try:
        path = generate_supplementary_csv(db, output, batch_no)
        click.echo(f"\n✅ 补录记录已导出: {path}")
        click.echo(f"\n📋 包含字段：流水号、来源批次、机构简称、一致性、留下原因、缺材料、下一步、追溯路径")
        click.echo(f"⏱️  财务复核人打开这个CSV，10分钟会议够用。")
    except Exception as e:
        click.echo(f"❌ 导出失败: {e}", err=True)
    finally:
        db.close()


@cli.command()
@click.option("--batch-no", help="按批次筛选")
@click.option("--status", help="按状态筛选")
def list_records(batch_no, status):
    """列出所有记录"""
    db = SessionLocal()
    try:
        query = db.query(SettlementRecord).join(SupplementaryRecord, isouter=True)

        if batch_no:
            from src.models import SettlementBatch
            query = query.join(SettlementBatch).filter(SettlementBatch.batch_no == batch_no)

        if status:
            query = query.filter(SettlementRecord.status == status)

        records = query.order_by(SettlementRecord.id).all()

        click.echo(f"\n共 {len(records)} 条记录：\n")
        click.echo(f"{'ID':<5} {'流水号':<18} {'批次':<15} {'机构简称':<15} {'一致性':<8} {'状态':<14} {'下一步'}")
        click.echo("-" * 100)

        for rec in records:
            consistent = "✅一致" if rec.org_name_consistent else "❌不一致"
            status_map = {
                RecordStatus.PENDING_IMPORT: "待导入",
                RecordStatus.ABNEED_REVIEW: "异常待复核",
                RecordStatus.PENDING_FUND_ACCOUNTING: "待基金会计",
                RecordStatus.PENDING_REVIEW: "待财务复核",
                RecordStatus.REVIEWED: "已复核",
                RecordStatus.RESOLVED: "已完成",
            }
            owner_map = {
                NextOwner.FUND_ACCOUNTING_LIN: "林姐",
                NextOwner.FINANCIAL_REVIEWER: "财务复核人",
                "已完成": "已完成",
            }
            supp = rec.supplementary
            next_owner = owner_map.get(supp.next_owner if supp else "", "")
            batch = rec.batch

            click.echo(
                f"{rec.id:<5} {rec.serial_no:<18} {batch.batch_no if batch else '':<15} "
                f"{rec.org_name:<15} {consistent:<8} {status_map.get(rec.status, rec.status):<14} {next_owner}"
            )

        click.echo("")
    finally:
        db.close()


@cli.command()
def demo():
    """运行完整演示流程"""
    click.echo("=" * 60)
    click.echo("🚀 信用卡分期提前结清 - 完整流程演示")
    click.echo("=" * 60)

    sample_csv = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sample_data", "batch_20260601.csv")

    if not os.path.exists(sample_csv):
        click.echo(f"❌ 样例数据不存在: {sample_csv}")
        return

    db = SessionLocal()
    try:
        click.echo("\n📥 第一步：导入清算批次号 BATCH_20260601")
        click.echo("-" * 40)
        result = import_settlement_batch(db, sample_csv, "BATCH_20260601", "demo_user", "演示批次")
        click.echo(f"   ✅ 导入完成，{result['total_records']} 条记录，{result['inconsistent_count']} 条机构简称不一致")
        click.echo(f"   ⏳ 不一致记录状态：异常待复核（留给财务复核人）")
        click.echo(f"   ⏳ 一致记录状态：待基金会计处理")

        click.echo("\n👩‍💼 第二步：基金会计林姐补录节假日顺延说明")
        click.echo("-" * 40)

        for rec_id in [1, 2, 3]:
            note = f"该笔清算日期遇端午节假期，顺延至2026-06-03处理，已与前台确认。"
            result2 = add_holiday_note(db, rec_id, note, "fund_accounting_lin")
            status_map = {
                RecordStatus.PENDING_REVIEW: "待财务复核",
                RecordStatus.ABNEED_REVIEW: "异常待复核",
            }
            click.echo(f"   ✅ 记录ID={rec_id}: 补录完成，状态→{status_map.get(result2['status'], result2['status'])}")

        click.echo("\n📝 第三步：补录记录自动更新")
        click.echo("-" * 40)
        click.echo("   ✅ 节假日说明补录后，补录记录自动同步：")
        click.echo("      - 一致记录：留下原因更新为'节假日顺延说明已补录...'")
        click.echo("      - 不一致记录：留下原因说明'机构简称仍需财务复核人确认，节假日说明已补录'")
        click.echo("      - 缺材料：更新为'待财务复核人确认机构简称差异'或'无'")
        click.echo("      - 下一步：统一流转至财务复核人")
        click.echo("      - 追溯路径：完整记录每一步流转")

        click.echo("\n⏱️  临时会场景：生成补录记录CSV")
        click.echo("-" * 40)
        csv_path = generate_supplementary_csv(db, "./output/demo_supplementary.csv", "BATCH_20260601")
        click.echo(f"   ✅ 已导出: {csv_path}")
        click.echo(f"   📋 财务复核人打开CSV，10分钟会议够用：")
        click.echo("      | 哪条来自哪个批次 | 为什么留下 | 缺什么材料 | 下一步找谁 |")

        click.echo("\n📊 生成完整HTML报告")
        click.echo("-" * 40)
        report_path = generate_html_report(db, "./output/demo_report.html", "BATCH_20260601")
        click.echo(f"   ✅ 报告已生成: {report_path}")
        click.echo(f"   🔍 点击'机构简称不一致'可追溯到清算批次号和节假日说明")
        click.echo(f"   📈 图表视图点击柱状图可快速定位问题")
        click.echo(f"   📋 '仅看补录记录'视图适合会议快速查看")

        click.echo("\n" + "=" * 60)
        click.echo("✅ 演示完成！核心流程已跑通：")
        click.echo("   1. 清算批次号导入 ✓")
        click.echo("   2. 机构简称不一致标记（留给财务复核人）✓")
        click.echo("   3. 基金会计林姐补录节假日顺延说明 ✓")
        click.echo("   4. 补录记录自动更新 ✓")
        click.echo("   5. 报告追溯能力 ✓")
        click.echo("   6. 临时会快速查看 ✓")
        click.echo("=" * 60)

    except Exception as e:
        click.echo(f"❌ 演示失败: {e}", err=True)
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
    cli()
