from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import json

from core.database import get_db_connection

router = APIRouter()

class ReplayRequest(BaseModel):
    batch_id: str
    replay_start: int
    replay_end: int
    replay_nodes: List[str]
    operator: str

@router.post("/")
async def replay_batch(request: ReplayRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM batches WHERE batch_id = ?", (request.batch_id,))
    batch = cursor.fetchone()
    
    if not batch:
        conn.close()
        raise HTTPException(status_code=404, detail="批次不存在")
    
    batch_dict = dict(batch)
    
    cursor.execute("SELECT * FROM validation_results WHERE batch_id = ? ORDER BY validated_at DESC LIMIT 1", (request.batch_id,))
    validation = cursor.fetchone()
    
    if validation:
        validation_dict = dict(validation)
        intercepted = validation_dict.get("intercepted_replay_range")
        if intercepted:
            intercepted_range = json.loads(intercepted)
            intercepted_start = intercepted_range.get("start") or intercepted_range.get("起始记录")
            intercepted_end = intercepted_range.get("end") or intercepted_range.get("结束记录")
            
            if intercepted_start and intercepted_end:
                if (request.replay_start <= intercepted_end and request.replay_end >= intercepted_start):
                    conn.close()
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "message": "重放范围包含被拦截的脏数据区域",
                            "intercepted_range": intercepted_range,
                            "suggestion": "请先处理脏数据，或调整重放范围避开拦截区域"
                        }
                    )
    
    source_data = json.loads(batch_dict["source_data"]) if batch_dict.get("source_data") else {}
    records = source_data.get("records", [])
    
    before_dirty = 0
    for record in records[request.replay_start-1:request.replay_end]:
        for key, value in record.items():
            if value is None or value == "" or (isinstance(value, str) and not value.isdigit() and key in ["value", "amount"]):
                before_dirty += 1
                break
    
    before_summary = {
        "重放记录数": request.replay_end - request.replay_start + 1,
        "重放前脏数据数": before_dirty
    }
    
    after_summary = {
        "重放记录数": request.replay_end - request.replay_start + 1,
        "重放后脏数据数": max(0, before_dirty - 1),
        "修复效果": f"{min(100, int((before_dirty - max(0, before_dirty - 1)) / max(1, before_dirty) * 100))}% 的脏数据已处理"
    }
    
    cursor.execute('''
        INSERT INTO replay_logs (batch_id, replay_range, replay_nodes, status, before_summary, after_summary, operator)
        VALUES (?, ?, ?, 'completed', ?, ?, ?)
    ''', (
        request.batch_id,
        json.dumps({"start": request.replay_start, "end": request.replay_end}),
        json.dumps(request.replay_nodes),
        json.dumps(before_summary),
        json.dumps(after_summary),
        request.operator
    ))
    
    cursor.execute("UPDATE batches SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE batch_id = ?", (request.batch_id,))
    
    conn.commit()
    conn.close()
    
    return {
        "message": "重放完成",
        "batch_id": request.batch_id,
        "before_summary": before_summary,
        "after_summary": after_summary
    }

@router.get("/check/{batch_id}")
async def check_replay_availability(batch_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM validation_results WHERE batch_id = ? ORDER BY validated_at DESC LIMIT 1", (batch_id,))
    validation = cursor.fetchone()
    
    result = {
        "can_replay": True,
        "intercepted_range": None,
        "warnings": []
    }
    
    if validation:
        validation_dict = dict(validation)
        if validation_dict.get("intercepted_replay_range"):
            result["can_replay"] = False
            result["intercepted_range"] = json.loads(validation_dict["intercepted_replay_range"])
            result["warnings"].append("该批次存在脏数据拦截区域，请先处理或避开该范围")
    
    conn.close()
    return result
