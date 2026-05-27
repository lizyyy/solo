import os
import shutil
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse

from app.models import ReconcileResult, BatchSubmission
from app.utils.file_parser import parse_meter_csv, parse_orders_json, parse_damage_claims
from app.services.reconcile import reconcile_batch
from app.storage import is_batch_processed, save_batch, save_result, get_result

app = FastAPI(
    title="短租运营对账系统 API",
    description="处理退房水电抄表、损坏扣款和押金退款对账，自动区分正常/待确认/失败项",
    version="1.0.0"
)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.get("/", summary="健康检查")
async def root():
    return {
        "status": "ok",
        "service": "短租运营对账系统",
        "timestamp": datetime.now().isoformat()
    }


@app.get("/properties", summary="获取房源配置列表")
async def get_properties():
    from app.services.reconcile import PROPERTY_CONFIG
    return {"properties": list(PROPERTY_CONFIG.values())}


@app.post("/api/reconcile/upload", response_model=ReconcileResult, summary="上传对账材料并处理")
async def upload_and_reconcile(
    batch_id: Optional[str] = Form(None, description="批次ID，不传则自动生成"),
    meter_csv: UploadFile = File(..., description="水电抄表CSV文件"),
    orders_json: UploadFile = File(..., description="订单数据JSON文件"),
    damage_json: Optional[UploadFile] = File(None, description="损坏扣款JSON文件"),
    photos: List[UploadFile] = File(None, description="损坏照片文件")
):
    meter_content = await meter_csv.read()
    orders_content = await orders_json.read()
    
    meter_readings = parse_meter_csv(meter_content)
    orders = parse_orders_json(orders_content)
    
    damage_claims = []
    photo_filenames = {}
    
    if photos:
        for photo in photos:
            photo_content = await photo.read()
            photo_path = os.path.join(UPLOAD_DIR, photo.filename)
            with open(photo_path, "wb") as f:
                f.write(photo_content)
            
            order_id = os.path.splitext(photo.filename)[0]
            photo_filenames[order_id] = photo.filename
    
    if damage_json:
        damage_content = await damage_json.read()
        damage_claims = parse_damage_claims(damage_content, photo_filenames)
    
    if not batch_id:
        from app.utils.file_parser import generate_batch_id
        batch_id = generate_batch_id(len(meter_readings), len(orders), len(damage_claims))
    
    if is_batch_processed(batch_id):
        existing_result = get_result(batch_id)
        if existing_result:
            return JSONResponse(
                status_code=200,
                content={
                    **existing_result,
                    "note": f"批次 {batch_id} 已处理过，返回历史结果（幂等保护）"
                }
            )
    
    result = reconcile_batch(batch_id, meter_readings, orders, damage_claims)
    
    save_batch(batch_id, {
        "meter_reading_count": len(meter_readings),
        "order_count": len(orders),
        "damage_count": len(damage_claims),
        "status": "processed"
    })
    
    result_dict = result.model_dump()
    save_result(batch_id, result_dict)
    
    return result


@app.get("/api/reconcile/{batch_id}", response_model=ReconcileResult, summary="查询批次处理结果")
async def get_reconcile_result(batch_id: str):
    result = get_result(batch_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"批次 {batch_id} 不存在")
    return result


@app.get("/api/batches", response_model=List[BatchSubmission], summary="查询所有处理批次")
async def list_batches():
    from app.storage import _read_json, BATCH_FILE
    batches = _read_json(BATCH_FILE)
    result = []
    for batch_id, data in batches.items():
        result.append(BatchSubmission(
            batch_id=batch_id,
            submitted_at=datetime.fromisoformat(data["submitted_at"]),
            meter_reading_count=data.get("meter_reading_count", 0),
            order_count=data.get("order_count", 0),
            damage_count=data.get("damage_count", 0),
            status=data.get("status", "unknown")
        ))
    return sorted(result, key=lambda x: x.submitted_at, reverse=True)


@app.delete("/api/reset", summary="重置所有数据（仅用于测试）")
async def reset_all_data():
    if os.path.exists(UPLOAD_DIR):
        shutil.rmtree(UPLOAD_DIR)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    
    data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
    if os.path.exists(data_dir):
        shutil.rmtree(data_dir)
    os.makedirs(data_dir, exist_ok=True)
    
    return {"status": "ok", "message": "所有数据已重置"}
