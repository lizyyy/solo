from datetime import datetime
from typing import List, Dict, Any

from models import LoanRenewalScore, ReviewAction, BusinessStatus
from service import LoanRenewalScoreService


class ReportGenerator:
    @staticmethod
    def generate_summary_report(service: LoanRenewalScoreService) -> str:
        scores = service.get_all_scores()
        total_business = len(scores)
        pending_review = sum(
            1 for s in scores
            if any(d.status == BusinessStatus.PENDING_REVIEW for d in s.business_details)
        )
        needs_material = sum(
            1 for s in scores
            if any(d.status == BusinessStatus.NEEDS_MATERIAL for d in s.business_details)
        )
        disputed = sum(
            1 for s in scores
            if any(d.status == BusinessStatus.DISPUTED for d in s.business_details)
        )
        normal = sum(
            1 for s in scores
            if s.business_details and all(d.status == BusinessStatus.NORMAL for d in s.business_details)
        )

        report = []
        report.append("=" * 60)
        report.append("        小微贷款续贷评分复核报告")
        report.append("=" * 60)
        report.append(f"报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")
        report.append("【业务概览】")
        report.append(f"  总业务数: {total_business} 笔")
        report.append(f"  已完成复核: {normal} 笔 ({normal/total_business*100:.1f}%)" if total_business else "  已完成复核: 0 笔")
        report.append(f"  待结算主管复核: {pending_review} 笔")
        report.append(f"  待补充材料: {needs_material} 笔")
        report.append(f"  有争议: {disputed} 笔")
        report.append("")

        return "\n".join(report)

    @staticmethod
    def generate_difference_report(service: LoanRenewalScoreService, business_no: str = None) -> str:
        report = []
        report.append("")
        report.append("【差异清单详情】")
        report.append("-" * 60)

        scores = service.get_all_scores()
        if business_no:
            scores = [s for s in scores if s.business_no == business_no]

        has_differences = False
        for score in scores:
            if not score.differences:
                continue

            has_differences = True
            report.append("")
            report.append(f"■ 业务号: {score.business_no}")
            report.append("")

            for idx, diff in enumerate(score.differences, 1):
                report.append(f"  {idx}. {diff.description}")
                report.append(f"     ▶ 为什么留下: {diff.reason_kept}")
                if diff.missing_materials:
                    report.append(f"     ▶ 还缺材料: {', '.join(diff.missing_materials)}")
                report.append(f"     ▶ 下一步: 找{diff.next_step_role.value}")
                report.append(f"     ▶ 具体行动: {diff.next_step_action}")
                report.append("")

        if not has_differences:
            report.append("  暂无差异项，所有业务均已完成复核。")
        report.append("")

        return "\n".join(report)

    @staticmethod
    def generate_review_history_report(service: LoanRenewalScoreService) -> str:
        report = []
        report.append("")
        report.append("【真实复核记录 - 谁改了什么】")
        report.append("-" * 60)

        scores = service.get_all_scores()
        has_records = False

        for score in scores:
            if not score.change_history and not score.review_records:
                continue

            has_records = True
            report.append("")
            report.append(f"■ 业务号: {score.business_no}")
            report.append("")

            if score.change_history:
                report.append("  ◆ 修改记录:")
                for idx, change in enumerate(score.change_history, 1):
                    change_dict = change.to_dict()
                    report.append(f"    {idx}. [{change_dict['修改时间']}] {change_dict['修改人']}")
                    report.append(f"       修改了 [{change_dict['修改字段']}]")
                    report.append(f"       从 [{change_dict['修改前']}] → 改为 [{change_dict['修改后']}]")
                    report.append(f"       原因: {change_dict['修改原因']}")
                    report.append("")

            if score.review_records:
                report.append("  ◆ 复核记录:")
                for idx, review in enumerate(score.review_records, 1):
                    report.append(f"    {idx}. [{review.reviewed_at.strftime('%Y-%m-%d %H:%M:%S')}] {review.reviewer}")
                    report.append(f"       复核动作: {review.review_action.value}")
                    report.append(f"       复核意见: {review.review_comment}")
                    report.append(f"       影响明细: {len(review.affected_details)} 条记录")
                    report.append("")

        if not has_records:
            report.append("  暂无复核记录。")
        report.append("")

        return "\n".join(report)

    @staticmethod
    def generate_3d_view_support_report(service: LoanRenewalScoreService, business_no: str) -> str:
        score = service.get_score(business_no)
        if not score:
            return f"未找到业务号 {business_no} 的数据"

        report = []
        report.append("")
        report.append(f"【3D/图表展示 - 业务号 {business_no} 数据源追溯】")
        report.append("-" * 60)
        report.append("")
        report.append("  说明: 点击图表数据点时，可追溯至原始材料：")
        report.append("")

        if score.formula:
            report.append(f"  评分公式: {score.formula}")
        if score.sample_count:
            report.append(f"  样本数量: {score.sample_count}")
        if score.formula or score.sample_count:
            report.append("")

        for detail in score.business_details:
            source_info = service.navigate_to_source_material(business_no, detail.id)
            if not source_info:
                continue

            report.append(f"  ◆ 明细类型: {detail.detail_type}")
            report.append(f"     当前状态: {detail.status.value}")
            if detail.predicted_value is not None:
                report.append(f"     预测值: {detail.predicted_value:.2f}")
            report.append(f"     实际金额: {detail.amount:.2f}")

            holiday = source_info.get('holiday_extension')
            tail = source_info.get('tail_adjustment')

            if holiday:
                report.append(f"     ← 节假日顺延说明:")
                report.append(f"         原到期日: {holiday.original_due_date.strftime('%Y-%m-%d') if holiday.original_due_date else '无'}")
                report.append(f"         顺延到期日: {holiday.extended_due_date.strftime('%Y-%m-%d') if holiday.extended_due_date else '无'}")
                report.append(f"         原因: {holiday.reason}")
                report.append(f"         备注: {holiday.remark}")

            if tail:
                report.append(f"     ← 尾差调整条:")
                report.append(f"         调整类型: {tail.adjustment_type}")
                report.append(f"         调整金额: {tail.amount:.2f}")
                report.append(f"         原因: {tail.reason}")
                report.append(f"         备注: {tail.remark}")

            if not holiday and not tail:
                report.append(f"     ⚠ 无关联原始材料（节假日顺延说明/尾差调整条均未关联）")

            report.append("")

        return "\n".join(report)

    @staticmethod
    def generate_export_audit_report(service: LoanRenewalScoreService, business_no: str) -> str:
        score = service.get_score(business_no)
        if not score:
            return f"未找到业务号 {business_no} 的数据"

        report = []
        report.append("=" * 60)
        report.append(f"  小微贷款续贷评分 - 导出核对报告")
        report.append("=" * 60)
        report.append(f"业务号: {business_no}")
        report.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")

        report.append("【评分概要】")
        report.append(f"  续贷评分: {score.score:.2f}" if score.score else "  续贷评分: 未计算")
        report.append(f"  评分等级: {score.score_level or '未评定'}")
        report.append(f"  评分公式: {score.formula or '未设定'}")
        report.append(f"  样本数量: {score.sample_count or 0}")
        report.append("")

        report.append("【预测值 vs 实际值核对】")
        report.append("-" * 60)
        for detail in score.business_details:
            pv_str = f"{detail.predicted_value:.2f}" if detail.predicted_value is not None else "未设定"
            diff_note = ""
            if detail.predicted_value is not None and detail.amount != detail.predicted_value:
                diff_note = f"  ⚠ 偏差: {abs(detail.amount - detail.predicted_value):.2f}"
            report.append(f"  {detail.detail_type}:")
            report.append(f"    预测值: {pv_str}")
            report.append(f"    实际值: {detail.amount:.2f}")
            report.append(f"    状态: {detail.status.value}")
            if diff_note:
                report.append(diff_note)
            report.append("")

        report.append("【3D图表数据源追溯核验】")
        report.append("-" * 60)
        for detail in score.business_details:
            source_info = service.navigate_to_source_material(business_no, detail.id)
            holiday_linked = source_info is not None and source_info.get('holiday_extension') is not None
            tail_linked = source_info is not None and source_info.get('tail_adjustment') is not None
            report.append(f"  {detail.detail_type}:")
            report.append(f"    节假日顺延说明: {'✓ 已关联' if holiday_linked else '✗ 未关联'}")
            report.append(f"    尾差调整条:     {'✓ 已关联' if tail_linked else '✗ 未关联'}")
            if not tail_linked:
                report.append(f"    → 请补看尾差调整条后重新追溯")
            report.append("")

        return "\n".join(report)

    @staticmethod
    def generate_full_report(service: LoanRenewalScoreService) -> str:
        parts = [
            ReportGenerator.generate_summary_report(service),
            ReportGenerator.generate_difference_report(service),
            ReportGenerator.generate_review_history_report(service)
        ]
        return "\n".join(parts)

    @staticmethod
    def generate_workflow_report(
        service: LoanRenewalScoreService,
        steps: List[Dict[str, Any]]
    ) -> str:
        report = []
        report.append("=" * 60)
        report.append("        三步流程演示报告")
        report.append("=" * 60)
        report.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")

        step_names = [
            "第一步: 节假日顺延说明第一次导入",
            "第二步: 投研助理小周补看尾差调整条",
            "第三步: 差异清单更新 & 结算主管复核"
        ]

        for idx, step_info in enumerate(steps, 1):
            report.append(f"{'='*60}")
            report.append(f"{step_names[idx-1]}")
            report.append(f"{'='*60}")
            report.append(f"执行时间: {step_info['timestamp']}")
            report.append(f"操作人: {step_info['operator']}")
            report.append("")

            if idx == 1:
                report.append("  【操作】导入节假日顺延说明")
                report.append(f"  - 新增: {step_info.get('imported', 0)} 条")
                report.append(f"  - 跳过(重复): {step_info.get('skipped', 0)} 条")
                report.append("")
                report.append("  【系统自动处理】")
                report.append("  → 检测到同一业务号需要拆分为手续费和本金两行")
                report.append("  → 自动标记为 [待结算主管复核]")
                report.append("  → 不急着归正常，留给结算主管判断")

            elif idx == 2:
                report.append("  【操作】导入尾差调整条")
                report.append(f"  - 新增: {step_info.get('imported', 0)} 条")
                report.append(f"  - 跳过(重复): {step_info.get('skipped', 0)} 条")
                report.append("")
                report.append("  【系统自动处理】")
                report.append("  → 关联对应节假日顺延说明")
                report.append("  → 更新差异清单状态")

            elif idx == 3:
                report.append("  【操作】结算主管复核")
                report.append(f"  - 复核结果: {step_info.get('review_action', '未知')}")
                report.append(f"  - 复核意见: {step_info.get('review_comment', '无')}")
                report.append("")
                report.append("  【系统自动处理】")
                report.append("  → 更新业务明细状态")
                report.append("  → 生成最终差异清单")

            report.append("")

        report.append(f"{'='*60}")
        report.append("        最终状态")
        report.append(f"{'='*60}")
        report.append(ReportGenerator.generate_difference_report(service))

        return "\n".join(report)
