#!/usr/bin/env python3

import sys
import os
import time
import subprocess
import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

API_BASE = "http://localhost:8000"

print("=" * 60)
print("HTTP API 集成测试：真实 HTTP 请求验证完整链路")
print("=" * 60)
print()

print("检查后端服务是否运行...")
try:
    response = requests.get(f"{API_BASE}/", timeout=2)
    if response.status_code == 200:
        print("✅ 后端服务已运行")
    else:
        print(f"⚠️  服务状态异常: {response.status_code}")
except:
    print("⚠️  后端服务未运行，正在启动...")
    proc = subprocess.Popen(
        [sys.executable, "main.py"],
        cwd=os.path.dirname(os.path.abspath(__file__)),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT
    )
    time.sleep(3)
    try:
        response = requests.get(f"{API_BASE}/", timeout=2)
        if response.status_code == 200:
            print("✅ 后端服务已启动")
        else:
            print(f"❌ 服务启动失败")
            proc.kill()
            sys.exit(1)
    except:
        print("❌ 无法连接到后端服务")
        proc.kill()
        sys.exit(1)
print()

print("1. 测试 GET / (根路径)...")
response = requests.get(f"{API_BASE}/")
assert response.status_code == 200, f"期望 200，实际 {response.status_code}"
data = response.json()
assert "message" in data
print(f"   ✅ 根路径正常: {data['message']}")
print()

print("2. 测试 POST /api/applications (创建申请)...")
app_data = {
    "applicant_name": "HTTP测试用户",
    "applicant_email": "http_test@test.com",
    "applicant_company": "HTTP测试团队",
    "api_scopes": "users:read,orders:read",
    "validity_days": 30,
    "reason": "HTTP集成测试申请"
}
response = requests.post(f"{API_BASE}/api/applications", json=app_data)
assert response.status_code == 200, f"期望 200，实际 {response.status_code}: {response.text}"
app_result = response.json()
assert app_result["status"] == "pending"
assert app_result["applicant"]["name"] == "HTTP测试用户"
application_id = app_result["id"]
print(f"   ✅ 申请创建成功: ID={application_id}")
print()

print("3. 测试 GET /api/applications/pending (待审批列表)...")
response = requests.get(f"{API_BASE}/api/applications/pending")
assert response.status_code == 200
pending = response.json()
assert len(pending) >= 1
print(f"   ✅ 待审批列表正常: {len(pending)} 条记录")
print()

print("4. 测试 POST /api/approvals (审批通过)...")
approval_data = {
    "application_id": application_id,
    "approved": True,
    "reviewer_comment": "HTTP测试批准"
}
response = requests.post(f"{API_BASE}/api/approvals", json=approval_data)
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
response = requests.get(f"{API_BASE}/api/credentials/active")
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
response = requests.post(f"{API_BASE}/api/verify-access", json=access_data)
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
response = requests.post(f"{API_BASE}/api/verify-access", json=access_data)
assert response.status_code == 200
result = response.json()
assert result["granted"] == False
assert "缺少权限" in result["reason"]
print(f"   ✅ 越权访问正确拒绝: reason={result['reason']}")
print()

print("8. 测试 POST /api/credentials/revoke (撤销凭证)...")
revoke_data = {
    "credential_id": credential_id,
    "reason": "HTTP测试撤销"
}
response = requests.post(f"{API_BASE}/api/credentials/revoke", json=revoke_data)
assert response.status_code == 200
revoked = response.json()
assert revoked["status"] == "revoked"
print(f"   ✅ 凭证撤销成功: status={revoked['status']}")
print()

print("9. 测试 GET /api/credentials/revoked (回收流水)...")
response = requests.get(f"{API_BASE}/api/credentials/revoked")
assert response.status_code == 200
recycled = response.json()
assert len(recycled) >= 1
print(f"   ✅ 回收流水正常: {len(recycled)} 条记录")
print()

print("10. 测试 GET /api/audit-chain (完整审计链路)...")
response = requests.get(f"{API_BASE}/api/audit-chain/{credential_id}")
assert response.status_code == 200
chain = response.json()
assert "applicant" in chain
assert "application" in chain
assert "credential" in chain
assert "audit_logs" in chain
log_count = len(chain["audit_logs"])
assert log_count >= 3  # 签发、访问、越权、撤销
print(f"   ✅ 审计链路完整: 日志数={log_count}")
for log in chain["audit_logs"]:
    status_icon = "✅" if log["status"] == "success" else "❌"
    print(f"      - {status_icon} {log['action']}: {log.get('endpoint', 'N/A')}")
print()

print("11. 测试 POST /api/demo/create-expired-credential (已过期凭证)...")
expired_data = {
    "applicant_name": "过期测试",
    "applicant_email": "expired_http@test.com",
    "applicant_company": "过期团队",
    "api_scopes": "users:read",
    "validity_days": 7,
    "reason": "过期测试"
}
response = requests.post(f"{API_BASE}/api/demo/create-expired-credential", json=expired_data)
assert response.status_code == 200
expired_cred = response.json()
assert expired_cred["status"] == "expired"
print(f"   ✅ 过期凭证创建成功: status={expired_cred['status']}")
print()

print("12. 测试 GET /api/stats (统计接口)...")
response = requests.get(f"{API_BASE}/api/stats")
assert response.status_code == 200
stats = response.json()
assert "applications" in stats
assert "credentials" in stats
import json
print(f"   ✅ 统计接口正常: {json.dumps(stats, indent=2, ensure_ascii=False)}")
print()

print("=" * 60)
print("✅ 所有 HTTP API 集成测试通过！")
print("真实 HTTP 路由可正常使用：申请→审批→签发→访问→越权→撤销→审计")
print("完整验收链路已验证！")
print("=" * 60)
