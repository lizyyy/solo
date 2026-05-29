from typing import List, Tuple, Dict, Any
from datetime import datetime
import os

from ..models import (
    PerformanceSheet,
    SettlementResult,
    Issue,
    Warning,
    IssueCategory,
    IssueSeverity,
)
from .track_splitter import TrackSplitter
from .ratio_validator import RatioValidator
from .fee_collector import FeeCollector
from .calculator import RoyaltyCalculator
from .auditor import Auditor


class SettlementEngine:
    def __init__(self, history_dir: str = None, output_dir: str = None, errors_dir: str = None):
        base_dir = os.getcwd()
        self.history_dir = history_dir or os.path.join(base_dir, "data", "history")
        self.output_dir = output_dir or os.path.join(base_dir, "data", "output")
        self.errors_dir = errors_dir or os.path.join(base_dir, "data", "errors")
        self._ensure_dirs()

        self.track_splitter = TrackSplitter()
        self.ratio_validator = RatioValidator()
        self.auditor = Auditor(self.history_dir)

    def _ensure_dirs(self):
        for d in [self.history_dir, self.output_dir, self.errors_dir]:
            os.makedirs(d, exist_ok=True)

    def process(self, sheet: PerformanceSheet) -> Tuple[SettlementResult, List[Issue], List[Warning]]:
        all_issues: List[Issue] = []
        all_warnings: List[Warning] = []

        validation_errors = sheet.validate()
        if validation_errors:
            self._save_errors(sheet, validation_errors)
            for err in validation_errors:
                all_issues.append(Issue(
                    category=IssueCategory.DATA_MISSING if "缺失" in err or "为空" in err else IssueCategory.RATIO_ISSUE,
                    severity=IssueSeverity.ERROR,
                    message=err,
                    reason="数据验证失败",
                    affected_items=[sheet.performance_name],
                    impact="结算流程已中断，请修正数据后重新提交",
                    next_steps=["修正上述错误后重新提交计算"]
                ))
            raise ValueError(f"数据验证失败: {'; '.join(validation_errors)}")

        self.auditor.record_input(sheet)

        total_duration = sheet.total_duration()
        sheet.add_audit_log(
            action="PROCESS_START",
            operator=sheet.operator,
            details=f"开始结算处理，总时长{total_duration}秒，票房{sheet.total_box_office}元"
        )

        split_tracks, split_issues = self.track_splitter.split(sheet.tracks, total_duration)
        all_issues.extend(split_issues)
        sheet.add_audit_log(
            action="TRACK_SPLIT_COMPLETE",
            operator=sheet.operator,
            details=f"曲目拆分完成，原{len(sheet.tracks)}首曲目拆分为{len(split_tracks)}首"
        )

        validated_tracks, ratio_issues, ratio_warnings = self.ratio_validator.validate(split_tracks)
        all_issues.extend(ratio_issues)
        all_warnings.extend(ratio_warnings)
        sheet.add_audit_log(
            action="RATIO_VALIDATION_COMPLETE",
            operator=sheet.operator,
            details=f"比例校验完成，发现{len(ratio_issues)}个问题，{len(ratio_warnings)}个警告"
        )

        fee_collector = FeeCollector(sheet.performance_date)
        collected_fees, fee_issues, fee_breakdown = fee_collector.collect(sheet.platform_fees)
        all_issues.extend(fee_issues)
        sheet.add_audit_log(
            action="FEE_COLLECTION_COMPLETE",
            operator=sheet.operator,
            details=f"扣费归集完成，共{len(collected_fees)}项扣费，合计{sum(f.amount for f in collected_fees):.2f}元"
        )

        calculator = RoyaltyCalculator(
            total_box_office=sheet.total_box_office,
            performance_id=sheet.id,
            performance_name=sheet.performance_name,
            performance_date=sheet.performance_date.isoformat() if sheet.performance_date else None,
            operator=sheet.operator,
        )

        current_period_fees = [f for f in collected_fees if f.period.value != "cross"]
        result = calculator.calculate(validated_tracks, current_period_fees, fee_breakdown)
        result.issues = all_issues
        result.warnings = all_warnings

        cross_period_fees = [f for f in collected_fees if f.period.value == "cross"]
        if cross_period_fees:
            result.notes = f"跨期扣费余额{sum(f.amount for f in cross_period_fees):.2f}元待后续处理"

        sheet.add_audit_log(
            action="CALCULATION_COMPLETE",
            operator=sheet.operator,
            details=f"分账计算完成，可分配收入{result.net_distributable:.2f}元，共{len(result.items)}条明细"
        )

        self.auditor.record_output(result)
        self.auditor.record_audit_trail(sheet, result, all_issues)

        return result, all_issues, all_warnings

    def _save_errors(self, sheet: PerformanceSheet, errors: List[str]):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"errors_{sheet.id}_{timestamp}.txt"
        filepath = os.path.join(self.errors_dir, filename)

        error_data = {
            "performance_id": sheet.id,
            "performance_name": sheet.performance_name,
            "operator": sheet.operator,
            "timestamp": timestamp,
            "errors": errors,
            "input_data": sheet.to_dict(),
        }

        import json
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(error_data, f, ensure_ascii=False, indent=2)

    def list_history(self):
        return self.auditor.list_history()



