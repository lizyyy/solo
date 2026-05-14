from fastapi import APIRouter, HTTPException
from typing import Optional
import json

from core.database import get_db_connection

router = APIRouter()

@router.get("/replay")
async def list_replay_logs(batch_id: Optional[str] = None, operator: Optional[str] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM replay_logs WHERE 1=1"
    params = []
    
    if batch_id:
        query += " AND batch_id = ?"
        params.append(batch_id)
    
    if operator:
        query += " AND operator = ?"
        params.append(operator)
    
    query += " ORDER BY replayed_at DESC"
    
    cursor.execute(query, params)
    logs = cursor.fetchall()
    
    result = []
    for log in logs:
        log_dict = dict(log)
        for key in ["replay_range", "replay_nodes", "before_summary", "after_summary"]:
            if log_dict.get(key):
                log_dict[key] = json.loads(log_dict[key])
        result.append(log_dict)
    
    conn.close()
    return {"logs": result, "total": len(result)}

@router.get("/failed-nodes")
async def list_failed_nodes(batch_id: Optional[str] = None, node_name: Optional[str] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT fn.*, b.owner FROM failed_nodes fn JOIN batches b ON fn.batch_id = b.batch_id WHERE 1=1"
    params = []
    
    if batch_id:
        query += " AND fn.batch_id = ?"
        params.append(batch_id)
    
    if node_name:
        query += " AND fn.node_name = ?"
        params.append(node_name)
    
    query += " ORDER BY fn.occurred_at DESC"
    
    cursor.execute(query, params)
    nodes = cursor.fetchall()
    
    result = [dict(node) for node in nodes]
    
    conn.close()
    return {"failed_nodes": result, "total": len(result)}

@router.get("/statistics")
async def get_statistics():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT status, COUNT(*) as count FROM batches GROUP BY status")
    status_stats = cursor.fetchall()
    
    cursor.execute("SELECT owner, COUNT(*) as count FROM batches GROUP BY owner")
    owner_stats = cursor.fetchall()
    
    cursor.execute("SELECT node_name, COUNT(*) as count FROM failed_nodes GROUP BY node_name")
    node_stats = cursor.fetchall()
    
    cursor.execute("SELECT COUNT(*) as total FROM validation_results WHERE is_valid = 0")
    total_dirty = cursor.fetchone()
    
    conn.close()
    
    return {
        "按状态统计": [{"状态": s["status"], "数量": s["count"]} for s in status_stats],
        "按负责人统计": [{"负责人": o["owner"], "数量": o["count"]} for o in owner_stats],
        "按失败节点统计": [{"节点名称": n["node_name"], "失败次数": n["count"]} for n in node_stats],
        "脏数据总批次": total_dirty["total"] if total_dirty else 0
    }
