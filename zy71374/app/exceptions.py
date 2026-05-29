from fastapi import HTTPException
from typing import Any, Optional


class AnomalyError(HTTPException):
    def __init__(
        self,
        status_code: int,
        category: str,
        message: str,
        detail: Optional[dict] = None,
        suggestion: Optional[str] = None,
    ):
        self.category = category
        self.suggestion = suggestion
        body: dict[str, Any] = {
            "category": category,
            "message": message,
        }
        if detail:
            body["detail"] = detail
        if suggestion:
            body["suggestion"] = suggestion
        super().__init__(status_code=status_code, detail=body)


class KilnGapError(AnomalyError):
    def __init__(self, message: str, detail: Optional[dict] = None):
        super().__init__(
            status_code=422,
            category="kiln_gap",
            message=message,
            detail=detail,
            suggestion="补全缺失温度段数据后重新提交，或在备注中说明缺段原因",
        )


class FormulaDuplicateError(AnomalyError):
    def __init__(self, message: str, detail: Optional[dict] = None):
        super().__init__(
            status_code=409,
            category="formula_duplicate",
            message=message,
            detail=detail,
            suggestion="确认是否为有意重复配方；如为新版本请使用 POST /formulas/{id}/fork 创建派生版本",
        )


class PhotoMismatchError(AnomalyError):
    def __init__(self, message: str, detail: Optional[dict] = None):
        super().__init__(
            status_code=422,
            category="photo_mismatch",
            message=message,
            detail=detail,
            suggestion="检查照片标注的实验编号是否与实际一致；如需重新关联请使用 PATCH /photos/{id}",
        )
