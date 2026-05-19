from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import re
import os

from database import (
    init_db,
    get_db,
    EnvFile,
    EnvVariable,
    VariableReference,
    ResponsiblePerson,
    RotationBatch,
    RotationItem,
    VariableStatus
)
import schemas

init_db()

app = FastAPI(
    title=".env轮换计划引用扫描后端API",
    description="环境变量轮换计划管理系统，支持变量依赖扫描、批次分组、回滚值遮蔽、负责人汇总、报告输出",
    version="1.0.0"
)


class APIErrorCodes:
    MISSING_FIELD = "MISSING_FIELD"
    INVALID_STATUS = "INVALID_STATUS"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    ALREADY_PROCESSED = "ALREADY_PROCESSED"
    NOT_FOUND = "NOT_FOUND"
    DUPLICATE_ENTRY = "DUPLICATE_ENTRY"
    INVALID_OPERATION = "INVALID_OPERATION"


def create_error_response(
    error_code: str,
    message: str,
    details: Optional[dict] = None,
    status_code: int = status.HTTP_400_BAD_REQUEST
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "error_code": error_code,
            "message": message,
            "details": details or {}
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    return create_error_response(
        "INTERNAL_ERROR",
        str(exc),
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
    )


@app.get("/")
def read_root():
    return {"message": ".env轮换计划引用扫描后端API", "version": "1.0.0"}


@app.post("/api/env/import", response_model=schemas.EnvImportResponse)
def import_env_file(
    request: schemas.EnvImportRequest,
    db: Session = Depends(get_db)
):
    if not request.file_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": APIErrorCodes.MISSING_FIELD,
                "message": "file_path字段不能为空",
                "details": {"field": "file_path"}
            }
        )
    
    if not os.path.exists(request.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": APIErrorCodes.NOT_FOUND,
                "message": f"文件不存在: {request.file_path}",
                "details": {"file_path": request.file_path}
            }
        )
    
    existing_file = db.query(EnvFile).filter(EnvFile.file_path == request.file_path).first()
    if existing_file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": APIErrorCodes.DUPLICATE_ENTRY,
                "message": "该.env文件已导入过",
                "details": {"file_path": request.file_path, "existing_id": existing_file.id}
            }
        )
    
    env_file = EnvFile(
        file_path=request.file_path,
        project_name=request.project_name,
        environment=request.environment
    )
    db.add(env_file)
    db.commit()
    db.refresh(env_file)
    
    variable_count = 0
    env_vars = {}
    
    with open(request.file_path, 'r') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip().strip('"\'')
                
                is_sensitive = any(kw in key.lower() for kw in ['password', 'secret', 'token', 'key', 'auth'])
                
                var = EnvVariable(
                    env_file_id=env_file.id,
                    key=key,
                    original_value=value,
                    current_value=value,
                    is_sensitive=is_sensitive
                )
                db.add(var)
                env_vars[key] = var
                variable_count += 1
    
    db.commit()
    
    reference_count = 0
    if request.auto_scan_references:
        reference_count = scan_variable_references(env_file.id, env_vars, db)
    
    db.commit()
    
    return {
        "success": True,
        "env_file_id": env_file.id,
        "variable_count": variable_count,
        "reference_count": reference_count,
        "message": f"成功导入{variable_count}个环境变量，发现{reference_count}个引用关系"
    }


def scan_variable_references(env_file_id: int, env_vars: dict, db: Session) -> int:
    reference_count = 0
    var_pattern = re.compile(r'\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?')
    
    for key, var in env_vars.items():
        if var.current_value:
            matches = var_pattern.findall(var.current_value)
            for ref_key in matches:
                if ref_key in env_vars:
                    ref = VariableReference(
                        from_variable_id=var.id,
                        to_variable_id=env_vars[ref_key].id,
                        reference_type="value_reference",
                        line_number=None
                    )
                    db.add(ref)
                    reference_count += 1
    
    return reference_count


@app.get("/api/env/files", response_model=List[schemas.EnvFile])
def list_env_files(
    project_name: Optional[str] = None,
    environment: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(EnvFile)
    if project_name:
        query = query.filter(EnvFile.project_name == project_name)
    if environment:
        query = query.filter(EnvFile.environment == environment)
    
    files = query.all()
    for f in files:
        f.variable_count = db.query(EnvVariable).filter(EnvVariable.env_file_id == f.id).count()
    return files


@app.get("/api/env/variables", response_model=List[schemas.EnvVariable])
def list_env_variables(
    env_file_id: Optional[int] = None,
    is_sensitive: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(EnvVariable)
    if env_file_id:
        query = query.filter(EnvVariable.env_file_id == env_file_id)
    if is_sensitive is not None:
        query = query.filter(EnvVariable.is_sensitive == is_sensitive)
    
    variables = query.all()
    for var in variables:
        var.reference_count = db.query(VariableReference).filter(
            (VariableReference.from_variable_id == var.id) |
            (VariableReference.to_variable_id == var.id)
        ).count()
    return variables


@app.get("/api/variables/{variable_id}/dependencies", response_model=schemas.DependencyScanResult)
def get_variable_dependencies(variable_id: int, db: Session = Depends(get_db)):
    variable = db.query(EnvVariable).filter(EnvVariable.id == variable_id).first()
    if not variable:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": APIErrorCodes.NOT_FOUND,
                "message": "变量不存在",
                "details": {"variable_id": variable_id}
            }
        )
    
    depends_on = []
    refs_from = db.query(VariableReference).filter(VariableReference.from_variable_id == variable_id).all()
    for ref in refs_from:
        to_var = db.query(EnvVariable).filter(EnvVariable.id == ref.to_variable_id).first()
        if to_var:
            depends_on.append({
                "variable_id": to_var.id,
                "key": to_var.key,
                "reference_type": ref.reference_type
            })
    
    depended_by = []
    refs_to = db.query(VariableReference).filter(VariableReference.to_variable_id == variable_id).all()
    for ref in refs_to:
        from_var = db.query(EnvVariable).filter(EnvVariable.id == ref.from_variable_id).first()
        if from_var:
            depended_by.append({
                "variable_id": from_var.id,
                "key": from_var.key,
                "reference_type": ref.reference_type
            })
    
    dependency_level = calculate_dependency_level(variable_id, db)
    
    return {
        "variable_id": variable_id,
        "variable_key": variable.key,
        "depends_on": depends_on,
        "depended_by": depended_by,
        "dependency_level": dependency_level
    }


def calculate_dependency_level(variable_id: int, db: Session, visited: set = None) -> int:
    if visited is None:
        visited = set()
    
    if variable_id in visited:
        return 0
    visited.add(variable_id)
    
    refs = db.query(VariableReference).filter(VariableReference.from_variable_id == variable_id).all()
    if not refs:
        return 0
    
    max_level = 0
    for ref in refs:
        level = calculate_dependency_level(ref.to_variable_id, db, visited.copy())
        max_level = max(max_level, level + 1)
    
    return max_level


@app.post("/api/responsible-persons", response_model=schemas.ResponsiblePerson)
def create_responsible_person(
    person: schemas.ResponsiblePersonCreate,
    db: Session = Depends(get_db)
):
    if not person.name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": APIErrorCodes.MISSING_FIELD,
                "message": "name字段不能为空",
                "details": {"field": "name"}
            }
        )
    
    db_person = ResponsiblePerson(**person.model_dump())
    db.add(db_person)
    db.commit()
    db.refresh(db_person)
    return db_person


@app.get("/api/responsible-persons", response_model=List[schemas.ResponsiblePerson])
def list_responsible_persons(
    department: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ResponsiblePerson)
    if department:
        query = query.filter(ResponsiblePerson.department == department)
    
    persons = query.all()
    for p in persons:
        p.batch_count = db.query(RotationBatch).filter(RotationBatch.responsible_person_id == p.id).count()
    return persons


@app.post("/api/batches/group", response_model=schemas.BatchGroupResponse)
def create_rotation_batch(
    request: schemas.BatchGroupRequest,
    db: Session = Depends(get_db)
):
    if not request.batch_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": APIErrorCodes.MISSING_FIELD,
                "message": "batch_name字段不能为空",
                "details": {"field": "batch_name"}
            }
        )
    
    if not request.variable_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": APIErrorCodes.MISSING_FIELD,
                "message": "variable_ids列表不能为空",
                "details": {"field": "variable_ids"}
            }
        )
    
    existing_batch = db.query(RotationBatch).filter(RotationBatch.batch_name == request.batch_name).first()
    if existing_batch:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": APIErrorCodes.DUPLICATE_ENTRY,
                "message": "批次名称已存在",
                "details": {"batch_name": request.batch_name}
            }
        )
    
    all_variable_ids = set(request.variable_ids)
    if request.auto_detect_dependencies:
        for var_id in request.variable_ids:
            deps = get_all_dependent_variables(var_id, db)
            all_variable_ids.update(deps)
    
    batch = RotationBatch(
        batch_name=request.batch_name,
        description=request.description,
        responsible_person_id=request.responsible_person_id,
        scheduled_at=request.scheduled_at
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    
    item_count = 0
    for var_id in all_variable_ids:
        variable = db.query(EnvVariable).filter(EnvVariable.id == var_id).first()
        if variable:
            item = RotationItem(
                batch_id=batch.id,
                variable_id=var_id,
                new_value="",
                rollback_value=variable.current_value or "",
                requires_review=variable.is_sensitive or calculate_dependency_level(var_id, db) > 1
            )
            db.add(item)
            item_count += 1
    
    db.commit()
    
    return {
        "success": True,
        "batch_id": batch.id,
        "item_count": item_count,
        "message": f"成功创建批次，包含{item_count}个轮换项（含自动检测的依赖变量）"
    }


def get_all_dependent_variables(variable_id: int, db: Session, visited: set = None) -> set:
    if visited is None:
        visited = set()
    
    if variable_id in visited:
        return visited
    visited.add(variable_id)
    
    refs = db.query(VariableReference).filter(VariableReference.from_variable_id == variable_id).all()
    for ref in refs:
        get_all_dependent_variables(ref.to_variable_id, db, visited)
    
    return visited


@app.get("/api/batches", response_model=List[schemas.RotationBatch])
def list_rotation_batches(
    status: Optional[VariableStatus] = None,
    responsible_person_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(RotationBatch)
    if status:
        query = query.filter(RotationBatch.status == status)
    if responsible_person_id:
        query = query.filter(RotationBatch.responsible_person_id == responsible_person_id)
    
    batches = query.all()
    for b in batches:
        b.item_count = db.query(RotationItem).filter(RotationItem.batch_id == b.id).count()
    return batches


@app.get("/api/batches/{batch_id}/items", response_model=List[schemas.RotationItem])
def get_batch_items(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(RotationBatch).filter(RotationBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": APIErrorCodes.NOT_FOUND,
                "message": "批次不存在",
                "details": {"batch_id": batch_id}
            }
        )
    
    items = db.query(RotationItem).filter(RotationItem.batch_id == batch_id).all()
    result = []
    for item in items:
        variable = db.query(EnvVariable).filter(EnvVariable.id == item.variable_id).first()
        item_data = {
            "id": item.id,
            "batch_id": item.batch_id,
            "variable_id": item.variable_id,
            "variable_key": variable.key if variable else None,
            "new_value": item.new_value,
            "rollback_value_masked": mask_sensitive_value(item.rollback_value) if item.variable_id else None,
            "status": item.status,
            "requires_review": item.requires_review,
            "review_note": item.review_note,
            "executed_at": item.executed_at,
            "rolled_back_at": item.rolled_back_at,
            "created_at": item.created_at,
            "updated_at": item.updated_at
        }
        result.append(item_data)
    return result


def mask_sensitive_value(value: str) -> str:
    if not value or len(value) <= 4:
        return "***"
    return value[:2] + "*" * (len(value) - 4) + value[-2:]


@app.put("/api/batches/{batch_id}/execute")
def execute_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(RotationBatch).filter(RotationBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": APIErrorCodes.NOT_FOUND,
                "message": "批次不存在",
                "details": {"batch_id": batch_id}
            }
        )
    
    if batch.status in [VariableStatus.COMPLETED, VariableStatus.PROCESSING]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": APIErrorCodes.ALREADY_PROCESSED,
                "message": "批次已处理或正在处理中",
                "details": {"batch_id": batch_id, "current_status": batch.status}
            }
        )
    
    items = db.query(RotationItem).filter(RotationItem.batch_id == batch_id).all()
    review_required = [item for item in items if item.requires_review and item.status != VariableStatus.APPROVED]
    if review_required:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": APIErrorCodes.REVIEW_REQUIRED,
                "message": "部分轮换项需要人工复核",
                "details": {
                    "review_required_count": len(review_required),
                    "item_ids": [item.id for item in review_required]
                }
            }
        )
    
    batch.status = VariableStatus.PROCESSING
    db.commit()
    
    for item in items:
        if item.status not in [VariableStatus.COMPLETED, VariableStatus.SKIPPED]:
            variable = db.query(EnvVariable).filter(EnvVariable.id == item.variable_id).first()
            if variable and item.new_value:
                variable.current_value = item.new_value
            item.status = VariableStatus.COMPLETED
            item.executed_at = datetime.utcnow()
    
    batch.status = VariableStatus.COMPLETED
    batch.executed_at = datetime.utcnow()
    db.commit()
    
    return {"success": True, "message": "批次执行成功", "batch_id": batch_id}


@app.put("/api/batches/{batch_id}/rollback")
def rollback_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(RotationBatch).filter(RotationBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": APIErrorCodes.NOT_FOUND,
                "message": "批次不存在",
                "details": {"batch_id": batch_id}
            }
        )
    
    if batch.status != VariableStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": APIErrorCodes.INVALID_STATUS,
                "message": "只有已完成的批次才能回滚",
                "details": {"batch_id": batch_id, "current_status": batch.status}
            }
        )
    
    items = db.query(RotationItem).filter(RotationItem.batch_id == batch_id).all()
    
    for item in items:
        variable = db.query(EnvVariable).filter(EnvVariable.id == item.variable_id).first()
        if variable:
            variable.current_value = item.rollback_value
        item.status = VariableStatus.ROLLED_BACK
        item.rolled_back_at = datetime.utcnow()
    
    batch.status = VariableStatus.ROLLED_BACK
    db.commit()
    
    return {"success": True, "message": "批次回滚成功", "batch_id": batch_id}


@app.post("/api/reports/generate", response_model=schemas.ReportResponse)
def generate_report(request: schemas.ReportRequest, db: Session = Depends(get_db)):
    report_data = {}
    
    query = db.query(RotationItem)
    if request.batch_id:
        query = query.filter(RotationItem.batch_id == request.batch_id)
    if request.status:
        query = query.filter(RotationItem.status == request.status)
    
    items = query.all()
    
    report_data["summary"] = {
        "total_items": len(items),
        "pending_count": len([i for i in items if i.status == VariableStatus.PENDING]),
        "review_required_count": len([i for i in items if i.requires_review]),
        "completed_count": len([i for i in items if i.status == VariableStatus.COMPLETED]),
        "rolled_back_count": len([i for i in items if i.status == VariableStatus.ROLLED_BACK])
    }
    
    person_summary = {}
    batches = db.query(RotationBatch).all()
    for batch in batches:
        if batch.responsible_person_id:
            person = db.query(ResponsiblePerson).filter(ResponsiblePerson.id == batch.responsible_person_id).first()
            if person:
                batch_items = db.query(RotationItem).filter(RotationItem.batch_id == batch.id).all()
                if person.name not in person_summary:
                    person_summary[person.name] = {
                        "person_id": person.id,
                        "email": person.email,
                        "department": person.department,
                        "batch_count": 0,
                        "item_count": 0
                    }
                person_summary[person.name]["batch_count"] += 1
                person_summary[person.name]["item_count"] += len(batch_items)
    
    report_data["responsible_persons"] = person_summary
    
    batch_details = []
    for batch in batches:
        if request.batch_id and batch.id != request.batch_id:
            continue
        batch_items = db.query(RotationItem).filter(RotationItem.batch_id == batch.id).all()
        batch_details.append({
            "batch_id": batch.id,
            "batch_name": batch.batch_name,
            "status": batch.status,
            "item_count": len(batch_items),
            "scheduled_at": batch.scheduled_at.isoformat() if batch.scheduled_at else None,
            "executed_at": batch.executed_at.isoformat() if batch.executed_at else None
        })
    
    report_data["batches"] = batch_details
    report_data["generated_at"] = datetime.utcnow().isoformat()
    
    return {
        "success": True,
        "report_data": report_data,
        "generated_at": datetime.utcnow()
    }


@app.get("/api/references", response_model=List[schemas.VariableReference])
def list_variable_references(
    from_variable_id: Optional[int] = None,
    to_variable_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(VariableReference)
    if from_variable_id:
        query = query.filter(VariableReference.from_variable_id == from_variable_id)
    if to_variable_id:
        query = query.filter(VariableReference.to_variable_id == to_variable_id)
    
    refs = query.all()
    for ref in refs:
        from_var = db.query(EnvVariable).filter(EnvVariable.id == ref.from_variable_id).first()
        to_var = db.query(EnvVariable).filter(EnvVariable.id == ref.to_variable_id).first()
        ref.from_variable_key = from_var.key if from_var else None
        ref.to_variable_key = to_var.key if to_var else None
    return refs


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
