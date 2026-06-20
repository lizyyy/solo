#!/usr/bin/env python3
"""专项冒烟测试：采样断档补录后，从筛选、详情到导出仍能追到原始断档痕迹。

核心验收场景（对应需求描述）：
  ① 回放 → 断档行存在（第 6 行、第 8 行）
  ② fill 补录断档行（结论变化触发改判）
  ③ 补录后 filter --had-gap        →  仍能筛出第 6、8 行（旧代码这里会丢失）
  ④ 补录后 detail --line 6/8        →  同时看到【原始断档】区块和【补录信息】区块
  ⑤ 补录后 export CSV               →  断档标记/断档说明/补录内容/改判原因 四列都在
  ⑥ 补录后 report                   →  断档未补 0 条，断档已补 2 条，底部说明覆盖四块
"""
from __future__ import annotations

import csv
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "factory_pipeline_replay" / "data"
MODULE = "factory_pipeline_replay.cli"
PY = sys.executable
os.chdir(ROOT)

# 清空旧 JSON
for f in ["sessions.json", "handover_records.json", "rejudge_histories.json"]:
    p = DATA / f
    if p.exists():
        p.unlink()


def run(*args, check: bool = True) -> subprocess.CompletedProcess:
    print()
    print("=" * 80)
    print(">>>", PY, "-m", MODULE, *args)
    print("=" * 80)
    cp = subprocess.run([PY, "-m", MODULE, *args], capture_output=True, text=True)
    if cp.stdout:
        print(cp.stdout)
    if cp.stderr:
        print("[stderr]", cp.stderr, file=sys.stderr)
    if check and cp.returncode != 0:
        raise SystemExit(f"命令失败 rc={cp.returncode}: {' '.join(args)}")
    return cp


def extract_session_id(output: str) -> str:
    for line in output.splitlines():
        if "会话 ID 保存" in line:
            return line.split("保存：", 1)[1].strip()
    raise SystemExit("未找到 session_id")


def assert_in(cond: bool, msg: str) -> None:
    if not cond:
        raise SystemExit(f"[断言失败] {msg}")
    print(f"  [断言通过] {msg}")


def main() -> int:
    today = "2026-06-21"

    # ── 1) 录入班组交接 ────────────────────────────────────────────────
    run("handover",
        "--date", today,
        "--from-shift", "早班", "--from-operator", "小宋",
        "--to-shift", "中班", "--to-operator", "小王",
        "--summary", "第 6、8 行采样断档，第 12 行复核备注。",
        "--changed-lines", "6,7,8,12",
        "--remark-line", "12",
        "--remark-text", "复核：第 12 行现场温度 23.5℃，已登记。")

    # ── 2) 回放 ────────────────────────────────────────────────────────
    cp = run("replay",
             "--file", "factory_pipeline_replay/data/sample_orders.csv",
             "--operator", "小王", "--shift", "中班")
    session_id = extract_session_id(cp.stdout)

    # 回放表头里有"采样断档追踪"与"⚑ 断档溯源"标签
    assert_in("采样断档追踪" in cp.stdout, "回放输出包含【采样断档追踪】区块")
    assert_in("⚑" in cp.stdout or "断档溯源" in cp.stdout, "回放明细包含断档溯源标记 ⚑")
    # 第 6、8 行显示为断档（在回放明细中：│⚑│   6 │ 即带 ⚑ 断档溯源标签）
    assert_in("│⚑│   6 │" in cp.stdout or "WO-2026-00013 │ PL-C-006" in cp.stdout,
              "第 6 行显示为断档（带 ⚑ 标签）")
    assert_in("│⚑│   8 │" in cp.stdout or "WO-2026-00014 │ PL-D-008" in cp.stdout,
              "第 8 行显示为断档（带 ⚑ 标签）")

    # ── 3) 补录前：--had-gap / --gap-pending 都能命中 6、8；--gap-filled 空 ──
    cp = run("filter", "--session", session_id, "--had-gap")
    assert_in("行  6" in cp.stdout, "补录前 --had-gap 命中第 6 行")
    assert_in("行  8" in cp.stdout, "补录前 --had-gap 命中第 8 行")
    assert_in("原始断档" in cp.stdout, "补录前 filter 显示【原始断档】行")

    cp = run("filter", "--session", session_id, "--gap-pending")
    assert_in("命中 2 行" in cp.stdout, "补录前 --gap-pending 命中 2 行")

    cp = run("filter", "--session", session_id, "--gap-filled")
    assert_in("命中 0 行" in cp.stdout or "（无）" in cp.stdout,
              "补录前 --gap-filled 命中 0 行")

    # 补录前 detail：原始断档为"是"，补录相关为空
    cp = run("detail", "--session", session_id, "--line", "6")
    # 检查字段名是否存在 + 对应值是否在同屏出现（忽略缩进空格）
    assert_in("原始是否断档（永不改变）" in cp.stdout and any(
        "原始是否断档（永不改变）" in l and l.rstrip().endswith("是") for l in cp.stdout.splitlines()
    ), "补录前 detail 第 6 行：原始是否断档 = 是")
    assert_in("原始断档说明（永不改变）" in cp.stdout and "采样值缺失" in cp.stdout,
              "补录前 detail 第 6 行：原始断档说明 = 采样值缺失")
    assert_in("是否已补录材料" in cp.stdout and any(
        "是否已补录材料" in l and (l.rstrip().endswith("否") or "（空）" in l)
        for l in cp.stdout.splitlines()
    ), "补录前 detail 第 6 行：是否已补录材料 = 否/空")

    # ── 4) fill 补录两个断档行（结论变化触发改判） ───────────────────────
    run("fill",
        "--session", session_id, "--line", "6",
        "--material", "1.28",
        "--operator", "小王",
        "--reason", "SP-06 仪器接触不良，09:50 重测，现场补录",
        "--remark", "同批样 1.26/1.30/1.28，取平均；温度 24.1℃；压力 1.22MPa")

    run("fill",
        "--session", session_id, "--line", "8",
        "--material", "3.05",
        "--operator", "小王",
        "--reason", "同批次值偏高，疑似 PL-D-008 微漏，判不合格",
        "--remark", "已通知巡检班排查，待后续复测。")

    # ── 5) 补录后①：filter 三处都能追到 ────────────────────────────────
    print("\n" + "★" * 80)
    print("★  关键验收：补录后 filter --had-gap 仍能命中第 6、8 行")
    print("★" * 80)
    cp = run("filter", "--session", session_id, "--had-gap")
    assert_in("命中 2 行" in cp.stdout, "补录后 --had-gap 仍命中 2 行（关键）")
    assert_in("行  6" in cp.stdout, "补录后 --had-gap 仍命中第 6 行（关键）")
    assert_in("行  8" in cp.stdout, "补录后 --had-gap 仍命中第 8 行（关键）")
    # 标签正确
    assert_in("⚑断档溯源" in cp.stdout, "补录后 filter 仍打【⚑断档溯源】标签")
    assert_in("✔已补" in cp.stdout, "补录后 filter 打【✔已补】标签")
    # 原始断档信息仍然打印
    assert_in("🔍 原始断档：采样值缺失" in cp.stdout,
              "补录后 filter 仍显示【🔍 原始断档：采样值缺失】")
    # 补录信息也显示
    assert_in("🔍 补录信息：值=1.28" in cp.stdout,
              "补录后 filter 显示第 6 行补录值 1.28")
    assert_in("🔍 补录信息：值=3.05" in cp.stdout,
              "补录后 filter 显示第 8 行补录值 3.05")
    # 补录原因也能看到
    assert_in("SP-06 仪器接触不良" in cp.stdout, "补录原因 1 可见")
    assert_in("PL-D-008 微漏" in cp.stdout, "补录原因 2 可见")

    cp_pend = run("filter", "--session", session_id, "--gap-pending")
    assert_in("命中 0 行" in cp_pend.stdout, "补录后 --gap-pending 命中 0 行")

    cp_fill = run("filter", "--session", session_id, "--gap-filled")
    assert_in("命中 2 行" in cp_fill.stdout, "补录后 --gap-filled 命中 2 行")

    # ── 6) 补录后②：detail 同时看到原始断档 + 补录 + 改判 ──────────────
    print("\n" + "★" * 80)
    print("★  关键验收：补录后 detail 同时看原始断档、补录、改判三段")
    print("★" * 80)
    cp = run("detail", "--session", session_id, "--line", "6")
    def has_field_value(text: str, field: str, value: str) -> bool:
        for l in text.splitlines():
            if field in l and value in l:
                return True
        return False
    # 采样断档追踪区
    assert_in("采样断档追踪（原始信息永不抹掉）" in cp.stdout,
              "detail 有【采样断档追踪】分节")
    assert_in(has_field_value(cp.stdout, "原始是否断档（永不改变）", "是"),
              "补录后 detail 第 6 行：原始是否断档 仍 = 是（关键）")
    assert_in(has_field_value(cp.stdout, "原始断档说明（永不改变）", "采样值缺失"),
              "补录后 detail 第 6 行：原始断档说明 仍保留（关键）")
    assert_in(has_field_value(cp.stdout, "当前是否仍待补（断档未补）", "否"),
              "补录后 detail 第 6 行：当前是否仍待补 = 否")
    # 补录信息区
    assert_in("补录信息（后续处理）" in cp.stdout,
              "detail 有【补录信息（后续处理）】分节")
    assert_in(has_field_value(cp.stdout, "是否已补录材料", "是"),
              "补录后 detail 第 6 行：是否已补录 = 是")
    assert_in(has_field_value(cp.stdout, "补录材料值", "1.28"),
              "补录后 detail 第 6 行：补录材料值 = 1.28")
    assert_in(has_field_value(cp.stdout, "补录操作人", "小王"),
              "补录后 detail 第 6 行：补录操作人 = 小王")
    assert_in(has_field_value(cp.stdout, "补录原因", "SP-06 仪器接触不良"),
              "补录后 detail 第 6 行：补录原因")
    # 改判历史区
    assert_in("旧材料: (空/断档)   →   新材料: 1.28" in cp.stdout,
              "补录后 detail 第 6 行：改判历史显示旧→新材料")
    assert_in("旧结论: 待判定   →   新结论: 合格" in cp.stdout,
              "补录后 detail 第 6 行：改判历史显示旧→新结论")
    assert_in("新备注  : 同批样 1.26" in cp.stdout,
              "补录后 detail 第 6 行：新备注可见")

    # 第 8 行同样检查（结论是不合格）
    cp = run("detail", "--session", session_id, "--line", "8")
    assert_in(has_field_value(cp.stdout, "原始是否断档（永不改变）", "是"),
              "补录后 detail 第 8 行：原始是否断档 仍 = 是（关键）")
    assert_in(has_field_value(cp.stdout, "补录材料值", "3.05"),
              "补录后 detail 第 8 行：补录材料值 = 3.05")
    assert_in("新结论: 不合格" in cp.stdout,
              "补录后 detail 第 8 行：结论 = 不合格")
    assert_in("PL-D-008 微漏" in cp.stdout,
              "补录后 detail 第 8 行：改判原因可见")

    # ── 7) 补录后③：导出 CSV 四要素都在 ────────────────────────────────
    print("\n" + "★" * 80)
    print("★  关键验收：导出 CSV 含断档标记、断档说明、补录内容、改判原因")
    print("★" * 80)
    out_csv = str(DATA / "gap_trace_export.csv")
    run("export", "--session", session_id, "--out", out_csv)
    with open(out_csv, "r", encoding="utf-8-sig") as f:
        reader = list(csv.DictReader(f))

    # 列名存在
    required_cols = [
        "原始是否断档", "原始断档说明",          # 原始信息
        "当前是否待补(断档未补)", "当前断档说明",  # 当前状态
        "是否已补录", "补录值", "补录人", "补录时间", "补录原因",  # 补录信息
        "是否人工改判", "改判原因",               # 改判
    ]
    for c in required_cols:
        assert_in(c in reader[0], f"导出 CSV 包含列【{c}】")

    # 找第 6、8 行
    line6 = next(r for r in reader if r["行号"] == "6")
    line8 = next(r for r in reader if r["行号"] == "8")

    # 第 6 行
    assert_in(line6["原始是否断档"] == "是", "导出：第 6 行【原始是否断档】= 是（关键）")
    assert_in("采样值缺失" in line6["原始断档说明"],
              "导出：第 6 行【原始断档说明】= 采样值缺失（关键）")
    assert_in(line6["是否已补录"] == "是", "导出：第 6 行【是否已补录】= 是")
    assert_in(line6["补录值"] == "1.28", "导出：第 6 行【补录值】= 1.28")
    assert_in(line6["补录人"] == "小王", "导出：第 6 行【补录人】= 小王")
    assert_in("SP-06 仪器接触不良" in line6["补录原因"],
              "导出：第 6 行【补录原因】存在")
    assert_in(line6["是否人工改判"] == "是", "导出：第 6 行【是否人工改判】= 是")
    assert_in("待判定" in line6["改判历史"] and "合格" in line6["改判历史"],
              "导出：第 6 行【改判历史】有旧→新结论")

    # 第 8 行
    assert_in(line8["原始是否断档"] == "是", "导出：第 8 行【原始是否断档】= 是（关键）")
    assert_in(line8["补录值"] == "3.05", "导出：第 8 行【补录值】= 3.05")
    assert_in("PL-D-008 微漏" in line8["补录原因"],
              "导出：第 8 行【补录原因】存在")
    assert_in("不合格" in line8["当前结论"], "导出：第 8 行【当前结论】= 不合格")

    # ── 8) 补录后④：report 四栏 + 底部四块说明 ─────────────────────────
    print("\n" + "★" * 80)
    print("★  关键验收：report 四栏（已处理/断档未补/断档已补/改判）+ 底部四块说明")
    print("★" * 80)
    cp = run("report", "--session", session_id)
    assert_in("① 已处理记录" in cp.stdout, "report 有第 ① 栏：已处理记录")
    assert_in("② 采样断档·未补（共 0 条）" in cp.stdout,
              "report 有第 ② 栏：断档未补 0 条")
    assert_in("③ 采样断档·已补（含改判）（共 2 条）" in cp.stdout,
              "report 有第 ③ 栏：断档已补 2 条（关键）")
    assert_in("④ 人工改判" in cp.stdout, "report 有第 ④ 栏：人工改判")
    # 顶部断档汇总
    assert_in("采样断档追踪合计：2 条" in cp.stdout, "report 顶部：断档合计 2 条")
    # 底部四块说明
    assert_in("【底部总说明 · 截图交付用】" in cp.stdout, "report 有【底部总说明】")
    assert_in("① 已处理记录：" in cp.stdout, "底部说明①")
    assert_in("② 采样断档·未补：" in cp.stdout, "底部说明②")
    assert_in("③ 采样断档·已补（含改判）：" in cp.stdout, "底部说明③")
    assert_in("④ 人工改判：" in cp.stdout, "底部说明④")
    # 底部链路说明
    assert_in("filter --had-gap" in cp.stdout and "detail --line N" in cp.stdout and "export" in cp.stdout,
              "底部有断档追踪链路提示")

    # ── 9) 兼容性：旧参数 --has-gap 仍有效（等价于 --gap-pending） ──────
    cp_old = run("filter", "--session", session_id, "--has-gap")
    assert_in("命中 0 行" in cp_old.stdout, "旧参数 --has-gap 仍有效，补录后命中 0 条（仍待补的）")

    print()
    print("=" * 80)
    print(" [专项 PASS] 断档补录后 筛选/详情/导出/report 四处均能追溯原始断档")
    print("=" * 80)
    print(f"  会话 ID  : {session_id}")
    print(f"  导出 CSV : {out_csv}")
    print("  关键修复说明：")
    print("    · 新增字段 original_has_gap / original_gap_detail（永不改变）")
    print("    · fill 后不再清原始断档，仅把 has_gap 置为『当前已补』")
    print("    · 新增 is_material_filled / filled_material / filled_by / filled_at / filled_reason")
    print("    · filter 新增 --had-gap（所有曾断档）、--gap-pending（未补）、--gap-filled（已补）")
    print("    · detail 分『采样断档追踪』『补录信息』『改判信息』三段展示")
    print("    · export CSV 新增 9 列（原始/当前/补录 三段断档信息）")
    print("    · report 由三栏升级为四栏，底部四块说明覆盖断档追踪链路")
    return 0


if __name__ == "__main__":
    sys.exit(main())
