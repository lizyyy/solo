"""知识库失效链接追踪 - 命令行入口"""

import json
import sys
from pathlib import Path

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.tree import Tree

from kb_link_tracker.workflow import ThreeStepWorkflow
from kb_link_tracker.store import UnifiedDataStore
from kb_link_tracker.models import RecordStatus

console = Console()


def print_step_header(step_num: int, title: str):
    console.print(Panel.fit(
        f"[bold cyan]步骤 {step_num}[/bold cyan]: [bold]{title}[/bold]",
        border_style="cyan",
    ))


def print_result_summary(result: dict):
    table = Table(title="自检结果", show_header=True, header_style="bold magenta")
    table.add_column("指标")
    table.add_column("数值", justify="right")

    cr = result.get("check_result", {})
    table.add_row("总记录数", str(cr.get("total_records", 0)))
    table.add_row("正常记录", str(cr.get("normal_count", 0)))
    table.add_row("重复用户反馈", str(cr.get("duplicate_user_feedback_count", 0)))
    table.add_row("重复导入", str(cr.get("duplicate_import_count", 0)))
    table.add_row("待复核", str(cr.get("review_required_count", 0)))
    table.add_row("已复核", str(cr.get("reviewed_count", 0)))
    table.add_row(
        "导出一致性",
        "[green]✓ 通过[/green]" if cr.get("export_consistent") else "[red]✗ 不通过[/red]",
    )
    console.print(table)


@click.group()
def cli():
    """知识库失效链接追踪系统"""
    pass


@cli.command()
@click.option(
    "--model-output", "-m",
    default="./sample_data/model_output.csv",
    help="模型输出文件路径",
)
@click.option(
    "--manual-judgments", "-j",
    default="./sample_data/manual_judgments.csv",
    help="人工改判表文件路径",
)
@click.option(
    "--output-dir", "-o",
    default="./output",
    help="输出目录",
)
@click.option(
    "--judge-name",
    default="周姐",
    help="标注负责人姓名",
)
@click.option(
    "--reviewer",
    default="周姐",
    help="复核人姓名",
)
def run(model_output, manual_judgments, output_dir, judge_name, reviewer):
    """运行完整三步流程"""

    console.print(Panel.fit(
        "[bold green]知识库失效链接追踪[/bold green]\n"
        "完整三步流程: 导入 → 补看 → 回放更新",
        border_style="green",
    ))

    workflow = ThreeStepWorkflow(data_dir="./data")

    print_step_header(1, "模型输出片段第一次导入")
    step1 = workflow.step1_import_model_output(model_output)
    console.print(f"导入记录数: [bold]{step1['imported_count']}[/bold]")
    if step1["warnings"]:
        console.print(f"[yellow]警告: {len(step1['warnings'])} 条[/yellow]")
        for w in step1["warnings"]:
            console.print(f"  - {w}")
    print_result_summary(step1)

    print_step_header(2, f"标注负责人{judge_name}补看人工改判表")
    step2 = workflow.step2_supplement_manual_judgments(
        manual_judgments,
        judge_name=judge_name,
    )
    console.print(f"更新记录数: [bold]{step2['updated_count']}[/bold]")
    if step2["warnings"]:
        console.print(f"[yellow]警告: {len(step2['warnings'])} 条[/yellow]")
        for w in step2["warnings"]:
            console.print(f"  - {w}")
    console.print(f"[cyan]提示: {step2['note']}[/cyan]")
    print_result_summary(step2)

    print_step_header(3, "证据回放更新")
    duplicate_records = workflow.store.get_duplicate_feedback_records()

    review_decisions = {}
    if duplicate_records:
        console.print(f"\n[bold yellow]发现 {len(duplicate_records)} 条重复用户反馈记录[/bold yellow]")
        console.print("[cyan]根据人工改判表自动生成复核决定...[/cyan]")

        for record in duplicate_records:
            if record.manual_judgments:
                last_judgment = record.manual_judgments[-1]
                judgment = last_judgment.judgment_result
                reason = last_judgment.judgment_reason

                if "剔除" in judgment or "重复" in judgment:
                    keep = False
                else:
                    keep = True

                review_decisions[record.record_id] = {
                    "keep": keep,
                    "reason": f"{judge_name}复核: {reason}",
                }

                console.print(
                    f"  记录 {record.record_id}: "
                    f"{'[green]保留[/green]' if keep else '[red]剔除[/red]'} "
                    f"- {reason[:30]}..."
                )

    step3 = workflow.step3_evidence_playback_update(
        review_decisions=review_decisions,
        reviewer=reviewer,
    )
    print_result_summary(step3)

    summary = workflow.store.generate_review_summary()
    console.print(f"\n[bold]复核总览:[/bold]")
    console.print(f"  总记录数: {summary['total_records']}")
    console.print(f"  重复用户反馈记录: {summary['duplicate_user_feedback_count']}")
    console.print(f"  重复分组数: {summary['duplicate_group_count']}")
    console.print(f"  待复核: {summary['review_required_count']}")
    console.print(f"  已复核: {summary['reviewed_count']}")

    console.print(f"\n[bold cyan]导出结果中...[/bold cyan]")
    export_files = workflow.export_results(output_dir=output_dir)

    console.print(Panel.fit(
        "[bold green]流程执行完成![/bold green]\n\n"
        f"导出文件:\n"
        f"  明细CSV: {export_files['detail_csv']}\n"
        f"  明细JSON: {export_files['detail_json']}\n"
        f"  汇总JSON: {export_files['summary_json']}\n"
        f"  状态文件: {export_files['state_pkl']}\n"
        f"  流程日志: {export_files['workflow_log_json']}\n\n"
        f"[bold]复盘/重跑命令:[/bold]\n"
        f"  {export_files['replay_command']}",
        border_style="green",
    ))


@cli.command()
@click.option(
    "--state", "-s",
    required=True,
    help="状态文件路径 (.pkl)",
)
@click.option(
    "--record-id", "-r",
    help="查看指定记录的证据链",
)
@click.option(
    "--list-duplicates", "-d",
    is_flag=True,
    help="列出所有重复用户反馈分组",
)
def replay(state, record_id, list_duplicates):
    """复盘和证据回放"""

    console.print(Panel.fit(
        "[bold blue]知识库失效链接追踪 - 证据回放[/bold blue]",
        border_style="blue",
    ))

    store = UnifiedDataStore()
    if not store.load_state(state):
        console.print("[red]加载状态文件失败![/red]")
        sys.exit(1)

    console.print(f"[green]✓ 状态加载成功[/green]")
    console.print(f"  总记录数: {len(store.records)}")

    summary = store.generate_review_summary()
    console.print(f"  重复用户反馈: {summary['duplicate_user_feedback_count']}")
    console.print(f"  重复分组数: {summary['duplicate_group_count']}")
    console.print(f"  待复核: {summary['review_required_count']}")
    console.print(f"  已复核: {summary['reviewed_count']}")

    if list_duplicates:
        console.print(f"\n[bold]重复用户反馈分组列表:[/bold]")
        for group in summary["duplicate_groups"]:
            status_color = "yellow" if group["status"] == "pending_review" else "green"
            console.print(
                f"\n  分组 [bold]{group['group_id']}[/bold] "
                f"({group['user_feedback_id']}): "
                f"[{status_color}]{group['status']}[/{status_color}] "
                f"共 {group['record_count']} 条记录"
            )

            detail = store.get_duplicate_group_detail(group["group_id"])
            for rec in detail.get("records", []):
                status = rec["status"]
                if status == RecordStatus.REVIEWED.value:
                    status_str = f"[green]已复核[/green]"
                elif status == RecordStatus.REJECTED.value:
                    status_str = f"[red]已剔除[/red]"
                else:
                    status_str = f"[yellow]待复核[/yellow]"

                console.print(
                    f"    - {rec['record_id']}: "
                    f"{rec['kb_link']} {status_str}"
                )
                if rec.get("review_reason"):
                    console.print(
                        f"      [dim]复核理由: {rec['review_reason']}[/dim]"
                    )

    if record_id:
        evidence = store.get_evidence_trail(record_id)
        if not evidence:
            console.print(f"[red]未找到记录: {record_id}[/red]")
            sys.exit(1)

        record = store.get_record(record_id)
        console.print(f"\n[bold]记录详情:[/bold]")
        console.print(f"  记录ID: {record_id}")
        console.print(f"  用户反馈ID: {record.user_feedback_id}")
        console.print(f"  用户ID: {record.user_id}")
        console.print(f"  链接: {record.kb_link}")
        console.print(f"  状态: {record.status.value}")
        console.print(f"  问题类型: {record.issue_type.value}")
        if record.review_reason:
            console.print(f"  复核理由: {record.review_reason}")

        console.print(f"\n[bold]证据链:[/bold]")
        tree = Tree("证据链")
        for item in evidence:
            if item["type"] == "model_output":
                node = tree.add(f"[cyan]模型输出[/cyan] (行号: {item['raw_line_number']})")
                node.add(f"批次: {item['import_batch_id']}")
                node.add(f"时间: {item['timestamp']}")
            elif item["type"] == "manual_judgment":
                node = tree.add(
                    f"[green]人工改判 #{item['judgment_index']}[/green] "
                    f"({item['judge_name']})"
                )
                node.add(f"结果: {item['judgment_result']}")
                node.add(f"理由: {item['judgment_reason']}")
                node.add(f"原始行号: {item['raw_line_number']}")
            elif item["type"] == "status_change":
                before = item["before_status"] or "初始"
                node = tree.add(
                    f"[yellow]状态变更[/yellow]: {before} → {item['after_status']}"
                )
                node.add(f"操作人: {item['operator']}")
                node.add(f"操作: {item['action']}")
                node.add(f"原因: {item['reason']}")

        console.print(tree)


@cli.command()
@click.option(
    "--state", "-s",
    required=True,
    help="状态文件路径 (.pkl)",
)
@click.option(
    "--group-id", "-g",
    required=True,
    help="重复分组ID",
)
def show_group(state, group_id):
    """查看重复分组详情"""

    store = UnifiedDataStore()
    if not store.load_state(state):
        console.print("[red]加载状态文件失败![/red]")
        sys.exit(1)

    detail = store.get_duplicate_group_detail(group_id)
    if not detail:
        console.print(f"[red]未找到分组: {group_id}[/red]")
        sys.exit(1)

    console.print(Panel.fit(
        f"[bold]重复分组详情[/bold]\n"
        f"分组ID: {group_id}\n"
        f"用户反馈ID: {detail['user_feedback_id']}\n"
        f"记录数: {detail['record_count']}",
        border_style="magenta",
    ))

    for idx, rec in enumerate(detail["records"]):
        console.print(f"\n[bold]记录 {idx + 1}: {rec['record_id']}[/bold]")
        console.print(f"  用户ID: {rec['user_id']}")
        console.print(f"  链接: {rec['kb_link']}")
        console.print(f"  状态: {rec['status']}")
        console.print(f"  原始行号: {rec['raw_line_number']}")
        console.print(f"  导入批次: {rec['import_batch_id']}")

        if rec.get("review_by"):
            console.print(f"  复核人: {rec['review_by']}")
            console.print(f"  [bold]复核理由: {rec['review_reason']}[/bold]")

        if rec.get("manual_judgments"):
            console.print(f"  人工改判:")
            for j in rec["manual_judgments"]:
                console.print(
                    f"    - {j['judge_name']}: {j['judgment_result']} "
                    f"(行号: {j['raw_line_number']})"
                )
                console.print(f"      理由: {j['judgment_reason']}")


@cli.command()
def demo():
    """运行演示 - 使用示例数据"""

    console.print(Panel.fit(
        "[bold magenta]知识库失效链接追踪 - 演示模式[/bold magenta]\n"
        "将使用示例数据运行完整流程",
        border_style="magenta",
    ))

    model_file = Path("./sample_data/model_output.csv")
    judgment_file = Path("./sample_data/manual_judgments.csv")

    if not model_file.exists() or not judgment_file.exists():
        console.print("[red]示例数据文件不存在![/red]")
        sys.exit(1)

    console.print(f"模型输出文件: {model_file}")
    console.print(f"人工改判表: {judgment_file}")
    console.print()

    workflow = ThreeStepWorkflow(data_dir="./data")

    step1 = workflow.step1_import_model_output(str(model_file))
    print_step_header(1, "模型输出导入")
    console.print(f"导入了 {step1['imported_count']} 条记录")
    console.print(f"注意: FB001 和 FB002 是重复的 user_feedback_id")
    print_result_summary(step1)

    step2 = workflow.step2_supplement_manual_judgments(str(judgment_file), "周姐")
    print_step_header(2, "周姐补看人工改判表")
    console.print(f"更新了 {step2['updated_count']} 条记录")
    console.print("[cyan]补录后自动重算，重复记录保留待复核状态[/cyan]")
    print_result_summary(step2)

    duplicate_records = workflow.store.get_duplicate_feedback_records()
    review_decisions = {}
    for record in duplicate_records:
        if record.manual_judgments:
            last_judgment = record.manual_judgments[-1]
            judgment = last_judgment.judgment_result
            reason = last_judgment.judgment_reason
            keep = "剔除" not in judgment and "重复" not in judgment
            review_decisions[record.record_id] = {
                "keep": keep,
                "reason": f"周姐复核: {reason}",
            }

    step3 = workflow.step3_evidence_playback_update(review_decisions, "周姐")
    print_step_header(3, "证据回放更新")
    console.print(f"处理了 {len(review_decisions)} 条复核决定")
    print_result_summary(step3)

    export_files = workflow.export_results()
    state_file = export_files["state_pkl"]

    console.print(Panel.fit(
        "[bold green]演示完成![/bold green]\n\n"
        "接下来可以执行:\n"
        f"  [bold]查看所有重复分组:[/bold] kb-link-tracker replay -s {state_file} -d\n"
        f"  [bold]查看指定分组详情:[/bold] kb-link-tracker show-group -s {state_file} -g <group_id>\n"
        f"  [bold]查看单条证据链:[/bold] kb-link-tracker replay -s {state_file} -r <record_id>",
        border_style="green",
    ))


if __name__ == "__main__":
    cli()
