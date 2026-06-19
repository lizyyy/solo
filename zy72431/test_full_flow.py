#!/usr/bin/env python3
"""
音响租赁调音记录 - 全流程验证脚本
覆盖：导入 → 补录 → 人工修正 → 重跑 → 详情 → 历史 → 审批 → 报告 → 导出

验证重点（极光乐队核心样例）：
1. 请假课时被算进已消耗 → 待复核
2. 调音师名人工修正 → 字段实际更新
3. 人工修正后 → 状态仍为待复核
4. 列表/详情/历史/报告 → 四端一致，都能反查到同一条记录
5. 审批功能 → 确认/驳回 + 理由留存
"""

import sys
from processor import RecordProcessor
from demo_data import load_demo_data


def title(text):
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}")


def check(condition, desc):
    status = "✅ PASS" if condition else "❌ FAIL"
    print(f"  {status} - {desc}")
    return condition


def main():
    all_pass = True

    # ========== 第1步：初始化 + 导入演示数据 ==========
    title("第1步：导入演示数据（三步走 + 人工修正 + 重跑）")
    p = RecordProcessor()
    ids = load_demo_data(p)
    aurora_id = ids["record_1"]  # 极光乐队
    print(f"\n  极光乐队记录ID: {aurora_id}")

    # ========== 第2步：列表验证 ==========
    title("第2步：列表验证 - 极光乐队核心四要素")
    summary = p.get_records_summary()
    aurora = next(r for r in summary if r["band_name"] == "极光乐队")

    all_pass &= check(aurora["band_name"] == "极光乐队", "乐队名正确")
    all_pass &= check(aurora["is_leave"] == True, "请假标记 = 是")
    all_pass &= check(aurora["is_consumed"] == True, "消耗标记 = 是")
    all_pass &= check(aurora["needs_review"] == True, "待复核标记 = 是")
    all_pass &= check(aurora["status"] == "leave_consumed", "状态 = leave_consumed")
    all_pass &= check(aurora["tuner_name"] == "李明（主调音师）", f"调音师名已修正为: {aurora['tuner_name']}")
    all_pass &= check(aurora["has_corrections"] == True, "已有人工修正记录")
    all_pass &= check(aurora["correction_count"] == 1, f"人工修正次数 = {aurora['correction_count']}")
    all_pass &= check(aurora["run_count"] == 2, f"重跑次数 = {aurora['run_count']}")
    all_pass &= check(aurora["hours"] == 2.0, f"课时 = {aurora['hours']}小时")

    # ========== 第3步：详情验证 ==========
    title("第3步：详情验证 - 字段完整，三要素同步")
    detail = p.get_record_detail(aurora_id)

    all_pass &= check(detail["id"] == aurora_id, "记录ID匹配（反查同一条）")
    all_pass &= check(detail["band_name"] == "极光乐队", "乐队名一致")
    all_pass &= check(detail["tuner_name"] == "李明（主调音师）", "详情调音师名与列表一致")
    all_pass &= check(detail["is_leave"] == True, "详情请假标记与列表一致")
    all_pass &= check(detail["is_consumed"] == True, "详情消耗标记与列表一致")
    all_pass &= check(detail["needs_review"] == True, "详情待复核标记与列表一致")
    all_pass &= check(len(detail["corrections"]) == 1, "详情包含修正记录数组")
    all_pass &= check(detail["corrections"][0]["changes"]["tuner_name"] == "李明（主调音师）",
                      f"修正记录内容正确：调音师 → {detail['corrections'][0]['changes']['tuner_name']}")
    all_pass &= check(detail["corrections"][0]["operator"] == "老周", "修正操作人 = 老周")
    all_pass &= check(detail["review_note"] != "", "有复核说明文案")
    all_pass &= check("请假" in detail["review_note"], "复核说明包含'请假'关键词")

    # ========== 第4步：历史记录验证 ==========
    title("第4步：操作历史验证 - 全流程留痕可追溯")
    logs = p.get_logs(record_id=aurora_id)
    log_actions = [log["action"] for log in logs]

    all_pass &= check(len(logs) >= 3, f"至少3条操作日志（导入+修正+重跑），实际 {len(logs)} 条")
    all_pass &= check("导入调音师留言" in log_actions, "有：导入调音师留言")
    all_pass &= check("人工修正" in log_actions, "有：人工修正")
    all_pass &= check("重跑" in log_actions, "有：重跑")

    corr_log = next(log for log in logs if log["action"] == "人工修正")
    all_pass &= check("调音师姓名" in corr_log["detail"],
                      f"人工修正日志写明调音师：{corr_log['detail']}")
    all_pass &= check("李明（主调音师）" in corr_log["detail"],
                      "日志中包含修正后的调音师全名")

    rerun_log = next(log for log in logs if log["action"] == "重跑")
    all_pass &= check("待巡演统筹复核" in rerun_log["detail"],
                      "重跑日志写明仍为待复核状态")

    # ========== 第5步：报告统计验证 ==========
    title("第5步：报告统计验证 - 数字准确")
    report = p.generate_report()
    stats = report["stats"]

    all_pass &= check(stats["total"] == 3, f"总记录数 = 3，实际 {stats['total']}")
    all_pass &= check(stats["pending_review"] == 1, f"待复核 = 1条，实际 {stats['pending_review']}")
    all_pass &= check(stats["pending_hours"] == 2.0, f"待复核课时 = 2.0，实际 {stats['pending_hours']}")
    all_pass &= check(stats["corrected"] == 1, f"已人工修正 = 1条，实际 {stats['corrected']}")
    all_pass &= check(stats["leave_consumed"] == 1, f"请假被算消耗 = 1条，实际 {stats['leave_consumed']}")
    all_pass &= check(stats["supplemented"] == 1, f"已补录 = 1条，实际 {stats['supplemented']}")
    all_pass &= check(stats["total_hours"] == 7.5, f"总课时 = 7.5，实际 {stats['total_hours']}")

    # 报告明细中找到极光乐队
    aurora_in_report = next(r for r in report["records"] if r["band_name"] == "极光乐队")
    all_pass &= check(aurora_in_report["needs_review"] == True, "报告中极光乐队待复核 = 是")
    all_pass &= check(aurora_in_report["tuner_name"] == "李明（主调音师）", "报告中调音师名正确")
    all_pass &= check(aurora_in_report["has_corrections"] == True, "报告中标记已人工修正")

    # ========== 第6步：文本导出验证 ==========
    title("第6步：文本报告导出验证 - 关键字齐全")
    text = p.export_report_text()

    all_pass &= check("极光乐队" in text, "文本包含：极光乐队")
    all_pass &= check("李明（主调音师）" in text, "文本包含：修正后的调音师名")
    all_pass &= check("待复核" in text, "文本包含：待复核标记")
    all_pass &= check("已人工修正" in text, "文本包含：已人工修正标记")
    all_pass &= check("请假课时被算进已消耗" in text, "文本包含：复核说明")
    all_pass &= check("待复核课时: 2.0 小时" in text, "文本包含：待复核课时统计")

    # ========== 第7步：审批功能 - 驳回测试 ==========
    title("第7步：审批功能验证 - 驳回（不计消耗）")
    result = p.review_record(aurora_id, "reject", "核实主唱请假属实，不计入消耗", "巡演统筹小王")
    all_pass &= check(result is not None, "驳回操作成功")
    all_pass &= check(result.review_decision == "reject", "复核决定 = 驳回")
    all_pass &= check(result.review_reason == "核实主唱请假属实，不计入消耗", "驳回理由正确留存")
    all_pass &= check(result.reviewed_by == "巡演统筹小王", "复核人正确")
    all_pass &= check(result.needs_review == False, "驳回后待复核 = 否")
    all_pass &= check(result.is_consumed == False, "驳回后已消耗 = 否")
    all_pass &= check(result.status.value == "review_rejected", "状态 = review_rejected")

    # 检查驳回后的日志
    logs_after_reject = p.get_logs(record_id=aurora_id)
    reject_log = logs_after_reject[-1]
    all_pass &= check(reject_log["action"] == "巡演统筹复核", "有巡演统筹复核操作日志")
    all_pass &= check("驳回" in reject_log["detail"], "日志写明驳回")
    all_pass &= check("核实主唱请假属实" in reject_log["detail"], "日志包含驳回理由")

    # 检查报告统计更新
    stats_after = p.generate_report()["stats"]
    all_pass &= check(stats_after["review_rejected"] == 1, f"报告：复核驳回 = 1条，实际 {stats_after['review_rejected']}")
    all_pass &= check(stats_after["pending_review"] == 0, f"报告：待复核 = 0条，实际 {stats_after['pending_review']}")

    # ========== 第8步：审批功能 - 确认测试（重新建一条测试） ==========
    title("第8步：审批功能验证 - 确认计入消耗（重新导入测试）")
    p2 = RecordProcessor()
    ids2 = load_demo_data(p2)
    aurora_id2 = ids2["record_1"]

    result2 = p2.review_record(aurora_id2, "approve", "主办方确认扣课时，按消耗算", "巡演统筹小李")
    all_pass &= check(result2 is not None, "确认操作成功")
    all_pass &= check(result2.review_decision == "approve", "复核决定 = 确认")
    all_pass &= check(result2.review_reason == "主办方确认扣课时，按消耗算", "确认理由正确留存")
    all_pass &= check(result2.needs_review == False, "确认后待复核 = 否")
    all_pass &= check(result2.is_consumed == True, "确认后已消耗 = 是（不变）")
    all_pass &= check(result2.status.value == "review_approved", "状态 = review_approved")

    # 确认后的报告统计
    stats_approve = p2.generate_report()["stats"]
    all_pass &= check(stats_approve["review_approved"] == 1, f"报告：复核通过 = 1条，实际 {stats_approve['review_approved']}")
    all_pass &= check(stats_approve["pending_review"] == 0, f"报告：待复核 = 0条，实际 {stats_approve['pending_review']}")

    # ========== 最终结果 ==========
    title("验证总结")
    if all_pass:
        print("\n  🎉 全部验证通过！")
        print("\n  核心样例（极光乐队）四要素闭环：")
        print("    ✅ 请假课时被算进已消耗 → 自动标记待复核")
        print("    ✅ 人工修正调音师名 → 字段实际更新（李明（主调音师））")
        print("    ✅ 修正后状态不变 → 仍留给巡演统筹复核")
        print("    ✅ 列表/详情/历史/报告 → 四端一致，可反查同一条记录")
        print("    ✅ 审批确认/驳回 → 带理由，全程留痕")
        print("    ✅ 报告/导出 → 保留待复核判断和修正标记")
        return 0
    else:
        print("\n  ❌ 存在未通过的验证项，请检查")
        return 1


if __name__ == "__main__":
    sys.exit(main())
