"""命令行入口"""
import click
import os
from .reviewer import MabBudgetReviewer


@click.group()
@click.option("--data-dir", default="./data", help="数据目录")
@click.option("--output-dir", default="./output", help="输出目录")
@click.pass_context
def cli(ctx, data_dir, output_dir):
    """多臂老虎机预算分流 - 异常复核工具"""
    ctx.ensure_object(dict)
    ctx.obj["reviewer"] = MabBudgetReviewer(data_dir, output_dir)


@cli.command()
@click.argument("csv_path")
@click.option("--operator", default="推荐策略老唐", help="操作人")
@click.pass_context
def import_candidates(ctx, csv_path, operator):
    """第一步：导入召回候选表 CSV"""
    reviewer = ctx.obj["reviewer"]
    if not os.path.exists(csv_path):
        click.echo(f"❌ 文件不存在: {csv_path}")
        return
    candidates = reviewer.step1_import_candidates(csv_path, operator)
    click.echo(f"✅ 成功导入 {len(candidates)} 条召回候选")
    for c in candidates[:3]:
        click.echo(f"   - {c.candidate_id}: {c.strategy_name} (CTR={c.ctr:.4f})")
    if len(candidates) > 3:
        click.echo(f"   ... 共 {len(candidates)} 条")


@cli.command()
@click.option("--yaml-path", default=None, help="参数YAML文件路径（补录用）")
@click.option("--operator", default="推荐策略老唐", help="操作人")
@click.pass_context
def load_params(ctx, yaml_path, operator):
    """第二步：加载/补录参数 YAML"""
    reviewer = ctx.obj["reviewer"]
    params = reviewer.step2_load_params(yaml_path, operator)
    if params:
        click.echo(f"✅ 参数配置已加载 (v{params.version})")
        click.echo(f"   时间窗口: {params.time_window_size_hours}h")
        click.echo(f"   最低曝光: {params.min_impression_threshold}")
        click.echo(f"   负责人: {params.owner}")
    else:
        click.echo("⚠️  未找到参数配置，请使用 --yaml-path 指定")


@cli.command()
@click.option("--operator", default="推荐策略老唐", help="操作人")
@click.pass_context
def detect(ctx, operator):
    """第三步：运行异常检测，生成报告"""
    reviewer = ctx.obj["reviewer"]
    anomalies = reviewer.step3_run_detection(operator)

    click.echo(f"🔍 检测完成，共发现 {len(anomalies)} 条异常:")
    for a in anomalies:
        type_label = {
            "time_window_cross": "⏰ 时间窗穿越",
            "ctr_outlier": "📈 CTR异常",
            "budget_overrun": "💰 预算预警"
        }.get(a.anomaly_type, a.anomaly_type)
        verified = "✅" if a.is_verified else "⏳"
        click.echo(f"   {verified} {a.sample_id}: {type_label} - {a.next_step_owner}")

    if any(a.anomaly_type == "time_window_cross" for a in anomalies):
        click.echo("\n⚠️  注意：存在「时间窗穿越」异常，效果可能虚高")
        click.echo("   不急着归正常，留给实验平台负责人复核")

    index_path = os.path.join(reviewer.reporter.output_dir, "index.html")
    click.echo(f"\n📄 报告已生成: {index_path}")


@cli.command()
@click.argument("sample_id")
@click.option("--operator", required=True, help="操作人")
@click.option("--notes", required=True, help="修正备注")
@click.option("--mark-verified", is_flag=True, help="标记为已复核")
@click.option("--next-owner", default=None, help="下一步负责人")
@click.option("--next-action", default=None, help="下一步行动")
@click.pass_context
def correct(ctx, sample_id, operator, notes, mark_verified, next_owner, next_action):
    """人工修正异常样本"""
    reviewer = ctx.obj["reviewer"]
    result = reviewer.manual_correct_anomaly(
        sample_id, operator, notes, mark_verified, next_owner, next_action
    )
    if result:
        click.echo(f"✅ 异常样本 {sample_id} 已更新")
        if mark_verified:
            click.echo("   已标记为已复核")
    else:
        click.echo(f"❌ 未找到样本 {sample_id}")


@cli.command()
@click.option("--operator", default="推荐策略老唐", help="操作人")
@click.pass_context
def rerun(ctx, operator):
    """重跑检测"""
    reviewer = ctx.obj["reviewer"]
    anomalies = reviewer.rerun_detection(operator)
    click.echo(f"🔄 重跑完成，共 {len(anomalies)} 条异常")


@cli.command()
@click.option("--port", default=5000, help="端口号")
@click.option("--host", default="127.0.0.1", help="监听地址")
@click.pass_context
def dashboard(ctx, port, host):
    """启动小看板（Web界面）"""
    from .dashboard import create_app
    reviewer = ctx.obj["reviewer"]
    app = create_app(reviewer)
    click.echo(f"🚀 小看板已启动: http://{host}:{port}")
    click.echo(f"   按 Ctrl+C 停止")
    app.run(host=host, port=port, debug=False)


@cli.command()
@click.option("--operator", default="推荐策略老唐", help="操作人")
@click.pass_context
def demo(ctx, operator):
    """运行完整演示流程（三步）"""
    reviewer = ctx.obj["reviewer"]
    demo_dir = os.path.join(os.path.dirname(__file__), "..", "data", "demo")

    click.echo("=" * 60)
    click.echo("🎰 多臂老虎机预算分流 - 演示流程")
    click.echo("=" * 60)

    click.echo("\n📌 第一步：导入召回候选表")
    csv_path = os.path.join(demo_dir, "recall_candidates.csv")
    candidates = reviewer.step1_import_candidates(csv_path, operator)
    click.echo(f"   导入 {len(candidates)} 条候选")

    click.echo("\n📌 第二步：补看参数 YAML")
    yaml_path = os.path.join(demo_dir, "params.yaml")
    params = reviewer.step2_load_params(yaml_path, operator)
    click.echo(f"   参数 v{params.version} 已加载")

    click.echo("\n📌 第三步：运行异常检测")
    anomalies = reviewer.step3_run_detection(operator)
    click.echo(f"   检出 {len(anomalies)} 条异常")
    for a in anomalies:
        if a.anomaly_type == "time_window_cross":
            click.echo(f"   ⏰ 时间窗穿越: {a.candidate_id if a.candidate else a.sample_id} -> 留给实验平台负责人复核")

    click.echo("\n📌 演示：一次人工修正")
    time_anomalies = [a for a in anomalies if a.anomaly_type == "time_window_cross"]
    if time_anomalies:
        sample = time_anomalies[0]
        reviewer.manual_correct_anomaly(
            sample.sample_id,
            operator="实验平台负责人",
            correction_notes="已确认该时间窗对应618大促跨天活动，数据已对齐，效果可信",
            mark_verified=True,
            next_step_owner="推荐策略老唐",
            next_step_action="可正常使用该条数据结论"
        )
        click.echo(f"   ✅ {sample.sample_id} 已由实验平台负责人复核通过")

    click.echo("\n📌 演示：一次重跑")
    reviewer.rerun_detection(operator)
    click.echo("   🔄 已基于最新状态重跑检测")

    index_path = os.path.join(reviewer.reporter.output_dir, "index.html")
    click.echo(f"\n🎉 演示完成！报告入口: {index_path}")
    click.echo("   运行 'mab-review dashboard' 可启动Web小看板")


def main():
    cli()


if __name__ == "__main__":
    main()
