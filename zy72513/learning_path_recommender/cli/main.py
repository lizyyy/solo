import argparse
import json
import sys
from typing import List, Dict, Any

from ..storage import JSONStorage
from ..audit import AuditLogger
from ..core import Importer, VersionManager, MaskingEngine
from ..workflow import ThreeStepWorkflow
from ..config import BOUNDARY_RULES, get_boundary_rule


FIELD_NAME_LABELS = {
    "content": "推荐内容",
    "source_model_output": "模型输出片段",
    "source_manual_review": "人工改判内容",
    "review_comment": "复核备注",
    "review_status": "复核状态",
    "reviewer": "复核人",
    "masking_status": "脱敏状态",
    "has_unmasked_phone": "手机号漏遮标记",
}

SOURCE_TYPE_LABELS = {
    "model_output": "模型输出片段",
    "manual_review": "人工改判表",
    "both": "模型输出+人工改判",
}


def load_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(data: Any, path: str):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def format_history_diff(rec_id: str, vm: VersionManager) -> str:
    lines = []
    lines.append("=" * 70)
    lines.append(f"  📋 版本历史差异: {rec_id}")
    lines.append("=" * 70)
    histories = vm.get_history(rec_id)
    if not histories:
        lines.append("  ⚠️  无版本历史记录")
        return "\n".join(lines)

    rec = vm.storage.get_recommendation(rec_id)
    if rec:
        lines.append(f"  🔖 当前版本: v{rec.version}")
        lines.append(f"  📝 复核状态: {rec.review_status}")
        lines.append(f"  👤 复核人: {rec.reviewer or '未指定'}")
        lines.append(f"  📞 手机号漏遮: {'是' if rec.has_unmasked_phone else '否'}")
        lines.append("")

    for h in histories:
        field_label = FIELD_NAME_LABELS.get(h.field_name, h.field_name or "?")
        lines.append(f"  --- v{h.version} (v{h.previous_version} → v{h.version}) ---")
        lines.append(f"  ⏰ 时间: {h.changed_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"  👤 修改人: {h.changed_by}")
        lines.append(f"  📝 原因: {h.change_reason or '未记录'}")
        lines.append(f"  📌 字段: {field_label} ({h.field_name})")
        lines.append(f"  ⬅️  改前: {h.old_value if h.old_value is not None else '(空)'}")
        lines.append(f"  ➡️  改后: {h.new_value if h.new_value is not None else '(空)'}")
        lines.append("")

    lines.append("=" * 70)
    lines.append("  💡 历史留痕说明:")
    lines.append("     • 以上每一条都是一次真实变更的完整记录")
    lines.append("     • 改前值(⬅️) 不会因为后续修改而丢失")
    lines.append("     • 可随时用 rollback 回滚到任意版本")
    lines.append("     • 审计日志同时记录了所有操作")
    lines.append("=" * 70)
    return "\n".join(lines)


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="lpr", description="学习路径推荐理由管理系统")
    parser.add_argument("--data-dir", default="data", help="数据存储目录")
    subparsers = parser.add_subparsers(dest="command", required=True)

    ip = subparsers.add_parser("import", help="导入模型输出片段")
    ip.add_argument("--input", "-i", required=True)
    ip.add_argument("--batch-id", "-b", required=True)
    ip.add_argument("--operator", "-o", default="system")

    rp = subparsers.add_parser("review", help="应用人工改判表（记录版本历史）")
    rp.add_argument("--input", "-i", required=True)
    rp.add_argument("--batch-id", "-b", required=True)
    rp.add_argument("--operator", "-o", default="xiaomeng")

    ep = subparsers.add_parser("export", help="脱敏导出")
    ep.add_argument("--batch-id", "-b", required=True)
    ep.add_argument("--output", "-o", default="export.json")
    ep.add_argument("--operator", "-u", default="system")
    ep.add_argument("--include-unreviewed", action="store_true")

    wp = subparsers.add_parser("workflow", help="完整三步工作流")
    wp.add_argument("--model-output", "-m", required=True)
    wp.add_argument("--manual-review", "-r", required=True)
    wp.add_argument("--batch-id", "-b", required=True)
    wp.add_argument("--operator", "-o", default="xiaomeng")
    wp.add_argument("--output", "-O", default="export.json")

    hp = subparsers.add_parser("history", help="查看版本历史（改前改后）")
    hp.add_argument("--id", required=True)
    hp.add_argument("--diff", action="store_true")

    rbp = subparsers.add_parser("rollback", help="回滚到指定版本")
    rbp.add_argument("--id", required=True)
    rbp.add_argument("--version", "-v", type=int, required=True)
    rbp.add_argument("--operator", "-o", default="system")

    cp = subparsers.add_parser("check", help="检查脱敏问题")
    cp.add_argument("--id")
    cp.add_argument("--batch-id")
    cp.add_argument("--auto-fix", action="store_true")
    cp.add_argument("--operator", "-o", default="system")

    esp = subparsers.add_parser("escalate", help="升级到算法同事复核")
    esp.add_argument("--id", required=True)
    esp.add_argument("--comment", "-c")
    esp.add_argument("--operator", "-o", default="xiaomeng")

    rlp = subparsers.add_parser("rules", help="查看边界规则")
    rlp.add_argument("--rule-id")

    rpp = subparsers.add_parser("replay", help="生成可复盘的重放命令")
    rpp.add_argument("--limit", type=int, default=100)

    sp = subparsers.add_parser("summary", help="查看批次汇总")
    sp.add_argument("--batch-id", "-b", required=True)

    ap = subparsers.add_parser("audit", help="查看审计日志")
    ap.add_argument("--limit", type=int, default=50)

    return parser


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
            items=items, batch_id=args.batch_id,
            imported_by=args.operator, source_file=args.input,
        )
        print("=" * 70)
        print(f"  ✅ Step 1 完成: 模型输出片段导入")
        print("=" * 70)
        print(f"  📦 批次ID: {args.batch_id}")
        print(f"  📊 导入总数: {record.item_count} 条")
        print(f"  🆕 新增记录: {record.new_count} 条")
        print(f"  🔁 重复(未翻倍): {record.duplicate_count} 条")
        print(f"  🔄 内容更新: {record.updated_count} 条")
        print("")
        print(f"  🆔 生成的推荐理由ID:")
        for rid in record.item_ids:
            print(f"     • {rid}")
        print("")
        print("  💡 下一步: 运行 review 命令补录人工改判备注")

    elif args.command == "review":
        # 关键修复: 必须传 version_manager，否则版本历史不写入
        importer = Importer(storage, audit, version_manager)
        reviews = load_json(args.input)
        updated, not_found, unchanged = importer.apply_manual_review(
            reviews=reviews, batch_id=args.batch_id, applied_by=args.operator,
        )
        print("=" * 70)
        print(f"  ✅ Step 2 完成: 小孟补看人工改判表")
        print("=" * 70)
        print(f"  📦 批次ID: {args.batch_id}")
        print(f"  👤 操作人: {args.operator}")
        print(f"  📝 已更新(版本历史已写入): {updated} 条")
        print(f"  🔍 未找到匹配: {not_found} 条")
        print(f"  ⏭️  无变化: {unchanged} 条")
        print("")
        print("  🔗 变更已连接到同一条模型输出片段记录")
        print("  💡 下一步: 用 history --id <ID> --diff 查看改前改后差异")
        print("  💡 再下一步: 运行 export 做脱敏导出")

    elif args.command == "export":
        engine = MaskingEngine(storage, audit)
        recs = storage.list_recommendations(batch_id=args.batch_id)
        rec_ids = [r.id for r in recs]
        exported, skipped = engine.export_masked(
            recommendation_ids=rec_ids, exported_by=args.operator,
            include_unreviewed=args.include_unreviewed,
        )
        save_json(exported, args.output)
        print("=" * 70)
        print(f"  ✅ Step 3 完成: 脱敏导出更新")
        print("=" * 70)
        print(f"  📤 成功导出: {len(exported)} 条 → {args.output}")
        print(f"  ⏭️  已跳过: {len(skipped)} 条（待算法同事复核）")
        if skipped:
            print("")
            print(f"  🚨 跳过原因: 存在手机号漏遮，留给算法同事")
            print(f"  🆔 跳过ID: {skipped}")
        print("")
        print("  💡 验证: 用 history --id <ID> --diff 查看历史是否保留")

    elif args.command == "workflow":
        workflow = ThreeStepWorkflow(storage)
        model_items = load_json(args.model_output)
        manual_reviews = load_json(args.manual_review)
        result = workflow.run_full_workflow(
            model_items=model_items, manual_reviews=manual_reviews,
            batch_id=args.batch_id, operator=args.operator,
        )
        if result["steps"][2]["exported_data"]:
            save_json(result["steps"][2]["exported_data"], args.output)
        s = result["summary"]
        print("=" * 70)
        print(f"  ✅ 完整三步工作流完成: 批次 {args.batch_id}")
        print("=" * 70)
        print(f"  Step1 导入: 新增{s['imported']} 更新{s['updated_step1']} 重复{s['duplicates']}")
        print(f"  Step2 改判: 应用{s['reviews_applied']} 条（版本历史已写入）")
        print(f"  Step3 导出: 成功{s['exported']} 跳过{s['skipped']} 手机号问题{s['phone_issues']}")
        print("=" * 70)

    elif args.command == "history":
        if args.diff:
            print(format_history_diff(args.id, version_manager))
        else:
            histories = version_manager.get_history(args.id)
            rec = storage.get_recommendation(args.id)
            print("=" * 70)
            print(f"  📋 版本历史列表: {args.id}")
            print("=" * 70)
            if rec:
                print(f"  📌 当前记录状态:")
                print(f"     • 版本号: v{rec.version}")
                print(f"     • 复核状态: {rec.review_status}")
                print(f"     • 复核人: {rec.reviewer or '未指定'}")
                print(f"     • 当前备注: {rec.review_comment or '(无)'}")
                print(f"     • 手机号漏遮: {'是' if rec.has_unmasked_phone else '否'}")
                print("")
            print(f"  📜 历史变更记录 (共 {len(histories)} 条):")
            for h in histories:
                fl = FIELD_NAME_LABELS.get(h.field_name, h.field_name or "?")
                print(f"     v{h.version} | {h.changed_at.strftime('%H:%M:%S')} | {h.changed_by} | {fl}")
            print("")
            print("  💡 使用 --diff 查看完整改前改后文本")

    elif args.command == "rollback":
        rec, changes = version_manager.rollback_to_version(
            recommendation_id=args.id, target_version=args.version,
            rolled_back_by=args.operator,
        )
        print("=" * 70)
        print(f"  ✅ 回滚完成: {args.id}")
        print("=" * 70)
        print(f"  🎯 目标版本: v{args.version}")
        print(f"  🔢 新版本号: v{rec.version} (回滚动作产生新版本)")
        print(f"  📝 变更字段: {len(changes)} 个")
        for c in changes:
            fl = FIELD_NAME_LABELS.get(c["field"], c["field"])
            print(f"     • 已恢复: {fl}")

    elif args.command == "check":
        engine = MaskingEngine(storage, audit)
        if args.id:
            result = engine.process_recommendation(
                recommendation_id=args.id, processed_by=args.operator,
                auto_fix=args.auto_fix,
            )
            print(json.dumps(result, ensure_ascii=False, indent=2))
        elif args.batch_id:
            recs = storage.list_recommendations(batch_id=args.batch_id)
            issues = []
            for rec in recs:
                r = engine.process_recommendation(
                    recommendation_id=rec.id, processed_by=args.operator,
                    auto_fix=args.auto_fix,
                )
                if r["has_unmasked"]:
                    issues.append(r)
            print(f"检查完成: {len(recs)} 条, 问题 {len(issues)} 条")
            for v in issues:
                print(f"  - {v['recommendation_id']}: {len(v['violations'])} 个违规")
        else:
            print("请指定 --id 或 --batch-id")

    elif args.command == "escalate":
        engine = MaskingEngine(storage, audit)
        rec = engine.mark_for_algorithm_review(
            recommendation_id=args.id, marked_by=args.operator,
            comment=args.comment,
        )
        print(f"已升级到算法复核: {rec.id}")
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
        print(f"  📋 推荐理由总数: {summary['total_recommendations']} 条")
        print(f"  📥 导入记录: {summary['import_records']} 次")
        print(f"  👀 已人工复核: {summary['reviewed']} 条")
        print(f"  🚨 手机号漏遮: {summary['with_unmasked_phone']} 条")
        print(f"  ⏳ 待算法复核: {summary['pending_algorithm_review']} 条")
        print(f"  🆔 推荐理由ID列表: {summary['recommendation_ids']}")

    elif args.command == "audit":
        logs = audit.get_logs(limit=args.limit)
        for log in logs:
            print(json.dumps(log, ensure_ascii=False))


if __name__ == "__main__":
    main()
