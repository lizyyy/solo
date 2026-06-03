"""
CLI命令行工具
=============

提供完整的命令行接口，支持：
- 三步核心流程操作
- 财务复核
- 变更历史查询和回滚
- 审计复盘和可重跑命令生成

最后给人的不是功能清单，而是一份能复盘的记录和可重新跑的命令
"""

import json
import sys
import click
from datetime import datetime

from .database import init_db, get_db
from .services import (
    import_ex_dividend_screenshots,
    add_tax_rate_remark,
    update_spot_check_record,
    get_audit_timeline,
    get_rerun_commands,
    get_spot_check_detail
)
from .boundary_rules import (
    check_institution_name_consistency,
    update_spot_check_field,
    rollback_change,
    get_change_history_diff,
    review_institution_name,
    add_institution_alias,
    get_source_material_for_visualization
)


@click.group()
def cli():
    """跨境汇款合规抽检系统 - Cross-Border Compliance Spot Check"""
    pass


@cli.command()
def init():
    """初始化数据库"""
    init_db()
    click.echo("✅ 数据库已初始化完成")


# ==================== 三步核心流程 ====================

@cli.command()
@click.option("--source-file", required=True, help="除权日截图源文件路径")
@click.option("--operator", default="assistant_zhou", help="操作人")
@click.option("--data-file", help="包含截图数据的JSON文件路径")
def import_screenshots(source_file, operator, data_file):
    """
    第一步：导入除权日截图

    去重规则：文件哈希+日期+机构名联合去重，重复导入不会翻倍
    """
    if data_file:
        with open(data_file, "r", encoding="utf-8") as f:
            screenshots_data = json.load(f)
    else:
        screenshots_data = json.load(sys.stdin)

    db = next(get_db())
    result = import_ex_dividend_screenshots(
        db, screenshots_data, source_file, operator
    )

    click.echo(f"\n📋 {result['summary']}")
    click.echo(f"批次ID: {result['batch_id']}")
    click.echo(f"新建记录: {result['created']} 条")
    click.echo(f"跳过重复: {result['skipped']} 条")
    click.echo(f"抽检记录ID: {result['spot_check_ids']}")
    click.echo(f"\n🔄 可重跑命令: {result['rerun_command']}")


@cli.command()
@click.option("--spot-check-id", required=True, type=int, help="抽检记录ID")
@click.option("--institution-name", required=True, help="税费率备注中的机构名称")
@click.option("--remark-content", required=True, help="税费率备注内容")
@click.option("--tax-rate", help="税率")
@click.option("--tax-type", help="税种")
@click.option("--effective-date", help="生效日期")
@click.option("--source-file", help="税费率备注源文件")
@click.option("--operator", default="assistant_zhou", help="操作人")
def add_remark(spot_check_id, institution_name, remark_content, tax_rate,
               tax_type, effective_date, source_file, operator):
    """
    第二步：投研助理小周补看税费率备注

    自动检测机构简称一致性，不一致留待财务复核
    """
    db = next(get_db())
    remark_data = {
        "institution_name": institution_name,
        "remark_content": remark_content,
        "tax_rate": tax_rate,
        "tax_type": tax_type,
        "effective_date": effective_date,
        "source_file": source_file
    }

    spot_check, msg = add_tax_rate_remark(db, spot_check_id, remark_data, operator)

    if spot_check:
        click.echo(f"✅ {msg}")
        click.echo(f"抽检单号: {spot_check.check_no}")
        click.echo(f"当前状态: {spot_check.status.value}")
        click.echo(f"机构一致: {spot_check.institution_name_consistent}")

        if spot_check.status.value == "review_required":
            click.echo("\n⚠️  已自动创建财务复核任务，请财务复核人处理")
    else:
        click.echo(f"❌ {msg}")
        sys.exit(1)


@cli.command()
@click.option("--spot-check-id", required=True, type=int, help="抽检记录ID")
@click.option("--check-result", required=True, help="抽检结果")
@click.option("--check-result-reason", default="补录抽检结果", help="修改原因")
@click.option("--operator", default="assistant_zhou", help="操作人")
def update_record(spot_check_id, check_result, check_result_reason, operator):
    """
    第三步：补录记录更新

    完成抽检流程
    """
    db = next(get_db())
    update_data = {
        "check_result": check_result,
        "check_result_reason": check_result_reason
    }

    spot_check, msg = update_spot_check_record(
        db, spot_check_id, update_data, operator
    )

    if spot_check:
        click.echo(f"✅ {msg}")
        click.echo(f"抽检单号: {spot_check.check_no}")
        click.echo(f"当前状态: {spot_check.status.value}")
    else:
        click.echo(f"❌ {msg}")
        sys.exit(1)


# ==================== 财务复核 ====================

@cli.command()
@click.option("--spot-check-id", required=True, type=int, help="抽检记录ID")
@click.option("--approved/--rejected", required=True, help="通过或驳回")
@click.option("--resolution", required=True, help="复核意见")
@click.option("--standard-name", help="标准机构名称（通过时可指定）")
@click.option("--reviewer", default="finance_reviewer", help="复核人")
def review(spot_check_id, approved, resolution, standard_name, reviewer):
    """财务复核机构简称不一致"""
    db = next(get_db())
    spot_check, msg = review_institution_name(
        db, spot_check_id, approved, reviewer, resolution, standard_name
    )

    if spot_check:
        status = "✅ 通过" if approved else "❌ 驳回"
        click.echo(f"{status}: {msg}")
        click.echo(f"抽检单号: {spot_check.check_no}")
        click.echo(f"当前状态: {spot_check.status.value}")
        click.echo(f"机构一致: {spot_check.institution_name_consistent}")
    else:
        click.echo(f"❌ {msg}")
        sys.exit(1)


@cli.command()
@click.option("--status", type=click.Choice(["pending", "approved", "rejected"]),
              help="按状态筛选")
def list_review_tasks(status):
    """列出复核任务"""
    from .models import ReviewTask

    db = next(get_db())
    query = db.query(ReviewTask).order_by(ReviewTask.created_at.desc())
    if status:
        query = query.filter(ReviewTask.status == status)

    tasks = query.all()

    if not tasks:
        click.echo("暂无复核任务")
        return

    click.echo(f"\n📋 复核任务列表 (共{len(tasks)}条)")
    click.echo("-" * 80)
    for task in tasks:
        status_icon = "⏳" if task.status == "pending" else "✅" if task.status == "approved" else "❌"
        click.echo(f"\n{status_icon} 任务#{task.id} | 状态: {task.status}")
        click.echo(f"   抽检ID: {task.spot_check_id} | 类型: {task.issue_type}")
        click.echo(f"   问题: {task.issue_description}")
        if task.resolution:
            click.echo(f"   处理: {task.resolution}")
        click.echo(f"   创建: {task.created_at.strftime('%Y-%m-%d %H:%M:%S')}")


# ==================== 变更历史和回滚 ====================

@cli.command()
@click.option("--spot-check-id", required=True, type=int, help="抽检记录ID")
def history(spot_check_id):
    """查看变更历史，能看出改前改后的差别"""
    db = next(get_db())
    diff = get_change_history_diff(db, spot_check_id)

    click.echo(f"\n📜 变更历史 - 抽检记录#{spot_check_id}")
    click.echo(f"总变更次数: {diff['total_changes']}")
    click.echo("-" * 80)

    for change in diff['changes']:
        action_icon = {
            "create": "➕",
            "update": "✏️",
            "delete": "🗑️",
            "rollback": "↩️",
            "review_approve": "✅",
            "review_reject": "❌"
        }.get(change['action'], "•")

        click.echo(f"\n{action_icon} [{change['id']} {change['action']} | {change['created_at']}")
        click.echo(f"   字段: {change['field']}")
        click.echo(f"   修改人: {change['changed_by']}")
        click.echo(f"   原因: {change['change_reason']}")
        click.echo(f"   改前: {change['old_value']}")
        click.echo(f"   改后: {change['new_value']}")
        click.echo(f"   🔄 回滚命令: {change['rollback_command']}")


@cli.command()
@click.option("--change-id", required=True, type=int, help="变更记录ID")
@click.option("--operator", required=True, help="操作人")
def rollback(change_id, operator):
    """回滚指定变更"""
    db = next(get_db())
    spot_check, msg = rollback_change(db, change_id, operator)

    if spot_check:
        click.echo(f"↩️  {msg}")
        click.echo(f"抽检单号: {spot_check.check_no}")
    else:
        click.echo(f"❌ {msg}")
        sys.exit(1)


@cli.command()
@click.option("--spot-check-id", required=True, type=int, help="抽检记录ID")
@click.option("--field", required=True, help="要修改的字段名")
@click.option("--value", required=True, help="新值")
@click.option("--reason", required=True, help="修改原因")
@click.option("--operator", default="assistant_zhou", help="操作人")
def update_field(spot_check_id, field, value, reason, operator):
    """修改抽检记录字段（自动记录变更历史）"""
    db = next(get_db())

    if value.lower() == "true":
        parsed_value = True
    elif value.lower() == "false":
        parsed_value = False
    elif value.lower() == "none" or value.lower() == "null":
        parsed_value = None
    else:
        parsed_value = value

    spot_check, msg = update_spot_check_field(
        db, spot_check_id, field, parsed_value, operator, reason
    )

    if spot_check:
        click.echo(f"✏️  {msg}")
    else:
        click.echo(f"❌ {msg}")
        sys.exit(1)


# ==================== 审计复盘 ====================

@cli.command()
@click.option("--spot-check-id", type=int, help="按抽检记录筛选")
@click.option("--limit", default=50, help="显示条数")
def audit_timeline(spot_check_id, limit):
    """获取审计时间线，可复盘的记录"""
    db = next(get_db())
    logs = get_audit_timeline(db, spot_check_id, limit)

    click.echo(f"\n📊 审计时间线")
    click.echo("-" * 80)

    for log in logs:
        click.echo(f"\n⏰ {log['created_at']}")
        click.echo(f"   操作: {log['operation']} | 操作人: {log['operator']}")
        click.echo(f"   结果: {log['result_summary']}")
        click.echo(f"   🔄 重跑: {log['rerun_command']}")


@cli.command()
@click.option("--spot-check-id", required=True, type=int, help="抽检记录ID")
def rerun_commands(spot_check_id):
    """获取可重新跑的命令清单"""
    db = next(get_db())
    commands = get_rerun_commands(db, spot_check_id)

    if not commands:
        click.echo("暂无可重跑命令")
        return

    click.echo(f"\n🏃 可重跑命令清单 - 抽检记录#{spot_check_id}")
    click.echo("-" * 80)

    for cmd in commands:
        click.echo(f"\n📌 Step {cmd['step']}: {cmd['operation']}")
        click.echo(f"   时间: {cmd['timestamp']}")
        click.echo(f"   说明: {cmd['description']}")
        click.echo(f"   命令: {cmd['command']}")

    click.echo("\n" + "=" * 80)
    click.echo("📋 一键重跑全部命令：")
    for cmd in commands:
        click.echo(f"   {cmd['command']}")


# ==================== 查询 ====================

@cli.command()
@click.option("--spot-check-id", required=True, type=int, help="抽检记录ID")
def show(spot_check_id):
    """查看抽检记录完整详情"""
    db = next(get_db())
    detail = get_spot_check_detail(db, spot_check_id)

    if "error" in detail:
        click.echo(f"❌ {detail['error']}")
        sys.exit(1)

    click.echo(f"\n📋 抽检记录详情 - {detail['check_no']}")
    click.echo("=" * 80)
    click.echo(f"ID: {detail['id']}")
    click.echo(f"状态: {detail['status']}")
    click.echo(f"\n机构名称（截图）: {detail['institution_name_from_screenshot']}")
    click.echo(f"机构名称（备注）: {detail['institution_name_from_remark']}")
    click.echo(f"机构一致: {detail['institution_name_consistent']}")
    click.echo(f"\n抽检结果: {detail['check_result']}")
    click.echo(f"复核人: {detail['reviewed_by']}")
    click.echo(f"复核时间: {detail['reviewed_at']}")

    if detail['source_materials'].get('screenshot'):
        click.echo(f"\n📸 除权日截图:")
        s = detail['source_materials']['screenshot']
        click.echo(f"   源文件: {s['source_file']}")
        click.echo(f"   除权日: {s['ex_dividend_date']}")
        click.echo(f"   分红金额: {s['dividend_amount']}")

    if detail['source_materials'].get('remark'):
        click.echo(f"\n📝 税费率备注:")
        r = detail['source_materials']['remark']
        click.echo(f"   源文件: {r.get('source_file')}")
        click.echo(f"   税率: {r['tax_rate']}")
        click.echo(f"   备注内容: {r['remark_content']}")

    if detail['source_materials'].get('jump_recommendation'):
        j = detail['source_materials']['jump_recommendation']
        click.echo(f"\n⚠️  复核跳转建议: {j['hint']}")
        click.echo(f"   跳转至: {j['source_type']} #{j['source_id']}")

    if detail['review_tasks']:
        click.echo(f"\n🔍 复核任务:")
        for task in detail['review_tasks']:
            status_icon = "⏳" if task['status'] == "pending" else "✅" if task['status'] == "approved" else "❌"
            click.echo(f"   {status_icon} #{task['id']} {task['status']}: {task['issue_type']}")
            click.echo(f"      {task['issue_description']}")
            if task['resolution']:
                click.echo(f"      处理: {task['resolution']}")


@cli.command()
@click.option("--status", help="按状态筛选")
def list(status):
    """列出抽检记录"""
    from .models import ComplianceSpotCheck

    db = next(get_db())
    query = db.query(ComplianceSpotCheck).order_by(ComplianceSpotCheck.created_at.desc())
    if status:
        from .models import CheckStatus
        query = query.filter(ComplianceSpotCheck.status == CheckStatus(status))

    checks = query.all()

    if not checks:
        click.echo("暂无抽检记录")
        return

    click.echo(f"\n📋 抽检记录列表 (共{len(checks)}条)")
    click.echo("-" * 80)
    for check in checks:
        status_icon = {
            "imported": "📥",
            "remark_added": "📝",
            "review_required": "⚠️",
            "reviewed": "✅",
            "completed": "🎉",
            "rejected": "❌"
        }.get(check.status.value, "•")

        click.echo(f"\n{status_icon} #{check.id} {check.check_no} | {check.status.value}")
        click.echo(f"   机构(截图): {check.institution_name_from_screenshot}")
        click.echo(f"   机构(备注): {check.institution_name_from_remark}")
        click.echo(f"   一致: {check.institution_name_consistent}")
        click.echo(f"   创建: {check.created_at.strftime('%Y-%m-%d %H:%M:%S')}")


# ==================== 机构别名管理 ====================

@cli.command()
@click.option("--standard-name", required=True, help="标准机构名称")
@click.option("--alias", required=True, help="机构别名")
@click.option("--operator", default="admin", help="操作人")
def add_alias(standard_name, alias, operator):
    """添加机构别名映射"""
    db = next(get_db())
    success, msg = add_institution_alias(db, standard_name, alias, operator)

    if success:
        click.echo(f"✅ {msg}")
    else:
        click.echo(f"❌ {msg}")
        sys.exit(1)


@cli.command()
@click.option("--name-from-screenshot", required=True, help="截图中的机构名")
@click.option("--name-from-remark", required=True, help="备注中的机构名")
def check_consistency(name_from_screenshot, name_from_remark):
    """检查机构名称一致性"""
    db = next(get_db())
    is_consistent, hint = check_institution_name_consistency(
        db, name_from_screenshot, name_from_remark
    )

    status = "✅ 一致" if is_consistent else "⚠️  不一致"
    click.echo(f"{status}: {hint}")


# ==================== 3D/图表展示 复核跳转 ====================

@cli.command()
@click.option("--spot-check-id", required=True, type=int, help="抽检记录ID")
def get_source_material(spot_check_id):
    """3D/图表展示时获取原始材料路径，不要只剩漂亮画面"""
    db = next(get_db())
    result = get_source_material_for_visualization(db, spot_check_id)

    if "error" in result:
        click.echo(f"❌ {result['error']}")
        sys.exit(1)

    click.echo(f"\n🔍 原始材料溯源")
    click.echo("=" * 80)
    click.echo(f"抽检ID: {result['spot_check_id']}")
    click.echo(f"抽检单号: {result['check_no']}")
    click.echo(f"机构一致: {result['institution_consistent']}")

    if result['screenshot']:
        click.echo(f"\n📸 除权日截图:")
        click.echo(f"   文件: {result['screenshot']['source_file']}")
        click.echo(f"   机构: {result['screenshot']['institution_name']}")
        click.echo(f"   除权日: {result['screenshot']['ex_dividend_date']}")

    if result['remark']:
        click.echo(f"\n📝 税费率备注:")
        click.echo(f"   文件: {result['remark']['source_file']}")
        click.echo(f"   机构: {result['remark']['institution_name']}")
        click.echo(f"   备注: {result['remark']['remark_content']}")

    if result.get('jump_recommendation'):
        j = result['jump_recommendation']
        click.echo(f"\n⚠️  {j['hint']}")
        click.echo(f"   跳转动作: {j['action']}")
        click.echo(f"   跳转至: {j['source_type']} #{j['source_id']}")


def main():
    cli()


if __name__ == "__main__":
    main()
