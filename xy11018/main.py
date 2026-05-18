from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional
import pandas as pd
from io import BytesIO
import uuid

DATABASE_URL = "sqlite:///./canteen_subsidy.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

app = FastAPI(title="园区食堂餐补跨店核销API", version="1.0.0")


class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True, index=True)
    employee_no = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    department = Column(String(100))
    park_code = Column(String(50), nullable=False)
    park_name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)
    resignation_date = Column(DateTime)
    monthly_quota = Column(Float, default=300.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Store(Base):
    __tablename__ = "stores"
    id = Column(Integer, primary_key=True, index=True)
    store_no = Column(String(50), unique=True, index=True, nullable=False)
    store_name = Column(String(100), nullable=False)
    park_code = Column(String(50), nullable=False)
    park_name = Column(String(100), nullable=False)
    address = Column(String(255))
    contact_person = Column(String(100))
    contact_phone = Column(String(50))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SubsidyTransaction(Base):
    __tablename__ = "subsidy_transactions"
    id = Column(Integer, primary_key=True, index=True)
    transaction_no = Column(String(100), unique=True, index=True, nullable=False)
    employee_no = Column(String(50), index=True, nullable=False)
    employee_name = Column(String(100), nullable=False)
    department = Column(String(100))
    employee_park_code = Column(String(50), nullable=False)
    employee_park_name = Column(String(100), nullable=False)
    store_no = Column(String(50), index=True, nullable=False)
    store_name = Column(String(100), nullable=False)
    store_park_code = Column(String(50), nullable=False)
    store_park_name = Column(String(100), nullable=False)
    transaction_date = Column(DateTime, nullable=False, index=True)
    transaction_amount = Column(Float, nullable=False)
    subsidy_amount = Column(Float, nullable=False)
    personal_pay_amount = Column(Float, default=0.0)
    meal_type = Column(String(50))
    consumption_details = Column(Text)
    is_cross_store = Column(Boolean, default=False)
    is_cross_park = Column(Boolean, default=False)
    status = Column(String(50), default="pending")
    verification_status = Column(String(50), default="unverified")
    required_materials = Column(Text)
    processed_by = Column(String(100))
    processed_at = Column(DateTime)
    remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    audit_logs = relationship("AuditLog", back_populates="transaction")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("subsidy_transactions.id"))
    transaction_no = Column(String(100), index=True)
    action = Column(String(50), nullable=False)
    field_name = Column(String(100))
    old_value = Column(Text)
    new_value = Column(Text)
    operator = Column(String(100))
    operator_role = Column(String(100))
    remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    transaction = relationship("SubsidyTransaction", back_populates="audit_logs")


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class SubsidyTransactionCreate(BaseModel):
    employee_no: str = Field(..., description="员工工号")
    store_no: str = Field(..., description="门店编号")
    transaction_date: datetime = Field(..., description="交易时间")
    transaction_amount: float = Field(..., description="交易总金额")
    subsidy_amount: float = Field(..., description="餐补核销金额")
    personal_pay_amount: Optional[float] = 0.0
    meal_type: Optional[str] = None
    consumption_details: Optional[str] = None
    operator: str = Field(..., description="操作人")
    remarks: Optional[str] = None


class SubsidyTransactionResponse(BaseModel):
    transaction_no: str
    employee_no: str
    employee_name: str
    store_no: str
    store_name: str
    transaction_date: datetime
    transaction_amount: float
    subsidy_amount: float
    status: str
    verification_status: str
    required_materials: Optional[str]
    is_cross_store: bool
    is_cross_park: bool
    created_at: datetime

    class Config:
        orm_mode = True


class MaterialRequirement(BaseModel):
    code: str
    name: str
    description: str
    deadline: Optional[str] = None


class VerificationResult(BaseModel):
    passed: bool
    issues: List[str]
    required_materials: List[MaterialRequirement]
    next_steps: List[str]


class BulkImportResult(BaseModel):
    total_count: int
    success_count: int
    failed_count: int
    failed_items: List[dict]
    verification_summary: dict


def generate_transaction_no():
    return f"ST{datetime.now().strftime('%Y%m%d')}{uuid.uuid4().hex[:8].upper()}"


def record_audit_log(db: Session, transaction_id: int, transaction_no: str, action: str,
                     field_name: str = None, old_value: str = None, new_value: str = None,
                     operator: str = None, operator_role: str = "system", remarks: str = None):
    audit_log = AuditLog(
        transaction_id=transaction_id,
        transaction_no=transaction_no,
        action=action,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
        operator=operator,
        operator_role=operator_role,
        remarks=remarks
    )
    db.add(audit_log)
    db.commit()


def verify_transaction(db: Session, transaction: SubsidyTransaction, employee: Employee) -> VerificationResult:
    issues = []
    required_materials = []
    next_steps = []

    if not employee.is_active:
        issues.append(f"员工{employee.name}已离职，离职日期：{employee.resignation_date.strftime('%Y-%m-%d') if employee.resignation_date else '未记录'}")
        required_materials.append(MaterialRequirement(
            code="RESIGNATION_PROOF",
            name="离职证明",
            description="提供员工离职审批单或HR系统离职记录截图"
        ))
        required_materials.append(MaterialRequirement(
            code="USAGE_EXPLANATION",
            name="异地消费情况说明",
            description="说明离职员工仍在异地门店刷餐补的原因和情况"
        ))
        next_steps.append("联系员工所属部门和HR确认离职状态")
        next_steps.append("核实该笔消费是否为离职后产生的异常消费")

    if transaction.is_cross_park:
        issues.append(f"跨园区消费：员工所属园区{transaction.employee_park_name}，消费园区{transaction.store_park_name}")
        required_materials.append(MaterialRequirement(
            code="CROSS_PARK_APPROVAL",
            name="跨园区就餐审批单",
            description="提供员工跨园区就餐的审批文件或出差证明"
        ))
        required_materials.append(MaterialRequirement(
            code="CONSUMPTION_PROOF",
            name="消费凭证",
            description="提供刷卡记录、小票照片等消费凭证"
        ))
        next_steps.append("确认员工是否有跨园区办公或出差事由")
        next_steps.append("检查跨园区餐补使用的审批流程是否完整")

    if transaction.subsidy_amount > employee.monthly_quota:
        issues.append(f"餐补金额超出月度配额：配额{employee.monthly_quota}元，本次核销{transaction.subsidy_amount}元")
        required_materials.append(MaterialRequirement(
            code="OVER_QUOTA_APPROVAL",
            name="超额使用审批",
            description="提供超出月度配额的特殊审批文件"
        ))
        next_steps.append("核对员工当月累计使用额度")
        next_steps.append("确认超额部分是否有特殊审批")

    if len(issues) == 0:
        return VerificationResult(
            passed=True,
            issues=["无异常"],
            required_materials=[],
            next_steps=["交易验证通过，可正常核销"]
        )

    return VerificationResult(
        passed=False,
        issues=issues,
        required_materials=required_materials,
        next_steps=next_steps
    )


@app.post("/api/transactions/single", response_model=dict)
def create_single_transaction(
    data: SubsidyTransactionCreate,
    db: Session = Depends(get_db)
):
    employee = db.query(Employee).filter(Employee.employee_no == data.employee_no).first()
    if not employee:
        raise HTTPException(status_code=404, detail=f"员工工号{data.employee_no}不存在")

    store = db.query(Store).filter(Store.store_no == data.store_no).first()
    if not store:
        raise HTTPException(status_code=404, detail=f"门店编号{data.store_no}不存在")

    transaction_no = generate_transaction_no()

    is_cross_store = employee.park_code != store.park_code
    is_cross_park = employee.park_code != store.park_code

    transaction = SubsidyTransaction(
        transaction_no=transaction_no,
        employee_no=data.employee_no,
        employee_name=employee.name,
        department=employee.department,
        employee_park_code=employee.park_code,
        employee_park_name=employee.park_name,
        store_no=data.store_no,
        store_name=store.store_name,
        store_park_code=store.park_code,
        store_park_name=store.park_name,
        transaction_date=data.transaction_date,
        transaction_amount=data.transaction_amount,
        subsidy_amount=data.subsidy_amount,
        personal_pay_amount=data.personal_pay_amount or 0.0,
        meal_type=data.meal_type,
        consumption_details=data.consumption_details,
        is_cross_store=is_cross_store,
        is_cross_park=is_cross_park,
        status="pending",
        verification_status="pending",
        processed_by=data.operator,
        remarks=data.remarks
    )

    db.add(transaction)
    db.commit()
    db.refresh(transaction)

    record_audit_log(
        db, transaction.id, transaction_no, "CREATE",
        operator=data.operator, operator_role="manual",
        remarks=f"单条人工录入交易记录"
    )

    verification_result = verify_transaction(db, transaction, employee)

    if not verification_result.passed:
        transaction.verification_status = "issue_found"
        transaction.required_materials = "; ".join([f"{m.code}:{m.name}" for m in verification_result.required_materials])
    else:
        transaction.verification_status = "verified"
        transaction.status = "approved"

    db.commit()

    record_audit_log(
        db, transaction.id, transaction_no, "VERIFY",
        field_name="verification_status",
        old_value="pending",
        new_value=transaction.verification_status,
        operator="system",
        remarks=f"自动验证完成，发现{len(verification_result.issues)}个问题"
    )

    return {
        "success": True,
        "transaction_no": transaction_no,
        "verification_result": {
            "passed": verification_result.passed,
            "issues": verification_result.issues,
            "required_materials": [m.dict() for m in verification_result.required_materials],
            "next_steps": verification_result.next_steps
        },
        "transaction": {
            "transaction_no": transaction_no,
            "is_cross_store": is_cross_store,
            "is_cross_park": is_cross_park,
            "status": transaction.status
        }
    }


@app.post("/api/transactions/batch", response_model=BulkImportResult)
async def batch_import_transactions(
    file: UploadFile = File(...),
    operator: str = Query(..., description="操作人"),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="仅支持Excel文件")

    contents = await file.read()
    df = pd.read_excel(BytesIO(contents))

    required_columns = ['员工工号', '门店编号', '交易时间', '交易总金额', '餐补核销金额']
    for col in required_columns:
        if col not in df.columns:
            raise HTTPException(status_code=400, detail=f"缺少必需列：{col}")

    success_count = 0
    failed_count = 0
    failed_items = []
    verification_summary = {
        "total_issues": 0,
        "resigned_employee_count": 0,
        "cross_park_count": 0,
        "over_quota_count": 0
    }

    for idx, row in df.iterrows():
        try:
            employee_no = str(row['员工工号']).strip()
            store_no = str(row['门店编号']).strip()

            employee = db.query(Employee).filter(Employee.employee_no == employee_no).first()
            store = db.query(Store).filter(Store.store_no == store_no).first()

            if not employee:
                failed_items.append({
                    "row": idx + 2,
                    "employee_no": employee_no,
                    "reason": f"员工工号{employee_no}不存在"
                })
                failed_count += 1
                continue

            if not store:
                failed_items.append({
                    "row": idx + 2,
                    "store_no": store_no,
                    "reason": f"门店编号{store_no}不存在"
                })
                failed_count += 1
                continue

            transaction_no = generate_transaction_no()
            is_cross_store = employee.park_code != store.park_code
            is_cross_park = employee.park_code != store.park_code

            transaction = SubsidyTransaction(
                transaction_no=transaction_no,
                employee_no=employee_no,
                employee_name=employee.name,
                department=employee.department,
                employee_park_code=employee.park_code,
                employee_park_name=employee.park_name,
                store_no=store_no,
                store_name=store.store_name,
                store_park_code=store.park_code,
                store_park_name=store.park_name,
                transaction_date=pd.to_datetime(row['交易时间']),
                transaction_amount=float(row['交易总金额']),
                subsidy_amount=float(row['餐补核销金额']),
                personal_pay_amount=float(row.get('个人支付金额', 0) or 0),
                meal_type=str(row.get('餐别', '')) or None,
                consumption_details=str(row.get('消费明细', '')) or None,
                is_cross_store=is_cross_store,
                is_cross_park=is_cross_park,
                status="pending",
                verification_status="pending",
                processed_by=operator,
                remarks=str(row.get('备注', '')) or None
            )

            db.add(transaction)
            db.flush()

            record_audit_log(
                db, transaction.id, transaction_no, "BATCH_IMPORT",
                operator=operator, operator_role="batch",
                remarks=f"批量导入，来源文件：{file.filename}，行号：{idx + 2}"
            )

            verification_result = verify_transaction(db, transaction, employee)

            if not verification_result.passed:
                transaction.verification_status = "issue_found"
                transaction.required_materials = "; ".join([f"{m.code}:{m.name}" for m in verification_result.required_materials])
                verification_summary["total_issues"] += 1

                if not employee.is_active:
                    verification_summary["resigned_employee_count"] += 1
                if is_cross_park:
                    verification_summary["cross_park_count"] += 1
                if transaction.subsidy_amount > employee.monthly_quota:
                    verification_summary["over_quota_count"] += 1
            else:
                transaction.verification_status = "verified"
                transaction.status = "approved"

            record_audit_log(
                db, transaction.id, transaction_no, "VERIFY",
                field_name="verification_status",
                old_value="pending",
                new_value=transaction.verification_status,
                operator="system",
                remarks=f"批量自动验证完成"
            )

            success_count += 1

        except Exception as e:
            failed_items.append({
                "row": idx + 2,
                "reason": str(e)
            })
            failed_count += 1

    db.commit()

    return BulkImportResult(
        total_count=len(df),
        success_count=success_count,
        failed_count=failed_count,
        failed_items=failed_items,
        verification_summary=verification_summary
    )


@app.get("/api/transactions")
def list_transactions(
    page: int = 1,
    page_size: int = 20,
    employee_no: Optional[str] = None,
    store_no: Optional[str] = None,
    verification_status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    query = db.query(SubsidyTransaction)

    if employee_no:
        query = query.filter(SubsidyTransaction.employee_no == employee_no)
    if store_no:
        query = query.filter(SubsidyTransaction.store_no == store_no)
    if verification_status:
        query = query.filter(SubsidyTransaction.verification_status == verification_status)
    if start_date:
        query = query.filter(SubsidyTransaction.transaction_date >= start_date)
    if end_date:
        query = query.filter(SubsidyTransaction.transaction_date <= end_date)

    total = query.count()
    transactions = query.order_by(SubsidyTransaction.transaction_date.desc())\
        .offset((page - 1) * page_size)\
        .limit(page_size)\
        .all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": transactions
    }


@app.get("/api/transactions/export")
def export_transactions(
    employee_no: Optional[str] = None,
    store_no: Optional[str] = None,
    verification_status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    query = db.query(SubsidyTransaction)

    if employee_no:
        query = query.filter(SubsidyTransaction.employee_no == employee_no)
    if store_no:
        query = query.filter(SubsidyTransaction.store_no == store_no)
    if verification_status:
        query = query.filter(SubsidyTransaction.verification_status == verification_status)
    if start_date:
        query = query.filter(SubsidyTransaction.transaction_date >= start_date)
    if end_date:
        query = query.filter(SubsidyTransaction.transaction_date <= end_date)

    transactions = query.order_by(SubsidyTransaction.transaction_date.desc()).all()

    export_data = []
    for t in transactions:
        export_data.append({
            "交易编号": t.transaction_no,
            "员工工号": t.employee_no,
            "员工姓名": t.employee_name,
            "所属部门": t.department,
            "员工所属园区": t.employee_park_name,
            "门店编号": t.store_no,
            "门店名称": t.store_name,
            "消费园区": t.store_park_name,
            "交易时间": t.transaction_date.strftime("%Y-%m-%d %H:%M:%S"),
            "交易总金额": t.transaction_amount,
            "餐补核销金额": t.subsidy_amount,
            "个人支付金额": t.personal_pay_amount,
            "餐别": t.meal_type,
            "是否跨店": "是" if t.is_cross_store else "否",
            "是否跨园区": "是" if t.is_cross_park else "否",
            "核销状态": t.status,
            "验证状态": t.verification_status,
            "需补充材料": t.required_materials,
            "处理人": t.processed_by,
            "处理时间": t.processed_at.strftime("%Y-%m-%d %H:%M:%S") if t.processed_at else "",
            "备注": t.remarks
        })

    df = pd.DataFrame(export_data)
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='餐补核销明细')

    output.seek(0)
    filename = f"餐补跨店核销明细_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/api/transactions/{transaction_no}/audit-logs")
def get_transaction_audit_logs(transaction_no: str, db: Session = Depends(get_db)):
    transaction = db.query(SubsidyTransaction).filter(SubsidyTransaction.transaction_no == transaction_no).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="交易记录不存在")

    logs = db.query(AuditLog).filter(AuditLog.transaction_no == transaction_no).order_by(AuditLog.created_at.desc()).all()
    return {
        "transaction_no": transaction_no,
        "audit_logs": logs
    }


@app.get("/api/init-sample-data")
def init_sample_data(db: Session = Depends(get_db)):
    employees = [
        Employee(employee_no="E001", name="张三", department="研发部", park_code="P001", park_name="张江高科技园区", is_active=True, monthly_quota=300.0),
        Employee(employee_no="E002", name="李四", department="市场部", park_code="P001", park_name="张江高科技园区", is_active=True, monthly_quota=300.0),
        Employee(employee_no="E003", name="王五", department="人事部", park_code="P002", park_name="临港产业园", is_active=False, resignation_date=datetime(2024, 12, 31), monthly_quota=300.0),
        Employee(employee_no="E004", name="赵六", department="财务部", park_code="P002", park_name="临港产业园", is_active=True, monthly_quota=300.0),
    ]

    stores = [
        Store(store_no="S001", store_name="张江食堂一楼", park_code="P001", park_name="张江高科技园区", address="张江路100号"),
        Store(store_no="S002", store_name="张江食堂二楼", park_code="P001", park_name="张江高科技园区", address="张江路100号"),
        Store(store_no="S003", store_name="临港食堂A区", park_code="P002", park_name="临港产业园", address="临港大道200号"),
        Store(store_no="S004", store_name="临港食堂B区", park_code="P002", park_name="临港产业园", address="临港大道200号"),
    ]

    for emp in employees:
        existing = db.query(Employee).filter(Employee.employee_no == emp.employee_no).first()
        if not existing:
            db.add(emp)

    for store in stores:
        existing = db.query(Store).filter(Store.store_no == store.store_no).first()
        if not existing:
            db.add(store)

    db.commit()

    return {"message": "样例数据初始化完成", "employees": 4, "stores": 4}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
