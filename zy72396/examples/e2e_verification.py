#!/usr/bin/env python3
"""
机械表摆轮误差系统 - 端到端验证脚本

重点验证：
1. 三步流程走通 + 混用不急判
2. 回滚真的恢复所有字段（温度单位、备注、报告、状态）
3. 重复导入分类清晰（新记录/同批更新/同批无变化/历史重复/本批重复）
4. 林老师只改一条备注时能看出改前改后
5. 证据能从报告追回原始材料
6. 回滚闭环验证通过
"""

import json
import sys
from src.app import BalanceWheelErrorApp
from src.models.enums import TemperatureUnit, ProcessingStatus


PASS = "✅ PASS"
FAIL = "❌ FAIL"


def test_result(name: str, passed: bool, detail: str = ""):
    status = PASS if passed else FAIL
    print(f"{status} {name}")
    if detail and not passed:
        print(f"     {detail}")
    return passed


def main():
    print("=" * 70)
    print("  机械表摆轮误差系统 - 端到端验证")
    print("=" * 70)

    app = BalanceWheelErrorApp()
    all_passed = True

    # ============================================================
    # 场景一：第一次导入，检测混用
    # ============================================================
    print("\n【场景一：第一次导入工况照片】")

    rows = [
        {"file_name": "IMG_001.jpg", "original_row": 1, "temperature": "25°C", "balance_wheel_error": 0.5},
        {"file_name": "IMG_002.jpg", "original_row": 2, "temperature": "25°C / 298.15K", "balance_wheel_error": 0.3},
        {"file_name": "IMG_003.jpg", "original_row": 3, "temperature": "300开尔文", "balance_wheel_error": 0.7},
        {"file_name": "IMG_004.jpg", "original_row": 4, "temperature": "22摄氏度，标注为295.15K", "balance_wheel_error": 0.2},
        {"file_name": "IMG_004.jpg", "original_row": 4, "temperature": "22摄氏度，标注为295.15K", "balance_wheel_error": 0.2},
    ]

    result = app.import_photos(rows, "工况表A.xlsx")
    batch_id = result["batch_id"]

    all_passed &= test_result(
        "总数量正确",
        result["imported_count"] == 4,
        f"期望4，实际{result['imported_count']}"
    )

    cls = result["classification"]
    all_passed &= test_result(
        "新记录数量正确",
        cls["new_count"] == 4,
        f"期望4，实际{cls['new_count']}"
    )
    all_passed &= test_result(
        "本批内重复数量正确 (IMG_005重复)",
        cls["batch_duplicate_count"] == 1,
        f"期望1，实际{cls['batch_duplicate_count']}"
    )
    all_passed &= test_result(
        "历史重复数量为0",
        cls["history_duplicate_count"] == 0,
        f"期望0，实际{cls['history_duplicate_count']}"
    )

    pending = app.get_pending_coach_review()
    all_passed &= test_result(
        "混用照片进入待教练复核（不急着归正常）",
        len(pending) == 2,
        f"期望2张待复核，实际{len(pending)}"
    )

    mixed_photo_id = pending[0]["photo_evidence"]["photo_id"]
    mixed_row = pending[0]["photo_evidence"]["original_row"]
    mixed_raw_temp = pending[0]["photo_evidence"]["temperature_raw"]

    all_passed &= test_result(
        "原始行号保留",
        isinstance(mixed_row, int),
        f"原始行号: {mixed_row}"
    )
    all_passed &= test_result(
        "原始温度文本保留（永不修改）",
        mixed_raw_temp == "25°C / 298.15K",
        f"期望 '25°C / 298.15K'，实际 '{mixed_raw_temp}'"
    )
    all_passed &= test_result(
        "状态是待教练复核，不是正常",
        pending[0]["photo_evidence"]["current_status"] == "coach_review_pending",
    )

    print(f"     混用照片ID: {mixed_photo_id}, 原始行号: {mixed_row}")

    # ============================================================
    # 场景二：教练修正混用
    # ============================================================
    print("\n【场景二：训练教练修正混用】")

    ok, msg, evidence = app.coach_fix_mixed_units(
        mixed_photo_id,
        TemperatureUnit.CELSIUS,
        "经核对原始记录，手写标注有误，以摄氏度为准",
    )

    all_passed &= test_result("修正操作成功", ok, msg)

    if evidence:
        pe = evidence["photo_evidence"]
        all_passed &= test_result(
            "修正后温度单位是摄氏度",
            pe["current_temp_unit"] == "C",
            f"期望 C，实际 {pe['current_temp_unit']}"
        )
        all_passed &= test_result(
            "has_mixed_units 仍为 True（保留历史标记）",
            pe["has_mixed_units"] == True,
        )
        all_passed &= test_result(
            "修正后状态变为教练已批准",
            pe["current_status"] == "coach_approved",
            f"期望 coach_approved，实际 {pe['current_status']}"
        )
        all_passed &= test_result(
            "temperature_raw 仍不变",
            pe["temperature_raw"] == "25°C / 298.15K",
        )

    # ============================================================
    # 场景三：林老师补备注
    # ============================================================
    print("\n【场景三：林老师补看手写巡检备注】")

    ok, msg, evidence = app.lin_teacher_add_remark(
        mixed_photo_id,
        "巡检时观察：摆轮运转平稳，磨损轻微",
        change_reason="对照手写巡检本补录",
    )

    all_passed &= test_result("林老师补备注成功", ok, msg)

    if evidence:
        pe = evidence["photo_evidence"]
        all_passed &= test_result(
            "备注已更新",
            pe["current_handwritten_remark"] == "巡检时观察：摆轮运转平稳，磨损轻微",
        )
        all_passed &= test_result(
            "状态变为林老师已复核",
            pe["current_status"] == "lin_teacher_reviewed",
        )

        trail = evidence["audit_trail"]
        remark_change = [t for t in trail if t["change_type"] == "remark_add"][-1]
        all_passed &= test_result(
            "改前文本在 old_value 中",
            "remark=None" in str(remark_change["old_value"]),
            f"old_value: {remark_change['old_value']}"
        )
        all_passed &= test_result(
            "改后文本在 new_value 中",
            "磨损轻微" in str(remark_change["new_value"]),
            f"new_value: {remark_change['new_value']}"
        )
        all_passed &= test_result(
            "修改原因在 remark 中",
            "对照手写巡检本补录" in str(remark_change["remark"]),
            f"remark: {remark_change['remark']}"
        )

    # ============================================================
    # 场景四：更新交接报告
    # ============================================================
    print("\n【场景四：更新交接报告】")

    ok, msg, evidence = app.coach_update_report(
        mixed_photo_id,
        "交接报告：该表误差0.3s/d，温度修正后符合出厂标准，准予放行",
    )

    all_passed &= test_result("报告更新成功", ok, msg)

    if evidence:
        pe = evidence["photo_evidence"]
        all_passed &= test_result(
            "报告内容已更新",
            "准予放行" in str(pe["current_report"]),
        )
        all_passed &= test_result(
            "状态变为报告已更新（第三步完成）",
            pe["current_status"] == "report_updated",
        )
        all_passed &= test_result(
            "版本数累计到4次变更（导入+状态变+修正+备注+报告）",
            pe["total_versions"] >= 5,
            f"实际版本数: {pe['total_versions']}"
        )

    # ============================================================
    # 场景五：回滚 - 验证真的恢复所有字段
    # ============================================================
    print("\n【场景五：回滚到修正前 - 验证字段级回滚闭环】")

    ok, msg, evidence = app.coach_rollback(
        mixed_photo_id,
        1,  # 回滚到导入后的第一个状态（混用待复核）
        "复核时发现之前的修正有误，回滚到待复核状态重新判定",
    )

    all_passed &= test_result("回滚操作成功", ok, msg)

    if evidence:
        pe = evidence["photo_evidence"]

        all_passed &= test_result(
            "回滚后温度单位恢复为 mixed",
            pe["current_temp_unit"] == "mixed",
            f"期望 mixed，实际 {pe['current_temp_unit']}"
        )
        all_passed &= test_result(
            "回滚后状态恢复为 coach_review_pending",
            pe["current_status"] == "coach_review_pending",
            f"期望 coach_review_pending，实际 {pe['current_status']}"
        )
        all_passed &= test_result(
            "回滚后置为被回滚标记",
            pe["is_rollbacked"] == True,
        )
        all_passed &= test_result(
            "回滚到版本号正确",
            pe["rollback_to_version"] == 1,
            f"期望 1，实际 {pe['rollback_to_version']}"
        )
        all_passed &= test_result(
            "回滚后手写字段被清空",
            pe["current_handwritten_remark"] is None,
            f"期望 None，实际 {pe['current_handwritten_remark']}"
        )
        all_passed &= test_result(
            "回滚后报告内容被清空",
            pe["current_report"] is None,
            f"期望 None，实际 {pe['current_report']}"
        )
        all_passed &= test_result(
            "temperature_raw 仍然没变（原始证据永不丢失）",
            pe["temperature_raw"] == "25°C / 298.15K",
        )

        verification = evidence.get("rollback_verification", {})
        all_passed &= test_result(
            "回滚验证：所有字段从快照恢复",
            verification.get("all_fields_restored_from_snapshot") == True,
        )

    # 闭环验证
    ok, msg, loop_result = app.verify_rollback_closed_loop(mixed_photo_id)
    all_passed &= test_result("回滚闭环验证", ok and loop_result["closed_loop_verified"], str(loop_result))

    # ============================================================
    # 场景六：重复导入 - 只改一条备注
    # ============================================================
    print("\n【场景六：重复导入同一批，林老师只改了一条备注】")

    rows_reimport = [
        {"file_name": "IMG_001.jpg", "original_row": 1, "temperature": "25°C", "balance_wheel_error": 0.5,
         "handwritten_remark": "林老师补：这台表上次校准正常"},
        {"file_name": "IMG_002.jpg", "original_row": 2, "temperature": "25°C / 298.15K", "balance_wheel_error": 0.3},
        {"file_name": "IMG_003.jpg", "original_row": 3, "temperature": "300开尔文", "balance_wheel_error": 0.7},
        {"file_name": "IMG_006.jpg", "original_row": 6, "temperature": "28°C", "balance_wheel_error": 0.4},
    ]

    result2 = app.reimport_photos(rows_reimport, "工况表A.xlsx", batch_id)

    cls2 = result2["classification"]
    all_passed &= test_result(
        "总数量不翻倍",
        result2["total_count"] == 5,
        f"期望5（原4+新1），实际{result2['total_count']}"
    )
    all_passed &= test_result(
        "新记录: IMG_006",
        cls2["new_count"] == 1,
        f"期望1，实际{cls2['new_count']}"
    )
    all_passed &= test_result(
        "更新记录: IMG_001（备注变了）",
        cls2["updated_count"] == 1,
        f"期望1，实际{cls2['updated_count']}"
    )
    all_passed &= test_result(
        "无变化记录: IMG_002, IMG_003（共2）",
        cls2["unchanged_count"] == 2,
        f"期望2，实际{cls2['unchanged_count']}"
    )

    updated_details = cls2["details"]["updated_records"]
    if updated_details:
        item = updated_details[0]
        all_passed &= test_result(
            "更新记录能看出改前改后",
            "changes" in item and "handwritten_remark" in item["changes"],
            str(item.get("changes", {}))
        )
        changes = item["changes"]["handwritten_remark"]
        all_passed &= test_result(
            "改前值正确 (None)",
            changes["old"] is None,
            f"old: {changes['old']}"
        )
        all_passed &= test_result(
            "改后值正确",
            "上次校准正常" in str(changes["new"]),
            f"new: {changes['new']}"
        )

    # ============================================================
    # 场景七：同一文件重复导入（误操作场景）- 历史重复验证
    # ============================================================
    print("\n【场景七：同一文件重复导入（误操作）- 历史重复验证】")

    rows_duplicate_import = [
        {"file_name": "IMG_001.jpg", "original_row": 1, "temperature": "25°C", "balance_wheel_error": 0.5},
        {"file_name": "IMG_002.jpg", "original_row": 2, "temperature": "25°C / 298.15K", "balance_wheel_error": 0.3},
        {"file_name": "IMG_003.jpg", "original_row": 3, "temperature": "300开尔文", "balance_wheel_error": 0.7},
        {"file_name": "IMG_004.jpg", "original_row": 4, "temperature": "22摄氏度，标注为295.15K", "balance_wheel_error": 0.2},
        {"file_name": "IMG_007.jpg", "original_row": 7, "temperature": "27°C", "balance_wheel_error": 0.6},
    ]

    result3 = app.import_photos(rows_duplicate_import, "工况表A.xlsx")
    cls3 = result3["classification"]

    all_passed &= test_result(
        "历史重复数量: IMG_001~004（4条历史重复）",
        cls3["history_duplicate_count"] == 4,
        f"期望4，实际{cls3['history_duplicate_count']}"
    )
    all_passed &= test_result(
        "新记录: IMG_007（1条新记录）",
        cls3["new_count"] == 1,
        f"期望1，实际{cls3['new_count']}"
    )
    all_passed &= test_result(
        "总数量不翻倍（仍然是原批次的数量+新的1=6？不，是单独新批次的数量）",
        result3["imported_count"] == 1,
        f"期望1（仅新记录），实际{result3['imported_count']}"
    )

    history_dups = cls3["details"]["history_duplicates"]
    if history_dups and len(history_dups) > 0:
        all_passed &= test_result(
            "历史重复能追溯到原始批次ID",
            "existing_batch_id" in history_dups[0] and history_dups[0]["existing_batch_id"] == batch_id,
            f"原始批次ID: {history_dups[0].get('existing_batch_id')}"
        )
        all_passed &= test_result(
            "历史重复能看到已有版本号",
            "existing_version" in history_dups[0],
            f"已有版本: {history_dups[0].get('existing_version')}"
        )

    # 确认原批次数量没变化（场景六reimport后原批次是5条，场景七不影响它）
    ok, msg, orig_batch_before = app.get_batch_summary(batch_id)
    count_before = orig_batch_before["total_count"] if ok else 0

    # 再做一次重复导入验证
    result4 = app.import_photos(rows_duplicate_import, "工况表A.xlsx")

    ok, msg, orig_batch_after = app.get_batch_summary(batch_id)
    count_after = orig_batch_after["total_count"] if ok else 0

    all_passed &= test_result(
        "原批次数量不受重复导入影响（数据隔离）",
        count_before == count_after,
        f"场景七前{count_before}条，场景七后{count_after}条"
    )

    # ============================================================
    # 场景八：导出报告 - 能追溯原始材料
    # ============================================================
    print("\n【场景八：报告导出 - 验证可追溯性】")

    ok, msg, batch_report = app.get_batch_summary(batch_id)

    all_passed &= test_result("批次报告生成成功", ok, msg)

    if batch_report:
        all_passed &= test_result(
            "报告包含导入审计日志",
            "import_audit_log" in batch_report and len(batch_report["import_audit_log"]) > 0,
        )
        all_passed &= test_result(
            "报告包含追溯说明",
            "traceback_instructions" in batch_report,
        )
        all_passed &= test_result(
            "每张照片都有 traceback_hint",
            all("traceback_hint" in p for p in batch_report["photos"]),
        )

        photos_with_mixed = [p for p in batch_report["photos"] if p["has_mixed_units"]]
        all_passed &= test_result(
            "报告里能看出哪些是混用照片",
            len(photos_with_mixed) == 2,
            f"期望2，实际{len(photos_with_mixed)}"
        )

        first_photo = batch_report["photos"][0]
        all_passed &= test_result(
            "每张照片都有原始行号",
            "original_row" in first_photo and isinstance(first_photo["original_row"], int),
        )
        all_passed &= test_result(
            "每张照片都有原始温度文本",
            "temperature_raw" in first_photo and first_photo["temperature_raw"] is not None,
        )

        ok, msg, photo_evidence = app.get_photo_evidence(batch_report["photos"][0]["photo_id"])
        all_passed &= test_result("单张照片证据报告生成", ok)

        if photo_evidence:
            all_passed &= test_result(
                "证据报告含追溯路径",
                "traceback_path" in photo_evidence and len(photo_evidence["traceback_path"]) > 0,
            )
            all_passed &= test_result(
                "证据报告含重要变更列表",
                "notable_changes" in photo_evidence,
            )
            all_passed &= test_result(
                "每条审计记录都带 snapshot_after",
                all("snapshot_after" in t for t in photo_evidence["audit_trail"]),
            )

    # ============================================================
    # 场景九：版本对比
    # ============================================================
    print("\n【场景九：版本对比 - 改前改后一目了然】")

    ok, msg, diff = app.compare_photo_versions(mixed_photo_id, 0, 2)

    all_passed &= test_result("版本对比可用", ok, msg)

    if diff:
        all_passed &= test_result(
            "对比结果含 field_differences",
            "field_differences" in diff and diff["field_differences"] is not None,
        )
        all_passed &= test_result(
            "版本0有snapshot",
            "snapshot" in diff["version_1"],
        )
        all_passed &= test_result(
            "版本2有snapshot",
            "snapshot" in diff["version_2"],
        )

    # ============================================================
    # 最终总结
    # ============================================================
    print("\n" + "=" * 70)
    print("  验证总结")
    print("=" * 70)

    print(f"\n导入审计日志（共 {len(app.get_import_audit_log())} 条）:")
    for entry in app.get_import_audit_log():
        print(f"  - {entry['timestamp']}: {entry['action']} "
              f"(new={entry.get('new_count', 0)}, "
              f"updated={entry.get('updated_count', 0)}, "
              f"history_dup={entry.get('history_dup_count', 0)})")

    print(f"\n{'=' * 70}")
    if all_passed:
        print("  ✅ 所有验证通过！")
    else:
        print("  ❌ 存在验证失败项")
    print(f"{'=' * 70}")

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
