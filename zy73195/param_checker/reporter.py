from typing import List

from .models import CheckResult, CheckSummary


def _bar(pct: float, width: int = 20) -> str:
    filled = int(width * pct / 100)
    return "█" * filled + "░" * (width - filled)


def print_summary(summary: CheckSummary, results: List[CheckResult]) -> None:
    print("=" * 60)
    print("  优化调参批量验算 — 终端摘要")
    print("=" * 60)
    print(f"  参数版本  : {summary.param_version}")
    print(f"  验算时间  : {summary.check_time}")
    print(f"  记录总数  : {summary.total} 条")
    print("-" * 60)

    pass_pct = (summary.passed / summary.total * 100) if summary.total else 0
    fail_pct = (summary.failed / summary.total * 100) if summary.total else 0
    pend_pct = (summary.pending / summary.total * 100) if summary.total else 0

    print(f"  ✅ 合格    : {summary.passed:3d} 条  {_bar(pass_pct)} {pass_pct:5.1f}%")
    print(f"  ❌ 不合格  : {summary.failed:3d} 条  {_bar(fail_pct)} {fail_pct:5.1f}%")
    print(f"  ⏳ 待确认  : {summary.pending:3d} 条  {_bar(pend_pct)} {pend_pct:5.1f}%")
    print(f"  ⚠️  异常点  : {summary.abnormal:3d} 条")
    print(f"  🔀 排序不稳: {summary.sort_unstable:3d} 条")
    if summary.rejudged:
        print(f"  🔄 已改判  : {summary.rejudged:3d} 条")
    print("-" * 60)

    if summary.pending > 0:
        print("\n  ⏳ 待确认明细（需人工核对名称）:")
        for r in results:
            if r.is_pending:
                print(f"    • [{r.record.batch_no}] {r.record.material_name}"
                      f" → 参数表: {r.param.material_name if r.param else '?'}")
                print(f"      原因: {r.pending_reason}")

    if summary.abnormal > 0:
        print("\n  ⚠️  异常点明细:")
        for r in results:
            if r.is_abnormal and not r.is_pending:
                print(f"    • [{r.record.batch_no}] {r.record.material_name} - {r.record.param_name}")
                print(f"      实测 {r.record.measured_value} {r.param.unit if r.param else ''}，{r.abnormal_reason}")
                print(f"      标准范围: [{r.param.lower_bound:.3f}, {r.param.upper_bound:.3f}] {r.param.unit if r.param else ''}")

    if summary.sort_unstable > 0:
        print("\n  🔀 排序不稳定提醒（已追溯到参数表原始说法）:")
        for r in results:
            if r.sort_unstable:
                print(f"    • {r.record.material_name} - {r.record.param_name}")
                print(f"      参数表备注: {r.sort_original_note}")

    print("-" * 60)
    print("  💡 详细数据请查看输出目录下的 CSV 文件")
    print("=" * 60)


def print_review_page(summary: CheckSummary, results: List[CheckResult],
                      rejudge_count: int = 0) -> None:
    print()
    print("=" * 70)
    print("  📋 复核页 — 参数版本 / 异常点 / 解释 同页")
    print("=" * 70)
    print(f"  参数版本   : {summary.param_version}")
    print(f"  验算时间   : {summary.check_time}")
    print(f"  已改判次数 : {rejudge_count}")
    print("-" * 70)

    for i, r in enumerate(results, 1):
        rejudged = getattr(r, "_rejudged", False)
        if rejudged:
            status_icon = "🔄"
            status_text = getattr(r, "_new_result", "改判")
        elif r.is_pending:
            status_icon = "⏳"
            status_text = "待确认"
        elif r.is_pass:
            status_icon = "✅"
            status_text = "合格"
        else:
            status_icon = "❌"
            status_text = "不合格"

        print(f"  [{i:02d}] {status_icon} {r.record.material_name} — {r.record.param_name}")
        print(f"       批次: {r.record.batch_no} | 日期: {r.record.test_date}")
        print(f"       实测: {r.record.measured_value:>8.3f} {r.param.unit if r.param else ''}"
              f"   标准: {r.param.standard_value if r.param else '?':>8.3f} ± {r.param.tolerance if r.param else '?':.3f}")
        print(f"       偏差: {r.deviation:+8.3f} ({r.deviation_pct:+.2f}%)  结论: {status_text}")

        if rejudged:
            orig = getattr(r, "_original_result", "")
            new = getattr(r, "_new_result", "")
            reason = getattr(r, "_rejudge_reason", "")
            print(f"       🔄 改判: 原「{orig}」→ 新「{new}」")
            print(f"       🔄 改判原因: {reason}")
        if r.is_pending:
            print(f"       ⏳ 待确认原因: {r.pending_reason}")
        if r.is_abnormal and r.abnormal_reason:
            print(f"       ⚠️  异常说明: {r.abnormal_reason}")
        if r.sort_unstable:
            print(f"       🔀 排序备注: {r.sort_original_note}")
        if r.record.remark:
            print(f"       📝 记录备注: {r.record.remark}")
        print()

    print("=" * 70)
