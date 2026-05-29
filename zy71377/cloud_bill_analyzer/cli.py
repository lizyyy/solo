import os
import sys
import logging
from typing import List, Optional, Tuple

import click
from rich.logging import RichHandler

from .__init__ import __version__
from .core.models import CloudProvider
from .core.config import load_config, Config
from .processors import run_full_pipeline
from .reporters import (
    print_terminal_summary,
    export_machine_readable,
    export_human_report,
)
from .utils.security import mask_sensitive_data, MaskingContext


def _parse_provider_list(providers_str: List[str]) -> List[Optional[CloudProvider]]:
    result: List[Optional[CloudProvider]] = []
    for p in providers_str:
        if not p or p.lower() == "auto":
            result.append(None)
        else:
            try:
                result.append(CloudProvider(p.lower()))
            except ValueError:
                raise click.BadParameter(
                    f"Invalid provider: {p}. Must be one of: aws, aliyun, volcengine, auto"
                )
    return result


@click.group()
@click.version_option(__version__, prog_name="cloudbill")
@click.option("--config", "-c", type=click.Path(exists=False), help="配置文件路径")
@click.option("--verbose", "-v", is_flag=True, help="详细输出模式")
@click.option("--no-mask", is_flag=True, help="禁用敏感字段脱敏（谨慎使用）")
@click.pass_context
def cli(ctx: click.Context, config: Optional[str], verbose: bool, no_mask: bool) -> None:
    """多云账单异常检测CLI工具"""
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(message)s",
        datefmt="[%X]",
        handlers=[RichHandler(rich_tracebacks=True)],
    )

    cfg = load_config(config)
    if no_mask:
        cfg.enable_display_masking = False
        cfg.enable_export_masking = False
        cfg.enable_log_masking = False

    ctx.ensure_object(dict)
    ctx.obj["config"] = cfg
    ctx.obj["verbose"] = verbose


@cli.command("analyze")
@click.argument("bill_files", nargs=-1, type=click.Path(exists=True), required=True)
@click.option("--provider", "-p", "providers", multiple=True,
              help="指定云厂商 (aws/aliyun/volcengine/auto)，按账单文件顺序对应")
@click.option("--reference", "-r", "reference_files", multiple=True,
              type=click.Path(exists=True), help="参考期账单文件（用于同比环比）")
@click.option("--budget", "-b", type=click.Path(exists=True), help="预算文件路径")
@click.option("--output-json", type=click.Path(), help="机器可读JSON输出路径")
@click.option("--output-html", type=click.Path(), help="人类可读HTML报告路径")
@click.option("--output-dir", type=click.Path(), help="所有报告输出目录")
@click.option("--include-bills", is_flag=True, help="JSON输出中包含明细账单数据")
@click.option("--threshold", type=float, help="异常检测阈值百分比（覆盖配置文件）")
@click.option("--target-currency", type=str, help="目标货币（覆盖配置文件）")
@click.option("--no-terminal", is_flag=True, help="禁用终端摘要输出")
@click.pass_context
def analyze(
    ctx: click.Context,
    bill_files: Tuple[str, ...],
    providers: Tuple[str, ...],
    reference_files: Tuple[str, ...],
    budget: Optional[str],
    output_json: Optional[str],
    output_html: Optional[str],
    output_dir: Optional[str],
    include_bills: bool,
    threshold: Optional[float],
    target_currency: Optional[str],
    no_terminal: bool,
) -> None:
    """分析多云账单，检测异常"""
    config: Config = ctx.obj["config"]
    verbose: bool = ctx.obj["verbose"]

    if threshold is not None:
        config.anomaly_threshold_percent = threshold
    if target_currency is not None:
        config.target_currency = target_currency

    provider_hints = _parse_provider_list(list(providers)) if providers else None

    if provider_hints and len(provider_hints) != len(bill_files):
        raise click.BadParameter(
            f"Provider count ({len(provider_hints)}) does not match bill file count ({len(bill_files)})"
        )

    try:
        result = run_full_pipeline(
            bill_files=list(bill_files),
            config=config,
            provider_hints=provider_hints,
            reference_bill_files=list(reference_files) if reference_files else None,
            budget_file=budget,
        )
    except Exception as e:
        masked_error = mask_sensitive_data(str(e), config, MaskingContext.DISPLAY)
        click.echo(f"❌ 分析失败: {masked_error}", err=True)
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)

    if not no_terminal:
        print_terminal_summary(result, config, verbose=verbose)

    generated_files: List[str] = []

    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        if not output_json:
            output_json = os.path.join(output_dir, "anomalies.json")
        if not output_html:
            output_html = os.path.join(output_dir, "report.html")

    if output_json:
        try:
            export_machine_readable(result, config, output_json, include_bills=include_bills)
            generated_files.append(output_json)
            click.echo(f"✅ 机器可读报告已导出: {output_json}")
        except Exception as e:
            masked_error = mask_sensitive_data(str(e), config, MaskingContext.DISPLAY)
            click.echo(f"⚠️  JSON导出失败: {masked_error}", err=True)

    if output_html:
        try:
            export_human_report(result, config, output_html)
            generated_files.append(output_html)
            click.echo(f"✅ 人类可读报告已导出: {output_html}")
        except Exception as e:
            masked_error = mask_sensitive_data(str(e), config, MaskingContext.DISPLAY)
            click.echo(f"⚠️  HTML报告导出失败: {masked_error}", err=True)

    severity_counts = result.summary.get("anomaly_breakdown", {}).get("by_severity", {})
    high_count = severity_counts.get("high", 0)

    if verbose and generated_files:
        click.echo()
        click.echo(f"📁 共生成 {len(generated_files)} 个文件:")
        for f in generated_files:
            click.echo(f"   - {f}")

    if high_count > 0:
        sys.exit(2)
    elif result.anomalies:
        sys.exit(1)
    else:
        sys.exit(0)


@cli.command("validate")
@click.argument("bill_files", nargs=-1, type=click.Path(exists=True), required=True)
@click.option("--provider", "-p", "providers", multiple=True,
              help="指定云厂商 (aws/aliyun/volcengine/auto)")
@click.option("--output-json", type=click.Path(), help="验证结果JSON输出路径")
@click.pass_context
def validate(
    ctx: click.Context,
    bill_files: Tuple[str, ...],
    providers: Tuple[str, ...],
    output_json: Optional[str],
) -> None:
    """仅验证账单格式和标签完整性，不做异常检测"""
    config: Config = ctx.obj["config"]
    verbose: bool = ctx.obj["verbose"]

    provider_hints = _parse_provider_list(list(providers)) if providers else None

    from .parsers import get_parser
    from .processors.normalization import normalize_bills
    from .processors.tag_fixer import fix_and_validate_tags

    all_records = []
    for i, filepath in enumerate(bill_files):
        provider_hint = provider_hints[i] if provider_hints and i < len(provider_hints) else None
        parser = get_parser(filepath, config, provider_hint)
        records = parser.parse(filepath)
        all_records.extend(records)

    normalized_bills, normalization_anomalies = normalize_bills(all_records, config)
    normalized_bills, tag_anomalies, tag_issues_count = fix_and_validate_tags(normalized_bills, config)

    click.echo(f"📊 验证结果:")
    click.echo(f"   总记录数: {len(all_records)}")
    click.echo(f"   字段缺失/格式错误: {len(normalization_anomalies)}")
    click.echo(f"   标签问题数: {sum(tag_issues_count.values())}")

    if tag_issues_count:
        click.echo()
        click.echo("🏷️  标签问题明细:")
        for key, count in sorted(tag_issues_count.items()):
            field_name, issue_type = key.split(":", 1)
            click.echo(f"   - {field_name}: {issue_type} x {count}")

    total_issues = len(normalization_anomalies) + len(tag_anomalies)
    if total_issues > 0:
        click.echo()
        click.echo(f"⚠️  共发现 {total_issues} 个问题需要处理")

    if output_json:
        import json
        from datetime import datetime
        output = {
            "schema_version": "1.0",
            "generated_at": datetime.now().isoformat(),
            "total_records": len(all_records),
            "field_issues": len(normalization_anomalies),
            "tag_issues": sum(tag_issues_count.values()),
            "tag_issues_count": tag_issues_count,
            "issues": [
                {
                    "type": a.anomaly_type.value,
                    "severity": a.severity,
                    "message": mask_sensitive_data(a.message, config, MaskingContext.EXPORT),
                    "resource_id": a.resource_id,
                    "service": a.service,
                }
                for a in normalization_anomalies + tag_anomalies
            ],
        }
        with open(output_json, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        click.echo()
        click.echo(f"✅ 验证结果已导出: {output_json}")

    sys.exit(0 if total_issues == 0 else 1)


@cli.command("config")
@click.option("--show-default", is_flag=True, help="显示默认配置")
@click.option("--output", type=click.Path(), help="导出默认配置到文件")
@click.pass_context
def config_cmd(
    ctx: click.Context,
    show_default: bool,
    output: Optional[str],
) -> None:
    """管理配置文件"""
    config: Config = ctx.obj["config"]

    if show_default or output:
        import yaml
        default_config = {
            "target_currency": "CNY",
            "exchange_rates": {"USD": 7.25, "CNY": 1.0},
            "anomaly_threshold_percent": 20.0,
            "anomaly_min_amount": 100.0,
            "sensitive_fields": [
                "aws_account_id",
                "account_id",
                "access_key",
                "secret_key",
            ],
            "mask_pattern": "***",
            "required_tags": ["project", "team", "environment"],
            "duplicate_ri_detection": True,
            "budget_warning_percent": 80.0,
        }

        if show_default:
            click.echo(yaml.dump(default_config, allow_unicode=True, sort_keys=False))

        if output:
            with open(output, "w", encoding="utf-8") as f:
                yaml.dump(default_config, f, allow_unicode=True, sort_keys=False)
            click.echo(f"✅ 默认配置已导出: {output}")

        return

    click.echo("📋 当前配置:")
    click.echo(f"   目标货币: {config.target_currency}")
    click.echo(f"   汇率: {config.exchange_rates}")
    click.echo(f"   异常阈值: {config.anomaly_threshold_percent}%")
    click.echo(f"   最小异常金额: {config.anomaly_min_amount}")
    click.echo(f"   必填标签: {config.required_tags}")
    click.echo(f"   RI重复检测: {'启用' if config.duplicate_ri_detection else '禁用'}")
    click.echo(f"   预算预警阈值: {config.budget_warning_percent}%")
    click.echo(f"   敏感字段脱敏 (显示/导出/日志): "
               f"{config.enable_display_masking}/{config.enable_export_masking}/{config.enable_log_masking}")


def main() -> None:
    cli(obj={})


if __name__ == "__main__":
    main()
