from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional, Tuple
from datetime import datetime
import uuid

from app.models import (
    Book, BookStatus, BookException, ExceptionType,
    StatusHistory, ImportLog, BadRecord, ImportSource
)
from app.schemas import (
    BookCreate, BookUpdate, BookQueryParams,
    BookExceptionCreate, StatusHistoryCreate,
    BadRecordCreate, ImportLogCreate, ISBNValidator
)


def create_book(db: Session, book: BookCreate, import_source: Optional[ImportSource] = None,
                import_batch_id: Optional[str] = None) -> Tuple[Book, List[dict]]:
    exceptions = []
    db_book = Book(**book.dict(), import_source=import_source, import_batch_id=import_batch_id)

    if book.isbn and not ISBNValidator.validate(book.isbn):
        exceptions.append({
            "type": ExceptionType.INVALID_ISBN,
            "description": f"ISBN格式校验失败: {book.isbn}",
            "suggestion": "请检查ISBN是否为10位或13位有效格式，确保校验位正确"
        })
        db_book.status = BookStatus.EXCEPTION

    if not book.title:
        exceptions.append({
            "type": ExceptionType.MISSING_INFO,
            "description": "书名不能为空",
            "suggestion": "请补充书籍名称"
        })
        db_book.status = BookStatus.EXCEPTION

    db.add(db_book)
    db.flush()

    for exc in exceptions:
        db_exc = BookException(
            book_id=db_book.id,
            exception_type=exc["type"],
            description=exc["description"],
            suggestion=exc["suggestion"]
        )
        db.add(db_exc)

    if exceptions:
        add_status_history(db, db_book.id, None, db_book.status, "system", "自动校验发现异常")

    db.commit()
    db.refresh(db_book)
    return db_book, exceptions


def get_book(db: Session, book_id: int) -> Optional[Book]:
    return db.query(Book).filter(Book.id == book_id).first()


def get_books(db: Session, skip: int = 0, limit: int = 100) -> List[Book]:
    return db.query(Book).offset(skip).limit(limit).all()


def query_books(db: Session, params: BookQueryParams, skip: int = 0, limit: int = 100) -> Tuple[List[Book], int]:
    query = db.query(Book)

    if params.volunteer:
        query = query.filter(Book.volunteer == params.volunteer)
    if params.status:
        query = query.filter(Book.status == params.status)
    if params.grade_level:
        query = query.filter(Book.grade_level == params.grade_level)
    if params.condition:
        query = query.filter(Book.condition == params.condition)
    if params.start_date:
        query = query.filter(Book.created_at >= params.start_date)
    if params.end_date:
        query = query.filter(Book.created_at <= params.end_date)
    if params.exception_type:
        query = query.join(BookException).filter(BookException.exception_type == params.exception_type)

    total = query.count()
    books = query.order_by(Book.created_at.desc()).offset(skip).limit(limit).all()
    return books, total


def update_book(db: Session, book_id: int, book_update: BookUpdate, changed_by: str = "system") -> Optional[Book]:
    db_book = get_book(db, book_id)
    if not db_book:
        return None

    old_status = db_book.status
    update_data = book_update.dict(exclude_unset=True)

    for key, value in update_data.items():
        setattr(db_book, key, value)

    if "status" in update_data and update_data["status"] != old_status:
        add_status_history(db, book_id, old_status, update_data["status"], changed_by, "状态更新")

    db.commit()
    db.refresh(db_book)
    return db_book


def update_book_status(db: Session, book_id: int, new_status: BookStatus,
                       changed_by: str, reason: str) -> Optional[Book]:
    db_book = get_book(db, book_id)
    if not db_book:
        return None

    old_status = db_book.status
    db_book.status = new_status
    add_status_history(db, book_id, old_status, new_status, changed_by, reason)
    db.commit()
    db.refresh(db_book)
    return db_book


def batch_update_status(db: Session, book_ids: List[int], new_status: BookStatus,
                        changed_by: str, reason: str) -> dict:
    success_ids = []
    failed_items = []

    for book_id in book_ids:
        try:
            book = update_book_status(db, book_id, new_status, changed_by, reason)
            if book:
                success_ids.append(book_id)
            else:
                failed_items.append({"id": book_id, "reason": "书籍不存在"})
        except Exception as e:
            db.rollback()
            failed_items.append({"id": book_id, "reason": str(e)})

    return {
        "success_count": len(success_ids),
        "failed_count": len(failed_items),
        "successful_ids": success_ids,
        "failed_items": failed_items
    }


def add_status_history(db: Session, book_id: int, old_status: Optional[BookStatus],
                       new_status: BookStatus, changed_by: str, change_reason: str) -> StatusHistory:
    history = StatusHistory(
        book_id=book_id,
        old_status=old_status,
        new_status=new_status,
        changed_by=changed_by,
        change_reason=change_reason
    )
    db.add(history)
    db.flush()
    return history


def get_status_history(db: Session, book_id: int) -> List[StatusHistory]:
    return db.query(StatusHistory).filter(StatusHistory.book_id == book_id).order_by(StatusHistory.changed_at.desc()).all()


def add_book_exception(db: Session, exception: BookExceptionCreate) -> BookException:
    db_exc = BookException(**exception.dict())
    db.add(db_exc)
    db.flush()

    book = get_book(db, exception.book_id)
    if book and book.status != BookStatus.EXCEPTION:
        add_status_history(db, book.id, book.status, BookStatus.EXCEPTION, "system", "发现异常")
        book.status = BookStatus.EXCEPTION

    db.commit()
    db.refresh(db_exc)
    return db_exc


def resolve_exception(db: Session, exception_id: int, resolved_by: str) -> Optional[BookException]:
    db_exc = db.query(BookException).filter(BookException.id == exception_id).first()
    if not db_exc:
        return None

    db_exc.resolved = True
    db_exc.resolved_by = resolved_by
    db_exc.resolved_at = datetime.now()

    book = get_book(db, db_exc.book_id)
    if book:
        unresolved = db.query(BookException).filter(
            BookException.book_id == book.id,
            BookException.resolved == False
        ).count()
        if unresolved == 0 and book.status == BookStatus.EXCEPTION:
            add_status_history(db, book.id, BookStatus.EXCEPTION, BookStatus.PENDING, resolved_by, "所有异常已解决")
            book.status = BookStatus.PENDING

    db.commit()
    db.refresh(db_exc)
    return db_exc


def get_book_exceptions(db: Session, book_id: int) -> List[BookException]:
    return db.query(BookException).filter(BookException.book_id == book_id).order_by(BookException.created_at.desc()).all()


def create_import_log(db: Session, source: ImportSource, file_name: str, imported_by: str) -> ImportLog:
    batch_id = f"BATCH-{uuid.uuid4().hex[:8].upper()}"
    log = ImportLog(
        batch_id=batch_id,
        source=source,
        file_name=file_name,
        imported_by=imported_by
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def add_bad_record(db: Session, import_log_id: int, bad_record: BadRecordCreate) -> BadRecord:
    db_record = BadRecord(**bad_record.dict(), import_log_id=import_log_id)
    db.add(db_record)
    db.flush()
    return db_record


def complete_import_log(db: Session, import_log_id: int, total: int, success: int, failed: int) -> Optional[ImportLog]:
    log = db.query(ImportLog).filter(ImportLog.id == import_log_id).first()
    if not log:
        return None
    log.total_records = total
    log.success_count = success
    log.failed_count = failed
    log.completed_at = datetime.now()
    db.commit()
    db.refresh(log)
    return log


def get_import_log(db: Session, log_id: int) -> Optional[ImportLog]:
    return db.query(ImportLog).filter(ImportLog.id == log_id).first()


def get_import_logs(db: Session, skip: int = 0, limit: int = 100) -> List[ImportLog]:
    return db.query(ImportLog).order_by(ImportLog.imported_at.desc()).offset(skip).limit(limit).all()


def retry_bad_record(db: Session, bad_record_id: int, book_data: BookCreate) -> Tuple[Optional[Book], dict]:
    bad_record = db.query(BadRecord).filter(BadRecord.id == bad_record_id).first()
    if not bad_record:
        return None, {"error": "坏记录不存在"}

    try:
        book, exceptions = create_book(db, book_data)
        bad_record.is_retried = True
        bad_record.retried_at = datetime.now()
        if not exceptions:
            bad_record.resolved = True
        db.commit()
        return book, {"exceptions": exceptions}
    except Exception as e:
        db.rollback()
        return None, {"error": str(e)}


def get_bad_records(db: Session, import_log_id: Optional[int] = None, unresolved_only: bool = False,
                    skip: int = 0, limit: int = 100) -> Tuple[List[BadRecord], int]:
    query = db.query(BadRecord)
    if import_log_id:
        query = query.filter(BadRecord.import_log_id == import_log_id)
    if unresolved_only:
        query = query.filter(BadRecord.resolved == False)

    total = query.count()
    records = query.order_by(BadRecord.id.desc()).offset(skip).limit(limit).all()
    return records, total
