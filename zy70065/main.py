from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager
import logging
import traceback

from models import SessionLocal, init_db
from schemas import (
    ReservationCreate, TransferCreate, TransferStart, TransferArrive,
    PickupBook, ManualCorrection, ReaderCreate, BranchCreate,
    BookCreate, HoldingCreate
)
from services import (
    create_reservation, create_transfer, start_transfer, arrive_transfer,
    pickup_book, process_overdue_reservations, manual_correction,
    query_reader_reservations, get_reservation_detail, create_initial_data,
    BusinessError, ValidationError as ServiceValidationError,
    StateError, NotFoundError, generate_id
)
from models import Reader, Branch, Book, Holding, Reservation


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("正在初始化数据库...")
    init_db()
    logger.info("数据库初始化完成")
    
    db = SessionLocal()
    try:
        result = create_initial_data(db)
        logger.info(f"初始化数据: {result['message']}")
    finally:
        db.close()
    
    yield
    logger.info="应用关闭中..."


app = FastAPI(
    title="图书预约取书 API",
    description="支持馆藏调拨、预约队列、到馆通知、逾期释放、借阅生成等核心业务",
    version="1.0.0",
    lifespan=lifespan
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.exception_handler(BusinessError)
async def business_exception_handler(request: Request, exc: BusinessError):
    logger.warning(f"业务异常: {exc.message}")
    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "message": exc.message,
            "data": exc.data,
            "error_type": exc.__class__.__name__
        }
    )


@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    error_messages = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"])
        error_messages.append(f"{field}: {error['msg']}")
    
    message = "；".join(error_messages)
    logger.warning(f"参数校验失败: {message}")
    
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "message": f"参数错误: {message}",
            "error_type": "参数校验失败"
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"系统异常: {str(exc)}\n{traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "系统内部错误，请联系管理员",
            "error_type": "系统异常"
        }
    )


@app.get("/", tags=["系统"])
def root():
    return {
        "success": True,
        "message": "图书预约取书系统运行正常",
        "data": {
            "系统名称": "图书预约取书 API",
            "版本": "1.0.0",
            "接口文档": "/docs"
        }
    }


@app.post("/api/readers", tags=["基础数据"], summary="新增读者")
def add_reader(data: ReaderCreate, db: Session = Depends(get_db)):
    existing = db.query(Reader).filter(Reader.id == data.reader_id).first()
    if existing:
        return {
            "success": True,
            "message": "读者已存在",
            "data": {
                "读者编号": existing.id,
                "姓名": existing.name,
                "状态": "已存在"
            }
        }
    
    reader = Reader(id=data.reader_id, name=data.name, phone=data.phone)
    db.add(reader)
    db.commit()
    
    return {
        "success": True,
        "message": f"读者 {data.name} 添加成功",
        "data": {
            "读者编号": reader.id,
            "姓名": reader.name,
            "电话": reader.phone
        }
    }


@app.post("/api/branches", tags=["基础数据"], summary="新增分馆")
def add_branch(data: BranchCreate, db: Session = Depends(get_db)):
    existing = db.query(Branch).filter(Branch.id == data.branch_id).first()
    if existing:
        return {
            "success": True,
            "message": "分馆已存在",
            "data": {
                "分馆编号": existing.id,
                "名称": existing.name,
                "状态": "已存在"
            }
        }
    
    branch = Branch(id=data.branch_id, name=data.name, address=data.address)
    db.add(branch)
    db.commit()
    
    return {
        "success": True,
        "message": f"分馆 {data.name} 添加成功",
        "data": {
            "分馆编号": branch.id,
            "名称": branch.name,
            "地址": branch.address
        }
    }


@app.post("/api/books", tags=["基础数据"], summary="新增图书")
def add_book(data: BookCreate, db: Session = Depends(get_db)):
    existing = db.query(Book).filter(Book.id == data.book_id).first()
    if existing:
        return {
            "success": True,
            "message": "图书已存在",
            "data": {
                "图书编号": existing.id,
                "书名": existing.title,
                "状态": "已存在"
            }
        }
    
    book = Book(
        id=data.book_id,
        isbn=data.isbn,
        title=data.title,
        author=data.author,
        publisher=data.publisher
    )
    db.add(book)
    db.commit()
    
    return {
        "success": True,
        "message": f"图书《{data.title}》添加成功",
        "data": {
            "图书编号": book.id,
            "ISBN": book.isbn,
            "书名": book.title,
            "作者": book.author
        }
    }


@app.post("/api/holdings", tags=["基础数据"], summary="新增馆藏")
def add_holding(data: HoldingCreate, db: Session = Depends(get_db)):
    existing = db.query(Holding).filter(Holding.id == data.holding_id).first()
    if existing:
        return {
            "success": True,
            "message": "馆藏已存在",
            "data": {
                "馆藏编号": existing.id,
                "条码": existing.barcode,
                "状态": "已存在"
            }
        }
    
    db.query(Book).filter(Book.id == data.book_id).first() or (_ for _ in ()).throw(
        ServiceValidationError(f"图书 {data.book_id} 不存在")
    )
    db.query(Branch).filter(Branch.id == data.branch_id).first() or (_ for _ in ()).throw(
        ServiceValidationError(f"分馆 {data.branch_id} 不存在")
    )
    
    holding = Holding(
        id=data.holding_id,
        book_id=data.book_id,
        branch_id=data.branch_id,
        barcode=data.barcode,
        location=data.location
    )
    db.add(holding)
    db.commit()
    
    return {
        "success": True,
        "message": "馆藏添加成功",
        "data": {
            "馆藏编号": holding.id,
            "条码": holding.barcode,
            "状态": holding.status
        }
    }


@app.post("/api/reservations", tags=["预约管理"], summary="创建预约")
def api_create_reservation(data: ReservationCreate, db: Session = Depends(get_db)):
    return create_reservation(db, data)


@app.post("/api/transfers", tags=["调拨管理"], summary="创建调拨单")
def api_create_transfer(data: TransferCreate, db: Session = Depends(get_db)):
    return create_transfer(db, data)


@app.post("/api/transfers/{transfer_id}/start", tags=["调拨管理"], summary="开始调拨（发出）")
def api_start_transfer(transfer_id: str, data: TransferStart = TransferStart(), db: Session = Depends(get_db)):
    return start_transfer(db, transfer_id, data)


@app.post("/api/transfers/{transfer_id}/arrive", tags=["调拨管理"], summary="确认调拨到馆")
def api_arrive_transfer(transfer_id: str, data: TransferArrive = TransferArrive(), db: Session = Depends(get_db)):
    return arrive_transfer(db, transfer_id, data)


@app.post("/api/reservations/{reservation_id}/pickup", tags=["预约管理"], summary="取书并生成借阅")
def api_pickup_book(reservation_id: str, data: PickupBook, db: Session = Depends(get_db)):
    return pickup_book(db, reservation_id, data)


@app.post("/api/overdue/process", tags=["逾期管理"], summary="批量处理逾期预约")
def api_process_overdue(db: Session = Depends(get_db)):
    return process_overdue_reservations(db)


@app.post("/api/reservations/{reservation_id}/correct", tags=["人工管理"], summary="人工修正预约")
def api_manual_correction(reservation_id: str, data: ManualCorrection, db: Session = Depends(get_db)):
    return manual_correction(db, reservation_id, data)


@app.get("/api/readers/{reader_id}/reservations", tags=["查询"], summary="查询读者预约记录")
def api_query_reader_reservations(reader_id: str, db: Session = Depends(get_db)):
    return query_reader_reservations(db, reader_id)


@app.get("/api/reservations/{reservation_id}", tags=["查询"], summary="查询预约详情")
def api_get_reservation_detail(reservation_id: str, db: Session = Depends(get_db)):
    return get_reservation_detail(db, reservation_id)


@app.get("/api/branches", tags=["基础数据"], summary="查询所有分馆")
def list_branches(db: Session = Depends(get_db)):
    branches = db.query(Branch).all()
    return {
        "success": True,
        "message": f"找到 {len(branches)} 个分馆",
        "data": [
            {
                "分馆编号": b.id,
                "名称": b.name,
                "地址": b.address,
                "状态": "启用" if b.is_active else "停用"
            }
            for b in branches
        ]
    }


@app.get("/api/books/{book_id}/holdings", tags=["基础数据"], summary="查询图书的馆藏分布")
def list_book_holdings(book_id: str, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise NotFoundError(f"图书 {book_id} 不存在")
    
    holdings = db.query(Holding).filter(Holding.book_id == book_id).all()
    
    result = []
    for h in holdings:
        branch = db.query(Branch).filter(Branch.id == h.branch_id).first()
        result.append({
            "馆藏编号": h.id,
            "条码": h.barcode,
            "所属分馆": branch.name if branch else "未知",
            "状态": h.status,
            "位置": h.location
        })
    
    return {
        "success": True,
        "message": f"《{book.title}》共有 {len(holdings)} 个馆藏",
        "data": result
    }
