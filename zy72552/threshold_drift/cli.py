import json
import os
import click
from .models import BucketConfig, Status
from .detector import BucketDriftDetector
from .data_import import DataImporter
from .experiment import ExperimentManager
from .visualization import Visualizer


@click.group()
def cli():
    """异常检测阈值漂移分析系统."""
    pass


@cli.command()
@click.option("--input", "-i", required=True, help="负样本CSV/JSON路径")
@click.option("--boundaries", "-b", default="0.3,0.5,0.7,0.9", help="分桶边界，逗号分隔")
@click.option("--output", "-o", default="drift_report.json", help="输出报告路径")
def detect(input, boundaries, output):
    """检测离线和线上分桶差异."""
    boundary_list = [float(x.strip()) for x in boundaries.split(",")]
    bucket_config = BucketConfig(boundaries=boundary_list)
    detector = BucketDriftDetector(bucket_config)

    if input.endswith(".csv"):
        samples_data = DataImporter.load_negative_samples_from_csv(input)
    elif input.endswith(".json"):
        samples_data = DataImporter.load_negative_samples_from_json(input)
    else:
        click.echo("不支持的文件格式，请使用CSV或JSON")
        return

    samples, records = detector.batch_detect(samples_data)
    exp_manager = ExperimentManager()
    exp = exp_manager.create_experiment(
        name=f"检测_{os.path.basename(input)}",
        drift_records=records,
    )

    report = exp_manager.generate_report(exp.experiment_id)

    with open(output, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2, default=str)

    click.echo(f"✅ 检测完成，共 {len(records)} 条记录")
    click.echo(f"   差1桶: {report['one_bucket_diff_count']} 条")
    click.echo(f"   差多桶: {report['multi_bucket_diff_count']} 条")
    click.echo(f"   报告已保存到: {output}")
    click.echo(f"   实验ID: {exp.experiment_id}")


@cli.command()
@click.option("--experiment", "-e", required=True, help="实验ID")
@click.option("--candidates", "-c", required=True, help="召回候选表CSV路径")
@click.option("--report", "-r", default="drift_report.json", help="现有报告路径")
def supplement(experiment, candidates, report):
    """补录召回候选表并更新实验对比."""
    if not os.path.exists(report):
        click.echo("❌ 报告文件不存在，请先运行 detect 命令")
        return

    with open(report, "r", encoding="utf-8") as f:
        report_data = json.load(f)

    candidate_list = DataImporter.load_recall_candidates_from_csv(candidates)
    click.echo(f"📥 加载了 {len(candidate_list)} 条召回候选")

    exp_manager = ExperimentManager()
    exp = exp_manager.load_experiment_from_report(report_data)

    exp.drift_records = DataImporter.supplement_recall_candidates(
        exp.drift_records, candidate_list
    )

    new_report = exp_manager.generate_report(experiment)
    with open(report, "w", encoding="utf-8") as f:
        json.dump(new_report, f, ensure_ascii=False, indent=2, default=str)

    supplemented = sum(
        1 for d in new_report["details"] if d["recall_candidates_count"] > 0
    )
    click.echo(f"✅ 已为 {supplemented} 条记录补录召回候选")
    click.echo(f"   实验对比已更新，报告已保存到: {report}")


@cli.command()
@click.option("--experiment", "-e", required=True, help="实验ID")
@click.option("--record", "-r", required=True, help="记录ID")
@click.option(
    "--status",
    "-s",
    type=click.Choice([s.value for s in Status]),
    required=True,
    help="更新状态",
)
@click.option("--notes", "-n", default="", help="复核备注")
@click.option("--reviewer", "-w", default="评测运营", help="复核人")
@click.option("--report", "-rp", default="drift_report.json", help="报告路径")
def review(experiment, record, status, notes, reviewer, report):
    """评测运营复核记录."""
    if not os.path.exists(report):
        click.echo("❌ 报告文件不存在")
        return

    with open(report, "r", encoding="utf-8") as f:
        report_data = json.load(f)

    exp_manager = ExperimentManager()
    exp = exp_manager.load_experiment_from_report(report_data)

    updated = exp_manager.update_record_status(
        experiment, record, Status(status), notes, reviewer
    )

    if updated:
        new_report = exp_manager.generate_report(experiment)
        with open(report, "w", encoding="utf-8") as f:
            json.dump(new_report, f, ensure_ascii=False, indent=2, default=str)
        click.echo(f"✅ 记录 {record} 状态已更新为 {status}")
        if notes:
            click.echo(f"   备注: {notes}")
    else:
        click.echo("❌ 未找到对应记录")


@cli.command()
@click.option("--report", "-r", default="drift_report.json", help="报告路径")
@click.option("--boundaries", "-b", default="0.3,0.5,0.7,0.9", help="分桶边界")
@click.option("--output", "-o", default="dashboard.html", help="输出HTML看板路径")
def dashboard(report, boundaries, output):
    """生成可视化看板."""
    if not os.path.exists(report):
        click.echo("❌ 报告文件不存在，请先运行 detect 命令")
        return

    with open(report, "r", encoding="utf-8") as f:
        report_data = json.load(f)

    exp_manager = ExperimentManager()
    exp = exp_manager.load_experiment_from_report(report_data)

    boundary_list = [float(x.strip()) for x in boundaries.split(",")]
    bucket_config = BucketConfig(boundaries=boundary_list)
    visualizer = Visualizer(bucket_config)
    visualizer.generate_html_dashboard(exp.drift_records, output)

    click.echo(f"✅ 可视化看板已生成: {output}")
    click.echo(f"   用浏览器打开即可查看3D图表和交互式分析")


@cli.command()
@click.option("--port", "-p", default=5000, help="Web服务端口")
def web(port):
    """启动Web小看板服务."""
    from .web_app import create_app

    app = create_app()
    click.echo(f"🌐 启动Web看板服务: http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)


if __name__ == "__main__":
    cli()
