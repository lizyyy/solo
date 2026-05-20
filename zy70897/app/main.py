from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional
from app.database import engine, get_db, Base
from app import models, schemas, services
from app.services import parse_handover_csv, parse_schedule_json, process_handover_records, trace_error_by_code

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="尾箱交接管理系统 API",
    description="用于处理尾箱交接记录、柜员排班和差错记录的管理系统",
    version="1.0.0"
)


@app.post("/api/handover/upload", response_model=schemas.ProcessingResult)
async def upload_handover_files(
    handover_csv: UploadFile = File(..., description="交接记录 CSV 文件"),
    schedule_json: Optional[UploadFile] = File(None, description="柜员排班 JSON 文件（可选）"),
    db: Session = Depends(get_db)
):
    try:
        if not handover_csv.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="交接记录文件必须是 CSV 格式")
        
        handover_content = (await handover_csv.read()).decode('utf-8-sig')
        handover_records = parse_handover_csv(handover_content)
        
        schedule_records = []
        if schedule_json:
            if not schedule_json.filename.endswith('.json'):
                raise HTTPException(status_code=400, detail="排班文件必须是 JSON 格式")
            schedule_content = (await schedule_json.read()).decode('utf-8')
            schedule_records = parse_schedule_json(schedule_content)
        
        result = process_handover_records(db, handover_records, schedule_records)
        
        return JSONResponse(
            status_code=200,
            content={
                "batch_number": result["batch_number"],
                "normal_items": [
                    {
                        "id": item.id,
                        "batch_id": item.batch_id,
                        "handover_date": item.handover_date,
                        "branch_code": item.branch_code,
                        "branch_name": item.branch_name,
                        "teller_from": item.teller_from,
                        "teller_to": item.teller_to,
                        "cashbox_number": item.cashbox_number,
                        "system_amount": item.system_amount,
                        "actual_amount": item.actual_amount,
                        "difference": item.difference,
                        "confirmer_1": item.confirmer_1,
                        "confirmer_2": item.confirmer_2,
                        "handover_time": item.handover_time,
                        "status": item.status,
                        "created_at": item.created_at.isoformat()
                    }
                    for item in result["normal_items"]
                ],
                "pending_items": [],
                "failed_items": result["failed_items"],
                "statistics": result["statistics"]
            }
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@app.get("/api/error/trace/{error_code}")
async def trace_error(error_code: str, db: Session = Depends(get_db)):
    result = trace_error_by_code(db, error_code)
    if not result:
        raise HTTPException(status_code=404, detail=f"未找到差错编号: {error_code}")
    
    response = {
        "error_code": result["error_code"],
        "error_type": result["error_type"],
        "error_description": result["error_description"],
        "created_at": result["created_at"].isoformat(),
        "is_closed": result["is_closed"],
        "original_data": result["original_data"],
        "suggestion": result["suggestion"]
    }
    
    if result["batch_info"]:
        response["batch_info"] = {
            "id": result["batch_info"].id,
            "batch_number": result["batch_info"].batch_number,
            "submitted_at": result["batch_info"].submitted_at.isoformat(),
            "total_records": result["batch_info"].total_records,
            "status": result["batch_info"].status
        }
    
    if result["handover_info"]:
        response["handover_info"] = {
            "id": result["handover_info"].id,
            "batch_id": result["handover_info"].batch_id,
            "handover_date": result["handover_info"].handover_date,
            "branch_code": result["handover_info"].branch_code,
            "branch_name": result["handover_info"].branch_name,
            "teller_from": result["handover_info"].teller_from,
            "teller_to": result["handover_info"].teller_to,
            "cashbox_number": result["handover_info"].cashbox_number,
            "system_amount": result["handover_info"].system_amount,
            "actual_amount": result["handover_info"].actual_amount,
            "difference": result["handover_info"].difference,
            "confirmer_1": result["handover_info"].confirmer_1,
            "confirmer_2": result["handover_info"].confirmer_2,
            "handover_time": result["handover_info"].handover_time,
            "status": result["handover_info"].status,
            "created_at": result["handover_info"].created_at.isoformat()
        }
    
    return JSONResponse(status_code=200, content=response)


@app.get("/api/batch/{batch_number}")
async def get_batch_details(batch_number: str, db: Session = Depends(get_db)):
    batch = db.query(models.Batch).filter(models.Batch.batch_number == batch_number).first()
    if not batch:
        raise HTTPException(status_code=404, detail=f"未找到批次: {batch_number}")
    
    normal_items = db.query(models.HandoverRecord).filter(
        models.HandoverRecord.batch_id == batch.id,
        models.HandoverRecord.status == "normal"
    ).all()
    
    failed_items = db.query(models.ErrorRecord).filter(
        models.ErrorRecord.batch_id == batch.id
    ).all()
    
    return JSONResponse(
        status_code=200,
        content={
            "batch_info": {
                "id": batch.id,
                "batch_number": batch.batch_number,
                "submitted_at": batch.submitted_at.isoformat(),
                "total_records": batch.total_records,
                "status": batch.status
            },
            "normal_count": len(normal_items),
            "failed_count": len(failed_items),
            "error_records": [
                {
                    "error_code": err.error_code,
                    "error_type": err.error_type,
                    "error_description": err.error_description,
                    "suggestion": err.suggestion,
                    "is_closed": err.is_closed
                }
                for err in failed_items
            ]
        }
    )


@app.get("/api/batches")
async def list_batches(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    batches = db.query(models.Batch).order_by(models.Batch.submitted_at.desc()).offset(skip).limit(limit).all()
    
    return JSONResponse(
        status_code=200,
        content={
            "total": len(batches),
            "batches": [
                {
                    "id": batch.id,
                    "batch_number": batch.batch_number,
                    "submitted_at": batch.submitted_at.isoformat(),
                    "total_records": batch.total_records,
                    "status": batch.status
                }
                for batch in batches
            ]
        }
    )


@app.put("/api/error/close/{error_code}")
async def close_error(error_code: str, db: Session = Depends(get_db)):
    error = db.query(models.ErrorRecord).filter(models.ErrorRecord.error_code == error_code).first()
    if not error:
        raise HTTPException(status_code=404, detail=f"未找到差错编号: {error_code}")
    
    if error.is_closed:
        raise HTTPException(status_code=400, detail="该差错已关闭")
    
    error.is_closed = True
    from datetime import datetime
    error.closed_at = datetime.utcnow()
    db.commit()
    
    return JSONResponse(
        status_code=200,
        content={
            "message": "差错已成功关闭（当日闭环完成）",
            "error_code": error_code,
            "closed_at": error.closed_at.isoformat()
        }
    )


@app.get("/")
async def root():
    return {
        "message": "尾箱交接管理系统 API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "上传交接记录": "POST /api/handover/upload",
            "差错追溯": "GET /api/error/trace/{error_code}",
            "批次详情": "GET /api/batch/{batch_number}",
            "批次列表": "GET /api/batches",
            "关闭差错": "PUT /api/error/close/{error_code}"
        }
    }
