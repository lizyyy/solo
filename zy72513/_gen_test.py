import os

content = '''#!/usr/bin/env python3
import os
import sys
import shutil
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from learning_path_recommender.storage import JSONStorage
from learning_path_recommender.audit import AuditLogger
from learning_path_recommender.core import Importer, VersionManager, MaskingEngine
from learning_path_recommender.workflow import ThreeStepWorkflow
from learning_path_recommender.cli.main import build_unified_report


def print_step(title, step_num, total_steps):
    print()
    print("=" * 80)
    print("  步骤 {}/{}: {}".format(step_num, total_steps, title))
    print("=" * 80)


def assert_with_msg(condition, msg):
    if not condition:
        print()
        print("❌ 断言失败: {}".format(msg))
        raise AssertionError(msg)
    print("  ✅ {}".format(msg))


def main():
    TOTAL_STEPS = 10
    DATA_DIR = "data"

    print()
    print("#" * 80)
    print("  端到端重复导入测试 - 开始执行")
    print("#" * 80)

    if os.path.exists(DATA_DIR):
        print()
        print("清理旧数据目录: {}".format(DATA_DIR))
        shutil.rmtree(DATA_DIR)
        print("  已删除 {} 目录".format(DATA_DIR))

    storage = JSONStorage(DATA_DIR)
    audit = AuditLogger(storage)
    version_manager = VersionManager(storage, audit)
    importer = Importer(storage, audit, version_manager)
    workflow = ThreeStepWorkflow(storage)

    print_step("1. 首次导入模型输出", 1, TOTAL_STEPS)
    batch_001 = "BATCH_E2E_001"
    model_outputs_001 = [
        {"id": "MODEL_001", "content": "推荐学习Python基础课程，适合零基础学员。联系老师请拨打13812345678。", "raw_content": "raw: Python基础"},
        {"id": "MODEL_002", "content": "推荐学习Java高级架构师课程，适合有3年以上开发经验的学员。", "raw_content": "raw: Java架构师"},
        {"id": "MODEL_003", "content": "推荐学习数据分析实战课程，包含SQL、Python、可视化等内容。", "raw_content": "raw: 数据分析"}
    ]
    result = workflow.step1_import_model_outputs(items=model_outputs_001, batch_id=batch_001, imported_by="xiaomeng")
    import_record_001 = result["import_record"]
    assert_with_msg(import_record_001["item_count"] == 3, "导入记录数应为3")
    assert_with_msg(import_record_001["new_count"] == 3, "新增记录数应为3")
    assert_with_msg(import_record_001["duplicate_count"] == 0, "重复记录数应为0")

    rec_001 = storage.find_recommendation_by_model_output_id("MODEL_001")
    rec_002 = storage.find_recommendation_by_model_output_id("MODEL_002")
    rec_003 = storage.find_recommendation_by_model_output_id("MODEL_003")
    assert_with_msg(rec_001 is not None, "MODEL_001 应存在")
    assert_with_msg(rec_002 is not None, "MODEL_002 应存在")
    assert_with_msg(rec_003 is not None, "MODEL_003 应存在")
    assert_with_msg("13812345678" in rec_001.content, "MODEL_001 应包含手机号13812345678")
    assert_with_msg(rec_001.has_unmasked_phone is True, "MODEL_001 应标记为有未脱敏手机号")
    assert_with_msg(rec_001.masking_status == "needs_review", "MODEL_001 脱敏状态应为needs_review")
    assert_with_msg(rec_001.version == 1, "MODEL_001 版本号应为1")

    print_step("2. 应用人工改判（小孟第一次改 3 条备注）", 2, TOTAL_STEPS)
    manual_reviews = [
        {"model_output_id": "MODEL_001", "review_content": "备注001v1：学员已确认报名", "comment": "第一次复核通过", "reason": "人工改判备注更新"},
        {"model_output_id": "MODEL_002", "review_content": "备注002v1：学员有Java基础", "comment": "第一次复核通过", "reason": "人工改判备注更新"},
        {"model_output_id": "MODEL_003", "review_content": "备注003v1：学员希望转行数据分析", "comment": "第一次复核通过", "reason": "人工改判备注更新"}
    ]
    result = workflow.step2_apply_manual_reviews(reviews=manual_reviews, batch_id=batch_001, applied_by="xiaomeng")
    assert_with_msg(result["updated"] == 3, "应更新3条记录")
    assert_with_msg(result["not_found"] == 0, "未找到记录数应为0")

    rec_001 = storage.find_recommendation_by_model_output_id("MODEL_001")
    rec_002 = storage.find_recommendation_by_model_output_id("MODEL_002")
    rec_003 = storage.find_recommendation_by_model_output_id("MODEL_003")
    assert_with_msg(rec_001.source_manual_review == "备注001v1：学员已确认报名", "MODEL_001 备注应为v1")
    assert_with_msg(rec_002.source_manual_review == "备注002v1：学员有Java基础", "MODEL_002 备注应为v1")
    assert_with_msg(rec_003.source_manual_review == "备注003v1：学员希望转行数据分析", "MODEL_003 备注应为v1")
    assert_with_msg(rec_001.version == 2, "MODEL_001 版本号应为2")
    assert_with_msg(rec_001.review_status == "reviewed", "MODEL_001 复核状态应为reviewed")

    print_step("3. 小孟单独改一条备注（只改 MODEL_001）", 3, TOTAL_STEPS)
    old_manual_review = rec_001.source_manual_review
    single_review = [
        {"model_output_id": "MODEL_001", "review_content": "备注001v2：学员已缴费，需安排班主任对接", "comment": "第二次复核：更新跟进状态", "reason": "学员缴费成功，更新备注信息"}
    ]
    updated, not_found, unchanged = importer.apply_manual_review(reviews=single_review, batch_id=batch_001, applied_by="xiaomeng")
    assert_with_msg(updated == 1, "应更新1条记录")
    assert_with_msg(not_found == 0, "未找到记录数应为0")

    rec_001 = storage.find_recommendation_by_model_output_id("MODEL_001")
    assert_with_msg(rec_001.source_manual_review == "备注001v2：学员已缴费，需安排班主任对接", "MODEL_001 备注应为v2")
    assert_with_msg(rec_001.review_comment == "第二次复核：更新跟进状态", "MODEL_001 复核意见应正确")
    assert_with_msg(rec_001.version == 3, "MODEL_001 版本号应为3")
    assert_with_msg(old_manual_review != rec_001.source_manual_review, "备注应已变化")

    print_step("4. 查看 MODEL_001 的版本历史", 4, TOTAL_STEPS)
    histories = version_manager.get_history(rec_001.id)
    print("  MODEL_001 版本历史共 {} 条记录:".format(len(histories)))
    for h in histories:
        print("     - v{}: {} 由 {} 修改，原因: {}".format(h.version, h.field_name, h.changed_by, h.change_reason))

    assert_with_msg(len(histories) >= 3, "版本历史应至少3条")
    source_manual_review_histories = [h for h in histories if h.field_name == "source_manual_review"]
    assert_with_msg(len(source_manual_review_histories) >= 2, "source_manual_review 变更应至少2次")

    v2_history = source_manual_review_histories[0]
    v3_history = source_manual_review_histories[1]
    assert_with_msg(v2_history.old_value is None or v2_history.old_value == "", "v2 改前值应为空")
    assert_with_msg(v2_history.new_value == "备注001v1：学员已确认报名", "v2 改后值应为v1")
    assert_with_msg(v2_history.change_reason == "人工改判备注更新", "v2 修改原因应为人工改判备注更新")
    assert_with_msg(v3_history.old_value == "备注001v1：学员已确认报名", "v3 改前值应为v1")
    assert_with_msg(v3_history.new_value == "备注001v2：学员已缴费，需安排班主任对接", "v3 改后值应为v2")
    assert_with_msg(v3_history.change_reason == "学员缴费成功，更新备注信息", "v3 修改原因应为学员缴费成功，更新备注信息")

    diff_output = version_manager.show_change_diff(rec_001.id)
    assert_with_msg("改前" in diff_output and "改后" in diff_output and "修改原因" in diff_output, "版本历史输出应包含改前、改后、修改原因")

    print_step("5. 重复导入同一批模型输出（batch_id=BATCH_E2E_002）", 5, TOTAL_STEPS)
    batch_002 = "BATCH_E2E_002"
    model_outputs_002 = [
        {"id": "MODEL_001", "content": "推荐学习Python基础课程，适合零基础学员。联系老师请拨打13812345678。", "raw_content": "raw: Python基础"},
        {"id": "MODEL_002", "content": "推荐学习Java高级架构师课程（2024新版），适合有3年以上开发经验的学员，包含微服务、云原生等内容。", "raw_content": "raw: Java架构师2024"},
        {"id": "MODEL_003", "content": "推荐学习数据分析实战课程，包含SQL、Python、可视化等内容。", "raw_content": "raw: 数据分析"},
        {"id": "MODEL_004", "content": "推荐学习人工智能基础课程，包含机器学习、深度学习入门知识。", "raw_content": "raw: 人工智能"}
    ]
    result = workflow.step1_import_model_outputs(items=model_outputs_002, batch_id=batch_002, imported_by="xiaomeng")
    import_record_002 = result["import_record"]
    assert_with_msg(import_record_002["item_count"] == 4, "导入记录数应为4")
    assert_with_msg(import_record_002["new_count"] == 1, "新增记录数应为1（MODEL_004）")
    assert_with_msg(import_record_002["duplicate_count"] == 2, "重复记录数应为2（MODEL_001、MODEL_003）")
    assert_with_msg(import_record_002["updated_count"] == 1, "更新记录数应为1（MODEL_002）")

    rec_004 = storage.find_recommendation_by_model_output_id("MODEL_004")
    assert_with_msg(rec_004 is not None, "MODEL_004 应存在")
    assert_with_msg(rec_004.batch_id == batch_002, "MODEL_004 批次应为{}".format(batch_002))

    print_step("6. 检查每条记录的 source_type", 6, TOTAL_STEPS)
    item_details = import_record_002["metadata"]["item_processing_details"]
    source_types = {d["model_output_id"]: d["source_type"] for d in item_details}
    print("  来源分类结果:")
    for mid, stype in source_types.items():
        print("     {}: {}".format(mid, stype))

    assert_with_msg(source_types.get("MODEL_001") == "historical_batch_duplicate", "MODEL_001 应为 historical_batch_duplicate")
    assert_with_msg(source_types.get("MODEL_002") == "content_updated", "MODEL_002 应为 content_updated")
    assert_with_msg(source_types.get("MODEL_003") == "historical_batch_duplicate", "MODEL_003 应为 historical_batch_duplicate")
    assert_with_msg(source_types.get("MODEL_004") == "new_material", "MODEL_004 应为 new_material")

    rec_002_after = storage.find_recommendation_by_model_output_id("MODEL_002")
    assert_with_msg("2024新版" in rec_002_after.content, "MODEL_002 内容应已更新为2024新版")
    assert_with_msg(rec_002_after.version == 2, "MODEL_002 版本号应为2")

    rec_001_after = storage.find_recommendation_by_model_output_id("MODEL_001")
    assert_with_msg(rec_001_after.version == 3, "MODEL_001 版本号应保持3不变")
    assert_with_msg(rec_001_after.source_manual_review == "备注001v2：学员已缴费，需安排班主任对接", "MODEL_001 人工备注应保持不变")

    source_summary = import_record_002["metadata"]["source_summary"]
    assert_with_msg(source_summary["new_material"] == 1, "new_material 应为1")
    assert_with_msg(source_summary["historical_batch_duplicate"] == 2, "historical_batch_duplicate 应为2")
    assert_with_msg(source_summary["content_updated"] == 1, "content_updated 应为1")
    assert_with_msg(source_summary.get("current_batch_duplicate", 0) == 0, "current_batch_duplicate 应为0")

    print_step("7. 调用 get_import_details 查看导入详情", 7, TOTAL_STEPS)
    import_record_id_002 = import_record_002["id"]
    details = workflow.get_import_details(import_record_id_002)
    assert_with_msg("error" not in details, "导入详情不应有错误")
    assert_with_msg(details["import_record_id"] == import_record_id_002, "导入记录ID应匹配")
    assert_with_msg(details["batch_id"] == batch_002, "批次ID应为{}".format(batch_002))
    assert_with_msg(details["total_items"] == 4, "总记录数应为4")
    assert_with_msg(details["new_count"] == 1, "新增数应为1")
    assert_with_msg(details["duplicate_count"] == 2, "重复数应为2")
    assert_with_msg(details["updated_count"] == 1, "更新数应为1")

    detail_items = details["items"]
    assert_with_msg(len(detail_items) == 4, "详情记录数应为4")
    for item in detail_items:
        mid = item["model_output_id"]
        print("     {}: source_type={}, masking_status={}".format(mid, item["source_type"], item["masking_status"]))
        assert_with_msg("source_type" in item, "{} 应有 source_type 字段".format(mid))
        assert_with_msg("recommendation_id" in item, "{} 应有 recommendation_id 字段".format(mid))
        assert_with_msg("content_preview" in item, "{} 应有 content_preview 字段".format(mid))
        assert_with_msg("current_version" in item, "{} 应有 current_version 字段".format(mid))
        assert_with_msg("masking_status" in item, "{} 应有 masking_status 字段".format(mid))
        assert_with_msg("review_status" in item, "{} 应有 review_status 字段".format(mid))

    assert_with_msg("source_summary_labels" in details, "应有 source_summary_labels 字段")
    labels = details["source_summary_labels"]
    assert_with_msg(labels.get("new_material") == "新增材料", "new_material 标签应为新增材料")
    assert_with_msg(labels.get("historical_batch_duplicate") == "历史批次重复", "historical_batch_duplicate 标签应为历史批次重复")
    assert_with_msg(labels.get("content_updated") == "内容有更新", "content_updated 标签应为内容有更新")

    print_step("8. 生成统一报告，调用 build_unified_report", 8, TOTAL_STEPS)
    report = build_unified_report(workflow, batch_002)
    assert_with_msg(report["report_type"] == "learning_path_recommendation_unified_report", "报告类型应正确")
    assert_with_msg(report["report_version"] == "2.0", "报告版本应为2.0")
    assert_with_msg(report["batch_id"] == batch_002, "报告批次应为{}".format(batch_002))

    summary = report["summary"]
    assert_with_msg(summary["total_recommendations"] == 4, "推荐理由总数应为4")
    assert_with_msg(summary["import_records"] == 1, "导入记录数应为1")
    assert_with_msg(summary["with_unmasked_phone"] == 1, "手机号漏遮数应为1")
    assert_with_msg(len(summary["recommendation_ids"]) == 4, "推荐理由ID列表应有4个")
    assert_with_msg(len(report["import_details"]) == 1, "导入详情应有1条记录")
    assert_with_msg(len(report["recommendations"]) == 4, "推荐理由应有4条")

    rec_histories = report["recommendation_histories"]
    assert_with_msg(len(rec_histories) >= 1, "至少应有1条推荐理由有版本历史")
    model_001_rec_id = storage.find_recommendation_by_model_output_id("MODEL_001").id
    assert_with_msg(model_001_rec_id in rec_histories, "MODEL_001 应有版本历史记录")
    assert_with_msg(len(rec_histories[model_001_rec_id]) >= 3, "MODEL_001 版本历史应至少3条")

    assert_with_msg("audit_logs_recent" in report, "报告应包含审计日志")
    assert_with_msg(len(report["audit_logs_recent"]) > 0, "审计日志不应为空")
    assert_with_msg("replay_commands" in report, "报告应包含重放命令")
    assert_with_msg(len(report["replay_commands"]) > 0, "重放命令不应为空")
    assert_with_msg("source_type_labels" in report, "报告应包含来源类型标签")
    assert_with_msg("field_name_labels" in report, "报告应包含字段名称标签")
    assert_with_msg("boundary_rules_reference" in report, "报告应包含边界规则参考")

    print("  报告概要:")
    print("     - 推荐理由数: {}".format(report["summary"]["total_recommendations"]))
    print("     - 导入记录数: {}".format(len(report["import_details"])))
    print("     - 版本变更记录: {}".format(sum(len(v) for v in report["recommendation_histories"].values())))
    print("     - 审计日志条数: {}".format(len(report["audit_logs_recent"])))
    print("     - 重放命令数: {}".format(len(report["replay_commands"])))

    print_step("9. 验证手机号漏遮的记录处理", 9, TOTAL_STEPS)
    rec_001 = storage.find_recommendation_by_model_output_id("MODEL_001")
    assert_with_msg(rec_001.has_unmasked_phone is True, "MODEL_001 应标记为有未脱敏手机号")
    assert_with_msg(rec_001.masking_status == "needs_review", "MODEL_001 脱敏状态应为needs_review")

    all_recs = storage.list_recommendations(batch_id=batch_002)
    rec_ids = [r.id for r in all_recs]
    print("  批次 {} 共 {} 条记录".format(batch_002, len(rec_ids)))

    exported, skipped = workflow.masking_engine.export_masked(recommendation_ids=rec_ids, exported_by="xiaomeng", include_unreviewed=False)
    print("  导出结果: 成功 {} 条, 跳过 {} 条".format(len(exported), len(skipped)))
    assert_with_msg(len(exported) == 3, "应成功导出3条")
    assert_with_msg(len(skipped) == 1, "应跳过1条（手机号漏遮）")
    assert_with_msg(rec_001.id in skipped, "MODEL_001 应在跳过列表中")

    exported_ids = [e["id"] for e in exported]
    assert_with_msg(rec_001.id not in exported_ids, "MODEL_001 不应在导出列表中")
    for e in exported:
        assert_with_msg("13812345678" not in e.get("masked_content", ""), "导出内容 {} 不应包含明文手机号".format(e["id"]))
        assert_with_msg("masked_content" in e, "导出记录 {} 应有 masked_content 字段".format(e["id"]))
        assert_with_msg("masking_violations" in e, "导出记录 {} 应有 masking_violations 字段".format(e["id"]))

    step3_result = workflow.step3_export_masked(batch_id=batch_002, exported_by="xiaomeng", include_unreviewed=False, escalate_phone_issues=True)
    assert_with_msg(step3_result["phone_issue_count"] == 1, "手机号问题数应为1")
    assert_with_msg(step3_result["skipped_count"] == 1, "跳过数应为1")

    rec_001_final = storage.get_recommendation(rec_001.id)
    assert_with_msg(rec_001_final.review_status == "pending_algorithm_review", "MODEL_001 复核状态应为 pending_algorithm_review")
    assert_with_msg(rec_001_final.reviewer == "xiaomeng", "复核人应为xiaomeng")
    assert_with_msg("手机号漏遮" in (rec_001_final.review_comment or ""), "复核意见应包含手机号漏遮")

    print_step("10. 检查所有操作的审计日志可追溯，可生成重放命令", 10, TOTAL_STEPS)
    all_logs = audit.get_logs(limit=500)
    print("  审计日志共 {} 条".format(len(all_logs)))

    event_types = {}
    for log in all_logs:
        et = log.get("event_type", "unknown")
        event_types[et] = event_types.get(et, 0) + 1

    print("  事件类型统计:")
    for et, count in sorted(event_types.items()):
        print("     {}: {} 次".format(et, count))

    assert_with_msg(event_types.get("import.complete", 0) >= 2, "import.complete 应至少2次")
    assert_with_msg(event_types.get("recommendation.create", 0) >= 4, "recommendation.create 应至少4次")
    assert_with_msg(event_types.get("recommendation.update", 0) >= 4, "recommendation.update 应至少4次")
    assert_with_msg(event_types.get("masking.unmasked_detected", 0) >= 1, "masking.unmasked_detected 应至少1次")
    assert_with_msg(event_types.get("review.escalated", 0) >= 1, "review.escalated 应至少1次")
    assert_with_msg(event_types.get("export.skipped", 0) >= 1, "export.skipped 应至少1次")
    assert_with_msg(event_types.get("workflow.step", 0) >= 5, "workflow.step 应至少5次")

    replay_commands = audit.generate_replay_commands()
    print("  生成重放命令共 {} 条".format(len(replay_commands)))
    for cmd in replay_commands[-5:]:
        print("     {}...".format(cmd[:100]))

    assert_with_msg(len(replay_commands) >= 5, "重放命令应至少5条")
    has_import_replay = any("导入批次" in cmd for cmd in replay_commands)
    has_update_replay = any("更新" in cmd for cmd in replay_commands)
    has_escalate_replay = any("升级复核" in cmd for cmd in replay_commands)
    has_masking_replay = any("发现未脱敏内容" in cmd for cmd in replay_commands)
    assert_with_msg(has_import_replay, "重放命令应包含导入操作")
    assert_with_msg(has_update_replay, "重放命令应包含更新操作")
    assert_with_msg(has_escalate_replay, "重放命令应包含升级复核操作")
    assert_with_msg(has_masking_replay, "重放命令应包含脱敏检测操作")

    import_logs = [log for log in all_logs if log.get("event_type") == "import.complete"]
    batch_ids_in_logs = [log.get("data", {}).get("batch_id") for log in import_logs]
    assert_with_msg(batch_001 in batch_ids_in_logs, "审计日志应包含批次 {}".format(batch_001))
    assert_with_msg(batch_002 in batch_ids_in_logs, "审计日志应包含批次 {}".format(batch_002))

    update_logs = [log for log in all_logs if log.get("event_type") == "recommendation.update"]
    for log in update_logs:
        data = log.get("data", {})
        assert_with_msg("recommendation_id" in data, "更新日志应有 recommendation_id")
        assert_with_msg("field" in data, "更新日志应有 field")
        assert_with_msg("updated_by" in data, "更新日志应有 updated_by")
        assert_with_msg("reason" in data, "更新日志应有 reason")
        assert_with_msg("old_value" in data, "更新日志应有 old_value")
        assert_with_msg("new_value" in data, "更新日志应有 new_value")

    print()
    print("#" * 80)
    print("  所有端到端测试通过！")
    print("#" * 80)
    print()


if __name__ == "__main__":
    main()
'''

with open('/Users/lzy/pro/solo/workspaces/zy72513/e2e_repeat_import_test.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("文件创建成功，大小:", len(content), "字节")
