from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
import pandas as pd
import io

from app.database import get_db
from app.models import EvaluationRecord
from app.schemas import (
    EvaluationRecordCreate,
    EvaluationRecordResponse,
    ErrorResponse
)

router = APIRouter(prefix="/evaluation-records", tags=["讲评记录"])


@router.get("/", response_model=List[EvaluationRecordResponse])
def list_records(
    skip: int = 0,
    limit: int = 100,
    student_id: Optional[str] = None,
    question_no: Optional[str] = None,
    batch_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(EvaluationRecord)
    if student_id:
        query = query.filter(EvaluationRecord.student_id == student_id)
    if question_no:
        query = query.filter(EvaluationRecord.question_no == question_no)
    if batch_id:
        query = query.filter(EvaluationRecord.batch_id == batch_id)
    return query.order_by(EvaluationRecord.evaluation_time.desc()).offset(skip).limit(limit).all()


@router.get("/{record_id}", response_model=EvaluationRecordResponse)
def get_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(EvaluationRecord).filter(EvaluationRecord.id == record_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "RECORD_NOT_FOUND",
                "message": f"讲评记录ID {record_id} 不存在",
                "suggestion": "请检查记录ID是否正确",
                "contact_person": "系统管理员"
            }
        )
    return record


@router.post("/", response_model=EvaluationRecordResponse, status_code=status.HTTP_201_CREATED)
def create_record(record_data: EvaluationRecordCreate, db: Session = Depends(get_db)):
    record = EvaluationRecord(**record_data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.post("/batch", response_model=List[EvaluationRecordResponse], status_code=status.HTTP_201_CREATED)
def create_records_batch(records_data: List[EvaluationRecordCreate], db: Session = Depends(get_db)):
    records = [EvaluationRecord(**data.model_dump()) for data in records_data]
    db.add_all(records)
    db.commit()
    for record in records:
        db.refresh(record)
    return records


@router.post("/upload", response_model=List[EvaluationRecordResponse], status_code=status.HTTP_201_CREATED)
async def upload_records(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "INVALID_FILE_FORMAT",
                "message": "只支持 Excel (.xlsx, .xls) 或 CSV 格式文件",
                "suggestion": "请将文件转换为 Excel 或 CSV 格式后重新上传",
                "contact_person": "系统管理员"
            }
        )

    content = await file.read()
    try:
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "FILE_PARSE_ERROR",
                "message": f"文件解析失败：{str(e)}",
                "suggestion": "请检查文件格式是否正确，确保包含必要的列",
                "contact_person": "系统管理员"
            }
        )

    required_columns = ['student_id', 'student_name', 'question_no', 'student_answer']
    for col in required_columns:
        if col not in df.columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error_code": "MISSING_COLUMN",
                    "message": f"文件缺少必要列：{col}",
                    "suggestion": "请确保文件包含以下列：student_id, student_name, question_no, student_answer",
                    "contact_person": "讲评老师"
                }
            )

    records = []
    for _, row in df.iterrows():
        record = EvaluationRecord(
            student_id=str(row['student_id']),
            student_name=str(row['student_name']),
            question_no=str(row['question_no']),
            student_answer=str(row['student_answer']),
            score=float(row['score']) if 'score' in row and pd.notna(row['score']) else None,
            batch_id=str(row['batch_id']) if 'batch_id' in row and pd.notna(row['batch_id']) else None,
            remark=str(row['remark']) if 'remark' in row and pd.notna(row['remark']) else None
        )
        records.append(record)

    db.add_all(records)
    db.commit()
    for record in records:
        db.refresh(record)
    return records
