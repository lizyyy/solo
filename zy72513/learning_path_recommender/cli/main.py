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

    if args.command == "import":
        importer = Importer(storage, audit)
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
