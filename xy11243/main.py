from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, Float, Boolean, ForeignKey, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional, Dict, Any
import isbnlib
import re
import csv
import io
import os
import json
import logging
from pathlib import Path
import hashlib

DATABASE_URL = "sqlite:///./library.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

LOG_DIR = Path("./logs")
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_DIR / "library.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("library")


class Book(Base):
    __tablename__ = "books"
    id = Column(Integer, primary_key=True, index=True)
    isbn = Column(String, index=True)
    isbn_normalized = Column(String, index=True, unique=True)
    title = Column(String)
    author = Column(String)
    publisher = Column(String)
    grade = Column(String, index=True)
    grade_normalized = Column(String, index=True)
    condition = Column(String)
    condition_level = Column(Integer, index=True)
    donor_name = Column(String)
    donor_phone = Column(String)
    donor_info_hash = Column(String)
    quantity = Column(Integer, default=1)
    source = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    import_batch_id = Column(String, index=True)
    shelf_list_id = Column(Integer, ForeignKey("shelf_lists.id"), nullable=True)
    shelf_list = relationship("ShelfList", back_populates="books")


class ImportBatch(Base):
    __tablename__ = "import_batches"
    id = Column(String, primary_key=True)
    filename = Column(String)
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    duplicate_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String)
    error_details = Column(Text)


class ShelfList(Base):
    __tablename__ = "shelf_lists"
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, index=True)
    generated_at = Column(DateTime, default=datetime.utcnow)
    grade = Column(String)
    total_books = Column(Integer, default=0)
    status = Column(String, default="generated")
    exported = Column(Boolean, default=False)
    books = relationship("Book", back_populates="shelf_list")


class OperationLog(Base):
    __tablename__ = "operation_logs"
    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String, index=True)
    batch_id = Column(String, index=True, nullable=True)
    isbn = Column(String, nullable=True)
    details = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    success = Column(Boolean, default=True)
    user = Column(String, default="system")


Base.metadata.create_all(bind=engine)


class BookImport(BaseModel):
    isbn: str
    title: Optional[str] = None
    author: Optional[str] = None
    publisher: Optional[str] = None
    grade: Optional[str] = None
    condition: Optional[str] = None
    donor_name: Optional[str] = None
    donor_phone: Optional[str] = None
    quantity: int = 1
    source: Optional[str] = None


class BookResponse(BaseModel):
    id: int
    isbn: str
    title: Optional[str]
    author: Optional[str]
    publisher: Optional[str]
    grade: Optional[str]
    condition: Optional[str]
    condition_level: Optional[int]
    quantity: int
    created_at: datetime

    class Config:
        orm_mode = True


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def normalize_isbn(isbn: str) -> str:
    if not isbn:
        return ""
    cleaned = re.sub(r'[^0-9X]', '', isbn.upper())
    if len(cleaned) == 10:
        try:
            cleaned = isbnlib.to_isbn13(cleaned)
        except:
            pass
    return cleaned


def validate_isbn(isbn: str) -> tuple[bool, str]:
    normalized = normalize_isbn(isbn)
    if not normalized:
        return False, "ISBN为空"
    if len(normalized) not in (10, 13):
        return False, f"ISBN长度无效: {len(normalized)}位"
    if len(normalized) == 13:
        if not normalized.startswith('978') and not normalized.startswith('979'):
            return False, "ISBN前缀无效"
    return True, normalized


GRADE_MAPPING = {
    '一年级': 'G1', '二年级': 'G2', '三年级': 'G3', '四年级': 'G4', '五年级': 'G5', '六年级': 'G6',
    '初一': 'G7', '初二': 'G8', '初三': 'G9', '高一': 'G10', '高二': 'G11', '高三': 'G12',
    '1年级': 'G1', '2年级': 'G2', '3年级': 'G3', '4年级': 'G4', '5年级': 'G5', '6年级': 'G6',
    '7年级': 'G7', '8年级': 'G8', '9年级': 'G9', '10年级': 'G10', '11年级': 'G11', '12年级': 'G12',
    '小学': 'ELEMENTARY', '初中': 'JUNIOR_HIGH', '高中': 'SENIOR_HIGH',
    'G1': 'G1', 'G2': 'G2', 'G3': 'G3', 'G4': 'G4', 'G5': 'G5', 'G6': 'G6',
    'G7': 'G7', 'G8': 'G8', 'G9': 'G9', 'G10': 'G10', 'G11': 'G11', 'G12': 'G12',
}


def normalize_grade(grade: str) -> str:
    if not grade:
        return "UNKNOWN"
    grade = grade.strip()
    for key, value in GRADE_MAPPING.items():
        if key in grade or grade in key:
            return value
    return grade.upper()


CONDITION_MAPPING = {
    '全新': 5, '九成新': 4, '八五新': 4, '八成新': 3, '七成新': 3,
    '六品': 2, '五成新': 2, '差': 1, '破损': 0,
    '5': 5, '4': 4, '3': 3, '2': 2, '1': 1, '0': 0,
    'excellent': 5, 'good': 4, 'fair': 3, 'poor': 2, 'bad': 1
}


def normalize_condition(condition: str) -> tuple[int, str]:
    if not condition:
        return 3, "一般"
    condition = condition.strip()
    for key, level in CONDITION_MAPPING.items():
        if key in condition or condition.lower() in key.lower():
            desc_map = {5: "全新", 4: "良好", 3: "一般", 2: "较差", 1: "破损", 0: "报废"}
            return level, desc_map.get(level, "一般")
    return 3, "一般"


def hash_sensitive_data(data: str) -> str:
    if not data:
        return ""
    return hashlib.sha256(data.encode('utf-8')).hexdigest()


def mask_sensitive_field(value: str, field_type: str = "default") -> str:
    if not value:
        return ""
    if field_type == "phone":
        if len(value) >= 7:
            return value[:3] + "****" + value[-4:]
        return "****"
    elif field_type == "name":
        if len(value) >= 2:
            return value[0] + "*" * (len(value) - 1)
        return "*"
    return "*" * len(value)


def log_operation(db: Session, op_type: str, batch_id: str = None, isbn: str = None,
                  details: dict = None, success: bool = True):
    if details:
        details_safe = details.copy()
        if 'donor_name' in details_safe:
            details_safe['donor_name'] = mask_sensitive_field(details_safe['donor_name'], "name")
        if 'donor_phone' in details_safe:
            details_safe['donor_phone'] = mask_sensitive_field(details_safe['donor_phone'], "phone")
        log_details = json.dumps(details_safe, ensure_ascii=False)
    else:
        log_details = None
    
    log = OperationLog(
        operation_type=op_type,
        batch_id=batch_id,
        isbn=isbn,
        details=log_details,
        success=success
    )
    db.add(log)
    db.commit()
    logger.info(f"Operation: {op_type}, Batch: {batch_id}, ISBN: {isbn}, Success: {success}")


app = FastAPI(title="公益书库管理系统", version="1.0.0")


def process_single_book(db: Session, book_data: dict, batch_id: str, skip_duplicate: bool = True) -> dict:
    isbn = book_data.get('isbn', '')
    is_valid, normalized_isbn = validate_isbn(isbn)
    
    if not is_valid:
        return {
            'success': False,
            'error': normalized_isbn,
            'isbn': isbn,
            'action': 'skipped'
        }
    
    existing = db.query(Book).filter(Book.isbn_normalized == normalized_isbn).first()
    if existing and skip_duplicate:
        return {
            'success': True,
            'duplicate': True,
            'isbn': normalized_isbn,
            'existing_id': existing.id,
            'action': 'skipped_duplicate'
        }
    
    grade = book_data.get('grade', '')
    grade_normalized = normalize_grade(grade)
    condition = book_data.get('condition', '')
    condition_level, condition_desc = normalize_condition(condition)
    donor_name = book_data.get('donor_name', '')
    donor_phone = book_data.get('donor_phone', '')
    donor_info_hash = hash_sensitive_data(f"{donor_name}|{donor_phone}")
    
    if existing:
        existing.quantity += book_data.get('quantity', 1)
        existing.updated_at = datetime.utcnow()
        db.commit()
        book = existing
        action = 'updated'
    else:
        book = Book(
            isbn=isbn,
            isbn_normalized=normalized_isbn,
            title=book_data.get('title', ''),
            author=book_data.get('author', ''),
            publisher=book_data.get('publisher', ''),
            grade=grade,
            grade_normalized=grade_normalized,
            condition=condition_desc,
            condition_level=condition_level,
            donor_name=donor_name,
            donor_phone=donor_phone,
            donor_info_hash=donor_info_hash,
            quantity=book_data.get('quantity', 1),
            source=book_data.get('source', ''),
            import_batch_id=batch_id
        )
        db.add(book)
        db.commit()
        db.refresh(book)
        action = 'created'
    
    return {
        'success': True,
        'duplicate': existing is not None,
        'isbn': normalized_isbn,
        'book_id': book.id,
        'title': book.title,
        'grade': grade_normalized,
        'condition_level': condition_level,
        'action': action
    }


@app.post("/api/books/import", summary="导入书籍数据")
async def import_books(
    books: List[BookImport],
    batch_id: Optional[str] = None,
    skip_duplicates: bool = True,
    db: Session = Depends(get_db)
):
    if not batch_id:
        batch_id = f"BATCH-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    
    batch = ImportBatch(
        id=batch_id,
        filename="api_import",
        total_count=len(books),
        status="processing"
    )
    db.add(batch)
    db.commit()
    
    results = []
    success_count = 0
    duplicate_count = 0
    error_count = 0
    errors = []
    
    for idx, book_import in enumerate(books):
        book_data = book_import.dict()
        result = process_single_book(db, book_data, batch_id, skip_duplicates)
        
        if result.get('success'):
            if result.get('duplicate'):
                duplicate_count += 1
            else:
                success_count += 1
        else:
            error_count += 1
            errors.append({
                'index': idx,
                'isbn': book_data.get('isbn'),
                'error': result.get('error')
            })
        
        results.append(result)
    
    batch.success_count = success_count
    batch.duplicate_count = duplicate_count
    batch.error_count = error_count
    batch.status = "completed"
    batch.error_details = json.dumps(errors, ensure_ascii=False) if errors else None
    db.commit()
    
    log_operation(db, "import", batch_id=batch_id, details={
        'total': len(books),
        'success': success_count,
        'duplicates': duplicate_count,
        'errors': error_count
    })
    
    return {
        'batch_id': batch_id,
        'total': len(books),
        'success': success_count,
        'duplicates': duplicate_count,
        'errors': error_count,
        'error_details': errors,
        'results': results
    }


@app.post("/api/books/import/file", summary="通过CSV/Excel文件导入书籍")
async def import_books_from_file(
    file: UploadFile = File(...),
    batch_id: Optional[str] = None,
    skip_duplicates: bool = True,
    db: Session = Depends(get_db)
):
    if not batch_id:
        batch_id = f"BATCH-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    
    content = await file.read()
    books_data = []
    
    try:
        if file.filename.endswith('.csv'):
            csv_content = io.StringIO(content.decode('utf-8'))
            reader = csv.DictReader(csv_content)
            for row in reader:
                books_data.append(row)
        elif file.filename.endswith(('.xlsx', '.xls')):
            import pandas as pd
            excel_content = io.BytesIO(content)
            df = pd.read_excel(excel_content)
            books_data = df.to_dict('records')
        else:
            raise HTTPException(status_code=400, detail="仅支持CSV和Excel文件")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"文件解析失败: {str(e)}")
    
    batch = ImportBatch(
        id=batch_id,
        filename=file.filename,
        total_count=len(books_data),
        status="processing"
    )
    db.add(batch)
    db.commit()
    
    results = []
    success_count = 0
    duplicate_count = 0
    error_count = 0
    errors = []
    
    for idx, book_data in enumerate(books_data):
        book_data_clean = {k: str(v) if v is not None else '' for k, v in book_data.items()}
        result = process_single_book(db, book_data_clean, batch_id, skip_duplicates)
        
        if result.get('success'):
            if result.get('duplicate'):
                duplicate_count += 1
            else:
                success_count += 1
        else:
            error_count += 1
            errors.append({
                'index': idx,
                'isbn': book_data.get('isbn'),
                'error': result.get('error')
            })
        
        results.append(result)
    
    batch.success_count = success_count
    batch.duplicate_count = duplicate_count
    batch.error_count = error_count
    batch.status = "completed"
    batch.error_details = json.dumps(errors, ensure_ascii=False) if errors else None
    db.commit()
    
    log_operation(db, "import_file", batch_id=batch_id, details={
        'filename': file.filename,
        'total': len(books_data),
        'success': success_count,
        'duplicates': duplicate_count,
        'errors': error_count
    })
    
    return {
        'batch_id': batch_id,
        'filename': file.filename,
        'total': len(books_data),
        'success': success_count,
        'duplicates': duplicate_count,
        'errors': error_count,
        'error_details': errors
    }


@app.get("/api/books", summary="查询书籍列表")
def get_books(
    grade: Optional[str] = None,
    condition_level: Optional[int] = None,
    isbn: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Book).filter(Book.is_active == True)
    
    if grade:
        grade_norm = normalize_grade(grade)
        query = query.filter(Book.grade_normalized == grade_norm)
    if condition_level is not None:
        query = query.filter(Book.condition_level == condition_level)
    if isbn:
        isbn_norm = normalize_isbn(isbn)
        query = query.filter(Book.isbn_normalized == isbn_norm)
    
    total = query.count()
    books = query.order_by(Book.created_at.desc()).offset(skip).limit(limit).all()
    
    return {
        'total': total,
        'skip': skip,
        'limit': limit,
        'data': [{
            'id': b.id,
            'isbn': b.isbn_normalized,
            'title': b.title,
            'author': b.author,
            'grade': b.grade_normalized,
            'condition': b.condition,
            'condition_level': b.condition_level,
            'quantity': b.quantity,
            'donor_name_masked': mask_sensitive_field(b.donor_name, "name"),
            'created_at': b.created_at
        } for b in books]
    }


@app.post("/api/shelf-list/generate", summary="生成分级上架清单")
def generate_shelf_list(
    grade: Optional[str] = None,
    min_condition_level: int = 2,
    db: Session = Depends(get_db)
):
    query = db.query(Book).filter(
        Book.is_active == True,
        Book.shelf_list_id == None,
        Book.condition_level >= min_condition_level
    )
    
    if grade:
        grade_norm = normalize_grade(grade)
        query = query.filter(Book.grade_normalized == grade_norm)
    
    books = query.all()
    
    if not books:
        raise HTTPException(status_code=404, detail="没有符合条件的书籍")
    
    books_by_grade = {}
    for book in books:
        g = book.grade_normalized
        if g not in books_by_grade:
            books_by_grade[g] = []
        books_by_grade[g].append(book)
    
    shelf_lists = []
    batch_id = f"SHELF-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    
    for g, grade_books in books_by_grade.items():
        shelf_list = ShelfList(
            batch_id=batch_id,
            grade=g,
            total_books=len(grade_books)
        )
        db.add(shelf_list)
        db.flush()
        
        for book in grade_books:
            book.shelf_list_id = shelf_list.id
        
        db.refresh(shelf_list)
        shelf_lists.append({
            'id': shelf_list.id,
            'grade': g,
            'total_books': len(grade_books),
            'generated_at': shelf_list.generated_at
        })
    
    db.commit()
    
    log_operation(db, "generate_shelf_list", batch_id=batch_id, details={
        'total_lists': len(shelf_lists),
        'total_books': sum(s['total_books'] for s in shelf_lists),
        'grades': list(books_by_grade.keys())
    })
    
    return {
        'batch_id': batch_id,
        'shelf_lists': shelf_lists,
        'total_books': sum(s['total_books'] for s in shelf_lists)
    }


@app.get("/api/shelf-list/{shelf_list_id}", summary="获取上架清单详情")
def get_shelf_list(shelf_list_id: int, db: Session = Depends(get_db)):
    shelf_list = db.query(ShelfList).filter(ShelfList.id == shelf_list_id).first()
    if not shelf_list:
        raise HTTPException(status_code=404, detail="上架清单不存在")
    
    books = db.query(Book).filter(Book.shelf_list_id == shelf_list_id).all()
    
    return {
        'id': shelf_list.id,
        'batch_id': shelf_list.batch_id,
        'grade': shelf_list.grade,
        'total_books': shelf_list.total_books,
        'generated_at': shelf_list.generated_at,
        'status': shelf_list.status,
        'books': [{
            'id': b.id,
            'isbn': b.isbn_normalized,
            'title': b.title,
            'author': b.author,
            'condition': b.condition,
            'condition_level': b.condition_level,
            'quantity': b.quantity
        } for b in books]
    }


@app.get("/api/shelf-list/{shelf_list_id}/export", summary="导出版清单")
def export_shelf_list(shelf_list_id: int, db: Session = Depends(get_db)):
    shelf_list = db.query(ShelfList).filter(ShelfList.id == shelf_list_id).first()
    if not shelf_list:
        raise HTTPException(status_code=404, detail="上架清单不存在")
    
    books = db.query(Book).filter(Book.shelf_list_id == shelf_list_id).all()
    
    export_dir = Path("./exports")
    export_dir.mkdir(exist_ok=True)
    
    filename = f"shelf_list_{shelf_list.grade}_{shelf_list.id}.csv"
    filepath = export_dir / filename
    
    with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerow(['序号', 'ISBN', '书名', '作者', '品相', '品相等级', '数量', '捐赠人'])
        for idx, b in enumerate(books, 1):
            writer.writerow([
                idx,
                b.isbn_normalized,
                b.title,
                b.author,
                b.condition,
                b.condition_level,
                b.quantity,
                mask_sensitive_field(b.donor_name, "name")
            ])
    
    shelf_list.exported = True
    db.commit()
    
    log_operation(db, "export_shelf_list", batch_id=shelf_list.batch_id, details={
        'shelf_list_id': shelf_list_id,
        'grade': shelf_list.grade,
        'book_count': len(books)
    })
    
    return FileResponse(
        path=filepath,
        filename=filename,
        media_type="text/csv"
    )


@app.get("/api/history/batches", summary="查询导入批次历史")
def get_import_batches(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    total = db.query(ImportBatch).count()
    batches = db.query(ImportBatch).order_by(ImportBatch.created_at.desc()).offset(skip).limit(limit).all()
    
    return {
        'total': total,
        'data': [{
            'id': b.id,
            'filename': b.filename,
            'total_count': b.total_count,
            'success_count': b.success_count,
            'duplicate_count': b.duplicate_count,
            'error_count': b.error_count,
            'created_at': b.created_at,
            'status': b.status
        } for b in batches]
    }


@app.get("/api/history/operations", summary="查询操作日志")
def get_operation_logs(
    operation_type: Optional[str] = None,
    batch_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(OperationLog)
    
    if operation_type:
        query = query.filter(OperationLog.operation_type == operation_type)
    if batch_id:
        query = query.filter(OperationLog.batch_id == batch_id)
    
    total = query.count()
    logs = query.order_by(OperationLog.created_at.desc()).offset(skip).limit(limit).all()
    
    return {
        'total': total,
        'data': [{
            'id': l.id,
            'operation_type': l.operation_type,
            'batch_id': l.batch_id,
            'isbn': l.isbn,
            'details': l.details,
            'created_at': l.created_at,
            'success': l.success
        } for l in logs]
    }


@app.get("/api/stats", summary="获取统计数据")
def get_stats(db: Session = Depends(get_db)):
    total_books = db.query(Book).filter(Book.is_active == True).count()
    books_by_grade = db.query(Book.grade_normalized, func.count(Book.id)).filter(
        Book.is_active == True
    ).group_by(Book.grade_normalized).all()
    
    pending_shelf = db.query(Book).filter(
        Book.is_active == True,
        Book.shelf_list_id == None
    ).count()
    
    total_shelf_lists = db.query(ShelfList).count()
    exported_shelf_lists = db.query(ShelfList).filter(ShelfList.exported == True).count()
    
    return {
        'total_books': total_books,
        'books_by_grade': {g: cnt for g, cnt in books_by_grade},
        'pending_shelf_count': pending_shelf,
        'total_shelf_lists': total_shelf_lists,
        'exported_shelf_lists': exported_shelf_lists
    }


@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
