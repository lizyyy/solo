from typing import Optional, Dict, Any


class HumanReadableError(Exception):
    def __init__(
        self,
        message: str,
        user_tip: str,
        error_code: str,
        details: Optional[Dict[str, Any]] = None,
        evidence_reference: Optional[str] = None,
    ):
        super().__init__(message)
        self.message = message
        self.user_tip = user_tip
        self.error_code = error_code
        self.details = details or {}
        self.evidence_reference = evidence_reference

    def to_dict(self):
        return {
            "error_code": self.error_code,
            "message": self.message,
            "user_tip": self.user_tip,
            "details": self.details,
            "evidence_reference": self.evidence_reference,
        }


class DuplicateRecordError(HumanReadableError):
    def __init__(
        self,
        idempotency_key: str,
        existing_record_id: str,
        existing_timestamp: str,
    ):
        super().__init__(
            message=f"这条记录已经处理过了",
            user_tip="这不是错误，系统只是防止重复处理。如果您确认需要重新处理，请先在人工确认页面撤销原记录。",
            error_code="DUPLICATE_RECORD",
            details={
                "idempotency_key": idempotency_key,
                "existing_record_id": existing_record_id,
                "existing_timestamp": existing_timestamp,
            },
            evidence_reference=existing_record_id,
        )


class LateArrivalError(HumanReadableError):
    def __init__(
        self,
        record_id: str,
        record_timestamp: str,
        expected_before: str,
        reference_batch: str,
    ):
        super().__init__(
            message=f"这条记录来得太晚了，它所属的批次 {reference_batch} 已经处理完成",
            user_tip="晚到的记录不会自动生效。请检查数据来源的延迟问题，如需生效请走人工更正流程。",
            error_code="LATE_ARRIVAL",
            details={
                "record_id": record_id,
                "record_timestamp": record_timestamp,
                "expected_before": expected_before,
                "reference_batch": reference_batch,
            },
            evidence_reference=record_id,
        )


class PermissionNotFoundError(HumanReadableError):
    def __init__(
        self,
        tenant_id: str,
        user_id: str,
        permission_code: str,
    ):
        super().__init__(
            message=f"找不到权限配置：租户 {tenant_id} 的用户 {user_id} 没有 {permission_code} 这个权限项",
            user_tip="请先确认权限编码是否正确，或者联系管理员创建这个权限项。",
            error_code="PERMISSION_NOT_FOUND",
            details={
                "tenant_id": tenant_id,
                "user_id": user_id,
                "permission_code": permission_code,
            },
        )


class ManualCorrectionNeededError(HumanReadableError):
    def __init__(
        self,
        record_id: str,
        reason: str,
        suggested_action: str,
    ):
        super().__init__(
            message=f"记录 {record_id} 需要人工确认：{reason}",
            user_tip=f"建议操作：{suggested_action}。请前往人工确认页面处理。",
            error_code="MANUAL_CORRECTION_NEEDED",
            details={
                "record_id": record_id,
                "reason": reason,
                "suggested_action": suggested_action,
            },
            evidence_reference=record_id,
        )


def format_error_for_user(error: Exception) -> Dict[str, Any]:
    if isinstance(error, HumanReadableError):
        return {
            "success": False,
            "error": error.to_dict(),
            "display": f"⚠️  {error.message}\n💡 提示：{error.user_tip}",
        }
    return {
        "success": False,
        "error": {
            "error_code": "UNKNOWN_ERROR",
            "message": "系统遇到了一个意外问题",
            "user_tip": "请稍后重试，如果问题持续存在，请联系技术支持。",
        },
        "display": "⚠️  系统遇到了一个意外问题\n💡 提示：请稍后重试，如果问题持续存在，请联系技术支持。",
    }
