from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional, Dict, Any

import click
import pandas as pd
from tabulate import tabulate

from .data_store import DataStore
from .resampler import ImbalanceResampler
from .workflow import WorkflowEngine
from .explanation import ExplanationGenerator
from .models import RecordStatus


@click.group()
@click.option("--data-dir", default="./data", help="数据存储目录")
@click.pass_context
def main(ctx: click.Context, data_dir: str):
    ctx.ensure_object(dict)
    ctx.obj["data_store"] = DataStore(base_dir=data_dir)
    ctx.obj["resampler"] = ImbalanceResampler()
    ctx.obj["workflow"] = WorkflowEngine(
        data_store=ctx.obj["data_store"],
        resampler=ctx.obj["resampler"],
    )
    ctx.obj["explanation"] = ExplanationGenerator()


@main.command()
@click.argument("input_file", type=click.Path(exists=True))
@click.option("--score-col", required=True, help="模型分列名")
@click.option("--label-col", help="真实标签列名")
@click.option("--created-by", default="ayue", help="创建人")
@click.option("--session-id", help="指定会话ID")
@click.pass_context
def import_snapshot(
    ctx: click.Context,
    input_file: str,
    score_col: str,
    label_col: Optional[str],
    created_by: str,
    session_id: Optional[str],
):
    """步骤1: 导入特征快照"""
    df = pd.read_csv(input_file)
    session = ctx.obj["workflow"].step1_import_snapshot(
        df=df,
        score_column=score_col,
        label_column=label_col,
        created_by=created_by,
        session_id=session_id,
    )
    click.echo(f"✅ 特征快照导入完成")
    click.echo(f"   会话ID: {session.session_id}")
    click.echo(f"   记录数: {len(session.records)}")
    click.echo(f"   可疑记录(特征缺失+默认分): {session.summary_stats.get('suspicious_default_score', 0)}")
    _print_status_distribution(session)


@main.command()
@click.argument("session_id")
@click.option("--decisions-file", type=click.Path(exists=True), help="决策JSON文件")
@click.option("--reviewer", default="ayue", help="审查人")
@click.pass_context
def review_logs(
    ctx: click.Context,
    session_id: str,
    decisions_file: Optional[str],
    reviewer: str,
):
    """步骤2: 阿越审查训练日志曲线"""
    if decisions_file:
        with open(decisions_file, "r", encoding="utf-8") as f:
            decisions = json.load(f)
    else:
        click.echo("📋 需要审查的可疑记录:")
        suspicious = ctx.obj["workflow"].get_suspicious_records_for_review(session_id)
        for rec in suspicious:
            click.echo(f"  {rec.record_id} | 行{rec.snapshot.original_line_number} | 缺失: {', '.join(rec.snapshot.missing_features)}")
        click.echo("\n请使用 --decisions-file 指定决策文件")
        return

    session = ctx.obj["workflow"].step2_ayue_review_training_logs(
        session_id=session_id,
        record_decisions=decisions,
        reviewer=reviewer,
    )
    click.echo(f"✅ 训练日志审查完成")
    click.echo(f"   会话ID: {session.session_id}")
    _print_status_distribution(session)


@main.command()
@click.argument("session_id")
@click.option("--explanations-file", type=click.Path(exists=True), help="摘要JSON文件")
@click.option("--auto-generate", is_flag=True, help="自动生成摘要")
@click.pass_context
def update_summary(
    ctx: click.Context,
    session_id: str,
    explanations_file: Optional[str],
    auto_generate: bool,
):
    """步骤3: 更新可解释摘要"""
    explanations = {}

    if auto_generate:
        session = ctx.obj["data_store"].load_session(session_id)
        for rec in session.records:
            explanations[rec.record_id] = {
                "summary": ctx.obj["explanation"].generate_summary(rec),
                "detail": ctx.obj["explanation"].generate_detail(rec),
                "update_note": "自动生成可解释摘要",
            }
    elif explanations_file:
        with open(explanations_file, "r", encoding="utf-8") as f:
            explanations = json.load(f)
    else:
        click.echo("请指定 --explanations-file 或 --auto-generate")
        return

    session = ctx.obj["workflow"].step3_update_explanation_summary(
        session_id=session_id,
        explanations=explanations,
    )
    click.echo(f"✅ 可解释摘要更新完成")
    click.echo(f"   会话ID: {session.session_id}")
    _print_status_distribution(session)


@main.command()
@click.argument("session_id")
@click.option("--decisions-file", type=click.Path(exists=True), required=True, help="决策JSON文件")
@click.option("--operator", default="recommend_leader", help="操作人")
@click.pass_context
def leader_review(
    ctx: click.Context,
    session_id: str,
    decisions_file: str,
    operator: str,
):
    """推荐负责人复核"""
    with open(decisions_file, "r", encoding="utf-8") as f:
        decisions = json.load(f)

    session = ctx.obj["workflow"].recommend_leader_review(
        session_id=session_id,
        record_decisions=decisions,
        operator=operator,
    )
    click.echo(f"✅ 推荐负责人复核完成")
    _print_status_distribution(session)


@main.command()
@click.argument("session_id")
@click.option("--record-id", required=True, help="记录ID")
@click.option("--to-audit-index", type=int, required=True, help="回滚到第几条审计记录")
@click.option("--reason", required=True, help="回滚原因")
@click.option("--operator", required=True, help="操作人")
@click.pass_context
def rollback(
    ctx: click.Context,
    session_id: str,
    record_id: str,
    to_audit_index: int,
    reason: str,
    operator: str,
):
    """回滚记录到指定状态"""
    session = ctx.obj["workflow"].rollback_record(
        session_id=session_id,
        record_id=record_id,
        to_audit_index=to_audit_index,
        operator=operator,
        reason=reason,
    )
    click.echo(f"✅ 回滚完成")
    click.echo(f"   原记录: {record_id}")
    click.echo(f"   回滚到审计记录: #{to_audit_index}")
    click.echo(f"   原因: {reason}")


@main.command("list")
@click.pass_context
def list_sessions(ctx: click.Context):
    """列出所有会话"""
    sessions = ctx.obj["data_store"].list_sessions()
    if not sessions:
        click.echo("暂无会话")
        return

    table = []
    for s in sessions:
        table.append([
            s["session_id"],
            s["created_at"],
            s["created_by"],
            s["record_count"],
        ])
    click.echo(tabulate(table, headers=["会话ID", "创建时间", "创建人", "记录数"], tablefmt="simple"))


@main.command()
@click.argument("session_id")
@click.option("--record-id", help="查看指定记录详情")
@click.option("--suspicious-only", is_flag=True, help="只看可疑记录")
@click.pass_context
def show(
    ctx: click.Context,
    session_id: str,
    record_id: Optional[str],
    suspicious_only: bool,
):
    """查看会话或记录详情"""
    if record_id:
        rec = ctx.obj["data_store"].get_record_detail(session_id, record_id)
        if rec is None:
            click.echo(f"❌ 记录 {record_id} 不存在")
            return
        detail = ctx.obj["explanation"].generate_detail(rec)
        click.echo(detail)
        return

    summary = ctx.obj["data_store"].get_session_summary(session_id)
    click.echo(f"📊 会话概览: {session_id}")
    click.echo(f"   创建时间: {summary['created_at']}")
    click.echo(f"   创建人: {summary['created_by']}")
    click.echo(f"   总记录数: {summary['total_records']}")
    click.echo(f"   可疑(特征缺失+默认分): {summary['suspicious_default_score_count']}")
    click.echo(f"\n状态分布:")
    for status, count in summary["status_distribution"].items():
        click.echo(f"   {status}: {count}")

    session = ctx.obj["data_store"].load_session(session_id)

    records = session.records
    if suspicious_only:
        records = [r for r in records if r.snapshot.used_default_score and r.snapshot.has_missing_features]

    click.echo(f"\n📋 记录列表 ({len(records)}条):")
    table = []
    for rec in records[:20]:
        table.append([
            rec.record_id,
            rec.snapshot.original_line_number,
            rec.current_status.value,
            rec.snapshot.model_score,
            "是" if rec.snapshot.used_default_score else "否",
            len(rec.snapshot.missing_features),
            rec.explanation_summary or "-",
        ])
    click.echo(tabulate(
        table,
        headers=["记录ID", "原始行号", "状态", "模型分", "用默认分", "缺失特征数", "摘要"],
        tablefmt="simple",
        maxcolwidths=[None, None, None, None, None, None, 40],
    ))
    if len(records) > 20:
        click.echo(f"... 还有 {len(records) - 20} 条记录")


@main.command()
@click.argument("session_id")
@click.option("--output", help="输出文件路径")
@click.option("--status", multiple=True, help="按状态过滤")
@click.pass_context
def export(
    ctx: click.Context,
    session_id: str,
    output: Optional[str],
    status: tuple,
):
    """导出记录为CSV"""
    status_filter = [RecordStatus(s) for s in status] if status else None
    output_path = ctx.obj["data_store"].export_to_csv(
        session_id=session_id,
        output_path=output,
        status_filter=status_filter,
    )
    click.echo(f"✅ 导出完成: {output_path}")


@main.command()
@click.argument("session_id")
@click.option("--label-col", required=True, help="标签列名")
@click.option("--operator", default="system", help="操作人")
@click.pass_context
def apply_weights(
    ctx: click.Context,
    session_id: str,
    label_col: str,
    operator: str,
):
    """应用重采样权重"""
    session = ctx.obj["data_store"].load_session(session_id)
    session = ctx.obj["resampler"].apply_resampling_weights(
        session=session,
        label_col=label_col,
        operator=operator,
    )
    ctx.obj["data_store"].save_session(session)
    click.echo(f"✅ 权重应用完成")


@main.command()
@click.pass_context
def boundary_rules(ctx: click.Context):
    """显示边界规则"""
    rules = ctx.obj["resampler"].get_boundary_rules()
    click.echo("📋 类别不平衡重采样 - 边界规则")
    click.echo("=" * 60)
    click.echo(json.dumps(rules, ensure_ascii=False, indent=2))


@main.command()
@click.option("--output-dir", default="./examples", help="输出目录")
@click.pass_context
def demo(ctx: click.Context, output_dir: str):
    """生成演示数据和完整流程脚本"""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    _generate_demo_data(output_path)
    _generate_demo_script(output_path)

    click.echo(f"✅ 演示数据和脚本已生成到 {output_dir}/")
    click.echo(f"   运行: cd {output_dir} && bash run_demo.sh")


def _print_status_distribution(session):
    click.echo("\n状态分布:")
    for status, count in session.summary_stats.get("by_status", {}).items():
        click.echo(f"   {status}: {count}")


def _generate_demo_data(output_path: Path):
    import numpy as np

    np.random.seed(42)
    n = 100

    data = {
        "feature_1": np.random.randn(n),
        "feature_2": np.random.randn(n),
        "feature_3": np.random.randn(n),
        "model_score": np.random.uniform(0, 1, n),
        "label": np.random.choice([0, 1], n, p=[0.8, 0.2]),
    }

    for i in [5, 12, 25, 37, 48]:
        data["feature_1"][i] = -999
        data["feature_2"][i] = -999
        data["model_score"][i] = 0.5

    for i in [60, 70, 80]:
        data["feature_3"][i] = -999

    df = pd.DataFrame(data)
    df.to_csv(output_path / "sample_features.csv", index=False)

    decisions = {
        f"rec_to_replace_1": {
            "curve_ok": True,
            "keep_suspicious": True,
            "note": "训练日志曲线正常，但特征缺失来源不明，留待推荐负责人确认",
        },
    }

    with open(output_path / "ayue_decisions.json", "w", encoding="utf-8") as f:
        json.dump(decisions, f, ensure_ascii=False, indent=2)

    leader_decisions = {
        f"rec_to_replace_2": {
            "confirm_normal": True,
            "note": "复核确认，特征缺失不影响判定",
        },
    }
    with open(output_path / "leader_decisions.json", "w", encoding="utf-8") as f:
        json.dump(leader_decisions, f, ensure_ascii=False, indent=2)


def _generate_demo_script(output_path: Path):
    script = """#!/bin/bash
set -e

echo "========================================="
echo "  类别不平衡重采样 - 完整流程演示"
echo "========================================="

SESSION_ID="demo_$(date +%Y%m%d_%H%M%S)"
echo "会话ID: $SESSION_ID"
echo ""

echo "步骤1: 导入特征快照"
echo "-------------------------"
resampler --data-dir ./work_data import-snapshot sample_features.csv \\
    --score-col model_score \\
    --label-col label \\
    --created-by ayue \\
    --session-id $SESSION_ID
echo ""

echo "查看会话概览"
resampler --data-dir ./work_data show $SESSION_ID
echo ""

echo "步骤2: (模拟)阿越审查训练日志"
echo "-------------------------"
echo "注意: 实际使用时需要先查看可疑记录，人工决策后生成 ayue_decisions.json"
echo ""

echo "步骤3: 自动生成可解释摘要"
echo "-------------------------"
resampler --data-dir ./work_data update-summary $SESSION_ID --auto-generate
echo ""

echo "应用重采样权重"
echo "-------------------------"
resampler --data-dir ./work_data apply-weights $SESSION_ID --label-col label
echo ""

echo "导出结果"
echo "-------------------------"
resampler --data-dir ./work_data export $SESSION_ID --output resample_result.csv
echo ""

echo "查看可疑记录详情"
echo "-------------------------"
resampler --data-dir ./work_data show $SESSION_ID --suspicious-only
echo ""

echo "========================================="
echo "  演示完成！"
echo "  数据目录: ./work_data"
echo "  导出文件: resample_result.csv"
echo "========================================="
"""
    with open(output_path / "run_demo.sh", "w", encoding="utf-8") as f:
        f.write(script)
    os.chmod(output_path / "run_demo.sh", 0o755)


@main.command()
@click.option("--host", default="0.0.0.0", help="监听地址")
@click.option("--port", default=5000, type=int, help="监听端口")
@click.option("--debug", is_flag=True, help="调试模式")
@click.pass_context
def serve(
    ctx: click.Context,
    host: str,
    port: int,
    debug: bool,
):
    """启动Web服务 - 页面入口和REST API"""
    from .webapp import run_server

    data_store = ctx.obj["data_store"]
    data_dir = str(data_store.base_dir)

    click.echo(f"🌐 类别不平衡重采样服务启动")
    click.echo(f"   数据目录: {data_dir}")
    click.echo(f"   页面地址: http://{host}:{port}/")
    click.echo(f"   API文档: http://{host}:{port}/api/boundary-rules")
    click.echo(f"   健康检查: http://{host}:{port}/health")
    click.echo("")
    click.echo("页面入口:")
    click.echo("  /                      会话列表")
    click.echo("  /sessions/<id>         会话详情(状态分布+记录列表)")
    click.echo("  /sessions/<id>/export  导出明细查看")
    click.echo("  /sessions/<id>/records/<rid>   单条记录详情(证据+留痕)")
    run_server(host=host, port=port, data_dir=data_dir, debug=debug)


if __name__ == "__main__":
    main()
