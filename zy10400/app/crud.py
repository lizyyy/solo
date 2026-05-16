from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime
import json
import os
import pandas as pd
from typing import List, Optional, Tuple

from app import models, schemas
from app.models import ApprovalStatus, AnomalyStatus, AnomalyType


def get_tool(db: Session, tool_id: int):
    return db.query(models.Tool).filter(models.Tool.id == tool_id).first()


def get_tool_by_name(db: Session, name: str):
    return db.query(models.Tool).filter(models.Tool.name == name).first()


def get_tools(db: Session, skip: int = 0, limit: int = 100, server_name: Optional[str] = None):
    query = db.query(models.Tool)
    if server_name:
        query = query.filter(models.Tool.server_name == server_name)
    return query.offset(skip).limit(limit).all()


def create_tool(db: Session, tool: schemas.ToolCreate):
    db_tool = models.Tool(**tool.dict())
    db.add(db_tool)
    db.commit()
    db.refresh(db_tool)
    return db_tool


def get_declared_permissions(db: Session, tool_id: Optional[int] = None, skip: int = 0, limit: int = 100):
    query = db.query(models.DeclaredPermission)
    if tool_id:
        query = query.filter(models.DeclaredPermission.tool_id == tool_id)
    return query.offset(skip).limit(limit).all()


def create_declared_permission(db: Session, permission: schemas.DeclaredPermissionCreate):
    db_permission = models.DeclaredPermission(**permission.dict())
    if permission.approved_by:
        db_permission.approved_at = datetime.now()
    db.add(db_permission)
    db.commit()
    db.refresh(db_permission)
    return db_permission


def get_actual_calls(db: Session, tool_id: Optional[int] = None, batch_id: Optional[int] = None, skip: int = 0, limit: int = 100):
    query = db.query(models.ActualCall)
    if tool_id:
        query = query.filter(models.ActualCall.tool_id == tool_id)
    if batch_id:
        query = query.filter(models.ActualCall.batch_id == batch_id)
    return query.offset(skip).limit(limit).all()


def create_actual_call(db: Session, call: schemas.ActualCallCreate):
    db_call = models.ActualCall(**call.dict())
    db.add(db_call)
    db.commit()
    db.refresh(db_call)
    return db_call


def get_approval_batch(db: Session, batch_id: int):
    return db.query(models.ApprovalBatch).filter(models.ApprovalBatch.id == batch_id).first()


def get_approval_batch_by_number(db: Session, batch_number: str):
    return db.query(models.ApprovalBatch).filter(models.ApprovalBatch.batch_number == batch_number).first()


def get_approval_batches(db: Session, skip: int = 0, limit: int = 100, status: Optional[ApprovalStatus] = None):
    query = db.query(models.ApprovalBatch)
    if status:
        query = query.filter(models.ApprovalBatch.status == status)
    return query.offset(skip).limit(limit).all()


def create_approval_batch(db: Session, batch: schemas.ApprovalBatchCreate):
    existing_batch = get_approval_batch_by_number(db, batch.batch_number)
    if existing_batch:
        return existing_batch, False
    
    db_batch = models.ApprovalBatch(**batch.dict())
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return db_batch, True


def update_approval_batch_status(db: Session, batch_id: int, update: schemas.ApprovalBatchUpdate):
    db_batch = get_approval_batch(db, batch_id)
    if not db_batch:
        return None
    
    if db_batch.status != ApprovalStatus.PENDING:
        return db_batch, False
    
    db_batch.status = update.status
    if update.status == ApprovalStatus.APPROVED:
        db_batch.approved_by = update.approved_by
        db_batch.approved_at = datetime.now()
    elif update.status == ApprovalStatus.REJECTED:
        db_batch.rejection_reason = update.rejection_reason
    
    db.commit()
    db.refresh(db_batch)
    return db_batch, True


def get_anomaly(db: Session, anomaly_id: int):
    return db.query(models.Anomaly).filter(models.Anomaly.id == anomaly_id).first()


def get_anomalies(db: Session, tool_id: Optional[int] = None, status: Optional[AnomalyStatus] = None, skip: int = 0, limit: int = 100):
    query = db.query(models.Anomaly)
    if tool_id:
        query = query.filter(models.Anomaly.tool_id == tool_id)
    if status:
        query = query.filter(models.Anomaly.status == status)
    return query.offset(skip).limit(limit).all()


def create_anomaly(db: Session, anomaly: schemas.AnomalyCreate):
    db_anomaly = models.Anomaly(**anomaly.dict())
    db.add(db_anomaly)
    db.commit()
    db.refresh(db_anomaly)
    return db_anomaly


def update_anomaly_status(db: Session, anomaly_id: int, update: schemas.AnomalyUpdate):
    db_anomaly = get_anomaly(db, anomaly_id)
    if not db_anomaly:
        return None
    
    if update.status:
        db_anomaly.status = update.status
    if update.resolution:
        db_anomaly.resolution = update.resolution
    if update.resolved_by:
        db_anomaly.resolved_by = update.resolved_by
        db_anomaly.resolved_at = datetime.now()
    
    db.commit()
    db.refresh(db_anomaly)
    return db_anomaly


def manual_fix_anomaly(db: Session, anomaly_id: int, fix: schemas.AnomalyManualFix):
    db_anomaly = get_anomaly(db, anomaly_id)
    if not db_anomaly:
        return None
    
    db_anomaly.declared_permission = fix.declared_permission
    db_anomaly.resolution = fix.resolution
    db_anomaly.resolved_by = fix.resolved_by
    db_anomaly.resolved_at = datetime.now()
    db_anomaly.status = AnomalyStatus.RESOLVED
    
    db.commit()
    db.refresh(db_anomaly)
    return db_anomaly


def get_audit_summary(db: Session, summary_id: int):
    return db.query(models.AuditSummary).filter(models.AuditSummary.id == summary_id).first()


def get_audit_summaries(db: Session, batch_id: Optional[int] = None, skip: int = 0, limit: int = 100):
    query = db.query(models.AuditSummary)
    if batch_id:
        query = query.filter(models.AuditSummary.batch_id == batch_id)
    return query.offset(skip).limit(limit).all()


def create_audit_summary(db: Session, summary: schemas.AuditSummaryCreate):
    db_summary = models.AuditSummary(**summary.dict())
    db.add(db_summary)
    db.commit()
    db.refresh(db_summary)
    return db_summary


def compare_permissions(db: Session, tool_id: Optional[int] = None) -> List[schemas.PermissionComparisonResult]:
    results = []
    
    tools = get_tools(db) if not tool_id else [get_tool(db, tool_id)]
    tools = [t for t in tools if t is not None]
    
    for tool in tools:
        declared_perms = get_declared_permissions(db, tool_id=tool.id)
        declared_scopes = [p.permission_scope for p in declared_perms if p.is_active]
        
        actual_calls = get_actual_calls(db, tool_id=tool.id)
        actual_scopes = list(set([c.call_scope for c in actual_calls]))
        
        mismatches = []
        for scope in actual_scopes:
            if scope not in declared_scopes:
                mismatches.append(f"实际调用范围 '{scope}' 未在声明权限中")
        
        for scope in declared_scopes:
            if scope not in actual_scopes:
                mismatches.append(f"声明权限 '{scope}' 未被实际调用")
        
        results.append(schemas.PermissionComparisonResult(
            tool_id=tool.id,
            tool_name=tool.name,
            declared_permissions=declared_scopes,
            actual_scopes=actual_scopes,
            is_compliant=len(mismatches) == 0,
            mismatches=mismatches
        ))
    
    return results


def generate_anomalies_from_comparison(db: Session, tool_id: Optional[int] = None):
    comparison_results = compare_permissions(db, tool_id)
    
    created_count = 0
    for result in comparison_results:
        if not result.is_compliant:
            tool = get_tool(db, result.tool_id)
            
            for mismatch in result.mismatches:
                if "未在声明权限中" in mismatch:
                    actual_scope = mismatch.split("'")[1]
                    
                    existing_anomaly = db.query(models.Anomaly).filter(
                        and_(
                            models.Anomaly.tool_id == tool.id,
                            models.Anomaly.actual_scope == actual_scope,
                            models.Anomaly.status.in_([AnomalyStatus.OPEN, AnomalyStatus.REVIEWING])
                        )
                    ).first()
                    
                    if not existing_anomaly:
                        anomaly = schemas.AnomalyCreate(
                            tool_id=tool.id,
                            anomaly_type=AnomalyType.PERMISSION_MISMATCH,
                            actual_scope=actual_scope,
                            declared_permission=", ".join(result.declared_permissions),
                            original_input=json.dumps({
                                "declared_permissions": result.declared_permissions,
                                "actual_scope": actual_scope,
                                "mismatch": mismatch
                            }, ensure_ascii=False),
                            description=mismatch
                        )
                        create_anomaly(db, anomaly)
                        created_count += 1
    
    return created_count


def export_audit_report(db: Session, summary_id: int, export_format: str = "xlsx") -> Optional[str]:
    summary = get_audit_summary(db, summary_id)
    if not summary:
        return None
    
    os.makedirs("exports", exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"exports/audit_report_{summary_id}_{timestamp}.{export_format}"
    
    anomalies = get_anomalies(db)
    tools = get_tools(db)
    batches = get_approval_batches(db)
    
    with pd.ExcelWriter(filename, engine='openpyxl') as writer:
        pd.DataFrame([{
            "摘要ID": summary.id,
            "批次ID": summary.batch_id,
            "摘要类型": summary.summary_type,
            "工具总数": summary.total_tools,
            "合规工具数": summary.compliant_tools,
            "不合规工具数": summary.non_compliant_tools,
            "总调用数": summary.total_calls,
            "异常调用数": summary.anomalous_calls,
            "生成时间": summary.generated_at
        }]).to_excel(writer, sheet_name="审计摘要", index=False)
        
        anomaly_data = []
        for a in anomalies:
            tool = get_tool(db, a.tool_id)
            anomaly_data.append({
                "异常ID": a.id,
                "工具名称": tool.name if tool else "未知",
                "异常类型": a.anomaly_type.value,
                "状态": a.status.value,
                "声明权限": a.declared_permission or "",
                "实际范围": a.actual_scope,
                "原始输入": a.original_input or "",
                "描述": a.description or "",
                "处理结论": a.resolution or "",
                "处理人": a.resolved_by or "",
                "处理时间": a.resolved_at or "",
                "创建时间": a.created_at
            })
        pd.DataFrame(anomaly_data).to_excel(writer, sheet_name="异常明细", index=False)
        
        tool_data = []
        for t in tools:
            perms = get_declared_permissions(db, tool_id=t.id)
            calls = get_actual_calls(db, tool_id=t.id)
            tool_data.append({
                "工具ID": t.id,
                "工具名称": t.name,
                "服务器": t.server_name,
                "状态": t.status.value,
                "声明权限数": len(perms),
                "实际调用数": len(calls),
                "创建时间": t.created_at
            })
        pd.DataFrame(tool_data).to_excel(writer, sheet_name="工具清单", index=False)
        
        batch_data = []
        for b in batches:
            calls = get_actual_calls(db, batch_id=b.id)
            batch_data.append({
                "批次ID": b.id,
                "批次号": b.batch_number,
                "提交人": b.submitter,
                "状态": b.status.value,
                "审批人": b.approved_by or "",
                "审批时间": b.approved_at or "",
                "拒绝原因": b.rejection_reason or "",
                "调用数量": len(calls),
                "创建时间": b.created_at
            })
        pd.DataFrame(batch_data).to_excel(writer, sheet_name="审批批次", index=False)
    
    summary.export_path = filename
    summary.export_format = export_format
    db.commit()
    
    return filename


def generate_audit_summary(db: Session, batch_id: Optional[int] = None, generated_by: Optional[str] = None) -> models.AuditSummary:
    tools = get_tools(db)
    total_tools = len(tools)
    total_calls = len(get_actual_calls(db, batch_id=batch_id))
    
    comparison_results = compare_permissions(db)
    compliant_tools = sum(1 for r in comparison_results if r.is_compliant)
    non_compliant_tools = total_tools - compliant_tools
    
    anomaly_count = len(get_anomalies(db, status=AnomalyStatus.OPEN))
    
    anomaly_details = json.dumps([
        {
            "tool_id": r.tool_id,
            "tool_name": r.tool_name,
            "mismatches": r.mismatches
        }
        for r in comparison_results if not r.is_compliant
    ], ensure_ascii=False)
    
    summary = schemas.AuditSummaryCreate(
        batch_id=batch_id,
        summary_type="full_audit" if not batch_id else f"batch_{batch_id}",
        total_tools=total_tools,
        compliant_tools=compliant_tools,
        non_compliant_tools=non_compliant_tools,
        total_calls=total_calls,
        anomalous_calls=anomaly_count,
        anomaly_details=anomaly_details,
        generated_by=generated_by
    )
    
    return create_audit_summary(db, summary)
