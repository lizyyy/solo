from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json

from core.database import get_db_connection
from core.config import settings

router = APIRouter()

class ValidationRequest(BaseModel):
    batch_id: str

def validate_data(source_data: dict) -> Dict[str, Any]:
    records = source_data.get("records", [])
    total = len(records)
    errors = []
    warnings = []
    dirty_count = 0
    dirty_indices = []
    
    for idx, record in enumerate(records):
        record_errors = []
        
        for key, value in record.items():
            if value is None or value == "":
                record_errors.append(f"字段'{key}'存在空值")
            
            if key == "value" or key == "amount":
                if isinstance(value, str):
                    try:
                        float(value)
                    except ValueError:
                        record_errors.append(f"字段'{key}'类型错误，预期是数字")
                elif isinstance(value, (int, float)) and value < 0:
                    record_errors.append(f"字段'{key}'存在负值异常")
        
        if record_errors:
            dirty_count += 1
            dirty_indices.append(idx + 1)
            errors.extend([f"第{idx+1}条记录: {e}" for e in record_errors])
    
    is_valid = dirty_count == 0
    
    issues = {}
    for error in errors:
        if "空值" in error:
            issues["空值"] = issues.get("空值", 0) + 1
        elif "类型错误" in error:
            issues["类型错误"] = issues.get("类型错误", 0) + 1
        elif "负值" in error:
            issues["负值异常"] = issues.get("负值异常", 0) + 1
    
    validation_summary = {
        "总记录数": total,
        "有效记录数": total - dirty_count,
        "脏数据数": dirty_count,
        "脏数据占比": f"{(dirty_count/total*100):.1f}%" if total > 0 else "0%",
        "问题分类": [{"问题类型": k, "出现次数": v} for k, v in issues.items()]
    }
    
    intercepted_range = None
    if dirty_count > 0:
        intercepted_range = {
            "起始记录": min(dirty_indices) if dirty_indices else 1,
            "结束记录": max(dirty_indices) if dirty_indices else 1,
            "拦截原因": "包含脏数据，需先进行数据清洗" if dirty_count < total else "全部数据异常，需重新抽取"
        }
    
    return {
        "is_valid": is_valid,
        "errors": errors,
        "warnings": warnings,
        "dirty_data_count": dirty_count,
        "intercepted_replay_range": intercepted_range,
        "validation_summary": validation_summary
    }

@router.post("/")
async def validate_batch(request: ValidationRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM batches WHERE batch_id = ?", (request.batch_id,))
    batch = cursor.fetchone()
    
    if not batch:
        conn.close()
        raise HTTPException(status_code=404, detail="批次不存在")
    
    batch_dict = dict(batch)
    source_data = json.loads(batch_dict["source_data"]) if batch_dict.get("source_data") else {}
    
    if not source_data:
        conn.close()
        raise HTTPException(status_code=400, detail="批次没有源数据")
    
    validation_result = validate_data(source_data)
    
    cursor.execute('''
        INSERT INTO validation_results (batch_id, is_valid, errors, warnings, dirty_data_count, intercepted_replay_range, validation_summary)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (
        request.batch_id,
        validation_result["is_valid"],
        json.dumps(validation_result["errors"]),
        json.dumps(validation_result["warnings"]),
        validation_result["dirty_data_count"],
        json.dumps(validation_result["intercepted_replay_range"]) if validation_result["intercepted_replay_range"] else None,
        json.dumps(validation_result["validation_summary"])
    ))
    
    new_status = "validated" if validation_result["is_valid"] else "failed"
    cursor.execute("UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE batch_id = ?", (new_status, request.batch_id))
    
    if not validation_result["is_valid"]:
        for issue in validation_result["errors"][:3]:
            node_name = "数据清洗"
            if "类型" in issue:
                node_name = "数据转换"
            elif "负值" in issue:
                node_name = "质量校验"
            
            cursor.execute('''
                INSERT INTO failed_nodes (batch_id, node_name, error_message)
                VALUES (?, ?, ?)
            ''', (request.batch_id, node_name, issue))
    
    conn.commit()
    conn.close()
    
    return {
        "message": "校验完成",
        "batch_id": request.batch_id,
        "is_valid": validation_result["is_valid"],
        "validation_summary": validation_result["validation_summary"],
        "intercepted_range": validation_result["intercepted_replay_range"]
    }

@router.get("/{batch_id}")
async def get_validation_result(batch_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM validation_results WHERE batch_id = ? ORDER BY validated_at DESC", (batch_id,))
    results = cursor.fetchall()
    
    result_list = []
    for result in results:
        result_dict = dict(result)
        for key in ["errors", "warnings", "intercepted_replay_range", "validation_summary"]:
            if result_dict.get(key):
                result_dict[key] = json.loads(result_dict[key])
        result_list.append(result_dict)
    
    conn.close()
    return {"validation_results": result_list, "total": len(result_list)}
