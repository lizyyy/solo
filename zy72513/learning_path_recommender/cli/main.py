import argparse
import json
import sys
import os
from typing import List, Dict, Any

from ..storage import JSONStorage
from ..audit import AuditLogger
from ..core import Importer, VersionManager, MaskingEngine
from ..workflow import ThreeStepWorkflow
from ..config import BOUNDARY_RULES, get_boundary_rule, validate_operation


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="lpr",
        description="学习路径推荐理由管理系统",
    )
    parser.add_argument("--data-dir", default="data", help="数据存储目录")

    subparsers = parser.add_subparsers(dest="command", required=True)

    import_parser = subparsers.add_parser("import", help="导入模型输出片段")
    import_parser.add_argument("--input", "-i", required=True, help="输入 JSON 文件路径")
    import_parser.add_argument("--batch-id", "-b", required=True, help="批次 ID")
    import_parser.add_argument("--operator", "-o", default="system", help="操作人")

    review_parser = subparsers.add_parser("review", help="应用人工改判表")
    review_parser.add_argument("--input", "-i", required=True, help="人工改判 JSON 文件")
    review_parser.add_argument("--batch-id", "-b", required=True, help="批次 ID")
    review_parser.add_argument("--operator", "-o", default="xiaomeng", help="操作人")

    export_parser = subparsers.add_parser("export", help="脱敏导出")
    export_parser.add_argument("--batch-id", "-b", required=True, help="批次 ID")
    export_parser.add_argument("--output", "-o", default="export.json", help="输出文件")
    export_parser.add_argument("--operator", "-u", default="system", help="操作人")
    export_parser.add_argument("--include-unreviewed", action="store_true", help="包含未复核的手机号漏遮记录")

    workflow_parser = subparsers.add_parser("workflow", help="运行完整三步工作流")
    workflow_parser.add_argument("--model-output", "-m", required=True, help="模型输出 JSON")
    workflow_parser.add_argument("--manual-review", "-r", required=True, help="人工改判 JSON")
    workflow_parser.add_argument("--batch-id", "-b", required=True, help="批次 ID")
    workflow_parser.add_argument("--operator", "-o", default="xiaomeng", help="操作人")
    workflow_parser.add_argument("--output", "-O", default="export.json", help="导出结果文件")

    history_parser = subparsers.add_parser("history", help="查看版本历史")
    history_parser.add_argument("--id", required=True, help="推荐理由 ID")
    history_parser.add_argument("--diff", action="store_true", help="显示改前改后差异")

    rollback_parser = subparsers.add_parser("rollback", help="回滚到指定版本")
    rollback_parser.add_argument("--id", required=True, help="推荐理由 ID")
    rollback_parser.add_argument("--version", "-v", type=int, required=True, help="目标版本")
    rollback_parser.add_argument("--operator", "-o", default="system", help="操作人")

    check_parser = subparsers.add_parser("check", help="检查脱敏问题")
    check_parser.add_argument("--id", help="指定推荐理由 ID")
    check_parser.add_argument("--batch-id", help="指定批次 ID")
    check_parser.add_argument("--auto-fix", action="store_true", help="自动修复非手机号问题")
    check_parser.add_argument("--operator", "-o", default="system", help="操作人")

    escalate_parser = subparsers.add_parser("escalate", help="升级到算法同事复核")
    escalate_parser.add_argument("--id", required=True, help="推荐理由 ID")
    escalate_parser.add_argument("--comment", "-c", help="复核意见")
    escalate_parser.add_argument("--operator", "-o", default="xiaomeng", help="操作人")

    rules_parser = subparsers.add_parser("rules", help="查看边界规则")
    rules_parser.add_argument("--rule-id", help="指定规则 ID（如 RULE_001）")

    replay_parser = subparsers.add_parser("replay", help="生成可复盘的重放命令")
    replay_parser.add_argument("--limit", type=int, default=100, help="日志条数")

    summary_parser = subparsers.add_parser("summary", help="查看批次汇总")
    summary_parser.add_argument("--batch-id", "-b", required=True, help="批次 ID")

    audit_parser = subparsers.add_parser("audit", help="查看审计日志")
    audit_parser.add_argument("--limit", type=int, default=50, help="日志条数")

    return parser


def load_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(data: Any, path: str):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def main():
    parser = create_parser()
    args = parser.parse_args()

    storage = JSONStorage(args.data_dir)
    audit = AuditLogger(storage)
    version_manager = VersionManager(storage, audit)

    if args.command == "import":
        importer = Importer(storage, audit, version_manager)
        items = load_json(args.input)
        record = importer.import_model_outputs(
            items=items,
            batch_id=args.batch_id,
            imported_by=args.operator,
            source_file=args.input,
        )
        print(json.dumps(record.to_dict(), ensure_ascii=False, indent=2))

    elif args.command == "review":
        importer = Importer(storage, audit)
        reviews = load_json(args.input)
        updated, not_found, unchanged = importer.apply_manual_review(
            reviews=reviews,
            batch_id=args.batch_id,
            applied_by=args.operator,
        )
        result = {
            "updated": updated,
            "not_found": not_found,
            "unchanged": unchanged,
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))

    elif args.command == "export":
        engine = MaskingEngine(storage, audit)
        recs = storage.list_recommendations(batch_id=args.batch_id)
        rec_ids = [r.id for r in recs]
        exported, skipped = engine.export_masked(
            recommendation_ids=rec_ids,
            exported_by=args.operator,
            include_unreviewed=args.include_unreviewed,
        )
        save_json(exported, args.output)
        print(f"导出完成: {len(exported)} 条, 跳过 {len(skipped)} 条, 输出到 {args.output}")
        if skipped:
            print(f"跳过的 ID: {skipped}")

    elif args.command == "workflow":
        workflow = ThreeStepWorkflow(storage)
        model_items = load_json(args.model_output)
        manual_reviews = load_json(args.manual_review)
        result = workflow.run_full_workflow(
            model_items=model_items,
            manual_reviews=manual_reviews,
            batch_id=args.batch_id,
            operator=args.operator,
        )
        if result["steps"][2]["exported_data"]:
            save_json(result["steps"][2]["exported_data"], args.output)
            print(f"工作流完成，导出文件: {args.output}")
        print(json.dumps(result["summary"], ensure_ascii=False, indent=2))

    elif args.command == "history":
        vm = VersionManager(storage, audit)
        if args.diff:
            print(vm.show_change_diff(args.id))
        else:
            histories = vm.get_history(args.id)
            print(json.dumps([h.to_dict() for h in histories], ensure_ascii=False, indent=2))

    elif args.command == "rollback":
        vm = VersionManager(storage, audit)
        rec, changes = vm.rollback_to_version(
            recommendation_id=args.id,
            target_version=args.version,
            rolled_back_by=args.operator,
        )
        print(f"回滚完成，当前版本: {rec.version}")
        print(json.dumps(changes, ensure_ascii=False, indent=2))

    elif args.command == "check":
        engine = MaskingEngine(storage, audit)
        if args.id:
            result = engine.process_recommendation(
                recommendation_id=args.id,
                processed_by=args.operator,
                auto_fix=args.auto_fix,
            )
            print(json.dumps(result, ensure_ascii=False, indent=2))
        elif args.batch_id:
            recs = storage.list_recommendations(batch_id=args.batch_id)
            all_violations = []
            for rec in recs:
                result = engine.process_recommendation(
                    recommendation_id=rec.id,
                    processed_by=args.operator,
                    auto_fix=args.auto_fix,
                )
                if result["has_unmasked"]:
                    all_violations.append(result)
            print(f"检查完成: {len(recs)} 条, 发现问题 {len(all_violations)} 条")
            for v in all_violations:
                print(f"  - {v['recommendation_id']}: {len(v['violations'])} 个违规")

    elif args.command == "escalate":
        engine = MaskingEngine(storage, audit)
        rec = engine.mark_for_algorithm_review(
            recommendation_id=args.id,
            marked_by=args.operator,
            comment=args.comment,
        )
        print(f"已升级到算法同事复核: {rec.id}")
        print(f"状态: {rec.review_status}, 备注: {rec.review_comment}")

    elif args.command == "rules":
        if args.rule_id:
            rule = get_boundary_rule(args.rule_id)
            if rule:
                print(json.dumps(rule, ensure_ascii=False, indent=2))
            else:
                print(f"未找到规则: {args.rule_id}")
        else:
            for key, rule in BOUNDARY_RULES.items():
                print(f"{rule['id']} - {rule['name']}: {rule['description']}")

    elif args.command == "replay":
        commands = audit.generate_replay_commands()
        for cmd in commands[-args.limit:]:
            print(cmd)

    elif args.command == "summary":
        workflow = ThreeStepWorkflow(storage)
        summary = workflow.get_workflow_summary(args.batch_id)
        print(json.dumps(summary, ensure_ascii=False, indent=2))

    elif args.command == "audit":
        logs = audit.get_logs(limit=args.limit)
        for log in logs:
            print(json.dumps(log, ensure_ascii=False))


if __name__ == "__main__":
    main()
        )
        record_dict = record.to_dict()
        src_summary = record_dict.get("metadata", {}).get("source_summary", {})

        print(f"导入完成: 批次 {args.batch_id}")
        print(f"总数: {record.item_count} 条")
        for k, v in src_summary.items():
            label = SOURCE_TYPE_LABELS.get(k, k)
            print(f"  {label}: {v} 条")
        print("source_summary:")
        print(json.dumps(src_summary, ensure_ascii=False, indent=2))
        print("")
        print("详细信息:")
        print(json.dumps(record_dict, ensure_ascii=False, indent=2))

    elif args.command == "review":
        importer = Importer(storage, audit, version_manager)
        reviews = load_json(args.input)
        updated, not_found, unchanged = importer.apply_manual_review(
            reviews=reviews,
            batch_id=args.batch_id,
            applied_by=args.operator,
        )
        result = {
            "updated": updated,
            "not_found": not_found,
            "unchanged": unchanged,
        }
        print(f"人工改判应用完成: 批次 {args.batch_id}")
        print(f"已更新: {updated} 条（版本历史已写入）")
        print(f"未找到: {not_found} 条")
        print(f"无变化: {unchanged} 条")
        print("")
        print("详细信息:")
        print(json.dumps(result, ensure_ascii=False, indent=2))

    elif args.command == "import-details":
        workflow = ThreeStepWorkflow(storage)
        if args.import_id:
            details = workflow.get_import_details(args.import_id)
            print(format_import_details_table(details))
            print("")
            print("完整 JSON:")
            print(json.dumps(details, ensure_ascii=False, indent=2))
        elif args.batch_id:
            import_records = storage.list_import_records(batch_id=args.batch_id)
            if not import_records:
                print(f"批次 {args.batch_id} 无导入记录")
            for idx, record in enumerate(import_records, 1):
                print(f"
===== 导入记录 #{idx}: {record.id} =====")
                details = workflow.get_import_details(record.id)
                print(format_import_details_table(details))
        else:
            print("请指定 --import-id 或 --batch-id")

    elif args.command == "export":
        engine = MaskingEngine(storage, audit)
        recs = storage.list_recommendations(batch_id=args.batch_id)
        rec_ids = [r.id for r in recs]
        exported, skipped = engine.export_masked(
            recommendation_ids=rec_ids,
            exported_by=args.operator,
            include_unreviewed=args.include_unreviewed,
        )
        save_json(exported, args.output)
        print(f"脱敏导出完成: {len(exported)} 条 → {args.output}")
        print(f"已跳过: {len(skipped)} 条（存在手机号漏遮，留待算法同事复核）")
        if skipped:
            print(f"跳过 ID 列表: {skipped}")

    elif args.command == "workflow":
        workflow = ThreeStepWorkflow(storage)
        model_items = load_json(args.model_output)
        manual_reviews = load_json(args.manual_review)
        result = workflow.run_full_workflow(
            model_items=model_items,
            manual_reviews=manual_reviews,
            batch_id=args.batch_id,
            operator=args.operator,
        )
        if result["steps"][2]["exported_data"]:
            save_json(result["steps"][2]["exported_data"], args.output)

        summary = result["summary"]
        src_summary = summary.get("source_summary", {})

        print("")
        print(f"三步工作流完成: 批次 {args.batch_id}")
        print("=" * 60)
        print("步骤1: 模型输出导入")
        print(f"  新增材料:   {summary['imported']} 条")
        print(f"  内容更新:   {summary['updated_step1']} 条")
        print(f"  重复导入:   {summary['duplicates']} 条")
        if src_summary:
            print("  来源分类统计 (source_summary):")
            for k, v in src_summary.items():
                label = SOURCE_TYPE_LABELS.get(k, k)
                print(f"    {label}: {v}")
        print("")
        print("步骤2: 人工改判应用")
        print(f"  应用备注:   {summary['reviews_applied']} 条（版本历史已写入）")
        print("")
        print("步骤3: 脱敏导出")
        print(f"  成功导出:   {summary['exported']} 条 → {args.output}")
        print(f"  跳过(待复核): {summary['skipped']} 条")
        print(f"  手机号漏遮: {summary['phone_issues']} 条")
        print("=" * 60)
        print(f"后续命令:")
        print(f"  查看来源明细: lpr import-details -b {args.batch_id}")
        print(f"  查看批次汇总: lpr summary -b {args.batch_id}")
        print(f"  生成统一报告: lpr report -b {args.batch_id} -o report.json")

    elif args.command == "history":
        vm = version_manager
        if args.diff:
            print(format_history_diff(args.id, vm))
        else:
            histories = vm.get_history(args.id)
            print(f"版本历史列表: {args.id} 共 {len(histories)} 条")
            for h in histories:
                field_label = FIELD_NAME_LABELS.get(h.field_name, h.field_name or "?")
                print(f"  v{h.version} | {h.changed_at.strftime('%Y-%m-%d %H:%M:%S')} | "
                      f"{h.changed_by} | {field_label}")
                print(f"         原因: {h.change_reason or '未记录'}")
            print("")
            print("提示: 使用 --diff 查看完整改前改后文本")

    elif args.command == "rollback":
        vm = version_manager
        rec, changes = vm.rollback_to_version(
            recommendation_id=args.id,
            target_version=args.version,
            rolled_back_by=args.operator,
        )
        print(f"回滚完成: {args.id}")
        print(f"回滚目标版本: v{args.version}")
        print(f"新版本号: v{rec.version}（回滚动作产生新版本）")
        print(f"变更字段数: {len(changes)}")
        for c in changes:
            field_label = FIELD_NAME_LABELS.get(c["field"], c["field"])
            print(f"  已恢复: {field_label}")
        print("")
        print("详细变更:")
        print(json.dumps(changes, ensure_ascii=False, indent=2))

    elif args.command == "check":
        engine = MaskingEngine(storage, audit)
        if args.id:
            result = engine.process_recommendation(
                recommendation_id=args.id,
                processed_by=args.operator,
                auto_fix=args.auto_fix,
            )
            print(json.dumps(result, ensure_ascii=False, indent=2))
        elif args.batch_id:
            recs = storage.list_recommendations(batch_id=args.batch_id)
            all_violations = []
            for rec in recs:
                result = engine.process_recommendation(
                    recommendation_id=rec.id,
                    processed_by=args.operator,
                    auto_fix=args.auto_fix,
                )
                if result["has_unmasked"]:
                    all_violations.append(result)
            print(f"检查完成: {len(recs)} 条, 发现问题 {len(all_violations)} 条")
            for v in all_violations:
                print(f"  - {v['recommendation_id']}: {len(v['violations'])} 个违规")
        else:
            print("请指定 --id 或 --batch-id")

    elif args.command == "escalate":
        engine = MaskingEngine(storage, audit)
        rec = engine.mark_for_algorithm_review(
            recommendation_id=args.id,
            marked_by=args.operator,
            comment=args.comment,
        )
        print(f"已升级到算法同事复核: {rec.id}")
        print(f"状态: {rec.review_status}, 备注: {rec.review_comment}")

    elif args.command == "rules":
        if args.rule_id:
            rule = get_boundary_rule(args.rule_id)
            if rule:
                print(json.dumps(rule, ensure_ascii=False, indent=2))
            else:
                print(f"未找到规则: {args.rule_id}")
        else:
            for key, rule in BOUNDARY_RULES.items():
                print(f"{rule['id']} - {rule['name']}: {rule['description']}")

    elif args.command == "replay":
        commands = audit.generate_replay_commands()
        for cmd in commands[-args.limit:]:
            print(cmd)

    elif args.command == "summary":
        workflow = ThreeStepWorkflow(storage)
        summary = workflow.get_workflow_summary(args.batch_id)
        print(f"批次汇总: {args.batch_id}")
        print(f"推荐理由总数: {summary['total_recommendations']} 条")
        print(f"导入记录数:   {summary['import_records']} 次")
        print(f"已人工复核:   {summary['reviewed']} 条")
        print(f"手机号漏遮:   {summary['with_unmasked_phone']} 条")
        print(f"待算法复核:   {summary['pending_algorithm_review']} 条")
        print("")
        if summary.get("source_breakdown"):
            print("各记录来源明细 (source_breakdown):")
            for rec_id, info in summary["source_breakdown"].items():
                src_label = SOURCE_TYPE_LABELS.get(info["source_type"], info["source_type"])
                print(f"  {rec_id} → {src_label} (来源批次: {info['source_batch']})")
        print("")
        print("完整 JSON:")
        print(json.dumps(summary, ensure_ascii=False, indent=2))

    elif args.command == "report":
        workflow = ThreeStepWorkflow(storage)
        report = build_unified_report(workflow, args.batch_id)
        save_json(report, args.output)
        print(f"统一复盘报告已生成: {args.output}")
        print(f"推荐理由数:     {report['summary']['total_recommendations']}")
        print(f"导入记录数:     {len(report['import_details'])}")
        print(f"版本变更记录:   {sum(len(v) for v in report['recommendation_histories'].values())}")
        print(f"审计日志条数:   {len(report['audit_logs_recent'])}")
        print(f"重放命令数:     {len(report['replay_commands'])}")

    elif args.command == "audit":
        logs = audit.get_logs(limit=args.limit)
        for log in logs:
            print(json.dumps(log, ensure_ascii=False))


if __name__ == "__main__":
    main()

        print(f"导入完成: 批次 {args.batch_id}")
        print(f"总数: {record.item_count} 条")
        for k, v in src_summary.items():
            label = SOURCE_TYPE_LABELS.get(k, k)
            print(f"  {label}: {v} 条")
        print("source_summary:")
        print(json.dumps(src_summary, ensure_ascii=False, indent=2))
        print("")
        print("详细信息:")
        print(json.dumps(record_dict, ensure_ascii=False, indent=2))

    elif args.command == "review":
        importer = Importer(storage, audit, version_manager)
        reviews = load_json(args.input)
        updated, not_found, unchanged = importer.apply_manual_review(
            reviews=reviews,
            batch_id=args.batch_id,
            applied_by=args.operator,
        )
        result = {
            "updated": updated,
            "not_found": not_found,
            "unchanged": unchanged,
        }
        print(f"人工改判应用完成: 批次 {args.batch_id}")
        print(f"已更新: {updated} 条（版本历史已写入）")
        print(f"未找到: {not_found} 条")
        print(f"无变化: {unchanged} 条")
        print("")
        print("详细信息:")
        print(json.dumps(result, ensure_ascii=False, indent=2))

    elif args.command == "import-details":
        workflow = ThreeStepWorkflow(storage)
        if args.import_id:
            details = workflow.get_import_details(args.import_id)
            print(format_import_details_table(details))
            print("")
            print("完整 JSON:")
            print(json.dumps(details, ensure_ascii=False, indent=2))
        elif args.batch_id:
            import_records = storage.list_import_records(batch_id=args.batch_id)
            if not import_records:
                print(f"批次 {args.batch_id} 无导入记录")
            for idx, record in enumerate(import_records, 1):
                print(f"\n===== 导入记录 #{idx}: {record.id} =====")
                details = workflow.get_import_details(record.id)
                print(format_import_details_table(details))
        else:
            print("请指定 --import-id 或 --batch-id")

    elif args.command == "export":
        engine = MaskingEngine(storage, audit)
        recs = storage.list_recommendations(batch_id=args.batch_id)
        rec_ids = [r.id for r in recs]
        exported, skipped = engine.export_masked(
            recommendation_ids=rec_ids,
            exported_by=args.operator,
            include_unreviewed=args.include_unreviewed,
        )
        save_json(exported, args.output)
        print(f"脱敏导出完成: {len(exported)} 条 → {args.output}")
        print(f"已跳过: {len(skipped)} 条（存在手机号漏遮，留待算法同事复核）")
        if skipped:
            print(f"跳过 ID 列表: {skipped}")

    elif args.command == "workflow":
        workflow = ThreeStepWorkflow(storage)
        model_items = load_json(args.model_output)
        manual_reviews = load_json(args.manual_review)
        result = workflow.run_full_workflow(
            model_items=model_items,
            manual_reviews=manual_reviews,
            batch_id=args.batch_id,
            operator=args.operator,
        )
        if result["steps"][2]["exported_data"]:
            save_json(result["steps"][2]["exported_data"], args.output)

        summary = result["summary"]
        src_summary = summary.get("source_summary", {})

        print("")
        print(f"三步工作流完成: 批次 {args.batch_id}")
        print("=" * 60)
        print("步骤1: 模型输出导入")
        print(f"  新增材料:   {summary['imported']} 条")
        print(f"  内容更新:   {summary['updated_step1']} 条")
        print(f"  重复导入:   {summary['duplicates']} 条")
        if src_summary:
            print("  来源分类统计 (source_summary):")
            for k, v in src_summary.items():
                label = SOURCE_TYPE_LABELS.get(k, k)
                print(f"    {label}: {v}")
        print("")
        print("步骤2: 人工改判应用")
        print(f"  应用备注:   {summary['reviews_applied']} 条（版本历史已写入）")
        print("")
        print("步骤3: 脱敏导出")
        print(f"  成功导出:   {summary['exported']} 条 → {args.output}")
        print(f"  跳过(待复核): {summary['skipped']} 条")
        print(f"  手机号漏遮: {summary['phone_issues']} 条")
        print("=" * 60)
        print(f"后续命令:")
        print(f"  查看来源明细: lpr import-details -b {args.batch_id}")
        print(f"  查看批次汇总: lpr summary -b {args.batch_id}")
        print(f"  生成统一报告: lpr report -b {args.batch_id} -o report.json")

    elif args.command == "history":
        vm = version_manager
        if args.diff:
            print(format_history_diff(args.id, vm))
        else:
            histories = vm.get_history(args.id)
            print(f"版本历史列表: {args.id} 共 {len(histories)} 条")
            for h in histories:
                field_label = FIELD_NAME_LABELS.get(h.field_name, h.field_name or "?")
                print(f"  v{h.version} | {h.changed_at.strftime('%Y-%m-%d %H:%M:%S')} | "
                      f"{h.changed_by} | {field_label}")
                print(f"         原因: {h.change_reason or '未记录'}")
            print("")
            print("提示: 使用 --diff 查看完整改前改后文本")

    elif args.command == "rollback":
        vm = version_manager
        rec, changes = vm.rollback_to_version(
            recommendation_id=args.id,
            target_version=args.version,
            rolled_back_by=args.operator,
        )
        print(f"回滚完成: {args.id}")
        print(f"回滚目标版本: v{args.version}")
        print(f"新版本号: v{rec.version}（回滚动作产生新版本）")
        print(f"变更字段数: {len(changes)}")
        for c in changes:
            field_label = FIELD_NAME_LABELS.get(c["field"], c["field"])
            print(f"  已恢复: {field_label}")
        print("")
        print("详细变更:")
        print(json.dumps(changes, ensure_ascii=False, indent=2))

    elif args.command == "check":
        engine = MaskingEngine(storage, audit)
        if args.id:
            result = engine.process_recommendation(
                recommendation_id=args.id,
                processed_by=args.operator,
                auto_fix=args.auto_fix,
            )
            print(json.dumps(result, ensure_ascii=False, indent=2))
        elif args.batch_id:
            recs = storage.list_recommendations(batch_id=args.batch_id)
            all_violations = []
            for rec in recs:
                result = engine.process_recommendation(
                    recommendation_id=rec.id,
                    processed_by=args.operator,
                    auto_fix=args.auto_fix,
                )
                if result["has_unmasked"]:
                    all_violations.append(result)
            print(f"检查完成: {len(recs)} 条, 发现问题 {len(all_violations)} 条")
            for v in all_violations:
                print(f"  - {v['recommendation_id']}: {len(v['violations'])} 个违规")
        else:
            print("请指定 --id 或 --batch-id")

    elif args.command == "escalate":
        engine = MaskingEngine(storage, audit)
        rec = engine.mark_for_algorithm_review(
            recommendation_id=args.id,
            marked_by=args.operator,
            comment=args.comment,
        )
        print(f"已升级到算法同事复核: {rec.id}")
        print(f"状态: {rec.review_status}, 备注: {rec.review_comment}")

    elif args.command == "rules":
        if args.rule_id:
            rule = get_boundary_rule(args.rule_id)
            if rule:
                print(json.dumps(rule, ensure_ascii=False, indent=2))
            else:
                print(f"未找到规则: {args.rule_id}")
        else:
            for key, rule in BOUNDARY_RULES.items():
                print(f"{rule['id']} - {rule['name']}: {rule['description']}")

    elif args.command == "replay":
        commands = audit.generate_replay_commands()
        for cmd in commands[-args.limit:]:
            print(cmd)

    elif args.command == "summary":
        workflow = ThreeStepWorkflow(storage)
        summary = workflow.get_workflow_summary(args.batch_id)
        print(f"批次汇总: {args.batch_id}")
        print(f"推荐理由总数: {summary['total_recommendations']} 条")
        print(f"导入记录数:   {summary['import_records']} 次")
        print(f"已人工复核:   {summary['reviewed']} 条")
        print(f"手机号漏遮:   {summary['with_unmasked_phone']} 条")
        print(f"待算法复核:   {summary['pending_algorithm_review']} 条")
        print("")
        if summary.get("source_breakdown"):
            print("各记录来源明细 (source_breakdown):")
            for rec_id, info in summary["source_breakdown"].items():
                src_label = SOURCE_TYPE_LABELS.get(info["source_type"], info["source_type"])
                print(f"  {rec_id} → {src_label} (来源批次: {info['source_batch']})")
        print("")
        print("完整 JSON:")
        print(json.dumps(summary, ensure_ascii=False, indent=2))

    elif args.command == "report":
        workflow = ThreeStepWorkflow(storage)
        report = build_unified_report(workflow, args.batch_id)
        save_json(report, args.output)
        print(f"统一复盘报告已生成: {args.output}")
        print(f"推荐理由数:     {report['summary']['total_recommendations']}")
        print(f"导入记录数:     {len(report['import_details'])}")
        print(f"版本变更记录:   {sum(len(v) for v in report['recommendation_histories'].values())}")
        print(f"审计日志条数:   {len(report['audit_logs_recent'])}")
        print(f"重放命令数:     {len(report['replay_commands'])}")

    elif args.command == "audit":
        logs = audit.get_logs(limit=args.limit)
        for log in logs:
            print(json.dumps(log, ensure_ascii=False))


if __name__ == "__main__":
    main()
            all_recommendations.append(rec.to_dict())

    audit_logs = workflow.audit.get_logs(limit=500)

    report = {
        "report_type": "learning_path_recommendation_unified_report",
        "report_version": "2.0",
        "generated_at": __import__("datetime").datetime.now().isoformat(),
        "batch_id": batch_id,
        "summary": summary,
        "import_details": import_details_list,
        "recommendations": all_recommendations,
        "recommendation_histories": rec_histories,
        "audit_logs_recent": audit_logs,
        "replay_commands": workflow.audit.generate_replay_commands(),
        "source_type_labels": SOURCE_TYPE_LABELS,
        "field_name_labels": FIELD_NAME_LABELS,
        "boundary_rules_reference": {
            "RULE_001": "手机号漏遮判定/处理/回滚",
            "RULE_002": "重复导入去重",
            "RULE_003": "单条备注修改历史",
            "RULE_004": "3D/图表展示可溯源",
            "RULE_005": "三步工作流边界",
            "RULE_006": "审计与复盘",
        },
    }

    return report


def main():
    parser = create_parser()
    args = parser.parse_args()

    storage = JSONStorage(args.data_dir)
    audit = AuditLogger(storage)
    version_manager = VersionManager(storage, audit)

    if args.command == "import":
        importer = Importer(storage, audit, version_manager)
        items = load_json(args.input)
        record = importer.import_model_outputs(
            items=items,
            batch_id=args.batch_id,
            imported_by=args.operator,
            source_file=args.input,
        )
        record_dict = record.to_dict()
        src_summary = record_dict.get("metadata", {}).get("source_summary", {})

        print("=" * 70)
        print(f"  ✅ 导入完成: 批次 {args.batch_id}")
        print("=" * 70)
        print(f"  📊 总数: {record.item_count} 条")
        for k, v in src_summary.items():
            print(f"     {SOURCE_TYPE_LABELS.get(k, k)}: {v} 条")
        print("")
        print("  📄 详细 JSON:")
        print(json.dumps(record_dict, ensure_ascii=False, indent=2))

    elif args.command == "review":
        importer = Importer(storage, audit, version_manager)
        reviews = load_json(args.input)
        updated, not_found, unchanged = importer.apply_manual_review(
            reviews=reviews,
            batch_id=args.batch_id,
            applied_by=args.operator,
        )
        result = {
            "updated": updated,
            "not_found": not_found,
            "unchanged": unchanged,
        }
        print("=" * 70)
        print(f"  ✅ 人工改判应用完成: 批次 {args.batch_id}")
        print("=" * 70)
        print(f"  🔄 已更新:     {updated} 条 (版本历史已写入)")
        print(f"  🔍 未找到:     {not_found} 条")
        print(f"  ⏭️  无变化:      {unchanged} 条")
        print("")
        print("  📄 详细 JSON:")
        print(json.dumps(result, ensure_ascii=False, indent=2))

    elif args.command == "import-details":
        workflow = ThreeStepWorkflow(storage)
        if args.import_id:
            details = workflow.get_import_details(args.import_id)
            print(format_import_details_table(details))
            print("")
            print("  📄 完整 JSON:")
            print(json.dumps(details, ensure_ascii=False, indent=2))
        elif args.batch_id:
            import_records = storage.list_import_records(batch_id=args.batch_id)
            if not import_records:
                print(f"  ⚠️  批次 {args.batch_id} 无导入记录")
            for idx, record in enumerate(import_records, 1):
                print(f"\n===== 导入记录 #{idx}: {record.id} =====")
                details = workflow.get_import_details(record.id)
                print(format_import_details_table(details))
        else:
            print("  ❌ 请指定 --import-id 或 --batch-id")

    elif args.command == "export":
        engine = MaskingEngine(storage, audit)
        recs = storage.list_recommendations(batch_id=args.batch_id)
        rec_ids = [r.id for r in recs]
        exported, skipped = engine.export_masked(
            recommendation_ids=rec_ids,
            exported_by=args.operator,
            include_unreviewed=args.include_unreviewed,
        )
        save_json(exported, args.output)
        print("=" * 70)
        print(f"  ✅ 脱敏导出完成")
        print("=" * 70)
        print(f"  📤 已导出:     {len(exported)} 条 → {args.output}")
        print(f"  ⏭️  已跳过:     {len(skipped)} 条")
        if skipped:
            print(f"     原因: 存在手机号漏遮，已留待算法同事复核")
            print(f"     跳过 ID 列表: {skipped}")

    elif args.command == "workflow":
        workflow = ThreeStepWorkflow(storage)
        model_items = load_json(args.model_output)
        manual_reviews = load_json(args.manual_review)
        result = workflow.run_full_workflow(
            model_items=model_items,
            manual_reviews=manual_reviews,
            batch_id=args.batch_id,
            operator=args.operator,
        )
        if result["steps"][2]["exported_data"]:
            save_json(result["steps"][2]["exported_data"], args.output)

        summary = result["summary"]
        src_summary = summary.get("source_summary", {})

        print("")
        print("=" * 70)
        print(f"  ✅ 三步工作流完成: 批次 {args.batch_id}")
        print("=" * 70)
        print("")
        print("  📦 步骤1: 模型输出导入")
        print(f"     ✅ 新增材料:               {summary['imported']} 条")
        print(f"     🔄 内容更新:               {summary['updated_step1']} 条")
        print(f"     🔁 重复(未翻倍):           {summary['duplicates']} 条")
        if src_summary:
            for k, v in src_summary.items():
                print(f"       {SOURCE_TYPE_LABELS.get(k, k)}: {v}")
        print("")
        print("  📝 步骤2: 小孟补看人工改判")
        print(f"     ✅ 应用备注(版本历史已写): {summary['reviews_applied']} 条")
        print("")
        print("  📤 步骤3: 脱敏导出")
        print(f"     ✅ 成功导出:               {summary['exported']} 条 → {args.output}")
        print(f"     ⏭️  跳过(待算法复核):      {summary['skipped']} 条")
        print(f"     🚨 手机号漏遮:             {summary['phone_issues']} 条 → 留给算法同事")
        print("")
        print("=" * 70)
        print("  💡 后续命令:")
        print(f"     查看来源明细:   lpr import-details -b {args.batch_id}")
        print(f"     查看批次汇总:   lpr summary -b {args.batch_id}")
        print(f"     生成统一报告:   lpr report -b {args.batch_id} -o report.json")
        print(f"     查看版本差异:   lpr history --id <rec_id> --diff")
        print("=" * 70)

    elif args.command == "history":
        vm = version_manager
        if args.diff:
            print(format_history_diff(args.id, vm))
        else:
            histories = vm.get_history(args.id)
            print("=" * 70)
            print(f"  📋 版本历史列表: {args.id} (共 {len(histories)} 条)")
            print("=" * 70)
            for h in histories:
                field_label = FIELD_NAME_LABELS.get(h.field_name, h.field_name or "?")
                print(f"  v{h.version} | {h.changed_at.strftime('%H:%M:%S')} | "
                      f"{h.changed_by} | {field_label}")
                print(f"         原因: {h.change_reason or '未记录'}")
            print("")
            print("  💡 使用 --diff 查看完整改前改后文本")

    elif args.command == "rollback":
        vm = version_manager
        rec, changes = vm.rollback_to_version(
            recommendation_id=args.id,
            target_version=args.version,
            rolled_back_by=args.operator,
        )
        print("=" * 70)
        print(f"  ✅ 回滚完成: {args.id}")
        print("=" * 70)
        print(f"  🎯 回滚目标版本: v{args.version}")
        print(f"  🔢 新版本号:     v{rec.version} (回滚动作产生新版本)")
        print(f"  📝 变更字段数:   {len(changes)}")
        for c in changes:
            field_label = FIELD_NAME_LABELS.get(c["field"], c["field"])
            print(f"     🔄 {field_label}: 已恢复")
        print("")
        print("  📄 详细变更:")
        print(json.dumps(changes, ensure_ascii=False, indent=2))

    elif args.command == "check":
        engine = MaskingEngine(storage, audit)
        if args.id:
            result = engine.process_recommendation(
                recommendation_id=args.id,
                processed_by=args.operator,
                auto_fix=args.auto_fix,
            )
            print(json.dumps(result, ensure_ascii=False, indent=2))
        elif args.batch_id:
            recs = storage.list_recommendations(batch_id=args.batch_id)
            all_violations = []
            for rec in recs:
                result = engine.process_recommendation(
                    recommendation_id=rec.id,
                    processed_by=args.operator,
                    auto_fix=args.auto_fix,
                )
                if result["has_unmasked"]:
                    all_violations.append(result)
            print(f"检查完成: {len(recs)} 条, 发现问题 {len(all_violations)} 条")
            for v in all_violations:
                print(f"  - {v['recommendation_id']}: {len(v['violations'])} 个违规")

    elif args.command == "escalate":
        engine = MaskingEngine(storage, audit)
        rec = engine.mark_for_algorithm_review(
            recommendation_id=args.id,
            marked_by=args.operator,
            comment=args.comment,
        )
        print(f"已升级到算法同事复核: {rec.id}")
        print(f"状态: {rec.review_status}, 备注: {rec.review_comment}")

    elif args.command == "rules":
        if args.rule_id:
            rule = get_boundary_rule(args.rule_id)
            if rule:
                print(json.dumps(rule, ensure_ascii=False, indent=2))
            else:
                print(f"未找到规则: {args.rule_id}")
        else:
            for key, rule in BOUNDARY_RULES.items():
                print(f"{rule['id']} - {rule['name']}: {rule['description']}")

    elif args.command == "replay":
        commands = audit.generate_replay_commands()
        for cmd in commands[-args.limit:]:
            print(cmd)

    elif args.command == "summary":
        workflow = ThreeStepWorkflow(storage)
        summary = workflow.get_workflow_summary(args.batch_id)
        print("=" * 70)
        print(f"  📊 批次汇总: {args.batch_id}")
        print("=" * 70)
        print(f"  📋 推荐理由总数:     {summary['total_recommendations']} 条")
        print(f"  📥 导入记录数:       {summary['import_records']} 次")
        print(f"  👀 已人工复核:       {summary['reviewed']} 条")
        print(f"  🚨 手机号漏遮:       {summary['with_unmasked_phone']} 条")
        print(f"  ⏳ 待算法复核:       {summary['pending_algorithm_review']} 条")
        print("")
        if summary.get("source_breakdown"):
            print("  🔍 各记录来源明细:")
            for rec_id, info in summary["source_breakdown"].items():
                src_label = SOURCE_TYPE_LABELS.get(info["source_type"], info["source_type"])
                print(f"     {rec_id[:8]}... → {src_label} (来自批次 {info['source_batch']})")
        print("")
        print("  📄 完整 JSON:")
        print(json.dumps(summary, ensure_ascii=False, indent=2))

    elif args.command == "report":
        workflow = ThreeStepWorkflow(storage)
        report = build_unified_report(workflow, args.batch_id)
        save_json(report, args.output)
        print("=" * 70)
        print(f"  ✅ 统一复盘报告已生成: {args.output}")
        print("=" * 70)
        print(f"  📋 推荐理由数:     {report['summary']['total_recommendations']}")
        print(f"  📥 导入记录数:     {len(report['import_details'])}")
        print(f"  📝 版本变更记录:   {sum(len(v) for v in report['recommendation_histories'].values())}")
        print(f"  📜 审计日志条数:   {len(report['audit_logs_recent'])}")
        print(f"  🔁 重放命令数:     {len(report['replay_commands'])}")
        print("")
        print("  💡 此报告格式统一，可用于:")
        print("     • 页面展示（前端直接解析 JSON）")
        print("     • 接口返回（REST API 直接返回）")
        print("     • 命令行查看（直接读取此文件）")
        print("     • 存档复盘（完整包含原始数据、历史、审计）")

    elif args.command == "audit":
        logs = audit.get_logs(limit=args.limit)
        for log in logs:
            print(json.dumps(log, ensure_ascii=False))


if __name__ == "__main__":
    main()
