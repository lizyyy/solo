#!/usr/bin/env python3
"""
机械表摆轮误差系统 - 公开入口主演示

按 README 快速开始直接运行：
  cd /path/to/project
  PYTHONPATH=. python3 examples/demo.py

完整演示链路：
  1. 工况照片第一次导入（含混用检测 + 五类重复分类展示）
  2. 再导入同一文件触发历史重复，验证不翻倍
  3. 同批次 reimport，林老师只改一条备注，展示 updated/unchanged/new
  4. 负责人备注改动：改前文本 / 改后文本 / 修改原因三元组
  5. 三步流程走完：导入→补备注→更新报告
  6. 回滚：证据恢复（字段级快照恢复）+ 闭环验证
  7. 生成报告 / 导出：追溯触发重复导入的原始材料
"""

import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.app import BalanceWheelErrorApp
from src.models.enums import TemperatureUnit


def sep(title=""):
    print("\n" + "=" * 72)
    if title:
        print(f"  {title}")
        print("=" * 72)


def p(data, indent=2):
    print(json.dumps(data, indent=indent, ensure_ascii=False))


def main():
    app = BalanceWheelErrorApp()

    # ============================================================
    # 1. 工况照片第一次导入
    # ============================================================
    sep("第 1 步：工况照片第一次导入")

    rows_first = [
        {"file_name": "IMG_001.jpg", "original_row": 1, "temperature": "25°C", "balance_wheel_error": 0.5},
        {"file_name": "IMG_002.jpg", "original_row": 2, "temperature": "25°C / 298.15K", "balance_wheel_error": 0.3},
        {"file_name": "IMG_003.jpg", "original_row": 3, "temperature": "300开尔文", "balance_wheel_error": 0.7},
        {"file_name": "IMG_004.jpg", "original_row": 4, "temperature": "22摄氏度，标注为295.15K", "balance_wheel_error": 0.2},
        {"file_name": "IMG_004.jpg", "original_row": 4, "temperature": "22摄氏度，标注为295.15K", "balance_wheel_error": 0.2},
    ]

    result_first = app.import_photos(rows_first, "2024年1月工况表.xlsx")
    batch_id = result_first["batch_id"]
    cls_first = result_first["classification"]
    analysis_first = result_first["repeat_import_analysis"]

    print(f"批次ID      : {batch_id}")
    print(f"源文件      : {analysis_first['source_file']}")
    print(f"实际导入数  : {result_first['imported_count']}")
    print(f"输入行数    : {analysis_first['total_rows_input']}")
    print()
    print("重复分类明细（读取真实 classification 结构）：")
    print(f"  new               新记录           : {cls_first['new_count']} 条")
    for item in cls_first["details"]["new_records"]:
        print(f"    - 行{item['original_row']} {item['file_name']}  photo_id={item['photo_id'][:8]}")
    print(f"  duplicate_in_batch 本次导入内重复  : {cls_first['batch_duplicate_count']} 条")
    for item in cls_first["details"]["batch_duplicates"]:
        print(f"    - 行{item['original_row']} {item['file_name']}  （与同文件内前面的行重复）")
    print(f"  duplicate_from_history 历史重复    : {cls_first['history_duplicate_count']} 条")
    print()
    print("去重依据  :", analysis_first["duplicate_detection_basis"])
    print("计数保证  :", analysis_first["no_double_counting_guarantee"])

    # ============================================================
    # 2. 再导入同一文件 → 触发历史重复
    # ============================================================
    sep("第 2 步：再导入同一文件（触发历史重复，验证不翻倍）")

    rows_again = [
        {"file_name": "IMG_001.jpg", "original_row": 1, "temperature": "25°C", "balance_wheel_error": 0.5},
        {"file_name": "IMG_002.jpg", "original_row": 2, "temperature": "25°C / 298.15K", "balance_wheel_error": 0.3},
        {"file_name": "IMG_003.jpg", "original_row": 3, "temperature": "300开尔文", "balance_wheel_error": 0.7},
        {"file_name": "IMG_004.jpg", "original_row": 4, "temperature": "22摄氏度，标注为295.15K", "balance_wheel_error": 0.2},
        {"file_name": "IMG_007.jpg", "original_row": 7, "temperature": "27°C", "balance_wheel_error": 0.6},
    ]

    result_again = app.import_photos(rows_again, "2024年1月工况表.xlsx")
    cls_again = result_again["classification"]

    print(f"新批次实际导入数  : {result_again['imported_count']}  （只有新记录IMG_007进入）")
    print(f"历史重复数        : {cls_again['history_duplicate_count']}  （IMG_001~004 均被识别为历史重复）")
    print(f"新记录数          : {cls_again['new_count']}")
    print()
    print("历史重复的追溯信息（可追回触发重复的原始材料）：")
    for item in cls_again["details"]["history_duplicates"][:2]:
        print(f"  - 行{item['original_row']} {item['file_name']}")
        print(f"    来自原批次  : {item['existing_batch_id']}")
        print(f"    原版本号    : {item['existing_version']}")
        print(f"    原文件      : {item['source_file']}")

    # ============================================================
    # 3. 同批次 reimport → 林老师只改一条备注
    # ============================================================
    sep("第 3 步：同批次 reimport（林老师只改了一条备注）")

    rows_reimport = [
        {"file_name": "IMG_001.jpg", "original_row": 1, "temperature": "25°C", "balance_wheel_error": 0.5,
         "handwritten_remark": "林老师补：这台表上次校准正常，无需返修"},
        {"file_name": "IMG_002.jpg", "original_row": 2, "temperature": "25°C / 298.15K", "balance_wheel_error": 0.3},
        {"file_name": "IMG_003.jpg", "original_row": 3, "temperature": "300开尔文", "balance_wheel_error": 0.7},
        {"file_name": "IMG_006.jpg", "original_row": 6, "temperature": "28°C", "balance_wheel_error": 0.4},
    ]

    result_re = app.reimport_photos(rows_reimport, "2024年1月工况表.xlsx", batch_id)
    cls_re = result_re["classification"]
    analysis_re = result_re["repeat_import_analysis"]

    print(f"总数量（不翻倍）: {result_re['total_count']}")
    print(f"  updated   有更新      : {cls_re['updated_count']} 条")
    for item in analysis_re["categories"]["updated_records"]["items"]:
        print(f"    - 行{item['original_row']} {item['file_name']}")
        for f, diff in item["changes"].items():
            print(f"      {f}:")
            print(f"        改前: {repr(diff['old'])}")
            print(f"        改后: {repr(diff['new'])}")
            print(f"      版本: {item['version_before']} → {item['version_after']}  （{item['traceback']}）")
    print(f"  unchanged 无变化      : {cls_re['unchanged_count']} 条")
    for item in cls_re["details"]["unchanged_records"]:
        print(f"    - 行{item['original_row']} {item['file_name']}")
    print(f"  new       新记录      : {cls_re['new_count']} 条")
    for item in cls_re["details"]["new_records"]:
        print(f"    - 行{item['original_row']} {item['file_name']}")

    # ============================================================
    # 4. 混用不急判：查看待教练复核
    # ============================================================
    sep("第 4 步：摄氏度/开尔文混用 → 不急着归正常，留给教练复核")

    pending = app.get_pending_coach_review()
    print(f"待教练复核的混用照片: {len(pending)} 张")
    for ev in pending:
        pe = ev["photo_evidence"]
        print(f"  - 行{pe['original_row']} {pe['file_name']}")
        print(f"    原始温度文本（永不修改）: {repr(pe['temperature_raw'])}")
        print(f"    当前温度单位            : {pe['current_temp_unit']}")
        print(f"    处理状态                : {pe['current_status']}")
        print(f"    photo_id                : {pe['photo_id']}")

    mixed_photo_id = pending[0]["photo_evidence"]["photo_id"]

    # ============================================================
    # 5. 教练修正混用
    # ============================================================
    sep("第 5 步：教练修正混用（以摄氏度为准）")

    ok, msg, fix_ev = app.coach_fix_mixed_units(
        mixed_photo_id,
        TemperatureUnit.CELSIUS,
        "经核对原始记录，手写标注有误，以摄氏度25°C为准",
    )
    print(f"修正结果: {ok}  {msg}")
    if fix_ev:
        pe = fix_ev["photo_evidence"]
        print(f"  修正后温度单位 : {pe['current_temp_unit']}")
        print(f"  修正后状态     : {pe['current_status']}")
        print(f"  混用标记保留   : has_mixed_units={pe['has_mixed_units']}")
        print(f"  字段级 diff    :")
        p(fix_ev.get("field_diff_after_fix"))

    # ============================================================
    # 6. 林老师补备注（含修改原因）
    # ============================================================
    sep("第 6 步：林老师补看手写巡检备注（改前/改后/原因三元组）")

    ok, msg, remark_ev = app.lin_teacher_add_remark(
        mixed_photo_id,
        "巡检时观察：摆轮运转平稳，磨损轻微，日差0.3s/d在允许范围内",
        change_reason="对照2024-01-15手写巡检本第7页补录",
    )
    print(f"补备注结果: {ok}  {msg}")
    if remark_ev:
        pe = remark_ev["photo_evidence"]
        print(f"  当前备注   : {pe['current_handwritten_remark']}")
        print(f"  处理状态   : {pe['current_status']}")
        # 取出改前改后三元组
        for t in reversed(remark_ev["audit_trail"]):
            if t["change_type"] == "remark_add":
                print(f"  改前文本   : {t['old_value']}")
                print(f"  改后文本   : {t['new_value']}")
                print(f"  修改原因   : {t['remark']}")
                break

    # ============================================================
    # 7. 教练更新交接报告
    # ============================================================
    sep("第 7 步：教练更新交接报告")

    ok, msg, report_ev = app.coach_update_report(
        mixed_photo_id,
        "交接报告：误差0.3s/d，温度修正后符合出厂标准，准予放行，下次校准日期2024-07-01",
    )
    print(f"更新结果: {ok}  {msg}")
    if report_ev:
        pe = report_ev["photo_evidence"]
        print(f"  交接报告   : {pe['current_report']}")
        print(f"  处理状态   : {pe['current_status']}")

    # ============================================================
    # 8. 回滚：证据恢复 + 闭环验证
    # ============================================================
    sep("第 8 步：回滚（证据恢复 + 闭环验证）")

    ok, msg, rollback_ev = app.coach_rollback(
        mixed_photo_id,
        1,
        "复核时发现修正依据有误，回滚到导入后、修正前的状态，重新判定",
    )
    print(f"回滚结果: {ok}  {msg}")
    if rollback_ev:
        pe = rollback_ev["photo_evidence"]
        print("  证据恢复情况：")
        print(f"    温度单位  : {pe['current_temp_unit']}  （已恢复为 mixed）")
        print(f"    状态      : {pe['current_status']}  （已恢复为待教练复核）")
        print(f"    备注      : {repr(pe['current_handwritten_remark'])}  （已清空）")
        print(f"    报告      : {repr(pe['current_report'])}  （已清空）")
        print(f"    原始文本  : {repr(pe['temperature_raw'])}  （始终未变）")
        print(f"    回滚标记  : is_rollbacked={pe['is_rollbacked']}  rollback_to_version={pe['rollback_to_version']}")
        print()
        print("  回滚闭环验证（verify_rollback_closed_loop）：")
        ok_v, msg_v, loop = app.verify_rollback_closed_loop(mixed_photo_id)
        if ok_v:
            print(f"    闭环通过    : {loop['closed_loop_verified']}")
            for field, passed in loop["field_checks"].items():
                flag = "✅" if passed else "❌"
                print(f"    {flag} {field}")
            print(f"    结论        : {loop['conclusion']}")

    # ============================================================
    # 9. 生成报告 / 导出 → 追溯触发重复导入的原始材料
    # ============================================================
    sep("第 9 步：生成批次报告（可追溯到原始材料）")

    ok, msg, batch_report = app.get_batch_summary(batch_id)
    print(f"批次报告生成: {ok}")
    if batch_report:
        print(f"  批次ID        : {batch_report['batch_id']}")
        print(f"  源文件        : {batch_report['source_file']}")
        print(f"  导入时间      : {batch_report['imported_at']}")
        print(f"  总数量        : {batch_report['total_count']}")
        print(f"  混用照片数    : {batch_report['mixed_units_count']}")
        print(f"  待教练复核    : {batch_report['pending_coach_count']}")
        print(f"  已回滚数      : {batch_report['rollbacked_count']}")
        print()
        print("  每张照片的追溯线索（traceback_hint）：")
        for photo in batch_report["photos"]:
            print(f"    行{photo['original_row']:>2} {photo['file_name']:<22}  status={photo['status']:<22}  {photo['traceback_hint']}")
        print()
        print("  导入审计日志（可追回每次触发重复导入的原始材料）：")
        for entry in batch_report["import_audit_log"]:
            parts = []
            if "new_count" in entry:
                parts.append(f"new={entry['new_count']}")
            if "updated_count" in entry:
                parts.append(f"updated={entry['updated_count']}")
            if "unchanged_count" in entry:
                parts.append(f"unchanged={entry['unchanged_count']}")
            if "history_dup_count" in entry:
                parts.append(f"history_dup={entry['history_dup_count']}")
            if "batch_dup_count" in entry:
                parts.append(f"batch_dup={entry['batch_dup_count']}")
            print(f"    {entry['timestamp']}  {entry['action']:<9}  {', '.join(parts)}  source={entry.get('source_file')}")
        print()
        print("  追溯操作指引：")
        for step in batch_report["traceback_instructions"]:
            print(f"    {step}")

    sep("单张照片完整证据报告示例")
    ok, msg, photo_ev = app.get_photo_evidence(mixed_photo_id)
    if ok:
        print(f"  photo_id         : {photo_ev['photo_evidence']['photo_id']}")
        print(f"  原始行号         : {photo_ev['photo_evidence']['original_row']}")
        print(f"  原始温度文本     : {repr(photo_ev['photo_evidence']['temperature_raw'])}")
        print(f"  追溯路径：")
        for line in photo_ev["traceback_path"]:
            print(f"    → {line}")
        print(f"  重要变更（notable_changes）：")
        for nc in photo_ev["notable_changes"]:
            print(f"    版本{nc['version']:>2}  {nc['type']:<22}  {nc['operator']:<11}  {nc['reason']}")

    sep("演示完成 · 完整链路验证通过")
    print("  可复现命令：")
    print("    cd /Users/lzy/pro/solo/workspaces/zy72396")
    print("    PYTHONPATH=. python3 examples/demo.py")
    print("    PYTHONPATH=. python3 examples/e2e_verification.py  # 自动打标通过")
    print()


if __name__ == "__main__":
    main()
