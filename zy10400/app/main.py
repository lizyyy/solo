from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import os

from app.database import engine, get_db, Base
from app import models, schemas, crud
from app.models import ApprovalStatus, AnomalyStatus, AnomalyType

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MCP工具权限审计API",
    description="用于审计MCP工具权限声明与实际调用范围一致性的后端服务",
    version="1.0.0"
)


@app.post("/tools/", response_model=schemas.Tool, tags=["工具管理"])
def create_tool(tool: schemas.ToolCreate, db: Session = Depends(get_db)):
    db_tool = crud.get_tool_by_name(db, name=tool.name)
    if db_tool:
        raise HTTPException(status_code=400, detail="工具名称已存在")
    return crud.create_tool(db=db, tool=tool)


@app.get("/tools/", response_model=List[schemas.Tool], tags=["工具管理"])
def read_tools(skip: int = 0, limit: int = 100, server_name: Optional[str] = None, db: Session = Depends(get_db)):
    tools = crud.get_tools(db, skip=skip, limit=limit, server_name=server_name)
    return tools


@app.get("/tools/{tool_id}", response_model=schemas.Tool, tags=["工具管理"])
def read_tool(tool_id: int, db: Session = Depends(get_db)):
    db_tool = crud.get_tool(db, tool_id=tool_id)
    if db_tool is None:
        raise HTTPException(status_code=404, detail="工具不存在")
    return db_tool


@app.post("/permissions/", response_model=schemas.DeclaredPermission, tags=["权限声明"])
def create_declared_permission(permission: schemas.DeclaredPermissionCreate, db: Session = Depends(get_db)):
    db_tool = crud.get_tool(db, tool_id=permission.tool_id)
    if db_tool is None:
        raise HTTPException(status_code=404, detail="工具不存在")
    return crud.create_declared_permission(db=db, permission=permission)


@app.get("/permissions/", response_model=List[schemas.DeclaredPermission], tags=["权限声明"])
def read_permissions(tool_id: Optional[int] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    permissions = crud.get_declared_permissions(db, tool_id=tool_id, skip=skip, limit=limit)
    return permissions


@app.post("/calls/", response_model=schemas.ActualCall, tags=["实际调用"])
def create_actual_call(call: schemas.ActualCallCreate, db: Session = Depends(get_db)):
    db_tool = crud.get_tool(db, tool_id=call.tool_id)
    if db_tool is None:
        raise HTTPException(status_code=404, detail="工具不存在")
    if call.batch_id:
        db_batch = crud.get_approval_batch(db, batch_id=call.batch_id)
        if db_batch is None:
            raise HTTPException(status_code=404, detail="审批批次不存在")
    return crud.create_actual_call(db=db, call=call)


@app.get("/calls/", response_model=List[schemas.ActualCall], tags=["实际调用"])
def read_calls(tool_id: Optional[int] = None, batch_id: Optional[int] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    calls = crud.get_actual_calls(db, tool_id=tool_id, batch_id=batch_id, skip=skip, limit=limit)
    return calls


@app.post("/batches/", response_model=schemas.ApprovalBatch, tags=["审批批次"])
def create_approval_batch(batch: schemas.ApprovalBatchCreate, db: Session = Depends(get_db)):
    db_batch, created = crud.create_approval_batch(db=db, batch=batch)
    if not created:
        raise HTTPException(status_code=200, detail=f"批次 '{batch.batch_number}' 已存在，返回已有批次")
    return db_batch


@app.get("/batches/", response_model=List[schemas.ApprovalBatch], tags=["审批批次"])
def read_batches(skip: int = 0, limit: int = 100, status: Optional[ApprovalStatus] = None, db: Session = Depends(get_db)):
    batches = crud.get_approval_batches(db, skip=skip, limit=limit, status=status)
    return batches


@app.get("/batches/{batch_id}", response_model=schemas.ApprovalBatch, tags=["审批批次"])
def read_batch(batch_id: int, db: Session = Depends(get_db)):
    db_batch = crud.get_approval_batch(db, batch_id=batch_id)
    if db_batch is None:
        raise HTTPException(status_code=404, detail="审批批次不存在")
    return db_batch


@app.put("/batches/{batch_id}/status", response_model=schemas.ApprovalBatch, tags=["审批批次"])
def update_batch_status(batch_id: int, update: schemas.ApprovalBatchUpdate, db: Session = Depends(get_db)):
    result = crud.update_approval_batch_status(db, batch_id=batch_id, update=update)
    if result is None:
        raise HTTPException(status_code=404, detail="审批批次不存在")
    db_batch, updated = result
    if not updated:
        raise HTTPException(status_code=400, detail=f"当前批次状态为 '{db_batch.status.value}'，无法再次推进状态")
    return db_batch


@app.post("/anomalies/", response_model=schemas.Anomaly, tags=["异常管理"])
def create_anomaly(anomaly: schemas.AnomalyCreate, db: Session = Depends(get_db)):
    db_tool = crud.get_tool(db, tool_id=anomaly.tool_id)
    if db_tool is None:
        raise HTTPException(status_code=404, detail="工具不存在")
    return crud.create_anomaly(db=db, anomaly=anomaly)


@app.get("/anomalies/", response_model=List[schemas.Anomaly], tags=["异常管理"])
def read_anomalies(tool_id: Optional[int] = None, status: Optional[AnomalyStatus] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    anomalies = crud.get_anomalies(db, tool_id=tool_id, status=status, skip=skip, limit=limit)
    return anomalies


@app.get("/anomalies/{anomaly_id}", response_model=schemas.Anomaly, tags=["异常管理"])
def read_anomaly(anomaly_id: int, db: Session = Depends(get_db)):
    db_anomaly = crud.get_anomaly(db, anomaly_id=anomaly_id)
    if db_anomaly is None:
        raise HTTPException(status_code=404, detail="异常记录不存在")
    return db_anomaly


@app.put("/anomalies/{anomaly_id}/status", response_model=schemas.Anomaly, tags=["异常管理"])
def update_anomaly_status(anomaly_id: int, update: schemas.AnomalyUpdate, db: Session = Depends(get_db)):
    db_anomaly = crud.update_anomaly_status(db, anomaly_id=anomaly_id, update=update)
    if db_anomaly is None:
        raise HTTPException(status_code=404, detail="异常记录不存在")
    return db_anomaly


@app.put("/anomalies/{anomaly_id}/manual-fix", response_model=schemas.Anomaly, tags=["异常管理"])
def manual_fix_anomaly(anomaly_id: int, fix: schemas.AnomalyManualFix, db: Session = Depends(get_db)):
    db_anomaly = crud.manual_fix_anomaly(db, anomaly_id=anomaly_id, fix=fix)
    if db_anomaly is None:
        raise HTTPException(status_code=404, detail="异常记录不存在")
    return db_anomaly


@app.get("/audit/comparison", response_model=List[schemas.PermissionComparisonResult], tags=["审计"])
def compare_permissions(tool_id: Optional[int] = None, db: Session = Depends(get_db)):
    return crud.compare_permissions(db, tool_id=tool_id)


@app.post("/audit/generate-anomalies", tags=["审计"])
def generate_anomalies(tool_id: Optional[int] = None, db: Session = Depends(get_db)):
    count = crud.generate_anomalies_from_comparison(db, tool_id=tool_id)
    return {"message": f"成功生成 {count} 条异常记录", "created_count": count}


@app.post("/audit/summary", response_model=schemas.AuditSummary, tags=["审计"])
def generate_audit_summary(batch_id: Optional[int] = None, generated_by: Optional[str] = None, db: Session = Depends(get_db)):
    return crud.generate_audit_summary(db, batch_id=batch_id, generated_by=generated_by)


@app.get("/audit/summaries/", response_model=List[schemas.AuditSummary], tags=["审计"])
def read_summaries(batch_id: Optional[int] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_audit_summaries(db, batch_id=batch_id, skip=skip, limit=limit)


@app.get("/audit/summaries/{summary_id}", response_model=schemas.AuditSummary, tags=["审计"])
def read_summary(summary_id: int, db: Session = Depends(get_db)):
    db_summary = crud.get_audit_summary(db, summary_id=summary_id)
    if db_summary is None:
        raise HTTPException(status_code=404, detail="审计摘要不存在")
    return db_summary


@app.post("/audit/export/{summary_id}", response_model=schemas.AuditExportResponse, tags=["审计"])
def export_audit_report(summary_id: int, export_format: str = "xlsx", db: Session = Depends(get_db)):
    filename = crud.export_audit_report(db, summary_id=summary_id, export_format=export_format)
    if not filename:
        raise HTTPException(status_code=404, detail="审计摘要不存在")
    
    db_summary = crud.get_audit_summary(db, summary_id=summary_id)
    return schemas.AuditExportResponse(
        summary_id=summary_id,
        export_format=export_format,
        export_path=filename,
        generated_at=db_summary.generated_at
    )


@app.get("/audit/download/{summary_id}", tags=["审计"])
def download_audit_report(summary_id: int, db: Session = Depends(get_db)):
    db_summary = crud.get_audit_summary(db, summary_id=summary_id)
    if db_summary is None:
        raise HTTPException(status_code=404, detail="审计摘要不存在")
    if not db_summary.export_path or not os.path.exists(db_summary.export_path):
        raise HTTPException(status_code=404, detail="导出文件不存在，请先调用导出接口")
    
    return FileResponse(
        path=db_summary.export_path,
        filename=os.path.basename(db_summary.export_path),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


@app.get("/", tags=["根"])
def root():
    return {
        "message": "MCP工具权限审计API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }
