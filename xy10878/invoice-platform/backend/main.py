from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List
import os

from database import init_db, get_db
from models import InvoiceStatus
from schemas import (
    CustomerCreate, CustomerResponse,
    PricingRuleCreate, PricingRuleResponse,
    CallDetailImport, CallDetailResponse,
    BillingPeriodCreate, BillingPeriodResponse, BillingPeriodWithDetails,
    BillingSummaryResponse,
    AdjustmentCreate, AdjustmentResponse,
    InvoiceSubmit, InvoiceResponse, InvoiceReject,
    VarianceRecordResponse,
    LockPeriodResponse, ExportResponse
)
import services

app = FastAPI(title="用量计费发票台", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    init_db()

@app.get("/")
def root():
    return {"message": "用量计费发票台 API"}

@app.post("/customers/", response_model=CustomerResponse)
def create_customer(customer: CustomerCreate, db: Session = Depends(get_db)):
    return services.create_customer(db, customer)

@app.get("/customers/", response_model=List[CustomerResponse])
def list_customers(db: Session = Depends(get_db)):
    from models import Customer
    return db.query(Customer).all()

@app.get("/customers/{customer_id}", response_model=CustomerResponse)
def get_customer(customer_id: str, db: Session = Depends(get_db)):
    customer = services.get_customer(db, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")
    return customer

@app.post("/pricing-rules/", response_model=PricingRuleResponse)
def create_pricing_rule(rule: PricingRuleCreate, db: Session = Depends(get_db)):
    return services.create_pricing_rule(db, rule)

@app.get("/pricing-rules/", response_model=List[PricingRuleResponse])
def list_pricing_rules(customer_id: str = None, db: Session = Depends(get_db)):
    return services.get_pricing_rules(db, customer_id)

@app.post("/call-details/import/", response_model=List[CallDetailResponse])
def import_call_details(calls: CallDetailImport, db: Session = Depends(get_db)):
    return services.import_call_details(db, calls)

@app.get("/call-details/", response_model=List[CallDetailResponse])
def list_call_details(customer_id: str = None, db: Session = Depends(get_db)):
    from models import CallDetail
    query = db.query(CallDetail)
    if customer_id:
        query = query.filter(CallDetail.customer_id == customer_id)
    return query.order_by(CallDetail.call_time.desc()).limit(100).all()

@app.post("/billing-periods/", response_model=BillingPeriodResponse)
def create_billing_period(period: BillingPeriodCreate, db: Session = Depends(get_db)):
    period_obj, created = services.create_billing_period(db, period)
    return period_obj

@app.get("/billing-periods/", response_model=List[BillingPeriodResponse])
def list_billing_periods(customer_id: str = None, db: Session = Depends(get_db)):
    return services.get_billing_periods(db, customer_id)

@app.get("/billing-periods/{period_id}", response_model=BillingPeriodWithDetails)
def get_billing_period(period_id: str, db: Session = Depends(get_db)):
    from models import BillingPeriod
    period = db.query(BillingPeriod).filter(BillingPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="账期不存在")
    
    summaries = services.get_billing_summaries(db, period_id)
    from models import Invoice
    invoice = db.query(Invoice).filter(Invoice.billing_period_id == period_id).first()
    from models import VarianceRecord
    variances = db.query(VarianceRecord).join(Invoice).filter(
        Invoice.billing_period_id == period_id
    ).all() if invoice else []
    
    return {
        **period.__dict__,
        "summaries": summaries,
        "invoice": invoice,
        "variances": variances
    }

@app.post("/billing-periods/{period_id}/lock/", response_model=LockPeriodResponse)
def lock_billing_period(period_id: str, db: Session = Depends(get_db)):
    period, message, summaries = services.lock_billing_period(db, period_id)
    if not period:
        raise HTTPException(status_code=400, detail=message)
    return {
        "success": True,
        "message": message,
        "billing_period": period,
        "summaries": summaries
    }

@app.get("/billing-periods/{period_id}/summaries/", response_model=List[BillingSummaryResponse])
def get_billing_summaries(period_id: str, db: Session = Depends(get_db)):
    return services.get_billing_summaries(db, period_id)

@app.post("/adjustments/", response_model=AdjustmentResponse)
def create_adjustment(adjustment: AdjustmentCreate, db: Session = Depends(get_db)):
    adj, message = services.create_adjustment(db, adjustment)
    if not adj:
        raise HTTPException(status_code=400, detail=message)
    return adj

@app.post("/invoices/submit/", response_model=InvoiceResponse)
def submit_invoice(invoice_data: InvoiceSubmit, db: Session = Depends(get_db)):
    invoice, message = services.submit_invoice(db, invoice_data)
    if not invoice:
        raise HTTPException(status_code=400, detail=message)
    return invoice

@app.post("/invoices/{invoice_id}/approve/", response_model=InvoiceResponse)
def approve_invoice(invoice_id: str, db: Session = Depends(get_db)):
    invoice, message = services.approve_invoice(db, invoice_id)
    if not invoice:
        raise HTTPException(status_code=400, detail=message)
    return invoice

@app.post("/invoices/{invoice_id}/reject/", response_model=InvoiceResponse)
def reject_invoice(invoice_id: str, reject_data: InvoiceReject, db: Session = Depends(get_db)):
    invoice, message = services.reject_invoice(db, invoice_id, reject_data)
    if not invoice:
        raise HTTPException(status_code=400, detail=message)
    return invoice

@app.get("/invoices/", response_model=List[InvoiceResponse])
def list_invoices(customer_id: str = None, status: InvoiceStatus = None, db: Session = Depends(get_db)):
    return services.get_invoices(db, customer_id, status)

@app.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(invoice_id: str, db: Session = Depends(get_db)):
    invoice = services.get_invoice(db, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="发票不存在")
    return invoice

@app.get("/invoices/{invoice_id}/variances/", response_model=List[VarianceRecordResponse])
def get_invoice_variances(invoice_id: str, db: Session = Depends(get_db)):
    from models import VarianceRecord
    return db.query(VarianceRecord).filter(VarianceRecord.invoice_id == invoice_id).all()

@app.post("/invoices/{invoice_id}/export/", response_model=ExportResponse)
def export_invoice(invoice_id: str, db: Session = Depends(get_db)):
    export_dir = "../exports"
    file_path, message = services.export_invoice_details(db, invoice_id, export_dir)
    if not file_path:
        raise HTTPException(status_code=400, detail=message)
    return {
        "success": True,
        "message": message,
        "file_path": file_path
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
