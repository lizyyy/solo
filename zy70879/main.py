import hashlib
import json
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db, engine, Base
from models import Batch, Material, AllocationResult, AuditLog

Base.metadata.create_all(bind=engine)

app = FastAPI(title="高校导师名额分配 API", version="1.0.0")


class MaterialItem(BaseModel):
    student_id: str
    student_name: str
    department: str
    major: Optional[str] = None
    gpa: Optional[float] = None
    research_interest: Optional[str] = None
    preferred_tutors: Optional[str] = None
    application_materials: Optional[str] = None


class BatchCreateRequest(BaseModel):
    batch_name: str
    submitted_by: str
    description: Optional[str] = None
    materials: List[MaterialItem]


class AllocationUpdateRequest(BaseModel):
    modified_by: str
    change_reason: str
    tutor_id: Optional[str] = None
    tutor_name: Optional[str] = None
    allocation_reason: Optional[str] = None


def calculate_content_hash(materials: List[dict]) -> str:
    sorted_materials = sorted(materials, key=lambda x: x.get("student_id", ""))
    content_str = json.dumps(sorted_materials, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(content_str.encode("utf-8")).hexdigest()


def generate_allocation(material: Material) -> dict:
    tutor_mapping = {
        "计算机学院": [
            {"id": "CS001", "name": "张教授"},
            {"id": "CS002", "name": "李教授"},
        ],
        "数学学院": [
            {"id": "MATH001", "name": "王教授"},
            {"id": "MATH002", "name": "赵教授"},
        ],
        "物理学院": [
            {"id": "PHY001", "name": "刘教授"},
            {"id": "PHY002", "name": "陈教授"},
        ],
    }
    
    tutors = tutor_mapping.get(material.department, [
        {"id": "DEFAULT001", "name": "通用导师A"},
        {"id": "DEFAULT002", "name": "通用导师B"},
    ])
    
    idx = hash(material.student_id) % len(tutors)
    tutor = tutors[idx]
    
    return {
        "tutor_id": tutor["id"],
        "tutor_name": tutor["name"],
        "department": material.department,
        "allocation_reason": f"基于{material.department}研究方向匹配，GPA: {material.gpa}"
    }


@app.post("/api/batches", summary="提交批次材料")
async def create_batch(request: BatchCreateRequest, db: Session = Depends(get_db)):
    materials_data = [m.dict() for m in request.materials]
    content_hash = calculate_content_hash(materials_data)
    
    existing_batch = db.query(Batch).filter(Batch.content_hash == content_hash).first()
    if existing_batch:
        results = db.query(AllocationResult).filter(
            AllocationResult.batch_id == existing_batch.id,
            AllocationResult.is_valid == 1
        ).all()
        
        return JSONResponse({
            "message": "重复提交，返回已有处理结果",
            "is_duplicate": True,
            "batch_id": existing_batch.id,
            "batch_name": existing_batch.batch_name,
            "submitted_at": existing_batch.submitted_at.isoformat(),
            "allocation_results": [
                {
                    "id": r.id,
                    "student_id": r.student_id,
                    "student_name": r.student_name,
                    "tutor_id": r.tutor_id,
                    "tutor_name": r.tutor_name,
                    "department": r.department,
                    "allocation_reason": r.allocation_reason
                }
                for r in results
            ]
        }, status_code=200)
    
    batch = Batch(
        batch_name=request.batch_name,
        content_hash=content_hash,
        submitted_by=request.submitted_by,
        description=request.description,
        status="completed"
    )
    db.add(batch)
    db.flush()
    
    for mat_data in request.materials:
        material = Material(
            batch_id=batch.id,
            student_id=mat_data.student_id,
            student_name=mat_data.student_name,
            department=mat_data.department,
            major=mat_data.major,
            gpa=mat_data.gpa,
            research_interest=mat_data.research_interest,
            preferred_tutors=mat_data.preferred_tutors,
            application_materials=mat_data.application_materials
        )
        db.add(material)
        db.flush()
        
        allocation = generate_allocation(material)
        result = AllocationResult(
            batch_id=batch.id,
            material_id=material.id,
            student_id=material.student_id,
            student_name=material.student_name,
            tutor_id=allocation["tutor_id"],
            tutor_name=allocation["tutor_name"],
            department=allocation["department"],
            allocation_reason=allocation["allocation_reason"],
            is_valid=1
        )
        db.add(result)
    
    db.commit()
    
    results = db.query(AllocationResult).filter(
        AllocationResult.batch_id == batch.id,
        AllocationResult.is_valid == 1
    ).all()
    
    return {
        "message": "批次提交成功",
        "is_duplicate": False,
        "batch_id": batch.id,
        "batch_name": batch.batch_name,
        "submitted_at": batch.submitted_at.isoformat(),
        "allocation_results": [
            {
                "id": r.id,
                "student_id": r.student_id,
                "student_name": r.student_name,
                "tutor_id": r.tutor_id,
                "tutor_name": r.tutor_name,
                "department": r.department,
                "allocation_reason": r.allocation_reason
            }
            for r in results
        ]
    }


@app.get("/api/batches/{batch_id}/results", summary="查询批次分配结果")
async def get_batch_results(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    results = db.query(AllocationResult).filter(
        AllocationResult.batch_id == batch_id,
        AllocationResult.is_valid == 1
    ).all()
    
    materials = db.query(Material).filter(Material.batch_id == batch_id).all()
    material_map = {m.id: m for m in materials}
    
    return {
        "batch_id": batch.id,
        "batch_name": batch.batch_name,
        "submitted_by": batch.submitted_by,
        "submitted_at": batch.submitted_at.isoformat(),
        "status": batch.status,
        "allocation_results": [
            {
                "id": r.id,
                "student_id": r.student_id,
                "student_name": r.student_name,
                "tutor_id": r.tutor_id,
                "tutor_name": r.tutor_name,
                "department": r.department,
                "allocation_reason": r.allocation_reason,
                "original_material": {
                    "major": material_map.get(r.material_id).major if material_map.get(r.material_id) else None,
                    "gpa": material_map.get(r.material_id).gpa if material_map.get(r.material_id) else None,
                    "research_interest": material_map.get(r.material_id).research_interest if material_map.get(r.material_id) else None,
                    "preferred_tutors": material_map.get(r.material_id).preferred_tutors if material_map.get(r.material_id) else None
                } if material_map.get(r.material_id) else None
            }
            for r in results
        ]
    }


@app.put("/api/results/{result_id}", summary="修改分配结论")
async def update_allocation(
    result_id: int,
    request: AllocationUpdateRequest,
    db: Session = Depends(get_db)
):
    result = db.query(AllocationResult).filter(
        AllocationResult.id == result_id,
        AllocationResult.is_valid == 1
    ).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="分配结果不存在")
    
    fields_to_update = []
    if request.tutor_id is not None and request.tutor_id != result.tutor_id:
        audit_log = AuditLog(
            batch_id=result.batch_id,
            result_id=result.id,
            modified_by=request.modified_by,
            change_reason=request.change_reason,
            field_name="tutor_id",
            old_value=result.tutor_id,
            new_value=request.tutor_id
        )
        db.add(audit_log)
        result.tutor_id = request.tutor_id
        fields_to_update.append("tutor_id")
    
    if request.tutor_name is not None and request.tutor_name != result.tutor_name:
        audit_log = AuditLog(
            batch_id=result.batch_id,
            result_id=result.id,
            modified_by=request.modified_by,
            change_reason=request.change_reason,
            field_name="tutor_name",
            old_value=result.tutor_name,
            new_value=request.tutor_name
        )
        db.add(audit_log)
        result.tutor_name = request.tutor_name
        fields_to_update.append("tutor_name")
    
    if request.allocation_reason is not None and request.allocation_reason != result.allocation_reason:
        audit_log = AuditLog(
            batch_id=result.batch_id,
            result_id=result.id,
            modified_by=request.modified_by,
            change_reason=request.change_reason,
            field_name="allocation_reason",
            old_value=result.allocation_reason,
            new_value=request.allocation_reason
        )
        db.add(audit_log)
        result.allocation_reason = request.allocation_reason
        fields_to_update.append("allocation_reason")
    
    db.commit()
    
    return {
        "message": "分配结果已更新",
        "result_id": result.id,
        "updated_fields": fields_to_update,
        "current_value": {
            "tutor_id": result.tutor_id,
            "tutor_name": result.tutor_name,
            "allocation_reason": result.allocation_reason
        }
    }


@app.get("/api/batches/{batch_id}/audit-logs", summary="查询批次修改记录")
async def get_audit_logs(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    logs = db.query(AuditLog).filter(AuditLog.batch_id == batch_id).order_by(AuditLog.modified_at.desc()).all()
    
    return {
        "batch_id": batch.id,
        "batch_name": batch.batch_name,
        "audit_logs": [
            {
                "id": log.id,
                "result_id": log.result_id,
                "modified_by": log.modified_by,
                "modified_at": log.modified_at.isoformat(),
                "change_reason": log.change_reason,
                "field_name": log.field_name,
                "old_value": log.old_value,
                "new_value": log.new_value
            }
            for log in logs
        ]
    }


@app.get("/api/batches/{batch_id}/report", summary="下载批次报告")
async def download_report(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    materials = db.query(Material).filter(Material.batch_id == batch_id).all()
    results = db.query(AllocationResult).filter(
        AllocationResult.batch_id == batch_id,
        AllocationResult.is_valid == 1
    ).all()
    logs = db.query(AuditLog).filter(AuditLog.batch_id == batch_id).all()
    
    result_map = {r.student_id: r for r in results}
    audit_map = {}
    for log in logs:
        if log.result_id not in audit_map:
            audit_map[log.result_id] = []
        audit_map[log.result_id].append({
            "modified_by": log.modified_by,
            "modified_at": log.modified_at.isoformat(),
            "change_reason": log.change_reason,
            "field_name": log.field_name,
            "old_value": log.old_value,
            "new_value": log.new_value
        })
    
    report_data = []
    for mat in materials:
        result = result_map.get(mat.student_id)
        if result:
            report_data.append({
                "student_id": mat.student_id,
                "student_name": mat.student_name,
                "department": mat.department,
                "major": mat.major,
                "gpa": mat.gpa,
                "research_interest": mat.research_interest,
                "preferred_tutors": mat.preferred_tutors,
                "tutor_id": result.tutor_id,
                "tutor_name": result.tutor_name,
                "allocation_reason": result.allocation_reason,
                "modification_history": audit_map.get(result.id, [])
            })
    
    return {
        "report_generated_at": datetime.now().isoformat(),
        "batch_info": {
            "batch_id": batch.id,
            "batch_name": batch.batch_name,
            "submitted_by": batch.submitted_by,
            "submitted_at": batch.submitted_at.isoformat(),
            "description": batch.description
        },
        "total_students": len(report_data),
        "total_modifications": len(logs),
        "data": report_data
    }


@app.get("/api/batches", summary="查询所有批次")
async def list_batches(db: Session = Depends(get_db)):
    batches = db.query(Batch).order_by(Batch.submitted_at.desc()).all()
    
    return {
        "batches": [
            {
                "id": b.id,
                "batch_name": b.batch_name,
                "submitted_by": b.submitted_by,
                "submitted_at": b.submitted_at.isoformat(),
                "status": b.status
            }
            for b in batches
        ]
    }
