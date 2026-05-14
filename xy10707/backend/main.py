from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from datetime import datetime
import uuid
import json

app = FastAPI(title="GraphQL字段权限审计")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RoleRule(BaseModel):
    id: Optional[str] = None
    role_name: str
    rules: Dict[str, Any]
    created_at: Optional[str] = None

class FieldPath(BaseModel):
    id: Optional[str] = None
    path: str
    description: str
    type: str

class QueryExample(BaseModel):
    id: Optional[str] = None
    name: str
    query: str
    role: str
    expected_result: str

class InterceptRecord(BaseModel):
    id: Optional[str] = None
    query_id: str
    role: str
    field_path: str
    timestamp: Optional[str] = None
    reason: str
    status: str

class ApprovalRecord(BaseModel):
    id: Optional[str] = None
    intercept_id: str
    approver: str
    decision: str
    comment: str
    timestamp: Optional[str] = None

class PermissionMatrix(BaseModel):
    id: Optional[str] = None
    role: str
    field_path: str
    permission: str
    source: str
    updated_at: Optional[str] = None

db = {
    "role_rules": [],
    "field_paths": [],
    "query_examples": [],
    "intercept_records": [],
    "approval_records": [],
    "permission_matrix": [],
}

def init_demo_data():
    db["role_rules"] = [
        {
            "id": str(uuid.uuid4()),
            "role_name": "普通用户",
            "rules": {"read": ["user.*", "post.view"], "write": ["user.profile"]},
            "created_at": datetime.now().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "role_name": "管理员",
            "rules": {"read": ["*"], "write": ["*"]},
            "created_at": datetime.now().isoformat()
        }
    ]
    
    db["field_paths"] = [
        {"id": str(uuid.uuid4()), "path": "user.profile", "description": "用户个人资料", "type": "Object"},
        {"id": str(uuid.uuid4()), "path": "user.email", "description": "用户邮箱", "type": "String"},
        {"id": str(uuid.uuid4()), "path": "post.content", "description": "文章内容", "type": "String"},
        {"id": str(uuid.uuid4()), "path": "admin.settings", "description": "系统设置", "type": "Object"}
    ]
    
    db["query_examples"] = [
        {
            "id": str(uuid.uuid4()),
            "name": "查询用户资料",
            "query": "query { user { profile email } }",
            "role": "普通用户",
            "expected_result": "允许"
        },
        {
            "id": str(uuid.uuid4()),
            "name": "查询系统设置",
            "query": "query { admin { settings } }",
            "role": "普通用户",
            "expected_result": "拦截"
        }
    ]
    
    recalculate_matrix()

def recalculate_matrix():
    matrix = []
    for rule in db["role_rules"]:
        for field in db["field_paths"]:
            permission = "deny"
            source = "default"
            
            for perm_type, paths in rule["rules"].items():
                for allowed_path in paths:
                    if allowed_path == "*" or field["path"].startswith(allowed_path.replace("*", "")):
                        permission = perm_type
                        source = f"role:{rule['role_name']}"
            
            matrix.append({
                "id": str(uuid.uuid4()),
                "role": rule["role_name"],
                "field_path": field["path"],
                "permission": permission,
                "source": source,
                "updated_at": datetime.now().isoformat()
            })
    
    db["permission_matrix"] = matrix

@app.get("/")
def root():
    return {"message": "GraphQL字段权限审计 API"}

@app.post("/api/demo/init")
def init_demo():
    init_demo_data()
    return {"status": "success", "message": "演示数据已初始化"}

@app.get("/api/role-rules")
def get_role_rules():
    return db["role_rules"]

@app.post("/api/role-rules")
def add_role_rule(rule: RoleRule):
    rule.id = str(uuid.uuid4())
    rule.created_at = datetime.now().isoformat()
    db["role_rules"].append(rule.dict())
    recalculate_matrix()
    return rule

@app.get("/api/field-paths")
def get_field_paths():
    return db["field_paths"]

@app.post("/api/field-paths")
def add_field_path(field: FieldPath):
    field.id = str(uuid.uuid4())
    db["field_paths"].append(field.dict())
    recalculate_matrix()
    return field

@app.get("/api/query-examples")
def get_query_examples():
    return db["query_examples"]

@app.post("/api/query-examples")
def add_query_example(example: QueryExample):
    example.id = str(uuid.uuid4())
    db["query_examples"].append(example.dict())
    return example

@app.get("/api/intercept-records")
def get_intercept_records():
    return db["intercept_records"]

@app.post("/api/intercept-records")
def add_intercept_record(record: InterceptRecord):
    existing = next((r for r in db["intercept_records"] if r["query_id"] == record.query_id and r["field_path"] == record.field_path), None)
    if existing:
        return existing
    
    record.id = str(uuid.uuid4())
    record.timestamp = datetime.now().isoformat()
    db["intercept_records"].append(record.dict())
    return record

@app.get("/api/approval-records")
def get_approval_records():
    return db["approval_records"]

@app.post("/api/approval-records")
def add_approval_record(record: ApprovalRecord):
    existing = next((r for r in db["approval_records"] 
                    if r["intercept_id"] == record.intercept_id and r["approver"] == record.approver), None)
    if existing:
        return existing
    
    record.id = str(uuid.uuid4())
    record.timestamp = datetime.now().isoformat()
    db["approval_records"].append(record.dict())
    
    intercept = next((r for r in db["intercept_records"] if r["id"] == record.intercept_id), None)
    if intercept:
        intercept["status"] = record.decision
    
    return record

@app.get("/api/permission-matrix")
def get_permission_matrix():
    return db["permission_matrix"]

@app.post("/api/permission-matrix/recalculate")
def trigger_recalculate():
    recalculate_matrix()
    return {"status": "success", "matrix": db["permission_matrix"]}

@app.post("/api/permission-matrix/manual-update")
def manual_update(role: str, field_path: str, permission: str):
    item = next((m for m in db["permission_matrix"] if m["role"] == role and m["field_path"] == field_path), None)
    if item:
        item["permission"] = permission
        item["source"] = "manual"
        item["updated_at"] = datetime.now().isoformat()
        return item
    raise HTTPException(status_code=404, detail="记录未找到")

@app.get("/api/export")
def export_data():
    return {
        "exported_at": datetime.now().isoformat(),
        "data": db
    }

@app.get("/api/processing-chain/{role_name}")
def get_processing_chain(role_name: str):
    rule = next((r for r in db["role_rules"] if r["role_name"] == role_name), None)
    if not rule:
        raise HTTPException(status_code=404, detail="角色未找到")
    
    chain = {
        "role": role_name,
        "rules": rule["rules"],
        "steps": [],
        "matrix": []
    }
    
    for field in db["field_paths"]:
        step = {
            "field": field["path"],
            "checks": []
        }
        
        result_perm = "deny"
        for perm_type, paths in rule["rules"].items():
            for allowed_path in paths:
                match = allowed_path == "*" or field["path"].startswith(allowed_path.replace("*", ""))
                step["checks"].append({
                    "rule": f"{perm_type}: {allowed_path}",
                    "match": match
                })
                if match:
                    result_perm = perm_type
        
        chain["steps"].append(step)
        chain["matrix"].append({
            "field": field["path"],
            "permission": result_perm
        })
    
    return chain

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
