"""replay.py — 误差传播参数回放 命令行入口。

用法:
    python replay.py --input <输入目录> --output <输出目录>

说明:
- 输入目录需含 题目清单.json 与 参数版本.json；
- 终端只打印"终端摘要"（简洁），截图说明/追溯链全部落到输出目录的 report.html，
  二者绝不混在一起；
- 输出目录生成: report.html、计算结果.json、确认记录.json、终端摘要.txt。
"""

import argparse
import json
import os
import sys
import time

import error_propagation as ep
import diff as diffmod
import report as reportmod


def load_input(input_dir):
    ql_path = os.path.join(input_dir, "题目清单.json")
    pv_path = os.path.join(input_dir, "参数版本.json")
    if not os.path.exists(ql_path):
        sys.exit("错误：找不到题目清单 %s" % ql_path)
    if not os.path.exists(pv_path):
        sys.exit("错误：找不到参数版本 %s" % pv_path)
    with open(ql_path, encoding="utf-8") as f:
        ql = json.load(f)
    with open(pv_path, encoding="utf-8") as f:
        pv = json.load(f)
    return ql, pv


def run(input_dir, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    ql, pv = load_input(input_dir)
    questions = ql["题目"]
    versions = pv["版本"]

    results = []
    for q in questions:
        for v in versions:
            # overrides 在清单里按题目ID分组，这里只取本题的覆盖
            q_overrides = v.get("overrides", {}).get(q["id"], {})
            r = ep.compute(q, v["version"], v.get("description", ""),
                           q_overrides)
            results.append(r)

    # 写计算结果
    results_path = os.path.join(output_dir, "计算结果.json")
    with open(results_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    # 人工确认：无则生成模板，有则算前后差异
    conf_path = os.path.join(output_dir, "确认记录.json")
    conf = diffmod.load_confirmation(conf_path)
    if conf is None:
        diffmod.generate_template(results, conf_path)
        diffs, any_confirmed = [], False
        conf_note = "已生成确认记录模板（pending），填写后重跑可见前后差异"
    else:
        diffs, any_confirmed = diffmod.compute_diff(results, conf)
        conf_note = ("发现确认记录，已计算前后差异" if any_confirmed
                    else "确认记录存在但均为 pending，未见改动")

    meta = {
        "time": time.strftime("%Y-%m-%d %H:%M:%S"),
        "input": os.path.abspath(input_dir),
        "output": os.path.abspath(output_dir),
    }
    report_path = os.path.join(output_dir, "report.html")
    reportmod.generate_report(results, versions, diffs, any_confirmed, meta,
                              report_path)

    summary = build_terminal_summary(
        ql, pv, results, meta, conf_note, report_path, conf_path)
    # 终端摘要：打印到 stdout；同时落一份 txt，与 report.html 分离
    print(summary)
    with open(os.path.join(output_dir, "终端摘要.txt"), "w",
              encoding="utf-8") as f:
        f.write(summary)
    return summary


def build_terminal_summary(ql, pv, results, meta, conf_note,
                           report_path, conf_path):
    questions = ql["题目"]
    versions = pv["版本"]
    n_std = sum(1 for q in questions if q.get("category") == "standard")
    n_bnd = sum(1 for q in questions if q.get("category") == "boundary")
    n_ok = sum(1 for r in results if r["status"] == "ok")
    n_warn = sum(1 for r in results if r["status"] == "warning")
    n_exc = sum(1 for r in results if r["status"] == "exception")
    ver_str = ", ".join(v["version"] for v in versions)

    lines = []
    lines.append("=" * 64)
    lines.append(" 误差传播参数回放 · 终端摘要")
    lines.append("=" * 64)
    lines.append("输入目录: %s" % meta["input"])
    lines.append("输出目录: %s" % meta["output"])
    lines.append("生成时间: %s" % meta["time"])
    lines.append("参数版本: %s" % ver_str)
    lines.append("题目数: %d（标准 %d，边界 %d）  计算条目: %d"
                 % (len(questions), n_std, n_bnd, len(results)))
    lines.append("统计: 正常 %d / 注意 %d / 异常 %d" % (n_ok, n_warn, n_exc))
    lines.append("-" * 64)
    lines.append(" 题目            版本    状态  结果（终端摘要，不含截图说明）")
    # 按题目×版本一行
    for r in results:
        tag = "边界" if r["category"] == "boundary" else "标准"
        qid = r["question_id"]
        if r["exceptions"]:
            e = r["exceptions"][0]
            res = "[%s] %s → 追溯原始说法见 report.html#q-%s" % (
                e["type"], _short(e["message"], 30), qid)
        else:
            res = "%s ± %s %s" % (
                _fmt(r["result_value"]), _fmt(r["result_uncertainty"]),
                r["result_unit"])
            if r["notes"]:
                res += "（含提示）"
        lines.append(" %-14s %-7s %-4s %s" % (
            "%s[%s]" % (qid, tag), r["version"], _cn(r["status"]), res))
    lines.append("-" * 64)
    exc_results = [r for r in results if r["exceptions"]]
    if exc_results:
        lines.append(" 异常 %d 条（均追溯到题目清单原始说法，非含糊警告）:" % len(exc_results))
        for r in exc_results:
            for e in r["exceptions"]:
                lines.append("  %s %s [%s] %s" % (
                    r["question_id"], r["version"], e["type"],
                    _short(e["message"], 50)))
    else:
        lines.append(" 无异常")
    lines.append("-" * 64)
    lines.append(" 确认: %s" % conf_note)
    lines.append(" 截图说明（公式→偏导→结果/异常→原始说法 追溯链）见: %s" % report_path)
    lines.append(" 确认记录: %s" % conf_path)
    lines.append(" 说明: 终端摘要与截图说明已分离——本终端仅给结论与异常指针，"
                 "完整解释与追溯链在 report.html。")
    lines.append("=" * 64)
    return "\n".join(lines)


def _cn(status):
    return {"ok": "正常", "warning": "注意", "exception": "异常"}.get(status, status)


def _short(s, n):
    s = str(s)
    return s if len(s) <= n else s[:n] + "…"


def _fmt(v):
    if v is None:
        return "—"
    try:
        v = float(v)
    except (TypeError, ValueError):
        return str(v)
    if v == 0:
        return "0"
    if abs(v) >= 1000 or abs(v) < 0.001:
        return "%.3e" % v
    return "%.4g" % v


def main():
    ap = argparse.ArgumentParser(
        prog="replay",
        description="误差传播参数回放：指定输入/输出目录，回放各参数版本下的误差传播结果。")
    ap.add_argument("--input", default="sample_input",
                    help="输入目录（含 题目清单.json 与 参数版本.json）")
    ap.add_argument("--output", default="sample_output",
                    help="输出目录（生成 report.html 等）")
    args = ap.parse_args()
    run(args.input, args.output)


if __name__ == "__main__":
    main()
