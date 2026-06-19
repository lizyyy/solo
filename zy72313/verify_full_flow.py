#!/usr/bin/env python3
"""
Markov 客户流失转移 - 完整流程一键验证脚本
覆盖: 导入两版答案 → 批准复核 → 更新误差说明 → 回滚 → 刷新 → 重算报告 → 导出
重点验证:
  1. 一条批准复核只算一条，不重复计数
  2. CA1 能从当前状态继续更新误差说明
  3. 同版本重复给可懂原因，不生成独立复核
  4. 六要素一致性（复核列表/学生编号/答案版本/处理状态/历史记录/报告摘要）
"""
import os
import sys
import json
import shutil
import subprocess
from pathlib import Path

WORKDIR = Path(__file__).parent
DATA_DIR = WORKDIR / "data"

def run(cmd, **kwargs):
    """运行CLI命令并返回结果"""
    r = subprocess.run(
        cmd, shell=True, capture_output=True, text=True,
        cwd=str(WORKDIR), timeout=30
    )
    if r.returncode != 0:
        print(f"❌ 命令失败: {cmd}")
        print(f"  stdout: {r.stdout[:500]}")
        print(f"  stderr: {r.stderr[:500]}")
        sys.exit(1)
    return r.stdout.strip()

def load_json(cmd_output):
    try:
        return json.loads(cmd_output)
    except json.JSONDecodeError:
        pass
    try:
        first = cmd_output.index("{")
        last = cmd_output.rindex("}") + 1
        return json.loads(cmd_output[first:last])
    except Exception as e:
        print(f"❌ JSON 解析失败: {e}")
        print(f"  输出: {cmd_output[:500]}")
        sys.exit(1)

def main():
    print("=" * 70)
    print("Markov 客户流失转移 - 完整流程一键验证")
    print("=" * 70)

    # 1. 清数据
    print("\n1. 清空数据目录，打开入口")
    if DATA_DIR.exists():
        shutil.rmtree(DATA_DIR)
    DATA_DIR.mkdir()
    print("   ✅ 数据目录已清空")

    # 2. 导入两版答案
    print("\n2. 导入两版答案（Case1: STU_A v1 + v2）")
    out = run("python3 cli.py import-data test_data/test_case1_two_versions.csv")
    result = load_json(out)
    assert result["multiple_answer_students"] == ["STU_A"], "应检测到STU_A多版答案"
    assert result["imported_count"] == 8, "应导入8条记录"
    print(f"   ✅ 检测到多版答案学生: {result['multiple_answer_students']}")
    print(f"   ✅ 导入记录数: {result['imported_count']}")

    # 3. 唐老师补看批注
    print("\n3. 唐老师补看老师批注（check-answers）")
    out = run("python3 cli.py check-answers")
    assert "待处理的多版答案复核任务: 1" in out, "应显示1条待处理"
    rid = out.split("review_")[1].split(" ")[0]
    rid = f"review_{rid}"
    print(f"   ✅ 待处理复核ID: {rid}")

    # 4. 批准复核（用 --author 参数，与 README 一致）
    print(f"\n4. 唐老师批准复核（--author 参数，与 README 一致）")
    out = run(f'python3 cli.py review {rid} approve --author 唐老师 --comment "确认STU_A采用v2答案"')
    assert f"已批准: {rid}" in out, f"批准应成功: {out}"
    print(f"   ✅ 批准成功: {out.strip()}")

    # 5. 给 CA1 更新误差说明（证明能从当前状态继续）
    print("\n5. 给 CA1 更新误差说明（证明不丢失学生，同时发起复核）")
    out = run('python3 cli.py update-error-note CA1 2024-03-01 "补说明：v1偏差2.3%" --modifier 唐老师 --reason "公式偏差" --need-review')
    result = load_json(out)
    assert result["status"] == "success", "更新应成功"
    assert result["student_id"] == "STU_A", "应关联到STU_A"
    assert result["old_value"] == "判定流失-第一版", "旧值正确"
    print(f"   ✅ CA1误差说明更新成功: {result['old_value']} → {result['new_value']}")
    print(f"   ✅ 关联学生: {result['student_id']} v{result['answer_version']}")

    # 6. 第二次更新+回滚
    print("\n6. 第二次更新误差说明，然后回滚到上一份")
    run('python3 cli.py update-error-note CA1 2024-03-01 "补说明V2：偏差3.1%" --modifier 唐老师 --reason "修正口径"')
    out = run('python3 cli.py rollback-field CA1 2024-03-01 error_notes --modifier 业务运营 --reason "回滚到第一版"')
    result = load_json(out)
    assert result["status"] == "success", "回滚应成功"
    assert "补说明：v1偏差2.3%" in result["new_value"], "回滚后值正确"
    print(f"   ✅ 回滚成功: {result['old_value']} → {result['new_value']}")

    # 7. 刷新/重算报告摘要
    print("\n7. 重算报告摘要，验证不重复计数")
    out = run("python3 cli.py report-summary")
    report = load_json(out)

    # 8. 核心验证1: 不重复计数
    print("\n8. 核心验证1: 一条批准复核只算一条")
    reviews = report["review_summary"]
    approved_reviews = [r for r in reviews if r["status"] == "approved"]
    history_approved = report["history_summary"]["operation_counts"]["review_approve"]
    unique_approved_ids = len({r["review_id"] for r in approved_reviews})

    print(f"   复核系统approved数: {len(approved_reviews)}")
    print(f"   历史review_approve数: {history_approved}")
    print(f"   去重后approved_id数: {unique_approved_ids}")

    assert len(approved_reviews) == 1, "只有1条批准"
    assert history_approved == 1, "历史记录只有1条批准"
    assert unique_approved_ids == len(approved_reviews), "批准数无重复"
    assert report["consistency_check"]["approval_count_match"] == True, "批准数匹配检查通过"
    assert report["consistency_check"]["unique_approved_review_ids_match"] == True, "去重匹配检查通过"
    print("   ✅ 不重复计数验证通过")

    # 9. 核心验证2: 六要素一致性
    print("\n9. 核心验证2: 六要素一致性")
    stu_status = report["student_review_status"]["STU_A"]
    print(f"   STU_A: 总{stu_status['reviews']}条 = 批准{stu_status['approved']} + 待处理{stu_status['pending']}")
    assert stu_status["reviews"] == 2, "STU_A应有2条复核"
    assert stu_status["approved"] == 1, "STU_A应有1条批准"
    assert stu_status["pending"] == 1, "STU_A应有1条待处理"
    assert report["consistency_check"]["review_count_match"] == True, "review_count_match应为True"
    assert report["consistency_check"]["approval_count_match"] == True, "approval_count_match应为True"
    assert report["consistency_check"]["unique_approved_review_ids_match"] == True, "unique_approved_review_ids_match应为True"
    print(f"   一致性检查: {report['consistency_check']}")
    print("   ✅ 六要素一致性验证通过")

    # 10. 核心验证3: CA1能继续更新
    print("\n10. 核心验证3: CA1从当前状态继续更新误差说明")
    out = run('python3 cli.py update-error-note CA1 2024-03-01 "继续补说明：已确认偏差2.3%" --modifier 唐老师 --reason "最终确认"')
    result = load_json(out)
    assert result["status"] == "success", "CA1继续更新应成功"
    assert result["student_id"] == "STU_A", "仍关联STU_A"
    print(f"   ✅ CA1继续更新成功: {result['new_value']}")
    print(f"   ✅ 修改人: {result['modifier']}, 原因: {result['reason']}")

    # 11. 导出
    print("\n11. 导出完整结果（读取同一份快照）")
    out = run("python3 cli.py export --prefix verify_full_flow_")
    assert "客户状态:" in out and "转移矩阵:" in out, "导出应成功"
    export_files = list((DATA_DIR / "exports").glob("verify_full_flow_*"))
    assert len(export_files) == 4, "应导出4个文件"
    print(f"   ✅ 导出文件: {len(export_files)} 个")
    for f in sorted(export_files):
        print(f"      - {f.name} ({f.stat().st_size} bytes)")

    # 12. Case2 同版本重复验证
    print("\n12. Case2 同版本重复验证（不给独立复核）")
    shutil.rmtree(DATA_DIR)
    DATA_DIR.mkdir()
    out = run("python3 cli.py import-data test_data/test_case2_duplicate_version.csv")
    result = load_json(out)
    assert result["skipped_duplicate_version_count"] == 2, "应跳过2条同版本重复"
    assert result["multiple_answer_students"] == [], "不应触发多版答案复核"
    assert "同版本重复：学生STU_D" in result["duplicate_reasons"][0], "应给出可懂原因"

    out = run("python3 cli.py list-reviews")
    assert out.strip() == "", "应无复核任务"

    out = run("python3 cli.py report-summary")
    report2 = load_json(out)
    assert len(report2["review_summary"]) == 0, "报告摘要应无复核"
    assert report2["consistency_check"]["pending_multiple_answers_count"] == 0
    print(f"   ✅ 同版本重复跳过: {result['skipped_duplicate_version_count']} 条")
    print(f"   ✅ 生成复核任务: {len(report2['review_summary'])} 条（预期0）")
    print(f"   ✅ 可懂原因示例: {result['duplicate_reasons'][0][:50]}...")

    print("\n" + "=" * 70)
    print("✅ 所有验证通过！")
    print("=" * 70)
    print("\n可复现命令记录:")
    print("  rm -rf data")
    print("  python3 cli.py import-data test_data/test_case1_two_versions.csv")
    print("  python3 cli.py check-answers")
    print(f'  python3 cli.py review {rid} approve --author 唐老师 --comment "确认STU_A采用v2答案"')
    print('  python3 cli.py update-error-note CA1 2024-03-01 "补说明" --modifier 唐老师 --reason "公式偏差"')
    print('  python3 cli.py rollback-field CA1 2024-03-01 error_notes --modifier 业务运营 --reason "回滚"')
    print("  python3 cli.py report-summary")
    print("  python3 cli.py export --prefix result_")
    print("\n一键验证命令:")
    print("  python3 verify_full_flow.py")

if __name__ == "__main__":
    main()
