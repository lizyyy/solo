from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import io

from app.database import engine, get_db, Base
from app import models, schemas, crud
from app.import_service import CSVImportService, MarkdownImportService
from app.report_service import ReportExporter

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="公益书库管理系统",
    description="公益书库志愿者书籍入库管理系统",
    version="1.0.0"
)


@app.post("/books/", response_model=schemas.BookResponse, summary="创建书籍记录")
def create_book(book: schemas.BookCreate, db: Session = Depends(get_db)):
    db_book, exceptions = crud.create_book(db, book)
    return db_book


@app.get("/books/{book_id}", response_model=schemas.BookResponse, summary="获取单本书籍详情")
def get_book(book_id: int, db: Session = Depends(get_db)):
    db_book = crud.get_book(db, book_id)
    if not db_book:
        raise HTTPException(status_code=404, detail="书籍不存在")
    return db_book


@app.get("/books/", summary="查询书籍列表（支持多维度筛选）")
def query_books(
    volunteer: Optional[str] = None,
    status: Optional[models.BookStatus] = None,
    exception_type: Optional[models.ExceptionType] = None,
    grade_level: Optional[models.GradeLevel] = None,
    condition: Optional[models.BookCondition] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    params = schemas.BookQueryParams(
        volunteer=volunteer,
        status=status,
        exception_type=exception_type,
        grade_level=grade_level,
        condition=condition,
        start_date=start_date,
        end_date=end_date
    )
    books, total = crud.query_books(db, params, skip, limit)
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "data": books
    }


@app.put("/books/{book_id}", response_model=schemas.BookResponse, summary="更新书籍信息")
def update_book(book_id: int, book_update: schemas.BookUpdate,
                changed_by: str = Query(..., description="操作人"),
                db: Session = Depends(get_db)):
    db_book = crud.update_book(db, book_id, book_update, changed_by)
    if not db_book:
        raise HTTPException(status_code=404, detail="书籍不存在")
    return db_book


@app.patch("/books/{book_id}/status", response_model=schemas.BookResponse, summary="更新书籍状态")
def update_book_status(book_id: int, new_status: models.BookStatus,
                       changed_by: str = Query(..., description="操作人"),
                       reason: str = Query("", description="变更原因"),
                       db: Session = Depends(get_db)):
    db_book = crud.update_book_status(db, book_id, new_status, changed_by, reason)
    if not db_book:
        raise HTTPException(status_code=404, detail="书籍不存在")
    return db_book


@app.post("/books/batch/status", summary="批量更新书籍状态")
def batch_update_status(book_ids: List[int], new_status: models.BookStatus,
                        changed_by: str = Query(..., description="操作人"),
                        reason: str = Query("", description="变更原因"),
                        db: Session = Depends(get_db)):
    result = crud.batch_update_status(db, book_ids, new_status, changed_by, reason)
    return result


@app.get("/books/{book_id}/history", summary="获取书籍状态变更历史")
def get_book_history(book_id: int, db: Session = Depends(get_db)):
    return crud.get_status_history(db, book_id)


@app.post("/books/{book_id}/exceptions", summary="为书籍添加异常记录")
def add_book_exception(book_id: int, exception: schemas.BookExceptionCreate,
                       db: Session = Depends(get_db)):
    exception.book_id = book_id
    return crud.add_book_exception(db, exception)


@app.get("/books/{book_id}/exceptions", summary="获取书籍的异常记录")
def get_book_exceptions(book_id: int, db: Session = Depends(get_db)):
    return crud.get_book_exceptions(db, book_id)


@app.patch("/exceptions/{exception_id}/resolve", summary="标记异常为已解决")
def resolve_exception(exception_id: int, resolved_by: str = Query(..., description="处理人"),
                      db: Session = Depends(get_db)):
    exc = crud.resolve_exception(db, exception_id, resolved_by)
    if not exc:
        raise HTTPException(status_code=404, detail="异常记录不存在")
    return exc


@app.post("/import/csv", summary="导入扫码CSV文件")
def import_csv(file: UploadFile = File(...),
               imported_by: str = Query(..., description="导入人"),
               db: Session = Depends(get_db)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="只支持CSV文件")
    content = file.file.read()
    result = CSVImportService.import_from_file(db, content, file.filename, imported_by)
    return result


@app.post("/import/markdown", summary="导入Markdown人工备注")
def import_markdown(file: UploadFile = File(...),
                    imported_by: str = Query(..., description="导入人"),
                    db: Session = Depends(get_db)):
    if not file.filename.endswith(('.md', '.markdown', '.txt')):
        raise HTTPException(status_code=400, detail="只支持Markdown或文本文件")
    content = file.file.read()
    result = MarkdownImportService.import_from_file(db, content, file.filename, imported_by)
    return result


@app.get("/import/logs", summary="获取导入日志列表")
def get_import_logs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_import_logs(db, skip, limit)


@app.get("/import/logs/{log_id}", summary="获取单次导入详情（含坏记录）")
def get_import_log(log_id: int, db: Session = Depends(get_db)):
    log = crud.get_import_log(db, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="导入日志不存在")
    return log


@app.get("/bad-records", summary="获取坏记录列表")
def get_bad_records(import_log_id: Optional[int] = None,
                    unresolved_only: bool = False,
                    skip: int = 0, limit: int = 100,
                    db: Session = Depends(get_db)):
    records, total = crud.get_bad_records(db, import_log_id, unresolved_only, skip, limit)
    return {
        "total": total,
        "data": records
    }


@app.post("/bad-records/{record_id}/retry", summary="重试导入坏记录")
def retry_bad_record(record_id: int, book_data: schemas.BookCreate,
                     db: Session = Depends(get_db)):
    book, result = crud.retry_bad_record(db, record_id, book_data)
    if not book:
        raise HTTPException(status_code=400, detail=result.get("error", "重试失败"))
    return {
        "book": book,
        "warnings": result.get("exceptions", [])
    }


@app.get("/export/books/excel", summary="导出书籍清单为Excel（与查询结果一致）")
def export_books_excel(
    volunteer: Optional[str] = None,
    status: Optional[models.BookStatus] = None,
    exception_type: Optional[models.ExceptionType] = None,
    grade_level: Optional[models.GradeLevel] = None,
    condition: Optional[models.BookCondition] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    params = schemas.BookQueryParams(
        volunteer=volunteer,
        status=status,
        exception_type=exception_type,
        grade_level=grade_level,
        condition=condition,
        start_date=start_date,
        end_date=end_date
    )
    books, _ = crud.query_books(db, params, 0, 10000)
    excel_data = ReportExporter.export_to_excel(db, books, params)

    filename = f"书籍清单_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    return StreamingResponse(
        io.BytesIO(excel_data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/export/books/csv", summary="导出书籍清单为CSV")
def export_books_csv(
    volunteer: Optional[str] = None,
    status: Optional[models.BookStatus] = None,
    exception_type: Optional[models.ExceptionType] = None,
    grade_level: Optional[models.GradeLevel] = None,
    condition: Optional[models.BookCondition] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    params = schemas.BookQueryParams(
        volunteer=volunteer,
        status=status,
        exception_type=exception_type,
        grade_level=grade_level,
        condition=condition,
        start_date=start_date,
        end_date=end_date
    )
    books, _ = crud.query_books(db, params, 0, 10000)
    csv_data = ReportExporter.export_to_csv(db, books)

    filename = f"书籍清单_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"
    return StreamingResponse(
        io.BytesIO(csv_data),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/report/monthly/summary", summary="获取月度复盘统计摘要")
def get_monthly_summary(year: int, month: int, db: Session = Depends(get_db)):
    return ReportExporter.generate_monthly_summary(db, year, month)


@app.get("/report/monthly/excel", summary="导出月度复盘报告Excel")
def export_monthly_report(year: int, month: int, db: Session = Depends(get_db)):
    excel_data = ReportExporter.export_monthly_report(db, year, month)
    filename = f"月度复盘报告_{year}年{month}月_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    return StreamingResponse(
        io.BytesIO(excel_data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/export/bad-records/excel", summary="导出坏记录Excel")
def export_bad_records(import_log_id: Optional[int] = None,
                       unresolved_only: bool = False,
                       db: Session = Depends(get_db)):
    records, _ = crud.get_bad_records(db, import_log_id, unresolved_only, 0, 10000)
    excel_data = ReportExporter.export_bad_records(db, records)
    filename = f"导入失败记录_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    return StreamingResponse(
        io.BytesIO(excel_data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/", summary="系统状态")
def root():
    return {
        "service": "公益书库管理系统",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "api_docs": "/redoc"
    }
