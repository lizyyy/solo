#!/usr/bin/env python3
"""README 中的完整样例跑通脚本。

覆盖：
1. 首次导入（巡检表 + 补充材料 v1 + 口头说明 + 人工备注）
2. 重复导入同一批资料（不翻倍、备注保留）
3. 同名材料 v1 -> v2 口径变更（识别成同一份材料，记录前后差异）
4. 采样断档自动进入挂起
5. 导出交班结果（JSON / 文本，含异常/挂起/备注/改判/样例位置）
6. 交接班摘要
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

EXAMPLES_DIR = Path(__file__).resolve().parent
ROOT = EXAMPLES_DIR.parent
WORK_DIR = EXAMPLES_DIR / "_demo"
DB_PATH = WORK_DIR / "demo.db"
CSV = EXAMPLES_DIR / "inspection.csv"
MAT_V1 = EXAMPLES_DIR / "supplementary_v1.txt"
MAT_V2 = EXAMPLES_DIR / "supplementary_v2.txt"


def run(args, check=True, capture=True):
    print(f"\n$ {' '.join(args)}")
    env = os.environ.copy()
    env["BLADE_REVIEW_DB"] = str(DB_PATH)
    env["PYTHONPATH"] = str(ROOT)
    stdout = subprocess.PIPE if capture else None
    p = subprocess.run(args, env=env, cwd=str(ROOT), stdout=stdout, stderr=subprocess.STDOUT)
    if capture and p.stdout:
        text = p.stdout.decode("utf-8", errors="replace")
        print(text.rstrip())
    if check and p.returncode != 0:
        raise RuntimeError(f"命令失败: {args}  ret={p.returncode}")
    return p


def extract_report_id(stdout: str) -> str:
    for line in stdout.splitlines():
        if line.startswith("报告ID:"):
            return line.split(":", 1)[1].strip()
    raise RuntimeError("未找到报告ID")


def main() -> int:
    if WORK_DIR.exists():
        shutil.rmtree(WORK_DIR)
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    CLI = [sys.executable, "-m", "blade_review", "--db", str(DB_PATH)]

    print("=" * 70)
    print("1) 初始化数据库")
    run(CLI + ["init"])

    print("\n" + "=" * 70)
    print("2) 首次导入：巡检表 CSV + 补充材料 v1 + 临时口头说明")
    r = run(
        CLI
        + [
            "import",
            "--title",
            "风机叶片报告复核-演示",
            "--csv",
            str(CSV),
            "--material",
            "supplementary",
            "超声检测报告",
            str(MAT_V1),
            "--verbal",
            "现场口头说明",
            "B002 下午巡检发现轻微异响，待补充检测",
            "--operator",
            "小宋",
        ]
    )
    report_id = extract_report_id(r.stdout.decode("utf-8", errors="replace"))
    print(f"得到报告ID: {report_id}")

    print("\n" + "=" * 70)
    print("3) 重复导入同一批资料 -> 验证：正常记录不翻倍，人工备注保留")
    r2 = run(
        CLI
        + [
            "import",
            "--report-id",
            report_id,
            "--csv",
            str(CSV),
            "--operator",
            "小宋",
        ]
    )
    out2 = r2.stdout.decode("utf-8", errors="replace")
    print("--- 校验 ---")
    # 应该有 0 新增记录、20 条跳过
    assert "新增 0" in out2, out2
    assert "跳过(重复) 20" in out2, out2
    assert "人工备注保留" in out2
    print("[PASS] 重复导入不翻倍，人工备注保留已生效")

    print("\n" + "=" * 70)
    print("4) 导入同名材料 v2 -> 验证：口径变更，不生成新的材料")
    r3 = run(
        CLI
        + [
            "import",
            "--report-id",
            report_id,
            "--material",
            "supplementary",
            "超声检测报告",
            str(MAT_V2),
            "--operator",
            "小宋",
        ]
    )
    out3 = r3.stdout.decode("utf-8", errors="replace")
    print("--- 校验 ---")
    assert "材料: 新增 0" in out3, out3
    assert "更新(口径/改名)" in out3
    print("[PASS] 同名材料 v2 被识别为口径变更，而非新材料")

    print("\n" + "=" * 70)
    print("5) show 报告 -> 验证：采样断档自动挂起")
    r4 = run(CLI + ["show", "--report", report_id])
    out4 = r4.stdout.decode("utf-8", errors="replace")
    assert "suspended" in out4, out4
    assert "[口径变更]" in out4, out4
    print("[PASS] 状态为 suspended，口径变更可见")

    print("\n" + "=" * 70)
    print("6) 交接班摘要")
    r5 = run(CLI + ["handover", "--report", report_id])
    out5 = r5.stdout.decode("utf-8", errors="replace")
    assert "复核结论" in out5
    assert ("待处理挂起" in out5) or ("待确认挂起" in out5)
    assert "近期改判" in out5
    print("[PASS] 交接班摘要含结论、挂起、改判")

    print("\n" + "=" * 70)
    print("7) 导出 JSON")
    json_out = WORK_DIR / "handover.json"
    run(CLI + ["export", "--report", report_id, "--out", str(json_out), "--format", "json"])
    data = json.loads(json_out.read_text(encoding="utf-8"))
    assert data["report_id"] == report_id
    assert "conclusion" in data
    assert "anomalies" in data
    assert "suspensions" in data
    assert "manual_notes" in data
    assert "judgment_changes" in data
    assert "sample_location" in data
    assert data["is_stable"] is False
    print("[PASS] JSON 导出包含所有要求字段，is_stable=False（断档挂起）")

    print("\n" + "=" * 70)
    print("8) 导出文本")
    txt_out = WORK_DIR / "handover.txt"
    run(CLI + ["export", "--report", report_id, "--out", str(txt_out), "--format", "text"])
    txt = txt_out.read_text(encoding="utf-8")
    for key in ["复核结论", "异常点", "挂起项", "人工备注", "改判前后差异", "样例位置"]:
        assert key in txt, f"文本缺少: {key}\n{txt}"
    print("[PASS] 文本导出包含所有章节标题")

    print("\n" + "=" * 70)
    print("9) 解决挂起 -> 状态恢复")
    # 解析 show 的输出得到挂起ID
    r6 = run(CLI + ["show", "--report", report_id])
    out6 = r6.stdout.decode("utf-8", errors="replace")
    susp_id = None
    for line in out6.splitlines():
        line = line.strip()
        if line.startswith("- ") and "sampling_gap" in line:
            susp_id = line.split(":", 1)[0].lstrip("- ").strip()
            break
    assert susp_id, out6
    run(
        CLI
        + [
            "resolve",
            "--report",
            report_id,
            "--suspension",
            susp_id,
            "--by",
            "现场老师",
            "--note",
            "已确认断档不影响结论",
        ]
    )
    r7 = run(CLI + ["show", "--report", report_id])
    out7 = r7.stdout.decode("utf-8", errors="replace")
    assert "in_review" in out7, out7
    print("[PASS] 挂起解决，报告状态恢复为 in_review")

    print("\n" + "=" * 70)
    print("ALL PASSED")
    print(f"数据库位置: {DB_PATH}")
    print(f"导出文件位置: {json_out}, {txt_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
