from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_, func
from database import engine, get_db, Base
from models import Product, Order, InventoryJournal, IdempotencyKey, OrderStatus, InventoryAction
from schemas import (
    ProductCreate, ProductResponse, OrderCreate, OrderResponse,
    InventoryJournalResponse, IdempotencyKeyResponse,
    PaymentRequest, CancelRequest, InventoryAuditReport, InventoryAuditItem
)
from datetime import datetime, timedelta
import uuid
import json
from typing import List

app = FastAPI(title="库存扣减服务", version="1.0.0")

Base.metadata.create_all(bind=engine)


def init_seed_data(db: Session):
    existing = db.execute(select(Product)).scalars().first()
    if existing:
        return
    
    sku1 = Product(
        sku="SKU001",
        name="限量版智能手表 Pro",
        price=1999.00,
        total_stock=10,
        available_stock=10,
        frozen_stock=0,
        sold_stock=0
    )
    
    sku2 = Product(
        sku="SKU002",
        name="限量款蓝牙耳机 Ultra",
        price=999.00,
        total_stock=10,
        available_stock=10,
        frozen_stock=0,
        sold_stock=0
    )
    
    db.add_all([sku1, sku2])
    db.commit()


@app.on_event("startup")
def startup_event():
    db = next(get_db())
    init_seed_data(db)
    db.close()


def generate_order_no() -> str:
    return f"ORD{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"


def check_idempotency(db: Session, idempotency_key: str):
    existing = db.execute(
        select(IdempotencyKey).where(IdempotencyKey.key == idempotency_key)
    ).scalar_one_or_none()
    
    if existing:
        if existing.status == "completed" and existing.response:
            return {"exists": True, "completed": True, "response": json.loads(existing.response)}
        elif existing.status == "processing":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="请求正在处理中，请稍后重试"
            )
        else:
            return {"exists": True, "completed": False, "idempotency": existing}
    
    return {"exists": False}


def create_idempotency_key(db: Session, idempotency_key: str) -> IdempotencyKey:
    idempotency = IdempotencyKey(
        key=idempotency_key,
        status="processing",
        expires_at=datetime.utcnow() + timedelta(hours=24)
    )
    db.add(idempotency)
    db.commit()
    db.refresh(idempotency)
    return idempotency


def update_idempotency_success(db: Session, idempotency_key: str, response_data: dict):
    idempotency = db.execute(
        select(IdempotencyKey).where(IdempotencyKey.key == idempotency_key)
    ).scalar_one_or_none()
    
    if idempotency:
        idempotency.status = "completed"
        idempotency.response = json.dumps(response_data)
        db.commit()


def record_inventory_journal(
    db: Session,
    product: Product,
    order: Order,
    action: InventoryAction,
    quantity: int,
    before_available: int,
    after_available: int,
    before_frozen: int,
    after_frozen: int,
    before_sold: int,
    after_sold: int
):
    journal = InventoryJournal(
        product_id=product.id,
        order_id=order.id if order else None,
        action=action,
        quantity=quantity,
        before_available=before_available,
        after_available=after_available,
        before_frozen=before_frozen,
        after_frozen=after_frozen,
        before_sold=before_sold,
        after_sold=after_sold
    )
    db.add(journal)
    db.commit()


@app.post("/api/products/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    existing = db.execute(select(Product).where(Product.sku == product.sku)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SKU已存在")
    
    db_product = Product(
        sku=product.sku,
        name=product.name,
        price=product.price,
        total_stock=product.total_stock,
        available_stock=product.total_stock,
        frozen_stock=0,
        sold_stock=0
    )
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


@app.get("/api/products/", response_model=List[ProductResponse])
def list_products(db: Session = Depends(get_db)):
    products = db.execute(select(Product)).scalars().all()
    return products


@app.get("/api/products/{sku}", response_model=ProductResponse)
def get_product(sku: str, db: Session = Depends(get_db)):
    product = db.execute(select(Product).where(Product.sku == sku)).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品不存在")
    return product


@app.post("/api/orders/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    idempotency_check = check_idempotency(db, order.idempotency_key)
    
    if idempotency_check.get("exists"):
        if idempotency_check.get("completed"):
            return idempotency_check["response"]
        else:
            idempotency = idempotency_check["idempotency"]
    else:
        try:
            idempotency = create_idempotency_key(db, order.idempotency_key)
        except Exception as e:
            db.rollback()
            idempotency_check = check_idempotency(db, order.idempotency_key)
            if idempotency_check.get("exists") and idempotency_check.get("completed"):
                return idempotency_check["response"]
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="幂等键冲突，请稍后重试"
            )
    
    product = db.execute(
        select(Product).where(Product.sku == order.sku).with_for_update()
    ).scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品不存在")
    
    if product.available_stock < order.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"库存不足，当前可用库存: {product.available_stock}"
        )
    
    order_no = generate_order_no()
    unit_price = product.price
    total_amount = unit_price * order.quantity
    
    db_order = Order(
        order_no=order_no,
        product_id=product.id,
        user_id=order.user_id,
        quantity=order.quantity,
        unit_price=unit_price,
        total_amount=total_amount,
        status=OrderStatus.PENDING,
        idempotency_key=order.idempotency_key
    )
    
    before_available = product.available_stock
    before_frozen = product.frozen_stock
    before_sold = product.sold_stock
    
    product.available_stock -= order.quantity
    product.frozen_stock += order.quantity
    
    after_available = product.available_stock
    after_frozen = product.frozen_stock
    after_sold = product.sold_stock
    
    db.add(db_order)
    db.flush()
    
    record_inventory_journal(
        db=db,
        product=product,
        order=db_order,
        action=InventoryAction.RESERVE,
        quantity=order.quantity,
        before_available=before_available,
        after_available=after_available,
        before_frozen=before_frozen,
        after_frozen=after_frozen,
        before_sold=before_sold,
        after_sold=after_sold
    )
    
    db.commit()
    db.refresh(db_order)
    
    response_data = OrderResponse.model_validate(db_order).model_dump(mode='json')
    update_idempotency_success(db, order.idempotency_key, response_data)
    
    return db_order


@app.get("/api/orders/{order_no}", response_model=OrderResponse)
def get_order(order_no: str, db: Session = Depends(get_db)):
    order = db.execute(select(Order).where(Order.order_no == order_no)).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="订单不存在")
    return order


@app.post("/api/orders/pay", response_model=OrderResponse)
def pay_order(payment: PaymentRequest, db: Session = Depends(get_db)):
    order = db.execute(
        select(Order).where(Order.order_no == payment.order_no).with_for_update()
    ).scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="订单不存在")
    
    if order.status != OrderStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"订单状态错误，当前状态: {order.status}"
        )
    
    product = db.execute(
        select(Product).where(Product.id == order.product_id).with_for_update()
    ).scalar_one_or_none()
    
    if product.frozen_stock < order.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="冻结库存不足"
        )
    
    before_available = product.available_stock
    before_frozen = product.frozen_stock
    before_sold = product.sold_stock
    
    product.frozen_stock -= order.quantity
    product.sold_stock += order.quantity
    
    after_available = product.available_stock
    after_frozen = product.frozen_stock
    after_sold = product.sold_stock
    
    order.status = OrderStatus.PAID
    
    record_inventory_journal(
        db=db,
        product=product,
        order=order,
        action=InventoryAction.DEDUCT,
        quantity=order.quantity,
        before_available=before_available,
        after_available=after_available,
        before_frozen=before_frozen,
        after_frozen=after_frozen,
        before_sold=before_sold,
        after_sold=after_sold
    )
    
    db.commit()
    db.refresh(order)
    
    return order


@app.post("/api/orders/cancel", response_model=OrderResponse)
def cancel_order(cancel: CancelRequest, db: Session = Depends(get_db)):
    return rollback_order(cancel.order_no, OrderStatus.CANCELLED, db)


@app.post("/api/orders/timeout", response_model=OrderResponse)
def timeout_order(order_no: str, db: Session = Depends(get_db)):
    return rollback_order(order_no, OrderStatus.TIMEOUT, db)


@app.post("/api/orders/fail", response_model=OrderResponse)
def fail_order(order_no: str, db: Session = Depends(get_db)):
    return rollback_order(order_no, OrderStatus.FAILED, db)


def rollback_order(order_no: str, target_status: OrderStatus, db: Session):
    order = db.execute(
        select(Order).where(Order.order_no == order_no).with_for_update()
    ).scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="订单不存在")
    
    if order.status != OrderStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"订单状态错误，当前状态: {order.status}"
        )
    
    product = db.execute(
        select(Product).where(Product.id == order.product_id).with_for_update()
    ).scalar_one_or_none()
    
    if product.frozen_stock < order.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="冻结库存不足"
        )
    
    before_available = product.available_stock
    before_frozen = product.frozen_stock
    before_sold = product.sold_stock
    
    product.frozen_stock -= order.quantity
    product.available_stock += order.quantity
    
    after_available = product.available_stock
    after_frozen = product.frozen_stock
    after_sold = product.sold_stock
    
    order.status = target_status
    
    record_inventory_journal(
        db=db,
        product=product,
        order=order,
        action=InventoryAction.ROLLBACK,
        quantity=order.quantity,
        before_available=before_available,
        after_available=after_available,
        before_frozen=before_frozen,
        after_frozen=after_frozen,
        before_sold=before_sold,
        after_sold=after_sold
    )
    
    db.commit()
    db.refresh(order)
    
    return order


@app.get("/api/inventory-journals/", response_model=List[InventoryJournalResponse])
def list_inventory_journals(
    sku: str = None,
    order_no: str = None,
    db: Session = Depends(get_db)
):
    query = select(InventoryJournal)
    
    if sku:
        product = db.execute(select(Product).where(Product.sku == sku)).scalar_one_or_none()
        if product:
            query = query.where(InventoryJournal.product_id == product.id)
    
    if order_no:
        order = db.execute(select(Order).where(Order.order_no == order_no)).scalar_one_or_none()
        if order:
            query = query.where(InventoryJournal.order_id == order.id)
    
    query = query.order_by(InventoryJournal.created_at.desc())
    journals = db.execute(query).scalars().all()
    return journals


@app.get("/api/inventory-journals/{journal_id}", response_model=InventoryJournalResponse)
def get_inventory_journal(journal_id: int, db: Session = Depends(get_db)):
    journal = db.execute(
        select(InventoryJournal).where(InventoryJournal.id == journal_id)
    ).scalar_one_or_none()
    
    if not journal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="库存流水不存在")
    
    return journal


@app.get("/api/idempotency-keys/{key}", response_model=IdempotencyKeyResponse)
def get_idempotency_key(key: str, db: Session = Depends(get_db)):
    idempotency = db.execute(
        select(IdempotencyKey).where(IdempotencyKey.key == key)
    ).scalar_one_or_none()
    
    if not idempotency:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="幂等键不存在")
    
    return idempotency


@app.get("/api/audit/report", response_model=InventoryAuditReport)
def get_audit_report(db: Session = Depends(get_db)):
    products = db.execute(select(Product)).scalars().all()
    
    product_items = []
    total_available = 0
    total_frozen = 0
    total_sold = 0
    total_expected = 0
    all_balanced = True
    
    for product in products:
        expected_total = product.available_stock + product.frozen_stock + product.sold_stock
        is_balanced = expected_total == product.total_stock
        
        if not is_balanced:
            all_balanced = False
        
        total_available += product.available_stock
        total_frozen += product.frozen_stock
        total_sold += product.sold_stock
        total_expected += expected_total
        
        product_items.append(InventoryAuditItem(
            sku=product.sku,
            name=product.name,
            total_stock=product.total_stock,
            available_stock=product.available_stock,
            frozen_stock=product.frozen_stock,
            sold_stock=product.sold_stock,
            expected_total=expected_total,
            is_balanced=is_balanced
        ))
    
    total_orders = db.execute(select(func.count(Order.id))).scalar() or 0
    pending_orders = db.execute(
        select(func.count(Order.id)).where(Order.status == OrderStatus.PENDING)
    ).scalar() or 0
    paid_orders = db.execute(
        select(func.count(Order.id)).where(Order.status == OrderStatus.PAID)
    ).scalar() or 0
    cancelled_orders = db.execute(
        select(func.count(Order.id)).where(
            or_(
                Order.status == OrderStatus.CANCELLED,
                Order.status == OrderStatus.TIMEOUT,
                Order.status == OrderStatus.FAILED
            )
        )
    ).scalar() or 0
    
    return InventoryAuditReport(
        generated_at=datetime.utcnow(),
        summary={
            "total_products": len(products),
            "total_available": total_available,
            "total_frozen": total_frozen,
            "total_sold": total_sold,
            "total_expected": total_expected,
            "all_balanced": all_balanced
        },
        products=product_items,
        total_orders=total_orders,
        pending_orders=pending_orders,
        paid_orders=paid_orders,
        cancelled_orders=cancelled_orders
    )


@app.get("/api/audit/report/json")
def get_audit_report_json(db: Session = Depends(get_db)):
    report = get_audit_report(db)
    return JSONResponse(
        content=report.model_dump(mode="json"),
        media_type="application/json"
    )


@app.get("/api/audit/report/markdown", response_class=PlainTextResponse)
def get_audit_report_markdown(db: Session = Depends(get_db)):
    report = get_audit_report(db)
    
    md = f"# 库存审计报告\n\n"
    md += f"**生成时间**: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')} UTC\n\n"
    
    md += "## 库存汇总\n\n"
    md += f"- 商品总数: {report.summary['total_products']}\n"
    md += f"- 总可用库存: {report.summary['total_available']}\n"
    md += f"- 总冻结库存: {report.summary['total_frozen']}\n"
    md += f"- 总已售库存: {report.summary['total_sold']}\n"
    md += f"- 库存平衡状态: {'✅ 平衡' if report.summary['all_balanced'] else '❌ 不平衡'}\n\n"
    
    md += "## 订单统计\n\n"
    md += f"- 总订单数: {report.total_orders}\n"
    md += f"- 待支付: {report.pending_orders}\n"
    md += f"- 已支付: {report.paid_orders}\n"
    md += f"- 已取消: {report.cancelled_orders}\n\n"
    
    md += "## 商品库存详情\n\n"
    md += "| SKU | 商品名称 | 总库存 | 可用 | 冻结 | 已售 | 预计总计 | 状态 |\n"
    md += "|-----|----------|--------|------|------|------|----------|------|\n"
    
    for item in report.products:
        status_icon = "✅" if item.is_balanced else "❌"
        md += f"| {item.sku} | {item.name} | {item.total_stock} | {item.available_stock} | {item.frozen_stock} | {item.sold_stock} | {item.expected_total} | {status_icon} |\n"
    
    return PlainTextResponse(content=md, media_type="text/markdown")


@app.get("/")
def root():
    return {"message": "库存扣减服务运行中", "docs": "/docs", "redoc": "/redoc"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
