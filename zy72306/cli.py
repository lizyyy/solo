#!/usr/bin/env python3
import typer
from pathlib import Path
from typing import Optional
import pandas as pd
import json

from src import (
    DecompositionPipeline,
    AnomalyType,
    TimeSeriesAnomalyDecomposer,
    StateStore,
    ReviewRecord,
)

app = typer.Typer(help="时间序列异常分解 - 统一StateStore数据闭环版")


# ============== 辅助 ==============
def _load_pipeline(workdir: str) -> DecompositionPipeline:
    return DecompositionPipeline(workdir=workdir)


# ============== 1. 边界规则 ==============
@app.command("rules")
def show_rules():
    """显示边界规则（代码+文档同源）"""
    decomposer = TimeSeriesAnomalyDecomposer()
    decomposer.print_boundary_rules()


# ============== 2. 示例数据 ==============
@app.command("sample")
def make_sample(
    output_dir: str = typer.Option("./examples", help="示例输出目录"),
    with_excel: bool = typer.Option(True, help="同时生成 .xlsx 示例（覆盖多源导入场景）"),
):
    """生成多源示例：sample_input.csv + sample_input.xlsx + 批注/复核JSON"""
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    sample_data = [
        {"row_number": 1, "timestamp": "2024-01-01", "metric_name": "转化率A", "numerator": 100, "denominator": 200},
        {"row_number": 2, "timestamp": "2024-01-01", "metric_name": "转化率B", "numerator": 50,  "denominator": ""},  # 分母为0填空字符串
        {"row_number": 3, "timestamp": "2024-01-01", "metric_name": "转化率C", "numerator": 300, "denominator": "0"}, # 分母为0字符串
        {"row_number": 4, "timestamp": "2024-01-02", "metric_name": "转化率A", "numerator": 150, "denominator": 100},
        {"row_number": 5, "timestamp": "2024-01-02", "metric_name": "转化率B", "numerator": 80,  "denominator": 400},
        {"row_number": 6, "timestamp": "2024-01-02", "metric_name": "转化率C", "numerator": 25,  "denominator": ""},  # 分母为0填空字符串
        {"row_number": 7, "timestamp": "2024-01-03", "metric_name": "转化率A", "numerator": 90,  "denominator": 180},
        {"row_number": 8, "timestamp": "2024-01-03", "metric_name": "转化率B", "numerator": 0,   "denominator": 50},
    ]
    df = pd.DataFrame(sample_data)

    sample_csv = Path(output_dir) / "sample_input.csv"
    df.to_csv(sample_csv, index=False)
    typer.echo(f"[CSV]    {sample_csv}")

    if with_excel:
        sample_xlsx = Path(output_dir) / "sample_input.xlsx"
        with pd.ExcelWriter(sample_xlsx, engine="openpyxl") as writer:
            df.to_excel(writer, sheet_name="Sheet1", index=False)
        # 生成中文列名版本
        df_cn = df.rename(columns={
            "row_number": "行号",
            "timestamp": "日期",
            "metric_name": "指标名称",
            "numerator": "分子",
            "denominator": "分母",
        })
        sample_xlsx_cn = Path(output_dir) / "sample_input_cn.xlsx"
        with pd.ExcelWriter(sample_xlsx_cn, engine="openpyxl") as writer:
            df_cn.to_excel(writer, sheet_name="数据表", index=False)
        typer.echo(f"[Excel]  {sample_xlsx}（标准列名）")
        typer.echo(f"[Excel]  {sample_xlsx_cn}（中文列名，演示字段别名归一）")

    sample_comments = {
        2: "分母为空需复核，可能是数据录入错误，见旧公式截图 screenshot_002",
        3: "分母为0但原始公式截图显示为空字符串，和老师批注冲突，留待复核人",
        6: "空值记录，待与数据源方确认是否该补为100",
    }
    comments_json = Path(output_dir) / "sample_comments.json"
    with open(comments_json, "w", encoding="utf-8") as f:
        json.dump({str(k): v for k, v in sample_comments.items()}, f, ensure_ascii=False, indent=2)
    typer.echo(f"[批注]   {comments_json}")

    sample_review = {
        2: {
            "reviewed_by": "数据复核人-张",
            "original_statement": "公式截图中分母格为空，老师批注说'漏填了100'",
            "corrected_value": "100",
            "review_reason": "对比旧公式截图和老师批注，以老师批注为准，分母漏填",
            "next_owner": "数据分析师小祁确认改后数",
            "review_note": "按老师批注补填，标记normal",
            "final_anomaly_type": "normal",
        },
        3: {
            "reviewed_by": "数据复核人-张",
            "original_statement": "分母原始显示为空字符串，数值是0",
            "corrected_value": "0",
            "review_reason": "空字符串就是0，按0处理，不提前归normal，按异常记",
            "next_owner": "课堂演示环节重点说明",
            "review_note": "保持abnormal，用于课堂讲解",
            "final_anomaly_type": "abnormal",
        },
        6: {
            "reviewed_by": "数据复核人-张",
            "original_statement": "旧截图中该行为空，老师批注'数据源方确认'",
            "corrected_value": "",
            "review_reason": "数据源方还没回复，继续挂待验证，不提前归normal",
            "next_owner": "下周找数据源方追数",
            "review_note": "继续pending_verification，不finalize",
            "final_anomaly_type": "pending_verification",
        },
    }
    review_json = Path(output_dir) / "sample_review.json"
    with open(review_json, "w", encoding="utf-8") as f:
        json.dump({str(k): v for k, v in sample_review.items()}, f, ensure_ascii=False, indent=2)
    typer.echo(f"[复核]   {review_json}")

    typer.echo("\n可重跑命令:")
    typer.echo(f"  python3 cli.py import {sample_csv} --workdir ./output")
    typer.echo(f"  python3 cli.py comment {comments_json} --workdir ./output")
    typer.echo(f"  python3 cli.py review-file {review_json} --workdir ./output")
    typer.echo(f"  python3 cli.py finalize --workdir ./output")
    typer.echo(f"  python3 cli.py verify 2 --workdir ./output    # 一致性检查:列表/详情/摘要/导出是否同一份")


# ============== 3. 步骤1：导入（支持多源） ==============
@app.command("import")
def step1_import(
    input_file: str = typer.Argument(..., help="输入文件：.csv / .xlsx / .xls，任一均可"),
    workdir: str = typer.Option("./output", help="统一StateStore工作目录"),
    actor: str = typer.Option("数据分析师小祁", help="操作人"),
):
    """步骤1：从CSV/Excel（多源）导入，字段归一后写入StateStore"""
    typer.echo("=== 步骤1 多源导入（CSV/Excel 字段归一）===")
    pipeline = _load_pipeline(workdir)
    pipeline.step1_import_from_file(input_file, actor=actor)
    pipeline.print_summary()
    report = pipeline.consistency_report()
    typer.echo(f"\n一致性检查（列表/详情/摘要/导出）: {'PASS' if report['ok'] else 'FAIL'}")
    typer.echo(f"State 版本: {report['snapshot']['version']}  记录数: {report['snapshot']['result_count']}")


# ============== 4. 步骤2：添加老师批注 ==============
@app.command("comment")
def step2_comment(
    comments_json: str = typer.Argument(..., help="老师批注JSON文件，键是行号字符串，值是批注内容"),
    workdir: str = typer.Option("./output", help="统一StateStore工作目录"),
    actor: str = typer.Option("数据分析师小祁", help="操作人"),
):
    """步骤2：数据分析师小祁补看老师批注，进入pending_review（分母0空字符串不提前归normal）"""
    typer.echo("=== 步骤2 补看老师批注（写入StateStore同一份数据）===")
    with open(comments_json, "r", encoding="utf-8") as f:
        raw = json.load(f)
    comments = {int(k): v for k, v in raw.items()}
    pipeline = _load_pipeline(workdir)
    pipeline.step2_add_teacher_comments(comments, actor=actor)
    pipeline.print_summary()
    report = pipeline.consistency_report()
    typer.echo(f"\n一致性检查: {'PASS' if report['ok'] else 'FAIL'}  issues={report['issues']}")


# ============== 5. 复核 ==============
@app.command("review-file")
def step3_review_file(
    review_json: str = typer.Argument(..., help="复核决策JSON：原始说法/改后值/原因/下一步找谁/复核类型"),
    workdir: str = typer.Option("./output"),
):
    """步骤3-复核：保留原始说法、改后的值、处理原因、下一步找谁。PENDING_VERIFICATION不提前归normal"""
    typer.echo("=== 步骤3 人工复核（完整证据链写入StateStore）===")
    with open(review_json, "r", encoding="utf-8") as f:
        raw = json.load(f)
    decisions = {int(k): v for k, v in raw.items()}
    pipeline = _load_pipeline(workdir)
    pipeline.step3_review_decisions_dict(decisions)
    pipeline.print_summary()

    typer.echo("\n分母为0却被填成空字符串 的记录复核前后:")
    results = pipeline.store.get_results()
    for r in results:
        if r.boundary_rule_triggered and r.boundary_rule_triggered.value == "zero_denominator_empty_string":
            typer.echo(f"  行号{r.row_number} {r.metric_name}: "
                       f"异常类型={r.anomaly_type.value} 状态={r.process_status.value} "
                       f"原始分母='{r.raw_denominator}'")
            if r.review_records:
                last = r.review_records[-1]
                typer.echo(f"    复核人={last.reviewed_by} 原始说法='{last.original_statement}' "
                           f"改后值={last.corrected_value} 下一步找谁={last.next_owner}")


@app.command("review-one")
def review_single(
    row_number: int = typer.Argument(..., help="行号"),
    reviewed_by: str = typer.Option(..., help="复核人"),
    original_statement: str = typer.Option(..., help="原始说法/当时的表述"),
    corrected_value: str = typer.Option(..., help="改后的值"),
    review_reason: str = typer.Option(..., help="处理原因"),
    next_owner: str = typer.Option(..., help="下一步找谁/下一步动作"),
    final_type: str = typer.Option("pending_verification", help="normal/abnormal/boundary_case/pending_verification"),
    review_note: str = typer.Option("", help="复核备注"),
    workdir: str = typer.Option("./output"),
):
    """单条人工复核：必填 原始说法/改后值/原因/下一步找谁。PENDING_VERIFICATION不提前归normal"""
    pipeline = _load_pipeline(workdir)
    rec = ReviewRecord(
        reviewed_by=reviewed_by,
        original_statement=original_statement,
        corrected_value=corrected_value,
        review_reason=review_reason,
        next_owner=next_owner,
        review_note=review_note,
        anomaly_type_after_review=AnomalyType(final_type),
    )
    pipeline.step3_review_with_records({row_number: rec})
    updated = pipeline.store.get_result(row_number)
    if updated:
        typer.echo(f"行号{row_number}复核完成: 异常类型={updated.anomaly_type.value} 状态={updated.process_status.value}")
    report = pipeline.consistency_report(row_number=row_number)
    typer.echo(f"一致性检查（row={row_number}）: {'PASS' if report['ok'] else 'FAIL'}  issues={report['issues']}")


# ============== 6. 最终确认（课堂演示） ==============
@app.command("finalize")
def step3_finalize(
    workdir: str = typer.Option("./output"),
    actor: str = typer.Option("课堂演示"),
):
    """步骤3-最终确认：PENDING_VERIFICATION不会被finalize，留给数据复核人复核"""
    typer.echo("=== 步骤3 最终确认（课堂演示更新）===")
    pipeline = _load_pipeline(workdir)
    try:
        pipeline.step3_finalize_all(actor=actor)
    except Exception as e:
        typer.echo(f"[提示] {e}")
    exported = pipeline.export_results()
    pipeline.print_summary()

    typer.echo("\n统一导出（基于StateStore最新快照）:")
    for k, v in exported.items():
        typer.echo(f"  {k}: {v}")

    report = pipeline.consistency_report()
    typer.echo(f"\n闭环一致性: {'PASS' if report['ok'] else 'FAIL'}  issues={report['issues']}")


# ============== 7. 视图命令：列表/详情/摘要/历史  均从StateStore读 ==============
@app.command("list")
def list_records(
    workdir: str = typer.Option("./output"),
    only_pending: bool = typer.Option(False, "--pending", help="只看分母0空字符串等待验证/待复核的"),
    limit: int = typer.Option(30, help="最多显示条数"),
):
    """列表视图：从StateStore读同一份数据"""
    store = StateStore(workdir=workdir)
    results = store.get_results()
    if only_pending:
        results = [r for r in results if r.anomaly_type.value in ("pending_verification",) or r.process_status.value == "pending_review"]

    typer.echo(f"共{len(results)}条，显示前{limit}条 [StateStore版本={store.metadata.current_version}]")
    typer.echo(f"{'行号':<6}{'指标':<12}{'异常类型':<22}{'处理状态':<24}{'原始分母':<10}{'比率':<10}{'截图引用':<16}")
    typer.echo("-" * 100)
    for r in results[:limit]:
        ratio_str = f"{r.ratio:.4f}" if r.ratio is not None else "-"
        typer.echo(f"{r.row_number:<6}{r.metric_name:<12}{r.anomaly_type.value:<22}{r.process_status.value:<24}"
                   f"'{r.raw_denominator}':<10{ratio_str:<10}{r.source_screenshot_ref or '':<16}")


@app.command("detail")
def detail_record(
    row_number: int = typer.Argument(...),
    workdir: str = typer.Option("./output"),
):
    """详情视图：从StateStore读单条（含人工修改/复核历史/原始说法/改后值/下一步找谁）"""
    store = StateStore(workdir=workdir)
    r = store.get_result(row_number)
    if r is None:
        typer.echo(f"行号{row_number}不存在")
        raise typer.Exit(1)

    typer.echo(f"=== 详情：行号 {row_number}  (快照版本={r.snapshot_version}) ===")
    typer.echo(f"时间: {r.timestamp}   指标: {r.metric_name}")
    typer.echo(f"分子: {r.numerator}   分母(数值): {r.denominator}   原始分母值(保留): '{r.raw_denominator}'")
    typer.echo(f"比率: {r.ratio}   异常类型: {r.anomaly_type.value}   处理状态: {r.process_status.value}")
    typer.echo(f"触发边界规则: {r.boundary_rule_triggered.value if r.boundary_rule_triggered else '-'}")
    typer.echo(f"截图引用: {r.source_screenshot_ref or '-'}   导入来源: {r.import_source or '-'}")
    typer.echo(f"老师批注: {r.teacher_comment or '-'}")
    typer.echo(f"复核备注: {r.review_note or '-'}")

    if r.manual_modifications:
        typer.echo(f"\n人工修改记录({len(r.manual_modifications)}条):")
        for m in r.manual_modifications:
            typer.echo(f"  [{m.modified_at}] {m.modified_by} 改 {m.field_name}: "
                       f"'{m.old_value}' -> '{m.new_value}'  原因: {m.reason}")

    if r.review_records:
        typer.echo(f"\n复核记录({len(r.review_records)}条):")
        for rev in r.review_records:
            typer.echo(f"  [{rev.reviewed_at}] 复核人={rev.reviewed_by}  判定={rev.anomaly_type_after_review.value}")
            typer.echo(f"    原始说法: {rev.original_statement}")
            typer.echo(f"    改后的值: {rev.corrected_value}")
            typer.echo(f"    处理原因: {rev.review_reason}")
            typer.echo(f"    下一步找谁: {rev.next_owner}")
            if rev.review_note:
                typer.echo(f"    备注: {rev.review_note}")

    # 一致性检查
    report = store.consistency_check(row_number)
    typer.echo(f"\n一致性(列表/详情/摘要/导出同源): {'PASS' if report['ok'] else 'FAIL'}  issues={report['issues']}")


@app.command("summary")
def show_summary(
    workdir: str = typer.Option("./output"),
):
    """摘要视图：从StateStore读同一份数据"""
    store = StateStore(workdir=workdir)
    summary = store.get_summary()
    meta = store.metadata

    typer.echo(f"=== 摘要 [State v{meta.current_version} @ {meta.last_modified_at} by {meta.last_modified_by}] ===")
    typer.echo(f"记录总数: {summary.total}")
    typer.echo(f"待验证(分母0空字符串): {summary.pending_verification_count}")
    typer.echo(f"待复核: {summary.pending_review_count}")
    typer.echo(f"已最终确认: {summary.finalized_count}")
    typer.echo(f"人工修改累计: {summary.manual_modifications_total}")
    typer.echo(f"复核记录累计: {summary.review_records_total}")

    typer.echo("\n异常类型分布:")
    for k, v in sorted(summary.by_anomaly_type.items()):
        typer.echo(f"  {k:<24} {v}")

    typer.echo("\n处理状态分布:")
    for k, v in sorted(summary.by_process_status.items()):
        typer.echo(f"  {k:<24} {v}")

    if summary.by_boundary_rule:
        typer.echo("\n触发边界规则:")
        for k, v in sorted(summary.by_boundary_rule.items()):
            typer.echo(f"  {k:<36} {v}")

    if meta.import_sources:
        typer.echo("\n导入来源:")
        for s in meta.import_sources:
            typer.echo(f"  {s}")


@app.command("history")
def audit_history(
    row_number: Optional[int] = typer.Argument(None, help="行号，不传则看全部"),
    workdir: str = typer.Option("./output"),
):
    """历史记录视图：从StateStore审计表读"""
    store = StateStore(workdir=workdir)
    records = store.get_audit_trail(row_number=row_number)
    if not records:
        typer.echo("没有审计记录")
        return
    typer.echo(f"共{len(records)}条审计记录")
    typer.echo(f"{'时间':<28}{'行号':<6}{'动作':<22}{'操作人':<16}{'状态迁移':<40}")
    typer.echo("-" * 120)
    for r in records:
        old = r.old_status.value if r.old_status else "(无)"
        typer.echo(f"{r.timestamp.isoformat() if hasattr(r.timestamp, 'isoformat') else r.timestamp:<28}"
                   f"{r.row_number:<6}{r.action:<22}{r.actor:<16}{old} -> {r.new_status.value:<30}")
        if r.comment:
            typer.echo(f"  备注: {r.comment}")


# ============== 8. 一致性验证（列表/详情/摘要/导出 读同一份） ==============
@app.command("verify")
def verify_consistency(
    row_number: Optional[int] = typer.Argument(None, help="指定行号，不传就全量检查"),
    workdir: str = typer.Option("./output"),
    export_dir: Optional[str] = typer.Option(None, help="额外导出一份数据来比对"),
):
    """一致性检查：列表/详情/摘要/导出 四个入口 是否同一份最新结果"""
    store = StateStore(workdir=workdir)
    report = store.consistency_check(row_number=row_number)

    typer.echo("=== 数据闭环一致性检查 ===")
    typer.echo(f"State 版本: {report['snapshot']['version']}  记录数: {report['snapshot']['result_count']}")
    typer.echo(f"结论: {'✅ 一致 (PASS)' if report['ok'] else '❌ 不一致 (FAIL)'}")
    if report["issues"]:
        for issue in report["issues"]:
            typer.echo(f"  - {issue}")

    exporter = store.get_exporter()
    df_list = exporter.get_dataframe()
    results_all = store.get_results()
    df_count_ok = len(df_list) == report["summary"]["total"] == len(results_all)
    typer.echo(f"\n四视图(列表/详情/摘要/导出DataFrame)数量对齐: {'PASS' if df_count_ok else 'FAIL'}")
    typer.echo(f"  list={len(results_all)}  df={len(df_list)}  summary.total={report['summary']['total']}")

    if row_number:
        detail_obj = store.get_result(row_number)
        in_list = any(r.row_number == row_number for r in results_all)
        in_df = (df_list["row_number"] == row_number).any() if len(df_list) else False
        typer.echo(f"\n指定行号row={row_number}:")
        typer.echo(f"  详情对象存在: {detail_obj is not None}")
        typer.echo(f"  在列表中存在: {in_list}")
        typer.echo(f"  在导出DF中存在: {in_df}")
        if detail_obj:
            typer.echo(f"  异常类型={detail_obj.anomaly_type.value}  状态={detail_obj.process_status.value}")

    if export_dir:
        exported = _load_pipeline(workdir).export_results(output_dir=export_dir)
        typer.echo(f"\n额外导出文件（都来自StateStore同一份）:")
        for k, v in exported.items():
            typer.echo(f"  {k}: {v}")


# ============== 9. 修改单条（人工补录/修正） ==============
@app.command("modify")
def modify_record(
    row_number: int = typer.Argument(...),
    field: str = typer.Argument(..., help="denominator/numerator/teacher_comment/review_note/anomaly_type"),
    value: str = typer.Argument(..., help="改后的值"),
    reason: str = typer.Option(..., help="修改原因（必填）"),
    actor: str = typer.Option("数据分析师小祁", help="操作人"),
    workdir: str = typer.Option("./output"),
):
    """人工补录/修正：改动后列表、详情、摘要、导出 全部跟着更新"""
    pipeline = _load_pipeline(workdir)
    result = pipeline.manual_modify_record(row_number, field, value, reason, actor=actor)
    if result is None:
        typer.echo(f"行号{row_number}不存在")
        raise typer.Exit(1)
    typer.echo(f"修改完成: row={row_number} {field}='{value}'  原因={reason}")
    typer.echo(f"  最新快照版本: {result.snapshot_version}")

    # 一致性检查
    report = pipeline.consistency_report(row_number=row_number)
    typer.echo(f"修改后一致性: {'PASS' if report['ok'] else 'FAIL'}  issues={report['issues']}")

    # 再导出一份（确保最新改动已反映在导出里）
    exported = pipeline.export_results()
    typer.echo(f"已同步导出: {exported['csv']} / {exported['excel']}")


# ============== 10. 一键跑通全流程（含一致性校验） ==============
@app.command("run")
def run_full(
    input_file: str = typer.Argument(...),
    comments_json: str = typer.Argument(...),
    review_json: Optional[str] = typer.Option(None, "--review-json"),
    workdir: str = typer.Option("./output"),
):
    """一键完整流水线: 导入→批注→复核→最终确认；每一步都写StateStore，保证一致"""
    typer.echo("=== 一键完整流水线 (StateStore 数据闭环) ===")

    with open(comments_json, "r", encoding="utf-8") as f:
        comments_raw = json.load(f)
    comments = {int(k): v for k, v in comments_raw.items()}

    review_decisions = None
    if review_json and Path(review_json).exists():
        with open(review_json, "r", encoding="utf-8") as f:
            review_raw = json.load(f)
        review_decisions = {int(k): v for k, v in review_raw.items()}

    pipeline = _load_pipeline(workdir)
    exported = pipeline.run_full_pipeline(input_file, comments, output_dir=workdir,
                                          review_decisions=review_decisions)
    pipeline.print_summary()

    report = pipeline.consistency_report()
    typer.echo(f"\n最终数据闭环一致性: {'✅ PASS' if report['ok'] else '❌ FAIL'}  issues={report['issues']}")
    typer.echo(f"可重跑命令:")
    typer.echo(f"  python3 cli.py run {input_file} {comments_json}"
               f"{' --review-json ' + review_json if review_json else ''} --workdir {workdir}")


if __name__ == "__main__":
    app()
