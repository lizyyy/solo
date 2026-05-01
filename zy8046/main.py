from fastapi import FastAPI, File, UploadFile, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import StringIO
from models import init_db, get_db, Order, CabinetEvent, BillingRule
from parsers import parse_orders_csv, parse_events_jsonl, parse_rules_yaml
from reconciliation import run_reconciliation
from exporters import export_discrepancies_csv, export_reconciliation_markdown
from datetime import datetime

app = FastAPI(title="共享充电宝对账服务")

init_db()


@app.post("/import")
async def import_data(
    orders_csv: UploadFile = File(None),
    events_jsonl: UploadFile = File(None),
    rules_yaml: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    result = {
        "orders_imported": 0,
        "events_imported": 0,
        "rules_imported": 0
    }
    
    if orders_csv:
        content = (await orders_csv.read()).decode("utf-8")
        orders = parse_orders_csv(content)
        for order in orders:
            db.merge(order)
        result["orders_imported"] = len(orders)
    
    if events_jsonl:
        content = (await events_jsonl.read()).decode("utf-8")
        events = parse_events_jsonl(content)
        for event in events:
            db.merge(event)
        result["events_imported"] = len(events)
    
    if rules_yaml:
        content = (await rules_yaml.read()).decode("utf-8")
        rules = parse_rules_yaml(content)
        for rule in rules:
            existing = db.query(BillingRule).filter(BillingRule.name == rule.name).first()
            if existing:
                existing.hourly_rate = rule.hourly_rate
                existing.daily_cap = rule.daily_cap
                existing.free_minutes = rule.free_minutes
                existing.config = rule.config
            else:
                db.add(rule)
        result["rules_imported"] = len(rules)
    
    db.commit()
    return result


@app.post("/reconcile")
async def reconcile(db: Session = Depends(get_db)):
    summary = run_reconciliation(db)
    return summary


@app.get("/orders/{order_id}")
async def get_order(order_id: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    events = db.query(CabinetEvent).filter(CabinetEvent.order_id == order_id).all()
    
    return {
        "order": {
            "id": order.id,
            "user_id": order.user_id,
            "cabinet_id": order.cabinet_id,
            "slot_id": order.slot_id,
            "start_time": order.start_time.isoformat(),
            "end_time": order.end_time.isoformat() if order.end_time else None,
            "duration_minutes": order.duration_minutes,
            "amount": order.amount,
            "status": order.status
        },
        "events": [
            {
                "id": e.id,
                "type": e.event_type,
                "time": e.event_time.isoformat(),
                "cabinet_id": e.cabinet_id,
                "slot_id": e.slot_id
            }
            for e in events
        ]
    }


@app.get("/export")
async def export_data(db: Session = Depends(get_db), format: str = "csv"):
    if format == "csv":
        csv_content = export_discrepancies_csv(db)
        return StreamingResponse(
            iter([csv_content]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=discrepancies_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
        )
    elif format == "markdown":
        summary = {
            "total_orders": db.query(Order).count(),
            "total_events": db.query(CabinetEvent).count(),
            "total_discrepancies": db.query(Discrepancy).count(),
            "discrepancies_by_type": {}
        }
        from models import Discrepancy
        types = ["charged_but_not_borrowed", "cross_day_return", "duplicate_slot_event"]
        for t in types:
            summary["discrepancies_by_type"][t] = db.query(Discrepancy).filter(Discrepancy.type == t).count()
        
        md_content = export_reconciliation_markdown(db, summary)
        return StreamingResponse(
            iter([md_content]),
            media_type="text/markdown",
            headers={"Content-Disposition": f"attachment; filename=reconciliation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"}
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid format. Use 'csv' or 'markdown'")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
