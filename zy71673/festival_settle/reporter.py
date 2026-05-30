import csv
import os
from decimal import Decimal
from typing import List
from .models import SettlementRecord, RecordStatus


def format_amount(d: Decimal) -> str:
    if d == d.to_integral_value():
        return str(int(d))
    return f"{d:.2f}"


def print_terminal_summary(settlements: List[SettlementRecord], issues_log: List[str]):
    print("\n" + "=" * 70)
    print("  音乐节艺人分账表 — 终端摘要")
    print("=" * 70)

    total_entitlement = Decimal("0")
    total_paid = Decimal("0")
    total_net_due = Decimal("0")
    confirmed_count = 0
    provisional_count = 0
    rejected_count = 0
    issue_count = 0

    for s in settlements:
        total_entitlement += s.total_entitlement
        total_paid += s.total_paid
        total_net_due += s.net_due
        if s.status == RecordStatus.CONFIRMED:
            confirmed_count += 1
        elif s.status == RecordStatus.REJECTED:
            rejected_count += 1
        else:
            provisional_count += 1
        if s.issues:
            issue_count += 1

    print(f"\n  艺人总数: {len(settlements)}")
    print(f"    已确认: {confirmed_count}  |  暂存: {provisional_count}  |  已退回: {rejected_count}")
    print(f"  应付总额: {format_amount(total_entitlement)}")
    print(f"  已付总额: {format_amount(total_paid)}")
    print(f"  净应付:   {format_amount(total_net_due)}")
    print(f"  异常条目: {issue_count}")

    if issues_log:
        print(f"\n  {'─' * 60}")
        print("  异常详情:")
        for issue in issues_log:
            print(f"    ⚠  {issue}")

    print(f"\n  {'─' * 60}")
    print("  各艺人分账明细:")
    print(f"  {'艺人':<12} {'时段':<10} {'应得':>10} {'已付':>10} {'净付':>10} {'状态':<6} {'问题'}")
    print(f"  {'─'*12} {'─'*10} {'─'*10} {'─'*10} {'─'*10} {'─'*6} {'─'*12}")
    for s in settlements:
        issue_tag = "⚠" if s.issues else ""
        status_tag = {"confirmed": "✓", "rejected": "✗", "provisional": "…"}.get(s.status.value, "?")
        print(
            f"  {s.artist_name:<12} {s.performance_slot or '-':<10} "
            f"{format_amount(s.total_entitlement):>10} "
            f"{format_amount(s.total_paid):>10} "
            f"{format_amount(s.net_due):>10} "
            f"{status_tag:<6} {issue_tag}"
        )

    print("=" * 70 + "\n")


def export_detail_csv(settlements: List[SettlementRecord], output_path: str):
    fieldnames = [
        "艺人", "演出时段", "保底金额", "票房收入", "分成比例",
        "分成金额", "赞助扣款", "应得总额", "已付总额", "净应付",
        "异常", "差异解释", "备注", "状态", "创建时间", "更新时间"
    ]
    rows = []
    for s in settlements:
        rows.append({
            "艺人": s.artist_name,
            "演出时段": s.performance_slot,
            "保底金额": format_amount(s.guarantee_amount),
            "票房收入": format_amount(s.box_office_revenue),
            "分成比例": str(s.revenue_share_ratio),
            "分成金额": format_amount(s.revenue_share_amount),
            "赞助扣款": format_amount(s.sponsor_deduction),
            "应得总额": format_amount(s.total_entitlement),
            "已付总额": format_amount(s.total_paid),
            "净应付": format_amount(s.net_due),
            "异常": s.issues,
            "差异解释": s.variance_explanation,
            "备注": s.remarks,
            "状态": {"confirmed": "已确认", "rejected": "已退回", "provisional": "暂存"}.get(s.status.value, s.status.value),
            "创建时间": s.created_at,
            "更新时间": s.updated_at,
        })

    with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def export_issues_csv(issues_log: List[str], output_path: str):
    with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["序号", "异常描述"])
        for i, issue in enumerate(issues_log, 1):
            writer.writerow([i, issue])


def generate_reports(
    settlements: List[SettlementRecord],
    issues_log: List[str],
    output_dir: str,
) -> dict:
    os.makedirs(output_dir, exist_ok=True)

    detail_path = os.path.join(output_dir, "分账明细.csv")
    issues_path = os.path.join(output_dir, "异常清单.csv")

    export_detail_csv(settlements, detail_path)
    export_issues_csv(issues_log, issues_path)

    print_terminal_summary(settlements, issues_log)

    return {
        "detail": detail_path,
        "issues": issues_path,
    }
