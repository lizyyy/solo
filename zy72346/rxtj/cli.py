from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

from .store import Store
from .importer import import_annotations
from .workflow import (
    step1_import_annotations,
    step2_review_sampling,
    step3_update_demo,
    get_audit_trail,
)
from .rules import (
    AnnotationSource,
    ReviewStatus,
    BOUNDARY_RULES,
    DENOMINATOR_ZERO_ACTIONS,
)


def _load_rows_from_file(filepath: str) -> list[dict]:
    path = Path(filepath)
    if path.suffix == ".json":
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    elif path.suffix in (".csv", ".tsv"):
        delimiter = "\t" if path.suffix == ".tsv" else ","
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter=delimiter)
            rows = []
            for i, row in enumerate(reader, 1):
                row.setdefault("line_number", i)
                rows.append(row)
            return rows
    else:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)


def cmd_import(args):
    store = Store(args.db)
    rows = _load_rows_from_file(args.file)
    source = AnnotationSource.TEACHER_ANNOTATION
    if args.source == "sampling":
        source = AnnotationSource.SAMPLING_LIST

    result = import_annotations(store, rows, source, changed_by=args.operator)
    print(result.summary())

    if args.json:
        print("\n--- JSON ---")
        print(json.dumps({
            "batch": result.batch.to_dict(),
            "changes": [ch.to_dict() for ch in result.changes],
            "flagged": [a.to_dict() for a in result.flagged],
        }, ensure_ascii=False, indent=2))


def cmd_workflow(args):
    store = Store(args.db)

    if args.step == "1" or args.step == "import":
        rows = _load_rows_from_file(args.file)
        result, state = step1_import_annotations(store, rows, changed_by=args.operator)
        print("=== 第一步：导入老师批注 ===")
        print(result.summary())
        print()
        print(state.summary())
        if args.json:
            print("\n--- JSON ---")
            print(json.dumps({
                "import_result": {
                    "batch": result.batch.to_dict(),
                    "changes": [ch.to_dict() for ch in result.changes],
                    "flagged": [a.to_dict() for a in result.flagged],
                },
                "state": {
                    "current_step": state.current_step,
                    "annotation_count": state.annotation_count,
                    "sampling_count": state.sampling_count,
                    "flagged_count": state.flagged_count,
                },
            }, ensure_ascii=False, indent=2))

    elif args.step == "2" or args.step == "review":
        rows = _load_rows_from_file(args.file)
        conflict_changes, state = step2_review_sampling(store, rows, changed_by=args.operator)
        print("=== 第二步：竞赛教练唐老师补看抽样名单 ===")
        if conflict_changes:
            print("发现冲突:")
            for ch in conflict_changes:
                print(
                    f"  批注ID={ch.annotation_id} "
                    f"旧状态='{ch.old_value}' → 新状态='{ch.new_value}' "
                    f"原因={ch.reason}"
                )
        else:
            print("无冲突，全部通过。")
        print()
        print(state.summary())
        if args.json:
            print("\n--- JSON ---")
            print(json.dumps({
                "conflict_changes": [ch.to_dict() for ch in conflict_changes],
                "state": {
                    "current_step": state.current_step,
                    "annotation_count": state.annotation_count,
                    "sampling_count": state.sampling_count,
                    "flagged_count": state.flagged_count,
                },
            }, ensure_ascii=False, indent=2))

    elif args.step == "3" or args.step == "demo":
        results, state = step3_update_demo(store)
        print("=== 第三步：课堂演示结果更新 ===")
        for r in results:
            ev = r.evidence
            ev_str = ""
            if ev:
                ev_str = (
                    f"  证据: 行号={ev.original_line_number} "
                    f"原始值='{ev.original_value}' "
                    f"当前值='{ev.current_value}' "
                    f"来源={ev.source.value}"
                )
                if ev.is_edge_case:
                    ev_str += f" 边界={ev.edge_case_type}"
                if ev.sampling_list_value:
                    ev_str += f" 抽样值='{ev.sampling_list_value}'"
                if ev.conflict_resolution:
                    ev_str += f" 冲突处理={ev.conflict_resolution}"

            status_mark = ""
            if r.status == ReviewStatus.FLAGGED:
                status_mark = " ⚠待复核"
            elif r.status == ReviewStatus.ROLLED_BACK:
                status_mark = " ↩已回滚"

            print(
                f"[{r.category}] {r.item_name}: "
                f"值={r.value}{status_mark}"
            )
            if ev_str:
                print(ev_str)
        print()
        print(state.summary())
        if args.json:
            print("\n--- JSON ---")
            print(json.dumps({
                "results": [r.to_dict() for r in results],
                "state": {
                    "current_step": state.current_step,
                    "annotation_count": state.annotation_count,
                    "sampling_count": state.sampling_count,
                    "flagged_count": state.flagged_count,
                },
            }, ensure_ascii=False, indent=2))
    else:
        print(f"未知步骤: {args.step}")
        print("可选: 1/import, 2/review, 3/demo")
        sys.exit(1)


def cmd_audit(args):
    store = Store(args.db)
    trail = get_audit_trail(store, args.annotation_id)
    if "error" in trail:
        print(trail["error"])
        sys.exit(1)

    ann = trail["annotation"]
    changes = trail["changes"]
    evidence = trail["evidence"]

    print(f"=== 审计追踪: 批注 {args.annotation_id} ===")
    print(f"来源: {ann['source']}")
    print(f"原始行号: {ann['original_line_number']}")
    print(f"原始值: '{ann['original_value']}'")
    print(f"当前值: '{ann['current_value']}'")
    print(f"项目: {ann['item_name']} / {ann['category']}")
    print(f"分母(原始): '{ann['denominator_raw']}'")
    print(f"分子(原始): '{ann['numerator_raw']}'")
    print(f"边界情况: {ann['is_edge_case']} ({ann.get('edge_case_type', '无')})")
    print(f"状态: {ann['status']}")
    print(f"创建时间: {ann['created_at']}")
    print(f"更新时间: {ann['updated_at']}")
    print()

    print("--- 证据摘要 ---")
    print(f"批注内容: '{evidence.get('annotation_content', '')}'")
    print(f"抽样名单值: '{evidence.get('sampling_list_value', '')}'")
    if evidence.get("conflict_resolution"):
        print(f"冲突处理: {evidence['conflict_resolution']}")
    print()

    if changes:
        print(f"--- 变更历史 ({len(changes)} 条) ---")
        for ch in changes:
            print(
                f"  {ch['created_at']} "
                f"字段={ch['field_name']} "
                f"'{ch['old_value']}' → '{ch['new_value']}' "
                f"操作人={ch['changed_by']} "
                f"原因={ch['reason']}"
            )
    else:
        print("无变更历史。")

    if args.json:
        print("\n--- JSON ---")
        print(json.dumps(trail, ensure_ascii=False, indent=2))


def cmd_list(args):
    store = Store(args.db)
    source = None
    status = None
    if args.source:
        source = AnnotationSource(args.source)
    if args.status:
        status = ReviewStatus(args.status)

    annotations = store.list_annotations(status=status, source=source)
    if not annotations:
        print("无记录。")
        return

    print(f"{'ID':<14} {'行号':>4} {'项目':<12} {'类别':<8} {'分母':<8} {'状态':<12} {'边界':<6}")
    print("-" * 70)
    for ann in annotations:
        print(
            f"{ann.id:<14} {ann.original_line_number:>4} "
            f"{ann.item_name:<12} {ann.category:<8} "
            f"{ann.denominator_raw:<8} {ann.status.value:<12} "
            f"{'✓' if ann.is_edge_case else '-':<6}"
        )


def cmd_rules(args):
    print("=== 容斥统计优惠叠加 — 边界规则 ===\n")
    for key, rule in BOUNDARY_RULES.items():
        print(f"规则: {key}")
        print(f"  描述: {rule['description']}")
        print(f"  策略: {rule['policy']}")
        print(f"  自动修复: {rule['auto_fix']}")
        print(f"  冲突回滚: {rule['rollback_on_conflict']}")
        print(f"  需要证据: {rule['evidence_required']}")
        print()

    print("=== 分母为0处理动作 ===\n")
    for policy, action in DENOMINATOR_ZERO_ACTIONS.items():
        print(f"策略: {policy.value}")
        print(f"  动作: {action}")
        print()


def cmd_rollback(args):
    store = Store(args.db)
    rolled = store.rollback_batch(args.batch_id)
    print(f"已回滚批次 {args.batch_id}，恢复 {rolled} 条记录。")


def main():
    parser = argparse.ArgumentParser(
        prog="rxtj",
        description="容斥统计优惠叠加 — 带完整审计追踪的统计工具",
    )
    parser.add_argument("--db", default=None, help="数据库路径 (默认 ~/.rxtj/rxtj.db)")
    sub = parser.add_subparsers(dest="command")

    p_import = sub.add_parser("import", help="导入老师批注或抽样名单")
    p_import.add_argument("file", help="数据文件 (JSON/CSV/TSV)")
    p_import.add_argument("--source", default="annotation", choices=["annotation", "sampling"])
    p_import.add_argument("--operator", default="system")
    p_import.add_argument("--json", action="store_true", help="输出JSON格式")

    p_wf = sub.add_parser("workflow", help="三步工作流")
    p_wf.add_argument("step", help="步骤: 1/import, 2/review, 3/demo")
    p_wf.add_argument("--file", default=None, help="数据文件 (步骤1和2需要)")
    p_wf.add_argument("--operator", default="system")
    p_wf.add_argument("--json", action="store_true")

    p_audit = sub.add_parser("audit", help="查看批注的完整审计追踪")
    p_audit.add_argument("annotation_id", help="批注ID")
    p_audit.add_argument("--json", action="store_true")

    p_list = sub.add_parser("list", help="列出批注")
    p_list.add_argument("--source", choices=["teacher_annotation", "sampling_list"])
    p_list.add_argument("--status", choices=[s.value for s in ReviewStatus])

    p_rules = sub.add_parser("rules", help="显示边界规则")

    p_rollback = sub.add_parser("rollback", help="回滚一个导入批次")
    p_rollback.add_argument("batch_id", help="批次ID")

    args = parser.parse_args()
    if args.command == "import":
        cmd_import(args)
    elif args.command == "workflow":
        cmd_workflow(args)
    elif args.command == "audit":
        cmd_audit(args)
    elif args.command == "list":
        cmd_list(args)
    elif args.command == "rules":
        cmd_rules(args)
    elif args.command == "rollback":
        cmd_rollback(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
