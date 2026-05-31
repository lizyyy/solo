from datetime import date
from typing import Optional
import traceback
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, status
from fastapi.responses import Response, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import ValidationError

from database import engine, Base, get_db
import models
import crud
from schemas import (
    MealRecordCreate,
    MealRecordUpdate,
    MealRecordResponse,
    BatchPredictionRequest,
    BatchResponse,
    ReviewRequest,
    CorrectionRequest,
    ExportRequest,
    HistoryQuery,
    PaginatedResponse,
    ErrorResponse,
)
from utils import FriendlyHTTPException, get_user_friendly_message, validate_date_range

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="食堂备餐预测 API",
    description="食堂备餐预测系统后端接口，支持导入、预测、复核、修正、历史查询和导出功能",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(FriendlyHTTPException)
async def friendly_http_exception_handler(request, exc: FriendlyHTTPException):
    """处理自定义的友好异常"""
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict(),
    )


@app.exception_handler(ValidationError)
async def validation_exception_handler(request, exc: ValidationError):
    """处理Pydantic验证错误"""
    user_msg = get_user_friendly_message(exc)
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error_code": "VALIDATION_ERROR",
            "error_message": str(exc),
            "user_friendly_message": user_msg,
            "details": {"errors": exc.errors()},
            "timestamp": date.today().isoformat(),
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc: Exception):
    """处理所有未捕获的异常"""
    traceback.print_exc()
    user_msg = get_user_friendly_message(exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error_code": "INTERNAL_ERROR",
            "error_message": str(exc),
            "user_friendly_message": user_msg,
            "details": {},
            "timestamp": date.today().isoformat(),
        },
    )


@app.on_event("startup")
def startup_event():
    db = next(get_db())
    crud.init_default_configs(db)


@app.get("/api/health")
def health_check():
    """健康检查"""
    return {"status": "ok", "message": "食堂备餐预测系统运行正常"}


@app.post("/api/records", response_model=MealRecordResponse)
def create_record(record: MealRecordCreate, db: Session = Depends(get_db)):
    """新增单条备餐记录"""
    return crud.create_meal_record(db, record)


@app.get("/api/records", response_model=PaginatedResponse)
def list_records(
    page: int = 1,
    page_size: int = 20,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    meal_type: Optional[str] = None,
    is_reviewed: Optional[bool] = None,
    is_corrected: Optional[bool] = None,
    keyword: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """查询备餐记录列表，支持分页和筛选"""
    if start_date and end_date:
        validate_date_range(start_date, end_date)

    records, total = crud.get_meal_records(
        db, page, page_size, start_date, end_date,
        meal_type, is_reviewed, is_corrected, keyword
    )
    total_pages = (total + page_size - 1) // page_size
    return {
        "items": records,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@app.get("/api/records/{record_id}", response_model=MealRecordResponse)
def get_record(record_id: int, db: Session = Depends(get_db)):
    """获取单条备餐记录详情"""
    record = crud.get_meal_record(db, record_id)
    if not record:
        raise FriendlyHTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="RECORD_NOT_FOUND",
            error_message=f"Record {record_id} not found",
            user_friendly_message="找不到这条记录，可能已被删除，请刷新页面后重试",
        )
    return record


@app.put("/api/records/{record_id}", response_model=MealRecordResponse)
def update_record(record_id: int, update_data: MealRecordUpdate, db: Session = Depends(get_db)):
    """更新备餐记录"""
    return crud.update_meal_record(db, record_id, update_data)


@app.post("/api/records/review")
def review_records(request: ReviewRequest, db: Session = Depends(get_db)):
    """批量复核记录"""
    updated = crud.review_records(db, request.record_ids, request.reviewed_by)
    return {
        "success": True,
        "updated_count": updated,
        "message": f"成功复核 {updated} 条记录",
    }


@app.post("/api/records/correct", response_model=MealRecordResponse)
def correct_record(request: CorrectionRequest, db: Session = Depends(get_db)):
    """修正单条记录（带日志）"""
    return crud.correct_record(
        db,
        request.record_id,
        request.field_name,
        request.new_value,
        request.reason,
        request.corrected_by,
    )


@app.post("/api/import")
async def import_records(
    file: UploadFile = File(...),
    imported_by: str = "系统管理员",
    db: Session = Depends(get_db),
):
    """从Excel/CSV文件导入备餐记录"""
    if not file.filename:
        raise FriendlyHTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="EMPTY_FILENAME",
            error_message="No filename provided",
            user_friendly_message="请选择要导入的文件",
        )

    allowed_extensions = ['.xlsx', '.xls', '.csv']
    if not any(file.filename.lower().endswith(ext) for ext in allowed_extensions):
        raise FriendlyHTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="INVALID_FILE_TYPE",
            error_message=f"Invalid file type: {file.filename}",
            user_friendly_message=f"不支持的文件格式，请上传 Excel（.xlsx/.xls）或 CSV 文件",
            details={"allowed_types": allowed_extensions},
        )

    try:
        content = await file.read()
        if not content:
            raise FriendlyHTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                error_code="EMPTY_FILE",
                error_message="Uploaded file is empty",
                user_friendly_message="上传的文件是空的，请检查文件内容后重试",
            )

        result = crud.import_from_file(db, content, file.filename, imported_by)
        return result

    except FriendlyHTTPException:
        raise
    except Exception as e:
        raise FriendlyHTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="IMPORT_FAILED",
            error_message=str(e),
            user_friendly_message=get_user_friendly_message(e),
        )


@app.post("/api/predict", response_model=BatchResponse)
def predict(request: BatchPredictionRequest, db: Session = Depends(get_db)):
    """批量生成备餐预测"""
    validate_date_range(request.start_date, request.end_date)
    result = crud.batch_predict(db, request, created_by=request.model_version or "系统")
    return result


@app.post("/api/export")
def export_records(request: ExportRequest, db: Session = Depends(get_db)):
    """导出备餐数据为Excel或CSV"""
    if request.start_date and request.end_date:
        validate_date_range(request.start_date, request.end_date)

    content, filename, mime_type = crud.export_data(
        db,
        start_date=request.start_date,
        end_date=request.end_date,
        meal_types=request.meal_types,
        categories=request.categories,
        include_model_info=request.include_model_info,
        format=request.format,
    )

    return Response(
        content=content,
        media_type=mime_type,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{filename}",
            "X-Filename": filename,
            "X-Record-Count": str(len(content)),
        },
    )


@app.get("/api/history/predictions")
def get_prediction_history(page: int = 1, page_size: int = 20, db: Session = Depends(get_db)):
    """获取预测批处理历史记录"""
    batches, total = crud.get_prediction_history(db, page, page_size)
    total_pages = (total + page_size - 1) // page_size
    return {
        "items": [
            {
                "id": b.id,
                "batch_id": b.batch_id,
                "batch_name": b.batch_name,
                "start_date": b.start_date.isoformat() if b.start_date else None,
                "end_date": b.end_date.isoformat() if b.end_date else None,
                "model_version": b.model_version,
                "status": b.status,
                "total_records": b.total_records,
                "created_by": b.created_by,
                "created_at": b.created_at.isoformat() if b.created_at else None,
                "completed_at": b.completed_at.isoformat() if b.completed_at else None,
            }
            for b in batches
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@app.get("/api/history/imports")
def get_import_history(page: int = 1, page_size: int = 20, db: Session = Depends(get_db)):
    """获取文件导入历史记录"""
    history, total = crud.get_import_history(db, page, page_size)
    total_pages = (total + page_size - 1) // page_size
    return {
        "items": [
            {
                "id": h.id,
                "import_id": h.import_id,
                "file_name": h.file_name,
                "file_type": h.file_type,
                "total_rows": h.total_rows,
                "success_rows": h.success_rows,
                "failed_rows": h.failed_rows,
                "status": h.status,
                "imported_by": h.imported_by,
                "imported_at": h.imported_at.isoformat() if h.imported_at else None,
            }
            for h in history
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@app.get("/api/history/corrections")
def get_correction_history(
    record_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
):
    """获取修正历史日志"""
    logs, total = crud.get_correction_logs(db, record_id, page, page_size)
    total_pages = (total + page_size - 1) // page_size
    return {
        "items": [
            {
                "id": l.id,
                "record_id": l.record_id,
                "field_name": l.field_name,
                "old_value": l.old_value,
                "new_value": l.new_value,
                "reason": l.reason,
                "corrected_by": l.corrected_by,
                "corrected_at": l.corrected_at.isoformat() if l.corrected_at else None,
            }
            for l in logs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@app.get("/api/model/info")
def get_model_info(db: Session = Depends(get_db)):
    """获取预测模型说明信息"""
    return crud.get_model_info(db)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
