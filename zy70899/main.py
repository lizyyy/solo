from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import engine, get_db, Base
from models import TaskStatus, DataCategory
from schemas import (
    HandoverCreate, HandoverResponse, HandoverUpdate,
    AuditLogResponse, FieldTraceResponse,
    ConclusionUpdate, TaskListResponse
)
from services import HandoverService

Base.metadata.create_all(bind=engine)

app = FastAPI(title="银行网点尾箱交接API服务", version="1.0.0")


@app.post("/api/handovers", response_model=HandoverResponse, summary="提交尾箱交接材料")
def create_handover(handover_data: HandoverCreate, db: Session = Depends(get_db)):
    """
    网点运营主管提交尾箱交接材料
    - 系统自动生成任务编号
    - 自动进行数据分类：正常、待补充、已拦截
    - 记录双人确认、尾箱金额、差错编号
    - 跨日交接自动检查上一班未闭合原因
    """
    try:
        handover = HandoverService.create_handover(db, handover_data)
        return handover
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建交接任务失败: {str(e)}")


@app.get("/api/handovers", response_model=TaskListResponse, summary="查询交接任务列表")
def list_handovers(
    skip: int = 0,
    limit: int = 100,
    status: Optional[TaskStatus] = None,
    category: Optional[DataCategory] = None,
    db: Session = Depends(get_db)
):
    """
    查询尾箱交接任务列表，支持按状态和分类筛选
    """
    total, items = HandoverService.list_handovers(db, skip, limit, status, category)
    return {"total": total, "items": items}


@app.get("/api/handovers/{task_id}", response_model=HandoverResponse, summary="查询单个交接任务详情")
def get_handover(task_id: str, db: Session = Depends(get_db)):
    """
    根据任务编号查询交接任务详情
    """
    handover = HandoverService.get_handover_by_task_id(db, task_id)
    if not handover:
        raise HTTPException(status_code=404, detail="交接任务不存在")
    return handover


@app.put("/api/handovers/{task_id}/status", response_model=HandoverResponse, summary="更新任务状态")
def update_handover_status(
    task_id: str,
    new_status: TaskStatus,
    db: Session = Depends(get_db)
):
    """
    更新任务状态：处理中、处理失败、人工确认、已导出
    """
    handover = HandoverService.update_status(db, task_id, new_status)
    if not handover:
        raise HTTPException(status_code=404, detail="交接任务不存在")
    return handover


@app.post("/api/handovers/{task_id}/conclusion", response_model=AuditLogResponse, summary="修改结论")
def update_conclusion(
    task_id: str,
    update_data: ConclusionUpdate,
    db: Session = Depends(get_db)
):
    """
    修改交接任务结论，自动记录审计日志
    - 记录谁改过结论
    - 记录为什么改
    - 记录改动前是什么
    """
    audit_log = HandoverService.update_conclusion(db, task_id, update_data)
    if not audit_log:
        raise HTTPException(status_code=404, detail="交接任务不存在")
    return audit_log


@app.get("/api/handovers/{task_id}/audit-logs", response_model=List[AuditLogResponse], summary="查询审计日志")
def get_audit_logs(task_id: str, db: Session = Depends(get_db)):
    """
    查询指定任务的审计日志，用于复盘
    - 查看谁改过结论
    - 查看修改原因
    - 查看改动前后的值
    """
    logs = HandoverService.get_audit_logs(db, task_id)
    return logs


@app.get("/api/handovers/{task_id}/field-traces", response_model=List[FieldTraceResponse], summary="查询字段追溯信息")
def get_field_traces(task_id: str, db: Session = Depends(get_db)):
    """
    查询关键字段的追溯信息
    - 从原始输入追到最终报告
    - 关键字段包括：尾箱编号、尾箱金额、交接日期、交接人
    """
    traces = HandoverService.get_field_traces(db, task_id)
    return traces


@app.get("/api/handovers/{task_id}/raw-data", summary="查询原始材料")
def get_raw_data(task_id: str, db: Session = Depends(get_db)):
    """
    查询原始材料数据，用于错误回溯
    """
    raw_data = HandoverService.get_raw_data(db, task_id)
    if not raw_data:
        raise HTTPException(status_code=404, detail="交接任务不存在")
    return {"task_id": task_id, "raw_data": raw_data}


@app.get("/api/statuses", summary="获取所有任务状态枚举")
def get_statuses():
    """
    获取所有可用的任务状态
    """
    return {status.name: status.value for status in TaskStatus}


@app.get("/api/categories", summary="获取所有数据分类枚举")
def get_categories():
    """
    获取所有可用的数据分类
    """
    return {category.name: category.value for category in DataCategory}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
