from datetime import datetime
from typing import List, Tuple, Optional
from models import (
    Caller, ApiDecommission, ExtensionRequest,
    TransformationStatus, ExtensionApprovalStatus, ValidationError
)


def validate_date(date_str: str) -> Tuple[bool, Optional[datetime]]:
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return True, dt
    except ValueError:
        return False, None


class ApiDecommissionManager:
    def __init__(self):
        self.apis: dict[str, ApiDecommission] = {}

    def register_api(self, api_name: str, decommission_date: str) -> Tuple[bool, List[ValidationError]]:
        errors = []

        if not api_name or not api_name.strip():
            errors.append(ValidationError(
                field="api_name",
                message="接口名称不能为空"
            ))

        is_valid, decomm_date = validate_date(decommission_date)
        if not is_valid:
            errors.append(ValidationError(
                field="decommission_date",
                message=f"退役日期格式错误: {decommission_date}，请使用 YYYY-MM-DD 格式"
            ))

        if api_name in self.apis:
            errors.append(ValidationError(
                field="api_name",
                message=f"接口 {api_name} 已存在"
            ))

        if errors:
            return False, errors

        self.apis[api_name] = ApiDecommission(
            api_name=api_name,
            decommission_date=decommission_date
        )
        return True, []

    def register_caller(self, api_name: str, caller_name: str, transformation_plan: str,
                        planned_complete_date: Optional[str] = None, remarks: Optional[str] = None) -> Tuple[bool, List[ValidationError]]:
        errors = []

        if api_name not in self.apis:
            errors.append(ValidationError(
                field="api_name",
                message=f"接口 {api_name} 不存在，请先注册接口"
            ))
            return False, errors

        if not caller_name or not caller_name.strip():
            errors.append(ValidationError(
                field="caller_name",
                message="调用方名称不能为空"
            ))

        if not transformation_plan or not transformation_plan.strip():
            errors.append(ValidationError(
                field="transformation_plan",
                message="改造计划不能为空"
            ))

        if planned_complete_date:
            is_valid, plan_date = validate_date(planned_complete_date)
            if not is_valid:
                errors.append(ValidationError(
                    field="planned_complete_date",
                    message=f"计划完成日期格式错误: {planned_complete_date}，请使用 YYYY-MM-DD 格式"
                ))
            else:
                api = self.apis[api_name]
                is_valid, decomm_date = validate_date(api.decommission_date)
                if is_valid and plan_date and decomm_date and plan_date > decomm_date:
                    errors.append(ValidationError(
                        field="planned_complete_date",
                        message=f"计划完成日期 {planned_complete_date} 晚于退役日期 {api.decommission_date}，建议申请延期",
                        severity="warning"
                    ))

        existing_caller = next((c for c in self.apis[api_name].callers
                                if c.caller_name == caller_name), None)
        if existing_caller:
            errors.append(ValidationError(
                field="caller_name",
                message=f"调用方 {caller_name} 已登记，请勿重复提交"
            ))

        if errors and any(e.severity == "error" for e in errors):
            return False, errors

        caller = Caller(
            caller_name=caller_name,
            api_name=api_name,
            transformation_plan=transformation_plan,
            planned_complete_date=planned_complete_date,
            remarks=remarks
        )
        self.apis[api_name].callers.append(caller)
        return True, errors

    def request_extension(self, api_name: str, caller_name: str, original_decommission_date: str,
                          requested_decommission_date: str, reason: str) -> Tuple[bool, List[ValidationError]]:
        errors = []

        if api_name not in self.apis:
            errors.append(ValidationError(
                field="api_name",
                message=f"接口 {api_name} 不存在"
            ))
            return False, errors

        api = self.apis[api_name]

        caller_exists = any(c.caller_name == caller_name for c in api.callers)
        if not caller_exists:
            errors.append(ValidationError(
                field="caller_name",
                message=f"调用方 {caller_name} 未在接口 {api_name} 下登记"
            ))

        is_valid_orig, orig_date = validate_date(original_decommission_date)
        if not is_valid_orig:
            errors.append(ValidationError(
                field="original_decommission_date",
                message=f"原退役日期格式错误: {original_decommission_date}"
            ))

        is_valid_req, req_date = validate_date(requested_decommission_date)
        if not is_valid_req:
            errors.append(ValidationError(
                field="requested_decommission_date",
                message=f"申请延期日期格式错误: {requested_decommission_date}"
            ))

        if is_valid_orig and is_valid_req and orig_date and req_date:
            if req_date <= orig_date:
                errors.append(ValidationError(
                    field="requested_decommission_date",
                    message=f"申请延期日期 {requested_decommission_date} 必须晚于原退役日期 {original_decommission_date}"
                ))

        if not reason or not reason.strip():
            errors.append(ValidationError(
                field="reason",
                message="延期理由不能为空"
            ))

        if errors:
            return False, errors

        extension = ExtensionRequest(
            caller_name=caller_name,
            api_name=api_name,
            original_decommission_date=original_decommission_date,
            requested_decommission_date=requested_decommission_date,
            reason=reason
        )
        api.extension_requests.append(extension)
        return True, []

    def approve_extension(self, api_name: str, caller_name: str, approved: bool,
                          approved_by: str) -> Tuple[bool, List[ValidationError]]:
        errors = []

        if api_name not in self.apis:
            errors.append(ValidationError(
                field="api_name",
                message=f"接口 {api_name} 不存在"
            ))
            return False, errors

        api = self.apis[api_name]

        extension = next((e for e in api.extension_requests
                          if e.caller_name == caller_name and e.approval_status == ExtensionApprovalStatus.PENDING), None)

        if not extension:
            errors.append(ValidationError(
                field="extension_request",
                message=f"未找到调用方 {caller_name} 的待审批延期申请"
            ))
            return False, errors

        if not approved_by or not approved_by.strip():
            errors.append(ValidationError(
                field="approved_by",
                message="审批人不能为空"
            ))
            return False, errors

        if approved:
            extension.approval_status = ExtensionApprovalStatus.APPROVED
            caller = next(c for c in api.callers if c.caller_name == caller_name)
            caller.status = TransformationStatus.DELAYED
            api.decommission_date = extension.requested_decommission_date
        else:
            extension.approval_status = ExtensionApprovalStatus.REJECTED

        extension.approved_by = approved_by
        extension.approved_at = datetime.now()
        return True, []

    def update_caller_status(self, api_name: str, caller_name: str, status: TransformationStatus) -> Tuple[bool, List[ValidationError]]:
        errors = []

        if api_name not in self.apis:
            errors.append(ValidationError(
                field="api_name",
                message=f"接口 {api_name} 不存在"
            ))
            return False, errors

        api = self.apis[api_name]
        caller = next((c for c in api.callers if c.caller_name == caller_name), None)

        if not caller:
            errors.append(ValidationError(
                field="caller_name",
                message=f"调用方 {caller_name} 不存在"
            ))
            return False, errors

        caller.status = status
        return True, []

    def get_api(self, api_name: str) -> Optional[ApiDecommission]:
        return self.apis.get(api_name)

    def list_apis(self) -> List[ApiDecommission]:
        return list(self.apis.values())
