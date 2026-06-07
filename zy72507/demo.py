#!/usr/bin/env python3
import sys
from pathlib import Path
import pprint

sys.path.insert(0, str(Path(__file__).parent))

from drift_system import (
    init_db, get_db,
    ImportService, AdjustmentService,
    SelfCheckService, DataAccessor,
    ExportService, ReportService,
)

pp = pprint.PrettyPrinter(indent=2, width=120)


def print_step(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def main():
    if Path("drift.db").exists():
        Path("drift.db").unlink()

    print_step("初始化数据库")
    init_db()
    print("✓ 数据库初始化完成")

    print_step("第一步：标注员留言第一次导入")
    annotator_rows = [
        {
            "store_id": "S001",
            "comment_id": "C001",
            "original_line_no": 1,
            "content": "这家店的服务员态度特别好，上菜也快",
            "sentiment_label": "正面",
        },
        {
            "store_id": "S001",
            "comment_id": "C002",
            "original_line_no": 2,
            "content": "环境有点吵，菜量也不大",
            "sentiment_label": "负面",
        },
        {
            "store_id": "S002",
            "comment_id": "C003",
            "original_line_no": 3,
            "content": "口味一般，性价比还行",
            "sentiment_label": "中性",
        },
    ]
    result = ImportService.import_annotator_comments(annotator_rows, source_file="标注员_20260601.csv")
    print("导入结果:")
    pp.pprint(result)

    records = DataAccessor.list_records()
    print(f"\n当前漂移记录数: {len(records)}")
    for r in records:
        print(f"  - {r['comment_id']}: 状态={r['status']}, 原始行号={r['original_line_no']}, 标注情绪={r['annotator_sentiment']}")

    print_step("重复导入检测（自检1）")
    result2 = ImportService.import_annotator_comments(annotator_rows, source_file="标注员_20260601_副本.csv")
    print("再次导入相同数据:")
    pp.pprint(result2)

    print_step("第二步：算法运营老唐补看模型输出片段")
    model_rows = [
        {
            "comment_id": "C001",
            "fragment_text": "服务员态度特别好，上菜也快",
            "sentiment_pred": "正面",
            "model_version": "v2.1",
            "confidence": 0.95,
        },
        {
            "comment_id": "C002",
            "fragment_text": "环境有点吵，菜量不大",
            "sentiment_pred": "正面",
            "model_version": "v2.1",
            "confidence": 0.72,
        },
        {
            "comment_id": "C003",
            "fragment_text": "口味一般，性价比还行",
            "sentiment_pred": "中性",
            "model_version": "v2.1",
            "confidence": 0.88,
        },
    ]
    result = ImportService.import_model_outputs(model_rows, source_file="模型输出_20260601.json")
    print("模型输出导入结果:")
    pp.pprint(result)

    records = DataAccessor.list_records()
    print(f"\n整合后的记录:")
    for r in records:
        drift_flag = "⚠️ 漂移" if r["drift_detected"] else "✓ 一致"
        print(f"  - {r['comment_id']}: {drift_flag}")
        print(f"    标注(行{r['original_line_no']}): {r['annotator_sentiment']} - {r['annotator_content']}")
        print(f"    模型: {r['model_sentiment']} (置信度{r['confidence']}) - {r['fragment_text']}")
        print(f"    当前状态: {r['status']}")

    print_step("老唐人工改判 C002（模型说错了，应该是负面）")
    c002 = DataAccessor.get_record_by_comment_id("C002")
    result = AdjustmentService.manual_adjust(
        record_id=c002["id"],
        new_sentiment="负面",
        adjusted_by="老唐",
        note="现场说法：环境吵、菜量小，明确负面，模型置信度低",
    )
    print("人工改判结果:")
    pp.pprint(result)

    print("\nC002 当前详情:")
    c002 = DataAccessor.get_record_by_comment_id("C002")
    print(f"  状态: {c002['status']}")
    print(f"  当前情绪: {c002['current_sentiment']}")
    adjustments = DataAccessor.get_manual_adjustments(c002["id"])
    print(f"  人工改判记录: {len(adjustments)}条")
    for adj in adjustments:
        print(f"    {adj['adjusted_at']} {adj['adjusted_by']}: {adj['old_sentiment']}→{adj['new_sentiment']} (覆盖:{bool(adj['overridden'])})")

    history = DataAccessor.get_status_history(c002["id"])
    print(f"  状态流转:")
    for h in history:
        print(f"    {h['changed_at']}: {h['old_status'] or '初始'} → {h['new_status']} [{h['changed_by']}] {h['reason'] or ''}")

    print_step("下一次批跑覆盖了老唐的人工改判")
    result = AdjustmentService.batch_rerun(
        comment_ids=["C001", "C002", "C003"],
        new_sentiments={
            "C001": "正面",
            "C002": "中性",
            "C003": "中性",
        },
        run_by="批跑任务_v2.2",
    )
    print("批跑结果:")
    pp.pprint(result)

    print("\nC002 状态变更（别急着归正常，留给安全审核）:")
    c002 = DataAccessor.get_record_by_comment_id("C002")
    print(f"  状态: {c002['status']}")
    print(f"  当前情绪: {c002['current_sentiment']}")

    adjustments = DataAccessor.get_manual_adjustments(c002["id"])
    print(f"  人工改判记录:")
    for adj in adjustments:
        print(f"    {adj['adjusted_at']} {adj['adjusted_by']}: {adj['old_sentiment']}→{adj['new_sentiment']}")
        print(f"      覆盖标记: {bool(adj['overridden'])}, 覆盖人: {adj['overridden_by']}, 覆盖时间: {adj['overridden_at']}")

    history = DataAccessor.get_status_history(c002["id"])
    print(f"  状态流转:")
    for h in history:
        print(f"    {h['changed_at']}: {h['old_status'] or '初始'} → {h['new_status']} [{h['changed_by']}] {h['reason'] or ''}")

    print_step("第三步：评测报告更新")
    report = ReportService.generate_report()
    print("评测报告:")
    pp.pprint(report)

    print_step("四项核心自检")
    checks = SelfCheckService.run_all_checks()
    for c in checks:
        status_icon = "✅" if c["status"] == "passed" else "⚠️"
        print(f"  {status_icon} {c['check']}: {c['status']}")
        if c["check"] == "adjustment_overridden":
            print(f"     待复核: {c['pending_review']} 条")
        if c["check"] == "recompute_after_supplement":
            print(f"     数据不全: {c['incomplete']} 条")

    print_step("安全审核同事复核被覆盖的记录")
    c002 = DataAccessor.get_record_by_comment_id("C002")
    print(f"复核 C002，最终认定为负面")
    result = AdjustmentService.review_overridden(
        record_id=c002["id"],
        reviewed_by="安全审核-小王",
        final_sentiment="负面",
        status="reviewed",
    )
    pp.pprint(result)

    print("\n复核后 C002 状态:")
    c002 = DataAccessor.get_record_by_comment_id("C002")
    print(f"  状态: {c002['status']}")
    print(f"  当前情绪: {c002['current_sentiment']}")
    print(f"  复核人: {c002['reviewed_by']}")

    print_step("导出明细（与页面、接口用同一份数据）")
    export_path = "情绪漂移明细_20260607.csv"
    result = ExportService.export_details(export_path)
    print(f"导出文件: {result['filepath']}, 记录数: {result['count']}")

    print_step("补录后重算场景")
    print("补录一条新的标注员留言 C004:")
    new_annotator = [
        {
            "store_id": "S003",
            "comment_id": "C004",
            "original_line_no": 4,
            "content": "味道不错，就是排队太久了",
            "sentiment_label": "中性",
        }
    ]
    result = ImportService.import_annotator_comments(new_annotator)
    pp.pprint(result)

    print("\n补录对应模型输出 C004:")
    new_model = [
        {
            "comment_id": "C004",
            "fragment_text": "味道不错，排队太久",
            "sentiment_pred": "负面",
            "model_version": "v2.2",
            "confidence": 0.81,
        }
    ]
    result = ImportService.import_model_outputs(new_model)
    pp.pprint(result)

    print("\nC004 补录后自动重算漂移:")
    c004 = DataAccessor.get_record_by_comment_id("C004")
    print(f"  状态: {c004['status']}")
    print(f"  标注情绪: {c004['annotator_sentiment']}")
    print(f"  模型情绪: {c004['model_sentiment']}")
    print(f"  漂移检测: {'是' if c004['drift_detected'] else '否'}")

    print_step("再次运行自检")
    checks = SelfCheckService.run_all_checks()
    for c in checks:
        status_icon = "✅" if c["status"] == "passed" else "⚠️"
        print(f"  {status_icon} {c['check']}: {c['status']}")

    print_step("更新评测报告")
    report = ReportService.generate_report()
    pp.pprint(report)

    print(f"\n{'='*60}")
    print("  流程演示完成 ✓")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
