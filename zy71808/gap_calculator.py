from datetime import datetime
from typing import List, Optional, Tuple
from uuid import uuid4

from models import (
    AssetPool, CreditLine, FreezeRecord, ReviewReport,
    GapCalculationResult, ConclusionStatus, ChangeType,
    RiskFlag, OperationLog, UserFriendlyError, DataSourceStatus
)
from repository import DataRepository
from risk_detector import RiskDetector
from version_comparator import VersionComparator
from error_messages import get_user_friendly_error


class PressureGapCalculator:
    PRESSURE_GAP_THRESHOLD = 0.15

    def __init__(self, repository: Optional[DataRepository] = None) -> None:
        self.repository = repository or DataRepository()
        self.risk_detector = RiskDetector()
        self.version_comparator = VersionComparator()
        self.operator = "system"

    def set_operator(self, operator: str) -> None:
        self.operator = operator

    def calculate_gap(
        self,
        asset_pool_id: str,
        calculation_date: Optional[datetime] = None
    ) -> GapCalculationResult:
        calc_date = calculation_date or datetime.now()

        asset_pool = self.repository.get_asset_pool(asset_pool_id)
        if asset_pool is None:
            user_msg, suggestion = get_user_friendly_error(
                "CALCULATION_ERROR"
            )
            raise UserFriendlyError(
                error_code="ASSET_POOL_NOT_FOUND",
                user_message=f"找不到编号为{asset_pool_id}的资产池",
                suggestion=suggestion
            )

        result_id = str(uuid4())
        self.risk_detector.reset()

        credit_lines = self.repository.get_all_credit_lines()
        freeze_records = self.repository.get_unreleased_freeze_records()
        review_report = self.repository.get_latest_report(asset_pool_id, calc_date)

        try:
            self.risk_detector.validate_credit_data(credit_lines)
        except UserFriendlyError:
            raise

        previous_result = self.repository.get_previous_gap_result(
            asset_pool_id, calc_date
        )

        self.risk_detector.detect_missing_review_report(
            review_report, calc_date, result_id
        )

        if review_report is not None:
            old_reports = self.repository.get_all_report_versions(
                asset_pool_id, calc_date
            )
            if len(old_reports) >= 2:
                old_report = old_reports[-2]
                diffs, change_type, version_notes = (
                    self.version_comparator.compare_reports(old_report, review_report)
                )
            else:
                diffs, change_type, version_notes = [], ChangeType.NO_CHANGE, []

            self.risk_detector.detect_late_supplement(review_report, result_id)
            self.risk_detector.detect_manual_note_override(
                credit_lines, review_report, result_id
            )

        unreleased_amount = self.risk_detector.detect_freeze_not_released(
            freeze_records, result_id
        )
        duplicate_amount, _ = self.risk_detector.detect_duplicate_credit(
            credit_lines, result_id
        )

        base_gap = self._calculate_base_gap(asset_pool, credit_lines)
        adjusted_gap = self._calculate_adjusted_gap(
            base_gap, unreleased_amount, duplicate_amount
        )

        total_asset = asset_pool.total_asset
        pressure_gap_ratio = adjusted_gap / total_asset if total_asset > 0 else 0

        conclusion, status = self._generate_conclusion(
            adjusted_gap, pressure_gap_ratio, review_report
        )

        high_risk_flags = {
            RiskFlag.MANUAL_NOTE_OVERRIDE,
            RiskFlag.DUPLICATE_CREDIT,
            RiskFlag.FREEZE_NOT_RELEASED,
            RiskFlag.MISSING_REVIEW_REPORT
        }
        has_high_risk = any(
            flag in high_risk_flags for flag in self.risk_detector.risk_flags
        )

        if status == ConclusionStatus.NORMAL and has_high_risk:
            status = ConclusionStatus.PENDING
            conclusion = "（待确认）" + conclusion

        human_notes = list(self.risk_detector.human_notes)
        if review_report is not None and len(old_reports) >= 2:
            human_notes.extend(version_notes)

        if pressure_gap_ratio > self.PRESSURE_GAP_THRESHOLD:
            msg, suggestion = get_user_friendly_error(
                "GAP_TOO_LARGE",
                ratio=pressure_gap_ratio,
                threshold=self.PRESSURE_GAP_THRESHOLD
            )
            human_notes.append(msg)
            if suggestion:
                human_notes.append(f"建议：{suggestion}")
            if RiskFlag.NONE in self.risk_detector.risk_flags:
                self.risk_detector.risk_flags.remove(RiskFlag.NONE)

        result = GapCalculationResult(
            result_id=result_id,
            asset_pool_id=asset_pool_id,
            calculation_date=calc_date,
            base_gap=base_gap,
            adjusted_gap=adjusted_gap,
            pressure_gap_ratio=pressure_gap_ratio,
            credit_lines=credit_lines,
            freeze_records=freeze_records,
            review_report=review_report,
            conclusion=conclusion,
            status=status,
            risk_flags=list(self.risk_detector.risk_flags),
            pending_confirmations=list(self.risk_detector.pending_items),
            change_type=change_type if review_report else ChangeType.NO_CHANGE,
            previous_result_id=previous_result.result_id if previous_result else None,
            version_diffs=diffs if review_report and len(old_reports) >= 2 else [],
            human_readable_notes=human_notes
        )

        self.repository.save_gap_result(result)

        for pc in result.pending_confirmations:
            self.repository.save_pending_confirmation(pc)

        self.repository.log_operation(OperationLog(
            operator=self.operator,
            operation_type="计算压力缺口",
            target_id=result_id,
            target_type="GapCalculationResult",
            new_value=f"压力缺口{adjusted_gap:,.2f}元，缺口率{pressure_gap_ratio:.1%}，状态{status.value}"
        ))

        return result

    def upload_review_report(
        self,
        asset_pool_id: str,
        report_date: datetime,
        content: str,
        total_asset: float,
        total_liability: float,
        pressure_gap: float,
        conclusion: str,
        reviewer: str,
        data_source: DataSourceStatus = DataSourceStatus.ORIGINAL,
        supplementary_email_date: Optional[datetime] = None,
        manual_note: Optional[str] = None,
        created_at: Optional[datetime] = None
    ) -> Tuple[ReviewReport, GapCalculationResult]:
        version = self.repository.get_next_report_version(asset_pool_id, report_date)
        old_reports = self.repository.get_all_report_versions(asset_pool_id, report_date)
        previous_report = old_reports[-1] if old_reports else None

        report = ReviewReport(
            report_id=str(uuid4()),
            report_date=report_date,
            version=version,
            asset_pool_id=asset_pool_id,
            content=content,
            total_asset=total_asset,
            total_liability=total_liability,
            pressure_gap=pressure_gap,
            conclusion=conclusion,
            reviewer=reviewer,
            data_source=data_source,
            supplementary_email_date=supplementary_email_date,
            manual_note=manual_note,
            previous_report_id=previous_report.report_id if previous_report else None
        )
        if created_at:
            report.created_at = created_at

        self.repository.save_review_report(report)

        self.repository.log_operation(OperationLog(
            operator=self.operator,
            operation_type="上传复核日报",
            target_id=report.report_id,
            target_type="ReviewReport",
            new_value=(f"第{version}版，结论：{conclusion}，"
                      f"数据源：{data_source.value}"),
            change_reason="用户上传" if data_source == DataSourceStatus.ORIGINAL else "后补材料"
        ))

        if previous_report:
            diffs, change_type, notes = (
                self.version_comparator.compare_reports(previous_report, report)
            )
            summary = self.version_comparator.summarize_changes(diffs, change_type)

            self.repository.log_operation(OperationLog(
                operator=self.operator,
                operation_type="复核日报版本对比",
                target_id=report.report_id,
                target_type="ReviewReport",
                old_value=f"上一版结论：{previous_report.conclusion}",
                new_value=f"新版结论：{conclusion}",
                change_reason=summary
            ))

        result = self.calculate_gap(asset_pool_id, report_date)

        return report, result

    def confirm_pending_item(
        self,
        confirm_id: str,
        confirmed_by: str
    ) -> Optional[GapCalculationResult]:
        pc = self.repository.confirm_pending(confirm_id, confirmed_by)
        if pc is None:
            return None

        self.repository.log_operation(OperationLog(
            operator=confirmed_by,
            operation_type="确认待处理项",
            target_id=confirm_id,
            target_type="PendingConfirmation",
            new_value=f"已确认：{pc.description}"
        ))

        result = self.repository.get_gap_result(pc.gap_result_id)
        if result:
            all_confirmed = all(
                p.is_confirmed for p in result.pending_confirmations
            )
            if all_confirmed and result.status == ConclusionStatus.PENDING:
                result.status = ConclusionStatus.NORMAL
                if result.conclusion.startswith("（待确认）"):
                    result.conclusion = result.conclusion[len("（待确认）"):]
                result.conclusion += "（所有待确认项已复核通过）"
                self.repository.log_operation(OperationLog(
                    operator=confirmed_by,
                    operation_type="更新计算结果状态",
                    target_id=result.result_id,
                    target_type="GapCalculationResult",
                    old_value=ConclusionStatus.PENDING.value,
                    new_value=ConclusionStatus.NORMAL.value,
                    change_reason="所有待确认项已复核通过"
                ))

        return result

    def _calculate_base_gap(
        self,
        asset_pool: AssetPool,
        credit_lines: List[CreditLine]
    ) -> float:
        total_used = sum(c.used_amount for c in credit_lines)
        total_available = sum(c.available_amount for c in credit_lines)
        base_gap = asset_pool.total_liability - total_available
        return max(0, base_gap)

    def _calculate_adjusted_gap(
        self,
        base_gap: float,
        unreleased_freeze: float,
        duplicate_amount: float
    ) -> float:
        return base_gap + unreleased_freeze + duplicate_amount

    def _generate_conclusion(
        self,
        adjusted_gap: float,
        gap_ratio: float,
        review_report: Optional[ReviewReport]
    ) -> Tuple[str, ConclusionStatus]:
        if review_report is None:
            return "缺少复核日报，无法生成最终结论", ConclusionStatus.PENDING

        if gap_ratio > self.PRESSURE_GAP_THRESHOLD:
            conclusion = (f"压力缺口为{adjusted_gap/10000:,.2f}万元，"
                         f"缺口率{gap_ratio:.1%}，超过警戒线，需启动应急预案")
            status = ConclusionStatus.ABNORMAL
        elif gap_ratio > 0.1:
            conclusion = (f"压力缺口为{adjusted_gap/10000:,.2f}万元，"
                         f"缺口率{gap_ratio:.1%}，处于关注区间")
            status = ConclusionStatus.NORMAL
        else:
            conclusion = (f"压力缺口为{adjusted_gap/10000:,.2f}万元，"
                         f"缺口率{gap_ratio:.1%}，处于安全区间")
            status = ConclusionStatus.NORMAL

        if review_report.data_source != DataSourceStatus.ORIGINAL:
            conclusion += f"（数据来源：{review_report.data_source.value}）"

        return conclusion, status

    def format_result_for_display(self, result: GapCalculationResult) -> str:
        lines = [
            "=" * 60,
            f"资产池压力缺口计算结果",
            "=" * 60,
            f"计算日期：{result.calculation_date.strftime('%Y-%m-%d %H:%M:%S')}",
            f"资产池编号：{result.asset_pool_id}",
            f"结果状态：【{result.status.value}】",
            "",
            f"基础压力缺口：{result.base_gap/10000:,.2f}万元",
            f"调整后压力缺口：{result.adjusted_gap/10000:,.2f}万元",
            f"压力缺口率：{result.pressure_gap_ratio:.1%}",
            f"警戒线：{self.PRESSURE_GAP_THRESHOLD:.0%}",
            "",
            f"结论：{result.conclusion}",
            "",
        ]

        if result.change_type != ChangeType.NO_CHANGE:
            lines.extend([
                "-" * 60,
                f"版本变更类型：【{result.change_type.value}】",
                "-" * 60,
            ])
            if result.version_diffs:
                for i, diff in enumerate(result.version_diffs, 1):
                    lines.append(f"{i}. {diff}")
                lines.append("")

        if result.human_readable_notes:
            lines.extend([
                "-" * 60,
                "温馨提示：",
                "-" * 60,
            ])
            for note in result.human_readable_notes:
                lines.append(f"• {note}")
            lines.append("")

        if result.pending_confirmations:
            lines.extend([
                "!" * 60,
                "待确认事项（请逐条确认后再使用本结果）：",
                "!" * 60,
            ])
            for i, pc in enumerate(result.pending_confirmations, 1):
                status = "✅" if pc.is_confirmed else "⏳"
                lines.append(f"{status} 待确认项 #{i}：{pc.description}")
                for item in pc.affected_items:
                    lines.append(f"    - {item}")
                if pc.is_confirmed:
                    lines.append(f"    确认人：{pc.confirmed_by}，"
                               f"确认时间：{pc.confirmed_at.strftime('%Y-%m-%d %H:%M')}")
                lines.append("")

        if result.risk_flags:
            flag_texts = [f.value for f in result.risk_flags if f != RiskFlag.NONE]
            if flag_texts:
                lines.extend([
                    "-" * 60,
                    f"风险标记：{', '.join(flag_texts)}",
                    "-" * 60,
                ])

        lines.append("=" * 60)

        return "\n".join(lines)
