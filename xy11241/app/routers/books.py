from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from .. import schemas, crud
from ..utils import mask_sensitive_fields, logger

router = APIRouter()


@router.post("/", response_model=schemas.BookWithReason, summary="新增单本书籍")
def create_book(book: schemas.BookCreate, db: Session = Depends(get_db)):
    db_book, reason, action, is_duplicate = crud.create_book(db, book)
    if db_book is None:
        raise HTTPException(status_code=400, detail=reason)
    
    book_data = schemas.Book.model_validate(db_book)
    masked_book = mask_sensitive_fields(book_data.model_dump())
    
    return {
        "book": masked_book,
        "success": True,
        "reason": reason,
        "action": action,
        "is_duplicate": is_duplicate
    }


@router.get("/", response_model=List[schemas.Book], summary="获取书籍列表")
def read_books(
    skip: int = 0,
    limit: int = 100,
    grade: Optional[str] = None,
    condition: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    books = crud.get_books(db, skip=skip, limit=limit, grade=grade, condition=condition, status=status)
    masked_books = [mask_sensitive_fields(schemas.Book.model_validate(book).model_dump()) for book in books]
    return masked_books


@router.get("/{book_id}", response_model=schemas.Book, summary="获取单本书籍详情")
def read_book(book_id: int, db: Session = Depends(get_db)):
    db_book = crud.get_book(db, book_id)
    if db_book is None:
        raise HTTPException(status_code=404, detail="书籍不存在")
    
    masked_book = mask_sensitive_fields(schemas.Book.model_validate(db_book).model_dump())
    return masked_book


@router.put("/{book_id}", response_model=schemas.Book, summary="更新书籍信息")
def update_book(book_id: int, book_update: schemas.BookUpdate, db: Session = Depends(get_db)):
    db_book = crud.update_book(db, book_id, book_update)
    if db_book is None:
        raise HTTPException(status_code=404, detail="书籍不存在")
    
    masked_book = mask_sensitive_fields(schemas.Book.model_validate(db_book).model_dump())
    return masked_book


@router.delete("/{book_id}", response_model=schemas.ApiResponse, summary="删除书籍")
def delete_book(book_id: int, db: Session = Depends(get_db)):
    success = crud.delete_book(db, book_id)
    if not success:
        raise HTTPException(status_code=404, detail="书籍不存在")
    return {"success": True, "message": "删除成功", "data": None}


@router.post("/batch-import", response_model=schemas.BatchImportResponse, summary="批量导入书籍")
def batch_import_books(request: schemas.BatchImportRequest, db: Session = Depends(get_db)):
    batch_no, results = crud.batch_import_books(
        db, 
        request.books, 
        request.operator_name, 
        request.operator_phone
    )
    
    formatted_results = []
    for result in results:
        book_data = None
        if result["book"]:
            book_data = schemas.Book.model_validate(result["book"])
            book_data = mask_sensitive_fields(book_data.model_dump())
        
        formatted_results.append(schemas.BookWithReason(
            book=book_data,
            success=result["success"],
            reason=result["reason"],
            action=result["action"],
            is_duplicate=result["is_duplicate"],
            row_number=result["row_number"]
        ))
    
    success_count = sum(1 for r in formatted_results if r.success)
    failed_count = len(formatted_results) - success_count
    
    return {
        "batch_no": batch_no,
        "total_count": len(formatted_results),
        "success_count": success_count,
        "failed_count": failed_count,
        "results": formatted_results,
        "status": "已完成" if failed_count == 0 else "部分完成"
    }


@router.get("/import/batches", response_model=List[schemas.ImportBatchBase], summary="获取导入批次列表")
def get_import_batches(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    batches = crud.get_import_batches(db, skip=skip, limit=limit)
    masked_batches = [mask_sensitive_fields(schemas.ImportBatchBase.model_validate(batch).model_dump()) for batch in batches]
    return masked_batches


@router.get("/import/batches/{batch_no}", response_model=schemas.ImportBatchDetail, summary="获取导入批次详情")
def get_import_batch_detail(batch_no: str, db: Session = Depends(get_db)):
    batch = crud.get_import_batch(db, batch_no)
    if batch is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    records = crud.get_batch_records(db, batch.id)
    
    result = schemas.ImportBatchDetail(
        **schemas.ImportBatchBase.model_validate(batch).model_dump(),
        records=[schemas.ImportRecordBase.model_validate(r) for r in records]
    )
    
    return mask_sensitive_fields(result.model_dump())


@router.get("/statistics/overview", response_model=schemas.StatisticsResponse, summary="获取统计概览")
def get_statistics(db: Session = Depends(get_db)):
    stats = crud.get_statistics(db)
    return stats


@router.get("/shelf/list", summary="生成上架清单")
def get_shelf_list(
    grade: Optional[str] = None,
    condition: Optional[str] = None,
    status: str = "待上架",
    db: Session = Depends(get_db)
):
    books = crud.get_books(db, grade=grade, condition=condition, status=status)
    
    shelf_list = []
    for book in books:
        shelf_list.append({
            "id": book.id,
            "isbn": book.isbn,
            "title": book.title,
            "author": book.author,
            "condition": book.condition,
            "grade": book.grade,
            "book_count": book.book_count,
            "status": book.status
        })
    
    return {
        "total_items": len(shelf_list),
        "total_books": sum(item["book_count"] for item in shelf_list),
        "items": shelf_list
    }
