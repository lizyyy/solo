from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import io
import pandas as pd
from datetime import datetime

from database import engine, get_db, Base
import models
import schemas
import crud

Base.metadata.create_all(bind=engine)

app = FastAPI(title="冷库租户电费分摊API", version="1.0.0")


@app.post("/api/batches/", response_model=schemas.BatchResponse, tags=["批次管理"])
def create_batch(batch: schemas.BatchCreate, db: Session = Depends(get_db)):
    return crud.create_batch(db=db, batch=batch)


@app.get("/api/batches/", response_model=List[schemas.BatchResponse], tags=["批次管理"])
def get_batches(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_batches(db, skip=skip, limit=limit)


@app.get("/api/batches/{batch_id}", response_model=schemas.BatchResponse, tags=["批次管理"])
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    db_batch = crud.get_batch(db, batch_id=batch_id)
    if db_batch is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    return db_batch


@app.get("/api/batches/{batch_id}/details", response_model=schemas.BatchDetailResponse, tags=["批次管理"])
def get_batch_with_details(batch_id: int, db: Session = Depends(get_db)):
    db_batch = crud.get_batch(db, batch_id=batch_id)
    if db_batch is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    statistics = crud.get_batch_statistics(db, batch_id)
    details = crud.get_electricity_details_by_batch(db, batch_id)
    
    return {
        "batch": db_batch,
        "statistics": statistics,
        "details": details
    }


@app.post("/api/batches/{batch_id}/archive", response_model=schemas.BatchResponse, tags=["归档流程"])
def archive_batch(batch_id: int, request: schemas.ArchiveRequest, db: Session = Depends(get_db)):
    db_batch = crud.archive_batch(db, batch_id=batch_id, operator=request.operator)
    if db_batch is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    return db_batch


@app.post("/api/source-materials/", response_model=schemas.SourceMaterialResponse, tags=["原始材料管理"])
def upload_source_material(
    batch_id: int,
    material_type: str,
    uploaded_by: str,
    remark: Optional[str] = None,
    file: Optional[UploadFile] = File(None),
    content: Optional[str] = None,
    db: Session = Depends(get_db)
):
    db_batch = crud.get_batch(db, batch_id=batch_id)
    if db_batch is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    material_data = {
        "batch_id": batch_id,
        "material_type": material_type,
        "uploaded_by": uploaded_by,
        "remark": remark
    }
    
    if file:
        material_data["file_name"] = file.filename
        material_data["file_path"] = f"/uploads/{batch_id}/{file.filename}"
    
    if content:
        material_data["content"] = content
    
    material_create = schemas.SourceMaterialCreate(**material_data)
    return crud.create_source_material(db=db, material=material_create)


@app.get("/api/batches/{batch_id}/source-materials", response_model=List[schemas.SourceMaterialResponse], tags=["原始材料管理"])
def get_batch_source_materials(batch_id: int, db: Session = Depends(get_db)):
    return crud.get_source_materials_by_batch(db, batch_id=batch_id)


@app.post("/api/electricity-details/", response_model=schemas.ElectricityDetailResponse, tags=["电费明细管理"])
def create_electricity_detail(detail: schemas.ElectricityDetailCreate, db: Session = Depends(get_db)):
    db_batch = crud.get_batch(db, batch_id=detail.batch_id)
    if db_batch is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    return crud.create_electricity_detail(db=db, detail=detail)


@app.post("/api/electricity-details/bulk/{batch_id}", tags=["电费明细管理"])
def bulk_import_electricity_details(batch_id: int, details: List[dict], db: Session = Depends(get_db)):
    db_batch = crud.get_batch(db, batch_id=batch_id)
    if db_batch is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    created_details = crud.bulk_import_details(db, batch_id, details)
    return {"created_count": len(created_details), "details": created_details}


@app.get("/api/electricity-details/{detail_id}", response_model=schemas.ElectricityDetailResponse, tags=["电费明细管理"])
def get_electricity_detail(detail_id: int, db: Session = Depends(get_db)):
    db_detail = crud.get_electricity_detail(db, detail_id=detail_id)
    if db_detail is None:
        raise HTTPException(status_code=404, detail="明细不存在")
    return db_detail


@app.put("/api/electricity-details/{detail_id}", response_model=schemas.ElectricityDetailResponse, tags=["电费明细管理"])
def update_electricity_detail(
    detail_id: int,
    detail_update: schemas.ElectricityDetailUpdate,
    modified_by: Optional[str] = "system",
    db: Session = Depends(get_db)
):
    db_detail = crud.update_electricity_detail(db, detail_id=detail_id, detail_update=detail_update, modified_by=modified_by)
    if db_detail is None:
        raise HTTPException(status_code=404, detail="明细不存在")
    return db_detail


@app.post("/api/electricity-details/{detail_id}/modify-conclusion", response_model=schemas.ElectricityDetailResponse, tags=["电费明细管理"])
def modify_conclusion(
    detail_id: int,
    request: schemas.ConclusionModifyRequest,
    db: Session = Depends(get_db)
):
    db_detail = crud.get_electricity_detail(db, detail_id=detail_id)
    if db_detail is None:
        raise HTTPException(status_code=404, detail="明细不存在")
    
    detail_update = schemas.ElectricityDetailUpdate(
        category=request.new_category,
        category_reason=request.category_reason
    )
    
    return crud.update_electricity_detail(
        db,
        detail_id=detail_id,
        detail_update=detail_update,
        modified_by=request.modified_by
    )


@app.get("/api/electricity-details/{detail_id}/traces", response_model=List[schemas.ProcessingTraceResponse], tags=["处理轨迹"])
def get_detail_traces(detail_id: int, db: Session = Depends(get_db)):
    return crud.get_processing_traces_by_detail(db, detail_id=detail_id)


@app.get("/api/electricity-details/{detail_id}/audit-logs", response_model=List[schemas.AuditLogResponse], tags=["审计日志"])
def get_detail_audit_logs(detail_id: int, db: Session = Depends(get_db)):
    return crud.get_audit_logs_by_detail(db, detail_id=detail_id)


@app.post("/api/export/excel", tags=["导出功能"])
def export_to_excel(
    request: schemas.ExportRequest,
    db: Session = Depends(get_db)
):
    query = db.query(models.ElectricityDetail)
    
    if request.batch_id:
        query = query.filter(models.ElectricityDetail.batch_id == request.batch_id)
    
    if request.category:
        query = query.filter(models.ElectricityDetail.category == request.category)
    
    details = query.all()
    
    if not details:
        raise HTTPException(status_code=404, detail="没有可导出的数据")
    
    data = []
    for detail in details:
        data.append({
            "批次编号": detail.batch.batch_no if detail.batch else "",
            "租户编号": detail.tenant_code,
            "租户名称": detail.tenant_name,
            "温区": detail.temperature_zone,
            "用电倍率": detail.electricity_rate,
            "开始读数": detail.meter_reading_start,
            "结束读数": detail.meter_reading_end,
            "基础电费": detail.basic_electricity,
            "加班时长": detail.overtime_hours,
            "加班电费": detail.overtime_electricity,
            "人工分摊": detail.manual_allocation,
            "总电费": detail.total_electricity,
            "数据分类": detail.category.value,
            "分类原因": detail.category_reason,
            "最后处理人": detail.final_processor,
            "是否归档": "是" if detail.is_archived else "否"
        })
    
    df = pd.DataFrame(data)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='电费明细')
    
    output.seek(0)
    
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    filename = f"electricity_details_{timestamp}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/api/statistics/{batch_id}", tags=["统计信息"])
def get_batch_statistics(batch_id: int, db: Session = Depends(get_db)):
    db_batch = crud.get_batch(db, batch_id=batch_id)
    if db_batch is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    statistics = crud.get_batch_statistics(db, batch_id)
    
    total_count = sum(s["count"] for s in statistics)
    total_amount = sum(s["total_electricity"] for s in statistics)
    
    return {
        "batch_id": batch_id,
        "batch_no": db_batch.batch_no,
        "statistics": statistics,
        "summary": {
            "total_count": total_count,
            "total_amount": total_amount
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
