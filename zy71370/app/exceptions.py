from typing import Optional, Any, Dict
from fastapi import Request, status
from fastapi.responses import JSONResponse


class PaintStudioException(Exception):
    error_code: str = "PAINT_STUDIO_ERROR"
    status_code: int = status.HTTP_400_BAD_REQUEST
    message: str = "系统处理异常"

    def __init__(
        self,
        message: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        fix_suggestion: Optional[str] = None
    ):
        self.message = message or self.message
        self.details = details or {}
        self.fix_suggestion = fix_suggestion
        super().__init__(self.message)


class PaintNotFoundException(PaintStudioException):
    error_code = "PAINT_NOT_FOUND"
    status_code = status.HTTP_404_NOT_FOUND
    message = "颜料不存在"

    def __init__(self, paint_id: int):
        super().__init__(
            message=f"ID为 {paint_id} 的颜料不存在",
            details={"paint_id": paint_id},
            fix_suggestion="请检查颜料ID是否正确，或在颜料库存中添加该颜料"
        )


class StudentNotFoundException(PaintStudioException):
    error_code = "STUDENT_NOT_FOUND"
    status_code = status.HTTP_404_NOT_FOUND
    message = "学生不存在"

    def __init__(self, student_id: int):
        super().__init__(
            message=f"ID为 {student_id} 的学生不存在",
            details={"student_id": student_id},
            fix_suggestion="请检查学生ID是否正确，或在学生名单中添加该学生"
        )


class OutOfStockException(PaintStudioException):
    error_code = "OUT_OF_STOCK"
    status_code = status.HTTP_409_CONFLICT
    message = "库存不足"

    def __init__(
        self,
        paint_id: int,
        paint_name: str,
        requested: int,
        available: int,
        no_substitutes: bool = False
    ):
        details = {
            "paint_id": paint_id,
            "paint_name": paint_name,
            "requested_quantity": requested,
            "available_quantity": available,
            "shortage": requested - available
        }
        if no_substitutes:
            message = f"颜料 [{paint_name}] 库存不足（仅剩 {available} 件，需要 {requested} 件），且未找到合适的替代品"
            fix_suggestion = "尝试放宽色差限制，或联系供应商补货"
        else:
            message = f"颜料 [{paint_name}] 库存不足：仅剩 {available} 件，需要 {requested} 件"
            fix_suggestion = "可以开启自动替代功能，系统会推荐色差接近的其他颜料"
        super().__init__(message=message, details=details, fix_suggestion=fix_suggestion)


class InsufficientBudgetException(PaintStudioException):
    error_code = "INSUFFICIENT_BUDGET"
    status_code = status.HTTP_402_PAYMENT_REQUIRED
    message = "预算不足"

    def __init__(
        self,
        student_id: int,
        student_name: str,
        required: float,
        remaining: float
    ):
        super().__init__(
            message=f"学生 [{student_name}] 预算不足：需要 ¥{required:.2f}，剩余 ¥{remaining:.2f}",
            details={
                "student_id": student_id,
                "student_name": student_name,
                "required_amount": required,
                "remaining_budget": remaining,
                "shortage": required - remaining
            },
            fix_suggestion="可以调整采购数量，或申请增加学生预算额度"
        )


class ColorDifferenceTooLargeException(PaintStudioException):
    error_code = "COLOR_DIFFERENCE_TOO_LARGE"
    status_code = status.HTTP_400_BAD_REQUEST
    message = "色差过大"

    def __init__(
        self,
        original_name: str,
        substitute_name: str,
        difference: float,
        max_allowed: float
    ):
        super().__init__(
            message=f"替代颜料 [{substitute_name}] 与原颜料 [{original_name}] 的色差 ({difference:.2f}) 超过最大允许值 ({max_allowed})",
            details={
                "original_paint": original_name,
                "substitute_paint": substitute_name,
                "actual_difference": difference,
                "max_allowed_difference": max_allowed,
                "exceeded_by": difference - max_allowed
            },
            fix_suggestion="可以调大最大允许色差参数，或手动选择其他替代颜料"
        )


class DuplicateInventoryException(PaintStudioException):
    error_code = "DUPLICATE_INVENTORY"
    status_code = status.HTTP_409_CONFLICT
    message = "库存记录重复"

    def __init__(
        self,
        paint_name: str,
        brand: str,
        existing_id: int,
        duplicate_id: Optional[int] = None
    ):
        super().__init__(
            message=f"颜料 [{paint_name} ({brand})] 已存在重复记录",
            details={
                "paint_name": paint_name,
                "brand": brand,
                "existing_record_id": existing_id,
                "duplicate_record_id": duplicate_id
            },
            fix_suggestion="合并两条记录的库存数量，删除其中一条重复记录"
        )


class InvalidColorValueException(PaintStudioException):
    error_code = "INVALID_COLOR_VALUE"
    status_code = status.HTTP_400_BAD_REQUEST
    message = "色值无效"

    def __init__(
        self,
        paint_name: str,
        l_value: Optional[float] = None,
        a_value: Optional[float] = None,
        b_value: Optional[float] = None
    ):
        invalid_fields = []
        if l_value is not None and (l_value < 0 or l_value > 100):
            invalid_fields.append(f"L={l_value}")
        if a_value is not None and (a_value < -128 or a_value > 127):
            invalid_fields.append(f"a={a_value}")
        if b_value is not None and (b_value < -128 or b_value > 127):
            invalid_fields.append(f"b={b_value}")

        super().__init__(
            message=f"颜料 [{paint_name}] 的LAB色值无效: {', '.join(invalid_fields)}",
            details={
                "paint_name": paint_name,
                "l_value": l_value,
                "a_value": a_value,
                "b_value": b_value,
                "valid_ranges": "L: 0-100, a: -128~127, b: -128~127"
            },
            fix_suggestion="使用取色器重新测量该颜料的LAB色值，确保在有效范围内"
        )


class NegativeStockException(PaintStudioException):
    error_code = "NEGATIVE_STOCK"
    status_code = status.HTTP_400_BAD_REQUEST
    message = "库存为负"

    def __init__(self, paint_name: str, stock: int):
        super().__init__(
            message=f"颜料 [{paint_name}] 的库存为负数: {stock}",
            details={
                "paint_name": paint_name,
                "current_stock": stock
            },
            fix_suggestion="盘点实际库存数量，修正数据库中的库存值，可能存在未记录的出库操作"
        )


class ReportGenerationException(PaintStudioException):
    error_code = "REPORT_GENERATION_FAILED"
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    message = "报告生成失败"

    def __init__(self, report_type: str, error_detail: str):
        super().__init__(
            message=f"生成 {report_type} 类型报告时失败: {error_detail}",
            details={
                "report_type": report_type,
                "error_detail": error_detail
            },
            fix_suggestion="请检查报告参数是否正确，或稍后重试"
        )


async def paint_studio_exception_handler(request: Request, exc: PaintStudioException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error_code": exc.error_code,
            "message": exc.message,
            "details": exc.details,
            "fix_suggestion": exc.fix_suggestion
        }
    )


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error_code": "UNKNOWN_ERROR",
            "message": f"系统发生未预期的错误: {str(exc)}",
            "details": {"exception_type": type(exc).__name__},
            "fix_suggestion": "请记录错误信息并联系技术支持"
        }
    )
