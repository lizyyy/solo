from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import create_engine, Column, String, Integer, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import hashlib
import json
import pandas as pd
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

app = FastAPI(title="晨检用药管理系统", version="1.0.0")

DATABASE_URL = "sqlite:///./health_check.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class SubmissionBatch(Base):
    __tablename__ = "submission_batches"
    id = Column(Integer, primary_key=True, index=True)
    batch_hash = Column(String(64), unique=True, index=True)
    submit_time = Column(DateTime, default=datetime.utcnow)
    total_records = Column(Integer, default=0)
    normal_count = Column(Integer, default=0)
    pending_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    records = relationship("HealthRecord", back_populates="batch")


class HealthRecord(Base):
    __tablename__ = "health_records"
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("submission_batches.id"))
    student_id = Column(String(50), index=True)
    student_name = Column(String(100))
    class_name = Column(String(100))
    record_type = Column(String(50))
    status = Column(String(50))
    temperature = Column(Float, nullable=True)
    medicine_name = Column(String(200), nullable=True)
    medicine_expiry = Column(String(50), nullable=True)
    parent_confirmed = Column(Boolean, nullable=True)
    original_data = Column(Text)
    suggestion = Column(Text)
    rule_triggered = Column(String(200))
    create_time = Column(DateTime, default=datetime.utcnow)
    batch = relationship("SubmissionBatch", back_populates="records")


class IsolationHistory(Base):
    __tablename__ = "isolation_history"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String(50), index=True)
    student_name = Column(String(100))
    class_name = Column(String(100))
    temperature = Column(Float)
    source_batch_id = Column(Integer)
    source_record_id = Column(Integer)
    isolate_start = Column(DateTime, default=datetime.utcnow)
    isolate_end = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    notes = Column(Text)


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def calculate_batch_hash(morning_check: str, medicine_auth: str, class_list: str) -> str:
    combined = f"{morning_check}|{medicine_auth}|{class_list}"
    return hashlib.sha256(combined.encode('utf-8')).hexdigest()


def check_fever_isolation(record: Dict, db) -> Dict:
    temp = record.get("temperature", 0)
    if temp >= 37.3:
        student_id = record.get("student_id", "")
        active_isolation = db.query(IsolationHistory).filter(
            IsolationHistory.student_id == student_id,
            IsolationHistory.is_active == True
        ).first()
        
        if not active_isolation:
            isolation = IsolationHistory(
                student_id=student_id,
                student_name=record.get("student_name", ""),
                class_name=record.get("class_name", ""),
                temperature=temp,
                notes=f"晨检体温异常: {temp}°C"
            )
            db.add(isolation)
        
        return {
            "status": "failed",
            "rule": "发热隔离规则",
            "suggestion": f"体温{temp}°C，超过37.3°C警戒线，需立即隔离观察并通知家长。隔离记录已创建，可通过学生ID追踪历史。"
        }
    return None


def check_medicine_expiry(record: Dict) -> Dict:
    expiry_str = record.get("medicine_expiry", "")
    if expiry_str:
        try:
            if "/" in expiry_str:
                month, year = expiry_str.split("/")
                expiry_date = datetime(int(year), int(month), 1)
            elif "-" in expiry_str:
                year, month = expiry_str.split("-")[:2]
                expiry_date = datetime(int(year), int(month), 1)
            else:
                return {
                    "status": "failed",
                    "rule": "药品有效期格式错误",
                    "suggestion": "药品有效期格式不正确，请使用 MM/YYYY 或 YYYY-MM 格式"
                }
            
            if expiry_date < datetime.now():
                return {
                    "status": "failed",
                    "rule": "药品过期规则",
                    "suggestion": f"药品已于{expiry_str}过期，禁止使用，请更换有效药品"
                }
        except:
            return {
                "status": "failed",
                "rule": "药品有效期解析失败",
                "suggestion": "无法解析药品有效期，请核对格式"
            }
    return None


def check_parent_confirmation(record: Dict) -> Dict:
    if not record.get("parent_confirmed", False):
        return {
            "status": "pending",
            "rule": "家长未确认规则",
            "suggestion": "家长尚未确认用药授权，请联系家长完成确认后再处理"
        }
    return None


def apply_rules(record: Dict, db) -> Dict:
    fever_result = check_fever_isolation(record, db)
    if fever_result:
        return {**record, **fever_result}
    
    if record.get("record_type") == "medicine":
        expiry_result = check_medicine_expiry(record)
        if expiry_result:
            return {**record, **expiry_result}
        
        confirm_result = check_parent_confirmation(record)
        if confirm_result:
            return {**record, **confirm_result}
    
    return {**record, "status": "normal", "rule": "无违规", "suggestion": "数据正常"}


def parse_morning_check_csv(content: str) -> List[Dict]:
    try:
        from io import StringIO
        df = pd.read_csv(StringIO(content))
        records = []
        for _, row in df.iterrows():
            records.append({
                "student_id": str(row.get("学号", row.get("student_id", ""))),
                "student_name": str(row.get("姓名", row.get("student_name", ""))),
                "class_name": str(row.get("班级", row.get("class_name", ""))),
                "temperature": float(row.get("体温", row.get("temperature", 36.5))),
                "record_type": "morning_check",
                "original_data": json.dumps(row.to_dict(), ensure_ascii=False)
            })
        return records
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV解析失败: {str(e)}")


def parse_medicine_auth_json(content: str) -> List[Dict]:
    try:
        data = json.loads(content)
        records = []
        auth_list = data if isinstance(data, list) else data.get("authorizations", [data])
        for auth in auth_list:
            records.append({
                "student_id": str(auth.get("student_id", auth.get("学号", ""))),
                "student_name": str(auth.get("student_name", auth.get("姓名", ""))),
                "class_name": str(auth.get("class_name", auth.get("班级", ""))),
                "medicine_name": str(auth.get("medicine_name", auth.get("药品名称", ""))),
                "medicine_expiry": str(auth.get("expiry_date", auth.get("有效期", ""))),
                "parent_confirmed": bool(auth.get("parent_confirmed", auth.get("家长确认", False))),
                "record_type": "medicine",
                "original_data": json.dumps(auth, ensure_ascii=False)
            })
        return records
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"JSON解析失败: {str(e)}")


def parse_class_list(content: str) -> List[Dict]:
    try:
        if content.strip().startswith("[") or content.strip().startswith("{"):
            data = json.loads(content)
            students = data if isinstance(data, list) else data.get("students", [])
            return [{
                "student_id": str(s.get("student_id", s.get("学号", ""))),
                "student_name": str(s.get("student_name", s.get("姓名", ""))),
                "class_name": str(s.get("class_name", s.get("班级", "")))
            } for s in students]
        else:
            from io import StringIO
            df = pd.read_csv(StringIO(content))
            return [{
                "student_id": str(row.get("学号", row.get("student_id", ""))),
                "student_name": str(row.get("姓名", row.get("student_name", ""))),
                "class_name": str(row.get("班级", row.get("class_name", "")))
            } for _, row in df.iterrows()]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"班级名单解析失败: {str(e)}")


@app.post("/api/submit")
async def submit_records(
    morning_check: UploadFile = File(None),
    medicine_auth: UploadFile = File(None),
    class_list: UploadFile = File(None)
):
    db = next(get_db())
    
    morning_content = (await morning_check.read()).decode('utf-8') if morning_check else ""
    medicine_content = (await medicine_auth.read()).decode('utf-8') if medicine_auth else ""
    class_content = (await class_list.read()).decode('utf-8') if class_list else ""
    
    batch_hash = calculate_batch_hash(morning_content, medicine_content, class_content)
    
    existing_batch = db.query(SubmissionBatch).filter(SubmissionBatch.batch_hash == batch_hash).first()
    if existing_batch:
        return JSONResponse({
            "code": 409,
            "message": "该批次材料已提交过，请勿重复提交",
            "batch_id": existing_batch.id,
            "submit_time": existing_batch.submit_time.isoformat()
        }, status_code=409)
    
    all_records = []
    
    if morning_content:
        all_records.extend(parse_morning_check_csv(morning_content))
    
    if medicine_content:
        all_records.extend(parse_medicine_auth_json(medicine_content))
    
    class_students = parse_class_list(class_content) if class_content else []
    
    processed_records = []
    normal_items = []
    pending_items = []
    failed_items = []
    
    for record in all_records:
        result = apply_rules(record, db)
        processed_records.append(result)
        
        if result["status"] == "normal":
            normal_items.append({
                "student_id": result["student_id"],
                "student_name": result["student_name"],
                "class_name": result["class_name"],
                "record_type": result["record_type"]
            })
        elif result["status"] == "pending":
            pending_items.append({
                "student_id": result["student_id"],
                "student_name": result["student_name"],
                "class_name": result["class_name"],
                "record_type": result["record_type"],
                "rule_triggered": result["rule"],
                "suggestion": result["suggestion"]
            })
        else:
            failed_items.append({
                "student_id": result["student_id"],
                "student_name": result["student_name"],
                "class_name": result["class_name"],
                "record_type": result["record_type"],
                "original_data": json.loads(result["original_data"]),
                "rule_triggered": result["rule"],
                "suggestion": result["suggestion"]
            })
    
    batch = SubmissionBatch(
        batch_hash=batch_hash,
        total_records=len(processed_records),
        normal_count=len(normal_items),
        pending_count=len(pending_items),
        failed_count=len(failed_items)
    )
    db.add(batch)
    db.flush()
    
    for idx, record in enumerate(processed_records):
        db_record = HealthRecord(
            batch_id=batch.id,
            student_id=record["student_id"],
            student_name=record["student_name"],
            class_name=record["class_name"],
            record_type=record["record_type"],
            status=record["status"],
            temperature=record.get("temperature"),
            medicine_name=record.get("medicine_name"),
            medicine_expiry=record.get("medicine_expiry"),
            parent_confirmed=record.get("parent_confirmed"),
            original_data=record["original_data"],
            suggestion=record["suggestion"],
            rule_triggered=record["rule"]
        )
        db.add(db_record)
        db.flush()
        
        if record["status"] == "failed" and "发热" in record["rule"]:
            isolation = db.query(IsolationHistory).filter(
                IsolationHistory.student_id == record["student_id"],
                IsolationHistory.is_active == True
            ).first()
            if isolation:
                isolation.source_batch_id = batch.id
                isolation.source_record_id = db_record.id
    
    db.commit()
    
    return {
        "code": 200,
        "message": "处理完成",
        "batch_id": batch.id,
        "summary": {
            "total": batch.total_records,
            "normal": batch.normal_count,
            "pending": batch.pending_count,
            "failed": batch.failed_count
        },
        "data": {
            "normal_items": normal_items,
            "pending_items": pending_items,
            "failed_items": failed_items
        }
    }


@app.get("/api/isolation/student/{student_id}")
async def get_student_isolation_history(student_id: str):
    db = next(get_db())
    isolations = db.query(IsolationHistory).filter(
        IsolationHistory.student_id == student_id
    ).order_by(IsolationHistory.isolate_start.desc()).all()
    
    history = []
    for iso in isolations:
        history.append({
            "id": iso.id,
            "student_id": iso.student_id,
            "student_name": iso.student_name,
            "class_name": iso.class_name,
            "temperature": iso.temperature,
            "source_batch_id": iso.source_batch_id,
            "source_record_id": iso.source_record_id,
            "isolate_start": iso.isolate_start.isoformat(),
            "isolate_end": iso.isolate_end.isoformat() if iso.isolate_end else None,
            "is_active": iso.is_active,
            "notes": iso.notes
        })
    
    return {
        "code": 200,
        "data": {
            "student_id": student_id,
            "isolation_history": history,
            "is_currently_isolated": any(iso["is_active"] for iso in history)
        }
    }


@app.get("/api/batch/{batch_id}")
async def get_batch_result(batch_id: int):
    db = next(get_db())
    batch = db.query(SubmissionBatch).filter(SubmissionBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    records = db.query(HealthRecord).filter(HealthRecord.batch_id == batch_id).all()
    
    normal_items = []
    pending_items = []
    failed_items = []
    
    for r in records:
        item = {
            "student_id": r.student_id,
            "student_name": r.student_name,
            "class_name": r.class_name,
            "record_type": r.record_type
        }
        if r.status == "normal":
            normal_items.append(item)
        elif r.status == "pending":
            pending_items.append({**item, "rule_triggered": r.rule_triggered, "suggestion": r.suggestion})
        else:
            failed_items.append({
                **item,
                "original_data": json.loads(r.original_data),
                "rule_triggered": r.rule_triggered,
                "suggestion": r.suggestion
            })
    
    return {
        "code": 200,
        "batch_id": batch_id,
        "submit_time": batch.submit_time.isoformat(),
        "summary": {
            "total": batch.total_records,
            "normal": batch.normal_count,
            "pending": batch.pending_count,
            "failed": batch.failed_count
        },
        "data": {
            "normal_items": normal_items,
            "pending_items": pending_items,
            "failed_items": failed_items
        }
    }


@app.get("/api/batches")
async def list_batches(limit: int = 10):
    db = next(get_db())
    batches = db.query(SubmissionBatch).order_by(SubmissionBatch.submit_time.desc()).limit(limit).all()
    
    return {
        "code": 200,
        "data": [{
            "batch_id": b.id,
            "batch_hash": b.batch_hash[:16] + "...",
            "submit_time": b.submit_time.isoformat(),
            "summary": {
                "total": b.total_records,
                "normal": b.normal_count,
                "pending": b.pending_count,
                "failed": b.failed_count
            }
        } for b in batches]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
