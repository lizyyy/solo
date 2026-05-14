from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.crud import migration as migration_crud
from app.crud import execution as execution_crud
import pandas as pd
from datetime import datetime
import os
import json

router = APIRouter(prefix="/export", tags=["导出"])

EXPORT_DIR = "/tmp/migration_exports"
os.makedirs(EXPORT_DIR, exist_ok=True)

@router.get("/migration/{migration_id}/excel")
def export_migration_excel(migration_id: int, db: Session = Depends(get_db)):
    migration = migration_crud.get_migration(db, migration_id=migration_id)
    if migration is None:
        raise HTTPException(status_code=404, detail="迁移脚本不存在")
    
    filename = f"migration_{migration_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    filepath = os.path.join(EXPORT_DIR, filename)
    
    with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
        migration_data = {
            "ID": [migration.id],
            "名称": [migration.name],
            "描述": [migration.description],
            "数据库类型": [migration.database_type],
            "状态": [migration.status.value],
            "创建人": [migration.created_by],
            "创建时间": [migration.created_at],
            "更新时间": [migration.updated_at],
            "执行时间": [migration.executed_at],
            "版本": [migration.version],
        }
        pd.DataFrame(migration_data).to_excel(writer, sheet_name="基本信息", index=False)
        
        affected_tables_data = []
        for table in migration.affected_tables:
            affected_tables_data.append({
                "表名": table.table_name,
                "操作类型": table.operation_type,
                "预估行数": table.estimated_rows,
                "实际行数": table.actual_rows,
                "已备份": table.has_backup,
                "备注": table.remarks,
                "创建时间": table.created_at,
            })
        pd.DataFrame(affected_tables_data).to_excel(writer, sheet_name="影响表", index=False)
        
        rollback_data = []
        for rb in migration.rollback_scripts:
            rollback_data.append({
                "版本": rb.version,
                "脚本内容": rb.script_content,
                "是否有效": rb.is_valid,
                "验证结果": rb.validation_result,
                "验证时间": rb.validated_at,
                "验证人": rb.validated_by,
                "备注": rb.remarks,
                "创建时间": rb.created_at,
            })
        pd.DataFrame(rollback_data).to_excel(writer, sheet_name="回滚脚本", index=False)
        
        execution_logs = execution_crud.get_execution_logs(db, migration_id=migration_id)
        logs_data = []
        for log in execution_logs:
            logs_data.append({
                "ID": log.id,
                "执行类型": log.execution_type.value,
                "状态": log.status.value,
                "执行人": log.executed_by,
                "开始时间": log.started_at,
                "结束时间": log.completed_at,
                "输出": log.output,
                "错误信息": log.error_message,
                "影响行数": log.affected_rows,
                "耗时(秒)": log.duration_seconds,
                "父日志ID": log.parent_log_id,
                "备注": log.remarks,
            })
        pd.DataFrame(logs_data).to_excel(writer, sheet_name="执行日志", index=False)
    
    return FileResponse(
        path=filepath,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

@router.get("/migration/{migration_id}/trace")
def get_trace_chain(migration_id: int, db: Session = Depends(get_db)):
    migration = migration_crud.get_migration(db, migration_id=migration_id)
    if migration is None:
        raise HTTPException(status_code=404, detail="迁移脚本不存在")
    
    execution_logs = execution_crud.get_execution_logs(db, migration_id=migration_id)
    
    trace = {
        "migration": {
            "id": migration.id,
            "name": migration.name,
            "status": migration.status.value,
            "created_by": migration.created_by,
            "created_at": migration.created_at,
        },
        "affected_tables": [
            {
                "table_name": t.table_name,
                "operation_type": t.operation_type,
                "estimated_rows": t.estimated_rows,
                "has_backup": t.has_backup,
            } for t in migration.affected_tables
        ],
        "rollback_scripts": [
            {
                "version": r.version,
                "is_valid": r.is_valid,
                "validation_result": r.validation_result,
            } for r in migration.rollback_scripts
        ],
        "approval_chain": None,
        "execution_logs": [
            {
                "id": log.id,
                "execution_type": log.execution_type.value,
                "status": log.status.value,
                "executed_by": log.executed_by,
                "started_at": log.started_at,
                "completed_at": log.completed_at,
                "duration_seconds": log.duration_seconds,
                "affected_rows": log.affected_rows,
                "error_message": log.error_message,
                "parent_log_id": log.parent_log_id,
            } for log in execution_logs
        ]
    }
    
    if migration.approval_chain:
        trace["approval_chain"] = {
            "id": migration.approval_chain.id,
            "status": migration.approval_chain.status.value,
            "current_step_index": migration.approval_chain.current_step_index,
            "started_at": migration.approval_chain.started_at,
            "completed_at": migration.approval_chain.completed_at,
            "steps": [
                {
                    "step_order": s.step_order,
                    "role": s.role,
                    "approver": s.approver,
                    "status": s.status.value,
                    "comment": s.comment,
                    "approved_at": s.approved_at,
                    "is_required": s.is_required,
                } for s in migration.approval_chain.steps
            ]
        }
    
    return trace