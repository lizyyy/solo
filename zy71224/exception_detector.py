from datetime import date, datetime
from typing import List, Dict, Tuple, Optional
from collections import defaultdict
from models import (
    SignRecord, VisitRecord, FeeRecord, SurrenderApplication,
    SurrenderException, SurrenderProcess, SurrenderStatus, VisitStatus,
    RefundStatus
)



class ExceptionType:
    SIGN_DATE_DISPUTE = "签收日期争议"
    DUPLICATE_SIGN_RECORD = "重复签收记录"
    LATE_SIGN_RECORD = "晚到签收材料"
    NO_VISIT_RECORD = "无回访记录"
    VISIT_FAILED = "回访失败"
    VISIT_NO_RECORDING = "回访无录音"
    NO_FEE_RECORD = "无扣费记录"
    FEE_NOT_REFUNDED = "已扣费未退费"
    DUPLICATE_FEE_RECORD = "重复扣费记录"
    DUPLICATE_SURRENDER_APP = "重复退保申请"
    LATE_SURRENDER_APP = "晚到退保申请"
    COOLING_OFF_EXPIRED = "犹豫期已过"
    MISSING_POLICY = "保单信息缺失"
    MISSING_SIGN = "签收记录缺失"
    DATA_INCONSISTENCY = "数据不一致"


class ExceptionLevel:
    CRITICAL = "严重"
    HIGH = "高"
    MEDIUM = "中"
    LOW = "低"


class ExceptionDetector:
    def __init__(self):
        self.exceptions: List[SurrenderException] = []

    def reset(self):
        self.exceptions = []

    def detect_all(self, process: SurrenderProcess) -> List[SurrenderException]:
        prev_count = len(self.exceptions)
        
        self._detect_sign_exceptions(process)
        self._detect_visit_exceptions(process)
        self._detect_fee_exceptions(process)
        self._detect_surrender_app_exceptions(process)
        self._detect_cooling_off_exception(process)
        self._detect_missing_data_exceptions(process)
        
        return self.exceptions[prev_count:]

    def _add_exception(
        self,
        policy_no: str,
        apply_no: Optional[str],
        exception_type: str,
        exception_level: str,
        exception_desc: str,
        suggested_action: str
    ):
        exception = SurrenderException(
            policy_no=policy_no,
            apply_no=apply_no,
            exception_type=exception_type,
            exception_level=exception_level,
            exception_desc=exception_desc,
            suggested_action=suggested_action,
            detect_time=datetime.now()
        )
        self.exceptions.append(exception)

    def _detect_sign_exceptions(self, process: SurrenderProcess):
        policy_no = process.policy_no
        apply_no = process.apply_no

        if not process.sign_record:
            return

        if process.application:
            if process.sign_record.sign_date > process.application.apply_date:
                self._add_exception(
                    policy_no=policy_no,
                    apply_no=apply_no,
                    exception_type=ExceptionType.SIGN_DATE_DISPUTE,
                    exception_level=ExceptionLevel.CRITICAL,
                    exception_desc=f"签收日期({process.sign_record.sign_date})晚于退保申请日期({process.application.apply_date})，数据逻辑异常",
                    suggested_action="立即核实签收日期真实性，联系客户确认实际签收时间，必要时调阅签收凭证"
                )

        if len(process.all_sign_records) > 1:
            dates = [r.sign_date for r in process.all_sign_records]
            has_duplicate_dates = len(set(dates)) < len(dates)
            if has_duplicate_dates:
                self._add_exception(
                    policy_no=policy_no,
                    apply_no=apply_no,
                    exception_type=ExceptionType.DUPLICATE_SIGN_RECORD,
                    exception_level=ExceptionLevel.HIGH,
                    exception_desc=f"存在{len(process.all_sign_records)}条签收记录，日期存在重复，请确认哪条有效",
                    suggested_action="核对原始签收凭证，确认有效签收记录，标记重复数据，不覆盖前一版"
                )
            else:
                self._add_exception(
                    policy_no=policy_no,
                    apply_no=apply_no,
                    exception_type=ExceptionType.LATE_SIGN_RECORD,
                    exception_level=ExceptionLevel.MEDIUM,
                    exception_desc=f"存在{len(process.all_sign_records)}条签收记录，可能为晚到材料，已保留全部版本未覆盖",
                    suggested_action="核对各签收记录的来源，以最早有效记录为准，后续材料仅供参考"
                )

        if process.sign_record.sign_date:
            days_since_sign = (date.today() - process.sign_record.sign_date).days
            if days_since_sign > 60:
                self._add_exception(
                    policy_no=policy_no,
                    apply_no=apply_no,
                    exception_type=ExceptionType.LATE_SIGN_RECORD,
                    exception_level=ExceptionLevel.MEDIUM,
                    exception_desc=f"签收记录距今日已{days_since_sign}天，属于晚到材料",
                    suggested_action="核实数据延迟原因，检查是否影响退保处理时效"
                )

    def _detect_visit_exceptions(self, process: SurrenderProcess):
        policy_no = process.policy_no
        apply_no = process.apply_no

        if not process.visit_records or len(process.visit_records) == 0:
            self._add_exception(
                policy_no=policy_no,
                apply_no=apply_no,
                exception_type=ExceptionType.NO_VISIT_RECORD,
                exception_level=ExceptionLevel.CRITICAL,
                exception_desc="该保单无任何回访记录，不符合犹豫期退保要求",
                suggested_action="立即安排回访并录音，确认客户真实退保意愿"
            )
            return

        has_successful_visit = any(
            v.visit_status == VisitStatus.VISITED for v in process.visit_records
        )
        if not has_successful_visit:
            self._add_exception(
                policy_no=policy_no,
                apply_no=apply_no,
                exception_type=ExceptionType.VISIT_FAILED,
                exception_level=ExceptionLevel.HIGH,
                exception_desc="回访记录显示全部回访失败，无法确认客户意愿",
                suggested_action="再次尝试联系客户进行回访，或通过其他渠道核实退保意愿"
            )

        has_recording = any(
            v.recording_file and v.recording_file.strip() for v in process.visit_records
        )
        if not has_recording:
            self._add_exception(
                policy_no=policy_no,
                apply_no=apply_no,
                exception_type=ExceptionType.VISIT_NO_RECORDING,
                exception_level=ExceptionLevel.HIGH,
                exception_desc="回访记录中无录音文件路径，存在合规风险",
                suggested_action="查找并补录回访录音，确保留痕完整"
            )

    def _detect_fee_exceptions(self, process: SurrenderProcess):
        policy_no = process.policy_no
        apply_no = process.apply_no

        if not process.fee_records or len(process.fee_records) == 0:
            self._add_exception(
                policy_no=policy_no,
                apply_no=apply_no,
                exception_type=ExceptionType.NO_FEE_RECORD,
                exception_level=ExceptionLevel.HIGH,
                exception_desc="未找到该保单的扣费记录",
                suggested_action="核实保费缴纳情况，确认是否已扣费"
            )
            return

        if len(process.fee_records) > 1:
            transaction_nos = [r.transaction_no for r in process.fee_records]
            if len(set(transaction_nos)) < len(transaction_nos):
                self._add_exception(
                    policy_no=policy_no,
                    apply_no=apply_no,
                    exception_type=ExceptionType.DUPLICATE_FEE_RECORD,
                    exception_level=ExceptionLevel.HIGH,
                    exception_desc=f"存在{len(process.fee_records)}条扣费记录，交易流水号存在重复",
                    suggested_action="核实银行流水，确认实际扣费金额，处理重复记账"
                )

        if process.status not in [SurrenderStatus.REFUNDED, SurrenderStatus.REJECTED]:
            total_fees = sum(r.fee_amount for r in process.fee_records)
            if total_fees > 0:
                is_refund_completed = (
                    process.refund is not None and
                    process.refund.refund_status == RefundStatus.COMPLETED
                )
                if not is_refund_completed:
                    status_desc = "未生成退费计划"
                    if process.refund is not None:
                        status_desc = f"退费状态为【{process.refund.refund_status.value}】"
                    self._add_exception(
                        policy_no=policy_no,
                        apply_no=apply_no,
                        exception_type=ExceptionType.FEE_NOT_REFUNDED,
                        exception_level=ExceptionLevel.CRITICAL,
                        exception_desc=f"已扣费{total_fees}元但{status_desc}，存在资金风险",
                        suggested_action="优先处理该单退费流程，完成实际支付后将状态更新为【已支付】，确保资金及时返还客户"
                    )

    def _detect_surrender_app_exceptions(self, process: SurrenderProcess):
        policy_no = process.policy_no
        apply_no = process.apply_no

        if len(process.all_applications) > 1:
            apply_nos = [app.apply_no for app in process.all_applications]
            has_duplicate_app_nos = len(set(apply_nos)) < len(apply_nos)
            
            if has_duplicate_app_nos:
                self._add_exception(
                    policy_no=policy_no,
                    apply_no=apply_no,
                    exception_type=ExceptionType.DUPLICATE_SURRENDER_APP,
                    exception_level=ExceptionLevel.HIGH,
                    exception_desc=f"该保单存在{len(process.all_applications)}条退保申请，申请编号重复，已保留多版本未覆盖，请人工确认",
                    suggested_action="核对各申请的来源和时间，以最新有效申请为准，重复申请幂等处理，不得重复退费"
                )
            else:
                self._add_exception(
                    policy_no=policy_no,
                    apply_no=apply_no,
                    exception_type=ExceptionType.DUPLICATE_SURRENDER_APP,
                    exception_level=ExceptionLevel.HIGH,
                    exception_desc=f"该保单存在{len(process.all_applications)}条退保申请，可能为客户重复提交",
                    suggested_action="联系客户确认真实意愿，各版本均已保留未覆盖，以客户确认的有效申请为准"
                )

        if process.application:
            days_since_apply = (date.today() - process.application.apply_date).days
            if days_since_apply > 15:
                self._add_exception(
                    policy_no=policy_no,
                    apply_no=apply_no,
                    exception_type=ExceptionType.LATE_SURRENDER_APP,
                    exception_level=ExceptionLevel.MEDIUM,
                    exception_desc=f"退保申请提交已{days_since_apply}天尚未处理完成",
                    suggested_action="加快处理进度，避免客户投诉"
                )

    def _detect_cooling_off_exception(self, process: SurrenderProcess):
        if process.is_within_cooling_off is False:
            self._add_exception(
                policy_no=process.policy_no,
                apply_no=process.apply_no,
                exception_type=ExceptionType.COOLING_OFF_EXPIRED,
                exception_level=ExceptionLevel.HIGH,
                exception_desc=f"犹豫期已过，已使用{process.cooling_off_days_used}天，按非犹豫期退保规则处理",
                suggested_action="告知客户犹豫期后退保的费用扣除规则，取得客户确认后继续处理"
            )

    def _detect_missing_data_exceptions(self, process: SurrenderProcess):
        policy_no = process.policy_no
        apply_no = process.apply_no

        if not process.policy:
            self._add_exception(
                policy_no=policy_no,
                apply_no=apply_no,
                exception_type=ExceptionType.MISSING_POLICY,
                exception_level=ExceptionLevel.CRITICAL,
                exception_desc="保单核心信息缺失，无法继续处理",
                suggested_action="从核心业务系统补全保单信息"
            )

        if not process.sign_record:
            self._add_exception(
                policy_no=policy_no,
                apply_no=apply_no,
                exception_type=ExceptionType.MISSING_SIGN,
                exception_level=ExceptionLevel.HIGH,
                exception_desc="签收记录缺失，无法计算犹豫期",
                suggested_action="查找并补录签收记录，确认客户实际签收日期"
            )

    def get_exception_summary(self) -> Dict:
        summary = defaultdict(lambda: {"count": 0, "level": "", "policy_nos": []})
        
        for exc in self.exceptions:
            key = exc.exception_type
            summary[key]["count"] += 1
            summary[key]["level"] = exc.exception_level
            summary[key]["policy_nos"].append(exc.policy_no)

        result = {
            "total_exceptions": len(self.exceptions),
            "by_type": dict(summary),
            "by_level": defaultdict(int),
            "unresolved_count": len([e for e in self.exceptions if not e.is_resolved])
        }

        for exc in self.exceptions:
            result["by_level"][exc.exception_level] += 1

        return result
