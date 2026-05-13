from __future__ import annotations
import json
import sys
from pathlib import Path
from typing import Optional

import click

from .manager import RuleManager
from .storage import FileStorage


def get_manager(data_dir: Optional[str] = None) -> RuleManager:
    base_dir = Path(data_dir) if data_dir else None
    storage = FileStorage(base_dir=base_dir)
    return RuleManager(storage=storage)


@click.group()
@click.option("--data-dir", type=click.Path(), help="数据目录路径")
@click.option("--actor", help="操作人标识")
@click.pass_context
def cli(ctx: click.Context, data_dir: Optional[str], actor: Optional[str]) -> None:
    ctx.ensure_object(dict)
    ctx.obj["data_dir"] = data_dir
    ctx.obj["actor"] = actor


@cli.command("import-rules")
@click.argument("file_path", type=click.Path(exists=True, dir_okay=False))
@click.option("--no-validate", is_flag=True, help="跳过自动验证")
@click.option("--non-strict", is_flag=True, help="宽松模式")
@click.pass_context
def import_rules(ctx: click.Context, file_path: str, no_validate: bool, non_strict: bool) -> None:
    mgr = get_manager(ctx.obj.get("data_dir"))
    try:
        success, skipped, messages, dirty_ids = mgr.import_rules(
            Path(file_path),
            actor=ctx.obj.get("actor"),
            auto_validate=not no_validate,
            strict=not non_strict,
        )
        for msg in messages:
            click.echo(msg)
        click.echo(f"完成: 成功 {success} 条, 跳过 {skipped} 条")
        sys.exit(0 if success > 0 and skipped == 0 else 1)
    except Exception as e:
        click.echo(f"导入失败: {e}", err=True)
        sys.exit(1)


@cli.command("import-samples")
@click.argument("file_path", type=click.Path(exists=True, dir_okay=False))
@click.pass_context
def import_samples(ctx: click.Context, file_path: str) -> None:
    mgr = get_manager(ctx.obj.get("data_dir"))
    try:
        count, messages = mgr.import_samples(Path(file_path), actor=ctx.obj.get("actor"))
        for msg in messages:
            click.echo(msg)
        click.echo(f"完成: 导入 {count} 条样例")
        sys.exit(0)
    except Exception as e:
        click.echo(f"导入失败: {e}", err=True)
        sys.exit(1)


@cli.command("list-rules")
@click.option("--all", "-a", is_flag=True, help="包含已停用/回滚的规则")
@click.option("--json", "output_json", is_flag=True, help="JSON 输出")
@click.pass_context
def list_rules(ctx: click.Context, all: bool, output_json: bool) -> None:
    mgr = get_manager(ctx.obj.get("data_dir"))
    rules = mgr.list_rules(include_inactive=all)
    if output_json:
        data = [r.model_dump(mode="json") for r in rules]
        click.echo(json.dumps(data, ensure_ascii=False, indent=2))
    else:
        for r in rules:
            click.echo(f"[{r.status.value}] {r.id} - {r.name} (v{r.version})")
        click.echo(f"共 {len(rules)} 条规则")


@cli.command("get-rule")
@click.argument("rule_id")
@click.option("--json", "output_json", is_flag=True, help="JSON 输出")
@click.pass_context
def get_rule(ctx: click.Context, rule_id: str, output_json: bool) -> None:
    mgr = get_manager(ctx.obj.get("data_dir"))
    rule = mgr.get_rule(rule_id)
    if not rule:
        click.echo(f"规则不存在: {rule_id}", err=True)
        sys.exit(1)
    if output_json:
        click.echo(json.dumps(rule.model_dump(mode="json"), ensure_ascii=False, indent=2))
    else:
        click.echo(f"ID: {rule.id}")
        click.echo(f"名称: {rule.name}")
        click.echo(f"类型: {rule.type.value}")
        click.echo(f"状态: {rule.status.value}")
        click.echo(f"版本: v{rule.version}")
        click.echo(f"优先级: {rule.priority}")
        if rule.skus:
            click.echo(f"SKU: {', '.join(rule.skus[:20])}{'...' if len(rule.skus) > 20 else ''}")
        if rule.discount_percent is not None:
            click.echo(f"折扣: {rule.discount_percent}%")
        if rule.discount_value is not None:
            click.echo(f"直减: {rule.discount_value}")


@cli.command("list-samples")
@click.option("--json", "output_json", is_flag=True, help="JSON 输出")
@click.pass_context
def list_samples(ctx: click.Context, output_json: bool) -> None:
    mgr = get_manager(ctx.obj.get("data_dir"))
    samples = mgr.list_samples()
    if output_json:
        data = [s.model_dump(mode="json") for s in samples]
        click.echo(json.dumps(data, ensure_ascii=False, indent=2))
    else:
        for s in samples:
            click.echo(f"{s.id} - {s.name} (预期: {s.expected_total_final})")
        click.echo(f"共 {len(samples)} 条样例")


@cli.command("import-sku-catalog")
@click.argument("file_path", type=click.Path(exists=True, dir_okay=False))
@click.pass_context
def import_sku_catalog(ctx: click.Context, file_path: str) -> None:
    mgr = get_manager(ctx.obj.get("data_dir"))
    try:
        count = mgr.import_sku_catalog(Path(file_path))
        click.echo(f"完成: 导入 {count} 个 SKU 信息")
        sys.exit(0)
    except Exception as e:
        click.echo(f"导入失败: {e}", err=True)
        sys.exit(1)


@cli.command("list-sku-catalog")
@click.option("--json", "output_json", is_flag=True, help="JSON 输出")
@click.pass_context
def list_sku_catalog(ctx: click.Context, output_json: bool) -> None:
    mgr = get_manager(ctx.obj.get("data_dir"))
    catalog = mgr.list_sku_catalog()
    if output_json or not catalog:
        click.echo(json.dumps(catalog, ensure_ascii=False, indent=2))
    else:
        for sku, info in catalog.items():
            category = info.get("category", "N/A")
            brand = info.get("brand", "N/A")
            name = info.get("name", "")
            click.echo(f"{sku}: {name} | 品类={category} | 品牌={brand}")
        click.echo(f"共 {len(catalog)} 个 SKU")


@cli.command("detect-conflicts")
@click.option("--json", "output_json", is_flag=True, help="JSON 输出")
@click.pass_context
def detect_conflicts(ctx: click.Context, output_json: bool) -> None:
    mgr = get_manager(ctx.obj.get("data_dir"))
    conflicts = mgr.detect_conflicts()
    if output_json:
        data = [c.model_dump(mode="json") for c in conflicts]
        click.echo(json.dumps(data, ensure_ascii=False, indent=2))
    else:
        if not conflicts:
            click.echo("未检测到冲突")
            return
        for c in conflicts:
            click.echo(f"[{c.severity.value.upper()}] {c.id}:")
            click.echo(f"  规则: {', '.join(c.rule_ids)}")
            click.echo(f"  描述: {c.description}")
            if c.affected_skus:
                click.echo(f"  影响 SKU: {', '.join(c.affected_skus)[:100]}")
            if c.suggestion:
                click.echo(f"  建议: {c.suggestion}")
    sys.exit(0 if not conflicts else 2)


@cli.command("validate")
@click.option("--allow-critical", is_flag=True, help="严重冲突仅警告")
@click.option("--allow-sample-fail", is_flag=True, help="样例失败仅警告")
@click.option("--report-format", type=click.Choice(["json", "markdown", "md"]), default="markdown")
@click.option("--save-report", type=click.Path(), help="保存报告到文件")
@click.pass_context
def validate(ctx: click.Context, allow_critical: bool, allow_sample_fail: bool, report_format: str, save_report: Optional[str]) -> None:
    mgr = get_manager(ctx.obj.get("data_dir"))
    vr = mgr.validate_pending(
        fail_on_critical=not allow_critical,
        fail_on_sample=not allow_sample_fail,
    )
    fmt = "markdown" if report_format in ("markdown", "md") else "json"
    report = mgr.export_report(vr, format=fmt)
    click.echo(report)
    if save_report:
        if fmt == "markdown":
            mgr.storage.save_report(Path(save_report).name, report)
        else:
            mgr.storage.save_report(Path(save_report).name, report)
        click.echo(f"报告已保存: {save_report}")
    sys.exit(0 if vr.success else 1)


@cli.command("approve")
@click.argument("rule_ids", nargs=-1, required=True)
@click.pass_context
def approve(ctx: click.Context, rule_ids: tuple) -> None:
    mgr = get_manager(ctx.obj.get("data_dir"))
    approved, messages = mgr.approve_rules(list(rule_ids), actor=ctx.obj.get("actor"))
    for msg in messages:
        click.echo(msg)
    all_ok = len(approved) == len(rule_ids)
    sys.exit(0 if all_ok else 1)


@cli.command("publish")
@click.argument("rule_ids", nargs=-1, required=True)
@click.option("--force", is_flag=True, help="跳过验证直接发布")
@click.pass_context
def publish(ctx: click.Context, rule_ids: tuple, force: bool) -> None:
    mgr = get_manager(ctx.obj.get("data_dir"))
    if not force:
        vr = mgr.validate_pending()
        if not vr.success:
            click.echo("验证未通过，发布被拦截", err=True)
            for err in vr.errors:
                click.echo(f"  - {err}", err=True)
            click.echo("使用 --force 可强制发布", err=True)
            sys.exit(1)
    published, messages = mgr.publish_rules(list(rule_ids), actor=ctx.obj.get("actor"))
    for msg in messages:
        click.echo(msg)
    all_ok = len(published) == len(rule_ids)
    sys.exit(0 if all_ok else 1)


@cli.command("rollback")
@click.argument("rule_id")
@click.option("--to-version", type=int, help="目标版本号")
@click.pass_context
def rollback(ctx: click.Context, rule_id: str, to_version: Optional[int]) -> None:
    mgr = get_manager(ctx.obj.get("data_dir"))
    success, message = mgr.rollback_rule(rule_id, target_version=to_version, actor=ctx.obj.get("actor"))
    click.echo(message)
    sys.exit(0 if success else 1)


@cli.command("list-versions")
@click.argument("rule_id")
@click.pass_context
def list_versions(ctx: click.Context, rule_id: str) -> None:
    mgr = get_manager(ctx.obj.get("data_dir"))
    versions = mgr.list_versions(rule_id)
    if not versions:
        click.echo(f"规则 {rule_id} 没有历史版本")
        return
    click.echo(f"规则 {rule_id} 的历史版本:")
    for v in versions:
        click.echo(f"  - v{v}")


@cli.command("playback")
@click.argument("sample_ids", nargs=-1)
@click.option("--json", "output_json", is_flag=True, help="JSON 输出")
@click.pass_context
def playback(ctx: click.Context, sample_ids: tuple, output_json: bool) -> None:
    mgr = get_manager(ctx.obj.get("data_dir"))
    ids = list(sample_ids) if sample_ids else None
    passed, failed, results = mgr.playback_samples(sample_ids=ids)
    if output_json:
        click.echo(json.dumps({"passed": passed, "failed": failed, "results": results}, ensure_ascii=False, indent=2))
    else:
        click.echo(f"回放结果: {passed} 通过, {failed} 失败")
        for r in results:
            icon = "✅" if r["passed"] else "❌"
            click.echo(f"{icon} {r['sample_id']}: 预期 {r['expected']:.2f} / 实际 {r['actual']:.2f}")
            if r.get("message"):
                click.echo(f"   {r['message']}")
    sys.exit(0 if failed == 0 else 1)


@cli.command("accept")
@click.argument("rule_ids", nargs=-1, required=True)
@click.pass_context
def accept(ctx: click.Context, rule_ids: tuple) -> None:
    mgr = get_manager(ctx.obj.get("data_dir"))
    all_ok = True
    for rid in rule_ids:
        rule = mgr.get_rule(rid)
        if not rule:
            click.echo(f"规则不存在: {rid}", err=True)
            all_ok = False
            continue
        click.echo(f"验收规则: {rule.name}")
    vr = mgr.validate_pending()
    passed, failed, results = mgr.playback_samples()
    click.echo(f"冲突检测: {len(vr.conflicts)} 个冲突")
    click.echo(f"样例回放: {passed}/{passed + failed} 通过")
    if not vr.success or failed > 0:
        click.echo("验收未通过", err=True)
        all_ok = False
    else:
        click.echo("验收通过")
    sys.exit(0 if all_ok else 1)


@cli.command("list-dirty")
@click.option("--json", "output_json", is_flag=True, help="JSON 输出")
@click.pass_context
def list_dirty(ctx: click.Context, output_json: bool) -> None:
    mgr = get_manager(ctx.obj.get("data_dir"))
    dirty = mgr.list_dirty()
    if output_json:
        data = [d.model_dump(mode="json") for d in dirty]
        click.echo(json.dumps(data, ensure_ascii=False, indent=2))
    else:
        if not dirty:
            click.echo("没有脏数据")
            return
        for d in dirty:
            click.echo(f"{d.id}: retries={d.retries}, 来源={d.source}")
            click.echo(f"  错误: {d.error}")


@cli.command("retry-dirty")
@click.argument("dirty_ids", nargs=-1)
@click.pass_context
def retry_dirty(ctx: click.Context, dirty_ids: tuple) -> None:
    mgr = get_manager(ctx.obj.get("data_dir"))
    ids = list(dirty_ids) if dirty_ids else None
    success, remain, messages = mgr.retry_dirty(dirty_ids=ids, actor=ctx.obj.get("actor"))
    for msg in messages:
        click.echo(msg)
    click.echo(f"重试完成: 成功 {success}, 剩余 {remain}")
    sys.exit(0 if remain == 0 else 1)


@cli.command("history")
@click.option("--limit", type=int, default=50, help="显示数量")
@click.option("--json", "output_json", is_flag=True, help="JSON 输出")
@click.pass_context
def history(ctx: click.Context, limit: int, output_json: bool) -> None:
    mgr = get_manager(ctx.obj.get("data_dir"))
    records = mgr.list_history(limit=limit)
    if output_json:
        data = [r.model_dump(mode="json") for r in records]
        click.echo(json.dumps(data, ensure_ascii=False, indent=2))
    else:
        for r in records:
            click.echo(f"[{r.timestamp.isoformat()}] {r.type}: {r.details}")


@cli.command("backup")
@click.argument("name", required=False)
@click.pass_context
def backup(ctx: click.Context, name: Optional[str]) -> None:
    mgr = get_manager(ctx.obj.get("data_dir"))
    path = mgr.backup(name)
    click.echo(f"备份已创建: {path}")


@cli.command("restore")
@click.argument("backup_path", type=click.Path(exists=True, file_okay=False))
@click.option("--yes", is_flag=True, help="跳过确认")
@click.pass_context
def restore(ctx: click.Context, backup_path: str, yes: bool) -> None:
    mgr = get_manager(ctx.obj.get("data_dir"))
    if not yes:
        confirm = click.confirm("恢复将覆盖当前数据，确定继续吗？")
        if not confirm:
            click.echo("已取消")
            return
    mgr.restore(Path(backup_path))
    click.echo(f"已从 {backup_path} 恢复")


@cli.command("reset")
@click.option("--yes", is_flag=True, help="跳过确认")
@click.pass_context
def reset(ctx: click.Context, yes: bool) -> None:
    if not yes:
        confirm = click.confirm("这将删除所有数据，确定继续吗？")
        if not confirm:
            click.echo("已取消")
            return
    mgr = get_manager(ctx.obj.get("data_dir"))
    mgr.reset()
    click.echo("已重置")


def main() -> None:
    cli(obj={})


if __name__ == "__main__":
    main()
