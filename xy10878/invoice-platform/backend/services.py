from sqlalchemy.orm import Session
from models import (
    Customer, PricingRule, CallDetail, BillingPeriod,
    BillingSummary, Adjustment, Invoice, VarianceRecord, InvoiceStatus
)
from schemas import (
    CallDetailCreate, BillingPeriodCreate, AdjustmentCreate,
    InvoiceSubmit, InvoiceReject
)
from datetime import datetime
import uuid
from collections import defaultdict
import pandas as pd
import os

def generate_id():
    return str(uuid.uuid4())

def get_customer(db: Session, customer_id: str):
    return db.query(Customer).filter(Customer.id == customer_id).first()

def create_customer(db: Session, customer_data):
    db_customer = Customer(**customer_data.model_dump())
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer

def get_pricing_rules(db: Session, customer_id: str = None):
    query = db.query(PricingRule).filter(PricingRule.is_active == True)
    if customer_id:
        query = query.filter(PricingRule.customer_id == customer_id)
    return query.all()

def create_pricing_rule(db: Session, rule_data):
    db_rule = PricingRule(**rule_data.model_dump())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule

def import_call_details(db: Session, calls_data):
    imported = []
    for call in calls_data.calls:
        db_call = CallDetail(**call.model_dump())
        db.add(db_call)
        imported.append(db_call)
    db.commit()
    for call in imported:
        db.refresh(call)
    return imported

def get_unbilled_calls(db: Session, customer_id: str, start_date: datetime, end_date: datetime):
    return db.query(CallDetail).filter(
        CallDetail.customer_id == customer_id,
        CallDetail.call_time >= start_date,
        CallDetail.call_time < end_date,
        CallDetail.is_billed == False
    ).all()

def get_applicable_rule(db: Session, customer_id: str, call_date: datetime):
    return db.query(PricingRule).filter(
        PricingRule.customer_id == customer_id,
        PricingRule.is_active == True,
        PricingRule.effective_date <= call_date,
        (PricingRule.end_date == None) | (PricingRule.end_date > call_date)
    ).order_by(PricingRule.effective_date.desc()).first()

def create_billing_period(db: Session, period_data):
    existing = db.query(BillingPeriod).filter(
        BillingPeriod.customer_id == period_data.customer_id,
        BillingPeriod.period_start == period_data.period_start,
        BillingPeriod.period_end == period_data.period_end
    ).first()
    if existing:
        return existing, False
    
    db_period = BillingPeriod(**period_data.model_dump())
    db.add(db_period)
    db.commit()
    db.refresh(db_period)
    return db_period, True

def lock_billing_period(db: Session, period_id: str):
    period = db.query(BillingPeriod).filter(BillingPeriod.id == period_id).first()
    if not period:
        return None, "账期不存在"
    
    if period.is_locked:
        existing_summaries = db.query(BillingSummary).filter(
            BillingSummary.billing_period_id == period_id
        ).all()
        return period, "账期已锁定，金额不会重复生成", existing_summaries
    
    calls = get_unbilled_calls(db, period.customer_id, period.period_start, period.period_end)
    if not calls:
        return None, "该账期内没有待计费的调用记录"
    
    calls_by_rule = defaultdict(list)
    for call in calls:
        rule = get_applicable_rule(db, period.customer_id, call.call_time)
        if rule:
            call.rule_version = rule.version
            calls_by_rule[rule.version].append(call)
    
    summaries = []
    for rule_version, version_calls in calls_by_rule.items():
        rule = db.query(PricingRule).filter(
            PricingRule.customer_id == period.customer_id,
            PricingRule.version == rule_version
        ).first()
        
        total_calls = len(version_calls)
        free_calls = min(rule.free_quota, total_calls)
        billable_calls = total_calls - free_calls
        base_amount = billable_calls * rule.price_per_call
        
        summary = BillingSummary(
            id=generate_id(),
            billing_period_id=period.id,
            rule_version=rule_version,
            total_calls=total_calls,
            free_calls=free_calls,
            billable_calls=billable_calls,
            base_amount=base_amount,
            manual_discount=0.0,
            manual_surcharge=0.0,
            final_amount=base_amount,
            notes=f"规则版本: {rule_version}, 单价: {rule.price_per_call}元/次, 免费额度: {rule.free_quota}次"
        )
        db.add(summary)
        summaries.append(summary)
        
        for call in version_calls:
            call.billing_period_id = period.id
            call.is_billed = True
    
    period.is_locked = True
    period.locked_at = datetime.utcnow()
    db.commit()
    
    return period, "账期锁定成功", summaries

def create_adjustment(db: Session, adjustment_data: AdjustmentCreate):
    summary = db.query(BillingSummary).filter(
        BillingSummary.id == adjustment_data.billing_summary_id
    ).first()
    if not summary:
        return None, "计费汇总不存在"
    
    adjustment = Adjustment(
        id=generate_id(),
        **adjustment_data.model_dump()
    )
    db.add(adjustment)
    
    if adjustment_data.adjustment_type == "discount":
        summary.manual_discount += adjustment_data.amount
    elif adjustment_data.adjustment_type == "surcharge":
        summary.manual_surcharge += adjustment_data.amount
    
    summary.final_amount = max(0, summary.base_amount - summary.manual_discount + summary.manual_surcharge)
    
    db.commit()
    db.refresh(adjustment)
    db.refresh(summary)
    
    return adjustment, "调整成功"

def get_billing_summaries(db: Session, period_id: str):
    return db.query(BillingSummary).filter(
        BillingSummary.billing_period_id == period_id
    ).all()

def submit_invoice(db: Session, invoice_data: InvoiceSubmit):
    period = db.query(BillingPeriod).filter(
        BillingPeriod.id == invoice_data.billing_period_id
    ).first()
    if not period:
        return None, "账期不存在"
    if not period.is_locked:
        return None, "请先锁定账期"
    
    existing_invoice = db.query(Invoice).filter(
        Invoice.billing_period_id == invoice_data.billing_period_id
    ).first()
    if existing_invoice and existing_invoice.status not in [InvoiceStatus.REJECTED, InvoiceStatus.DRAFT]:
        return None, "该账期已有有效的发票申请"
    
    summaries = get_billing_summaries(db, invoice_data.billing_period_id)
    total_amount = sum(s.final_amount for s in summaries)
    
    if existing_invoice:
        existing_invoice.total_amount = total_amount
        existing_invoice.status = InvoiceStatus.SUBMITTED
        existing_invoice.submitted_at = datetime.utcnow()
        if invoice_data.invoice_number:
            existing_invoice.invoice_number = invoice_data.invoice_number
        invoice = existing_invoice
        
        db.query(VarianceRecord).filter(
            VarianceRecord.invoice_id == invoice.id
        ).delete()
    else:
        invoice_number = invoice_data.invoice_number or f"INV-{datetime.now().strftime('%Y%m%d')}-{generate_id()[:8]}"
        invoice = Invoice(
            id=generate_id(),
            billing_period_id=invoice_data.billing_period_id,
            invoice_number=invoice_number,
            total_amount=total_amount,
            status=InvoiceStatus.SUBMITTED,
            submitted_at=datetime.utcnow()
        )
        db.add(invoice)
    
    generate_variances(db, invoice, summaries)
    
    db.commit()
    db.refresh(invoice)
    
    return invoice, "发票申请提交成功"

def generate_variances(db: Session, invoice: Invoice, summaries: list):
    period = db.query(BillingPeriod).filter(
        BillingPeriod.id == invoice.billing_period_id
    ).first()
    
    all_adjustments = db.query(Adjustment).join(BillingSummary).filter(
        BillingSummary.billing_period_id == invoice.billing_period_id
    ).all()
    
    adjustments_by_summary = {}
    for adj in all_adjustments:
        if adj.billing_summary_id not in adjustments_by_summary:
            adjustments_by_summary[adj.billing_summary_id] = []
        adjustments_by_summary[adj.billing_summary_id].append(adj)
    
    for summary in summaries:
        rule = db.query(PricingRule).filter(
            PricingRule.customer_id == period.customer_id,
            PricingRule.version == summary.rule_version
        ).first()
        
        expected_base = summary.billable_calls * rule.price_per_call
        if abs(expected_base - summary.base_amount) > 0.01:
            variance = VarianceRecord(
                id=generate_id(),
                invoice_id=invoice.id,
                rule_version=summary.rule_version,
                variance_type="base_amount_mismatch",
                expected_amount=expected_base,
                actual_amount=summary.base_amount,
                variance_amount=summary.base_amount - expected_base,
                description="基础金额计算差异",
                source_rule=f"规则版本: {rule.version}, 单价: {rule.price_per_call}, 计费调用: {summary.billable_calls}"
            )
            db.add(variance)
        
        summary_adjustments = adjustments_by_summary.get(summary.id, [])
        sorted_adjustments = sorted(summary_adjustments, key=lambda x: x.created_at)
        
        current_amount = summary.base_amount
        for adj in sorted_adjustments:
            expected_for_adj = current_amount
            
            if adj.adjustment_type == "discount":
                actual_after_adj = max(0, current_amount - adj.amount)
                variance_amount = -adj.amount
                variance_type = "manual_discount"
                desc_prefix = "人工折扣"
            elif adj.adjustment_type == "surcharge":
                actual_after_adj = current_amount + adj.amount
                variance_amount = adj.amount
                variance_type = "manual_surcharge"
                desc_prefix = "额外收费"
            
            variance = VarianceRecord(
                id=generate_id(),
                invoice_id=invoice.id,
                rule_version=summary.rule_version,
                variance_type=variance_type,
                expected_amount=expected_for_adj,
                actual_amount=actual_after_adj,
                variance_amount=variance_amount,
                description=f"{desc_prefix}: {adj.amount}元, 原因: {adj.reason}, 操作人: {adj.adjusted_by or '未知'}",
                source_rule=f"调整记录ID: {adj.id}, 类型: {'折扣' if adj.adjustment_type == 'discount' else '额外收费'}"
            )
            db.add(variance)
            current_amount = actual_after_adj

def approve_invoice(db: Session, invoice_id: str):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        return None, "发票不存在"
    if invoice.status != InvoiceStatus.SUBMITTED:
        return None, "只有已提交的发票可以审批"
    
    invoice.status = InvoiceStatus.APPROVED
    invoice.approved_at = datetime.utcnow()
    db.commit()
    db.refresh(invoice)
    return invoice, "发票审批通过"

def reject_invoice(db: Session, invoice_id: str, reject_data: InvoiceReject):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        return None, "发票不存在"
    if invoice.status != InvoiceStatus.SUBMITTED:
        return None, "只有已提交的发票可以驳回"
    
    invoice.status = InvoiceStatus.REJECTED
    invoice.rejection_reason = reject_data.rejection_reason
    invoice.rejected_at = datetime.utcnow()
    db.commit()
    db.refresh(invoice)
    return invoice, "发票已驳回"

def get_invoice(db: Session, invoice_id: str):
    return db.query(Invoice).filter(Invoice.id == invoice_id).first()

def get_invoices(db: Session, customer_id: str = None, status: InvoiceStatus = None):
    query = db.query(Invoice)
    if customer_id:
        query = query.join(BillingPeriod).filter(BillingPeriod.customer_id == customer_id)
    if status:
        query = query.filter(Invoice.status == status)
    return query.all()

def get_billing_periods(db: Session, customer_id: str = None):
    query = db.query(BillingPeriod)
    if customer_id:
        query = query.filter(BillingPeriod.customer_id == customer_id)
    return query.order_by(BillingPeriod.created_at.desc()).all()

def export_invoice_details(db: Session, invoice_id: str, export_dir: str):
    invoice = get_invoice(db, invoice_id)
    if not invoice:
        return None, "发票不存在"
    
    period = db.query(BillingPeriod).filter(BillingPeriod.id == invoice.billing_period_id).first()
    customer = get_customer(db, period.customer_id)
    summaries = get_billing_summaries(db, invoice.billing_period_id)
    variances = db.query(VarianceRecord).filter(VarianceRecord.invoice_id == invoice_id).all()
    adjustments = db.query(Adjustment).join(BillingSummary).filter(
        BillingSummary.billing_period_id == invoice.billing_period_id
    ).all()
    
    os.makedirs(export_dir, exist_ok=True)
    file_path = os.path.join(export_dir, f"invoice_{invoice.invoice_number}_details.xlsx")
    
    with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
        summary_data = []
        for s in summaries:
            summary_data.append({
                "规则版本": s.rule_version,
                "总调用次数": s.total_calls,
                "免费调用次数": s.free_calls,
                "计费调用次数": s.billable_calls,
                "基础金额(元)": round(s.base_amount, 2),
                "人工折扣(元)": round(s.manual_discount, 2),
                "最终金额(元)": round(s.final_amount, 2),
                "备注": s.notes
            })
        pd.DataFrame(summary_data).to_excel(writer, sheet_name="计费汇总", index=False)
        
        variance_data = []
        for v in variances:
            variance_data.append({
                "规则版本": v.rule_version,
                "差异类型": v.variance_type,
                "预期金额(元)": round(v.expected_amount, 2),
                "实际金额(元)": round(v.actual_amount, 2),
                "差异金额(元)": round(v.variance_amount, 2),
                "差异说明": v.description,
                "来源规则": v.source_rule
            })
        if variance_data:
            pd.DataFrame(variance_data).to_excel(writer, sheet_name="差异清单", index=False)
        
        adjustment_data = []
        for a in adjustments:
            adjustment_data.append({
                "调整类型": a.adjustment_type,
                "调整金额(元)": round(a.amount, 2),
                "调整原因": a.reason,
                "操作人": a.adjusted_by,
                "调整时间": a.created_at
            })
        if adjustment_data:
            pd.DataFrame(adjustment_data).to_excel(writer, sheet_name="调整记录", index=False)
        
        invoice_info = pd.DataFrame([{
            "发票编号": invoice.invoice_number,
            "客户名称": customer.name,
            "客户ID": customer.id,
            "账期开始": period.period_start,
            "账期结束": period.period_end,
            "总金额(元)": round(invoice.total_amount, 2),
            "状态": invoice.status.value,
            "提交时间": invoice.submitted_at,
            "驳回原因": invoice.rejection_reason
        }])
        invoice_info.to_excel(writer, sheet_name="发票信息", index=False)
    
    return file_path, "导出成功"
