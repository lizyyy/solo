from typing import List, Optional, Tuple, Dict
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime
import uuid

from . import models, schemas
from .utils import (
    logger, normalize_isbn, is_valid_isbn, 
    validate_grade, validate_condition,
    mask_sensitive_fields
)


def find_duplicate_book(
    db: Session,
    isbn_normalized: Optional[str],
    title: str,
    condition: str,
    grade: str
) -> Optional[models.Book]:
    if isbn_normalized:
        book = db.query(models.Book).filter(
            and_(
                models.Book.isbn_normalized == isbn_normalized,
                models.Book.condition == condition,
                models.Book.grade == grade
            )
        ).first()
        if book:
            return book
    
    book = db.query(models.Book).filter(
        and_(
            models.Book.title == title,
            models.Book.condition == condition,
            models.Book.grade == grade
        )
    ).first()
    return book


def create_book(db: Session, book: schemas.BookCreate) -> Tuple[models.Book, str, str, bool]:
    isbn_normalized = normalize_isbn(book.isbn) if book.isbn else None
    
    if book.isbn:
        if not is_valid_isbn(book.isbn):
            return None, "ISBN格式无效", "拒绝", False
    else:
        logger.info("书籍无ISBN，使用标题+品相+年级作为唯一标识")
    
    valid, msg = validate_condition(book.condition)
    if not valid:
        return None, msg, "拒绝", False
    
    valid, msg = validate_grade(book.grade)
    if not valid:
        return None, msg, "拒绝", False
    
    duplicate = find_duplicate_book(db, isbn_normalized, book.title, book.condition, book.grade)
    
    if duplicate:
        old_count = duplicate.book_count
        duplicate.book_count += book.book_count
        duplicate.updated_at = datetime.now()
        db.commit()
        db.refresh(duplicate)
        logger.info(f"重复书籍，数量累加: {book.title} ISBN:{book.isbn} 原数量:{old_count} 新数量:{duplicate.book_count}")
        return duplicate, f"重复书籍，数量已累加 (从{old_count}增加到{duplicate.book_count})", "数量累加", True
    
    db_book = models.Book(
        isbn=book.isbn,
        isbn_normalized=isbn_normalized,
        title=book.title,
        author=book.author,
        publisher=book.publisher,
        condition=book.condition,
        grade=book.grade,
        book_count=book.book_count,
        donor_name=book.donor_name,
        donor_phone=book.donor_phone,
        donor_idcard=book.donor_idcard,
        remarks=book.remarks,
        status=book.status
    )
    db.add(db_book)
    db.commit()
    db.refresh(db_book)
    
    log_data = mask_sensitive_fields({
        "title": book.title,
        "isbn": book.isbn,
        "condition": book.condition,
        "grade": book.grade,
        "donor_phone": book.donor_phone,
        "donor_idcard": book.donor_idcard
    })
    logger.info(f"新书入库: {log_data}")
    
    return db_book, "入库成功", "新增", False


def create_book_single(db: Session, book: schemas.BookCreate) -> Tuple[models.Book, str, str, bool]:
    valid, msg = validate_condition(book.condition)
    if not valid:
        return None, msg, "拒绝", False
    
    valid, msg = validate_grade(book.grade)
    if not valid:
        return None, msg, "拒绝", False
    
    return create_book(db, book)


def get_book(db: Session, book_id: int) -> Optional[models.Book]:
    return db.query(models.Book).filter(models.Book.id == book_id).first()


def get_books(
    db: Session, 
    skip: int = 0, 
    limit: int = 100,
    grade: Optional[str] = None,
    condition: Optional[str] = None,
    status: Optional[str] = None
) -> List[models.Book]:
    query = db.query(models.Book)
    
    if grade:
        query = query.filter(models.Book.grade == grade)
    if condition:
        query = query.filter(models.Book.condition == condition)
    if status:
        query = query.filter(models.Book.status == status)
    
    return query.offset(skip).limit(limit).all()


def update_book(db: Session, book_id: int, book_update: schemas.BookUpdate) -> Optional[models.Book]:
    db_book = get_book(db, book_id)
    if not db_book:
        return None
    
    update_data = book_update.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(db_book, key, value)
    
    db.commit()
    db.refresh(db_book)
    
    log_data = mask_sensitive_fields({
        "book_id": book_id,
        "changes": update_data
    })
    logger.info(f"书籍信息更新: {log_data}")
    
    return db_book


def delete_book(db: Session, book_id: int) -> bool:
    db_book = get_book(db, book_id)
    if not db_book:
        return False
    
    db.delete(db_book)
    db.commit()
    logger.info(f"书籍删除: book_id={book_id}")
    return True


def batch_import_books(
    db: Session, 
    books: List[schemas.BookCreate],
    operator_name: Optional[str] = None,
    operator_phone: Optional[str] = None
) -> Tuple[str, List[Dict]]:
    batch_no = f"BATCH-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"
    
    batch = models.ImportBatch(
        batch_no=batch_no,
        total_count=len(books),
        success_count=0,
        failed_count=0,
        operator_name=operator_name,
        operator_phone=operator_phone,
        status="处理中"
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    
    results = []
    success_count = 0
    failed_count = 0
    
    for idx, book_data in enumerate(books, 1):
        try:
            db_book, reason, action, is_duplicate = create_book(db, book_data)
            
            is_success = db_book is not None
            if is_success:
                success_count += 1
            else:
                failed_count += 1
            
            record = models.ImportRecord(
                batch_id=batch.id,
                book_id=db_book.id if db_book else None,
                row_number=idx,
                is_success=is_success,
                is_duplicate=is_duplicate,
                action_taken=action,
                reason=reason,
                isbn=book_data.isbn,
                title=book_data.title,
                condition=book_data.condition,
                grade=book_data.grade
            )
            db.add(record)
            
            results.append({
                "row_number": idx,
                "book": schemas.Book.model_validate(db_book) if db_book else None,
                "success": is_success,
                "reason": reason,
                "action": action,
                "is_duplicate": is_duplicate
            })
            
        except Exception as e:
            failed_count += 1
            error_msg = str(e)
            
            record = models.ImportRecord(
                batch_id=batch.id,
                row_number=idx,
                is_success=False,
                is_duplicate=False,
                action_taken="异常",
                reason=error_msg,
                isbn=book_data.isbn,
                title=book_data.title,
                condition=book_data.condition,
                grade=book_data.grade
            )
            db.add(record)
            
            results.append({
                "row_number": idx,
                "book": None,
                "success": False,
                "reason": f"处理异常: {error_msg}",
                "action": "异常",
                "is_duplicate": False
            })
    
    batch.success_count = success_count
    batch.failed_count = failed_count
    batch.status = "已完成" if failed_count == 0 else "部分完成"
    batch.completed_at = datetime.now()
    db.commit()
    
    log_data = mask_sensitive_fields({
        "batch_no": batch_no,
        "total": len(books),
        "success": success_count,
        "failed": failed_count,
        "operator_phone": operator_phone
    })
    logger.info(f"批量导入完成: {log_data}")
    
    return batch_no, results


def get_import_batch(db: Session, batch_no: str) -> Optional[models.ImportBatch]:
    return db.query(models.ImportBatch).filter(models.ImportBatch.batch_no == batch_no).first()


def get_import_batches(db: Session, skip: int = 0, limit: int = 100) -> List[models.ImportBatch]:
    return db.query(models.ImportBatch).order_by(models.ImportBatch.created_at.desc()).offset(skip).limit(limit).all()


def get_batch_records(db: Session, batch_id: int) -> List[models.ImportRecord]:
    return db.query(models.ImportRecord).filter(models.ImportRecord.batch_id == batch_id).all()


def log_operation(
    db: Session,
    operation_type: str,
    operator_name: Optional[str] = None,
    operator_phone: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    change_reason: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
):
    log = models.OperationLog(
        operation_type=operation_type,
        operator_name=operator_name,
        operator_phone=operator_phone,
        target_type=target_type,
        target_id=target_id,
        old_value=old_value,
        new_value=new_value,
        change_reason=change_reason,
        ip_address=ip_address,
        user_agent=user_agent
    )
    db.add(log)
    db.commit()
    return log


def get_statistics(db: Session) -> Dict:
    total_books = db.query(func.sum(models.Book.book_count)).scalar() or 0
    total_unique_books = db.query(func.count(models.Book.id)).scalar() or 0
    
    by_grade = db.query(
        models.Book.grade,
        func.sum(models.Book.book_count)
    ).group_by(models.Book.grade).all()
    
    by_condition = db.query(
        models.Book.condition,
        func.sum(models.Book.book_count)
    ).group_by(models.Book.condition).all()
    
    by_status = db.query(
        models.Book.status,
        func.sum(models.Book.book_count)
    ).group_by(models.Book.status).all()
    
    return {
        "total_books": total_books,
        "total_unique_books": total_unique_books,
        "by_grade": {g: c for g, c in by_grade},
        "by_condition": {c: cnt for c, cnt in by_condition},
        "by_status": {s: c for s, c in by_status}
    }
