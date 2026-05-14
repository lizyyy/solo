from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
import json
import os
from collections import defaultdict

app = FastAPI(title="契约测试执行台")

DATA_FILE = "contract_test_data.json"

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {
        "consumers": [],
        "providers": [],
        "contracts": [],
        "test_results": [],
        "gates": []
    }

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

class Consumer(BaseModel):
    id: Optional[str] = None
    name: str
    owner: str
    description: Optional[str] = None

class Provider(BaseModel):
    id: Optional[str] = None
    name: str
    api_endpoint: str
    description: Optional[str] = None

class Contract(BaseModel):
    id: Optional[str] = None
    consumer_id: str
    provider_id: str
    version: str
    spec: Dict[str, Any]
    status: str = "pending"

class TestResult(BaseModel):
    id: Optional[str] = None
    contract_id: str
    consumer_id: str
    provider_id: str
    version: str
    status: str
    executed_at: Optional[str] = None
    executed_by: str
    failure_reason: Optional[str] = None
    diff: Optional[Dict[str, Any]] = None

class GateRecord(BaseModel):
    id: Optional[str] = None
    test_result_id: str
    consumer_id: str
    provider_id: str
    version: str
    owner: str
    approved: bool = False
    approved_at: Optional[str] = None
    approved_by: Optional[str] = None
    created_at: Optional[str] = None

@app.get("/api/consumers")
def get_consumers():
    data = load_data()
    return {"consumers": data["consumers"]}

@app.post("/api/consumers")
def create_consumer(consumer: Consumer):
    data = load_data()
    consumer.id = str(uuid.uuid4())
    data["consumers"].append(consumer.dict())
    save_data(data)
    return consumer

@app.get("/api/providers")
def get_providers():
    data = load_data()
    return {"providers": data["providers"]}

@app.post("/api/providers")
def create_provider(provider: Provider):
    data = load_data()
    provider.id = str(uuid.uuid4())
    data["providers"].append(provider.dict())
    save_data(data)
    return provider

@app.get("/api/contracts")
def get_contracts(consumer_id: Optional[str] = None, provider_id: Optional[str] = None):
    data = load_data()
    contracts = data["contracts"]
    if consumer_id:
        contracts = [c for c in contracts if c["consumer_id"] == consumer_id]
    if provider_id:
        contracts = [c for c in contracts if c["provider_id"] == provider_id]
    return {"contracts": contracts}

@app.post("/api/contracts")
def create_contract(contract: Contract):
    data = load_data()
    contract.id = str(uuid.uuid4())
    contract.status = "pending"
    data["contracts"].append(contract.dict())
    save_data(data)
    return contract

@app.post("/api/contracts/{contract_id}/execute")
def execute_contract(contract_id: str, executed_by: str):
    data = load_data()
    contract = next((c for c in data["contracts"] if c["id"] == contract_id), None)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    existing_result = next((r for r in data["test_results"] 
                           if r["contract_id"] == contract_id and r["status"] == "running"), None)
    if existing_result:
        return {"message": "Test already running", "result": existing_result}
    
    test_result = TestResult(
        id=str(uuid.uuid4()),
        contract_id=contract_id,
        consumer_id=contract["consumer_id"],
        provider_id=contract["provider_id"],
        version=contract["version"],
        status="running",
        executed_at=datetime.now().isoformat(),
        executed_by=executed_by
    )
    data["test_results"].append(test_result.dict())
    save_data(data)
    
    success = True
    failure_reason = None
    diff = None
    
    if contract["consumer_id"] == "consumer-2" and "error" in contract["spec"]:
        success = False
        failure_reason = "字段类型不匹配：expected string got integer"
        diff = {
            "path": "$.user.id",
            "expected": {"type": "string"},
            "actual": {"type": "integer"},
            "example": {"expected": "123", "actual": 123}
        }
    
    for i, result in enumerate(data["test_results"]):
        if result["id"] == test_result.id:
            data["test_results"][i]["status"] = "passed" if success else "failed"
            data["test_results"][i]["failure_reason"] = failure_reason
            data["test_results"][i]["diff"] = diff
            break
    
    for i, c in enumerate(data["contracts"]):
        if c["id"] == contract_id:
            data["contracts"][i]["status"] = "verified" if success else "failed"
            break
    
    save_data(data)
    return data["test_results"][-1]

@app.get("/api/test-results")
def get_test_results(consumer_id: Optional[str] = None, status: Optional[str] = None):
    data = load_data()
    results = data["test_results"]
    if consumer_id:
        results = [r for r in results if r["consumer_id"] == consumer_id]
    if status:
        results = [r for r in results if r["status"] == status]
    results.sort(key=lambda x: x["executed_at"] or "", reverse=True)
    return {"results": results}

@app.get("/api/test-results/{result_id}")
def get_test_result(result_id: str):
    data = load_data()
    result = next((r for r in data["test_results"] if r["id"] == result_id), None)
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    return result

@app.post("/api/gates")
def create_gate(test_result_id: str):
    data = load_data()
    result = next((r for r in data["test_results"] if r["id"] == test_result_id), None)
    if not result:
        raise HTTPException(status_code=404, detail="Test result not found")
    
    existing_gate = next((g for g in data["gates"] if g["test_result_id"] == test_result_id), None)
    if existing_gate:
        return existing_gate
    
    consumer = next((c for c in data["consumers"] if c["id"] == result["consumer_id"]), None)
    owner = consumer["owner"] if consumer else "unknown"
    
    gate = GateRecord(
        id=str(uuid.uuid4()),
        test_result_id=test_result_id,
        consumer_id=result["consumer_id"],
        provider_id=result["provider_id"],
        version=result["version"],
        owner=owner,
        created_at=datetime.now().isoformat()
    )
    data["gates"].append(gate.dict())
    save_data(data)
    return gate

@app.get("/api/gates")
def get_gates(owner: Optional[str] = None, approved: Optional[bool] = None):
    data = load_data()
    gates = data["gates"]
    if owner:
        gates = [g for g in gates if g["owner"] == owner]
    if approved is not None:
        gates = [g for g in gates if g["approved"] == approved]
    return {"gates": gates}

@app.post("/api/gates/{gate_id}/approve")
def approve_gate(gate_id: str, approved_by: str):
    data = load_data()
    for i, gate in enumerate(data["gates"]):
        if gate["id"] == gate_id:
            data["gates"][i]["approved"] = True
            data["gates"][i]["approved_at"] = datetime.now().isoformat()
            data["gates"][i]["approved_by"] = approved_by
            save_data(data)
            return data["gates"][i]
    raise HTTPException(status_code=404, detail="Gate not found")

@app.get("/api/gates/export")
def export_gates():
    data = load_data()
    gates = data["gates"]
    
    by_owner = defaultdict(list)
    for gate in gates:
        by_owner[gate["owner"]].append(gate)
    
    by_version = defaultdict(list)
    for gate in gates:
        by_version[gate["version"]].append(gate)
    
    by_date = defaultdict(list)
    for gate in gates:
        date = gate["created_at"].split("T")[0] if gate["created_at"] else "unknown"
        by_date[date].append(gate)
    
    return {
        "summary": {
            "total": len(gates),
            "approved": len([g for g in gates if g["approved"]]),
            "pending": len([g for g in gates if not g["approved"]])
        },
        "by_owner": by_owner,
        "by_version": by_version,
        "by_date": by_date,
        "raw_data": gates
    }

@app.get("/api/gates/export/csv")
def export_gates_csv():
    data = load_data()
    gates = data["gates"]
    
    csv_lines = ["负责人,契约版本,日期,服务提供方,状态,审批人,审批时间"]
    for gate in gates:
        status = "已通过" if gate["approved"] else "待审批"
        date = gate["created_at"].split("T")[0] if gate["created_at"] else ""
        approved_at = gate["approved_at"].split("T")[0] if gate["approved_at"] else ""
        csv_lines.append(f"{gate['owner']},{gate['version']},{date},{gate['provider_id']},{status},{gate.get('approved_by','')},{approved_at}")
    
    csv_content = "\n".join(csv_lines)
    with open("gate_export.csv", "w", encoding="utf-8") as f:
        f.write(csv_content)
    
    return FileResponse("gate_export.csv", media_type="text/csv", filename="gate_export.csv")

@app.get("/", response_class=HTMLResponse)
def get_index():
    with open("index.html", "r", encoding="utf-8") as f:
        return f.read()

def init_sample_data():
    data = load_data()
    if not data["consumers"]:
        data["consumers"] = [
            {"id": "consumer-1", "name": "订单服务", "owner": "张三", "description": "处理订单业务"},
            {"id": "consumer-2", "name": "用户服务", "owner": "李四", "description": "用户管理服务"},
            {"id": "consumer-3", "name": "支付服务", "owner": "王五", "description": "支付处理服务"}
        ]
    if not data["providers"]:
        data["providers"] = [
            {"id": "provider-1", "name": "商品API", "api_endpoint": "/api/products", "description": "商品查询接口"},
            {"id": "provider-2", "name": "库存API", "api_endpoint": "/api/inventory", "description": "库存管理接口"},
            {"id": "provider-3", "name": "用户API", "api_endpoint": "/api/users", "description": "用户信息接口"}
        ]
    if not data["contracts"]:
        data["contracts"] = [
            {
                "id": "contract-1",
                "consumer_id": "consumer-1",
                "provider_id": "provider-1",
                "version": "1.0.0",
                "spec": {"request": {"method": "GET", "path": "/products"}, "response": {"status": 200}},
                "status": "pending"
            },
            {
                "id": "contract-2",
                "consumer_id": "consumer-2",
                "provider_id": "provider-3",
                "version": "2.1.0",
                "spec": {"request": {"method": "GET", "path": "/users"}, "response": {"status": 200}, "error": true},
                "status": "pending"
            },
            {
                "id": "contract-3",
                "consumer_id": "consumer-3",
                "provider_id": "provider-2",
                "version": "1.5.0",
                "spec": {"request": {"method": "POST", "path": "/inventory"}, "response": {"status": 201}},
                "status": "pending"
            }
        ]
    save_data(data)

if __name__ == "__main__":
    init_sample_data()
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
