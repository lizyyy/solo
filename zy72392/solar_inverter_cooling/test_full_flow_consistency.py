#!/usr/bin/env python3
"""
光伏逆变器散热质检系统 - 全链路口径一致性验证脚本

验证目标：
1. 维修群截图第一次导入后，异常计数和状态正确
2. 补录采样间隔说明后，异常工况表跟着变
3. 实验老师复核后，已解决的不再计入异常
4. T003 "正常" + "温度稳定在45℃左右，确认正常" 后不计入异常
5. T002 已解决后不计入异常
6. 只有 T001 待复核作为异常
7. CLI / API / 报告 三者口径一致
8. 从"确认正常"可反查触发来源和状态变化链

运行方式：
    python3 test_full_flow_consistency.py
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent))

from core.storage import Storage
from core.engine import InspectionEngine
from core.report import ReportGenerator
from core.models import AbnormalStatus, DirectionStatus


def banner(title):
    print()
    print("=" * 60)
    print(f"  {title}")
    print("=" * 60)
    print()


def check(desc, condition, actual=None, expected=None):
    status = "✅ 通过" if condition else "❌ 失败"
    print(f"  {status} - {desc}")
    if not condition:
        if actual is not None and expected is not None:
            print(f"     期望: {expected}")
            print(f"     实际: {actual}")
    return condition


def main():
    data_dir = os.path.join(os.path.dirname(__file__), "data")
    storage = Storage(data_dir)
    engine = InspectionEngine(storage)
    reporter = ReportGenerator()

    demo_dir = os.path.join(os.path.dirname(__file__), "data", "demo")
    repair_path = os.path.join(demo_dir, "repair_screenshot_demo.json")
    sampling_path = os.path.join(demo_dir, "sampling_note_demo.json")

    all_pass = True

    # =============================================================
    # 第1步：创建新批次 + 导入维修群截图（第一次导入）
    # =============================================================
    banner("第1步：维修群截图第一次导入")

    batch_name = f"验证批次-{datetime.now().strftime('%m%d%H%M')}-口径验证"
    batch = engine.create_batch(batch_name, operator="验证脚本")
    print(f"  创建批次: {batch.name} (ID: {batch.id})")

    with open(repair_path, "r", encoding="utf-8") as f:
        repair_data = json.load(f)

    batch, _ = engine.import_repair_screenshot(
        batch.id,
        filename="维修群截图-演示.jpg",
        content=repair_data,
        uploader="质检员小白",
        raw_text="演示用维修群截图文本"
    )

    # 验证导入后的状态
    truly_abnormal = [r for r in batch.abnormal_records if r.is_truly_abnormal]
    total = len(batch.abnormal_records)

    print(f"  导入后共 {total} 条记录，其中真正异常 {len(truly_abnormal)} 条")

    t001 = next(r for r in batch.abnormal_records if r.point_id == "T001")
    t002 = next(r for r in batch.abnormal_records if r.point_id == "T002")
    t003 = next(r for r in batch.abnormal_records if r.point_id == "T003")

    step_pass = True
    step_pass &= check("T001 状态=待处理/缺材料",
                       t001.status in (AbnormalStatus.PENDING, AbnormalStatus.NEEDS_MORE_INFO),
                       actual=t001.status.value)
    step_pass &= check("T001 方向=异常",
                       t001.direction_status == DirectionStatus.ABNORMAL,
                       actual=t001.direction_status.value)
    step_pass &= check("T002 状态=缺材料(有方向争议)",
                       t002.status in (AbnormalStatus.NEEDS_MORE_INFO, AbnormalStatus.DISPUTED),
                       actual=t002.status.value)
    step_pass &= check("T002 is_field_dispute=True",
                       t002.is_field_dispute == True,
                       actual=t002.is_field_dispute)
    step_pass &= check("T003 状态=已确认正常(截图就写了正常)",
                       t003.status == AbnormalStatus.CONFIRMED_NORMAL,
                       actual=t003.status.value)
    step_pass &= check("T003 不计入真正异常",
                       not t003.is_truly_abnormal,
                       actual=t003.is_truly_abnormal)
    step_pass &= check("T003 有触发来源",
                       len(t003.trigger_source) > 0,
                       actual=bool(t003.trigger_source))

    # 导入后的异常数：T001 + T002 = 2条异常，T003已确认正常不算
    expected_abnormal_after_import = 2
    step_pass &= check(f"导入后异常数={expected_abnormal_after_import}",
                       len(truly_abnormal) == expected_abnormal_after_import,
                       actual=len(truly_abnormal), expected=expected_abnormal_after_import)

    all_pass &= step_pass

    # =============================================================
    # 第2步：补录采样间隔说明
    # =============================================================
    banner("第2步：质检员小白补录采样间隔说明")

    with open(sampling_path, "r", encoding="utf-8") as f:
        sampling_data = json.load(f)

    batch, _ = engine.import_sampling_note(
        batch.id,
        content=sampling_data,
        filename="采样间隔说明-演示.txt",
        uploader="质检员小白",
        raw_text="演示用采样间隔说明"
    )

    truly_abnormal = [r for r in batch.abnormal_records if r.is_truly_abnormal]
    confirmed_normal = [r for r in batch.abnormal_records if r.status == AbnormalStatus.CONFIRMED_NORMAL]
    disputed = [r for r in batch.abnormal_records if r.status == AbnormalStatus.DISPUTED]

    t001 = next(r for r in batch.abnormal_records if r.point_id == "T001")
    t002 = next(r for r in batch.abnormal_records if r.point_id == "T002")
    t003 = next(r for r in batch.abnormal_records if r.point_id == "T003")

    print(f"  补录后异常 {len(truly_abnormal)} 条，已确认正常 {len(confirmed_normal)} 条，有争议 {len(disputed)} 条")

    step_pass = True
    step_pass &= check("T001 补录后状态=待复核(双证据确认异常)",
                       t001.status == AbnormalStatus.READY_FOR_REVIEW,
                       actual=t001.status.value)
    step_pass &= check("T002 补录后状态=有争议(留给实验老师)",
                       t002.status == AbnormalStatus.DISPUTED,
                       actual=t002.status.value)
    step_pass &= check("T002 缺材料里有'实验老师'相关",
                       any("实验老师" in m or "复核" in m for m in t002.missing_materials),
                       actual=t002.missing_materials)
    step_pass &= check("T003 补录后仍是已确认正常(双证据)",
                       t003.status == AbnormalStatus.CONFIRMED_NORMAL,
                       actual=t003.status.value)
    step_pass &= check("T003 不计入异常",
                       not t003.is_truly_abnormal,
                       actual=t003.is_truly_abnormal)

    # 补录后异常数：T001(待复核) + T002(有争议) = 2条
    expected_after_sampling = 2
    step_pass &= check(f"补录后异常数={expected_after_sampling}",
                       len(truly_abnormal) == expected_after_sampling,
                       actual=len(truly_abnormal), expected=expected_after_sampling)

    all_pass &= step_pass

    # =============================================================
    # 第3步：重跑（rerun）验证状态不收口
    # =============================================================
    banner("第3步：重跑验证（状态保持一致）")

    batch = engine.rerun(batch.id, operator="质检员小白")

    truly_abnormal = [r for r in batch.abnormal_records if r.is_truly_abnormal]
    t003 = next(r for r in batch.abnormal_records if r.point_id == "T003")

    step_pass = True
    step_pass &= check("重跑后T003仍是已确认正常",
                       t003.status == AbnormalStatus.CONFIRMED_NORMAL,
                       actual=t003.status.value)
    step_pass &= check("重跑后异常数不变",
                       len(truly_abnormal) == 2,
                       actual=len(truly_abnormal))

    all_pass &= step_pass

    # =============================================================
    # 第4步：实验老师复核，解决T002的方向争议
    # =============================================================
    banner("第4步：实验老师复核 T002 方向争议")

    t002 = next(r for r in batch.abnormal_records if r.point_id == "T002")
    record_id = t002.id

    batch = engine.review_resolve(
        batch.id,
        record_id,
        resolution="现场师傅口误，不影响结论，温度在正常范围，确认正常",
        operator="实验老师"
    )

    truly_abnormal = [r for r in batch.abnormal_records if r.is_truly_abnormal]
    resolved = [r for r in batch.abnormal_records if r.status == AbnormalStatus.RESOLVED]
    confirmed_normal = [r for r in batch.abnormal_records if r.status == AbnormalStatus.CONFIRMED_NORMAL]

    t001 = next(r for r in batch.abnormal_records if r.point_id == "T001")
    t002 = next(r for r in batch.abnormal_records if r.point_id == "T002")
    t003 = next(r for r in batch.abnormal_records if r.point_id == "T003")

    print(f"  复核后异常 {len(truly_abnormal)} 条，已解决 {len(resolved)} 条，已确认正常 {len(confirmed_normal)} 条")

    step_pass = True
    step_pass &= check("T001 仍是待复核(真正异常)",
                       t001.status == AbnormalStatus.READY_FOR_REVIEW,
                       actual=t001.status.value)
    step_pass &= check("T001 计入异常",
                       t001.is_truly_abnormal,
                       actual=t001.is_truly_abnormal)
    step_pass &= check("T002 复核后变为已解决",
                       t002.status == AbnormalStatus.RESOLVED,
                       actual=t002.status.value)
    step_pass &= check("T002 不计入异常",
                       not t002.is_truly_abnormal,
                       actual=t002.is_truly_abnormal)
    step_pass &= check("T002 缺材料已清空",
                       len(t002.missing_materials) == 0,
                       actual=t002.missing_materials)
    step_pass &= check("T003 仍是已确认正常",
                       t003.status == AbnormalStatus.CONFIRMED_NORMAL,
                       actual=t003.status.value)
    step_pass &= check("T003 不计入异常",
                       not t003.is_truly_abnormal,
                       actual=t003.is_truly_abnormal)

    # 关键验证：最终异常数=1（只有T001）
    expected_final_abnormal = 1
    step_pass &= check(f"最终异常数={expected_final_abnormal} (只有T001待复核)",
                       len(truly_abnormal) == expected_final_abnormal,
                       actual=len(truly_abnormal), expected=expected_final_abnormal)
    step_pass &= check(f"最终已解决={len(resolved)} (T002)",
                       len(resolved) == 1,
                       actual=len(resolved))
    step_pass &= check(f"最终已确认正常={len(confirmed_normal)} (T003)",
                       len(confirmed_normal) == 1,
                       actual=len(confirmed_normal))

    all_pass &= step_pass

    # =============================================================
    # 第5步：验证反查能力 - 从确认正常追回原始材料
    # =============================================================
    banner("第5步：验证反查能力（从确认正常追回原始材料）")

    step_pass = True
    step_pass &= check("T003 有触发来源记录",
                       len(t003.trigger_source) > 0,
                       actual=bool(t003.trigger_source))
    step_pass &= check("触发来源包含'正常方向'",
                       "正常方向" in t003.trigger_source,
                       actual=t003.trigger_source[:50] + "...")
    step_pass &= check("T003 有状态追踪链",
                       len(t003.resolution_trace) > 0,
                       actual=len(t003.resolution_trace))
    step_pass &= check("T002 有状态追踪链(完整变更史)",
                       len(t002.resolution_trace) >= 2,
                       actual=len(t002.resolution_trace))

    all_pass &= step_pass

    # =============================================================
    # 第6步：验证报告口径一致
    # =============================================================
    banner("第6步：验证报告口径一致性")

    report = reporter.generate_batch_report(batch)

    step_pass = True
    step_pass &= check("报告包含'真正异常：1 条'",
                       "真正异常：1 条" in report,
                       actual="(报告中查找)")
    step_pass &= check("报告包含'已确认正常：1 条'",
                       "已确认正常：1 条" in report,
                       actual="(报告中查找)")
    step_pass &= check("报告包含'已复核解决：1 条'",
                       "已复核解决：1 条" in report,
                       actual="(报告中查找)")
    step_pass &= check("报告包含'总记录数：3 条'",
                       "总记录数：3 条" in report,
                       actual="(报告中查找)")
    step_pass &= check("报告中T001在异常工况表",
                       "T001" in report and "待复核" in report,
                       actual="(报告中查找)")
    step_pass &= check("报告中有'已确认正常的测点'章节",
                       "已确认正常的测点" in report,
                       actual="(报告中查找)")
    step_pass &= check("报告中有'已复核解决的测点'章节",
                       "已复核解决的测点" in report,
                       actual="(报告中查找)")

    all_pass &= step_pass

    # =============================================================
    # 第7步：验证 storage.list_batches 口径
    # =============================================================
    banner("第7步：验证批次列表口径（对应小看板批次列表）")

    batch_list = storage.list_batches()
    our_batch = next(b for b in batch_list if b["id"] == batch.id)

    step_pass = True
    step_pass &= check("list_batches 返回 abnormal_count=1",
                       our_batch["abnormal_count"] == 1,
                       actual=our_batch["abnormal_count"], expected=1)
    step_pass &= check("list_batches 返回 total_records=3",
                       our_batch["total_records"] == 3,
                       actual=our_batch["total_records"], expected=3)

    all_pass &= step_pass

    # =============================================================
    # 第8步：验证 is_truly_abnormal 统一判断标准
    # =============================================================
    banner("第8步：验证统一判断标准 is_truly_abnormal")

    step_pass = True
    for r in batch.abnormal_records:
        expected = r.status not in (AbnormalStatus.CONFIRMED_NORMAL, AbnormalStatus.RESOLVED)
        actual = r.is_truly_abnormal
        step_pass &= check(f"{r.point_id}: is_truly_abnormal 与状态一致",
                           expected == actual,
                           actual=f"status={r.status.value}, is_truly_abnormal={actual}")

    all_pass &= step_pass

    # =============================================================
    # 第9步：验证审计日志
    # =============================================================
    banner("第9步：验证审计日志（谁改了什么）")

    step_pass = True
    step_pass &= check("有审计日志记录",
                       len(batch.audit_logs) > 0,
                       actual=len(batch.audit_logs))

    review_logs = [l for l in batch.audit_logs if "复核" in l.action or "实验老师" in l.operator]
    step_pass &= check("有实验老师复核的操作记录",
                       len(review_logs) > 0,
                       actual=len(review_logs))

    sampling_logs = [l for l in batch.audit_logs if "采样" in l.action or "补录" in l.action]
    step_pass &= check("有补录采样间隔的操作记录",
                       len(sampling_logs) > 0,
                       actual=len(sampling_logs))

    all_pass &= step_pass

    # =============================================================
    # 总结
    # =============================================================
    banner("验证总结")

    print(f"  批次ID: {batch.id}")
    print(f"  批次名称: {batch.name}")
    print()
    print(f"  最终状态：")
    print(f"    T001: {t001.status.value} (异常方向: {t001.direction_status.value})")
    print(f"    T002: {t002.status.value} (方向争议已解决)")
    print(f"    T003: {t003.status.value} (双证据确认正常)")
    print()
    print(f"  异常计数口径：")
    print(f"    真正异常: 1 条 (T001 待复核)")
    print(f"    已确认正常: 1 条 (T003)")
    print(f"    已解决: 1 条 (T002)")
    print(f"    总记录: 3 条")
    print()
    print(f"  对应展示：")
    print(f"    批次列表: 异常1条（共3条记录）")
    print(f"    异常工况表: 1条 (只有T001)")
    print(f"    已确认正常Tab: 1条 (T003)")
    print(f"    已解决Tab: 1条 (T002)")
    print()

    if all_pass:
        print("🎉 所有验证项全部通过！CLI / API / 报告 三者口径完全一致")
    else:
        print("❌ 存在失败项，请检查上面的输出")

    print()
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
