#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""塔吊维保报告复核 - 结果展示：传感器来源定位 + 交接时间线（老唐视角）"""

from datetime import datetime
from typing import Any, Dict, List

from .engine import ReviewResult, PartCheckResult, BoundaryEventJudgement, ThresholdBreach


DIV = "=" * 72
SUB = "-" * 72


def _tag(status: str) -> str:
    return {
        "BLOCKED": "❌ 阻塞",
        "NEEDS_ATTENTION": "⚠️  待跟进",
        "PASSED": "✅ 通过",
    }.get(status, status)


def _ppart(p: PartCheckResult) -> str:
    lines = [f"  备件名称：{p.part_name}"]
    lines.append(f"    报单型号：{p.model_claimed}  |  实际领用：{p.model_actual}")
    lines.append(f"    批准清单：{p.approved_models}")
    if p.tolerance_note:
        lines.append(f"    公差说明：{p.tolerance_note}")
    if p.blocked:
        lines.append(f"    ❌ {p.blocking_step} 未通过")
        lines.append(f"       问题：{p.issue}")
    else:
        if p.issue:
            lines.append(f"    ⚠️  {p.issue}")
        else:
            lines.append("    ✅ 通过")
    return "\n".join(lines)


def _pbreach(b: ThresholdBreach, show_source: bool = True) -> str:
    sev = "[严重]" if b.severity() == "严重" else "[警告]"
    s = (f"  {sev} {b.sensor_id} → {b.metric}={b.value} "
         f"(阈值{b.threshold_type}={b.threshold_value}, 载荷{b.load_at_breach}t)")
    if show_source:
        s += (f"\n     📍 传感器日志来源：文件[{b.source.file}] 行号{b.source.line_no} "
              f"时间戳[{b.source.ts}] 指标读数={b.source.detail}")
    return s


def _pboundary(j: BoundaryEventJudgement) -> str:
    lines = [f"  事件ID：{j.event_id}  |  报称时间：{j.claimed_time}"]
    lines.append(f"    报告描述：{j.claimed_desc}")
    lines.append(f"    报告结论：{j.claimed_conclusion}")
    lines.append(f"    复核结论：【{j.verdict}】{j.actual_conclusion}")
    lines.append(f"    判定依据（{len(j.sensor_matches)}条传感器匹配）：")
    for b in j.sensor_matches:
        lines.append("      · " + _pbreach(b, show_source=True).replace("\n", "\n        "))
    if not j.sensor_matches:
        lines.append(f"      说明：{j.justification}")
    return "\n".join(lines)


def print_full_report(result: ReviewResult, alignment: Dict[str, Any],
                      history_runs: List[Dict[str, Any]]) -> None:
    print()
    print(DIV)
    print("  塔吊维保报告复核 —— 完整输出")
    print(f"  报告编号：{result.report_id}    运行ID：{result.run_id}")
    print(f"  运行时间：{result.run_time}    最终状态：{_tag(result.review_status)}")
    print(DIV)

    # ---- 历史对齐信息 ----
    print("\n【一、历史/补注重跑对齐校验】")
    print(SUB)
    if alignment.get("prev_run"):
        print(f"  前次运行：{alignment['prev_run']}  ({alignment['prev_time']})  → 状态 {_tag(alignment['prev_status'])}")
    print(f"  对齐结果：{alignment['note']}")
    if history_runs:
        print("  历次运行：")
        for r in history_runs:
            note = f"  +备注: {r['note_append']}" if r.get("note_append") else ""
            print(f"    · {r['run_time']}  {r['run_id']}  {_tag(r['status'])}{note}")

    # ---- 备件型号校验 ----
    print("\n【二、备件型号替换校验（拦截异常替换）】")
    print(SUB)
    blocked = [p for p in result.part_checks if p.blocked]
    ok = [p for p in result.part_checks if not p.blocked]
    if blocked:
        print(f"  ⛔ 拦截 {len(blocked)} 项异常备件替换（不允许混进正常结果）：")
        for p in blocked:
            print(_ppart(p))
            print()
    if ok:
        print(f"  ✅ 通过校验的备件（{len(ok)}项）：")
        for p in ok:
            print(_ppart(p))
            print()

    # ---- 边界样本影响判定 ----
    print("\n【三、边界样本判定 —— 如何一步步影响最终判断】")
    print(SUB)
    for j in result.boundary_judgements:
        print(_pboundary(j))
        print()

    # ---- 传感器日志越限 + 来源定位 ----
    print("\n【四、传感器日志异常 —— 来源定位（文件名/行号/时间戳）】")
    print(SUB)
    if not result.sensor_breaches:
        print("  ✅ 无传感器越限记录")
    else:
        print(f"  共 {len(result.sensor_breaches)} 条越限：")
        for b in result.sensor_breaches:
            print(_pbreach(b, show_source=True))
            print()

    # ---- 交接时间线（老唐视角） ----
    print("\n【五、安全员交接时间线 —— 老唐视角】")
    print(SUB)
    _print_handover_timeline(result, alignment, history_runs)

    # ---- 备注区 ----
    if result.notes:
        print("\n【六、附加备注】")
        print(SUB)
        for n in result.notes:
            print(f"  · {n}")

    print("\n" + DIV)


def _print_handover_timeline(result: ReviewResult, alignment: Dict[str, Any],
                             history_runs: List[Dict[str, Any]]) -> None:
    """老唐交接时对下一班说的话：传感器日志、处理记录、历史时间线"""
    print("  （以下文字可直接抄到交接本 / 群里发）")
    print()
    blocked_parts = [p for p in result.part_checks if p.blocked]
    boundary_rejects = [j for j in result.boundary_judgements if j.verdict == "驳回"]

    print(f"  🕒 {result.run_time} 安全员唐安全 交接记录")
    print(f"     对应报告：{result.report_id}（三号塔吊·2026-06-08白班）")
    print()

    # 1. 先讲备件替换卡在哪 —— 上一班没说清楚的部分
    if blocked_parts:
        print("  👉 最紧要讲：备件替换卡住了，下一班先处理：")
        for p in blocked_parts:
            print(f"     - {p.part_name}：")
            print(f"       报单型号 {p.model_claimed}，但实际领的是 {p.model_actual}")
            print(f"       卡住的环节：{p.blocking_step}")
            print(f"       原因：{p.issue}")
            print(f"       下一步：要么退回重新领 45mm 规格，要么走技术审批单留痕后放行")
        print()

    # 2. 边界样本怎么影响判断
    if boundary_rejects:
        print("  👉 边界样本判断被驳回，报告原结论不能直接用：")
        for j in boundary_rejects:
            print(f"     - 事件{j.event_id}（{j.claimed_time}）：")
            print(f"       原报告说『{j.claimed_conclusion}』")
            print(f"       复核说『{j.actual_conclusion}』")
            print(f"       传感器证据：{len(j.sensor_matches)}条越限，含严重告警。")
            print(f"       下一班要补的：齿轮箱拆检记录 / 润滑脂取样 / 载荷审批单")
        print()
    else:
        for j in result.boundary_judgements:
            if j.verdict.startswith("同意"):
                print(f"  👉 边界样本{j.event_id}：{j.verdict}")
                print(f"     传感器匹配{len(j.sensor_matches)}条越限，均已留痕在导出文件。")
                print()

    # 3. 传感器日志证据位置 —— 下一班要查能查到
    if result.sensor_breaches:
        print("  👉 传感器日志证据位置（按严重→警告顺序）：")
        for b in sorted(result.sensor_breaches, key=lambda x: 0 if x.severity() == "严重" else 1):
            sev = "严重告警" if b.severity() == "严重" else "警告"
            print(f"     - [{sev}] {b.sensor_id} {b.metric}={b.value}")
            print(f"       📍 {b.source.file} 第{b.source.line_no}行  时间戳 {b.source.ts}")
        print()

    # 4. 历史对齐 —— 补注前 vs 补注后
    if alignment.get("prev_run"):
        print(f"  👉 历史记录对齐：上一轮 {alignment['prev_run']}")
        print(f"     本次输入数据{'一致，可以前后对照' if alignment['aligned'] else '不一致，要说明变更原因'}")
        if result.handover_note:
            print(f"     本次补注内容：{result.handover_note}")
        print()

    # 5. 收尾
    print(f"  👉 最终状态：{_tag(result.review_status)}")
    if result.review_status == "BLOCKED":
        print("     下一班首要任务：处理备件替换拦截项，补全审批或更换正确型号后再重跑。")
    elif result.review_status == "NEEDS_ATTENTION":
        print("     下一班首要任务：补充边界事件对应的事后检查记录。")
    else:
        print("     已通过，可归档。")


def print_exit_summary(result: ReviewResult) -> int:
    """程序退出前的总结，明确说明备件型号替换卡在哪一步"""
    blocked = [p for p in result.part_checks if p.blocked]
    print()
    print(DIV)
    print("  退出提示 —— 备件型号替换卡在哪一步？")
    print(SUB)
    if not blocked:
        print("  ✅ 无备件型号替换被拦截。")
        print(DIV)
        return 0

    print(f"  ⛔ 本次复核共拦截 {len(blocked)} 项备件型号替换问题，")
    print("     卡壳环节清单（从上到下依次为阻塞先后顺序）：")
    print()
    for i, p in enumerate(blocked, 1):
        print(f"  [{i}] {p.part_name}")
        print(f"      卡住环节  →  {p.blocking_step}")
        print(f"      问题描述  →  {p.issue}")
        print(f"      报单型号  →  {p.model_claimed}")
        print(f"      实际型号  →  {p.model_actual}")
        print(f"      批准型号  →  {' / '.join(p.approved_models)}")
        if p.tolerance_note:
            print(f"      公差说明  →  {p.tolerance_note}")
        print()
    print("  要让复核通过，需按上面卡住的环节倒序处理：")
    print("   1. 先解决最后卡住的那一步（退库重领 / 技术审批留痕）")
    print("   2. 更新 maintenance_report.json 中备件信息")
    print("   3. 重跑 ./run_review.py 直到无 BLOCKED 项")
    print(DIV)
    return 3
