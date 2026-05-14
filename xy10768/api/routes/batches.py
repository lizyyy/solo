from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import json
from datetime import datetime

from core.database import get_db_connection

router = APIRouter()

class BatchCreate(BaseModel):
    batch_id: str
    owner: str
    data_count: int
    transform_steps: List[str]
    source_data: Optional[dict] = None

@router.get("/")
async def list_batches(owner: Optional[str] = None, status: Optional[str] = None, keyword: Optional[str] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM batches WHERE 1=1"
    params = []
    
    if owner:
        query += " AND owner = ?"
        params.append(owner)
    
    if status:
        query += " AND status = ?"
        params.append(status)
    
    if keyword:
        query += " AND (batch_id LIKE ? OR owner LIKE ?)"
        params.extend([f"%{keyword}%", f"%{keyword}%"])
    
    query += " ORDER BY created_at DESC"
    
    cursor.execute(query, params)
    batches = cursor.fetchall()
    
    result = []
    for batch in batches:
        batch_dict = dict(batch)
        batch_dict["transform_steps"] = json.loads(batch_dict["transform_steps"])
        if batch_dict.get("source_data"):
            batch_dict["source_data"] = json.loads(batch_dict["source_data"])
        result.append(batch_dict)
    
    conn.close()
    return {"batches": result, "total": len(result)}

@router.get("/{batch_id}")
async def get_batch(batch_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM batches WHERE batch_id = ?", (batch_id,))
    batch = cursor.fetchone()
    
    if not batch:
        conn.close()
        raise HTTPException(status_code=404, detail="批次不存在")
    
    batch_dict = dict(batch)
    batch_dict["transform_steps"] = json.loads(batch_dict["transform_steps"])
    if batch_dict.get("source_data"):
        batch_dict["source_data"] = json.loads(batch_dict["source_data"])
    
    cursor.execute("SELECT * FROM validation_results WHERE batch_id = ? ORDER BY validated_at DESC LIMIT 1", (batch_id,))
    validation = cursor.fetchone()
    if validation:
        validation_dict = dict(validation)
        for key in ["errors", "warnings", "intercepted_replay_range", "validation_summary"]:
            if validation_dict.get(key):
                validation_dict[key] = json.loads(validation_dict[key])
        batch_dict["validation"] = validation_dict
    
    cursor.execute("SELECT * FROM failed_nodes WHERE batch_id = ?", (batch_id,))
    failed_nodes = cursor.fetchall()
    batch_dict["failed_nodes"] = [dict(node) for node in failed_nodes]
    
    conn.close()
    return batch_dict

@router.post("/", status_code=201)
async def create_batch(batch: BatchCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO batches (batch_id, owner, data_count, transform_steps, status, source_data)
            VALUES (?, ?, ?, ?, 'pending', ?)
        ''', (
            batch.batch_id,
            batch.owner,
            batch.data_count,
            json.dumps(batch.transform_steps),
            json.dumps(batch.source_data) if batch.source_data else None
        ))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail=f"创建批次失败: {str(e)}")
    
    conn.close()
    return {"message": "批次创建成功", "batch_id": batch.batch_id}

@router.delete("/{batch_id}")
async def delete_batch(batch_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM validation_results WHERE batch_id = ?", (batch_id,))
    cursor.execute("DELETE FROM failed_nodes WHERE batch_id = ?", (batch_id,))
    cursor.execute("DELETE FROM replay_logs WHERE batch_id = ?", (batch_id,))
    cursor.execute("DELETE FROM batches WHERE batch_id = ?", (batch_id,))
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="批次不存在")
    
    conn.commit()
    conn.close()
    return {"message": "批次删除成功"}
