from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
import uvicorn
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
import json
import pandas as pd
import io

from models import (
    MeterData, TenantContract, TemperatureZone,
    AllocationRecord, ProcessedResult, BatchSummary
)
from parser import FileParser
from engine import AllocationEngine
from idempotency import BatchManager

app = FastAPI(title="冷库园区财务分摊API", version="1.0.0")

batch_manager = BatchManager()
parser = FileParser()
engine = AllocationEngine()


@app.post("/api/v1/allocate", response_model=ProcessedResult)
async def allocate_bills(
    batch_id: Optional[str] = Form(None),
    meter_file: UploadFile = File(...),
    contract_file: UploadFile = File(...),
    zone_file: UploadFile = File(...)
):
    if not batch_id:
        batch_id = str(uuid.uuid4())
    
    if batch_manager.is_batch_processed(batch_id):
        raise HTTPException(
            status_code=400,
            detail=f"批次 {batch_id} 已处理，请勿重复提交。如需重新处理请使用新批次号。"
        )
    
    try:
        meter_content = await meter_file.read()
        contract_content = await contract_file.read()
        zone_content = await zone_file.read()
        
        meter_data = parser.parse_meter_csv(meter_content)
        contracts = parser.parse_contract_json(contract_content)
        zones = parser.parse_zone_csv(zone_content)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"文件解析失败: {str(e)}")
    
    processed_result = engine.process_allocation(
        batch_id=batch_id,
        meter_data=meter_data,
        contracts=contracts,
        zones=zones
    )
    
    batch_manager.save_batch(batch_id, processed_result)
    
    return processed_result


@app.get("/api/v1/batch/{batch_id}")
async def get_batch_result(batch_id: str):
    result = batch_manager.get_batch(batch_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"批次 {batch_id} 不存在")
    return result


@app.get("/api/v1/batches")
async def list_batches():
    return batch_manager.list_batches()


@app.get("/api/v1/tenant/{tenant_id}/history")
async def get_tenant_history(tenant_id: str):
    return batch_manager.get_tenant_history(tenant_id)


@app.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
