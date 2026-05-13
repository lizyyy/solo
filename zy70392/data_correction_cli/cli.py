import click
import json
from pathlib import Path
from datetime import datetime
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from typing import List

from .models import (
    CorrectionPlan, DownstreamDependency, ReportRule, BillRule,
    CacheConfig, RiskConfirmation, FieldType
)
from .evaluator import (
    ImpactEvaluator, ExecutionPlanGenerator, ReportGenerator,
    load_yaml, save_yaml, save_json
)

console = Console()


def load_configs(
    plan_file: str,
    dependencies_file: str,
    report_rules_file: str,
    bill_rules_file: str,
    cache_config_file: str
):
    plan_data = load_yaml(plan_file)
    deps_data = load_yaml(dependencies_file)
    reports_data = load_yaml(report_rules_file)
    bills_data = load_yaml(bill_rules_file)
    cache_data = load_yaml(cache_config_file)

    plan = CorrectionPlan(**plan_data)
    dependencies = [DownstreamDependency(**d) for d in deps_data.get('dependencies', [])]
    report_rules = [ReportRule(**r) for r in reports_data.get('rules', [])]
    bill_rules = [BillRule(**b) for b in bills_data.get('rules', [])]
    cache_configs = [CacheConfig(**c) for c in cache_data.get('configs', [])]

    return plan, dependencies, report_rules, bill_rules, cache_configs


def print_assessment_summary(assessment):
    console.print(Panel.fit(
        f"[bold blue]评估完成[/bold blue]\n"
        f"计划ID: {assessment.plan_id}\n"
        f"评估时间: {assessment.assessed_at.strftime('%Y-%m-%d %H:%M:%S')}\n"
        f"影响下游数: {len(assessment.items)}\n"
        f"需要审批: {'是' if assessment.needs_approval else '否'}\n"
        f"包含已结算账单: {'是 ⚠️' if assessment.has_settled_bills else '否'}"
    ))

    table = Table(title="影响评估详情")
    table.add_column("目标", style="cyan")
    table.add_column("类型", style="magenta")
    table.add_column("操作", style="green")
    table.add_column("风险等级", style="yellow")
    table.add_column("负责人", style="white")
    table.add_column("需审批", style="red")

    risk_colors = {
        "low": "green",
        "medium": "yellow",
        "high": "orange",
        "critical": "red bold"
    }

    for item in assessment.items:
        risk_style = risk_colors.get(item.risk_level.value, "white")
        table.add_row(
            item.target_name,
            item.target_type,
            item.action,
            Text(item.risk_level.value, style=risk_style),
            item.owner or "未指定",
            "是 ⚠️" if item.requires_approval else "否"
        )

    console.print(table)

    if assessment.missing_owners:
        console.print(f"\n[bold red]⚠️ 警告: 以下下游缺少负责人: {', '.join(assessment.missing_owners)}[/bold red]")

    if assessment.has_settled_bills:
        console.print("\n[bold red]⚠️ 重要: 包含已结算账单，需要二次审批[/bold red]")


@click.group()
def cli():
    """数据订正影响评估 CLI - 评估数据订正对下游系统的影响"""
    pass


@cli.command()
@click.option('--plan', required=True, help='订正计划文件路径 (YAML)')
@click.option('--dependencies', required=True, help='下游依赖清单文件 (YAML)')
@click.option('--report-rules', required=True, help='报表规则文件 (YAML)')
@click.option('--bill-rules', required=True, help='账单规则文件 (YAML)')
@click.option('--cache-config', required=True, help='缓存配置文件 (YAML)')
@click.option('--output', '-o', default=None, help='评估结果输出路径 (JSON)')
def assess(plan, dependencies, report_rules, bill_rules, cache_config, output):
    """评估订正计划对下游的影响"""
    try:
        console.print("[bold blue]正在加载配置文件...[/bold blue]")
        configs = load_configs(plan, dependencies, report_rules, bill_rules, cache_config)
        plan_obj, deps, reports, bills, caches = configs

        console.print(f"[bold]订正计划: {plan_obj.plan_name}[/bold]")
        console.print(f"订正项数量: {len(plan_obj.items)}")

        evaluator = ImpactEvaluator(plan_obj, deps, reports, bills, caches)
        assessment = evaluator.evaluate()

        print_assessment_summary(assessment)

        if output:
            save_json(assessment.dict(), output)
            console.print(f"\n[green]评估结果已保存到: {output}[/green]")

    except Exception as e:
        console.print(f"[bold red]错误: {e}[/bold red]")
        raise click.Abort()


@cli.command()
@click.option('--plan', required=True, help='订正计划文件路径 (YAML)')
@click.option('--dependencies', required=True, help='下游依赖清单文件 (YAML)')
@click.option('--report-rules', required=True, help='报表规则文件 (YAML)')
@click.option('--bill-rules', required=True, help='账单规则文件 (YAML)')
@click.option('--cache-config', required=True, help='缓存配置文件 (YAML)')
@click.option('--target', default=None, help='指定要解释的下游目标名称')
def explain(plan, dependencies, report_rules, bill_rules, cache_config, target):
    """详细解释每个下游的影响原因"""
    try:
        configs = load_configs(plan, dependencies, report_rules, bill_rules, cache_config)
        plan_obj, deps, reports, bills, caches = configs

        evaluator = ImpactEvaluator(plan_obj, deps, reports, bills, caches)
        assessment = evaluator.evaluate()

        for item in assessment.items:
            if target and target.lower() not in item.target_name.lower():
                continue

            risk_levels = {
                "low": "[green]低[/green]",
                "medium": "[yellow]中[/yellow]",
                "high": "[orange]高[/orange]",
                "critical": "[red]极高[/red]"
            }

            panel_content = [
                f"[bold cyan]{item.target_name}[/bold cyan]",
                f"类型: {item.target_type}",
                f"操作: {item.action}",
                f"风险等级: {risk_levels.get(item.risk_level.value, item.risk_level.value)}",
                f"负责人: {item.owner or '未指定'}",
                f"原因: {item.reason}",
            ]

            if item.requires_approval:
                panel_content.append("[red]需要审批[/red]")
            if item.is_settled:
                panel_content.append("[red bold]⚠️ 已结算账单，需二次审批[/red bold]")

            console.print(Panel("\n".join(panel_content)))

    except Exception as e:
        console.print(f"[bold red]错误: {e}[/bold red]")
        raise click.Abort()


@cli.command('confirm-risk')
@click.option('--plan-id', required=True, help='订正计划ID')
@click.option('--confirmed-by', required=True, help='确认人姓名/邮箱')
@click.option('--approval-level', type=click.Choice(['normal', 'senior', 'executive']), default='normal', help='审批级别')
@click.option('--comments', default='', help='备注信息')
@click.option('--output', '-o', required=True, help='风险确认记录输出路径 (YAML/JSON)')
def confirm_risk(plan_id, confirmed_by, approval_level, comments, output):
    """确认风险并记录责任人"""
    try:
        confirmation = RiskConfirmation(
            plan_id=plan_id,
            confirmed_by=confirmed_by,
            approval_level=approval_level,
            comments=comments
        )

        output_path = Path(output)
        if output_path.suffix.lower() in ['.json']:
            save_json(confirmation.dict(), output)
        else:
            save_yaml(confirmation.dict(), output)

        console.print(Panel(
            f"[bold green]风险确认已记录[/bold green]\n"
            f"计划ID: {confirmation.plan_id}\n"
            f"确认人: {confirmation.confirmed_by}\n"
            f"审批级别: {confirmation.approval_level}\n"
            f"确认时间: {confirmation.confirmed_at.strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"备注: {confirmation.comments or '无'}\n\n"
            f"已保存到: {output}"
        ))

    except Exception as e:
        console.print(f"[bold red]错误: {e}[/bold red]")
        raise click.Abort()


@cli.command('export-plan')
@click.option('--plan', required=True, help='订正计划文件路径 (YAML)')
@click.option('--dependencies', required=True, help='下游依赖清单文件 (YAML)')
@click.option('--report-rules', required=True, help='报表规则文件 (YAML)')
@click.option('--bill-rules', required=True, help='账单规则文件 (YAML)')
@click.option('--cache-config', required=True, help='缓存配置文件 (YAML)')
@click.option('--output', '-o', required=True, help='执行计划输出路径 (YAML/JSON)')
def export_plan(plan, dependencies, report_rules, bill_rules, cache_config, output):
    """导出执行计划"""
    try:
        configs = load_configs(plan, dependencies, report_rules, bill_rules, cache_config)
        plan_obj, deps, reports, bills, caches = configs

        evaluator = ImpactEvaluator(plan_obj, deps, reports, bills, caches)
        assessment = evaluator.evaluate()

        generator = ExecutionPlanGenerator(plan_obj, assessment)
        execution_plan = generator.generate()

        output_path = Path(output)
        if output_path.suffix.lower() in ['.json']:
            save_json(execution_plan.dict(), output)
        else:
            save_yaml(execution_plan.dict(), output)

        console.print(Panel(
            f"[bold green]执行计划已生成[/bold green]\n"
            f"计划ID: {execution_plan.plan_id}\n"
            f"生成时间: {execution_plan.generated_at.strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"执行步骤数: {len(execution_plan.steps)}\n"
            f"回滚步骤数: {len(execution_plan.rollback_plan)}\n\n"
            f"已保存到: {output}"
        ))

        table = Table(title="执行步骤")
        table.add_column("步骤", style="cyan")
        table.add_column("目标", style="magenta")
        table.add_column("类型", style="white")
        table.add_column("操作", style="green")
        table.add_column("风险", style="yellow")
        table.add_column("需审批", style="red")

        for step in execution_plan.steps:
            table.add_row(
                str(step["step"]),
                step["target"],
                step["type"],
                step["action"],
                step["risk_level"],
                "是 ⚠️" if step["requires_approval"] else "否"
            )

        console.print(table)

    except Exception as e:
        console.print(f"[bold red]错误: {e}[/bold red]")
        raise click.Abort()


@cli.command()
@click.option('--plan', required=True, help='订正计划文件路径 (YAML)')
@click.option('--dependencies', required=True, help='下游依赖清单文件 (YAML)')
@click.option('--report-rules', required=True, help='报表规则文件 (YAML)')
@click.option('--bill-rules', required=True, help='账单规则文件 (YAML)')
@click.option('--cache-config', required=True, help='缓存配置文件 (YAML)')
@click.option('--output', '-o', required=True, help='评估报告输出路径 (YAML/JSON)')
def report(plan, dependencies, report_rules, bill_rules, cache_config, output):
    """生成业务负责人签字确认报告"""
    try:
        configs = load_configs(plan, dependencies, report_rules, bill_rules, cache_config)
        plan_obj, deps, reports, bills, caches = configs

        evaluator = ImpactEvaluator(plan_obj, deps, reports, bills, caches)
        assessment = evaluator.evaluate()

        exec_generator = ExecutionPlanGenerator(plan_obj, assessment)
        execution_plan = exec_generator.generate()

        report_generator = ReportGenerator(plan_obj, assessment, execution_plan)
        signature_report = report_generator.generate_signature_report()

        output_path = Path(output)
        if output_path.suffix.lower() in ['.json']:
            save_json(signature_report.dict(), output)
        else:
            save_yaml(signature_report.dict(), output)

        risk_colors = {
            "low": "[green]低[/green]",
            "medium": "[yellow]中[/yellow]",
            "high": "[orange]高[/orange]",
            "critical": "[red]极高[/red]"
        }

        console.print(Panel(
            f"[bold blue]业务确认报告[/bold blue]\n"
            f"计划名称: {signature_report.plan_name}\n"
            f"计划ID: {signature_report.plan_id}\n"
            f"创建人: {signature_report.created_by}\n"
            f"整体风险等级: {risk_colors.get(signature_report.risk_level.value, signature_report.risk_level.value)}\n"
            f"影响对象数: {len(signature_report.affected_objects)}\n"
            f"需重算数: {len(signature_report.recalc_steps)}\n"
            f"已结算项数: {len(signature_report.settled_items)} [red](需二次审批)[/red]\n"
            f"无法自动处理: {len(signature_report.cannot_auto_process)}\n\n"
            f"报告已保存到: {output}"
        ))

        if signature_report.settled_items:
            console.print("\n[bold red]⚠️ 已结算账单列表 (需要二次审批):[/bold red]")
            for item in signature_report.settled_items:
                console.print(f"  - {item['name']}: {item['reason']}")

        if signature_report.cannot_auto_process:
            console.print("\n[bold yellow]⚠️ 无法自动处理的项目:[/bold yellow]")
            for item in signature_report.cannot_auto_process:
                console.print(f"  - {item['name']}: {item['reason']}")

        console.print("\n[bold]建议执行顺序:[/bold]")
        for idx, order in enumerate(signature_report.suggested_order, 1):
            console.print(f"  {idx}. {order}")

        console.print("\n[bold]回退建议:[/bold]")
        for idx, suggestion in enumerate(signature_report.rollback_suggestions, 1):
            console.print(f"  {idx}. {suggestion}")

    except Exception as e:
        console.print(f"[bold red]错误: {e}[/bold red]")
        raise click.Abort()


if __name__ == '__main__':
    cli()
