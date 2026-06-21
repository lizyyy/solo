#!/usr/bin/env python3
"""
约束规划参数回放 - 端到端验证脚本
运行方法: python3 tests/verify_e2e.py
"""

import json
import os
import sys
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)


def run_replay(args, output_file=None):
    """运行回放命令并返回报告路径"""
    cmd = [sys.executable, "-m", "constraint_param_replay", "replay"] + args
    result = subprocess.run(
        cmd, cwd=ROOT_DIR,
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"❌ 命令执行失败: {' '.join(cmd)}")
        print(f"   stderr: {result.stderr}")
        sys.exit(1)

    if output_file:
        with open(output_file, "w") as f:
            f.write(result.stdout)

    json_path = None
    for line in result.stdout.split("\n"):
        if "JSON报告:" in line:
            json_path = line.split("JSON报告:")[1].strip()
            break

    return result.stdout, os.path.join(ROOT_DIR, json_path) if json_path else None


def load_report(json_path):
    """加载 JSON 报告"""
    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)


def find_row(report, row_id):
    """查找指定行"""
    for row in report["all_rows"]:
        if row["row_id"] == row_id:
            return row
    return None


def verify_case(name, condition, detail=""):
    """验证一个测试点"""
    if condition:
        print(f"  ✅ {name}")
    else:
        print(f"  ❌ {name}")
        if detail:
            print(f"     {detail}")
    return condition


def main():
    all_passed = True

    print("=" * 60)
    print("  约束规划参数回放 - 端到端验证")
    print("=" * 60)
    print()

    # ============================================================
    # 测试 1: 基础回放 + 来源追踪
    # ============================================================
    print("【测试 1】基础回放与来源追踪")
    print()

    _, json_path = run_replay([
        "-i", "examples/input_sample.json",
        "--param-version", "verify_v1",
        "--sort-reference", "examples/sort_reference.json",
    ])
    report = load_report(json_path)
    summary = report["summary"]

    # 统计验证
    all_passed &= verify_case(
        "总计 12 行",
        summary["总计"] == 12
    )
    all_passed &= verify_case(
        "已处理 7 行",
        summary["已处理"] == 7
    )
    all_passed &= verify_case(
        "坏行 2 行",
        summary["坏行"] == 2
    )
    all_passed &= verify_case(
        "跳过行 2 行",
        summary["跳过行"] == 2
    )
    all_passed &= verify_case(
        "排序不稳定 1 行（单独统计，不混入已处理）",
        summary["排序不稳定"] == 1
    )
    all_passed &= verify_case(
        "受晚到附件影响 3 行",
        summary["受晚到附件影响"] == 3
    )
    all_passed &= verify_case(
        "受口头备注影响 2 行",
        summary["受口头备注影响"] == 2
    )
    all_passed &= verify_case(
        "受旧版答案影响 2 行",
        summary["受旧版答案影响"] == 2
    )

    print()

    # A003 验证：公式计算 + 晚到附件 + 排序不稳定
    a003 = find_row(report, "A003")
    all_passed &= verify_case(
        "A003: 排序不稳定（单独拎出，status=sort_unstable）",
        a003["status"] == "sort_unstable"
    )
    all_passed &= verify_case(
        "A003: 受晚到附件影响",
        a003["affected_by_attachment"] is True
    )
    all_passed &= verify_case(
        "A003: 基准值来自公式 (base_source=formula)",
        a003["base_source"] == "formula"
    )
    all_passed &= verify_case(
        "A003: 值从 20000 变为 25000（+25%）",
        a003["value"] == 25000 and a003["base_value"] == 20000
    )

    att_detail = None
    for sd in a003["source_details"]:
        if sd["source_type"] == "attachment_late":
            att_detail = sd
            break
    all_passed &= verify_case(
        "A003: 附件来源详情完整（文件名、摘要、改值标记）",
        att_detail is not None
        and att_detail["file_name"] == "late_data.json"
        and att_detail["affects_value"] is True
        and att_detail["version"] == "v1.1"
    )

    print()

    # A005 验证：口头备注（改判断）
    a005 = find_row(report, "A005")
    note_detail = None
    for sd in a005["source_details"]:
        if sd["source_type"] == "verbal_note":
            note_detail = sd
            break
    all_passed &= verify_case(
        "A005: 口头备注-改判断（不改值）",
        a005["affected_by_note"] is True
        and note_detail is not None
        and note_detail["affects_judgment"] is True
        and note_detail["affects_value"] is False
    )
    all_passed &= verify_case(
        "A005: 值未改变（备注不影响数值计算）",
        a005["value"] == a005["base_value"]
    )

    print()

    # A006 验证：晚到附件 + 口头备注（仅说明）
    a006 = find_row(report, "A006")
    note_detail_02 = None
    for sd in a006["source_details"]:
        if sd["source_type"] == "verbal_note" and "补充参考" in sd["content_summary"]:
            note_detail_02 = sd
            break
    all_passed &= verify_case(
        "A006: 同时受附件和备注影响",
        a006["affected_by_attachment"] is True
        and a006["affected_by_note"] is True
    )
    all_passed &= verify_case(
        "A006: 备注仅说明不改值（affects_value=False, affects_judgment=False）",
        note_detail_02 is not None
        and note_detail_02["affects_value"] is False
        and note_detail_02["affects_judgment"] is False
    )
    all_passed &= verify_case(
        "A006: 附件改值（100000 -> 95000，-5%）",
        a006["base_value"] == 100000
        and a006["value"] == 95000
        and "-5.0%" in a006["value_diff"]
    )

    print()

    # A001 验证：对照组，不受影响
    a001 = find_row(report, "A001")
    all_passed &= verify_case(
        "A001: 对照组，不受附件/备注/旧版影响",
        a001["affected_by_attachment"] is False
        and a001["affected_by_note"] is False
        and a001["affected_by_old_history"] is False
    )
    all_passed &= verify_case(
        "A001: 基准值来自最新历史答案",
        a001["base_source"] == "history_latest"
    )

    print()

    # ============================================================
    # 测试 2: 单位换算
    # ============================================================
    print("【测试 2】单位换算与偏差定位")
    print()

    _, json_path_wan = run_replay([
        "-i", "examples/input_sample.json",
        "--param-version", "verify_unit_wan",
        "--target-unit", "万元",
    ])
    report_wan = load_report(json_path_wan)

    unit_001 = find_row(report_wan, "UNIT_001")
    all_passed &= verify_case(
        "UNIT_001: 公式计算+单位换算（50*100=5000元=0.5万元）",
        abs(unit_001["value"] - 0.5) < 0.001
        and unit_001["unit"] == "万元"
    )
    all_passed &= verify_case(
        "UNIT_001: 能定位到公式名和版本",
        unit_001["formula_name"] == "revenue_calc"
        and unit_001["formula_version"] == "v1"
    )

    # A004 验证：单位换算失败（% 不能换算成万元）
    a004 = find_row(report_wan, "A004")
    all_passed &= verify_case(
        "A004: 单位不兼容时保留原单位和值（不做错误换算）",
        a004["unit"] == "%"
        and abs(a004["value"] - 30.0) < 0.01
    )

    print()

    # ============================================================
    # 测试 3: 排序不稳定单独拎出
    # ============================================================
    print("【测试 3】排序不稳定单独拎出")
    print()

    sort_unstable_rows = report["sort_unstable_rows"]
    all_passed &= verify_case(
        "排序不稳定列表有 1 条记录",
        len(sort_unstable_rows) == 1
    )
    all_passed &= verify_case(
        "排序不稳定记录 ID 为 A003",
        sort_unstable_rows[0]["row_id"] == "A003"
    )

    processed_count = len([r for r in report["all_rows"] if r["status"] == "processed"])
    all_passed &= verify_case(
        "排序不稳定记录不在已处理列表中（单独统计）",
        processed_count == summary["已处理"] == 7
    )

    print()

    # ============================================================
    # 测试 4: 判断调整留痕
    # ============================================================
    print("【测试 4】判断调整留痕")
    print()

    # 先加一条判断
    result = subprocess.run([
        sys.executable, "-m", "constraint_param_replay", "judge",
        "--row-id", "TEST_001",
        "--old", "合格",
        "--new", "需复核",
        "--reason", "验证测试：数值有偏差",
        "--operator", "自动化测试",
    ], cwd=ROOT_DIR, capture_output=True, text=True)

    all_passed &= verify_case(
        "judge 命令执行成功",
        result.returncode == 0
    )

    # 重新回放，检查判断是否被加载
    _, json_path_judge = run_replay([
        "-i", "examples/input_sample.json",
        "--param-version", "verify_judge",
    ])
    report_judge = load_report(json_path_judge)

    all_passed &= verify_case(
        "报告中包含判断调整记录",
        len(report_judge["judgment_changes"]) >= 1
    )

    print()

    # ============================================================
    # 总结
    # ============================================================
    print("=" * 60)
    if all_passed:
        print("  ✅ 所有验证通过！")
    else:
        print("  ❌ 部分验证失败，请检查输出")
        sys.exit(1)
    print("=" * 60)
    print()
    print("验证报告文件:")
    print(f"  - {json_path}")
    print(f"  - {json_path_wan}")
    print()


if __name__ == "__main__":
    main()
