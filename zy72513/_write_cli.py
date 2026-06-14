content = '''from typing import List, Dict, Any
from ..core import Importer, VersionManager, MaskingEngine
from ..audit import AuditLogger
from ..storage import JSONStorage


class ThreeStepWorkflow:
    def __init__(self, storage: JSONStorage):
        self.storage = storage
        self.audit = AuditLogger(storage)
        self.version_manager = VersionManager(storage, self.audit)
        self.importer = Importer(storage, self.audit, self.version_manager)
        self.masking_engine = MaskingEngine(storage, self.audit)

    def step1_import_model_outputs(
        self,
        items: List[Dict[str, Any]],
        batch_id: str,
        imported_by: str = "system",
        source_file: str = None,
    ) -> Dict[str, Any]:
        self.audit.log_workflow_step(
            workflow_name="three_step",
            step_name="step1_import_model_outputs",
            status="started",
            operator=imported_by,
            context={"batch_id": batch_id, "item_count": len(items)},
        )

        import_record = self.importer.import_model_outputs(
            items=items,
            batch_id=batch_id,
            imported_by=imported_by,
            source_file=source_file,
        )

        for rec_id in import_record.item_ids:
            self.masking_engine.process_recommendation(
                recommendation_id=rec_id,
                processed_by=imported_by,
                auto_fix=False,
            )

        result = {
            "step": 1,
            "name": "import_model_outputs",
            "batch_id": batch_id,
            "import_record": import_record.to_dict(),
            "item_ids": import_record.item_ids,
        }

        self.audit.log_workflow_step(
            workflow_name="three_step",
            step_name="step1_import_model_outputs",
            status="completed",
            operator=imported_by,
            context=result,
        )

        return result

    def step2_apply_manual_reviews(
        self,
        reviews: List[Dict[str, Any]],
        batch_id: str,
        applied_by: str = "xiaomeng",
    ) -> Dict[str, Any]:
        self.audit.log_workflow_step(
            workflow_name="three_step",
            step_name="step2_apply_manual_reviews",
            status="started",
            operator=applied_by,
            context={"batch_id": batch_id, "review_count": len(reviews)},
        )

        updated, not_found, unchanged = self.importer.apply_manual_review(
            reviews=reviews,
            batch_id=batch_id,
            applied_by=applied_by,
        )

        recs = self.storage.list_recommendations(batch_id=batch_id)
        rec_ids = [r.id for r in recs]

        for rec_id in rec_ids:
            rec = self.storage.get_recommendation(rec_id)
            if rec and rec.review_status == "reviewed":
                self.masking_engine.process_recommendation(
                    recommendation_id=rec_id,
                    processed_by=applied_by,
                    auto_fix=False,
                )

        result = {
            "step": 2,
            "name": "apply_manual_reviews",
            "batch_id": batch_id,
            "updated": updated,
            "not_found": not_found,
            "unchanged": unchanged,
        }

        self.audit.log_workflow_step(
            workflow_name="three_step",
            step_name="step2_apply_manual_reviews",
            status="completed",
            operator=applied_by,
            context=result,
        )

        return result

    def step3_export_masked(
        self,
        batch_id: str,
        exported_by: str,
        include_unreviewed: bool = False,
        escalate_phone_issues: bool = True,
    ) -> Dict[str, Any]:
        self.audit.log_workflow_step(
            workflow_name="three_step",
            step_name="step3_export_masked",
            status="started",
            operator=exported_by,
            context={"batch_id": batch_id, "include_unreviewed": include_unreviewed},
        )

        recs = self.storage.list_recommendations(batch_id=batch_id)
        rec_ids = [r.id for r in recs]

        phone_issues = []
        for rec_id in rec_ids:
            rec = self.storage.get_recommendation(rec_id)
            if rec and rec.has_unmasked_phone:
                if escalate_phone_issues:
                    self.masking_engine.mark_for_algorithm_review(
                        recommendation_id=rec_id,
                        marked_by=exported_by,
                        comment="导出时发现手机号漏遮，留待算法同事复核",
                    )
                phone_issues.append(rec_id)

        exported, skipped = self.masking_engine.export_masked(
            recommendation_ids=rec_ids,
            exported_by=exported_by,
            include_unreviewed=include_unreviewed,
        )

        result = {
            "step": 3,
            "name": "export_masked",
            "batch_id": batch_id,
            "total": len(rec_ids),
            "exported_count": len(exported),
            "skipped_count": len(skipped),
            "phone_issue_count": len(phone_issues),
            "phone_issue_ids": phone_issues,
            "skipped_ids": skipped,
            "exported_data": exported,
        }

        self.audit.log_workflow_step(
            workflow_name="three_step",
            step_name="step3_export_masked",
            status="completed",
            operator=exported_by,
            context={k: v for k, v in result.items() if k != "exported_data"},
        )

        return result

    def run_full_workflow(
        self,
        model_items: List[Dict[str, Any]],
        manual_reviews: List[Dict[str, Any]],
        batch_id: str,
        operator: str = "xiaomeng",
    ) -> Dict[str, Any]:
        step1 = self.step1_import_model_outputs(
            items=model_items,
            batch_id=batch_id,
            imported_by=operator,
        )

        step2 = self.step2_apply_manual_reviews(
            reviews=manual_reviews,
            batch_id=batch_id,
            applied_by=operator,
        )

        step3 = self.step3_export_masked(
            batch_id=batch_id,
            exported_by=operator,
            include_unreviewed=False,
            escalate_phone_issues=True,
        )

        return {
            "batch_id": batch_id,
            "workflow": "three_step_complete",
            "steps": [step1, step2, step3],
            "summary": {
                "imported": step1["import_record"]["new_count"],
                "updated_step1": step1["import_record"]["updated_count"],
                "duplicates": step1["import_record"]["duplicate_count"],
                "reviews_applied": step2["updated"],
                "exported": step3["exported_count"],
                "skipped": step3["skipped_count"],
                "phone_issues": step3["phone_issue_count"],
                "source_summary": step1["import_record"]["metadata"].get("source_summary", {}),
            },
        }

    def get_workflow_summary(self, batch_id: str) -> Dict[str, Any]:
        recs = self.storage.list_recommendations(batch_id=batch_id)
        import_records = self.storage.list_import_records(batch_id=batch_id)

        with_phone = [r for r in recs if r.has_unmasked_phone]
        reviewed = [r for r in recs if r.review_status == "reviewed"]
        pending_alg = [r for r in recs if r.review_status == "pending_algorithm_review"]

        source_breakdown = {}
        for record in import_records:
            item_details = record.metadata.get("item_processing_details", [])
            for detail in item_details:
                rec_id = detail["recommendation_id"]
                source_breakdown[rec_id] = {
                    "source_type": detail["source_type"],
                    "source_batch": detail["source_batch"],
                    "import_batch_id": record.batch_id,
                    "imported_at": record.imported_at.isoformat(),
                    "imported_by": record.imported_by,
                }

        return {
            "batch_id": batch_id,
            "total_recommendations": len(recs),
            "import_records": len(import_records),
            "with_unmasked_phone": len(with_phone),
            "reviewed": len(reviewed),
            "pending_algorithm_review": len(pending_alg),
            "recommendation_ids": [r.id for r in recs],
            "phone_issue_ids": [r.id for r in with_phone],
            "source_breakdown": source_breakdown,
        }

    def get_import_details(self, import_record_id: str) -> Dict[str, Any]:
        record = self.storage.get_import_record(import_record_id)
        if not record:
            return {"error": "Import record not found"}

        item_details = record.metadata.get("item_processing_details", [])
        source_summary = record.metadata.get("source_summary", {})

        detailed_items = []
        for detail in item_details:
            rec = self.storage.get_recommendation(detail["recommendation_id"])
            item_info = detail.copy()
            if rec:
                item_info["content_preview"] = rec.content[:100] if rec.content else ""
                item_info["current_version"] = rec.version
                item_info["masking_status"] = rec.masking_status
                item_info["review_status"] = rec.review_status
            detailed_items.append(item_info)

        source_type_labels = {
            "new_material": "新增材料",
            "current_batch_duplicate": "本次重复导入",
            "historical_batch_duplicate": "历史批次重复",
            "content_updated": "内容有更新",
        }

        return {
            "import_record_id": record.id,
            "batch_id": record.batch_id,
            "imported_at": record.imported_at.isoformat(),
            "imported_by": record.imported_by,
            "source_file": record.source_file,
            "total_items": record.item_count,
            "new_count": record.new_count,
            "duplicate_count": record.duplicate_count,
            "updated_count": record.updated_count,
            "source_summary": source_summary,
            "source_summary_labels": {k: source_type_labels.get(k, k) for k in source_summary.keys()},
            "items": detailed_items,
        }
'''

with open('/Users/lzy/pro/solo/workspaces/zy72513/learning_path_recommender/workflow/three_step_flow.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("File written successfully")
import textwrap

content = textwrap.dedent('''
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


SOURCE_TYPE_LABELS = {
    "new_material": "新增材料",
    "current_batch_duplicate": "本次重复导入",
    "historical_batch_duplicate": "历史批次重复",
    "content_updated": "内容有更新",
}

FIELD_NAME_LABELS = {
    "content": "推荐理由正文",
    "source_model_output": "模型输出原始片段",
    "source_manual_review": "人工改判备注内容",
    "review_comment": "复核意见",
}


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

    import_details_parser = subparsers.add_parser("import-details", help="查看导入详情")
    import_details_parser.add_argument("--import-id", help="导入记录 ID")
    import_details_parser.add_argument("--batch-id", "-b", help="批次 ID")

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

    report_parser = subparsers.add_parser("report", help="生成统一复盘报告")
    report_parser.add_argument("--batch-id", "-b", required=True, help="批次 ID")
    report_parser.add_argument("--output", "-o", default="replay_report.json", help="报告输出文件")

    audit_parser = subparsers.add_parser("audit", help="查看审计日志")
    audit_parser.add_argument("--limit", type=int, default=50, help="日志条数")

    return parser


def load_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(data: Any, path: str):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def format_history_diff(rec_id: str, vm: VersionManager) -> str:
    histories = vm.get_history(rec_id)
    if not histories:
        return f"推荐理由 {rec_id} 暂无版本历史记录"

    lines = [
        f"版本历史: {rec_id}  共 {len(histories)} 条变更",
        "-" * 70,
    ]

    for idx, h in enumerate(histories, 1):
        field_label = FIELD_NAME_LABELS.get(h.field_name, h.field_name or "未知字段")
        lines += [
            f"变更 #{idx}  版本 v{h.previous_version or 1} \\u2192 v{h.version}",
            f"  修改时间: {h.changed_at.strftime('%Y-%m-%d %H:%M:%S')}",
            f"  修改人:   {h.changed_by or '未记录'}",
            f"  字段名称: {field_label}",
            f"  来源:     {h.source or '未记录'}",
            f"  修改原因: {h.change_reason or '未记录原因'}",
            "",
            "  改前文本 (old_value):",
            f"    {h.old_value or '(空/无)'}",
            "",
            "  改后文本 (new_value):",
            f"    {h.new_value or '(空/无)'}",
            "-" * 70,
        ]

    return "\\n".join(lines)


def format_import_details_table(details: Dict[str, Any]) -> str:
    lines = [
        f"导入详情: {details.get('import_record_id', 'N/A')}  批次: {details.get('batch_id', 'N/A')}",
        f"总数: {details.get('total_items', 0)} 条",
        "",
    ]

    src_summary = details.get("source_summary", {})
    if src_summary:
        lines.append("来源分类统计:")
        for k, v in src_summary.items():
            label = SOURCE_TYPE_LABELS.get(k, k)
            lines.append(f"  {label}: {v} 条")
        lines.append("")

    lines += [
        "-" * 90,
        f"{'序号':<5} {'来源分类':<14} {'推荐理由ID':<38} {'来源批次':<14} {'脱敏状态':<10}",
        "-" * 90,
    ]

    for idx, item in enumerate(details.get("items", []), 1):
        src_type = item.get("source_type", "")
        src_label = SOURCE_TYPE_LABELS.get(src_type, src_type)
        lines.append(
            f"{idx:<5} {src_label:<14} {str(item.get('recommendation_id', ''))[:36]:<38} "
            f"{str(item.get('source_batch', ''))[:12]:<14} {item.get('masking_status', ''):<10}"
        )

    lines.append("-" * 90)
    return "\\n".join(lines)


def build_unified_report(workflow: ThreeStepWorkflow, batch_id: str) -> Dict[str, Any]:
    from datetime import datetime

    summary = workflow.get_workflow_summary(batch_id)
    import_records = workflow.storage.list_import_records(batch_id=batch_id)

    import_details_list = []
    for record in import_records:
        detail = workflow.get_import_details(record.id)
        import_details_list.append(detail)

    rec_histories = {}
    for rec_id in summary.get("recommendation_ids", []):
        histories = workflow.version_manager.get_history(rec_id)
        if histories:
            rec_histories[rec_id] = [h.to_dict() for h in histories]

    all_recommendations = []
    for rec_id in summary.get("recommendation_ids", []):
        rec = workflow.storage.get_recommendation(rec_id)
        if rec:
            all_recommendations.append(rec.to_dict())

    audit_logs = workflow.audit.get_logs(limit=500)

    report = {
        "report_type": "learning_path_recommendation_unified_report",
        "report_version": "2.0",
        "generated_at": datetime.now().isoformat(),
        "batch_id": batch_id,
        "summary": summary,
        "import_details": import_details_list,
        "recommendations": all_recommendations,
        "recommendation_histories": rec_histories,
        "audit_logs_recent": audit_logs,
        "replay_commands": workflow.audit.generate_replay_commands(),
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
                print(f"\\n===== 导入记录 #{idx}: {record.id} =====")
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
        print(f"脱敏导出完成: {len(exported)} 条 \\u2192 {args.output}")
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
        print(f"  成功导出:   {summary['exported']} 条 \\u2192 {args.output}")
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
                print(f"  {rec_id} \\u2192 {src_label} (来源批次: {info['source_batch']})")
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
''').lstrip()

target = '/Users/lzy/pro/solo/workspaces/zy72513/learning_path_recommender/cli/main.py'
with open(target, 'w', encoding='utf-8') as f:
    f.write(content)
print('OK: written', len(content), 'chars to', target)
