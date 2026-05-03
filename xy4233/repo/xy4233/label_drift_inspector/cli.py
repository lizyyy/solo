"""
主CLI入口 - 标注漂移体检员命令行工具
"""

import json
from pathlib import Path
from typing import Optional

import click

from . import __version__
from .auditor import AuditEngine
from .exporter import AuditPackageExporter
from .models import ReviewDecision
from .parser import (
    AnnotationParser,
    DataValidator,
    LabelSchemaParser,
    PredictionParser,
    SamplingFeedbackParser,
)
from .review_store import ReviewStore
from .sample_data import generate_sample_files


@click.group()
@click.version_option(version=__version__)
@click.pass_context
def cli(ctx):
    """
    标注漂移体检员 - 客服意图分类离线标注质量审计工具

    使用示例:
      ldi init ./sample_data
      ldi import --schema label_schema.yaml --annotations annotations.jsonl
      ldi audit --schema label_schema.yaml --annotations annotations.jsonl --predictions predictions.csv
      ldi review list
      ldi report --audit-id abc123def --output ./audit_report
    """
    ctx.ensure_object(dict)


@cli.command()
@click.argument("output_dir", type=click.Path(path_type=Path))
@click.option("--num-records", type=int, default=100, help="生成的标注记录数量")
@click.pass_context
def init(ctx, output_dir: Path, num_records: int):
    """
    生成示例数据文件

    OUTPUT_DIR: 输出目录路径

    生成的文件:
    - label_schema.yaml: 标签体系定义
    - annotations.jsonl: 标注员结果
    - predictions.csv: 模型预测结果
    - sampling_feedback.csv: 抽检反馈表
    """
    click.echo(f"正在生成示例数据到: {output_dir}")

    files = generate_sample_files(output_dir)

    click.echo("\n✅ 示例数据生成完成!")
    click.echo("\n生成的文件:")
    for name, path in files.items():
        click.echo(f"  - {name}: {path}")

    click.echo("\n下一步操作:")
    click.echo(f"  1. 校验数据: ldi import --schema {files['schema']} --annotations {files['annotations']}")
    click.echo(f"  2. 执行审计: ldi audit --schema {files['schema']} --annotations {files['annotations']} --predictions {files['predictions']}")


@cli.command("import")
@click.option("--schema", "schema_path", type=click.Path(exists=True, path_type=Path), required=True, help="标签体系YAML文件路径")
@click.option("--annotations", "annotations_path", type=click.Path(exists=True, path_type=Path), required=True, help="标注结果JSONL文件路径")
@click.option("--predictions", "predictions_path", type=click.Path(exists=True, path_type=Path), help="模型预测CSV文件路径(可选)")
@click.option("--feedback", "feedback_path", type=click.Path(exists=True, path_type=Path), help="抽检反馈CSV文件路径(可选)")
@click.option("--expected-version", type=str, help="期望的标签版本号")
@click.option("--json", "output_json", is_flag=True, help="以JSON格式输出结果")
@click.pass_context
def import_cmd(
    ctx,
    schema_path: Path,
    annotations_path: Path,
    predictions_path: Optional[Path] = None,
    feedback_path: Optional[Path] = None,
    expected_version: Optional[str] = None,
    output_json: bool = False,
):
    """
    校验数据字段和标签版本

    检查:
    - 字段完整性
    - 标签有效性
    - 版本匹配
    - 数据一致性
    """
    try:
        click.echo("正在解析数据...")

        schema = LabelSchemaParser.parse(schema_path)
        click.echo(f"标签体系: {schema.name} (版本: {schema.version})")

        version_valid, version_warnings = LabelSchemaParser.validate_version(schema, expected_version)
        if version_warnings:
            for w in version_warnings:
                click.echo(f"⚠️  {w}")

        annotations = AnnotationParser.parse_jsonl(annotations_path)
        click.echo(f"标注记录数: {len(annotations)}")

        predictions = None
        if predictions_path:
            predictions = PredictionParser.parse_csv(predictions_path)
            click.echo(f"预测记录数: {len(predictions)}")

        feedbacks = None
        if feedback_path:
            feedbacks = SamplingFeedbackParser.parse_csv(feedback_path)
            click.echo(f"抽检反馈数: {len(feedbacks)}")

        click.echo("\n正在校验...")

        validation_result = DataValidator.run_import_validation(
            annotations=annotations,
            schema=schema,
            predictions=predictions,
            feedbacks=feedbacks,
        )

        if output_json:
            output = {
                "is_valid": validation_result.is_valid,
                "total_records": validation_result.total_records,
                "valid_records": validation_result.valid_records,
                "invalid_records": validation_result.invalid_records,
                "errors": validation_result.errors,
                "warnings": validation_result.warnings,
                "schema_info": validation_result.schema_info,
            }
            click.echo(json.dumps(output, ensure_ascii=False, indent=2))
            return

        click.echo("\n" + "=" * 50)
        click.echo("校验结果")
        click.echo("=" * 50)

        click.echo(f"\n状态: {'✅ 通过' if validation_result.is_valid else '❌ 存在问题'}")
        click.echo(f"总记录数: {validation_result.total_records}")
        click.echo(f"有效记录: {validation_result.valid_records}")
        click.echo(f"无效记录: {validation_result.invalid_records}")

        if validation_result.warnings:
            click.echo(f"\n⚠️  警告 ({len(validation_result.warnings)} 个):")
            for i, w in enumerate(validation_result.warnings, 1):
                click.echo(f"  {i}. {w}")

        if validation_result.errors:
            click.echo(f"\n❌ 错误 ({len(validation_result.errors)} 个):")
            for i, e in enumerate(validation_result.errors[:10], 1):
                click.echo(f"  {i}. [{e['error_type']}] {e['details']} (session: {e['session_id']})")
            if len(validation_result.errors) > 10:
                click.echo(f"  ... 还有 {len(validation_result.errors) - 10} 个错误")

        if validation_result.schema_info:
            click.echo("\n📋 标签体系信息:")
            click.echo(f"  名称: {validation_result.schema_info['name']}")
            click.echo(f"  版本: {validation_result.schema_info['version']}")
            click.echo(f"  标签数: {validation_result.schema_info['label_count']}")
            click.echo(f"  标签: {', '.join(validation_result.schema_info['labels'][:5])}{'...' if len(validation_result.schema_info['labels']) > 5 else ''}")

        ctx.obj["schema"] = schema
        ctx.obj["annotations"] = annotations
        ctx.obj["predictions"] = predictions
        ctx.obj["feedbacks"] = feedbacks
        ctx.obj["validation_result"] = validation_result

    except Exception as e:
        click.echo(f"❌ 错误: {e}", err=True)
        raise click.Abort()


@cli.command()
@click.option("--schema", "schema_path", type=click.Path(exists=True, path_type=Path), required=True, help="标签体系YAML文件路径")
@click.option("--annotations", "annotations_path", type=click.Path(exists=True, path_type=Path), required=True, help="标注结果JSONL文件路径")
@click.option("--predictions", "predictions_path", type=click.Path(exists=True, path_type=Path), help="模型预测CSV文件路径")
@click.option("--feedback", "feedback_path", type=click.Path(exists=True, path_type=Path), help="抽检反馈CSV文件路径")
@click.option("--json", "output_json", is_flag=True, help="以JSON格式输出结果")
@click.pass_context
def audit(
    ctx,
    schema_path: Path,
    annotations_path: Path,
    predictions_path: Optional[Path] = None,
    feedback_path: Optional[Path] = None,
    output_json: bool = False,
):
    """
    执行质量审计分析

    分析内容:
    - 一致率计算
    - 混淆矩阵
    - 标注员漂移检测
    - 数据泄漏检测
    - 高风险样本识别
    """
    try:
        click.echo("🔍 开始审计分析...\n")

        schema = LabelSchemaParser.parse(schema_path)
        annotations = AnnotationParser.parse_jsonl(annotations_path)

        predictions = None
        if predictions_path:
            predictions = PredictionParser.parse_csv(predictions_path)

        feedbacks = None
        if feedback_path:
            feedbacks = SamplingFeedbackParser.parse_csv(feedback_path)

        click.echo("📊 正在计算一致率...")
        click.echo("📊 正在生成混淆矩阵...")
        click.echo("📊 正在检测标注员漂移...")
        click.echo("📊 正在检测数据泄漏...")
        click.echo("📊 正在识别高风险样本...\n")

        audit_result = AuditEngine.run_audit(
            annotations=annotations,
            schema=schema,
            predictions=predictions,
            feedbacks=feedbacks,
        )

        ctx.obj["audit_result"] = audit_result
        ctx.obj["schema"] = schema
        ctx.obj["annotations"] = annotations
        ctx.obj["predictions"] = predictions
        ctx.obj["feedbacks"] = feedbacks

        if output_json:
            output = {
                "audit_id": audit_result.audit_id,
                "schema_version": audit_result.schema_version,
                "audit_timestamp": audit_result.audit_timestamp.isoformat(),
                "summary": audit_result.summary,
                "warnings": audit_result.warnings,
            }
            click.echo(json.dumps(output, ensure_ascii=False, indent=2))
            return

        click.echo("=" * 60)
        click.echo("审计报告")
        click.echo("=" * 60)

        click.echo(f"\n审计ID: {audit_result.audit_id}")
        click.echo(f"审计时间: {audit_result.audit_timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
        click.echo(f"标签版本: {audit_result.schema_version}")

        summary = audit_result.summary
        click.echo("\n📈 数据概览:")
        click.echo(f"  总标注数: {summary.get('total_annotations', 0)}")
        click.echo(f"  标注员数量: {summary.get('unique_annotators', 0)}")
        click.echo(f"  会话数量: {summary.get('unique_sessions', 0)}")

        cm = audit_result.consistency_metrics
        click.echo("\n✅ 一致率分析:")
        click.echo(f"  整体一致率: {cm.overall_agreement:.2%}")
        if cm.cohen_kappa is not None:
            click.echo(f"  Cohen's Kappa: {cm.cohen_kappa:.4f}")

        if cm.per_label_agreement:
            min_agree = min(cm.per_label_agreement.values())
            max_agree = max(cm.per_label_agreement.values())
            click.echo(f"  标签一致率范围: {min_agree:.2%} ~ {max_agree:.2%}")

        if cm.per_annotator_agreement:
            min_anno = min(cm.per_annotator_agreement.values())
            max_anno = max(cm.per_annotator_agreement.values())
            click.echo(f"  标注员一致率范围: {min_anno:.2%} ~ {max_anno:.2%}")

        click.echo("\n⚠️  问题检测:")
        click.echo(f"  数据泄漏: {summary.get('data_leakage_count', 0)} 个会话")
        click.echo(f"  高风险样本: {summary.get('high_risk_sample_count', 0)} 个")
        click.echo(f"  漂移标注员: {summary.get('annotator_drift_count', 0)} 个")

        if audit_result.warnings:
            click.echo("\n🚨 警告信息:")
            for i, w in enumerate(audit_result.warnings, 1):
                click.echo(f"  {i}. {w}")

        if audit_result.annotator_drifts:
            click.echo("\n👤 标注员漂移详情 (Top 5):")
            for i, drift in enumerate(audit_result.annotator_drifts[:5], 1):
                unusual = ", ".join(drift["unusual_labels"]) if drift["unusual_labels"] else "无"
                click.echo(
                    f"  {i}. {drift['annotator_id']}: 漂移分数={drift['drift_score']:.4f}, "
                    f"JS散度={drift['js_divergence']:.4f}, 异常标签={unusual}"
                )

        if audit_result.high_risk_samples:
            click.echo("\n🔴 高风险样本详情 (Top 5):")
            for i, sample in enumerate(audit_result.high_risk_samples[:5], 1):
                click.echo(f"  {i}. 记录ID: {sample['record_id']}")
                click.echo(f"     会话ID: {sample['session_id']}")
                click.echo(f"     风险分数: {sample['risk_score']:.2f}")
                click.echo(f"     文本: {sample['text'][:50]}...")
                for factor in sample["risk_factors"]:
                    click.echo(f"     - {factor}")
                click.echo()

        click.echo("\n💡 下一步:")
        click.echo(f"  使用 'ldi report --audit-id {audit_result.audit_id} --output ./audit_report' 导出完整报告")
        click.echo(f"  使用 'ldi review add' 添加复核记录")

    except Exception as e:
        click.echo(f"❌ 错误: {e}", err=True)
        raise click.Abort()


@cli.group()
@click.pass_context
def review(ctx):
    """
    复核记录管理命令

    子命令:
      list   - 列出复核记录
      add    - 添加复核记录
      update - 更新复核状态
      stats  - 查看复核统计
    """
    pass


@review.command("list")
@click.option("--store", "store_path", type=click.Path(path_type=Path), default="./review_store.json", help="复核存储文件路径")
@click.option("--status", type=click.Choice(["pending", "agree", "disagree", "need_relabel"]), help="按状态筛选")
@click.option("--json", "output_json", is_flag=True, help="以JSON格式输出")
@click.pass_context
def review_list(
    ctx,
    store_path: Path,
    status: Optional[str] = None,
    output_json: bool = False,
):
    """
    列出复核记录
    """
    store = ReviewStore(store_path)
    reviews = store.list_all(status)

    if output_json:
        output = {
            "total": len(reviews),
            "reviews": [r.to_dict() for r in reviews],
        }
        click.echo(json.dumps(output, ensure_ascii=False, indent=2))
        return

    stats = store.get_statistics()
    click.echo(f"总复核数: {stats['total_reviews']}")
    click.echo(f"待处理: {stats['pending']}, 已完成: {stats['completed']}")

    if stats.get("by_decision"):
        click.echo("\n状态分布:")
        for status, count in stats["by_decision"].items():
            click.echo(f"  {status}: {count}")

    if reviews:
        click.echo(f"\n记录列表 (共 {len(reviews)} 条):")
        for i, r in enumerate(reviews[:20], 1):
            turn_info = f" (turn: {r.turn_id})" if r.turn_id else ""
            click.echo(
                f"  {i}. [{r.record_id}] session: {r.session_id}{turn_info}, "
                f"状态: {r.decision.value}, 标注: {r.annotation.label}"
            )
        if len(reviews) > 20:
            click.echo(f"  ... 还有 {len(reviews) - 20} 条记录")


@review.command("add")
@click.option("--store", "store_path", type=click.Path(path_type=Path), default="./review_store.json", help="复核存储文件路径")
@click.option("--session-id", required=True, help="会话ID")
@click.option("--text", required=True, help="文本内容")
@click.option("--label", required=True, help="标注标签")
@click.option("--annotator-id", help="标注员ID")
@click.option("--notes", default="", help="备注")
@click.pass_context
def review_add(
    ctx,
    store_path: Path,
    session_id: str,
    text: str,
    label: str,
    annotator_id: Optional[str] = None,
    notes: str = "",
):
    """
    添加复核记录
    """
    from datetime import datetime
    from .models import AnnotationRecord, SplitType

    annotation = AnnotationRecord(
        session_id=session_id,
        turn_id=None,
        text=text,
        label=label,
        annotator_id=annotator_id or "unknown",
        annotated_at=datetime.now(),
        split=SplitType.UNKNOWN,
    )

    store = ReviewStore(store_path)
    review = store.add_review(annotation=annotation)

    click.echo(f"✅ 复核记录已添加")
    click.echo(f"记录ID: {review.record_id}")
    click.echo(f"会话ID: {review.session_id}")
    click.echo(f"当前状态: {review.decision.value}")


@review.command("update")
@click.option("--store", "store_path", type=click.Path(path_type=Path), default="./review_store.json", help="复核存储文件路径")
@click.option("--record-id", required=True, help="复核记录ID")
@click.option("--decision", type=click.Choice(["agree", "disagree", "need_relabel"]), required=True, help="复核决定")
@click.option("--final-label", help="最终标签")
@click.option("--notes", default="", help="备注")
@click.option("--reviewer", help="复核人ID")
@click.pass_context
def review_update(
    ctx,
    store_path: Path,
    record_id: str,
    decision: str,
    final_label: Optional[str] = None,
    notes: str = "",
    reviewer: Optional[str] = None,
):
    """
    更新复核状态
    """
    decision_enum = ReviewDecision(decision)

    store = ReviewStore(store_path)
    review = store.update_decision(
        record_id=record_id,
        decision=decision_enum,
        final_label=final_label,
        notes=notes,
        reviewed_by=reviewer,
    )

    if review:
        click.echo(f"✅ 复核记录已更新")
        click.echo(f"记录ID: {review.record_id}")
        click.echo(f"状态: {review.decision.value}")
        if review.final_label:
            click.echo(f"最终标签: {review.final_label}")
    else:
        click.echo(f"❌ 未找到记录ID: {record_id}")


@review.command("stats")
@click.option("--store", "store_path", type=click.Path(path_type=Path), default="./review_store.json", help="复核存储文件路径")
@click.option("--json", "output_json", is_flag=True, help="以JSON格式输出")
@click.pass_context
def review_stats(ctx, store_path: Path, output_json: bool = False):
    """
    查看复核统计
    """
    store = ReviewStore(store_path)
    stats = store.get_statistics()

    if output_json:
        click.echo(json.dumps(stats, ensure_ascii=False, indent=2))
        return

    click.echo("=" * 40)
    click.echo("复核统计")
    click.echo("=" * 40)
    click.echo(f"\n总复核数: {stats['total_reviews']}")
    click.echo(f"待处理: {stats['pending']}")
    click.echo(f"已完成: {stats['completed']}")

    if stats.get("by_decision"):
        click.echo("\n状态分布:")
        for status, count in sorted(stats["by_decision"].items()):
            percentage = count / stats["total_reviews"] * 100 if stats["total_reviews"] > 0 else 0
            click.echo(f"  {status}: {count} ({percentage:.1f}%)")


@cli.command()
@click.option("--audit-id", help="审计ID(如未指定则重新执行审计)")
@click.option("--output", "output_dir", type=click.Path(path_type=Path), required=True, help="输出目录路径")
@click.option("--schema", "schema_path", type=click.Path(exists=True, path_type=Path), help="标签体系YAML文件路径")
@click.option("--annotations", "annotations_path", type=click.Path(exists=True, path_type=Path), help="标注结果JSONL文件路径")
@click.option("--predictions", "predictions_path", type=click.Path(exists=True, path_type=Path), help="模型预测CSV文件路径")
@click.option("--feedback", "feedback_path", type=click.Path(exists=True, path_type=Path), help="抽检反馈CSV文件路径")
@click.option("--review-store", "review_store_path", type=click.Path(path_type=Path), help="复核存储文件路径")
@click.pass_context
def report(
    ctx,
    audit_id: Optional[str] = None,
    output_dir: Optional[Path] = None,
    schema_path: Optional[Path] = None,
    annotations_path: Optional[Path] = None,
    predictions_path: Optional[Path] = None,
    feedback_path: Optional[Path] = None,
    review_store_path: Optional[Path] = None,
):
    """
    导出审计报告包

    生成包含以下内容的报告包:
    - Markdown格式审计报告
    - JSON格式详细数据
    - CSV格式统计表格(混淆矩阵、高风险样本等)
    """
    try:
        audit_result = ctx.obj.get("audit_result")

        if audit_result is None:
            if not schema_path or not annotations_path:
                click.echo("❌ 需要提供 --schema 和 --annotations 参数, 或先运行 'ldi audit' 命令")
                raise click.Abort()

            click.echo("🔍 执行审计分析...")
            schema = LabelSchemaParser.parse(schema_path)
            annotations = AnnotationParser.parse_jsonl(annotations_path)

            predictions = None
            if predictions_path:
                predictions = PredictionParser.parse_csv(predictions_path)

            feedbacks = None
            if feedback_path:
                feedbacks = SamplingFeedbackParser.parse_csv(feedback_path)

            audit_result = AuditEngine.run_audit(
                annotations=annotations,
                schema=schema,
                predictions=predictions,
                feedbacks=feedbacks,
            )

        reviews = None
        if review_store_path and review_store_path.exists():
            store = ReviewStore(review_store_path)
            reviews = store.list_all()

        click.echo(f"📄 正在导出报告到: {output_dir}")

        exported = AuditPackageExporter.export_package(
            audit_result=audit_result,
            output_dir=output_dir,
            reviews=reviews,
        )

        click.echo("\n✅ 报告导出完成!")
        click.echo("\n生成的文件:")
        for name, path in exported.items():
            click.echo(f"  - {name}: {path}")

        click.echo(f"\n审计ID: {audit_result.audit_id}")

    except Exception as e:
        click.echo(f"❌ 错误: {e}", err=True)
        raise click.Abort()


if __name__ == "__main__":
    cli()
