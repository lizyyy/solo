from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import create_engine, Column, String, DateTime, Boolean, Text, Integer
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from pydantic import BaseModel
from typing import Optional, List
import os
import uuid
import pandas as pd
from io import BytesIO

app = FastAPI(title="检验结果回传台")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = "sqlite:///./test_results.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

UPLOAD_DIR = "./attachments"
os.makedirs(UPLOAD_DIR, exist_ok=True)


class TestRequest(Base):
    __tablename__ = "test_requests"
    
    id = Column(String, primary_key=True, index=True)
    patient_id = Column(String, index=True)
    patient_name = Column(String)
    barcode = Column(String, index=True)
    test_type = Column(String)
    apply_time = Column(DateTime)
    apply_doctor = Column(String)
    department = Column(String)
    status = Column(String, default="待回传")
    return_time = Column(DateTime, nullable=True)
    attachment_path = Column(String, nullable=True)
    barcode_match = Column(Boolean, nullable=True)
    review_pass = Column(Boolean, nullable=True)
    reviewer = Column(String, nullable=True)
    reader = Column(String, nullable=True)
    read_time = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)


Base.metadata.create_all(bind=engine)


class TestRequestCreate(BaseModel):
    patient_id: str
    patient_name: str
    barcode: str
    test_type: str
    apply_doctor: str
    department: str


class ReturnData(BaseModel):
    barcode: str
    review_pass: bool
    reviewer: str
    notes: Optional[str] = None


class ReadReceipt(BaseModel):
    request_id: str
    reader: str


class WrongBarcodeReturnData(BaseModel):
    wrong_barcode: str
    correct_barcode: str
    review_pass: bool
    reviewer: str
    notes: Optional[str] = None


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.post("/api/test-requests")
def create_test_request(request: TestRequestCreate):
    db = next(get_db())
    db_request = TestRequest(
        id=str(uuid.uuid4()),
        patient_id=request.patient_id,
        patient_name=request.patient_name,
        barcode=request.barcode,
        test_type=request.test_type,
        apply_time=datetime.now(),
        apply_doctor=request.apply_doctor,
        department=request.department,
        status="待回传"
    )
    db.add(db_request)
    db.commit()
    db.refresh(db_request)
    return db_request


@app.get("/api/test-requests")
def get_test_requests(
    patient_name: Optional[str] = None,
    barcode: Optional[str] = None,
    status: Optional[str] = None
):
    db = next(get_db())
    query = db.query(TestRequest)
    
    if patient_name:
        query = query.filter(TestRequest.patient_name.contains(patient_name))
    if barcode:
        query = query.filter(TestRequest.barcode.contains(barcode))
    if status:
        query = query.filter(TestRequest.status == status)
    
    return query.order_by(TestRequest.apply_time.desc()).all()


@app.post("/api/return-result")
async def return_result(
    barcode: str = Form(...),
    review_pass: bool = Form(...),
    reviewer: str = Form(...),
    notes: Optional[str] = Form(None),
    attachment: Optional[UploadFile] = File(None)
):
    db = next(get_db())
    request = db.query(TestRequest).filter(TestRequest.barcode == barcode).first()
    
    if not request:
        return {
            "success": False,
            "message": "未找到对应检验申请",
            "barcode_match": False
        }
    
    attachment_path = None
    if attachment:
        file_ext = os.path.splitext(attachment.filename)[1]
        file_name = f"{uuid.uuid4()}{file_ext}"
        attachment_path = os.path.join(UPLOAD_DIR, file_name)
        with open(attachment_path, "wb") as f:
            f.write(await attachment.read())
    
    request.barcode_match = True
    request.review_pass = review_pass
    request.reviewer = reviewer
    request.return_time = datetime.now()
    request.notes = notes
    
    if not attachment:
        request.status = "附件缺失"
        request.attachment_path = None
    elif not review_pass:
        request.status = "复核未通过"
        request.attachment_path = attachment_path
    else:
        request.status = "已回传待读取"
        request.attachment_path = attachment_path
    
    db.commit()
    return {
        "success": True,
        "message": "回传成功",
        "request_id": request.id,
        "status": request.status
    }


@app.post("/api/return-result-wrong-barcode")
def return_result_wrong_barcode(data: WrongBarcodeReturnData):
    db = next(get_db())
    request = db.query(TestRequest).filter(TestRequest.barcode == data.correct_barcode).first()
    
    if not request:
        return {"success": False, "message": "未找到对应检验申请"}
    
    request.barcode_match = False
    request.review_pass = data.review_pass
    request.reviewer = data.reviewer
    request.return_time = datetime.now()
    request.status = "条码不一致"
    request.notes = f"回传条码: {data.wrong_barcode}; {data.notes or ''}"
    
    db.commit()
    return {
        "success": True,
        "message": "回传成功（条码不一致）",
        "request_id": request.id
    }


@app.post("/api/read-receipt")
def mark_as_read(receipt: ReadReceipt):
    db = next(get_db())
    request = db.query(TestRequest).filter(TestRequest.id == receipt.request_id).first()
    
    if not request:
        raise HTTPException(status_code=404, detail="未找到检验申请")
    
    request.reader = receipt.reader
    request.read_time = datetime.now()
    request.status = "已读取"
    
    db.commit()
    return {"success": True, "message": "已标记为已读取"}


@app.get("/api/download-excel")
def download_excel():
    db = next(get_db())
    requests = db.query(TestRequest).order_by(TestRequest.apply_time.desc()).all()
    
    data = []
    for req in requests:
        data.append({
            "申请ID": req.id,
            "患者ID": req.patient_id,
            "患者姓名": req.patient_name,
            "样本条码": req.barcode,
            "检验类型": req.test_type,
            "申请时间": req.apply_time.strftime("%Y-%m-%d %H:%M:%S") if req.apply_time else "",
            "申请医生": req.apply_doctor,
            "科室": req.department,
            "状态": req.status,
            "回传时间": req.return_time.strftime("%Y-%m-%d %H:%M:%S") if req.return_time else "",
            "条码匹配": "是" if req.barcode_match else "否" if req.barcode_match is not None else "",
            "复核通过": "是" if req.review_pass else "否" if req.review_pass is not None else "",
            "复核人": req.reviewer or "",
            "读取人": req.reader or "",
            "读取时间": req.read_time.strftime("%Y-%m-%d %H:%M:%S") if req.read_time else "",
            "备注": req.notes or ""
        })
    
    df = pd.DataFrame(data)
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="回传明细")
    
    output.seek(0)
    file_path = "./回传明细.xlsx"
    with open(file_path, "wb") as f:
        f.write(output.getvalue())
    
    return FileResponse(file_path, filename="回传明细.xlsx")


@app.get("/api/statistics")
def get_statistics():
    db = next(get_db())
    total = db.query(TestRequest).count()
    pending = db.query(TestRequest).filter(TestRequest.status == "待回传").count()
    returned = db.query(TestRequest).filter(TestRequest.status == "已回传待读取").count()
    read = db.query(TestRequest).filter(TestRequest.status == "已读取").count()
    barcode_error = db.query(TestRequest).filter(TestRequest.status == "条码不一致").count()
    review_failed = db.query(TestRequest).filter(TestRequest.status == "复核未通过").count()
    missing_attachment = db.query(TestRequest).filter(TestRequest.status == "附件缺失").count()
    
    return {
        "total": total,
        "pending": pending,
        "returned": returned,
        "read": read,
        "barcode_error": barcode_error,
        "review_failed": review_failed,
        "missing_attachment": missing_attachment
    }


def init_demo_data():
    db = next(get_db())
    
    if db.query(TestRequest).count() > 0:
        return
    
    requests = [
        TestRequest(
            id=str(uuid.uuid4()),
            patient_id="P001",
            patient_name="张三",
            barcode="BC20240515001",
            test_type="血常规",
            apply_time=datetime.now(),
            apply_doctor="李医生",
            department="内科",
            status="已读取",
            return_time=datetime.now(),
            barcode_match=True,
            review_pass=True,
            reviewer="王检验师",
            reader="李医生",
            read_time=datetime.now()
        ),
        TestRequest(
            id=str(uuid.uuid4()),
            patient_id="P002",
            patient_name="李四",
            barcode="BC20240515002",
            test_type="尿常规",
            apply_time=datetime.now(),
            apply_doctor="张医生",
            department="外科",
            status="条码不一致",
            return_time=datetime.now(),
            barcode_match=False,
            review_pass=True,
            reviewer="王检验师",
            notes="回传条码: BC20240515999"
        ),
        TestRequest(
            id=str(uuid.uuid4()),
            patient_id="P003",
            patient_name="王五",
            barcode="BC20240515003",
            test_type="肝功能",
            apply_time=datetime.now(),
            apply_doctor="赵医生",
            department="消化科",
            status="附件缺失",
            return_time=datetime.now(),
            barcode_match=True,
            review_pass=True,
            reviewer="李检验师",
            notes="附件晚到，稍后补传"
        ),
        TestRequest(
            id=str(uuid.uuid4()),
            patient_id="P004",
            patient_name="赵六",
            barcode="BC20240515004",
            test_type="肾功能",
            apply_time=datetime.now(),
            apply_doctor="钱医生",
            department="肾内科",
            status="已回传待读取",
            return_time=datetime.now(),
            barcode_match=True,
            review_pass=True,
            reviewer="李检验师"
        )
    ]
    
    for req in requests:
        db.add(req)
    
    db.commit()


init_demo_data()

app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
