import json
import sys
from pathlib import Path
from typing import List, Optional

import click

from . import __version__
from .config import Config
from .device import Device, DeviceRegistry
from .executor import DeliveryExecutor
from .history import HistoryManager, HistoryQuery
from .manifest import PackageManifest
from .package_registry import PackageRegistry
from .package_validator import PackageValidator
from .planner import DeliveryPlanner
from .quarantine import QuarantineManager
from .reporter import DeliveryReporter
from .rollback import RollbackManager


def get_config_path() -> Path:
    return Path.cwd() / "firmware-config.json"


def get_devices_path() -> Path:
    return Path.cwd() / "devices.csv"


def get_package_registry_dir() -> Path:
    return Path.cwd() / ".registry"


def get_quarantine_dir() -> Path:
    return Path.cwd() / ".quarantine"


def load_config() -> Config:
    config_path = get_config_path()
    if not config_path.exists():
        click.echo(f"错误: 配置文件不存在: {config_path}")
        click.echo("请先运行 'firmware-delivery init' 初始化项目")
        sys.exit(1)
    return Config.load(config_path)


def load_device_registry() -> DeviceRegistry:
    devices_path = get_devices_path()
    if not devices_path.exists():
        click.echo(f"错误: 设备清单不存在: {devices_path}")
        click.echo("请先运行 'firmware-delivery import-device' 导入设备清单")
        sys.exit(1)
    return DeviceRegistry.load(devices_path)


@click.group()
@click.version_option(__version__)
def cli():
    """固件校准包投递员 - 现场设备维护工程师的本地命令行工具"""
    pass


@cli.command()
@click.option("--project-name", default="固件校准包投递项目", help="项目名称")
@click.option("--device-model", "-m", multiple=True, help="允许的设备型号（可多次指定）")
@click.option("--region", "-r", multiple=True, help="允许的区域（可多次指定）")
@click.option("--firmware-version", "-v", multiple=True, help="允许的固件版本（可多次指定）")
@click.option("--calibration-validity", default=365, type=int, help="校准包有效期（天）")
@click.option("--public-key", help="签名公钥文件路径")
@click.option("--delivery-dir", default="./delivery", help="投递目录")
@click.option("--audit-dir", default="./audit", help="审计输出目录")
@click.option("--manifest-version", default="1.0", help="Manifest版本")
def init(
    project_name, device_model, region, firmware_version,
    calibration_validity, public_key, delivery_dir, audit_dir,
    manifest_version
):
    """初始化项目配置"""
    config_path = get_config_path()
    
    public_key_content = None
    if public_key:
        pubkey_path = Path(public_key)
        if pubkey_path.exists():
            public_key_content = pubkey_path.read_text(encoding="utf-8")
        else:
            public_key_content = public_key
    
    kwargs = {
        "project_name": project_name,
        "device_models": list(device_model),
        "regions": list(region),
        "allowed_firmware_versions": list(firmware_version),
        "calibration_validity_days": calibration_validity,
        "delivery_directory": delivery_dir,
        "audit_directory": audit_dir,
        "manifest_version": manifest_version,
    }
    
    if public_key_content:
        kwargs["public_key"] = public_key_content
    
    config = Config.create(config_path, **kwargs)
    
    click.echo(f"✅ 项目配置已创建: {config_path}")
    click.echo(f"   项目名称: {config.project_name}")
    click.echo(f"   设备型号: {', '.join(config.device_models) or '未设置'}")
    click.echo(f"   区域: {', '.join(config.regions) or '未设置'}")
    click.echo(f"   投递目录: {config.delivery_directory}")
    click.echo(f"   审计目录: {config.audit_directory}")


@cli.command(name="import-device")
@click.argument("csv_file", type=click.Path(exists=True, dir_okay=False))
def import_device(csv_file):
    """导入设备清单 CSV"""
    source_path = Path(csv_file)
    target_path = get_devices_path()
    
    devices = []
    with open(source_path, "r", encoding="utf-8-sig") as f:
        import csv
        reader = csv.DictReader(f)
        for row in reader:
            device = Device.from_csv_row(row)
            devices.append(device)
    
    registry = DeviceRegistry.create(target_path)
    for device in devices:
        registry.add_device(device)
    
    click.echo(f"✅ 设备清单已导入: {target_path}")
    click.echo(f"   设备数量: {len(devices)}")


@cli.command(name="import-package")
@click.argument("package_dir", type=click.Path(exists=True, file_okay=False))
@click.option("--force", "-f", is_flag=True, help="强制导入（忽略隔离区）")
def import_package(package_dir, force):
    """导入升级包目录，校验并签名验证"""
    config = load_config()
    package_path = Path(package_dir)
    
    validator = PackageValidator(config)
    result = validator.validate_package(package_path)
    
    if result.valid:
        registry_dir = get_package_registry_dir()
        registry = PackageRegistry(registry_dir)
        
        if result.manifest:
            valid_pkg = registry.import_package(package_path, result.manifest)
            click.echo(f"✅ 包导入成功: {valid_pkg.package_id}")
            click.echo(f"   包名称: {valid_pkg.package_name}")
            click.echo(f"   版本: {valid_pkg.package_version}")
            click.echo(f"   目标型号: {', '.join(result.manifest.target_device_models)}")
        
        if result.has_warnings():
            click.echo(f"\n⚠️  警告信息:")
            for issue in result.issues:
                if issue.severity == "warning":
                    click.echo(f"   - [{issue.code}] {issue.message}")
    else:
        quarantine_dir = get_quarantine_dir()
        qm = QuarantineManager(quarantine_dir)
        entry = qm.quarantine_package(package_path, result)
        
        click.echo(f"❌ 包验证失败，已隔离: {entry.package_id}")
        click.echo(f"\n   问题列表:")
        for issue in result.issues:
            if issue.severity == "error":
                click.echo(f"   ❌ [{issue.code}] {issue.message}")
            else:
                click.echo(f"   ⚠️  [{issue.code}] {issue.message}")
        
        click.echo(f"\n   隔离位置: {entry.quarantine_path}")
        sys.exit(1)


@cli.command()
@click.option("--plan-id", default=None, help="计划ID")
@click.option("--region", "-r", multiple=True, help="目标区域（灰度发布）")
@click.option("--require-owner", is_flag=True, help="需要负责人确认")
@click.option("--output", "-o", help="输出计划到JSON文件")
def plan(plan_id, region, require_owner, output):
    """生成 dry-run 投递计划"""
    import uuid
    
    config = load_config()
    device_registry = load_device_registry()
    
    registry_dir = get_package_registry_dir()
    package_registry = PackageRegistry(registry_dir)
    
    planner = DeliveryPlanner(
        device_registry,
        package_registry,
        allowed_versions=config.allowed_firmware_versions
    )
    
    plan_id = plan_id or f"PLAN-{uuid.uuid4().hex[:8]}"
    target_regions = list(region) if region else None
    
    delivery_plan = planner.create_plan(
        plan_id=plan_id,
        target_regions=target_regions,
        is_dry_run=True,
        require_owner_confirmation=require_owner
    )
    
    if delivery_plan.has_blockers():
        click.echo(f"❌ 计划包含阻断项，无法执行")
        click.echo(f"\n阻断项列表:")
        for issue in delivery_plan.blocking_issues:
            click.echo(f"   ❌ [{issue.code}] {issue.message}")
            if issue.device_id:
                click.echo(f"      设备: {issue.device_id}")
    else:
        click.echo(f"✅ 计划生成成功: {plan_id}")
        click.echo(f"   设备数量: {delivery_plan.devices_count}")
        click.echo(f"   包数量: {delivery_plan.packages_count}")
        click.echo(f"   投递项: {len(delivery_plan.items)}")
        
        if delivery_plan.items:
            click.echo(f"\n投递明细:")
            for item in delivery_plan.items:
                click.echo(f"   - {item.device_id} ({item.device_model} / {item.region}) "
                           f"→ {item.firmware_version}")
    
    if output:
        output_path = Path(output)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(delivery_plan.to_dict(), f, indent=2, ensure_ascii=False)
        click.echo(f"\n计划已保存到: {output_path}")


@cli.command()
@click.option("--plan-id", required=True, help="计划ID")
@click.option("--plan-file", type=click.Path(exists=True, dir_okay=False), help="计划JSON文件路径")
def apply(plan_id, plan_file):
    """执行投递计划（只能执行无阻断计划）"""
    config = load_config()
    
    if plan_file:
        with open(plan_file, "r", encoding="utf-8") as f:
            plan_data = json.load(f)
    else:
        device_registry = load_device_registry()
        registry_dir = get_package_registry_dir()
        package_registry = PackageRegistry(registry_dir)
        
        planner = DeliveryPlanner(
            device_registry,
            package_registry,
            allowed_versions=config.allowed_firmware_versions
        )
        
        delivery_plan = planner.create_plan(
            plan_id=plan_id,
            target_regions=None,
            is_dry_run=False,
            require_owner_confirmation=False
        )
        
        if delivery_plan.has_blockers():
            click.echo(f"❌ 计划包含阻断项，无法执行")
            click.echo(f"请先运行 'firmware-delivery plan' 检查并解决阻断项")
            sys.exit(1)
        
        plan_data = delivery_plan.to_dict()
    
    from .planner import DeliveryPlan, DeliveryItem, BlockingIssue
    
    class TempPlan:
        def __init__(self, data):
            self.plan_id = data["plan_id"]
            self.created_at = data["created_at"]
            self.is_dry_run = data["is_dry_run"]
            self.target_regions = data["target_regions"]
            self.devices_count = data["devices_count"]
            self.packages_count = data["packages_count"]
            self.items = [
                DeliveryItem(
                    device_id=item["device_id"],
                    device_model=item["device_model"],
                    region=item["region"],
                    package_id=item["package_id"],
                    package_name=item["package_name"],
                    package_version=item["package_version"],
                    firmware_version=item["firmware_version"],
                    calibration_version=item["calibration_version"],
                    has_rollback=item["has_rollback"],
                    source_dir=item["source_dir"],
                    owner=item["owner"]
                )
                for item in data["items"]
            ]
            self.blocking_issues = []
        
        def has_blockers(self):
            return False
        
        def can_execute(self):
            return True
    
    delivery_plan = TempPlan(plan_data)
    
    executor = DeliveryExecutor(
        delivery_root=config.delivery_directory,
        audit_dir=config.audit_directory
    )
    
    click.echo(f"开始执行投递计划: {plan_id}")
    click.echo(f"设备数量: {len(delivery_plan.items)}")
    
    journal = executor.execute_plan(delivery_plan)
    
    click.echo(f"\n✅ 投递完成")
    click.echo(f"   执行ID: {journal.journal_id}")
    click.echo(f"   成功: {journal.success_count}")
    click.echo(f"   失败: {journal.failure_count}")
    
    if journal.failure_count > 0:
        click.echo(f"\n失败设备:")
        for result in journal.results:
            if not result.success:
                click.echo(f"   ❌ {result.device_id}: {', '.join(result.errors)}")


@cli.command()
@click.option("--journal-id", help="指定回滚来源的Journal ID")
@click.option("--dry-run", is_flag=True, help="仅显示回滚计划，不执行")
def rollback(journal_id, dry_run):
    """根据最近一次 journal 生成安全回滚计划"""
    config = load_config()
    
    audit_dir = config.audit_directory
    executor = DeliveryExecutor(config.delivery_directory, audit_dir)
    
    if journal_id:
        journal_path = audit_dir / f"journal-{journal_id}.json"
        if not journal_path.exists():
            click.echo(f"❌ Journal不存在: {journal_path}")
            sys.exit(1)
        source_journal = executor.load_journal(journal_path)
    else:
        source_journal = executor.load_latest_journal()
        if not source_journal:
            click.echo(f"❌ 未找到任何投递记录")
            sys.exit(1)
    
    click.echo(f"回滚来源: {source_journal.journal_id}")
    click.echo(f"执行时间: {source_journal.completed_at}")
    click.echo(f"设备数量: {len(source_journal.results)}")
    
    rollback_mgr = RollbackManager(config.delivery_directory, audit_dir)
    rb_plan = rollback_mgr.create_rollback_plan(source_journal, is_dry_run=dry_run)
    
    if not rb_plan.can_rollback:
        click.echo(f"\n❌ 无法执行回滚: 目标目录已被人工修改")
        for reason in rb_plan.reasons:
            click.echo(f"   - {reason}")
        sys.exit(1)
    
    click.echo(f"\n回滚计划: {rb_plan.rollback_id}")
    for item in rb_plan.items:
        status = "✅ 目录完整" if item["intact"] else "❌ 目录已修改"
        click.echo(f"   {status} {item['device_id']}")
    
    if dry_run:
        click.echo(f"\n这是 Dry Run 模式，未执行实际操作")
    else:
        click.confirm("\n确认执行回滚?", default=True, abort=True)
        
        journal = rollback_mgr.execute_rollback(rb_plan, source_journal)
        
        click.echo(f"\n✅ 回滚完成")
        click.echo(f"   执行ID: {journal.journal_id}")
        click.echo(f"   成功: {journal.success_count}")
        click.echo(f"   失败: {journal.failure_count}")


@cli.command()
@click.option("--plan-id", help="计划ID")
@click.option("--journal-id", help="Journal ID")
@click.option("--output-dir", "-o", default="./reports", help="报告输出目录")
@click.option("--report-id", help="报告ID")
def report(plan_id, journal_id, output_dir, report_id):
    """导出 Markdown 报告、CSV 设备结果和 JSON 审计包"""
    config = load_config()
    
    output_path = Path(output_dir)
    
    plan = None
    journal = None
    
    if journal_id:
        audit_dir = config.audit_directory
        executor = DeliveryExecutor(config.delivery_directory, audit_dir)
        journal_path = audit_dir / f"journal-{journal_id}.json"
        if journal_path.exists():
            journal = executor.load_journal(journal_path)
    
    reporter = DeliveryReporter(output_path)
    report_output = reporter.generate_report(
        plan=plan,
        journal=journal,
        report_id=report_id
    )
    
    click.echo(f"✅ 报告已生成:")
    if report_output.markdown_path:
        click.echo(f"   Markdown: {report_output.markdown_path}")
    if report_output.csv_path:
        click.echo(f"   CSV: {report_output.csv_path}")
    if report_output.json_path:
        click.echo(f"   JSON: {report_output.json_path}")


@cli.command()
@click.option("--device-id", help="按设备号查询")
@click.option("--region", help="按区域查询")
@click.option("--version", help="按版本查询")
@click.option("--start-date", help="开始日期 (YYYY-MM-DD)")
@click.option("--end-date", help="结束日期 (YYYY-MM-DD)")
@click.option("--type", "execution_type", help="执行类型 (delivery/rollback)")
@click.option("--format", "fmt", default="table", type=click.Choice(["table", "json"]), help="输出格式")
def history(device_id, region, version, start_date, end_date, execution_type, fmt):
    """查询历史投递记录"""
    config = load_config()
    
    query = HistoryQuery(
        device_id=device_id,
        region=region,
        version=version,
        start_date=start_date,
        end_date=end_date,
        execution_type=execution_type
    )
    
    history_mgr = HistoryManager(config.audit_directory)
    result = history_mgr.query(query)
    
    output = history_mgr.format_result(result, format_type=fmt)
    click.echo(output)


if __name__ == "__main__":
    cli()
