from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import uuid
from datetime import datetime
import os

app = FastAPI(title="爬虫数据去重合并系统")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "frontend", "data", "sample_data.json")

def load_data():
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return {
            "batches": [],
            "raw_records": [],
            "fingerprint_rules": [],
            "merge_reports": []
        }

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

class Batch(BaseModel):
    name: str
    source: str

class Record(BaseModel):
    product_name: str
    price: Optional[float]
    brand: Optional[str]
    category: Optional[str]
    source: str
    confidence: float = 0.8

class ConflictResolution(BaseModel):
    fingerprint: str
    field_choices: Dict[str, int]

class FingerprintRule(BaseModel):
    name: str
    description: str
    fields: List[str]
    algorithm: str
    threshold: float
    enabled: bool

@app.get("/api/batches")
async def get_batches():
    data = load_data()
    return {"batches": data["batches"]}

@app.get("/api/batches/{batch_id}")
async def get_batch(batch_id: str):
    data = load_data()
    batch = next((b for b in data["batches"] if b["id"] == batch_id), None)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    records = [r for r in data["raw_records"] if r["batch_id"] == batch_id]
    return {"batch": batch, "records": records}

@app.post("/api/batches")
async def create_batch(batch: Batch):
    data = load_data()
    new_batch = {
        "id": f"batch_{len(data['batches']) + 1:03d}",
        "name": batch.name,
        "source": batch.source,
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "status": "pending",
        "total_records": 0,
        "conflicts": 0,
        "duplicates": 0
    }
    data["batches"].append(new_batch)
    save_data(data)
    return new_batch

@app.post("/api/batches/{batch_id}/records")
async def add_records(batch_id: str, records: List[Record]):
    data = load_data()
    batch = next((b for b in data["batches"] if b["id"] == batch_id), None)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    for rec in records:
        new_record = {
            "id": f"rec_{len(data['raw_records']) + 1:03d}",
            "batch_id": batch_id,
            "product_name": rec.product_name,
            "price": rec.price,
            "brand": rec.brand or "",
            "category": rec.category or "",
            "source": rec.source,
            "confidence": rec.confidence,
            "fingerprint": generate_fingerprint(rec.product_name, data["fingerprint_rules"]),
            "status": "pending",
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        data["raw_records"].append(new_record)
    
    batch["total_records"] += len(records)
    save_data(data)
    return {"message": f"成功添加 {len(records)} 条记录"}

@app.post("/api/batches/{batch_id}/process")
async def process_batch(batch_id: str):
    data = load_data()
    batch = next((b for b in data["batches"] if b["id"] == batch_id), None)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    records = [r for r in data["raw_records"] if r["batch_id"] == batch_id]
    
    fingerprint_groups = {}
    for rec in records:
        fp = rec["fingerprint"]
        if fp not in fingerprint_groups:
            fingerprint_groups[fp] = []
        fingerprint_groups[fp].append(rec)
    
    duplicates = 0
    conflicts = 0
    
    for fp, group in fingerprint_groups.items():
        if len(group) > 1:
            duplicates += len(group) - 1
            has_conflict = check_conflicts(group)
            if has_conflict:
                conflicts += 1
                for rec in group:
                    rec["status"] = "conflict"
            else:
                group.sort(key=lambda x: x["confidence"], reverse=True)
                group[0]["status"] = "merged"
                for rec in group[1:]:
                    rec["status"] = "duplicate"
        else:
            group[0]["status"] = "merged"
    
    batch["status"] = "processing"
    batch["duplicates"] = duplicates
    batch["conflicts"] = conflicts
    save_data(data)
    
    return {"message": "处理完成", "duplicates": duplicates, "conflicts": conflicts}

@app.get("/api/batches/{batch_id}/conflicts")
async def get_conflicts(batch_id: str):
    data = load_data()
    records = [r for r in data["raw_records"] if r["batch_id"] == batch_id and r["status"] == "conflict"]
    
    fingerprint_groups = {}
    for rec in records:
        fp = rec["fingerprint"]
        if fp not in fingerprint_groups:
            fingerprint_groups[fp] = []
        fingerprint_groups[fp].append(rec)
    
    conflicts = []
    for fp, group in fingerprint_groups.items():
        conflict_fields = find_conflict_fields(group)
        conflicts.append({
            "fingerprint": fp,
            "records": group,
            "conflict_fields": conflict_fields
        })
    
    return {"conflicts": conflicts}

@app.post("/api/batches/{batch_id}/resolve")
async def resolve_conflicts(batch_id: str, resolutions: List[ConflictResolution]):
    data = load_data()
    records = [r for r in data["raw_records"] if r["batch_id"] == batch_id]
    
    for resolution in resolutions:
        fp = resolution.fingerprint
        group = [r for r in records if r["fingerprint"] == fp]
        if group:
            group.sort(key=lambda x: x["confidence"], reverse=True)
            primary = group[0]
            
            for field, choice_idx in resolution.field_choices.items():
                if 0 <= choice_idx < len(group):
                    primary[field] = group[choice_idx][field]
            
            primary["status"] = "merged"
            for rec in group[1:]:
                rec["status"] = "duplicate"
    
    batch = next((b for b in data["batches"] if b["id"] == batch_id), None)
    if batch:
        remaining_conflicts = sum(1 for r in records if r["status"] == "conflict")
        if remaining_conflicts == 0:
            batch["status"] = "merged"
            generate_merge_report(batch_id, data)
    
    save_data(data)
    return {"message": "冲突解决完成"}

@app.post("/api/batches/{batch_id}/rollback")
async def rollback_batch(batch_id: str):
    data = load_data()
    records = [r for r in data["raw_records"] if r["batch_id"] == batch_id]
    
    for rec in records:
        rec["status"] = "pending"
    
    batch = next((b for b in data["batches"] if b["id"] == batch_id), None)
    if batch:
        batch["status"] = "pending"
        batch["conflicts"] = 0
        batch["duplicates"] = 0
    
    save_data(data)
    return {"message": "已回滚到待处理状态"}

@app.get("/api/reports/{batch_id}")
async def get_merge_report(batch_id: str):
    data = load_data()
    report = next((r for r in data["merge_reports"] if r["batch_id"] == batch_id), None)
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    return report

@app.get("/api/fingerprint-rules")
async def get_fingerprint_rules():
    data = load_data()
    return {"rules": data["fingerprint_rules"]}

@app.put("/api/fingerprint-rules/{rule_id}")
async def update_fingerprint_rule(rule_id: str, rule: FingerprintRule):
    data = load_data()
    existing = next((r for r in data["fingerprint_rules"] if r["id"] == rule_id), None)
    if not existing:
        raise HTTPException(status_code=404, detail="规则不存在")
    
    existing.update(rule.dict())
    save_data(data)
    return existing

def generate_fingerprint(text: str, rules: List[Dict]) -> str:
    import hashlib
    normalized = ''.join(text.lower().split())
    return f"hash_{hashlib.md5(normalized.encode()).hexdigest()[:8]}"

def check_conflicts(records: List[Dict]) -> bool:
    fields = ["price", "brand", "category"]
    for field in fields:
        values = set(str(r.get(field, "")) for r in records if r.get(field))
        if len(values) > 1:
            return True
    return False

def find_conflict_fields(records: List[Dict]) -> List[Dict]:
    fields = ["product_name", "price", "brand", "category"]
    conflicts = []
    for field in fields:
        values = []
        sources = []
        for r in records:
            val = r.get(field)
            if val not in values:
                values.append(val)
                sources.append(r["source"])
        if len(values) > 1:
            conflicts.append({
                "field": field,
                "values": values,
                "sources": sources
            })
    return conflicts

def generate_merge_report(batch_id: str, data: Dict):
    records = [r for r in data["raw_records"] if r["batch_id"] == batch_id and r["status"] == "merged"]
    
    source_weights = {}
    for r in data["raw_records"]:
        if r["source"] not in source_weights:
            source_weights[r["source"]] = []
        source_weights[r["source"]].append(r["confidence"])
    
    confidence_weights = {
        source: sum(weights) / len(weights)
        for source, weights in source_weights.items()
    }
    
    merged_data = []
    for rec in records:
        group = [r for r in data["raw_records"] if r["fingerprint"] == rec["fingerprint"]]
        merged_data.append({
            "fingerprint": rec["fingerprint"],
            "final_product_name": rec["product_name"],
            "final_price": rec["price"],
            "final_brand": rec["brand"],
            "final_category": rec["category"],
            "source_count": len(group),
            "primary_source": rec["source"],
            "confidence": rec["confidence"],
            "field_conflicts": find_conflict_fields(group) if len(group) > 1 else []
        })
    
    report = {
        "id": f"report_{len(data['merge_reports']) + 1:03d}",
        "batch_id": batch_id,
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "summary": {
            "total_input": sum(1 for r in data["raw_records"] if r["batch_id"] == batch_id),
            "merged_records": len(records),
            "duplicates_removed": sum(1 for r in data["raw_records"] if r["batch_id"] == batch_id and r["status"] == "duplicate"),
            "conflicts_resolved": len(merged_data) - sum(1 for m in merged_data if not m["field_conflicts"]),
            "errors_found": sum(1 for r in data["raw_records"] if r["batch_id"] == batch_id and r["status"] == "error")
        },
        "confidence_weights": confidence_weights,
        "merged_data": merged_data
    }
    
    data["merge_reports"].append(report)

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
