from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import hashlib
import json
from typing import Optional
from dotenv import load_dotenv

from models import ProcessResult, OrderRecord, ChargingLog, PaymentReceipt
from parser import parse_csv_file, parse_json_file, normalize_order_record, normalize_charging_log, normalize_payment_receipt
from rules import apply_rules

load_dotenv()

app = FastAPI(title="新能源订单数据处理 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

processed_batches = set()


def generate_batch_id(*sources) -> str:
    combined = ""
    for source in sources:
        if isinstance(source, list):
            for item in source:
                combined += json.dumps(item.dict(), sort_keys=True, default=str)
        elif isinstance(source, dict):
            combined += json.dumps(source, sort_keys=True, default=str)
        else:
            combined += str(source)
    return hashlib.md5(combined.encode()).hexdigest()


@app.post("/api/process", response_model=ProcessResult)
async def process_data(
    order_csv: Optional[UploadFile] = File(None),
    charging_log: Optional[UploadFile] = File(None),
    payment_receipt: Optional[UploadFile] = File(None)
):
    if not any([order_csv, charging_log, payment_receipt]):
        raise HTTPException(status_code=400, detail="请至少上传一个文件")

    orders = []
    charging_logs = []
    payments = []

    if order_csv:
        content = await order_csv.read()
        rows = parse_csv_file(content)
        orders = [normalize_order_record(row) for row in rows]

    if charging_log:
        content = await charging_log.read()
        rows = parse_json_file(content)
        charging_logs = [normalize_charging_log(row) for row in rows]

    if payment_receipt:
        content = await payment_receipt.read()
        rows = parse_json_file(content)
        payments = [normalize_payment_receipt(row) for row in rows]

    batch_id = generate_batch_id(orders, charging_logs, payments)

    if batch_id in processed_batches:
        raise HTTPException(
            status_code=409,
            detail=f"该批次数据已处理过，批次ID: {batch_id}，请勿重复提交"
        )

    result = apply_rules(orders, charging_logs, payments, batch_id)
    processed_batches.add(batch_id)
    return result


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.get("/api/batches")
async def get_processed_batches():
    return {"processed_batches": list(processed_batches)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
