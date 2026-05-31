import csv
import os
from collections import Counter
from typing import List

from pension_rebalance.models import ReconcileResult, ChangeEntry, Receipt, Refund


def _fmt_amount(val) -> str:
    if val is None:
        return "(空)"
    return f"{val:,.2f}"


def print_terminal_summary(
    results: List[ReconcileResult],
    load_warnings: List[str],
    duplicate_receipts: list,
    duplicate_refunds: list,
) -> None:
    print("=" * 72)
    print("  养老目标基金调仓 · 对账摘要")
    print("=" * 72)

    judgment_counts = Counter(r.judgment for r in results)
    print(f"\n  总记录数: {len(results)}")
    print(f"  判定分布:")
    for j, cnt in sorted(judgment_counts.items(), key=lambda x: -x[1]):
        print(f"    {j}: {cnt}条")

    warnings_all = []
    for r in results:
        warnings_all.extend(r.warnings)
    print(f"\n  异常/警告: {len(warnings_all)}条")

    changes_all = []
    for r in results:
        changes_all.extend(r.change_chain)
    print(f"  晚到附件变更: {len(changes_all)}条")

    if duplicate_receipts:
        print(f"\n  重复收款: {len(duplicate_receipts)}组")
        for a, b, reason in duplicate_receipts:
            print(f"    - {reason}")

    if duplicate_refunds:
        print(f"\n  重复退款: {len(duplicate_refunds)}组")
        for a, b, reason in duplicate_refunds:
            print(f"    - {reason}")

    if load_warnings:
        print(f"\n  数据加载警告: {len(load_warnings)}条")
        for w in load_warnings:
            print(f"    - {w}")

    print("\n" + "-" * 72)
    print("  各交易明细:")
    print("-" * 72)
    for r in results:
        flag = "✓" if r.judgment == "正常" or r.judgment == "正常(无退款)" else "⚠"
        print(f"\n  {flag} 交易: {r.transaction_id}  基金: {r.fund_code or '(空)'}")
        print(f"      收款: {_fmt_amount(r.receipt_amount)}  退款: {_fmt_amount(r.refund_amount)}  匹配: {r.amount_match or '-'}")
        print(f"      退款状态: {r.refund_status or '-'}  审批: {r.approval_result or '-'}")
        print(f"      判定: {r.judgment}  原因: {r.judgment_reason}")
        if r.warnings:
            for w in r.warnings:
                print(f"      ⚠ {w}")
        if r.notes:
            print(f"      备注: {r.notes}")
        if r.change_chain:
            for c in r.change_chain:
                print(f"      📎 变更[{c.field_name}]: '{c.old_value}' -> '{c.new_value}' ({c.changed_by} @ {c.changed_at})")
                print(f"         变更原因: {c.reason}")

    print("\n" + "=" * 72)
    print("  摘要结束")
    print("=" * 72)


def write_detail_csv(
    results: List[ReconcileResult],
    output_dir: str,
) -> str:
    os.makedirs(output_dir, exist_ok=True)
    detail_path = os.path.join(output_dir, "reconcile_detail.csv")
    change_path = os.path.join(output_dir, "change_chain.csv")

    with open(detail_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "交易流水号", "基金代码", "收款金额", "退款金额", "金额匹配",
            "有退款", "退款状态", "有审批", "审批结果",
            "备注", "警告", "判定", "判定原因",
            "原始来源文件", "处理时间",
        ])
        for r in results:
            writer.writerow([
                r.transaction_id,
                r.fund_code,
                _fmt_amount(r.receipt_amount),
                _fmt_amount(r.refund_amount),
                r.amount_match or "",
                "是" if r.has_refund else "否",
                r.refund_status,
                "是" if r.has_approval else "否",
                r.approval_result,
                r.notes,
                " | ".join(r.warnings),
                r.judgment,
                r.judgment_reason,
                r.source_file,
                r.processed_at,
            ])

    all_changes = []
    for r in results:
        for c in r.change_chain:
            all_changes.append((r.transaction_id, c))

    if all_changes:
        with open(change_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "交易流水号", "变更字段", "原值", "新值",
                "变更时间", "变更来源", "变更原因",
            ])
            for txn_id, c in all_changes:
                writer.writerow([
                    txn_id, c.field_name, c.old_value, c.new_value,
                    c.changed_at, c.changed_by, c.reason,
                ])

    return detail_path


def write_diff_report(
    prev_results: List[ReconcileResult],
    curr_results: List[ReconcileResult],
    output_dir: str,
) -> str:
    os.makedirs(output_dir, exist_ok=True)
    diff_path = os.path.join(output_dir, "diff_report.csv")

    prev_map = {r.transaction_id: r for r in prev_results}

    diffs = []
    for cr in curr_results:
        pr = prev_map.get(cr.transaction_id)
        if pr is None:
            diffs.append((cr.transaction_id, "新增", "", cr.judgment, "本次新出现"))
            continue
        if pr.judgment != cr.judgment:
            diffs.append((cr.transaction_id, "判定变更", pr.judgment, cr.judgment, cr.judgment_reason))
        if pr.amount_match != cr.amount_match:
            diffs.append((cr.transaction_id, "金额匹配变更", str(pr.amount_match), str(cr.amount_match), ""))

    with open(diff_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["交易流水号", "变更类型", "原值", "新值", "说明"])
        for d in diffs:
            writer.writerow(d)

    return diff_path
