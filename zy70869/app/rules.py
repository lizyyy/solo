from datetime import datetime, date, timedelta
from typing import List, Optional, Tuple
from .models import (
    Sample, TestPlan, ChamberRecord, FailureDetail, ItemStatus, ResultItem
)


class RuleEngine:
    @staticmethod
    def check_sampling_window(sample: Sample, plan: TestPlan) -> Optional[FailureDetail]:
        window_start = plan.sampling_start_date
        window_end = window_start + timedelta(days=plan.sampling_window_days)
        sample_date = sample.sample_date

        if sample_date < window_start:
            days_early = (window_start - sample_date).days
            return FailureDetail(
                rule_name="sampling_window_early",
                description=f"取样日期早于窗口起始日{days_early}天",
                suggestion="建议等待至取样窗口开始后再提交，或联系QA调整方案",
                boundary_info=f"取样窗口: {window_start} ~ {window_end}, 实际取样: {sample_date}"
            )

        if sample_date > window_end:
            days_late = (sample_date - window_end).days
            return FailureDetail(
                rule_name="sampling_window_late",
                description=f"取样日期晚于窗口截止日{days_late}天",
                suggestion="需提交延期申请并获得审批后才能生效",
                boundary_info=f"取样窗口: {window_start} ~ {window_end}, 实际取样: {sample_date}"
            )

        return None

    @staticmethod
    def check_extension_approval(sample: Sample, plan: TestPlan) -> Optional[FailureDetail]:
        if not sample.extension_days or sample.extension_days <= 0:
            return None

        if not plan.extension_allowed:
            return FailureDetail(
                rule_name="extension_not_allowed",
                description="该试验方案不允许延期",
                suggestion="取消延期申请，按原计划执行",
                boundary_info=f"方案最大延期天数: 0天, 申请延期: {sample.extension_days}天"
            )

        if sample.extension_days > plan.max_extension_days:
            return FailureDetail(
                rule_name="extension_exceeds_max",
                description=f"延期天数超出方案最大允许值{sample.extension_days - plan.max_extension_days}天",
                suggestion=f"缩短延期天数至{plan.max_extension_days}天以内，或申请方案变更",
                boundary_info=f"方案最大延期天数: {plan.max_extension_days}天, 申请延期: {sample.extension_days}天"
            )

        if sample.extension_approved is None or not sample.extension_approved:
            return FailureDetail(
                rule_name="extension_not_approved",
                description="延期申请尚未获得审批",
                suggestion="请QA负责人审批延期申请后重新提交",
                boundary_info=f"当前审批状态: {'未提交' if sample.extension_approved is None else '已拒绝'}"
            )

        return None

    @staticmethod
    def check_chamber_temperature(sample: Sample, plan: TestPlan,
                                   chamber_records: List[ChamberRecord]) -> Tuple[Optional[FailureDetail], bool]:
        if not sample.chamber_id:
            return None, False

        sample_records = [
            r for r in chamber_records
            if r.chamber_id == sample.chamber_id
        ]

        if not sample_records:
            return FailureDetail(
                rule_name="chamber_records_missing",
                description=f"环境箱{sample.chamber_id}无温度记录",
                suggestion="补充环境箱温度记录后重新提交",
                boundary_info=f"环境箱编号: {sample.chamber_id}"
            ), False

        over_temp_records = []
        for record in sample_records:
            if record.temperature < plan.required_temperature_min:
                over_temp_records.append(
                    f"{record.record_time}: {record.temperature}℃(低于下限{plan.required_temperature_min}℃)"
                )
            elif record.temperature > plan.required_temperature_max:
                over_temp_records.append(
                    f"{record.record_time}: {record.temperature}℃(高于上限{plan.required_temperature_max}℃)"
                )

        if over_temp_records:
            return FailureDetail(
                rule_name="chamber_temperature_violation",
                description=f"环境箱{sample.chamber_id}有{len(over_temp_records)}条超温记录",
                suggestion="评估超温对试验的影响，必要时重新安排试验",
                boundary_info=f"温度范围: {plan.required_temperature_min}~{plan.required_temperature_max}℃, 异常记录: {'; '.join(over_temp_records[:3])}"
            ), True

        return None, False

    @classmethod
    def validate_sample(cls, sample: Sample, plan: Optional[TestPlan],
                        chamber_records: List[ChamberRecord]) -> Tuple[ItemStatus, List[FailureDetail]]:
        failures: List[FailureDetail] = []
        pending_failures: List[FailureDetail] = []

        if not plan:
            failures.append(FailureDetail(
                rule_name="test_plan_missing",
                description="未找到对应试验方案",
                suggestion="检查物料编码和试验类型是否匹配",
                boundary_info=f"物料编码: {sample.material_code}, 试验类型: {sample.test_type}"
            ))
        else:
            window_issue = cls.check_sampling_window(sample, plan)
            if window_issue:
                if "late" in window_issue.rule_name:
                    pending_failures.append(window_issue)
                else:
                    failures.append(window_issue)

            extension_issue = cls.check_extension_approval(sample, plan)
            if extension_issue:
                pending_failures.append(extension_issue)

            temp_issue, is_fatal = cls.check_chamber_temperature(sample, plan, chamber_records)
            if temp_issue:
                if is_fatal:
                    failures.append(temp_issue)
                else:
                    pending_failures.append(temp_issue)

        if failures:
            return ItemStatus.FAILED, failures + pending_failures
        elif pending_failures:
            return ItemStatus.PENDING_CONFIRMATION, pending_failures
        else:
            return ItemStatus.NORMAL, []

    @classmethod
    def process_samples(cls, samples: List[Sample], plans: List[TestPlan],
                        chamber_records: List[ChamberRecord]) -> List[ResultItem]:
        plan_map = {(p.material_code, p.test_type): p for p in plans}
        results: List[ResultItem] = []

        for sample in samples:
            plan = plan_map.get((sample.material_code, sample.test_type))
            status, failures = cls.validate_sample(sample, plan, chamber_records)

            results.append(ResultItem(
                sample_id=sample.sample_id,
                batch_id=sample.batch_id,
                material_code=sample.material_code,
                status=status,
                sample_date=sample.sample_date,
                test_type=sample.test_type,
                failures=failures,
                raw_data=sample.raw_data
            ))

        return results
