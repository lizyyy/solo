from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import os

import models
import schemas
import crud
import utils
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="无人货架补货差异 API", version="1.0.0")


@app.post("/api/batches", response_model=schemas.BatchResponse, tags=["批次管理"])
def create_batch(batch: schemas.BatchCreate, db: Session = Depends(get_db)):
    existing = crud.get_batch_by_no(db, batch.batch_no)
    if existing:
        raise HTTPException(status_code=400, detail=f"批次号 {batch.batch_no} 已存在")
    return crud.create_batch(db, batch)


@app.get("/api/batches/{batch_no}", response_model=schemas.BatchResponse, tags=["批次管理"])
def get_batch(batch_no: str, db: Session = Depends(get_db)):
    batch = crud.get_batch_by_no(db, batch_no)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return batch


@app.get("/api/batches", response_model=List[schemas.BatchResponse], tags=["批次管理"])
def list_batches(db: Session = Depends(get_db)):
    return db.query(models.Batch).all()


@app.post("/api/materials/upload", tags=["材料管理"])
def upload_materials(upload: schemas.RawMaterialUpload, db: Session = Depends(get_db)):
    batch = crud.get_batch_by_no(db, upload.batch_no)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    if batch.status != "created":
        raise HTTPException(status_code=400, detail="批次已处理，不能重复上传")

    material_hash = crud.calculate_material_hash([m.dict() for m in upload.materials])

    existing_batch = crud.get_batch_by_hash(db, material_hash)
    if existing_batch and existing_batch.id != batch.id:
        return {
            "status": "duplicate",
            "message": "检测到重复材料，返回原有处理结果",
            "original_batch_no": existing_batch.batch_no,
            "original_batch_status": existing_batch.status,
            "report_path": existing_batch.report_path
        }

    crud.update_batch_hash(db, batch.id, material_hash)

    line_numbers = [m.line_number for m in upload.materials]
    if len(line_numbers) != len(set(line_numbers)):
        raise HTTPException(status_code=400, detail="存在重复行号")

    crud.create_raw_materials(db, batch.id, upload.materials)

    return {
        "status": "success",
        "batch_no": batch.batch_no,
        "material_count": len(upload.materials),
        "material_hash": material_hash
    }


@app.get("/api/materials/batch/{batch_no}", response_model=List[schemas.RawMaterialResponse], tags=["材料管理"])
def get_batch_materials(batch_no: str, db: Session = Depends(get_db)):
    batch = crud.get_batch_by_no(db, batch_no)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return crud.get_raw_materials_by_batch(db, batch.id)


@app.post("/api/process/trigger", tags=["处理流程"])
def trigger_process(process_req: schemas.ProcessRequest, db: Session = Depends(get_db)):
    batch = crud.get_batch_by_no(db, process_req.batch_no)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    if batch.status == "completed":
        return {
            "status": "already_processed",
            "message": "批次已处理",
            "report_path": batch.report_path
        }

    materials = crud.get_raw_materials_by_batch(db, batch.id)
    if not materials:
        raise HTTPException(status_code=400, detail="批次没有材料")

    report_path = utils.process_batch(db, batch.id)

    return {
        "status": "success",
        "batch_no": batch.batch_no,
        "processed_count": len(materials),
        "report_path": report_path
    }


@app.get("/api/trace/{material_id}", response_model=schemas.ProcessTraceResponse, tags=["处理轨迹"])
def get_process_trace(material_id: int, db: Session = Depends(get_db)):
    material = crud.get_raw_material_by_id(db, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="材料不存在")

    records = crud.get_process_records_by_material(db, material_id)

    return {
        "raw_material": material,
        "process_records": records
    }


@app.get("/api/reports/{batch_no}", tags=["报告下载"])
def download_report(batch_no: str, db: Session = Depends(get_db)):
    batch = crud.get_batch_by_no(db, batch_no)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    if not batch.report_path or not os.path.exists(batch.report_path):
        raise HTTPException(status_code=404, detail="报告不存在或尚未生成")

    return FileResponse(
        path=batch.report_path,
        filename=os.path.basename(batch.report_path),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


@app.post("/api/sku-aliases", tags=["SKU管理"])
def create_sku_alias(alias: schemas.SkuAliasCreate, db: Session = Depends(get_db)):
    return crud.create_sku_alias(db, alias)


@app.get("/api/sku-aliases", tags=["SKU管理"])
def list_sku_aliases(db: Session = Depends(get_db)):
    return crud.get_all_sku_aliases(db)


@app.post("/api/location-time", tags=["点位管理"])
def set_location_time(location_code: str, standard_time: str, db: Session = Depends(get_db)):
    from datetime import datetime
    try:
        dt = datetime.fromisoformat(standard_time)
    except ValueError:
        raise HTTPException(status_code=400, detail="时间格式错误，请使用 ISO 格式")

    return crud.create_location_inventory_time(db, location_code, dt)


@app.get("/api/health", tags=["系统"])
def health_check():
    return {"status": "ok", "message": "无人货架补货差异服务运行正常"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
