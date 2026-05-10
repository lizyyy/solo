"""报表 API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.report_service import (
    get_developer_dashboard,
    get_suspension_history
)
from app.services.key_service import list_api_keys_by_developer

router = APIRouter(prefix="/reports", tags=["报表"])


@router.get("/dashboard/{developer_id}")
def developer_dashboard(developer_id: str, days: int = 7, db: Session = Depends(get_db)):
    """
    开发者报表看板
    
    返回内容：
    - 密钥概览
    - 调用成功率
    - 配额使用情况
    - 主要拒绝原因
    - 每日调用趋势
    """
    dashboard = get_developer_dashboard(db, developer_id, days)
    return dashboard


@router.get("/suspensions/{developer_id}")
def suspension_history(developer_id: str, limit: int = 20, db: Session = Depends(get_db)):
    """
    获取封禁历史记录
    
    用于排查历史封禁记录
    """
    keys = list_api_keys_by_developer(db, developer_id)
    key_ids = [k.id for k in keys]
    
    if not key_ids:
        return {"developer_id": developer_id, "records": []}
    
    history = get_suspension_history(db, key_ids, limit)
    return {
        "developer_id": developer_id,
        "records": history
    }
