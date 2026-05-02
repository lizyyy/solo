import os
import sys
import json
from datetime import datetime
from typing import Optional, List

import click

from .config import ConfigManager
from .parsers import AccountParser, LDAPParser, AssetParser, SudoersParser
from .storage import DataStore, QuarantineManager, JournalManager
from .engine import RuleEngine
from .executor import RemediationPlanner, RemediationApplier
from .reporter import ReportGenerator


pass_config = click.make_pass_decorator(ConfigManager, ensure=True)


@click.group()
@click.option(
    "--config", "-c",
    type=click.Path(exists=False),
    default=None,
    help="配置文件路径 (默认: ./jumpguard.yaml)"
)
@click.pass_context
def cli(ctx, config):
    """跳板机权限漂移巡检员 - 堡垒机/AD/服务器资产/sudoers 权限一致性审计工具"""
    if config is None:
        config = os.path.join(os.getcwd(), "jumpguard.yaml")
    
    ctx.obj = ConfigManager(config_path=config)


@cli.command()
@click.option(
    "--force", "-f",
    is_flag=True,
    help="强制覆盖现有配置文件"
)
@pass_config
def init(config: ConfigManager, force: bool):
    """初始化工作区和配置文件"""
    try:
        cfg = config.init_config(force=force)
        config.ensure_workspace()
        click.echo(f"✅ 配置文件已创建: {cfg.config_path}")
        click.echo(f"📁 工作区目录: {cfg.workspace.data_dir}")
        click.echo("\n工作区结构:")
        click.echo(f"  {cfg.workspace.imports_dir}/ - 导入的原始文件存档")
        click.echo(f"  {cfg.workspace.state_dir}/ - 状态和隔离数据")
        click.echo(f"  {cfg.workspace.reports_dir}/ - 审计报告输出")
    except FileExistsError:
        click.echo("❌ 配置文件已存在。使用 --force 参数覆盖。")
        sys.exit(1)


@cli.command("import-account")
@click.argument(
    "file_path",
    type=click.Path(exists=True, readable=True)
)
@pass_config
def import_account(config: ConfigManager, file_path: str):
    """导入堡垒机账号CSV"""
    cfg = config.load_config()
    config.ensure_workspace()

    click.echo(f"📥 导入账号CSV: {file_path}")

    parser = AccountParser(config=cfg.sources.account_csv)
    try:
        records = parser.parse_file(file_path)
    except ValueError as e:
        click.echo(f"❌ 解析失败: {e}")
        sys.exit(1)

    store = DataStore(cfg.workspace.state_dir, cfg.workspace.imports_dir)
    journal = JournalManager(cfg.workspace.state_dir)

    imported = store.import_file(DataStore.SOURCE_TYPE_ACCOUNT, file_path, records)
    
    journal.log_import(
        source_type="account",
        source_file=imported.source_file,
        records_count=imported.records_count,
    )

    click.echo(f"✅ 成功导入 {len(records)} 条账号记录")
    click.echo(f"📦 原始文件已存档: {imported.import_metadata.get('archive_path')}")


@cli.command("import-ldap")
@click.argument(
    "file_path",
    type=click.Path(exists=True, readable=True)
)
@click.option(
    "--format", "-f",
    type=click.Choice(["auto", "csv_group_member", "csv_group_members", "ldif", "text_list"]),
    default="auto",
    help="文件格式 (默认: auto)"
)
@pass_config
def import_ldap(config: ConfigManager, file_path: str, format: str):
    """导入LDAP组成员列表"""
    cfg = config.load_config()
    config.ensure_workspace()

    click.echo(f"📥 导入LDAP组: {file_path} (格式: {format})")

    parser = LDAPParser(config=cfg.sources.ldap_groups)
    try:
        groups = parser.parse_file(file_path, format_type=format)
    except Exception as e:
        click.echo(f"❌ 解析失败: {e}")
        sys.exit(1)

    store = DataStore(cfg.workspace.state_dir, cfg.workspace.imports_dir)
    journal = JournalManager(cfg.workspace.state_dir)

    imported = store.import_file(DataStore.SOURCE_TYPE_LDAP, file_path, groups)
    
    journal.log_import(
        source_type="ldap",
        source_file=imported.source_file,
        records_count=len(groups),
    )

    total_members = sum(len(g.members) for g in groups)
    click.echo(f"✅ 成功导入 {len(groups)} 个组, {total_members} 条成员记录")
    click.echo(f"📦 原始文件已存档: {imported.import_metadata.get('archive_path')}")


@cli.command("import-asset")
@click.argument(
    "file_path",
    type=click.Path(exists=True, readable=True)
)
@pass_config
def import_asset(config: ConfigManager, file_path: str):
    """导入服务器资产清单CSV"""
    cfg = config.load_config()
    config.ensure_workspace()

    click.echo(f"📥 导入资产清单: {file_path}")

    parser = AssetParser(config=cfg.sources.assets)
    try:
        records = parser.parse_file(file_path)
    except ValueError as e:
        click.echo(f"❌ 解析失败: {e}")
        sys.exit(1)

    store = DataStore(cfg.workspace.state_dir, cfg.workspace.imports_dir)
    journal = JournalManager(cfg.workspace.state_dir)

    imported = store.import_file(DataStore.SOURCE_TYPE_ASSET, file_path, records)
    
    journal.log_import(
        source_type="asset",
        source_file=imported.source_file,
        records_count=imported.records_count,
    )

    by_env = {}
    for r in records:
        env = r.environment
        by_env[env] = by_env.get(env, 0) + 1

    click.echo(f"✅ 成功导入 {len(records)} 条资产记录")
    click.echo(f"📊 环境分布: {', '.join([f'{k}:{v}' for k, v in by_env.items()])}")
    click.echo(f"📦 原始文件已存档: {imported.import_metadata.get('archive_path')}")


@cli.command("import-sudoers")
@click.argument(
    "file_path",
    type=click.Path(exists=True, readable=True)
)
@pass_config
def import_sudoers(config: ConfigManager, file_path: str):
    """导入sudoers规则片段"""
    cfg = config.load_config()
    config.ensure_workspace()

    click.echo(f"📥 导入sudoers片段: {file_path}")

    parser = SudoersParser(config=cfg.sources.sudoers)
    try:
        rules = parser.parse_file(file_path)
    except Exception as e:
        click.echo(f"❌ 解析失败: {e}")
        sys.exit(1)

    store = DataStore(cfg.workspace.state_dir, cfg.workspace.imports_dir)
    journal = JournalManager(cfg.workspace.state_dir)

    imported = store.import_file(DataStore.SOURCE_TYPE_SUDOERS, file_path, rules)
    
    journal.log_import(
        source_type="sudoers",
        source_file=imported.source_file,
        records_count=len(rules),
    )

    click.echo(f"✅ 成功导入 {len(rules)} 条sudo规则")
    click.echo(f"📦 原始文件已存档: {imported.import_metadata.get('archive_path')}")


@cli.command()
@click.option(
    "--rules", "-r",
    type=str,
    default=None,
    help="指定检查规则 (逗号分隔, 默认全部)"
)
@pass_config
def check(config: ConfigManager, rules: Optional[str]):
    """执行权限检查,识别问题并存入quarantine.json"""
    cfg = config.load_config()
    config.ensure_workspace()

    store = DataStore(cfg.workspace.state_dir, cfg.workspace.imports_dir)
    
    missing = store.get_missing_sources()
    if missing:
        click.echo(f"❌ 缺少数据源: {', '.join(missing)}")
        click.echo("请先使用 import-* 命令导入所有数据源")
        sys.exit(1)

    click.echo("🔍 开始权限一致性检查...")

    enabled_rules = None
    if rules:
        enabled_rules = [r.strip() for r in rules.split(",")]

    engine = RuleEngine(
        accounts=store.accounts,
        ldap_groups=store.ldap_groups,
        assets=store.assets,
        sudoers_rules=store.sudoers_rules,
        account_parser=AccountParser(config=cfg.sources.account_csv),
        asset_parser=AssetParser(config=cfg.sources.assets),
        sudoers_parser=SudoersParser(config=cfg.sources.sudoers),
        severity_config=cfg.rules.severity,
    )

    results = engine.check_all(enabled_rules=enabled_rules)

    quarantine = QuarantineManager(cfg.workspace.state_dir)
    quarantine.clear()
    
    q_items = engine.to_quarantine_items(results)
    quarantine.add_items(q_items)
    quarantine.save()

    journal = JournalManager(cfg.workspace.state_dir)
    
    by_rule: Dict[str, int] = {}
    for r in results:
        by_rule[r.rule_id] = by_rule.get(r.rule_id, 0) + 1
    
    journal.log_check(
        issues_found=len(results),
        by_rule=by_rule,
    )

    stats = quarantine.get_stats()
    
    click.echo("")
    click.echo("📊 检查结果统计:")
    click.echo(f"   总计发现: {len(results)} 个问题")
    click.echo(f"   严重级别分布:")
    for sev, count in stats["by_severity"].items():
        if count > 0:
            sev_name = {"critical": "严重", "high": "高", "medium": "中", "low": "低"}.get(sev, sev)
            click.echo(f"     - {sev_name}: {count}")
    
    click.echo(f"   问题类型分布:")
    rule_names = {
        "orphan_account": "孤儿账号",
        "group_drift": "组权限漂移",
        "sudo_overreach": "sudo规则越权",
        "asset_env_mismatch": "资产环境不匹配",
        "duplicate_account": "重复账号",
        "bad_row": "坏数据行",
    }
    for rule_id, count in stats["by_rule"].items():
        if count > 0:
            name = rule_names.get(rule_id, rule_id)
            click.echo(f"     - {name}: {count}")

    quarantine_path = os.path.join(cfg.workspace.state_dir, "quarantine.json")
    click.echo(f"\n📁 问题详情已保存: {quarantine_path}")

    if len(results) == 0:
        click.echo("\n🎉 未发现任何问题!")


@cli.command("plan-remediate")
@click.option(
    "--output", "-o",
    type=click.Path(writable=True),
    default=None,
    help="输出计划文件路径 (默认: ./data/state/remediation_plan.json)"
)
@click.option(
    "--severity", "-s",
    type=str,
    default=None,
    help="仅生成指定严重级别问题的计划 (逗号分隔: critical,high,medium,low)"
)
@click.option(
    "--dry-run",
    is_flag=True,
    default=True,
    help="(默认) 仅生成计划,不实际执行"
)
@pass_config
def plan_remediate(config: ConfigManager, output: Optional[str], severity: Optional[str], dry_run: bool):
    """生成dry-run回收计划 (仅预览,不实际执行)"""
    cfg = config.load_config()
    config.ensure_workspace()

    quarantine = QuarantineManager(cfg.workspace.state_dir)
    pending_items = quarantine.get_pending_items()

    if not pending_items:
        click.echo("✅ 没有待处理的问题")
        return

    click.echo(f"📋 生成回收计划 (待处理问题: {len(pending_items)})")

    filter_severity = None
    if severity:
        filter_severity = [s.strip().lower() for s in severity.split(",")]
        click.echo(f"   过滤严重级别: {', '.join(filter_severity)}")

    planner = RemediationPlanner(quarantine)
    plan = planner.generate_plan(filter_severity=filter_severity)

    if output is None:
        output = os.path.join(cfg.workspace.state_dir, f"remediation_{plan.plan_id}.json")

    planner.save_plan(plan, output)

    journal = JournalManager(cfg.workspace.state_dir)
    journal.log_plan(
        plan_items=[i.to_dict() for i in plan.items],
    )

    click.echo("")
    click.echo("📊 计划摘要:")
    click.echo(f"   计划ID: {plan.plan_id}")
    click.echo(f"   操作项数量: {plan.summary['total_items']}")
    click.echo(f"   需要审批: {plan.summary['items_needing_approval']}")
    click.echo(f"   风险分布:")
    for risk, count in plan.summary["by_risk"].items():
        if count > 0:
            risk_name = {"high": "高风险", "medium": "中风险", "low": "低风险"}.get(risk, risk)
            click.echo(f"     - {risk_name}: {count}")

    click.echo("")
    click.echo("📋 计划详情:")
    for item in plan.items:
        sev_name = {"critical": "🔴严重", "high": "🟠高", "medium": "🟡中", "low": "🟢低"}.get(item.severity, item.severity)
        click.echo(f"   [{item.item_id}] {sev_name}: {item.description}")

    click.echo(f"\n💾 计划已保存: {output}")
    click.echo("\n⚠️  这是 DRY-RUN 计划,不会实际执行任何操作")
    click.echo("   如需执行,请运行: jumpguard apply-confirm --plan <plan_file>")


@cli.command("apply-confirm")
@click.option(
    "--plan", "-p",
    type=click.Path(exists=True, readable=True),
    required=True,
    help="要执行的计划文件路径"
)
@click.option(
    "--items", "-i",
    type=str,
    default=None,
    help="仅执行指定操作项 (逗号分隔的item ID, 如: ITEM-0001,ITEM-0002)"
)
@click.option(
    "--operator", "-u",
    type=str,
    default="system",
    help="操作者名称 (用于审计日志)"
)
@click.option(
    "--dry-run",
    is_flag=True,
    default=False,
    help="模拟执行但不实际修改 (会更新内部状态用于测试)"
)
@click.option(
    "--yes", "-y",
    is_flag=True,
    default=False,
    help="跳过确认提示"
)
@pass_config
def apply_confirm(
    config: ConfigManager,
    plan: str,
    items: Optional[str],
    operator: str,
    dry_run: bool,
    yes: bool,
):
    """执行回收计划并写入审计日志 (支持undo)"""
    cfg = config.load_config()
    config.ensure_workspace()

    quarantine = QuarantineManager(cfg.workspace.state_dir)
    journal = JournalManager(cfg.workspace.state_dir)

    planner = RemediationPlanner(quarantine)
    remediation_plan = planner.load_plan(plan)

    item_filter = None
    if items:
        item_filter = [i.strip() for i in items.split(",")]
        click.echo(f"📋 仅执行指定操作项: {', '.join(item_filter)}")

    items_to_apply = remediation_plan.items
    if item_filter:
        items_to_apply = [i for i in items_to_apply if i.item_id in item_filter]

    if not items_to_apply:
        click.echo("❌ 没有要执行的操作项")
        sys.exit(1)

    click.echo(f"📋 准备执行计划 {remediation_plan.plan_id}")
    click.echo(f"   操作项数量: {len(items_to_apply)}")
    click.echo(f"   操作者: {operator}")
    if dry_run:
        click.echo(f"   ⚠️  模式: DRY-RUN (模拟执行)")

    if not yes:
        click.echo("")
        for item in items_to_apply:
            sev_icon = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}.get(item.severity, "")
            click.echo(f"   {sev_icon}[{item.item_id}] {item.description}")

        click.echo("")
        if dry_run:
            confirm = click.confirm("确认模拟执行上述操作?")
        else:
            confirm = click.confirm("⚠️  确认执行上述操作? 此操作会修改系统状态")
        
        if not confirm:
            click.echo("❌ 操作已取消")
            sys.exit(0)

    applier = RemediationApplier(
        journal_manager=journal,
        quarantine_manager=quarantine,
        dry_run=dry_run,
    )

    click.echo("")
    click.echo("🚀 开始执行...")

    results = applier.apply_plan(
        plan=remediation_plan,
        operator=operator,
        item_filter=item_filter,
    )

    success_count = sum(1 for r in results if r.status == "completed")
    failed_count = sum(1 for r in results if r.status == "failed")

    click.echo("")
    click.echo("📊 执行结果:")
    click.echo(f"   成功: {success_count}")
    click.echo(f"   失败: {failed_count}")

    for result in results:
        status_icon = "✅" if result.status == "completed" else "❌"
        click.echo(f"   {status_icon}[{result.plan_item_id}] {result.status}")
        if result.error_message:
            click.echo(f"      错误: {result.error_message}")

    exec_log_path = os.path.join(
        cfg.workspace.state_dir,
        f"execution_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    )
    applier.save_execution_log(exec_log_path)
    click.echo(f"\n💾 执行日志已保存: {exec_log_path}")

    undoable = applier.get_undoable_actions(limit=10)
    if undoable:
        click.echo(f"\n🔄 可撤销的最近操作 (使用 jumpguard undo <entry_id>):")
        for entry in undoable[:5]:
            click.echo(f"   - {entry.entry_id}: {entry.description}")

    if failed_count > 0:
        sys.exit(1)


@cli.command()
@click.argument("entry_id", type=str)
@click.option(
    "--operator", "-u",
    type=str,
    default="system",
    help="操作者名称"
)
@click.option(
    "--dry-run",
    is_flag=True,
    default=False,
    help="模拟撤销"
)
@pass_config
def undo(config: ConfigManager, entry_id: str, operator: str, dry_run: bool):
    """撤销之前执行的操作"""
    cfg = config.load_config()
    config.ensure_workspace()

    quarantine = QuarantineManager(cfg.workspace.state_dir)
    journal = JournalManager(cfg.workspace.state_dir)

    entry = journal.get_entry_by_id(entry_id)
    if not entry:
        click.echo(f"❌ 未找到操作记录: {entry_id}")
        sys.exit(1)

    if not entry.undo_info:
        click.echo(f"❌ 该操作不支持撤销: {entry_id}")
        sys.exit(1)

    click.echo(f"🔄 准备撤销操作:")
    click.echo(f"   记录ID: {entry_id}")
    click.echo(f"   原操作: {entry.description}")
    click.echo(f"   操作者: {operator}")

    confirm = click.confirm("确认撤销此操作?")
    if not confirm:
        click.echo("❌ 操作已取消")
        sys.exit(0)

    applier = RemediationApplier(
        journal_manager=journal,
        quarantine_manager=quarantine,
        dry_run=dry_run,
    )

    success = applier.undo_action(entry_id=entry_id, operator=operator)

    if success:
        click.echo("✅ 撤销操作已执行")
    else:
        click.echo("❌ 撤销操作失败")
        sys.exit(1)


@cli.command()
@click.option(
    "--output-dir", "-o",
    type=click.Path(writable=True),
    default=None,
    help="报告输出目录 (默认: ./data/reports/)"
)
@click.option(
    "--format", "-f",
    type=click.Choice(["all", "markdown", "csv", "json"]),
    default="all",
    help="输出格式 (默认: all)"
)
@click.option(
    "--period-start",
    type=str,
    default=None,
    help="审计周期开始时间 (ISO格式)"
)
@click.option(
    "--period-end",
    type=str,
    default=None,
    help="审计周期结束时间 (ISO格式)"
)
@pass_config
def report(
    config: ConfigManager,
    output_dir: Optional[str],
    format: str,
    period_start: Optional[str],
    period_end: Optional[str],
):
    """导出Markdown、CSV和JSON审计包"""
    cfg = config.load_config()
    config.ensure_workspace()

    if output_dir is None:
        output_dir = cfg.workspace.reports_dir

    os.makedirs(output_dir, exist_ok=True)

    store = DataStore(cfg.workspace.state_dir, cfg.workspace.imports_dir)
    quarantine = QuarantineManager(cfg.workspace.state_dir)
    journal = JournalManager(cfg.workspace.state_dir)

    click.echo("📄 生成审计报告...")

    generator = ReportGenerator(
        data_store=store,
        quarantine_manager=quarantine,
        journal_manager=journal,
    )

    audit_report = generator.generate_report(
        period_start=period_start,
        period_end=period_end,
    )

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    generated_files: List[str] = []

    if format in ["all", "json"]:
        json_path = os.path.join(output_dir, f"audit_report_{timestamp}.json")
        generator.export_json(audit_report, json_path)
        generated_files.append(json_path)

    if format in ["all", "csv"]:
        csv_dir = os.path.join(output_dir, f"csv_report_{timestamp}")
        csv_files = generator.export_csv(audit_report, csv_dir)
        generated_files.extend(csv_files)

    if format in ["all", "markdown"]:
        md_path = os.path.join(output_dir, f"audit_report_{timestamp}.md")
        generator.export_markdown(audit_report, md_path)
        generated_files.append(md_path)

    journal.log_report(
        report_type=format,
        output_path=output_dir,
    )

    click.echo("")
    click.echo("📊 报告摘要:")
    click.echo(f"   报告ID: {audit_report.report_id}")
    click.echo(f"   生成时间: {audit_report.generated_at}")
    click.echo(f"   发现问题总数: {audit_report.summary['total_issues_found']}")
    click.echo(f"   待处理问题: {audit_report.summary['pending_issues']}")
    click.echo(f"   已修复问题: {audit_report.summary['remediated_issues']}")

    click.echo("")
    click.echo("📁 生成的文件:")
    for f in generated_files:
        click.echo(f"   - {f}")


@cli.command("status")
@pass_config
def status(config: ConfigManager):
    """显示当前工作区状态"""
    cfg = config.load_config()

    click.echo("📋 工作区状态:")
    click.echo(f"   配置文件: {cfg.config_path}")
    click.echo(f"   数据目录: {cfg.workspace.data_dir}")
    click.echo("")

    if os.path.exists(cfg.workspace.state_dir):
        store = DataStore(cfg.workspace.state_dir, cfg.workspace.imports_dir)
        quarantine = QuarantineManager(cfg.workspace.state_dir)
        journal = JournalManager(cfg.workspace.state_dir)

        click.echo("📊 数据源状态:")
        click.echo(f"   账号记录: {len(store.accounts)}")
        click.echo(f"   LDAP组: {len(store.ldap_groups)}")
        click.echo(f"   资产记录: {len(store.assets)}")
        click.echo(f"   Sudo规则: {len(store.sudoers_rules)}")
        click.echo("")

        stats = quarantine.get_stats()
        click.echo("🔍 问题状态:")
        click.echo(f"   总计问题: {stats['by_severity'].get('critical', 0) + stats['by_severity'].get('high', 0) + stats['by_severity'].get('medium', 0) + stats['by_severity'].get('low', 0)}")
        click.echo(f"   待处理: {stats['pending']}")
        click.echo(f"   已修复: {stats['remediated']}")
        click.echo("")

        click.echo("📝 操作日志:")
        recent = journal.get_recent_entries(limit=5)
        if recent:
            for entry in recent:
                click.echo(f"   - {entry.timestamp}: {entry.description}")
        else:
            click.echo("   (暂无记录)")
    else:
        click.echo("ℹ️  工作区尚未初始化,请先运行 'jumpguard init'")


if __name__ == "__main__":
    cli()
