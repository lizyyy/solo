from typing import Any, Dict, List, Tuple

from .database import DataSourceType, ValidationLevel


class DataValidator:
    def __init__(self, source_type: DataSourceType):
        self.source_type = source_type
        self.errors: List[Tuple] = []

    def validate(self, data: Dict[str, Any], row_no: int) -> List[Tuple]:
        self.errors = []
        validators = {
            DataSourceType.PILE_ALARM: self._validate_pile_alarm,
            DataSourceType.INSPECTION: self._validate_inspection,
            DataSourceType.COMPLAINT: self._validate_complaint,
            DataSourceType.SUPPLIER_BILL: self._validate_supplier_bill,
            DataSourceType.OFFLINE_WORK_ORDER: self._validate_work_order,
            DataSourceType.APPROVAL_EMAIL: self._validate_approval_email,
        }
        validator = validators.get(self.source_type)
        if validator:
            validator(data, row_no)
        return self.errors

    def _add_error(
        self,
        level: ValidationLevel,
        field: str,
        code: str,
        message: str,
        row_no: int,
    ):
        self.errors.append((level, field, code, message, row_no))

    def _validate_pile_alarm(self, data: Dict, row_no: int):
        if not data.get("pile_id"):
            self._add_error(
                ValidationLevel.ERROR,
                "pile_id",
                "MISSING_REQUIRED",
                "桩编号不能为空",
                row_no,
            )
        if not data.get("alarm_time"):
            self._add_error(
                ValidationLevel.ERROR,
                "alarm_time",
                "MISSING_REQUIRED",
                "告警时间不能为空",
                row_no,
            )
        if not data.get("alarm_code"):
            self._add_error(
                ValidationLevel.ERROR,
                "alarm_code",
                "MISSING_REQUIRED",
                "告警代码不能为空",
                row_no,
            )
        duration = data.get("duration_minutes")
        if duration is not None:
            try:
                if float(duration) < 0:
                    self._add_error(
                        ValidationLevel.WARNING,
                        "duration_minutes",
                        "NEGATIVE_VALUE",
                        "故障时长不能为负数",
                        row_no,
                    )
            except (ValueError, TypeError):
                self._add_error(
                    ValidationLevel.ERROR,
                    "duration_minutes",
                    "INVALID_TYPE",
                    "故障时长必须是数字",
                    row_no,
                )

    def _validate_inspection(self, data: Dict, row_no: int):
        if not data.get("pile_id"):
            self._add_error(
                ValidationLevel.ERROR, "pile_id", "MISSING_REQUIRED", "桩编号不能为空", row_no
            )
        if not data.get("inspection_date"):
            self._add_error(
                ValidationLevel.ERROR,
                "inspection_date",
                "MISSING_REQUIRED",
                "巡检日期不能为空",
                row_no,
            )
        if data.get("inspector") and len(str(data.get("inspector"))) > 50:
            self._add_error(
                ValidationLevel.WARNING,
                "inspector",
                "VALUE_TOO_LONG",
                "巡检员名称过长",
                row_no,
            )

    def _validate_complaint(self, data: Dict, row_no: int):
        if not data.get("complaint_no"):
            self._add_error(
                ValidationLevel.ERROR,
                "complaint_no",
                "MISSING_REQUIRED",
                "投诉单号不能为空",
                row_no,
            )
        if not data.get("customer_phone"):
            self._add_error(
                ValidationLevel.WARNING,
                "customer_phone",
                "MISSING_PHONE",
                "缺少客户联系电话",
                row_no,
            )

    def _validate_supplier_bill(self, data: Dict, row_no: int):
        if not data.get("bill_no"):
            self._add_error(
                ValidationLevel.ERROR, "bill_no", "MISSING_REQUIRED", "账单号不能为空", row_no
            )
        amount = data.get("amount")
        if amount is not None:
            try:
                float(amount)
            except (ValueError, TypeError):
                self._add_error(
                    ValidationLevel.ERROR,
                    "amount",
                    "INVALID_TYPE",
                    "金额必须是数字",
                    row_no,
                )

    def _validate_work_order(self, data: Dict, row_no: int):
        if not data.get("order_no"):
            self._add_error(
                ValidationLevel.ERROR, "order_no", "MISSING_REQUIRED", "工单号不能为空", row_no
            )
        status = data.get("status")
        if status and status not in ["pending", "processing", "completed", "closed"]:
            self._add_error(
                ValidationLevel.WARNING,
                "status",
                "INVALID_STATUS",
                f"未知工单状态: {status}",
                row_no,
            )
        recover_time = data.get("recover_time")
        alarm_time = data.get("alarm_time")
        if recover_time and alarm_time:
            from .utils import parse_date
            rt = parse_date(str(recover_time))
            at = parse_date(str(alarm_time))
            if rt and at and rt < at:
                self._add_error(
                    ValidationLevel.ERROR,
                    "recover_time",
                    "TIME_INCONSISTENCY",
                    "恢复时间早于告警时间",
                    row_no,
                )

    def _validate_approval_email(self, data: Dict, row_no: int):
        if not data.get("email_id"):
            self._add_error(
                ValidationLevel.ERROR, "email_id", "MISSING_REQUIRED", "邮件ID不能为空", row_no
            )
        if not data.get("related_batch_no"):
            self._add_error(
                ValidationLevel.WARNING,
                "related_batch_no",
                "MISSING_RELATED",
                "审批邮件未关联批次号",
                row_no,
            )
