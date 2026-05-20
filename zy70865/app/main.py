from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import json

from .models import (
    WashItem, RecycleItem, RoomTypeConfig, BatchSubmissionResponse,
    ReconciliationResult, CompensationRecord
)
from .parser import parse_wash_csv, parse_recycle_json, parse_room_config_json
from .reconciliation import engine
from .database import db

app = FastAPI(title="酒店布草对账系统", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "酒店布草对账系统 API", "version": "1.0.0"}


@app.post("/api/reconcile", response_model=BatchSubmissionResponse)
async def reconcile_batch(
    wash_csv: UploadFile = File(..., description="送洗单CSV文件"),
    recycle_json: UploadFile = File(..., description="回收单JSON文件"),
    room_config_json: Optional[UploadFile] = File(None, description="房型配置JSON文件")
):
    try:
        wash_content = (await wash_csv.read()).decode("utf-8")
        wash_items = parse_wash_csv(wash_content)
        
        if not wash_items:
            raise HTTPException(status_code=400, detail="送洗单CSV解析失败或为空")
        
        batch_id = wash_items[0].batch_id
        
        if db.is_batch_processed(batch_id):
            return BatchSubmissionResponse(
                success=False,
                message=f"批次 {batch_id} 已处理过，不能重复提交",
                batch_id=batch_id,
                is_duplicate=True,
                result=db.get_reconciliation_result(batch_id)
            )
        
        recycle_content = (await recycle_json.read()).decode("utf-8")
        recycle_items = parse_recycle_json(recycle_content)
        
        room_configs = []
        if room_config_json:
            room_config_content = (await room_config_json.read()).decode("utf-8")
            room_configs = parse_room_config_json(room_config_content)
            for config in room_configs:
                db.add_room_config(config)
        
        db.add_wash_items(wash_items)
        db.add_recycle_items(recycle_items)
        
        result = engine.reconcile(wash_items, recycle_items, room_configs, batch_id)
        
        db.mark_batch_processed(batch_id)
        
        return BatchSubmissionResponse(
            success=True,
            message=f"批次 {batch_id} 对账完成",
            batch_id=batch_id,
            is_duplicate=False,
            result=result
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@app.get("/api/batch/{batch_id}", response_model=Optional[ReconciliationResult])
async def get_batch_result(batch_id: str):
    result = db.get_reconciliation_result(batch_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"批次 {batch_id} 不存在")
    return result


@app.get("/api/compensation/{compensation_id}")
async def get_compensation_trace(compensation_id: str):
    trace = db.get_compensation_trace(compensation_id)
    if not trace:
        raise HTTPException(status_code=404, detail=f"赔付记录 {compensation_id} 不存在")
    return trace


@app.get("/api/compensations/batch/{batch_id}", response_model=List[CompensationRecord])
async def get_batch_compensations(batch_id: str):
    return db.get_compensations_by_batch(batch_id)


@app.get("/api/batches/check/{batch_id}")
async def check_batch_exists(batch_id: str):
    return {
        "batch_id": batch_id,
        "exists": db.is_batch_processed(batch_id)
    }


@app.post("/api/config/room")
async def add_room_config(config: RoomTypeConfig):
    db.add_room_config(config)
    return {"success": True, "message": f"房型 {config.room_type} 配置已添加"}


@app.get("/api/config/rooms")
async def get_all_room_configs():
    return list(db.room_configs.values())
