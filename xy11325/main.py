from fastapi import FastAPI, HTTPException
from typing import List, Dict, Any
from datetime import date
from models import (
    WorkRecord, ProcessedRecord, QueryFilter, BatchResult,
    BillingRules, RecordStatus, ExceptionType, SettlementRecord
)
from data_store import DataStore
import os

app = FastAPI(title="农机合作社财务管理系统", version="1.0.0")
data_store = DataStore()
REPORT_DIR = "reports"
os.makedirs(REPORT_DIR, exist_ok=True)


@app.get("/")
async def root():
    return {"message": "农机合作社财务管理系统", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/api/records/batch", response_model=BatchResult)
async def batch_process_records(records: List[Dict[str, Any]]):
    result = data_store.batch_process(records)
    return result


@app.post("/api/records/retry", response_model=BatchResult)
async def retry_failed_records(records: List[Dict[str, Any]]):
    result = data_store.retry_failed(records)
    return result


@app.get("/api/records", response_model=List[ProcessedRecord])
async def get_all_records():
    return data_store.get_all_records()


@app.get("/api/records/{record_id}", response_model=ProcessedRecord)
async def get_record(record_id: str):
    record = data_store.get_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return record


@app.post("/api/records/query", response_model=Dict[str, Any])
async def query_records(query_filter: QueryFilter):
    records = data_store.query_records(query_filter)
    summary = data_store.get_record_summary(records)
    return {
        "records": records,
        "summary": summary
    }


@app.post("/api/records/export")
async def export_records(query_filter: QueryFilter):
    records = data_store.query_records(query_filter)
    timestamp = date.today().strftime("%Y%m%d")
    filename = f"作业记录_{timestamp}_{len(records)}条.xlsx"
    filepath = os.path.join(REPORT_DIR, filename)
    data_store.export_report(records, filepath)
    return {
        "success": True,
        "filepath": os.path.abspath(filepath),
        "record_count": len(records)
    }


@app.post("/api/settlements")
async def create_settlement(record_ids: List[str], operator: str):
    result = data_store.create_settlement(record_ids, operator)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.get("/api/settlements", response_model=List[SettlementRecord])
async def get_settlements():
    return data_store.get_settlements()


@app.get("/api/rules", response_model=BillingRules)
async def get_billing_rules():
    return data_store.billing_engine.rules


@app.put("/api/rules", response_model=BillingRules)
async def update_billing_rules(rules: BillingRules):
    data_store.billing_engine.rules = rules
    return rules


@app.get("/api/enums/status")
async def get_status_enum():
    return {e.name: e.value for e in RecordStatus}


@app.get("/api/enums/exception-types")
async def get_exception_enum():
    return {e.name: e.value for e in ExceptionType}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
