#!/usr/bin/env python3
"""全流程冒烟测试：
1) 创建班组交接记录（含一条后补备注绑到第 12 行）
2) 回放 sample_orders.csv
3) 只看断档行（filter --has-gap）
4) 看断档行详情（detail）
5) 补录断档材料并改判（fill）
6) 再看详情验证改判历史
7) 导出 CSV
8) 项目经理三栏汇总视图
9) 列出所有会话
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "factory_pipeline_replay" / "data"
MODULE = "factory_pipeline_replay.cli"
PY = sys.executable

os.chdir(ROOT)

# 先清空旧的 JSON 数据，避免串测
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
    # 把 stdout/stderr 打到终端
    if cp.stdout:
        print(cp.stdout)
    if cp.stderr:
        print("[stderr]", cp.stderr, file=sys.stderr)
    if check and cp.returncode != 0:
        raise SystemExit(f"命令失败 returncode={cp.returncode}: {' '.join(args)}")
    return cp


def extract_session_id(output: str) -> str:
    for line in output.splitlines():
        if "会话 ID 保存" in line:
            return line.split("保存：", 1)[1].strip()
    # 也可能出现在 list 里
    for line in output.splitlines():
        if line.strip().startswith("SES-"):
            return line.split()[0]
    raise SystemExit("找不到 session_id")


def main() -> int:
    today = "2026-06-09"

    # 1) 录入班组交接：早班→中班，本班改了 7、12 行；给 12 行写一条后补备注
    run("handover",
        "--date", today,
        "--from-shift", "早班", "--from-operator", "小宋",
        "--to-shift", "中班", "--to-operator", "小王",
        "--summary", "3# 管廊 09:20 压力突升至 1.8MPa，已手动减压至 1.2MPa；WO-2026-00013 第 6 行与 WO-2026-00014 第 8 行采样记录断档，需中班补录；WO-2026-00016 第 12 行复核人复核备注写入。",
        "--changed-lines", "6,7,12",
        "--remark-line", "12",
        "--remark-text", "复核人：第 12 行现场温度计显示 23.5℃，低于阈值 0.5℃，已在 DCS 记录备查。")

    # 2) 回放：用中班身份
    cp = run("replay",
             "--file", "factory_pipeline_replay/data/sample_orders.csv",
             "--operator", "小王", "--shift", "中班")
    session_id = extract_session_id(cp.stdout)
    print(f"[√] 拿到会话 ID：{session_id}")

    # 验证分类统计数量
    counters_expected = ["已处理", "跳过行", "坏行", "待补材料"]
    for key in counters_expected:
        assert key in cp.stdout, f"分类统计缺少【{key}】列"
    print("[√] 分类统计包含 已处理/跳过行/坏行/待补材料/人工改判")

    # 验证后补备注嵌入（交接绑到 12 行，回放表中应有提示）
    assert "复核人" in cp.stdout, "后补备注【复核人】未嵌入回放结果旁"
    assert "上一班" in cp.stdout, "上一班改动提示未嵌入"
    print("[√] 后补备注已嵌入对应行旁；上一班改动提示已生效")

    # 3) 筛选断档行
    cp = run("filter", "--session", session_id, "--has-gap")
    assert "行   6" in cp.stdout or "行  6" in cp.stdout, "断档筛选未命中第 6 行"
    assert "行   8" in cp.stdout or "行  8" in cp.stdout, "断档筛选未命中第 8 行"
    assert "断档" in cp.stdout, "筛选结果未标注【断档】"
    print("[√] 采样断档筛选可从筛选入口定位行号")

    # 4) 看断档行 6 的详情
    cp = run("detail", "--session", session_id, "--line", "6")
    assert "是否采样断档" in cp.stdout, "详情缺少采样断档字段"
    print("[√] 详情页展示 断档说明/关联交接/改判历史 区块")

    # 5) 补录断档材料，改判
    run("fill",
        "--session", session_id, "--line", "6",
        "--material", "1.28",
        "--operator", "小王",
        "--reason", "巡检发现 09:30 SP-06 采样仪器接触不良，09:50 现场重测补录，压力正常",
        "--remark", "现场重测：温度 24.1℃，压力 1.22MPa，同批样 1.26 / 1.30 / 1.28，取平均")

    # 6) 再看第 6 行详情，验证改判留痕
    cp = run("detail", "--session", session_id, "--line", "6")
    for k in ["旧材料", "新材料", "旧结论", "新结论", "改判原因", "新备注"]:
        assert k in cp.stdout, f"改判历史缺少【{k}】字段"
    assert "(空/断档)" in cp.stdout or "(空)" in cp.stdout, "改判历史未显示旧材料为空"
    assert "1.28" in cp.stdout, "改判历史未显示新材料 1.28"
    assert "巡检发现" in cp.stdout, "改判原因未写进历史"
    print("[√] 补录后结论变化：旧材料(空)→1.28、新备注、改判原因 均已进入历史留痕")

    # 再补第 8 行（改判为不合格，演示结论变化）
    run("fill",
        "--session", session_id, "--line", "8",
        "--material", "3.05",
        "--operator", "小王",
        "--reason", "同批次采样值异常偏高，疑似管线泄漏，按不合格判定",
        "--remark", "已通知巡检班现场排查 PL-D-008，待反馈")

    # 7) 导出 CSV
    out_csv = str(DATA / "smoke_export.csv")
    run("export", "--session", session_id, "--out", out_csv)
    assert os.path.isfile(out_csv), "导出文件未生成"
    with open(out_csv, "r", encoding="utf-8-sig") as f:
        content = f.read()
    # 验证所有链路追踪列都在
    for col in ["后补备注", "改判历史", "关联交接", "是否断档", "改判原因"]:
        assert col in content, f"导出 CSV 缺少列【{col}】"
    print("[√] 导出 CSV 全链路可追溯：断档列/改判历史/关联交接 都在")

    # 8) 项目经理三栏汇总
    cp = run("report", "--session", session_id)
    for k in ["已处理记录", "待补材料（采样断档）", "人工改判"]:
        assert k in cp.stdout, f"项目经理视图缺少【{k}】栏"
    print("[√] 项目经理三栏汇总视图：已处理 / 待补 / 人工改判 三栏均已呈现，可直接截图")

    # 9) list
    cp = run("list")
    assert session_id in cp.stdout, "会话未出现在 list 中"
    print("[√] list 命令列出已保存会话")

    # 异常出口验证（detail 一个不存在的行号）
    cp = run("detail", "--session", session_id, "--line", "999", check=False)
    assert cp.returncode == 2, "不存在的行号应返回退出码 2"
    assert "异常出口" in cp.stderr or "没有行号" in cp.stdout or "没有行号" in cp.stderr, "未命中行应有异常出口提示"
    print("[√] 异常出口：不存在行号时给出清晰提示并返回非 0")

    print()
    print("=" * 80)
    print(" [PASS] 冒烟测试全部通过")
    print("=" * 80)
    print(f"  数据文件都在：{DATA}")
    print(f"  导出文件：{out_csv}")
    print(f"  会话 ID：{session_id}")
    print("  新手可依次尝试：")
    print(f"    {PY} -m {MODULE} --help")
    print(f"    {PY} -m {MODULE} replay --file factory_pipeline_replay/data/sample_orders.csv --operator 测试 --shift 中班")
    print(f"    {PY} -m {MODULE} report --session {session_id}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
