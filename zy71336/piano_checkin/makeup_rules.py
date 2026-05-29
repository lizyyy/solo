"""补录规则引擎 - 检测超期补录、无效理由等问题"""
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Tuple
from datetime import datetime, timedelta, date
import re

from .models import (
    MakeupInfo, CheckinRecord, AbnormalType,
    Schedule, Student, load_json, SCHEDULE_FILE
)


VALID_REASONS = [
    "生病", "感冒", "发烧", "咳嗽", "请假", "外出", "旅游",
    "回老家", "亲戚来访", "家庭聚会", "学校活动", "考试",
    "补课", "兴趣班", "比赛", "演出", "排练",
    "设备故障", "网络问题", "手机没电", "忘记打卡",
    "钢琴调律", "教室维修", "临时有事"
]

INVALID_REASON_PATTERNS = [
    r"^.{0,4}$",
    r"^[嗯啊哦哈]+$",
    r"^[。，！？、,.!?]+$",
    r"^(随便|不知道|忘了|没想好|没有)$",
]


@dataclass
class MakeupCheckResult:
    is_valid: bool
    abnormal_types: List[AbnormalType]
    details: List[str]
    suggested_action: Optional[str] = None


class MakeupRuleEngine:
    MAX_MAKEUP_DAYS = 3
    MIN_REASON_LENGTH = 5

    def __init__(
        self,
        max_makeup_days: int = None,
        min_reason_length: int = None
    ):
        self.max_makeup_days = max_makeup_days or self.MAX_MAKEUP_DAYS
        self.min_reason_length = min_reason_length or self.MIN_REASON_LENGTH
        self._schedules: List[Schedule] = []
        self._load_schedules()

    def _load_schedules(self):
        data = load_json(SCHEDULE_FILE, [])
        self._schedules = [Schedule.from_dict(s) for s in data]

    def check_makeup(
        self,
        makeup: MakeupInfo,
        student_id: str,
        checkin_date: str
    ) -> MakeupCheckResult:
        abnormal_types: List[AbnormalType] = []
        details: List[str] = []
        suggested_action: Optional[str] = None

        if not makeup.is_makeup:
            return MakeupCheckResult(
                is_valid=True,
                abnormal_types=[],
                details=[],
                suggested_action=None
            )

        if not makeup.original_date:
            abnormal_types.append(AbnormalType.MAKEUP_OVERDUE)
            details.append("补录缺少原打卡日期，请填写实际应该打卡的日期")
            suggested_action = "请家长补充原打卡日期后重新提交"

        if not makeup.reason:
            abnormal_types.append(AbnormalType.INVALID_REASON)
            details.append("补录缺少理由说明，请填写补录原因")
            suggested_action = suggested_action or "请家长补充补录理由后重新提交"

        if makeup.original_date:
            overdue_result = self._check_overdue(
                makeup.original_date,
                makeup.submit_date or checkin_date
            )
            if not overdue_result[0]:
                abnormal_types.append(AbnormalType.MAKEUP_OVERDUE)
                details.append(overdue_result[1])
                suggested_action = "超过补录期限，需老师特殊审批"

        if makeup.reason:
            reason_result = self._validate_reason(makeup.reason)
            if not reason_result[0]:
                abnormal_types.append(AbnormalType.INVALID_REASON)
                details.append(reason_result[1])
                suggested_action = suggested_action or "请家长详细说明补录原因"

        schedule_result = self._check_schedule(student_id, makeup.original_date)
        if not schedule_result[0]:
            abnormal_types.append(AbnormalType.INVALID_REASON)
            details.append(schedule_result[1])
            suggested_action = suggested_action or "请核对原打卡日期是否正确"

        is_valid = len(abnormal_types) == 0

        return MakeupCheckResult(
            is_valid=is_valid,
            abnormal_types=abnormal_types,
            details=details,
            suggested_action=suggested_action
        )

    def _check_overdue(
        self,
        original_date_str: str,
        submit_date_str: str
    ) -> Tuple[bool, str]:
        try:
            original_date = datetime.strptime(original_date_str, "%Y-%m-%d").date()
            submit_date = datetime.strptime(submit_date_str, "%Y-%m-%d").date()
        except ValueError:
            return False, f"日期格式错误: 原日期={original_date_str}, 提交日期={submit_date_str}"

        days_diff = (submit_date - original_date).days

        if days_diff < 0:
            return False, (
                f"补录日期异常: 原打卡日期({original_date_str})"
                f"晚于提交日期({submit_date_str})，"
                f"相差{abs(days_diff)}天"
            )

        if days_diff > self.max_makeup_days:
            return False, (
                f"补录超期: 原打卡日期为{original_date_str}，"
                f"提交日期为{submit_date_str}，"
                f"已超期{days_diff - self.max_makeup_days}天"
                f"（限{self.max_makeup_days}天内补录）"
            )

        return True, ""

    def _validate_reason(self, reason: str) -> Tuple[bool, str]:
        reason = reason.strip()

        if len(reason) < self.min_reason_length:
            return False, (
                f"补录理由过短: 仅{len(reason)}字，"
                f"至少需要{self.min_reason_length}字，"
                f"请详细说明原因"
            )

        for pattern in INVALID_REASON_PATTERNS:
            if re.match(pattern, reason):
                return False, (
                    f"补录理由无效: \"{reason}\" 过于简单，"
                    f"请说明具体情况"
                )

        has_valid_keyword = any(
            keyword in reason for keyword in VALID_REASONS
        )

        if not has_valid_keyword:
            matched_similar = self._find_similar_reason(reason)
            if matched_similar:
                return True, ""
            return False, (
                f"补录理由不够明确: \"{reason}\"，"
                f"建议包含具体原因（如生病、外出、设备故障等）"
            )

        return True, ""

    def _find_similar_reason(self, reason: str) -> Optional[str]:
        for valid in VALID_REASONS:
            if valid in reason or reason in valid:
                return valid
            if len(set(reason) & set(valid)) >= 2:
                return valid
        return None

    def _check_schedule(
        self,
        student_id: str,
        original_date_str: Optional[str]
    ) -> Tuple[bool, str]:
        if not original_date_str:
            return True, ""

        try:
            original_date = datetime.strptime(original_date_str, "%Y-%m-%d").date()
        except ValueError:
            return False, f"原打卡日期格式错误: {original_date_str}"

        student_schedules = [
            s for s in self._schedules if s.student_id == student_id
        ]

        if not student_schedules:
            return True, ""

        day_of_week = original_date.weekday()
        has_class = any(s.day_of_week == day_of_week for s in student_schedules)

        if not has_class:
            weekday_names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
            class_days = [weekday_names[s.day_of_week] for s in student_schedules]
            return False, (
                f"课程表不匹配: {original_date_str}是{weekday_names[day_of_week]}，"
                f"该生上课时间为{'、'.join(class_days)}，"
                f"当天无课程安排"
            )

        return True, ""

    def validate_record(
        self,
        record: CheckinRecord
    ) -> CheckinRecord:
        result = self.check_makeup(
            record.makeup,
            record.student_id,
            record.checkin_date
        )

        if not result.is_valid:
            for ab_type in result.abnormal_types:
                if ab_type not in record.abnormal_types:
                    record.abnormal_types.append(ab_type)
            for detail in result.details:
                if detail not in record.abnormal_details:
                    record.abnormal_details.append(detail)

        record.updated_at = datetime.now().isoformat()
        return record

    def get_makeup_summary(
        self,
        records: List[CheckinRecord]
    ) -> Dict[str, Any]:
        makeup_records = [r for r in records if r.makeup.is_makeup]
        overdue_records = [
            r for r in makeup_records
            if AbnormalType.MAKEUP_OVERDUE in r.abnormal_types
        ]
        invalid_reason_records = [
            r for r in makeup_records
            if AbnormalType.INVALID_REASON in r.abnormal_types
        ]

        return {
            "total_makeup": len(makeup_records),
            "overdue_count": len(overdue_records),
            "invalid_reason_count": len(invalid_reason_records),
            "overdue_records": [r.record_id for r in overdue_records],
            "invalid_reason_records": [r.record_id for r in invalid_reason_records],
            "avg_delay_days": self._calc_avg_delay(makeup_records)
        }

    def _calc_avg_delay(self, makeup_records: List[CheckinRecord]) -> float:
        delays = []
        for r in makeup_records:
            if r.makeup.original_date and r.makeup.submit_date:
                try:
                    orig = datetime.strptime(r.makeup.original_date, "%Y-%m-%d").date()
                    submit = datetime.strptime(r.makeup.submit_date, "%Y-%m-%d").date()
                    delays.append((submit - orig).days)
                except ValueError:
                    continue
        return round(sum(delays) / len(delays), 1) if delays else 0.0
