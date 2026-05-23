#!/usr/bin/env python3

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app
import json

print("=" * 60)
print("集成测试：使用 TestClient 验证真实 HTTP 路由")
print("=" * 60)
print()

print("初始化数据库用于集成测试...")
from app.database import get_engine, init_database_schema
get_engine(use_memory_fallback=True)
init_database_schema()
print("✅ 数据库初始化完成")
print()

client = TestClient(app)

print("1. 测试 GET / (根路径)...")
response = client.get("/")
assert response.status_code == 200, f"期望 200，实际 {response.status_code}"
data = response.json()
assert "message" in data
print(f"   ✅ 根路径正常: {data['message']}")
print()

print("2. 测试 POST /api/applications (创建申请)...")
app_data = {
    "applicant_name": "集成测试用户",
    "applicant_email": "integration@test.com",
    "applicant_company": "测试团队",
    "api_scopes": "users:read,orders:read",
    "validity_days": 30,
    "reason": "集成测试申请"
}
response = client.post("/api/applications", json=app_data)
assert response.status_code == 200, f"期望 200，实际 {response.status_code}: {response.text}"
app_result = response.json()
assert app_result["status"] == "pending"
assert app_result["applicant"]["name"] == "集成测试用户"
application_id = app_result["id"]
print(f"   ✅ 申请创建成功: ID={application_id}")
print()

print("3. 测试 GET /api/applications/pending (待审批列表)...")
response = client.get("/api/applications/pending")
assert response.status_code == 200
pending = response.json()
assert len(pending) >= 1
print(f"   ✅ 待审批列表正常: {len(pending)} 条记录")
print()

print("4. 测试 POST /api/approvals (审批通过)...")
approval_data = {
    "application_id": application_id,
    "approved": True,
    "reviewer_comment": "集成测试批准"
}
response = client.post("/api/approvals", json=approval_data)
assert response.status_code == 200, f"期望 200，实际 {response.status_code}: {response.text}"
credential = response.json()
assert "api_key" in credential
assert "api_secret" in credential
assert credential["status"] == "active"
api_key = credential["api_key"]
api_secret = credential["api_secret"]
credential_id = credential["id"]
print(f"   ✅ 凭证签发成功: API Key={api_key[:10]}...")
print()

print("5. 测试 GET /api/credentials/active (有效凭证列表)...")
response = client.get("/api/credentials/active")
assert response.status_code == 200
active = response.json()
assert len(active) >= 1
print(f"   ✅ 有效凭证列表正常: {len(active)} 条记录")
print()

print("6. 测试 POST /api/verify-access (授权访问)...")
access_data = {
    "api_key": api_key,
    "api_secret": api_secret,
    "endpoint": "/api/users",
    "method": "GET"
}
response = client.post("/api/verify-access", json=access_data)
assert response.status_code == 200
result = response.json()
assert result["granted"] == True
print(f"   ✅ 授权访问正常: granted={result['granted']}")
print()

print("7. 测试 POST /api/verify-access (越权访问拒绝)...")
access_data = {
    "api_key": api_key,
    "api_secret": api_secret,
    "endpoint": "/api/orders",
    "method": "POST"
}
response = client.post("/api/verify-access", json=access_data)
assert response.status_code == 200
result = response.json()
assert result["granted"] == False
assert "缺少权限" in result["reason"]
print(f"   ✅ 越权访问正确拒绝: reason={result['reason']}")
print()

print("8. 测试 POST /api/credentials/revoke (撤销凭证)...")
revoke_data = {
    "credential_id": credential_id,
    "reason": "集成测试撤销"
}
response = client.post("/api/credentials/revoke", json=revoke_data)
assert response.status_code == 200
revoked = response.json()
assert revoked["status"] == "revoked"
print(f"   ✅ 凭证撤销成功: status={revoked['status']}")
print()

print("9. 测试 GET /api/credentials/revoked (回收流水)...")
response = client.get("/api/credentials/revoked")
assert response.status_code == 200
recycled = response.json()
assert len(recycled) >= 1
print(f"   ✅ 回收流水正常: {len(recycled)} 条记录")
print()

print("10. 测试 GET /api/audit-chain (完整审计链路)...")
response = client.get(f"/api/audit-chain/{credential_id}")
assert response.status_code == 200
chain = response.json()
assert "applicant" in chain
assert "application" in chain
assert "credential" in chain
assert "audit_logs" in chain
log_count = len(chain["audit_logs"])
assert log_count >= 3  # 签发、访问、越权、撤销
print(f"   ✅ 审计链路完整: 日志数={log_count}")
print()

print("11. 测试 POST /api/demo/create-expired-credential (已过期凭证)...")
expired_data = {
    "applicant_name": "过期测试",
    "applicant_email": "expired@test.com",
    "applicant_company": "过期团队",
    "api_scopes": "users:read",
    "validity_days": 7,
    "reason": "过期测试"
}
response = client.post("/api/demo/create-expired-credential", json=expired_data)
assert response.status_code == 200
expired_cred = response.json()
assert expired_cred["status"] == "expired"
print(f"   ✅ 过期凭证创建成功: status={expired_cred['status']}")
print()

print("12. 测试 GET /api/stats (统计接口)...")
response = client.get("/api/stats")
assert response.status_code == 200
stats = response.json()
assert "applications" in stats
assert "credentials" in stats
print(f"   ✅ 统计接口正常: {json.dumps(stats, indent=2, ensure_ascii=False)}")
print()

print("=" * 60)
print("✅ 所有集成测试通过！")
print("真实 HTTP 路由可正常使用：申请→审批→签发→访问→越权→撤销→审计")
print("=" * 60)
