#!/usr/bin/env python3
"""曲线拟合图表解释器命令入口。

用法（详见 README）：
  python3 run.py run   --batch samples/batch_2026_06   # 跑整批，生成接口返回
  python3 run.py rerun --question Q-2026-001           # 单题完整明细 + 中间计算（PM 对照两组参数）
  python3 run.py show  --report output/reports/batch_2026_06_report.json
"""

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from interpreter import report, sources  # noqa: E402

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
DEFAULT_BATCH = os.path.join(PROJECT_ROOT, "samples", "batch_2026_06")
DEFAULT_OUTPUT = os.path.join(PROJECT_ROOT, "output")


def cmd_run(args: argparse.Namespace) -> int:
    batch_dir = args.batch or DEFAULT_BATCH
    output_dir = args.output or DEFAULT_OUTPUT
    charts_dir = os.path.join(output_dir, "charts")
    try:
        br = report.interpret_batch(batch_dir, charts_dir)
    except FileNotFoundError as e:
        print(f"[错误] {e}", file=sys.stderr)
        return 2
    txt_path, json_path = report.write_outputs(br, output_dir)

    print(f"批次 {br.batch_id} 解释完成，题目 {len(br.questions)} 道。")
    print("状态汇总：" + "，".join(f"{k}={v}" for k, v in sorted(br.summary.items())))
    print("")
    print("接口返回已生成：")
    print(f"  人读报告（先看这个）：{txt_path}")
    print(f"  结构化 JSON        ：{json_path}")
    print(f"  拟合图 SVG         ：{charts_dir}/<题号>.svg")
    print("")
    print("下一步：用浏览器打开对应 <题号>.svg 看图；项目经理对照两组参数看 JSON 内 parameter_sets。")
    return 0


def _print_question_detail(qr) -> None:
    print(f"题号：{qr.question_id}    标题：{qr.title}")
    print(f"状态：{qr.status.value}（{report.STATUS_LABEL[qr.status]}）")
    print(f"原因：{qr.status_reason}")
    print(f"谁影响了结论：{', '.join(qr.influenced_by) or '(无)'}")
    print(f"全部来源（备查）：{', '.join(qr.audit_sources) or '(无)'}")
    if qr.conflict:
        print("⚠ 版本冲突：")
        for line in qr.conflict_detail.splitlines():
            print(f"   {line}")
    print("")
    for ps in qr.parameter_sets:
        print(f"=== {ps.label} ===")
        print(f"  来源：{ps.source.value}    x单位「{ps.unit_x or '(缺失)'}」 y单位「{ps.unit_y or '(缺失)'}」")
        if ps.fit.success:
            print(f"  公式：{report._model_text(ps.fit.model, ps.fit.coefficients)}")
            r2 = ps.fit.r_squared
            print(f"  R² = {r2:.6g}（SS_res={ps.fit.ss_res:.4g}, SS_tot={ps.fit.ss_tot:.4g}）"
                  if r2 is not None else "  R² = N/A")
        else:
            print(f"  拟合未成功：{ps.fit.error}")
        print("  中间计算与单位换算（完整留痕）：")
        for line in ps.intermediate_calculations:
            print(f"    {line}")
        print("")
    if qr.verbal_notes:
        print("口头备注（仅说明，不单独确认单位/参数）：")
        for n in qr.verbal_notes:
            print(f"  - {n.note}  {json.dumps(n.source_meta, ensure_ascii=False)}")
    if qr.pending_items:
        print(f"待办（{qr.status.value}）：")
        for p in qr.pending_items:
            print(f"  ▸ {p}")
    print(f"拟合图：{qr.chart_path}")


def cmd_rerun(args: argparse.Namespace) -> int:
    batch_dir = args.batch or DEFAULT_BATCH
    output_dir = args.output or DEFAULT_OUTPUT
    charts_dir = os.path.join(output_dir, "charts")
    os.makedirs(charts_dir, exist_ok=True)
    try:
        records, notes, _ = sources.load_batch(batch_dir)
    except FileNotFoundError as e:
        print(f"[错误] {e}", file=sys.stderr)
        return 2
    bundles = sources.group_by_question(records, notes)
    bundle = next((b for b in bundles if b.question_id == args.question), None)
    if bundle is None:
        print(f"[错误] 在批次 {batch_dir} 中找不到题号 {args.question}", file=sys.stderr)
        return 3
    qr = report.interpret_question(bundle, charts_dir)
    with open(qr.chart_path, "w", encoding="utf-8") as f:
        f.write(report.render_svg(qr))
    _print_question_detail(qr)
    return 0


def cmd_show(args: argparse.Namespace) -> int:
    if not os.path.isfile(args.report):
        print(f"[错误] 找不到报告文件：{args.report}", file=sys.stderr)
        return 2
    with open(args.report, "r", encoding="utf-8") as f:
        data = json.load(f)
    print(f"批次：{data.get('batch_id')}    收样：{data.get('received','')}")
    print("状态汇总：" + "，".join(f"{k}={v}" for k, v in sorted(data.get("summary", {}).items())))
    print("-" * 60)
    for q in data.get("questions", []):
        print(f"{q['question_id']}  {q['status']:<14} 影响结论:{','.join(q.get('influenced_by',[]))}  "
              f"冲突:{'是' if q.get('conflict') else '否'}  {q.get('title','')}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="曲线拟合图表解释器")
    sub = parser.add_subparsers(dest="command", required=True)

    p_run = sub.add_parser("run", help="跑整批材料，生成接口返回")
    p_run.add_argument("--batch", default=None, help="材料包目录（默认 samples/batch_2026_06）")
    p_run.add_argument("--output", default=None, help="输出目录（默认 output）")
    p_run.set_defaults(func=cmd_run)

    p_rerun = sub.add_parser("rerun", help="单题完整明细 + 中间计算（PM 对照两组参数）")
    p_rerun.add_argument("--question", required=True, help="题号，如 Q-2026-001")
    p_rerun.add_argument("--batch", default=None, help="材料包目录")
    p_rerun.add_argument("--output", default=None, help="输出目录（默认 output）")
    p_rerun.set_defaults(func=cmd_rerun)

    p_show = sub.add_parser("show", help="从已生成的 JSON 报告查看汇总")
    p_show.add_argument("--report", required=True, help="JSON 报告路径")
    p_show.set_defaults(func=cmd_show)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
