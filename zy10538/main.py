from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import pandas as pd
import json
import os
from io import BytesIO
from database import get_db, init_db, ComplaintMaterial, MaterialCorrection, MaterialChecklist
from schemas import (
    ComplaintMaterialCreate, ComplaintMaterialUpdate, ComplaintMaterialQuery,
    ComplaintMaterialResponse, CorrectionCreate, CorrectionResponse,
    ComplaintMissingResponse, AuditRequest, MaterialStatus
)

app = FastAPI(title="投诉证据材料补交API", version="1.0.0")


@app.on_event("startup")
async def startup_event():
    init_db()


@app.post("/api/materials/", response_model=ComplaintMaterialResponse)
def create_material(material: ComplaintMaterialCreate, db: Session = Depends(get_db)):
    existing = db.query(ComplaintMaterial).filter(
        ComplaintMaterial.complaint_no == material.complaint_no,
        ComplaintMaterial.material_type == material.material_type,
        ComplaintMaterial.batch_no == material.batch_no,
        ComplaintMaterial.is_deleted == 0
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="该批次材料已存在")
    
    db_material = ComplaintMaterial(
        complaint_no=material.complaint_no,
        material_type=material.material_type,
        batch_no=material.batch_no,
        status=MaterialStatus.SUBMITTED,
        submitted_by=material.submitted_by,
        material_report=material.material_report,
        raw_input=material.raw_input
    )
    db.add(db_material)
    db.commit()
    db.refresh(db_material)
    return db_material


@app.get("/api/materials/", response_model=List[ComplaintMaterialResponse])
def list_materials(
    complaint_no: Optional[str] = None,
    material_type: Optional[str] = None,
    status: Optional[str] = None,
    batch_no: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(ComplaintMaterial).filter(ComplaintMaterial.is_deleted == 0)
    
    if complaint_no:
        query = query.filter(ComplaintMaterial.complaint_no == complaint_no)
    if material_type:
        query = query.filter(ComplaintMaterial.material_type == material_type)
    if status:
        query = query.filter(ComplaintMaterial.status == status)
    if batch_no:
        query = query.filter(ComplaintMaterial.batch_no == batch_no)
    
    offset = (page - 1) * page_size
    materials = query.order_by(ComplaintMaterial.created_at.desc()).offset(offset).limit(page_size).all()
    return materials


@app.get("/api/materials/{material_id}", response_model=ComplaintMaterialResponse)
def get_material(material_id: int, db: Session = Depends(get_db)):
    material = db.query(ComplaintMaterial).filter(
        ComplaintMaterial.id == material_id,
        ComplaintMaterial.is_deleted == 0
    ).first()
    if not material:
        raise HTTPException(status_code=404, detail="材料不存在")
    return material


@app.put("/api/materials/{material_id}/status", response_model=ComplaintMaterialResponse)
def update_material_status(
    material_id: int,
    update: ComplaintMaterialUpdate,
    db: Session = Depends(get_db)
):
    material = db.query(ComplaintMaterial).filter(
        ComplaintMaterial.id == material_id,
        ComplaintMaterial.is_deleted == 0
    ).first()
    if not material:
        raise HTTPException(status_code=404, detail="材料不存在")
    
    if update.status:
        material.status = update.status
    if update.missing_description is not None:
        material.missing_description = update.missing_description
    if update.material_report is not None:
        material.material_report = update.material_report
    if update.auditor:
        material.auditor = update.auditor
    if update.audit_comment is not None:
        material.audit_comment = update.audit_comment
    if update.processing_basis is not None:
        material.processing_basis = update.processing_basis
    if update.final_conclusion is not None:
        material.final_conclusion = update.final_conclusion
    
    material.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(material)
    return material


@app.post("/api/materials/{material_id}/audit", response_model=ComplaintMaterialResponse)
def audit_material(
    material_id: int,
    audit: AuditRequest,
    db: Session = Depends(get_db)
):
    material = db.query(ComplaintMaterial).filter(
        ComplaintMaterial.id == material_id,
        ComplaintMaterial.is_deleted == 0
    ).first()
    if not material:
        raise HTTPException(status_code=404, detail="材料不存在")
    
    valid_statuses = [s.value for s in MaterialStatus]
    if audit.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"无效状态，有效值为: {valid_statuses}")
    
    material.status = audit.status
    material.auditor = audit.auditor
    material.audit_comment = audit.audit_comment
    material.audit_time = datetime.utcnow()
    material.processing_basis = audit.processing_basis
    material.final_conclusion = audit.final_conclusion
    material.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(material)
    return material


@app.post("/api/materials/{material_id}/correct", response_model=ComplaintMaterialResponse)
def correct_material(
    material_id: int,
    correction: CorrectionCreate,
    db: Session = Depends(get_db)
):
    material = db.query(ComplaintMaterial).filter(
        ComplaintMaterial.id == material_id,
        ComplaintMaterial.is_deleted == 0
    ).first()
    if not material:
        raise HTTPException(status_code=404, detail="材料不存在")
    
    old_values = {}
    for key, value in correction.new_values.items():
        if hasattr(material, key):
            old_value = getattr(material, key)
            old_values[key] = old_value
            setattr(material, key, value)
    
    correction_record = MaterialCorrection(
        material_id=material_id,
        corrected_by=correction.corrected_by,
        correction_reason=correction.correction_reason,
        old_values=old_values,
        new_values=correction.new_values
    )
    db.add(correction_record)
    material.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(material)
    return material


@app.get("/api/materials/{material_id}/corrections", response_model=List[CorrectionResponse])
def get_material_corrections(material_id: int, db: Session = Depends(get_db)):
    corrections = db.query(MaterialCorrection).filter(
        MaterialCorrection.material_id == material_id
    ).order_by(MaterialCorrection.created_at.desc()).all()
    return corrections


@app.get("/api/complaints/{complaint_no}/missing", response_model=ComplaintMissingResponse)
def get_missing_materials(complaint_no: str, complaint_type: str = "service_complaint", db: Session = Depends(get_db)):
    checklist = db.query(MaterialChecklist).filter(
        MaterialChecklist.complaint_type == complaint_type,
        MaterialChecklist.is_active == 1
    ).first()
    
    if not checklist:
        raise HTTPException(status_code=404, detail="未找到该投诉类型的材料清单")
    
    existing_materials = db.query(ComplaintMaterial).filter(
        ComplaintMaterial.complaint_no == complaint_no,
        ComplaintMaterial.is_deleted == 0
    ).all()
    
    material_map = {}
    for mat in existing_materials:
        if mat.material_type not in material_map or mat.batch_no > material_map[mat.material_type].batch_no:
            material_map[mat.material_type] = mat
    
    missing_list = []
    completed_count = 0
    
    for mat_type, mat_name in checklist.required_materials.items():
        if mat_type in material_map:
            mat = material_map[mat_type]
            status = mat.status
            if status == MaterialStatus.APPROVED or status == MaterialStatus.COMPLETED:
                completed_count += 1
            missing_list.append({
                "material_type": mat_type,
                "material_name": mat_name,
                "status": status,
                "batch_no": mat.batch_no,
                "missing_description": mat.missing_description
            })
        else:
            missing_list.append({
                "material_type": mat_type,
                "material_name": mat_name,
                "status": "missing",
                "batch_no": None,
                "missing_description": "未提交"
            })
    
    total_required = len(checklist.required_materials)
    missing_count = total_required - completed_count
    
    return {
        "complaint_no": complaint_no,
        "complaint_type": complaint_type,
        "missing_materials": missing_list,
        "total_required": total_required,
        "completed_count": completed_count,
        "missing_count": missing_count
    }


@app.get("/api/complaints/{complaint_no}/export")
def export_complaint_materials(complaint_no: str, db: Session = Depends(get_db)):
    materials = db.query(ComplaintMaterial).filter(
        ComplaintMaterial.complaint_no == complaint_no,
        ComplaintMaterial.is_deleted == 0
    ).order_by(ComplaintMaterial.batch_no, ComplaintMaterial.material_type).all()
    
    export_data = []
    for mat in materials:
        corrections = db.query(MaterialCorrection).filter(
            MaterialCorrection.material_id == mat.id
        ).all()
        
        row = {
            "投诉编号": mat.complaint_no,
            "材料类型": mat.material_type,
            "批次": mat.batch_no,
            "状态": mat.status,
            "缺失说明": mat.missing_description or "",
            "提交人": mat.submitted_by or "",
            "审核人": mat.auditor or "",
            "审核时间": mat.audit_time.strftime("%Y-%m-%d %H:%M:%S") if mat.audit_time else "",
            "审核意见": mat.audit_comment or "",
            "处理依据": mat.processing_basis or "",
            "最终结论": mat.final_conclusion or "",
            "创建时间": mat.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "更新时间": mat.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
            "修正次数": len(corrections),
            "原始输入": json.dumps(mat.raw_input, ensure_ascii=False) if mat.raw_input else ""
        }
        export_data.append(row)
    
    df = pd.DataFrame(export_data)
    filename = f"complaint_{complaint_no}_materials.xlsx"
    df.to_excel(filename, index=False, engine="openpyxl")
    
    return FileResponse(
        filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename
    )


@app.post("/api/materials/{material_id}/retry")
def retry_material(
    material_id: int,
    material_update: ComplaintMaterialCreate,
    db: Session = Depends(get_db)
):
    original = db.query(ComplaintMaterial).filter(
        ComplaintMaterial.id == material_id,
        ComplaintMaterial.is_deleted == 0
    ).first()
    
    if not original:
        raise HTTPException(status_code=404, detail="原始材料不存在")
    
    new_batch = original.batch_no + 1
    
    new_material = ComplaintMaterial(
        complaint_no=original.complaint_no,
        material_type=original.material_type,
        batch_no=new_batch,
        status=MaterialStatus.SUBMITTED,
        submitted_by=material_update.submitted_by,
        material_report=material_update.material_report,
        raw_input=material_update.raw_input,
        parent_id=original.id
    )
    db.add(new_material)
    db.commit()
    db.refresh(new_material)
    return new_material


@app.get("/api/materials/{material_id}/trace")
def trace_material(material_id: int, db: Session = Depends(get_db)):
    material = db.query(ComplaintMaterial).filter(
        ComplaintMaterial.id == material_id,
        ComplaintMaterial.is_deleted == 0
    ).first()
    
    if not material:
        raise HTTPException(status_code=404, detail="材料不存在")
    
    trace_chain = []
    current = material
    
    while current:
        corrections = db.query(MaterialCorrection).filter(
            MaterialCorrection.material_id == current.id
        ).all()
        
        trace_chain.append({
            "id": current.id,
            "batch_no": current.batch_no,
            "status": current.status,
            "created_at": current.created_at,
            "raw_input": current.raw_input,
            "processing_basis": current.processing_basis,
            "final_conclusion": current.final_conclusion,
            "auditor": current.auditor,
            "audit_comment": current.audit_comment,
            "corrections": [
                {
                    "corrected_by": c.corrected_by,
                    "reason": c.correction_reason,
                    "old_values": c.old_values,
                    "new_values": c.new_values,
                    "time": c.created_at
                } for c in corrections
            ]
        })
        
        if current.parent_id:
            current = db.query(ComplaintMaterial).get(current.parent_id)
        else:
            current = None
    
    trace_chain.reverse()
    
    return {
        "complaint_no": material.complaint_no,
        "material_type": material.material_type,
        "trace_chain": trace_chain,
        "total_batches": len(trace_chain)
    }


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
