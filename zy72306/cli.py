#!/usr/bin/env python3
import typer
from pathlib import Path
from typing import Optional
import pandas as pd
import json

from src import DecompositionPipeline, AnomalyType, TimeSeriesAnomalyDecomposer

app = typer.Typer(help="时间序列异常分解工具 - 支持审计追踪、边界规则、三步流程")


@app.command()
def rules():
    """显示边界规则"""
    decomposer = TimeSeriesAnomalyDecomposer()
    decomposer.print_boundary_rules()


@app.command()
def step1(
    input_csv: str = typer.Argument(..., help="输入CSV文件路径"),
    output_dir: str = typer.Option("./output", help="输出目录"),
    actor: str = typer.Option("数据分析师小祁", help="操作人")
):
    """步骤1: 从旧公式截图导入数据"""
    typer.echo("=== 时间序列异常分解 - 步骤1: 导入数据 ===")

    pipeline = DecompositionPipeline()
    results = pipeline.step1_import_from_csv(
        filepath=input_csv,
        actor=actor
    )

    pipeline.print_summary()

    Path(output_dir).mkdir(parents=True, exist_ok=True)
    state_file = Path(output_dir) / "pipeline_state.json"
    with open(state_file, 'w') as f:
        json.dump({"current_step": pipeline.current_step}, f)

    typer.echo(f"\n状态已保存到: {state_file}")
    typer.echo("下一步: 使用 'step2' 添加老师批注")


@app.command()
def step2(
    comments_json: str = typer.Argument(..., help="老师批注JSON文件路径"),
    output_dir: str = typer.Option("./output", help="输出目录"),
    actor: str = typer.Option("数据分析师小祁", help="操作人")
):
    """步骤2: 数据分析师小祁补看老师批注"""
    typer.echo("=== 时间序列异常分解 - 步骤2: 添加老师批注 ===")

    with open(comments_json, 'r', encoding='utf-8') as f:
        comments = json.load(f)

    pipeline = DecompositionPipeline()

    state_file = Path(output_dir) / "pipeline_state.json"
    if state_file.exists():
        with open(state_file, 'r') as f:
            state = json.load(f)
            pipeline._current_step = state.get("current_step", 0)

    input_csv = Path(output_dir) / "timeseries_anomaly.csv"
    if input_csv.exists():
        pipeline.step1_import_from_csv(str(input_csv), actor=actor)

    count = pipeline.step2_add_teacher_comments(comments, actor=actor)
    pipeline.print_summary()

    with open(state_file, 'w') as f:
        json.dump({"current_step": pipeline.current_step}, f)

    typer.echo(f"添加了 {count} 条批注")
    typer.echo("下一步: 使用 'step3' 进行复核并最终确认")


@app.command()
def step3(
    output_dir: str = typer.Option("./output", help="输出目录"),
    review_json: Optional[str] = typer.Option(None, help="复核决策JSON文件"),
    actor: str = typer.Option("课堂演示", help="操作人")
):
    """步骤3: 课堂演示结果更新"""
    typer.echo("=== 时间序列异常分解 - 步骤3: 复核与最终确认 ===")

    pipeline = DecompositionPipeline()

    state_file = Path(output_dir) / "pipeline_state.json"
    if state_file.exists():
        with open(state_file, 'r') as f:
            state = json.load(f)
            pipeline._current_step = state.get("current_step", 0)

    if review_json and Path(review_json).exists():
        with open(review_json, 'r', encoding='utf-8') as f:
            review_decisions = json.load(f)
        pipeline.step3_review_records(review_decisions, actor="数据复核人")
        typer.echo("已应用复核决策")

    finalized = pipeline.step3_finalize_all(actor=actor)
    pipeline.print_summary()

    exported_files = pipeline.export_results(output_dir)

    typer.echo(f"\n最终确认了 {finalized} 条记录")
    typer.echo("\n导出文件:")
    for name, path in exported_files.items():
        typer.echo(f"  {name}: {path}")

    with open(state_file, 'w') as f:
        json.dump({"current_step": pipeline.current_step}, f)


@app.command()
def run(
    input_csv: str = typer.Argument(..., help="输入CSV文件路径"),
    comments_json: str = typer.Argument(..., help="老师批注JSON文件路径"),
    output_dir: str = typer.Option("./output", help="输出目录"),
    review_json: Optional[str] = typer.Option(None, help="复核决策JSON文件")
):
    """一键运行完整流水线: 导入→批注→复核→导出"""
    typer.echo("=== 时间序列异常分解 - 完整流水线 ===")

    pipeline = DecompositionPipeline()

    review_decisions = None
    if review_json and Path(review_json).exists():
        with open(review_json, 'r', encoding='utf-8') as f:
            review_decisions = json.load(f)

    with open(comments_json, 'r', encoding='utf-8') as f:
        comments = json.load(f)

    exported_files = pipeline.run_full_pipeline(
        input_csv=input_csv,
        comments=comments,
        output_dir=output_dir,
        review_decisions=review_decisions
    )

    pipeline.print_summary()

    typer.echo("\n可重跑命令:")
    typer.echo(f"  python cli.py run {input_csv} {comments_json} {output_dir}")


@app.command()
def audit(
    row_number: int = typer.Argument(..., help="行号"),
    output_dir: str = typer.Option("./output", help="输出目录")
):
    """查看指定行号的审计历史"""
    audit_file = Path(output_dir) / "timeseries_anomaly_audit_trail.json"

    if not audit_file.exists():
        typer.echo(f"审计文件不存在: {audit_file}")
        return

    with open(audit_file, 'r', encoding='utf-8') as f:
        audit_records = json.load(f)

    row_records = [r for r in audit_records if r['row_number'] == row_number]

    if not row_records:
        typer.echo(f"行号 {row_number} 没有审计记录")
        return

    typer.echo(f"\n行号 {row_number} 的审计历史:")
    typer.echo("-" * 60)
    for record in row_records:
        typer.echo(f"时间: {record['timestamp']}")
        typer.echo(f"操作: {record['action']}")
        typer.echo(f"操作人: {record['actor']}")
        typer.echo(f"状态: {record['old_status']} → {record['new_status']}")
        if record.get('comment'):
            typer.echo(f"备注: {record['comment']}")
        typer.echo("-" * 60)


@app.command()
def sample(
    output_dir: str = typer.Option("./examples", help="示例文件输出目录")
):
    """生成示例数据文件"""
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    sample_data = [
        {"row_number": 1, "timestamp": "2024-01-01", "metric_name": "转化率A", "numerator": 100, "denominator": 200},
        {"row_number": 2, "timestamp": "2024-01-01", "metric_name": "转化率B", "numerator": 50, "denominator": ""},
        {"row_number": 3, "timestamp": "2024-01-01", "metric_name": "转化率C", "numerator": 300, "denominator": "0"},
        {"row_number": 4, "timestamp": "2024-01-02", "metric_name": "转化率A", "numerator": 150, "denominator": 100},
        {"row_number": 5, "timestamp": "2024-01-02", "metric_name": "转化率B", "numerator": 80, "denominator": 400},
        {"row_number": 6, "timestamp": "2024-01-02", "metric_name": "转化率C", "numerator": 25, "denominator": ""},
        {"row_number": 7, "timestamp": "2024-01-03", "metric_name": "转化率A", "numerator": 90, "denominator": 180},
        {"row_number": 8, "timestamp": "2024-01-03", "metric_name": "转化率B", "numerator": 0, "denominator": 50},
    ]

    sample_csv = Path(output_dir) / "sample_input.csv"
    pd.DataFrame(sample_data).to_csv(sample_csv, index=False)
    typer.echo(f"示例输入: {sample_csv}")

    sample_comments = {
        "2": "分母为空需复核，可能是数据录入错误",
        "3": "分母为0但原始公式截图显示为空字符串",
        "6": "空值记录，待与数据源方确认"
    }
    comments_json = Path(output_dir) / "sample_comments.json"
    with open(comments_json, 'w', encoding='utf-8') as f:
        json.dump(sample_comments, f, ensure_ascii=False, indent=2)
    typer.echo(f"示例批注: {comments_json}")

    sample_review = {
        "2": {"review_note": "确认分母应为100，录入时遗漏", "final_anomaly_type": "normal"},
        "3": {"review_note": "分母为空字符串，按0处理，标记为异常", "final_anomaly_type": "abnormal"},
        "6": {"review_note": "数据缺失，无法计算，保留边界案例标记", "final_anomaly_type": "boundary_case"}
    }
    review_json = Path(output_dir) / "sample_review.json"
    with open(review_json, 'w', encoding='utf-8') as f:
        json.dump(sample_review, f, ensure_ascii=False, indent=2)
    typer.echo(f"示例复核: {review_json}")

    typer.echo("\n可重跑命令:")
    typer.echo(f"  python cli.py run {sample_csv} {comments_json} ./output --review-json {review_json}")


if __name__ == "__main__":
    app()
