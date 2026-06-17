import click
import json
import pandas as pd
from datetime import datetime
from pathlib import Path
from typing import List, Dict

from . import PROJECT_ROOT
from .models import (
    EvaluationLog,
    AnnotationRecord,
    AttributionResult,
    ThresholdConfig,
    ReviewAction,
    AttributionStatus,
)
from .attribution import ErrorAttributor, DataProcessor
from .conflict_manager import ConflictManager, ReviewManager
from .version_manager import VersionManager


@click.group()
def cli():
    """语音转写错词归因系统"""
    pass


@cli.command()
@click.option("--eval-log", "eval_log_file", help="评测日志文件名 (data/raw目录下)")
@click.option("--annotations", "annotations_file", help="标注表文件名 (data/raw目录下)")
@click.option("--threshold", "threshold_file", default=None, help="阈值配置文件名")
@click.option("--model-version", "model_version", required=True, help="模型版本")
@click.option("--description", default="", help="版本描述")
@click.option("--created-by", default="system", help="创建人")
def process(
    eval_log_file: str,
    annotations_file: str,
    threshold_file: str,
    model_version: str,
    description: str,
    created_by: str,
):
    """处理标注数据并生成归因结果"""
    processor = DataProcessor()

    click.echo("加载数据...")
    if eval_log_file:
        eval_logs = processor.load_evaluation_logs(eval_log_file)
        eval_log_map = {log.log_id: log for log in eval_logs}
        click.echo(f"  加载评测日志: {len(eval_logs)} 条")
    else:
        eval_log_map = {}
        click.echo("  未提供评测日志")

    annotations = processor.load_annotations(annotations_file)
    click.echo(f"  加载标注数据: {len(annotations)} 条")

    threshold_version = "default"
    if threshold_file:
        threshold_config = processor.load_threshold_config(threshold_file)
        threshold_version = threshold_config.version
    else:
        threshold_config = ThresholdConfig(version="default")

    click.echo(f"\n执行归因分析 (阈值版本: {threshold_version})...")
    attributor = ErrorAttributor(threshold_config)
    attributions, annotation_conflicts = attributor.batch_attribute(annotations, eval_log_map)
    click.echo(f"  生成归因结果: {len(attributions)} 条")
    if annotation_conflicts:
        click.echo(f"  标注间类型冲突: {len(annotation_conflicts)} 条")

    click.echo("\n检测冲突...")
    conflict_manager = ConflictManager()
    conflicts = conflict_manager.detect_conflicts(attributions, annotations, annotation_conflicts)
    click.echo(f"  发现冲突: {len(conflicts)} 条")

    click.echo("\n创建版本...")
    version_manager = VersionManager()
    version = version_manager.create_new_version(
        model_version=model_version,
        threshold_version=threshold_version,
        description=description,
        created_by=created_by,
    )
    click.echo(f"  版本号: {version}")

    click.echo("\n保存数据...")
    version_manager.save_version_data(
        version,
        "attributions",
        {"records": [a.to_dict() for a in attributions], "count": len(attributions)},
    )
    version_manager.save_version_data(
        version,
        "conflicts",
        {"records": [c.to_dict() for c in conflicts], "count": len(conflicts)},
    )

    click.echo("\n导出报告...")
    export_report(version, attributions, conflicts)

    click.echo("\n" + "=" * 50)
    click.echo("处理完成!")
    click.echo(f"  版本: {version}")
    click.echo(f"  归因结果: {len(attributions)} 条")
    click.echo(f"  冲突数量: {len(conflicts)} 条")
    click.echo(f"  数据目录: {version_manager.get_version_dir(version)}")


@cli.command("list-versions")
def list_versions():
    """列出所有版本"""
    version_manager = VersionManager()
    versions = version_manager.list_versions()

    if not versions:
        click.echo("暂无版本")
        return

    click.echo(f"{'版本':<15} {'模型版本':<15} {'创建时间':<25} {'状态':<10} {'描述'}")
    click.echo("-" * 80)
    for v in versions:
        click.echo(
            f"{v['version']:<15} {v['model_version']:<15} "
            f"{v['created_at'][:25]:<25} {v['status']:<10} {v['description']}"
        )


@cli.command("show-version")
@click.argument("version")
def show_version(version: str):
    """显示指定版本的详细信息"""
    version_manager = VersionManager()
    version_info = version_manager.get_version_info(version)

    if not version_info:
        click.echo(f"版本 {version} 不存在")
        return

    click.echo("版本信息:")
    for key, value in version_info.items():
        click.echo(f"  {key}: {value}")

    try:
        attributions_data = version_manager.load_version_data(version, "attributions")
        click.echo(f"\n归因结果: {attributions_data.get('count', 0)} 条")

        conflicts_data = version_manager.load_version_data(version, "conflicts")
        click.echo(f"冲突记录: {conflicts_data.get('count', 0)} 条")
    except FileNotFoundError:
        click.echo("\n数据不完整")


@cli.command("list-conflicts")
@click.argument("version")
@click.option("--unresolved-only", is_flag=True, help="只显示未解决的冲突")
def list_conflicts(version: str, unresolved_only: bool):
    """列出指定版本的冲突"""
    version_manager = VersionManager()

    try:
        conflicts_data = version_manager.load_version_data(version, "conflicts")
    except FileNotFoundError:
        click.echo(f"版本 {version} 的冲突数据不存在")
        return

    conflicts = conflicts_data.get("records", [])

    if unresolved_only:
        conflicts = [c for c in conflicts if not c.get("resolved", False)]

    if not conflicts:
        click.echo("没有冲突记录")
        return

    click.echo(f"{'冲突ID':<40} {'类型':<20} {'状态':<10} {'描述'}")
    click.echo("-" * 100)
    for c in conflicts:
        status = "未解决" if not c.get("resolved") else "已解决"
        click.echo(
            f"{c['conflict_id'][:38]:<40} {c['conflict_type']:<20} "
            f"{status:<10} {c['description'][:50]}"
        )


@cli.command("review")
@click.argument("version")
@click.option("--conflict-id", "conflict_id", help="冲突ID")
@click.option("--reviewer", required=True, help="审核人")
@click.option("--action", type=click.Choice(["confirm", "revise", "reject"]), required=True, help="审核动作")
@click.option("--notes", default="", help="审核备注")
@click.option("--final-type", "final_type", help="最终错误类型")
def review(
    version: str,
    conflict_id: str,
    reviewer: str,
    action: str,
    notes: str,
    final_type: str,
):
    """人工审核归因结果"""
    version_manager = VersionManager()

    try:
        attributions_data = version_manager.load_version_data(version, "attributions")
        conflicts_data = version_manager.load_version_data(version, "conflicts")
    except FileNotFoundError:
        click.echo(f"版本 {version} 的数据不存在")
        return

    attributions = [AttributionResult.from_dict(a) for a in attributions_data.get("records", [])]
    conflicts = conflicts_data.get("records", [])

    review_manager = ReviewManager()
    review_action = ReviewAction(action)

    target_attribution_id = None
    if conflict_id:
        for c in conflicts:
            if c["conflict_id"] == conflict_id:
                target_attribution_id = c["attribution_id"]
                c["resolved"] = True
                c["resolved_by"] = reviewer
                c["resolved_at"] = datetime.now().isoformat()
                c["resolution_notes"] = notes
                c["manual_attribution"] = final_type or c.get("auto_attribution")
                break

    for attr in attributions:
        if conflict_id:
            if attr.attribution_id == target_attribution_id:
                review_manager.review_attribution(
                    attr,
                    reviewer=reviewer,
                    action=review_action,
                    review_notes=notes,
                    revised_error_type=final_type,
                )
                click.echo(f"已审核: {attr.attribution_id}")
        else:
            review_manager.review_attribution(
                attr,
                reviewer=reviewer,
                action=review_action,
                review_notes=notes,
                revised_error_type=final_type,
            )

    version_manager.save_version_data(
        version,
        "attributions",
        {"records": [a.to_dict() for a in attributions], "count": len(attributions)},
    )
    version_manager.save_version_data(
        version,
        "conflicts",
        {"records": conflicts, "count": len(conflicts)},
    )

    export_report(version, attributions, conflicts)

    click.echo("审核完成")


@cli.command("export")
@click.argument("version")
@click.option("--format", "fmt", type=click.Choice(["csv", "json", "xlsx"]), default="csv", help="导出格式")
@click.option("--output", "output_file", help="输出文件名")
def export(version: str, fmt: str, output_file: str):
    """导出版本数据"""
    version_manager = VersionManager()

    try:
        attributions_data = version_manager.load_version_data(version, "attributions")
    except FileNotFoundError:
        click.echo(f"版本 {version} 的数据不存在")
        return

    records = attributions_data.get("records", [])

    if not output_file:
        output_file = f"attribution_report_{version}.{fmt}"

    output_path = Path(output_file)

    if fmt == "json":
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(records, f, ensure_ascii=False, indent=2)
    elif fmt == "csv":
        df = pd.DataFrame(records)
        df.to_csv(output_path, index=False, encoding="utf-8-sig")
    elif fmt == "xlsx":
        df = pd.DataFrame(records)
        df.to_excel(output_path, index=False)

    click.echo(f"已导出到: {output_path}")


@cli.command("summary")
@click.argument("version")
def summary(version: str):
    """显示版本统计摘要"""
    version_manager = VersionManager()

    try:
        attributions_data = version_manager.load_version_data(version, "attributions")
    except FileNotFoundError:
        click.echo(f"版本 {version} 的数据不存在")
        return

    attributions = [AttributionResult.from_dict(a) for a in attributions_data.get("records", [])]

    review_manager = ReviewManager()
    summary_data = review_manager.get_review_summary(attributions)

    click.echo("=" * 50)
    click.echo(f"版本 {version} 统计摘要")
    click.echo("=" * 50)
    click.echo(f"总记录数: {summary_data['total']}")
    click.echo(f"已审核: {summary_data['reviewed']} ({summary_data['review_rate']:.1%})")
    click.echo(f"自动归因: {summary_data['auto_attributed']}")
    click.echo(f"人工审核: {summary_data['manual_reviewed']}")
    click.echo(f"待处理: {summary_data['pending']}")
    click.echo("\n错误类型分布:")
    for et, count in sorted(summary_data["error_type_distribution"].items()):
        click.echo(f"  {et}: {count}")


def export_report(version: str, attributions, conflicts=None):
    """导出报告到版本目录"""
    version_manager = VersionManager()
    version_dir = version_manager.get_version_dir(version)

    if isinstance(attributions, list) and attributions and isinstance(attributions[0], AttributionResult):
        records = [a.to_dict() for a in attributions]
    else:
        records = attributions if isinstance(attributions, list) else []

    df = pd.DataFrame(records)
    cols = list(df.columns)
    if "result_error_type" in cols:
        idx = cols.index("result_error_type")
        if "error_type" in cols:
            cols.remove("error_type")
            cols.remove("result_error_type")
            cols.insert(idx - 1, "result_error_type")
            cols.insert(idx - 1, "error_type")
        df = df[cols]

    csv_path = version_dir / f"report_{version}.csv"
    df.to_csv(csv_path, index=False, encoding="utf-8-sig")

    conflict_count = len(conflicts) if conflicts else 0
    summary = {
        "version": version,
        "total_attributions": len(records),
        "total_conflicts": conflict_count,
        "generated_at": datetime.now().isoformat(),
    }

    summary_path = version_dir / "summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    cli()
