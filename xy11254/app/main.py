from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from typing import List, Optional
from datetime import datetime, timedelta
import uuid
import pandas as pd
import os
from tempfile import NamedTemporaryFile

from app.database import get_db, engine, Base
from app.models import Order, ReviewLog, ImportBatch
from app.schemas import (
    OrderImport, OrderResponse, PaginatedResponse,
    SummaryResponse, BatchImportResponse, OrderReview
)
from app.rule_engine import rule_engine

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="团长运营对账系统",
    description="处理生鲜缺货后的退款、换货、补券等对账问题的后端系统",
    version="1.0.0"
)


def generate_batch_no():
    return f"BATCH{datetime.utcnow().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4]}"


@app.post("/api/orders/import", response_model=BatchImportResponse, summary="批量导入订单")
def import_orders(orders: List[OrderImport], db: Session = Depends(get_db)):
    batch_no = generate_batch_no()
    success_count = 0
    failed_count = 0
    errors = []

    for idx, order_data in enumerate(orders):
        try:
            existing = db.query(Order).filter(Order.order_no == order_data.order_no).first()
            if existing:
                errors.append({
                    "row": idx + 1,
                    "order_no": order_data.order_no,
                    "error": "订单号已存在"
                })
                failed_count += 1
                continue

            db_order = Order(
                **order_data.model_dump(),
                import_batch_no=batch_no,
                status="pending"
            )
            db.add(db_order)
            db.flush()

            all_pass, review_logs = rule_engine.process_order(db_order, db, order_data.operator)

            for log in review_logs:
                db.add(log)

            db_order.is_pass = all_pass
            db_order.status = "reviewed"
            if not all_pass:
                reject_reasons = [log.reason for log in review_logs if not log.is_pass]
                db_order.review_reason = "; ".join(reject_reasons)

            success_count += 1

        except Exception as e:
            errors.append({
                "row": idx + 1,
                "order_no": order_data.order_no,
                "error": str(e)
            })
            failed_count += 1
            db.rollback()
        else:
            db.commit()

    batch = ImportBatch(
        batch_no=batch_no,
        total_count=len(orders),
        pass_count=success_count - sum(1 for e in errors if "订单号已存在" not in e["error"]),
        reject_count=failed_count,
        operator=orders[0].operator if orders else None
    )
    db.add(batch)
    db.commit()

    return BatchImportResponse(
        batch_no=batch_no,
        total_count=len(orders),
        success_count=success_count,
        failed_count=failed_count,
        errors=errors
    )


@app.get("/api/orders", response_model=PaginatedResponse, summary="查询订单列表")
def get_orders(
    group_leader: Optional[str] = None,
    status: Optional[str] = None,
    is_pass: Optional[bool] = None,
    rule_type: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(Order)

    if group_leader:
        query = query.filter(Order.group_leader == group_leader)
    if status:
        query = query.filter(Order.status == status)
    if is_pass is not None:
        query = query.filter(Order.is_pass == is_pass)
    if start_date:
        query = query.filter(Order.created_at >= start_date)
    if end_date:
        query = query.filter(Order.created_at <= end_date)

    if rule_type:
        query = query.join(ReviewLog).filter(ReviewLog.rule_type == rule_type, ReviewLog.is_pass == False)

    total = query.count()
    items = query.order_by(Order.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return PaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=items
    )


@app.get("/api/orders/{order_id}", response_model=OrderResponse, summary="查询订单详情")
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    return order


@app.get("/api/orders/{order_id}/logs", summary="获取订单审核日志")
def get_order_logs(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    return order.review_logs


@app.post("/api/orders/{order_id}/review", summary="人工复核订单")
def review_order(order_id: int, review: OrderReview, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")

    order.is_pass = review.is_pass
    order.review_reason = review.review_reason
    order.status = "reviewed"

    log = ReviewLog(
        order_id=order_id,
        rule_name="人工复核",
        rule_type="manual",
        is_pass=review.is_pass,
        reason=review.review_reason,
        operator=review.operator
    )
    db.add(log)
    db.commit()

    return {"message": "复核完成", "order_no": order.order_no, "is_pass": review.is_pass}


@app.get("/api/summary", response_model=SummaryResponse, summary="获取汇总统计")
def get_summary(
    group_leader: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Order).filter(Order.status == "reviewed")

    if group_leader:
        query = query.filter(Order.group_leader == group_leader)
    if start_date:
        query = query.filter(Order.created_at >= start_date)
    if end_date:
        query = query.filter(Order.created_at <= end_date)

    total_count = query.count()
    pass_count = query.filter(Order.is_pass == True).count()
    reject_count = query.filter(Order.is_pass == False).count()
    pass_rate = (pass_count / total_count * 100) if total_count > 0 else 0

    total_compensation = db.query(Order).filter(
            Order.compensation_amount.isnot(None)
        ).with_entities(func.sum(Order.compensation_amount)).scalar() or 0

    rule_breakdown = {}
    logs = db.query(ReviewLog).join(Order).filter(
        ReviewLog.is_pass == False
    ).all()
    for log in logs:
        if log.rule_type not in rule_breakdown:
            rule_breakdown[log.rule_type] = 0
        rule_breakdown[log.rule_type] += 1

    return SummaryResponse(
        total_count=total_count,
        pass_count=pass_count,
        reject_count=reject_count,
        pass_rate=pass_rate,
        total_compensation_amount=total_compensation,
        rule_breakdown=rule_breakdown
    )


@app.get("/api/export", summary="导出订单报表")
def export_orders(
    group_leader: Optional[str] = None,
    status: Optional[str] = None,
    is_pass: Optional[bool] = None,
    rule_type: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Order)

    if group_leader:
        query = query.filter(Order.group_leader == group_leader)
    if status:
        query = query.filter(Order.status == status)
    if is_pass is not None:
        query = query.filter(Order.is_pass == is_pass)
    if start_date:
        query = query.filter(Order.created_at >= start_date)
    if end_date:
        query = query.filter(Order.created_at <= end_date)

    if rule_type:
        query = query.join(ReviewLog).filter(ReviewLog.rule_type == rule_type, ReviewLog.is_pass == False)

    orders = query.order_by(Order.created_at.desc()).all()

    data = []
    for order in orders:
        reject_rules = []
        reject_reasons = []
        for log in order.review_logs:
            if not log.is_pass:
                reject_rules.append(log.rule_name)
                reject_reasons.append(f"{log.rule_name}: {log.reason}")

        data.append({
            "订单号": order.order_no,
            "团长": order.group_leader,
            "客户姓名": order.customer_name or "",
            "客户电话": order.customer_phone or "",
            "商品名称": order.product_name,
            "商品SKU": order.product_sku or "",
            "订购数量": order.order_quantity,
            "订购金额": order.order_amount,
            "实际发货数量": order.actual_quantity or "",
            "实际发货金额": order.actual_amount or "",
            "补偿方式": order.compensation_type or "",
            "补偿金额": order.compensation_amount or "",
            "优惠券码": order.coupon_code or "",
            "券过期时间": order.coupon_expire_date.strftime("%Y-%m-%d") if order.coupon_expire_date else "",
            "审核状态": "通过" if order.is_pass else "拦截",
            "拦截规则": "; ".join(reject_rules) if reject_rules else "",
            "拦截原因": "; ".join(reject_reasons) if reject_reasons else "",
            "操作员": order.operator or "",
            "导入批次": order.import_batch_no or "",
            "创建时间": order.created_at.strftime("%Y-%m-%d %H:%M:%S")
        })

    df = pd.DataFrame(data)

    with NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        tmp_path = tmp.name

    df.to_excel(tmp_path, index=False, sheet_name="订单明细")

    filename = f"对账报表_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"

    response = FileResponse(
        tmp_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename
    )

    @response.background
    def cleanup():
        os.unlink(tmp_path)

    return response


@app.get("/api/group-leaders", summary="获取所有团长列表")
def get_group_leaders(db: Session = Depends(get_db)):
    leaders = db.query(Order.group_leader).distinct().all()
    return [leader[0] for leader in leaders]


@app.get("/api/rule-types", summary="获取所有规则类型")
def get_rule_types():
    return rule_engine.get_rule_types()


@app.get("/api/batches", summary="获取导入批次列表")
def get_batches(db: Session = Depends(get_db)):
    batches = db.query(ImportBatch).order_by(ImportBatch.created_at.desc()).all()
    return batches


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
