from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
from models import Settlement as SettlementModel, WeighingRecord as WeighingModel
from models import Customer as CustomerModel, Price as PriceModel, Category as CategoryModel
from datetime import datetime

router = APIRouter()


@router.get("/settlement/{settlement_id}")
def export_settlement(settlement_id: int, db: Session = Depends(get_db)):
    settlement = db.query(SettlementModel).filter(SettlementModel.id == settlement_id).first()
    if not settlement:
        raise HTTPException(status_code=404, detail="结算记录不存在")
    
    customer = db.query(CustomerModel).filter(CustomerModel.id == settlement.customer_id).first()
    
    weighings = db.query(WeighingModel).filter(WeighingModel.settlement_id == settlement_id).all()
    
    weighing_details = []
    for w in weighings:
        category = db.query(CategoryModel).filter(CategoryModel.id == w.category_id).first()
        price = db.query(PriceModel).filter(PriceModel.id == w.price_id).first() if w.price_id else None
        
        weighing_details.append({
            "record_no": w.record_no,
            "category": category.name if category else None,
            "category_code": category.code if category else None,
            "gross_weight": w.gross_weight,
            "tare_weight": w.tare_weight,
            "net_weight": w.net_weight,
            "price": price.price if price else None,
            "price_version": price.version if price else None,
            "deducted_weight": w.deducted_weight,
            "final_weight": w.final_weight,
            "amount": w.final_weight * price.price if price and w.final_weight else None,
            "weigher": w.weigher,
            "weighed_at": w.weighed_at.isoformat() if w.weighed_at else None
        })
    
    report = {
        "report_type": "结算报告",
        "exported_at": datetime.utcnow().isoformat(),
        "settlement": {
            "settlement_no": settlement.settlement_no,
            "settled_at": settlement.settled_at.isoformat() if settlement.settled_at else None,
            "settled_by": settlement.settled_by,
            "reviewed_by": settlement.reviewed_by,
            "reviewed_at": settlement.reviewed_at.isoformat() if settlement.reviewed_at else None,
            "status": settlement.status
        },
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "phone": customer.phone,
            "contact": customer.contact
        } if customer else None,
        "weighing_details": weighing_details,
        "summary": {
            "weighing_count": len(weighings),
            "total_weight": settlement.total_weight,
            "total_amount": settlement.total_amount
        }
    }
    
    return JSONResponse(
        content=report,
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=settlement_{settlement.settlement_no}.json"
        }
    )


@router.get("/customer/{customer_id}/statement")
def export_customer_statement(customer_id: int, start_date: str = None, end_date: str = None,
                              db: Session = Depends(get_db)):
    customer = db.query(CustomerModel).filter(CustomerModel.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")
    
    query = db.query(SettlementModel).filter(SettlementModel.customer_id == customer_id)
    
    if start_date:
        try:
            start = datetime.fromisoformat(start_date)
            query = query.filter(SettlementModel.settled_at >= start)
        except ValueError:
            raise HTTPException(status_code=400, detail="开始日期格式错误")
    
    if end_date:
        try:
            end = datetime.fromisoformat(end_date)
            query = query.filter(SettlementModel.settled_at <= end)
        except ValueError:
            raise HTTPException(status_code=400, detail="结束日期格式错误")
    
    settlements = query.order_by(SettlementModel.settled_at.desc()).all()
    
    settlement_list = []
    total_amount_all = 0
    
    for s in settlements:
        settlement_list.append({
            "settlement_no": s.settlement_no,
            "settled_at": s.settled_at.isoformat() if s.settled_at else None,
            "total_weight": s.total_weight,
            "total_amount": s.total_amount,
            "status": s.status
        })
        total_amount_all += s.total_amount or 0
    
    report = {
        "report_type": "客户对账单",
        "exported_at": datetime.utcnow().isoformat(),
        "date_range": {
            "start_date": start_date,
            "end_date": end_date
        },
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "phone": customer.phone,
            "contact": customer.contact,
            "address": customer.address
        },
        "settlements": settlement_list,
        "summary": {
            "settlement_count": len(settlements),
            "total_amount": total_amount_all
        }
    }
    
    return JSONResponse(
        content=report,
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=statement_{customer.id}_{datetime.utcnow().strftime('%Y%m%d')}.json"
        }
    )
