import os
import sys
import json
from datetime import datetime

import click
from colorama import init, Fore, Style

from .config import (
    RegressionConfig,
    DesensitizationRule,
    IgnoreRule,
    ServiceConfig,
    ThresholdConfig,
)
from .models import SampleStatus
from .sample_processor import SampleProcessor
from .replayer import ReplayEngine
from .comparator import Comparator
from .approval_manager import ApprovalManager
from .reporter import Reporter


init()


def load_config(ctx: click.Context, param, value) -> RegressionConfig:
    config_path = value or "regression_config.yaml"
    config = RegressionConfig.load(config_path)
    ctx.ensure_object(dict)
    ctx.obj["config"] = config
    ctx.obj["config_path"] = config_path
    return config


@click.group()
@click.option(
    "--config",
    "-c",
    type=click.Path(exists=False),
    default=None,
    callback=load_config,
    help="配置文件路径 (默认: regression_config.yaml)",
)
@click.pass_context
def cli(ctx: click.Context, config: RegressionConfig):
    """请求录制回归测试 CLI 工具"""
    pass


@cli.command()
@click.option("--input", "-i", type=click.Path(exists=True), help="原始样本目录或文件")
@click.option("--output", "-o", type=click.Path(), help="处理后样本输出目录")
@click.option("--group", "-g", multiple=True, help="仅处理指定分组的样本")
@click.option("--skip-desensitize", is_flag=True, help="跳过脱敏处理")
@click.pass_context
def sample(ctx: click.Context, input: str, output: str, group: tuple, skip_desensitize: bool):
    """处理样本：导入、脱敏、分组"""
    config = ctx.obj["config"]
    processor = SampleProcessor(config)

    input_path = input or config.input_dir
    output_path = output or config.output_dir

    if not os.path.exists(input_path):
        click.echo(f"{Fore.RED}错误：输入路径不存在: {input_path}{Style.RESET_ALL}")
        sys.exit(1)

    all_samples = []

    if os.path.isfile(input_path):
        samples = processor.process_sample_file(input_path)
        all_samples.extend(samples)
    else:
        for filename in os.listdir(input_path):
            if filename.endswith(".json"):
                file_path = os.path.join(input_path, filename)
                samples = processor.process_sample_file(file_path)
                all_samples.extend(samples)

    if group:
        all_samples = [s for s in all_samples if s.group in group]

    if not skip_desensitize:
        for sample in all_samples:
            if sample.status == SampleStatus.VALID:
                processor.desensitize(sample)

    grouped = processor.group_samples(all_samples)

    os.makedirs(output_path, exist_ok=True)
    saved_count = 0
    bad_count = 0

    for sample in all_samples:
        if sample.status == SampleStatus.VALID:
            processor.save_processed_sample(sample, output_path)
            saved_count += 1
        else:
            bad_count += 1

    click.echo(f"样本处理完成:")
    click.echo(f"  总样本数: {len(all_samples)}")
    click.echo(f"  有效样本: {Fore.GREEN}{saved_count}{Style.RESET_ALL}")
    click.echo(f"  问题样本: {Fore.YELLOW}{bad_count}{Style.RESET_ALL}")

    for group_name, samples in grouped.items():
        valid = sum(1 for s in samples if s.status == SampleStatus.VALID)
        click.echo(f"  分组 {Fore.CYAN}{group_name}{Style.RESET_ALL}: {len(samples)} 个 (有效 {valid} 个)")


@cli.command()
@click.option("--service", "-s", multiple=True, help="要回放的服务名称")
@click.option("--samples", "-i", type=click.Path(), help="处理后样本目录")
@click.option("--group", "-g", multiple=True, help="仅回放指定分组")
@click.option("--output", "-o", type=click.Path(), help="回放结果输出目录")
@click.pass_context
def replay(ctx: click.Context, service: tuple, samples: str, group: tuple, output: str):
    """回放样本到指定服务"""
    config = ctx.obj["config"]
    processor = SampleProcessor(config)
    replayer = ReplayEngine(config)

    samples_dir = samples or config.output_dir
    output_dir = output or config.replay_results_dir

    all_samples = processor.load_processed_samples(samples_dir)

    if group:
        all_samples = [s for s in all_samples if s.group in group]

    valid_samples = [s for s in all_samples if s.status == SampleStatus.VALID]

    if not service:
        if config.baseline_service:
            service = (config.baseline_service, config.target_service)
        else:
            click.echo(f"{Fore.RED}错误：请指定 --service 参数或在配置中设置 baseline_service{Style.RESET_ALL}")
            sys.exit(1)

    for svc_name in service:
        click.echo(f"正在回放服务: {Fore.CYAN}{svc_name}{Style.RESET_ALL}")

        for sample in valid_samples:
            click.echo(f"  回放样本: {sample.id} ({sample.group})")
            result = replayer.replay_sample(sample, svc_name)

            if result.error:
                click.echo(f"    {Fore.YELLOW}警告: {result.error}{Style.RESET_ALL}")

            replayer.save_replay_result(result, output_dir)

        click.echo(f"  完成: {len(valid_samples)} 个样本\n")


@cli.command()
@click.option("--baseline", "-b", help="基线服务名称")
@click.option("--target", "-t", help="目标服务名称")
@click.option("--results", "-r", type=click.Path(), help="回放结果目录")
@click.option("--output", "-o", type=click.Path(), help="比较结果输出目录")
@click.pass_context
def compare(ctx: click.Context, baseline: str, target: str, results: str, output: str):
    """比较基线服务和目标服务的响应"""
    config = ctx.obj["config"]
    processor = SampleProcessor(config)
    replayer = ReplayEngine(config)
    comparator = Comparator(config)
    approval_mgr = ApprovalManager(config)

    baseline_name = baseline or config.baseline_service
    target_name = target or config.target_service

    if not baseline_name or not target_name:
        click.echo(f"{Fore.RED}错误：请指定 baseline 和 target 服务{Style.RESET_ALL}")
        sys.exit(1)

    results_dir = results or config.replay_results_dir
    output_dir = output or config.comparison_dir

    baseline_results = replayer.load_replay_results(results_dir, baseline_name)
    target_results = replayer.load_replay_results(results_dir, target_name)
    samples = processor.load_processed_samples(config.output_dir)

    sample_by_id = {s.id: s for s in samples}

    comparisons = {}
    for sample_id, baseline_result in baseline_results.items():
        if sample_id not in target_results:
            continue

        target_result = target_results[sample_id]
        sample = sample_by_id.get(sample_id)
        sample_group = sample.group if sample else "unknown"

        result = comparator.compare(baseline_result, target_result, sample_group)
        approval = approval_mgr.get_approval(result)
        if approval:
            result.approved = True
            result.approval_record = f"{approval.approver}@{approval.timestamp.isoformat()} - {approval.reason}"

        comparisons[sample_id] = result
        comparator.save_comparison(result, output_dir)

    has_diffs = sum(1 for r in comparisons.values() if r.has_diff and not r.approved)
    approved = sum(1 for r in comparisons.values() if r.approved)
    clean = sum(1 for r in comparisons.values() if not r.has_diff)

    click.echo(f"比较完成:")
    click.echo(f"  总比较数: {len(comparisons)}")
    click.echo(f"  无差异: {Fore.GREEN}{clean}{Style.RESET_ALL}")
    click.echo(f"  已批准: {Fore.CYAN}{approved}{Style.RESET_ALL}")
    click.echo(f"  待处理差异: {Fore.RED}{has_diffs}{Style.RESET_ALL}")

    for result in comparisons.values():
        if result.has_diff and not result.approved:
            click.echo(f"\n{Fore.YELLOW}样本 {result.sample_id} ({result.sample_group}) 存在差异:{Style.RESET_ALL}")
            for diff in result.diffs:
                if not diff.ignored:
                    indicator = "*" if diff.ignored else ""
                    click.echo(f"  {indicator}{diff.diff_type.value}: {diff.path}")


@cli.command()
@click.argument("sample_id")
@click.option("--reason", "-r", required=True, help="批准原因")
@click.option("--approver", "-a", required=True, help="批准人")
@click.option("--comparisons", "-c", type=click.Path(), help="比较结果目录")
@click.pass_context
def approve(ctx: click.Context, sample_id: str, reason: str, approver: str, comparisons: str):
    """批准指定样本的差异"""
    config = ctx.obj["config"]
    comparator = Comparator(config)
    approval_mgr = ApprovalManager(config)

    comparisons_dir = comparisons or config.comparison_dir
    all_comparisons = comparator.load_comparisons(comparisons_dir)

    if sample_id not in all_comparisons:
        click.echo(f"{Fore.RED}错误：找不到样本 {sample_id} 的比较结果{Style.RESET_ALL}")
        sys.exit(1)

    result = all_comparisons[sample_id]

    if not result.has_diff:
        click.echo(f"{Fore.YELLOW}警告：样本 {sample_id} 没有差异需要批准{Style.RESET_ALL}")
        return

    approval = approval_mgr.create_approval(result, reason, approver)

    click.echo(f"{Fore.GREEN}已批准差异:{Style.RESET_ALL}")
    click.echo(f"  样本: {sample_id}")
    click.echo(f"  批准ID: {approval.approval_id}")
    click.echo(f"  批准人: {approver}")
    click.echo(f"  原因: {reason}")
    click.echo(f"  时间: {approval.timestamp.isoformat()}")


@cli.command()
@click.option("--comparisons", "-c", type=click.Path(), help="比较结果目录")
@click.option("--output", "-o", type=click.Path(), help="报告输出路径")
@click.option("--format", "-f", type=click.Choice(["cli", "json", "both"]), default="cli", help="报告格式")
@click.pass_context
def report(ctx: click.Context, comparisons: str, output: str, format: str):
    """生成回归测试报告"""
    config = ctx.obj["config"]
    processor = SampleProcessor(config)
    comparator = Comparator(config)
    reporter = Reporter(config)

    comparisons_dir = comparisons or config.comparison_dir
    output_path = output or os.path.join(config.reports_dir, f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")

    all_comparisons = comparator.load_comparisons(comparisons_dir)
    samples = processor.load_processed_samples(config.output_dir)

    processor = SampleProcessor(config)
    grouped = processor.group_samples(samples)

    bad_samples = [s for s in samples if s.status != SampleStatus.VALID]

    if format in ["cli", "both"]:
        click.echo(reporter.generate_cli_report(all_comparisons, grouped, bad_samples))

    if format in ["json", "both"]:
        path = reporter.generate_json_report(all_comparisons, grouped, bad_samples, output_path)
        click.echo(f"\nJSON 报告已保存到: {Fore.GREEN}{path}{Style.RESET_ALL}")


@cli.command("init-config")
@click.option("--output", "-o", type=click.Path(), default="regression_config.yaml", help="输出路径")
@click.pass_context
def init_config(ctx: click.Context, output: str):
    """创建示例配置文件"""
    config = RegressionConfig(
        input_dir="samples/raw",
        output_dir="samples/processed",
        replay_results_dir="results/replay",
        comparison_dir="results/comparison",
        approvals_dir="results/approvals",
        reports_dir="results/reports",
        desensitization_rules=[
            DesensitizationRule(field="Authorization", replacement="***"),
            DesensitizationRule(field="phone", pattern=r"\d{7}(\d{4})", replacement="****$1"),
            DesensitizationRule(field="password", replacement="***"),
            DesensitizationRule(field="email", replacement="***@***"),
        ],
        ignore_rules=[
            IgnoreRule(path="body.data.created_at", reason="动态时间戳"),
            IgnoreRule(path="body.data.updated_at", reason="动态时间戳"),
            IgnoreRule(path="body.data.timestamp", reason="动态时间戳"),
        ],
        required_headers=["Content-Type"],
        groups=["member", "order", "inventory"],
        services=[
            ServiceConfig(
                name="baseline",
                type="builtin",
                module="request_regression.builtin_handlers",
                processor="baseline_handler",
                headers={},
            ),
            ServiceConfig(
                name="target",
                type="builtin",
                module="request_regression.builtin_handlers",
                processor="target_handler",
                headers={},
            ),
        ],
        baseline_service="baseline",
        target_service="target",
        thresholds=ThresholdConfig(
            max_total_diffs=100,
            max_severity_score=80.0,
            max_response_time_diff_ms=1000,
        ),
    )

    config.save(output)
    click.echo(f"{Fore.GREEN}配置文件已创建: {output}{Style.RESET_ALL}")


if __name__ == "__main__":
    cli()
