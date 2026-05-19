from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime
import pandas as pd
import json
import re
import os
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

DATABASE_URL = "sqlite:///./reconciliation.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class OrderRecord(Base):
    __tablename__ = "order_records"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(String, index=True)
    user_id = Column(String)
    user_name = Column(String)
    user_phone = Column(String)
    product_id = Column(String)
    product_name = Column(String)
    quantity = Column(Integer)
    price = Column(Float)
    total_amount = Column(Float)
    order_time = Column(DateTime)
    status = Column(String)
    batch_id = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class OutOfStockItem(Base):
    __tablename__ = "out_of_stock_items"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(String, index=True)
    product_name = Column(String)
    stock_quantity = Column(Integer)
    batch_id = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class CompensationRule(Base):
    __tablename__ = "compensation_rules"
    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(String, index=True)
    rule_type = Column(String)
    condition_type = Column(String)
    condition_value = Column(Float)
    compensation_type = Column(String)
    compensation_value = Column(Float)
    description = Column(String)
    batch_id = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class ReconciliationResult(Base):
    __tablename__ = "reconciliation_results"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(String, index=True)
    user_id = Column(String)
    user_name = Column(String)
    user_phone = Column(String)
    product_id = Column(String)
    product_name = Column(String)
    original_quantity = Column(Integer)
    original_amount = Column(Float)
    out_of_stock_quantity = Column(Integer)
    compensation_type = Column(String)
    compensation_amount = Column(Float)
    compensation_description = Column(String)
    final_status = Column(String)
    batch_id = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class ErrorRecord(Base):
    __tablename__ = "error_records"
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, index=True)
    source_type = Column(String)
    source_file = Column(String)
    row_number = Column(Integer)
    original_data = Column(Text)
    error_message = Column(String)
    suggestion = Column(String)
    resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="团长运营对账系统", description="处理生鲜缺货后的退款、换货、补券对账")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def mask_phone(phone: str) -> str:
    if not phone or len(phone) < 7:
        return phone
    return phone[:3] + "****" + phone[-4:]

def mask_user_id(user_id: str) -> str:
    if not user_id or len(user_id) < 6:
        return user_id
    return user_id[:2] + "***" + user_id[-2:]

def mask_sensitive_fields(data: Dict[str, Any]) -> Dict[str, Any]:
    masked = data.copy()
    if "user_phone" in masked:
        masked["user_phone"] = mask_phone(masked["user_phone"])
    if "user_id" in masked:
        masked["user_id"] = mask_user_id(masked["user_id"])
    return masked

class BatchResponse(BaseModel):
    batch_id: str
    message: str
    order_count: int
    out_of_stock_count: int
    rule_count: int
    error_count: int

@app.post("/api/import/orders", response_model=BatchResponse)
async def import_orders(file: UploadFile = File(...), db: Session = Depends(get_db)):
    batch_id = f"orders_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    error_count = 0
    success_count = 0
    
    try:
        contents = await file.read()
        df = pd.read_csv(pd.io.common.BytesIO(contents))
        
        for idx, row in df.iterrows():
            try:
                order_id = str(row.get("order_id", "")).strip()
                if not order_id:
                    raise ValueError("order_id不能为空")
                
                user_phone = str(row.get("user_phone", "")).strip()
                if not re.match(r'^1[3-9]\d{9}$', user_phone):
                    raise ValueError(f"手机号格式不正确: {user_phone}")
                
                quantity = int(row.get("quantity", 0))
                if quantity <= 0:
                    raise ValueError(f"数量必须大于0: {quantity}")
                
                price = float(row.get("price", 0))
                total_amount = float(row.get("total_amount", 0))
                
                order = OrderRecord(
                    order_id=order_id,
                    user_id=mask_user_id(str(row.get("user_id", ""))),
                    user_name=str(row.get("user_name", "")),
                    user_phone=mask_phone(user_phone),
                    product_id=str(row.get("product_id", "")),
                    product_name=str(row.get("product_name", "")),
                    quantity=quantity,
                    price=price,
                    total_amount=total_amount,
                    order_time=pd.to_datetime(row.get("order_time", datetime.now())),
                    status=str(row.get("status", "pending")),
                    batch_id=batch_id
                )
                db.add(order)
                success_count += 1
            except Exception as e:
                error_count += 1
                error_record = ErrorRecord(
                    batch_id=batch_id,
                    source_type="orders",
                    source_file=file.filename,
                    row_number=idx + 2,
                    original_data=json.dumps(row.to_dict(), ensure_ascii=False),
                    error_message=str(e),
                    suggestion="请检查必填字段是否完整、格式是否正确",
                    resolved=False
                )
                db.add(error_record)
        
        db.commit()
        return BatchResponse(
            batch_id=batch_id,
            message="订单导入完成",
            order_count=success_count,
            out_of_stock_count=0,
            rule_count=0,
            error_count=error_count
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")

@app.post("/api/import/out-of-stock", response_model=BatchResponse)
async def import_out_of_stock(file: UploadFile = File(...), db: Session = Depends(get_db)):
    batch_id = f"stock_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    error_count = 0
    success_count = 0
    
    try:
        contents = await file.read()
        df = pd.read_excel(pd.io.common.BytesIO(contents))
        
        for idx, row in df.iterrows():
            try:
                product_id = str(row.get("product_id", "")).strip()
                if not product_id:
                    raise ValueError("product_id不能为空")
                
                stock_quantity = int(row.get("stock_quantity", 0))
                if stock_quantity < 0:
                    raise ValueError(f"库存数量不能为负: {stock_quantity}")
                
                item = OutOfStockItem(
                    product_id=product_id,
                    product_name=str(row.get("product_name", "")),
                    stock_quantity=stock_quantity,
                    batch_id=batch_id
                )
                db.add(item)
                success_count += 1
            except Exception as e:
                error_count += 1
                error_record = ErrorRecord(
                    batch_id=batch_id,
                    source_type="out_of_stock",
                    source_file=file.filename,
                    row_number=idx + 2,
                    original_data=json.dumps(row.to_dict(), ensure_ascii=False),
                    error_message=str(e),
                    suggestion="请检查商品ID和库存数量",
                    resolved=False
                )
                db.add(error_record)
        
        db.commit()
        return BatchResponse(
            batch_id=batch_id,
            message="缺货清单导入完成",
            order_count=0,
            out_of_stock_count=success_count,
            rule_count=0,
            error_count=error_count
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")

@app.post("/api/import/rules", response_model=BatchResponse)
async def import_rules(file: UploadFile = File(...), db: Session = Depends(get_db)):
    batch_id = f"rules_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    error_count = 0
    success_count = 0
    
    try:
        contents = await file.read()
        rules_data = json.loads(contents)
        
        if not isinstance(rules_data, list):
            rules_data = [rules_data]
        
        for idx, rule in enumerate(rules_data):
            try:
                rule_id = str(rule.get("rule_id", "")).strip()
                if not rule_id:
                    raise ValueError("rule_id不能为空")
                
                compensation_type = rule.get("compensation_type", "")
                if compensation_type not in ["refund", "exchange", "coupon"]:
                    raise ValueError(f"补偿类型不支持: {compensation_type}")
                
                rule_record = CompensationRule(
                    rule_id=rule_id,
                    rule_type=str(rule.get("rule_type", "")),
                    condition_type=str(rule.get("condition_type", "")),
                    condition_value=float(rule.get("condition_value", 0)),
                    compensation_type=compensation_type,
                    compensation_value=float(rule.get("compensation_value", 0)),
                    description=str(rule.get("description", "")),
                    batch_id=batch_id
                )
                db.add(rule_record)
                success_count += 1
            except Exception as e:
                error_count += 1
                error_record = ErrorRecord(
                    batch_id=batch_id,
                    source_type="rules",
                    source_file=file.filename,
                    row_number=idx + 1,
                    original_data=json.dumps(rule, ensure_ascii=False),
                    error_message=str(e),
                    suggestion="请检查规则ID和补偿类型",
                    resolved=False
                )
                db.add(error_record)
        
        db.commit()
        return BatchResponse(
            batch_id=batch_id,
            message="补偿规则导入完成",
            order_count=0,
            out_of_stock_count=0,
            rule_count=success_count,
            error_count=error_count
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")

@app.post("/api/reconciliation/process/{batch_id}")
async def process_reconciliation(batch_id: str, db: Session = Depends(get_db)):
    orders = db.query(OrderRecord).filter(OrderRecord.batch_id.like(f"%{batch_id}%")).all()
    out_of_stock = db.query(OutOfStockItem).filter(OutOfStockItem.batch_id.like(f"%{batch_id}%")).all()
    rules = db.query(CompensationRule).filter(CompensationRule.batch_id.like(f"%{batch_id}%")).all()
    
    if not orders:
        raise HTTPException(status_code=404, detail="未找到该批次的订单数据")
    
    oos_dict = {item.product_id: item.stock_quantity for item in out_of_stock}
    results = []
    processed_count = 0
    
    for order in orders:
        product_id = order.product_id
        ordered_qty = order.quantity
        stock_qty = oos_dict.get(product_id, ordered_qty)
        
        if stock_qty >= ordered_qty:
            oos_qty = 0
            comp_type = "none"
            comp_amount = 0
            comp_desc = "库存充足，无需补偿"
            final_status = "normal"
        else:
            oos_qty = ordered_qty - stock_qty
            applicable_rule = None
            for rule in rules:
                if rule.condition_type == "quantity" and oos_qty >= rule.condition_value:
                    applicable_rule = rule
                    break
                if rule.condition_type == "amount" and (oos_qty * order.price) >= rule.condition_value:
                    applicable_rule = rule
                    break
            
            if applicable_rule:
                comp_type = applicable_rule.compensation_type
                if comp_type == "refund":
                    comp_amount = oos_qty * order.price * applicable_rule.compensation_value
                else:
                    comp_amount = applicable_rule.compensation_value
                comp_desc = applicable_rule.description
                final_status = f"compensated_{comp_type}"
            else:
                comp_type = "manual"
                comp_amount = 0
                comp_desc = "无匹配规则，需人工处理"
                final_status = "pending_manual"
        
        result = ReconciliationResult(
            order_id=order.order_id,
            user_id=order.user_id,
            user_name=order.user_name,
            user_phone=order.user_phone,
            product_id=product_id,
            product_name=order.product_name,
            original_quantity=ordered_qty,
            original_amount=order.total_amount,
            out_of_stock_quantity=oos_qty,
            compensation_type=comp_type,
            compensation_amount=round(comp_amount, 2),
            compensation_description=comp_desc,
            final_status=final_status,
            batch_id=batch_id
        )
        db.add(result)
        results.append(result)
        processed_count += 1
    
    db.commit()
    return {
        "batch_id": batch_id,
        "message": "对账处理完成",
        "processed_count": processed_count,
        "refund_count": len([r for r in results if r.compensation_type == "refund"]),
        "exchange_count": len([r for r in results if r.compensation_type == "exchange"]),
        "coupon_count": len([r for r in results if r.compensation_type == "coupon"]),
        "manual_count": len([r for r in results if r.compensation_type == "manual"])
    }

@app.get("/api/results/{batch_id}")
async def get_results(batch_id: str, db: Session = Depends(get_db)):
    results = db.query(ReconciliationResult).filter(ReconciliationResult.batch_id == batch_id).all()
    return {
        "batch_id": batch_id,
        "total_count": len(results),
        "results": [
            mask_sensitive_fields({
                "order_id": r.order_id,
                "user_id": r.user_id,
                "user_name": r.user_name,
                "user_phone": r.user_phone,
                "product_name": r.product_name,
                "original_quantity": r.original_quantity,
                "out_of_stock_quantity": r.out_of_stock_quantity,
                "compensation_type": r.compensation_type,
                "compensation_amount": r.compensation_amount,
                "compensation_description": r.compensation_description,
                "final_status": r.final_status
            }) for r in results
        ]
    }

@app.get("/api/errors/{batch_id}")
async def get_errors(batch_id: str, db: Session = Depends(get_db)):
    errors = db.query(ErrorRecord).filter(ErrorRecord.batch_id == batch_id).all()
    return {
        "batch_id": batch_id,
        "error_count": len(errors),
        "errors": [
            {
                "row_number": e.row_number,
                "original_data": e.original_data,
                "error_message": e.error_message,
                "suggestion": e.suggestion,
                "resolved": e.resolved,
                "created_at": e.created_at.isoformat()
            } for e in errors
        ]
    }

@app.get("/api/batches")
async def get_batches(db: Session = Depends(get_db)):
    from sqlalchemy import union_all, select
    order_batches = db.query(OrderRecord.batch_id, OrderRecord.created_at).distinct().all()
    result_batches = db.query(ReconciliationResult.batch_id, ReconciliationResult.created_at).distinct().all()
    
    all_batches = {}
    for batch_id, created_at in order_batches + result_batches:
        if batch_id not in all_batches or created_at < all_batches[batch_id]:
            all_batches[batch_id] = created_at
    
    return {
        "batches": [
            {
                "batch_id": bid,
                "created_at": cat.isoformat(),
                "type": "orders" if bid.startswith("orders_") else "stock" if bid.startswith("stock_") else "rules" if bid.startswith("rules_") else "reconciliation"
            } for bid, cat in sorted(all_batches.items(), key=lambda x: x[1], reverse=True)
        ]
    }

@app.get("/api/export/{batch_id}")
async def export_results(batch_id: str, db: Session = Depends(get_db)):
    results = db.query(ReconciliationResult).filter(ReconciliationResult.batch_id == batch_id).all()
    if not results:
        raise HTTPException(status_code=404, detail="未找到该批次数据")
    
    export_data = []
    for r in results:
        masked = mask_sensitive_fields({
            "order_id": r.order_id,
            "user_id": r.user_id,
            "user_name": r.user_name,
            "user_phone": r.user_phone,
            "product_id": r.product_id,
            "product_name": r.product_name,
            "original_quantity": r.original_quantity,
            "original_amount": r.original_amount,
            "out_of_stock_quantity": r.out_of_stock_quantity,
            "compensation_type": r.compensation_type,
            "compensation_amount": r.compensation_amount,
            "compensation_description": r.compensation_description,
            "final_status": r.final_status
        })
        export_data.append(masked)
    
    df = pd.DataFrame(export_data)
    output_path = f"./export_{batch_id}.csv"
    df.to_csv(output_path, index=False, encoding="utf-8-sig")
    
    return {
        "batch_id": batch_id,
        "message": "导出成功",
        "file_path": os.path.abspath(output_path),
        "record_count": len(export_data)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
