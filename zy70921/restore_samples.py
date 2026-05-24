content = '''from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
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
    operator: str = Form("system"),
    db: Session = Depends(get_db)
):
    if not samples_file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="送样文件必须是CSV格式")
    
    if not test_items_file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="检测项目文件必须是JSON格式")

    samples_data = await parse_csv_file(samples_file)
    if not samples_data:
        raise HTTPException(status_code=400, detail="CSV文件中没有有效数据")

    test_items_data = await parse_json_file(test_items_file)
    if not test_items_data:
        raise HTTPException(status_code=400, detail="JSON文件中没有有效数据")

    engine = RuleEngine()
    normal_items = []
    pending_items = []
    failed_items = []

    for sample_data in samples_data:
        sample_code = sample_data.get("sample_code")
        batch_no = sample_data.get("batch_no")
        
        if not sample_code:
            failed_items.append({
                "sample_code": "未知",
                "batch_no": batch_no or "未知",
                "failed_reason": "缺少样品编号"
            })
            continue

        test_items = test_items_data.get(sample_code, [])
        result = engine.process_sample(sample_data, test_items)
        
        result_data = {
            "batch_no": batch_no,
            "sample_code": sample_code,
            "sample_name": sample_data.get("sample_name", ""),
            "cooperative": sample_data.get("cooperative", ""),
            "original_data": result.get("original_data", {}),
            "test_items": result.get("test_items", []),
            "failed_reason": result.get("failed_reason", ""),
            "suggestion": result.get("suggestion", ""),
            "rule_triggered": result.get("rule_triggered", ""),
            "processed_at": datetime.now().isoformat()
        }

        result_type = result.get("result_type", "failed")
        if result_type == "normal":
            normal_items.append(result_data)
        elif result_type == "pending":
            pending_items.append(result_data)
        else:
            failed_items.append(result_data)

    total_processed = len(samples_data)

    return ProcessResponse(
        normal=normal_items,
        pending=pending_items,
        failed=failed_items,
        total_processed=total_processed,
        message=f"成功处理 {total_processed} 个样品，操作员: {operator}"
    )


@router.get("/trace/{sample_code}")
async def trace_sample(sample_code: str, db: Session = Depends(get_db)):
    sample = db.query(Sample).filter(Sample.sample_code == sample_code).first()
    if not sample:
        raise HTTPException(status_code=404, detail="样品不存在")

    test_items = db.query(TestItem).filter(TestItem.sample_id == sample.id).all()

    test_items_with_results = []
    for item in test_items:
        result = db.query(TestResult).filter(TestResult.test_item_id == item.id).first()
        test_items_with_results.append({
            "test_name": item.test_name,
            "test_method": item.test_method,
            "requirement": item.requirement,
            "result": {
                "value": result.result_value if result else None,
                "unit": result.result_unit if result else None,
                "is_pass": result.is_pass if result else None,
                "test_date": result.test_date.isoformat() if result and result.test_date else None
            }
        })

    return {
        "sample_code": sample.sample_code,
        "sample_name": sample.sample_name,
        "sample_type": sample.sample_type,
        "submitter": sample.submitter,
        "submitted_at": sample.submitted_at.isoformat() if sample.submitted_at else None,
        "status": sample.status,
        "test_items": test_items_with_results
    }
'''

with open('/Users/lzy/pro/pro.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('File written successfully, size:', len(content))
