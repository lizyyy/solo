from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app.models import Sample, TestItem, TestResult
from app.schemas import ProcessResponse
from app.utils.file_parser import parse_csv_file, parse_json_file
from app.rules.engine import RuleEngine

router = APIRouter(prefix="/api", tags=["samples"])

@router.post("/process", response_model=ProcessResponse)
async def process_samples(
    samples_file: UploadFile = File(...),
    test_items_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    samples_content = await samples_file.read()
    samples_data = parse_csv_file(samples_content)
    
    test_items_content = await test_items_file.read()
    test_items_data = parse_json_file(test_items_content)
    
    engine = RuleEngine(db)
    
    normal_items = []
    pending_items = []
    failed_items = []
    
    for sample_data in samples_data:
        sample_code = sample_data.get("sample_code", "")
        batch_no = sample_data.get("batch_no", "")
        
        sample_test_items = test_items_data.get(sample_code, [])
        result = engine.process_sample(sample_data, sample_test_items)
        
        result_data = {
            "batch_no": batch_no,
            "sample_code": sample_code,
            "sample_name": sample_data.get("sample_name", ""),
            "cooperative": sample_data.get("cooperative", ""),
            "original_data": result.get("sample", sample_data),
            "test_items": result["test_items"],
            "failed_reason": None,
            "suggestion": None,
            "rule_triggered": False,
            "processed_at": datetime.now().isoformat()
        }
        
        if result.get("status", "normal") == "normal":
            normal_items.append(result_data)
        elif result.get("status", "normal") == "pending":
            pending_items.append(result_data)
        else:
            failed_items.append(result_data)
    
    return ProcessResponse(
        normal=normal_items,
        pending=pending_items,
        failed=failed_items,
        total_processed=len(samples_data),
        message="Done"
    )

@router.get("/trace/{sample_code}")
async def trace_sample(sample_code: str, db: Session = Depends(get_db)):
    samples = db.query(Sample).filter(Sample.sample_code == sample_code).all()
    return {"sample_code": sample_code, "count": len(samples)}
