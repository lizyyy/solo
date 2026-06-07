import typer
from pathlib import Path
from typing import Optional
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .workflow import ReplayWorkflow

app = typer.Typer(
    name="rl-replay",
    help="强化学习奖励回放系统 - 处理特征缺失、服务复核、可解释摘要",
    no_args_is_help=True,
)
console = Console()


@app.command()
def init(
    output_dir: str = typer.Option("./examples", "--output", "-o", help="输出目录"),
):
    """生成示例 YAML 参数和评测切片模板"""
    from .yaml_parser import YamlParser
    import json
    from datetime import datetime, timedelta
    import random

    Path(output_dir).mkdir(parents=True, exist_ok=True)

    yaml_path = Path(output_dir) / "params.yaml"
    YamlParser().save_template(str(yaml_path))
    console.print(f"✅ 生成参数模板: [green]{yaml_path}[/green]")

    slices = []
    base_time = datetime.now() - timedelta(hours=5)
    for i in range(8):
        features = {
            "user_click_rate_7d": round(random.uniform(0.02, 0.15), 4),
            "user_order_rate_30d": round(random.uniform(0.005, 0.05), 4),
            "item_cvr": round(random.uniform(0.01, 0.08), 4),
            "item_price_level": random.randint(1, 5),
            "context_time_slot": random.choice(["morning", "afternoon", "evening", "night"]),
        }
        if i in (2, 5, 7):
            features["user_click_rate_7d"] = None
        if i == 5:
            features["user_order_rate_30d"] = None

        predicted = round(random.uniform(0.2, 0.8), 4)
        actual = predicted + round(random.uniform(-0.3, 0.3), 4)
        actual = max(0.0, min(1.0, actual))

        slices.append({
            "slice_id": f"slice_20260607_{i+1:03d}",
            "timestamp": (base_time + timedelta(minutes=i*30)).isoformat(),
            "features": features,
            "reward_score": round(actual, 4),
            "predicted_reward": round(predicted, 4),
            "context": {"user_id": f"user_{i:04d}", "item_id": f"item_{i:04d}"},
        })

    json_path = Path(output_dir) / "eval_slices.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({"slices": slices}, f, ensure_ascii=False, indent=2)
    console.print(f"✅ 生成评测切片示例: [green]{json_path}[/green]")

    console.print(Panel(
        "示例数据已生成！\n\n"
        "下一步试试:\n"
        "  rl-replay run --yaml examples/params.yaml --slices examples/eval_slices.json\n"
        "  rl-replay dashboard --yaml examples/params.yaml --slices examples/eval_slices.json -o dashboard.html",
        title="🚀 初始化完成",
        border_style="blue",
    ))


@app.command()
def run(
    yaml_path: str = typer.Option(..., "--yaml", "-y", help="参数 YAML 文件路径"),
    slices_path: str = typer.Option(..., "--slices", "-s", help="评测切片文件路径"),
    slice_type: str = typer.Option("json", "--type", "-t", help="切片文件类型: json/csv"),
    review_slice: Optional[str] = typer.Option(None, "--review", "-r", help="指定要复核的切片ID"),
    notes: str = typer.Option("", "--notes", "-n", help="小乔复核意见"),
):
    """运行完整工作流：导入YAML → 导入切片 → 小乔复核 → 摘要更新"""

    workflow = ReplayWorkflow()

    try:
        workflow.run_full_workflow(
            yaml_path=yaml_path,
            slice_path=slices_path,
            slice_file_type=slice_type,
            review_slice_id=review_slice,
            xiaoqiao_notes=notes,
        )
    except Exception as e:
        console.print(f"[red]❌ 运行出错: {e}[/red]")
        raise typer.Exit(1)


@app.command("step1")
def step1_import_yaml(
    yaml_path: str = typer.Argument(..., help="参数 YAML 文件路径"),
):
    """第一步：导入参数 YAML"""
    workflow = ReplayWorkflow()
    try:
        params, errors = workflow.step1_import_yaml(yaml_path)
        if errors:
            console.print(f"[yellow]⚠️  有 {len(errors)} 个警告，但继续执行[/yellow]")
    except Exception as e:
        console.print(f"[red]❌ 导入失败: {e}[/red]")
        raise typer.Exit(1)


@app.command("step2")
def step2_import_slices(
    yaml_path: str = typer.Option(..., "--yaml", "-y", help="参数 YAML 文件路径"),
    slices_path: str = typer.Argument(..., help="评测切片文件路径"),
    slice_type: str = typer.Option("json", "--type", "-t", help="切片文件类型: json/csv"),
):
    """第二步：导入评测切片并检测特征缺失"""
    workflow = ReplayWorkflow()
    try:
        workflow.step1_import_yaml(yaml_path)
        workflow.step2_import_slices(slices_path, slice_type)
    except Exception as e:
        console.print(f"[red]❌ 导入失败: {e}[/red]")
        raise typer.Exit(1)


@app.command("step3")
def step3_xiaoqiao_review(
    yaml_path: str = typer.Option(..., "--yaml", "-y", help="参数 YAML 文件路径"),
    slices_path: str = typer.Option(..., "--slices", "-s", help="评测切片文件路径"),
    slice_id: str = typer.Argument(..., help="要复核的切片ID"),
    notes: str = typer.Option("", "--notes", "-n", help="小乔复核意见"),
):
    """第三步：算法工程师小乔复核，更新可解释摘要"""
    workflow = ReplayWorkflow()
    try:
        workflow.step1_import_yaml(yaml_path)
        workflow.step2_import_slices(slices_path)
        workflow.step3_xiaoqiao_review(slice_id, notes)
    except Exception as e:
        console.print(f"[red]❌ 复核失败: {e}[/red]")
        raise typer.Exit(1)


@app.command()
def dashboard(
    yaml_path: str = typer.Option(..., "--yaml", "-y", help="参数 YAML 文件路径"),
    slices_path: str = typer.Option(..., "--slices", "-s", help="评测切片文件路径"),
    output: str = typer.Option("dashboard.html", "--output", "-o", help="输出HTML路径"),
    slice_type: str = typer.Option("json", "--type", "-t", help="切片文件类型: json/csv"),
):
    """生成交互式 3D 图表服务复核看板"""
    workflow = ReplayWorkflow()
    try:
        workflow.step1_import_yaml(yaml_path)
        workflow.step2_import_slices(slices_path, slice_type)
        output_path = workflow.generate_dashboard(output)
        console.print(f"\n✅ 看板已生成: [green]{output_path}[/green]")
        console.print("   用浏览器打开即可查看交互式图表，点击数据点可查看详情")
    except Exception as e:
        console.print(f"[red]❌ 生成失败: {e}[/red]")
        raise typer.Exit(1)


@app.command()
def list_missing(
    yaml_path: str = typer.Option(..., "--yaml", "-y", help="参数 YAML 文件路径"),
    slices_path: str = typer.Option(..., "--slices", "-s", help="评测切片文件路径"),
    slice_type: str = typer.Option("json", "--type", "-t", help="切片文件类型: json/csv"),
):
    """列出所有有特征缺失的评测切片"""
    workflow = ReplayWorkflow()
    try:
        workflow.step1_import_yaml(yaml_path)
        workflow.step2_import_slices(slices_path, slice_type)
        missing = workflow.get_slices_with_missing()

        if not missing:
            console.print("[green]✅ 所有切片特征完整，没有缺失问题[/green]")
            return

        table = Table(title=f"🔍 发现 {len(missing)} 条有特征缺失的切片", show_lines=True)
        table.add_column("切片ID", style="cyan")
        table.add_column("时间")
        table.add_column("缺失特征")
        table.add_column("实际奖励", justify="right")
        table.add_column("预测奖励", justify="right")
        table.add_column("下一步")
        table.add_column("负责人")

        for s in missing:
            summary = workflow.get_summary(s.slice_id)
            missing_feats = "\n".join(
                f"[red]{f.name}[/red] ({'有默认' if f.status.value == 'missing_with_default' else '无默认'})"
                for f in s.missing_features
            )
            table.add_row(
                s.slice_id,
                s.timestamp.strftime("%Y-%m-%d %H:%M"),
                missing_feats,
                f"{s.reward_score:.3f}",
                f"{s.predicted_reward:.3f}",
                summary.next_step[:40] + "..." if summary and len(summary.next_step) > 40 else summary.next_step if summary else "",
                summary.responsible_person.value if summary else "",
            )

        console.print(table)
        console.print("\n[yellow]💡 这些切片别急着归正常，先留给推荐负责人复核[/yellow]")

    except Exception as e:
        console.print(f"[red]❌ 查询失败: {e}[/red]")
        raise typer.Exit(1)


@app.command()
def summary(
    yaml_path: str = typer.Option(..., "--yaml", "-y", help="参数 YAML 文件路径"),
    slices_path: str = typer.Option(..., "--slices", "-s", help="评测切片文件路径"),
    slice_id: str = typer.Argument(..., help="切片ID"),
    slice_type: str = typer.Option("json", "--type", "-t", help="切片文件类型: json/csv"),
):
    """查看指定切片的可解释摘要"""
    workflow = ReplayWorkflow()
    try:
        workflow.step1_import_yaml(yaml_path)
        workflow.step2_import_slices(slices_path, slice_type)
        s = workflow.get_summary(slice_id)

        if not s:
            console.print(f"[red]❌ 未找到切片: {slice_id}[/red]")
            raise typer.Exit(1)

        console.print(Panel(
            Text.from_markup(
                f"[bold]为什么被留下:[/bold]\n{s.why_kept}\n\n"
                f"[bold]还缺什么材料:[/bold]\n" +
                "\n".join(f"  • {mat}" for mat in s.missing_materials) + "\n\n"
                f"[bold]下一步该找谁:[/bold] {s.next_step}\n"
                f"[bold]负责人:[/bold] [yellow]{s.responsible_person.value}[/yellow]\n\n"
                f"[bold]特征洞察:[/bold]\n" +
                "\n".join(f"  • {k}: {v}" for k, v in s.feature_insights.items()) + "\n\n"
                f"[bold]行动项:[/bold]\n" +
                "\n".join(f"  • [{a.responsible.value}] {a.description}" for a in s.action_items),
            ),
            title=f"📋 可解释摘要 - {slice_id}",
            border_style="blue",
        ))

    except Exception as e:
        console.print(f"[red]❌ 查询失败: {e}[/red]")
        raise typer.Exit(1)


def main():
    app()


if __name__ == "__main__":
    main()
