import io
import csv
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.database import get_db, engine, Base
from app.models import (
    CustomerDemand, AuntProfile, TrialSchedule, Deposit, Review, Conversion, AuditLog,
    TrialScheduleStatus, DepositStatus, ReviewStatus, ConversionStatus
)
from app.schemas import (
    CustomerDemandCreate, CustomerDemandUpdate, CustomerDemand as CustomerDemandSchema,
    AuntProfileCreate, AuntProfileUpdate, AuntProfile as AuntProfileSchema,
    TrialScheduleCreate, TrialScheduleUpdate, TrialSchedule as TrialScheduleSchema,
    TrialScheduleDetail,
    DepositCreate, DepositUpdate, Deposit as DepositSchema,
    ReviewCreate, ReviewUpdate, Review as ReviewSchema,
    ConversionCreate, ConversionUpdate, Conversion as ConversionSchema,
    CloseDemandRequest, CancelScheduleRequest,
    ReviewDecisionRequest, ConversionDecisionRequest,
    WithdrawConversionRequest, ManualCorrectionRequest,
    AuditLog as AuditLogSchema
)
from app.business_rules import (
    check_schedule_conflict, can_pay_deposit, can_refund_deposit,
    can_convert_deposit, can_submit_review, can_review_approval,
    check_conversion_eligibility, can_transition_conversion_status,
    create_audit_log, update_aunt_status_when_schedule,
    update_aunt_status_when_conversion, update_demand_status_when_schedule,
    update_demand_status_when_conversion
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="试工排期押金转正结论后端API", version="1.0.0")


@app.get("/")
def read_root():
    return {"message": "试工排期押金转正结论系统API", "version": "1.0.0"}


@app.post("/customer-demands/", response_model=CustomerDemandSchema)
def create_customer_demand(demand: CustomerDemandCreate, db: Session = Depends(get_db)):
    db_demand = CustomerDemand(**demand.model_dump())
    db.add(db_demand)
    db.commit()
    db.refresh(db_demand)
    create_audit_log(db, "create", "customer_demand", db_demand.id, demand.model_dump(), "system", "创建客户需求成功")
    return db_demand


@app.get("/customer-demands/", response_model=List[CustomerDemandSchema])
def list_customer_demands(
    skip: int = 0, limit: int = 100,
    status: Optional[str] = None,
    customer_name: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(CustomerDemand)
    if status:
        query = query.filter(CustomerDemand.status == status)
    if customer_name:
        query = query.filter(CustomerDemand.customer_name.contains(customer_name))
    return query.offset(skip).limit(limit).all()


@app.get("/customer-demands/{demand_id}", response_model=CustomerDemandSchema)
def get_customer_demand(demand_id: int, db: Session = Depends(get_db)):
    demand = db.query(CustomerDemand).filter(CustomerDemand.id == demand_id).first()
    if not demand:
        raise HTTPException(status_code=404, detail="客户需求不存在")
    return demand


@app.put("/customer-demands/{demand_id}", response_model=CustomerDemandSchema)
def update_customer_demand(demand_id: int, demand_update: CustomerDemandUpdate, db: Session = Depends(get_db)):
    demand = db.query(CustomerDemand).filter(CustomerDemand.id == demand_id).first()
    if not demand:
        raise HTTPException(status_code=404, detail="客户需求不存在")
    
    update_data = demand_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(demand, key, value)
    
    db.commit()
    db.refresh(demand)
    create_audit_log(db, "update", "customer_demand", demand_id, update_data, "system", "更新客户需求成功")
    return demand


@app.post("/customer-demands/{demand_id}/close", response_model=CustomerDemandSchema)
def close_customer_demand(demand_id: int, request: CloseDemandRequest, db: Session = Depends(get_db)):
    demand = db.query(CustomerDemand).filter(CustomerDemand.id == demand_id).first()
    if not demand:
        raise HTTPException(status_code=404, detail="客户需求不存在")
    
    if demand.is_closed:
        raise HTTPException(status_code=400, detail="客户需求已关闭")
    
    demand.is_closed = True
    demand.closed_reason = request.reason
    demand.closed_by = request.closed_by
    db.commit()
    db.refresh(demand)
    
    create_audit_log(db, "close", "customer_demand", demand_id, request.model_dump(), request.closed_by, "关闭客户需求成功")
    return demand


@app.post("/aunt-profiles/", response_model=AuntProfileSchema)
def create_aunt_profile(aunt: AuntProfileCreate, db: Session = Depends(get_db)):
    existing = db.query(AuntProfile).filter(AuntProfile.id_card == aunt.id_card).first()
    if existing:
        raise HTTPException(status_code=400, detail="身份证号已存在")
    
    db_aunt = AuntProfile(**aunt.model_dump())
    db.add(db_aunt)
    db.commit()
    db.refresh(db_aunt)
    create_audit_log(db, "create", "aunt_profile", db_aunt.id, aunt.model_dump(), "system", "创建阿姨档案成功")
    return db_aunt


@app.get("/aunt-profiles/", response_model=List[AuntProfileSchema])
def list_aunt_profiles(
    skip: int = 0, limit: int = 100,
    status: Optional[str] = None,
    name: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(AuntProfile)
    if status:
        query = query.filter(AuntProfile.status == status)
    if name:
        query = query.filter(AuntProfile.name.contains(name))
    return query.offset(skip).limit(limit).all()


@app.get("/aunt-profiles/{aunt_id}", response_model=AuntProfileSchema)
def get_aunt_profile(aunt_id: int, db: Session = Depends(get_db)):
    aunt = db.query(AuntProfile).filter(AuntProfile.id == aunt_id).first()
    if not aunt:
        raise HTTPException(status_code=404, detail="阿姨档案不存在")
    return aunt


@app.put("/aunt-profiles/{aunt_id}", response_model=AuntProfileSchema)
def update_aunt_profile(aunt_id: int, aunt_update: AuntProfileUpdate, db: Session = Depends(get_db)):
    aunt = db.query(AuntProfile).filter(AuntProfile.id == aunt_id).first()
    if not aunt:
        raise HTTPException(status_code=404, detail="阿姨档案不存在")
    
    update_data = aunt_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(aunt, key, value)
    
    db.commit()
    db.refresh(aunt)
    create_audit_log(db, "update", "aunt_profile", aunt_id, update_data, "system", "更新阿姨档案成功")
    return aunt


@app.post("/trial-schedules/", response_model=TrialScheduleSchema)
def create_trial_schedule(schedule: TrialScheduleCreate, db: Session = Depends(get_db)):
    demand = db.query(CustomerDemand).filter(CustomerDemand.id == schedule.demand_id).first()
    if not demand:
        create_audit_log(db, "create_failed", "trial_schedule", None, schedule.model_dump(), schedule.created_by, "创建试工排期失败: 客户需求不存在")
        raise HTTPException(status_code=404, detail="客户需求不存在")
    
    aunt = db.query(AuntProfile).filter(AuntProfile.id == schedule.aunt_id).first()
    if not aunt:
        create_audit_log(db, "create_failed", "trial_schedule", None, schedule.model_dump(), schedule.created_by, "创建试工排期失败: 阿姨档案不存在")
        raise HTTPException(status_code=404, detail="阿姨档案不存在")
    
    conflicts = check_schedule_conflict(db, schedule.aunt_id, schedule.trial_start_time, schedule.trial_end_time)
    if conflicts:
        conflict_info = [f"ID:{c.id} {c.trial_start_time}~{c.trial_end_time}" for c in conflicts]
        conclusion = f"创建试工排期失败: 阿姨排期冲突 {', '.join(conflict_info)}"
        create_audit_log(db, "create_failed", "trial_schedule", None, schedule.model_dump(), schedule.created_by, conclusion)
        raise HTTPException(status_code=400, detail=f"阿姨排期冲突: {', '.join(conflict_info)}")
    
    if schedule.trial_end_time <= schedule.trial_start_time:
        create_audit_log(db, "create_failed", "trial_schedule", None, schedule.model_dump(), schedule.created_by, "创建试工排期失败: 试工结束时间必须晚于开始时间")
        raise HTTPException(status_code=400, detail="试工结束时间必须晚于开始时间")
    
    db_schedule = TrialSchedule(**schedule.model_dump())
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    
    update_aunt_status_when_schedule(db, schedule.aunt_id)
    update_demand_status_when_schedule(db, schedule.demand_id)
    
    create_audit_log(db, "create", "trial_schedule", db_schedule.id, schedule.model_dump(), schedule.created_by, "创建试工排期成功")
    return db_schedule


@app.get("/trial-schedules/", response_model=List[TrialScheduleSchema])
def list_trial_schedules(
    skip: int = 0, limit: int = 100,
    status: Optional[str] = None,
    demand_id: Optional[int] = None,
    aunt_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(TrialSchedule)
    if status:
        query = query.filter(TrialSchedule.status == status)
    if demand_id:
        query = query.filter(TrialSchedule.demand_id == demand_id)
    if aunt_id:
        query = query.filter(TrialSchedule.aunt_id == aunt_id)
    return query.offset(skip).limit(limit).all()


@app.get("/trial-schedules/{schedule_id}", response_model=TrialScheduleDetail)
def get_trial_schedule(schedule_id: int, db: Session = Depends(get_db)):
    schedule = db.query(TrialSchedule).filter(TrialSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="试工排期不存在")
    return schedule


@app.put("/trial-schedules/{schedule_id}", response_model=TrialScheduleSchema)
def update_trial_schedule(schedule_id: int, schedule_update: TrialScheduleUpdate, db: Session = Depends(get_db)):
    schedule = db.query(TrialSchedule).filter(TrialSchedule.id == schedule_id).first()
    if not schedule:
        create_audit_log(db, "update_failed", "trial_schedule", schedule_id, schedule_update.model_dump(exclude_unset=True), "system", "更新试工排期失败: 试工排期不存在")
        raise HTTPException(status_code=404, detail="试工排期不存在")
    
    update_data = schedule_update.model_dump(exclude_unset=True)
    
    if 'trial_start_time' in update_data or 'trial_end_time' in update_data:
        start_time = update_data.get('trial_start_time', schedule.trial_start_time)
        end_time = update_data.get('trial_end_time', schedule.trial_end_time)
        
        if end_time <= start_time:
            create_audit_log(db, "update_failed", "trial_schedule", schedule_id, update_data, "system", "更新试工排期失败: 试工结束时间必须晚于开始时间")
            raise HTTPException(status_code=400, detail="试工结束时间必须晚于开始时间")
        
        conflicts = check_schedule_conflict(db, schedule.aunt_id, start_time, end_time, schedule_id)
        if conflicts:
            conflict_info = [f"ID:{c.id} {c.trial_start_time}~{c.trial_end_time}" for c in conflicts]
            conclusion = f"更新试工排期失败: 阿姨排期冲突 {', '.join(conflict_info)}"
            create_audit_log(db, "update_failed", "trial_schedule", schedule_id, update_data, "system", conclusion)
            raise HTTPException(status_code=400, detail=f"阿姨排期冲突: {', '.join(conflict_info)}")
    
    for key, value in update_data.items():
        setattr(schedule, key, value)
    
    db.commit()
    db.refresh(schedule)
    create_audit_log(db, "update", "trial_schedule", schedule_id, update_data, "system", "更新试工排期成功")
    return schedule


@app.post("/trial-schedules/{schedule_id}/cancel", response_model=TrialScheduleSchema)
def cancel_trial_schedule(schedule_id: int, request: CancelScheduleRequest, db: Session = Depends(get_db)):
    schedule = db.query(TrialSchedule).filter(TrialSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="试工排期不存在")
    
    if schedule.is_cancelled:
        raise HTTPException(status_code=400, detail="试工排期已取消")
    
    schedule.is_cancelled = True
    schedule.status = TrialScheduleStatus.CANCELLED
    schedule.cancelled_reason = request.reason
    schedule.cancelled_by = request.cancelled_by
    db.commit()
    db.refresh(schedule)
    
    create_audit_log(db, "cancel", "trial_schedule", schedule_id, request.model_dump(), request.cancelled_by, "取消试工排期成功")
    return schedule


@app.post("/trial-schedules/{schedule_id}/complete", response_model=TrialScheduleSchema)
def complete_trial_schedule(schedule_id: int, db: Session = Depends(get_db)):
    schedule = db.query(TrialSchedule).filter(TrialSchedule.id == schedule_id).first()
    if not schedule:
        create_audit_log(db, "complete_failed", "trial_schedule", schedule_id, {}, "system", "完成试工失败: 试工排期不存在")
        raise HTTPException(status_code=404, detail="试工排期不存在")
    
    if schedule.status == TrialScheduleStatus.CANCELLED or schedule.is_cancelled:
        create_audit_log(db, "complete_failed", "trial_schedule", schedule_id, {}, "system", "完成试工失败: 试工排期已取消")
        raise HTTPException(status_code=400, detail="试工排期已取消")
    
    schedule.status = TrialScheduleStatus.COMPLETED
    db.commit()
    db.refresh(schedule)
    
    create_audit_log(db, "complete", "trial_schedule", schedule_id, {}, "system", "试工完成")
    return schedule


@app.post("/deposits/", response_model=DepositSchema)
def create_deposit(deposit: DepositCreate, db: Session = Depends(get_db)):
    can_pay, message = can_pay_deposit(db, deposit.trial_schedule_id)
    if not can_pay:
        create_audit_log(db, "create_failed", "deposit", None, deposit.model_dump(), deposit.created_by, f"创建押金记录失败: {message}")
        raise HTTPException(status_code=400, detail=message)
    
    db_deposit = Deposit(**deposit.model_dump())
    db.add(db_deposit)
    db.commit()
    db.refresh(db_deposit)
    create_audit_log(db, "create", "deposit", db_deposit.id, deposit.model_dump(), deposit.created_by, "创建押金记录成功")
    return db_deposit


@app.get("/deposits/", response_model=List[DepositSchema])
def list_deposits(
    skip: int = 0, limit: int = 100,
    status: Optional[str] = None,
    trial_schedule_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Deposit)
    if status:
        query = query.filter(Deposit.status == status)
    if trial_schedule_id:
        query = query.filter(Deposit.trial_schedule_id == trial_schedule_id)
    return query.offset(skip).limit(limit).all()


@app.get("/deposits/{deposit_id}", response_model=DepositSchema)
def get_deposit(deposit_id: int, db: Session = Depends(get_db)):
    deposit = db.query(Deposit).filter(Deposit.id == deposit_id).first()
    if not deposit:
        raise HTTPException(status_code=404, detail="押金记录不存在")
    return deposit


@app.post("/deposits/{deposit_id}/pay", response_model=DepositSchema)
def pay_deposit(deposit_id: int, db: Session = Depends(get_db)):
    deposit = db.query(Deposit).filter(Deposit.id == deposit_id).first()
    if not deposit:
        create_audit_log(db, "pay_failed", "deposit", deposit_id, {}, "system", "押金支付失败: 押金记录不存在")
        raise HTTPException(status_code=404, detail="押金记录不存在")
    
    if deposit.status != DepositStatus.PENDING:
        create_audit_log(db, "pay_failed", "deposit", deposit_id, {}, "system", "押金支付失败: 押金状态不是待支付")
        raise HTTPException(status_code=400, detail="押金状态不是待支付")
    
    deposit.status = DepositStatus.PAID
    deposit.paid_at = datetime.now()
    db.commit()
    db.refresh(deposit)
    
    create_audit_log(db, "pay", "deposit", deposit_id, {}, "system", "押金支付成功")
    return deposit


@app.post("/deposits/{deposit_id}/refund", response_model=DepositSchema)
def refund_deposit(deposit_id: int, reason: str = Query(...), operator: str = Query(...), db: Session = Depends(get_db)):
    can_refund, message = can_refund_deposit(db, deposit_id)
    if not can_refund:
        create_audit_log(db, "refund_failed", "deposit", deposit_id, {"reason": reason}, operator, f"押金退款失败: {message}")
        raise HTTPException(status_code=400, detail=message)
    
    deposit = db.query(Deposit).filter(Deposit.id == deposit_id).first()
    deposit.status = DepositStatus.REFUNDED
    deposit.refunded_at = datetime.now()
    deposit.refund_reason = reason
    db.commit()
    db.refresh(deposit)
    
    create_audit_log(db, "refund", "deposit", deposit_id, {"reason": reason}, operator, "押金退款成功")
    return deposit


@app.post("/reviews/", response_model=ReviewSchema)
def create_review(review: ReviewCreate, db: Session = Depends(get_db)):
    can_submit, message = can_submit_review(db, review.trial_schedule_id)
    if not can_submit:
        create_audit_log(db, "create_failed", "review", None, review.model_dump(), review.reviewer, f"创建评价失败: {message}")
        raise HTTPException(status_code=400, detail=message)
    
    db_review = Review(**review.model_dump())
    db_review.status = ReviewStatus.SUBMITTED
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    create_audit_log(db, "create", "review", db_review.id, review.model_dump(), review.reviewer, "创建评价成功")
    return db_review


@app.get("/reviews/", response_model=List[ReviewSchema])
def list_reviews(
    skip: int = 0, limit: int = 100,
    status: Optional[str] = None,
    trial_schedule_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Review)
    if status:
        query = query.filter(Review.status == status)
    if trial_schedule_id:
        query = query.filter(Review.trial_schedule_id == trial_schedule_id)
    return query.offset(skip).limit(limit).all()


@app.get("/reviews/{review_id}", response_model=ReviewSchema)
def get_review(review_id: int, db: Session = Depends(get_db)):
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="评价记录不存在")
    return review


@app.post("/reviews/{review_id}/decision", response_model=ReviewSchema)
def review_decision(review_id: int, request: ReviewDecisionRequest, db: Session = Depends(get_db)):
    can_decide, message = can_review_approval(db, review_id)
    if not can_decide:
        create_audit_log(db, "decision_failed", "review", review_id, request.model_dump(), request.reviewed_by, f"评价复核失败: {message}")
        raise HTTPException(status_code=400, detail=message)
    
    review = db.query(Review).filter(Review.id == review_id).first()
    review.status = request.status
    review.reviewed_by = request.reviewed_by
    review.review_comment = request.review_comment
    review.reviewed_at = datetime.now()
    db.commit()
    db.refresh(review)
    
    create_audit_log(db, "decision", "review", review_id, request.model_dump(), request.reviewed_by, f"评价复核完成，结果: {request.status}")
    return review


@app.post("/conversions/check-eligibility")
def check_eligibility(trial_schedule_id: int, db: Session = Depends(get_db)):
    eligible, message = check_conversion_eligibility(db, trial_schedule_id)
    return {"eligible": eligible, "message": message}


@app.post("/conversions/", response_model=ConversionSchema)
def create_conversion(conversion: ConversionCreate, db: Session = Depends(get_db)):
    existing = db.query(Conversion).filter(Conversion.trial_schedule_id == conversion.trial_schedule_id).first()
    if existing:
        create_audit_log(db, "create_failed", "conversion", None, conversion.model_dump(), conversion.decided_by or "system", "创建转正记录失败: 该试工排期已有转正记录")
        raise HTTPException(status_code=400, detail="该试工排期已有转正记录")
    
    eligible, message = check_conversion_eligibility(db, conversion.trial_schedule_id)
    if not eligible:
        create_audit_log(db, "create_failed", "conversion", None, conversion.model_dump(), conversion.decided_by or "system", f"创建转正记录失败: {message}")
        raise HTTPException(status_code=400, detail=message)
    
    db_conversion = Conversion(**conversion.model_dump())
    db_conversion.status = ConversionStatus.ELIGIBLE
    db.add(db_conversion)
    db.commit()
    db.refresh(db_conversion)
    create_audit_log(db, "create", "conversion", db_conversion.id, conversion.model_dump(), conversion.decided_by or "system", "创建转正确认成功")
    return db_conversion


@app.get("/conversions/", response_model=List[ConversionSchema])
def list_conversions(
    skip: int = 0, limit: int = 100,
    status: Optional[str] = None,
    trial_schedule_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Conversion)
    if status:
        query = query.filter(Conversion.status == status)
    if trial_schedule_id:
        query = query.filter(Conversion.trial_schedule_id == trial_schedule_id)
    return query.offset(skip).limit(limit).all()


@app.get("/conversions/{conversion_id}", response_model=ConversionSchema)
def get_conversion(conversion_id: int, db: Session = Depends(get_db)):
    conversion = db.query(Conversion).filter(Conversion.id == conversion_id).first()
    if not conversion:
        raise HTTPException(status_code=404, detail="转正记录不存在")
    return conversion


@app.post("/conversions/{conversion_id}/decision", response_model=ConversionSchema)
def conversion_decision(conversion_id: int, request: ConversionDecisionRequest, db: Session = Depends(get_db)):
    conversion = db.query(Conversion).filter(Conversion.id == conversion_id).first()
    if not conversion:
        create_audit_log(db, "decision_failed", "conversion", conversion_id, request.model_dump(), request.decided_by, "转正决策失败: 转正记录不存在")
        raise HTTPException(status_code=404, detail="转正记录不存在")
    
    if not can_transition_conversion_status(conversion.status, request.status):
        conclusion = f"转正决策失败: 无法从 {conversion.status} 转换到 {request.status}"
        create_audit_log(db, "decision_failed", "conversion", conversion_id, request.model_dump(), request.decided_by, conclusion)
        raise HTTPException(status_code=400, detail=f"无法从 {conversion.status} 转换到 {request.status}")
    
    conversion.status = request.status
    conversion.decided_by = request.decided_by
    conversion.conclusion = request.conclusion
    conversion.decided_at = datetime.now()
    
    if request.contract_start_date:
        conversion.contract_start_date = request.contract_start_date
    if request.contract_end_date:
        conversion.contract_end_date = request.contract_end_date
    if request.contract_salary:
        conversion.contract_salary = request.contract_salary
    
    db.commit()
    db.refresh(conversion)
    
    if request.status == ConversionStatus.CONVERTED:
        schedule = db.query(TrialSchedule).filter(TrialSchedule.id == conversion.trial_schedule_id).first()
        if schedule:
            update_aunt_status_when_conversion(db, schedule.aunt_id)
            update_demand_status_when_conversion(db, schedule.demand_id)
            
            deposits = db.query(Deposit).filter(
                Deposit.trial_schedule_id == conversion.trial_schedule_id,
                Deposit.status == DepositStatus.PAID
            ).all()
            for deposit in deposits:
                deposit.status = DepositStatus.CONVERTED
            db.commit()
    
    create_audit_log(db, "decision", "conversion", conversion_id, request.model_dump(), request.decided_by, f"转正决策完成，结果: {request.status}")
    return conversion


@app.post("/conversions/{conversion_id}/withdraw", response_model=ConversionSchema)
def withdraw_conversion(conversion_id: int, request: WithdrawConversionRequest, db: Session = Depends(get_db)):
    conversion = db.query(Conversion).filter(Conversion.id == conversion_id).first()
    if not conversion:
        create_audit_log(db, "withdraw_failed", "conversion", conversion_id, request.model_dump(), request.withdrawn_by, "撤回转正失败: 转正记录不存在")
        raise HTTPException(status_code=404, detail="转正记录不存在")
    
    if conversion.is_withdrawn:
        create_audit_log(db, "withdraw_failed", "conversion", conversion_id, request.model_dump(), request.withdrawn_by, "撤回转正失败: 转正记录已撤回")
        raise HTTPException(status_code=400, detail="转正记录已撤回")
    
    conversion.is_withdrawn = True
    conversion.withdrawn_reason = request.reason
    conversion.withdrawn_by = request.withdrawn_by
    db.commit()
    db.refresh(conversion)
    
    create_audit_log(db, "withdraw", "conversion", conversion_id, request.model_dump(), request.withdrawn_by, "撤回转正记录成功")
    return conversion


@app.post("/manual-correction/")
def manual_correction(request: ManualCorrectionRequest, db: Session = Depends(get_db)):
    entity_map = {
        "customer_demand": CustomerDemand,
        "aunt_profile": AuntProfile,
        "trial_schedule": TrialSchedule,
        "deposit": Deposit,
        "review": Review,
        "conversion": Conversion
    }
    
    if request.entity_type not in entity_map:
        raise HTTPException(status_code=400, detail=f"不支持的实体类型: {request.entity_type}")
    
    model = entity_map[request.entity_type]
    entity = db.query(model).filter(model.id == request.entity_id).first()
    
    if not entity:
        raise HTTPException(status_code=404, detail="实体不存在")
    
    original_data = {col.name: getattr(entity, col.name) for col in entity.__table__.columns}
    
    for key, value in request.corrected_data.items():
        if hasattr(entity, key) and key != 'id':
            setattr(entity, key, value)
    
    db.commit()
    db.refresh(entity)
    
    create_audit_log(
        db, "manual_correction", request.entity_type, request.entity_id,
        {"original": original_data, "corrected": request.corrected_data, "reason": request.correction_reason},
        request.corrected_by, "人工修正成功"
    )
    
    return {"message": "人工修正成功", "entity_type": request.entity_type, "entity_id": request.entity_id}


@app.get("/audit-logs/", response_model=List[AuditLogSchema])
def list_audit_logs(
    skip: int = 0, limit: int = 100,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    operation_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.filter(AuditLog.entity_id == entity_id)
    if operation_type:
        query = query.filter(AuditLog.operation_type == operation_type)
    return query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()


@app.get("/export/trial-schedules/")
def export_trial_schedules(
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    query = db.query(TrialSchedule)
    if status:
        query = query.filter(TrialSchedule.status == status)
    if start_date:
        query = query.filter(TrialSchedule.trial_start_time >= start_date)
    if end_date:
        query = query.filter(TrialSchedule.trial_end_time <= end_date)
    
    schedules = query.all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        '排期ID', '客户姓名', '阿姨姓名', '试工开始时间', '试工结束时间',
        '试工地址', '试工费用', '状态', '创建人', '创建时间'
    ])
    
    for s in schedules:
        writer.writerow([
            s.id,
            s.customer_demand.customer_name if s.customer_demand else '',
            s.aunt.name if s.aunt else '',
            s.trial_start_time.strftime('%Y-%m-%d %H:%M:%S') if s.trial_start_time else '',
            s.trial_end_time.strftime('%Y-%m-%d %H:%M:%S') if s.trial_end_time else '',
            s.trial_address or '',
            s.trial_fee or '',
            s.status,
            s.created_by or '',
            s.created_at.strftime('%Y-%m-%d %H:%M:%S') if s.created_at else ''
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=trial_schedules_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"}
    )


@app.get("/export/conversions/")
def export_conversions(
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Conversion)
    if status:
        query = query.filter(Conversion.status == status)
    
    conversions = query.all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        '转正ID', '排期ID', '客户姓名', '阿姨姓名', '状态',
        '合同开始日期', '合同结束日期', '合同薪资', '结论',
        '决策人', '决策时间'
    ])
    
    for c in conversions:
        schedule = c.trial_schedule
        writer.writerow([
            c.id,
            c.trial_schedule_id,
            schedule.customer_demand.customer_name if schedule and schedule.customer_demand else '',
            schedule.aunt.name if schedule and schedule.aunt else '',
            c.status,
            c.contract_start_date.strftime('%Y-%m-%d') if c.contract_start_date else '',
            c.contract_end_date.strftime('%Y-%m-%d') if c.contract_end_date else '',
            c.contract_salary or '',
            c.conclusion or '',
            c.decided_by or '',
            c.decided_at.strftime('%Y-%m-%d %H:%M:%S') if c.decided_at else ''
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=conversions_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"}
    )
