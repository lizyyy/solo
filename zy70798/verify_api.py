#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app
from database import Base, get_db

SQLALCHEMY_DATABASE_URL = "sqlite:///./verify_api.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

print("=" * 60)
print("验证 API 端点错误响应")
print("=" * 60)

print("\n✓ 测试健康检查:")
response = client.get("/health")
print(f"  状态码: {response.status_code}")
assert response.status_code == 200

print("\n✓ 测试 MISSING_FIELD 错误码 (缺少必填字段):")
response = client.post(
    "/api/quarantined-tests/",
    json={"test_name": "test_missing"}
)
print(f"  状态码: {response.status_code}")
print(f"  错误码: {response.json().get('error_code')}")
print(f"  详情: {response.json().get('details')}")
assert response.status_code == 400
assert response.json()['error_code'] == "MISSING_FIELD"
assert 'missing_fields' in response.json()['details']

print("\n✓ 测试 VALIDATION_ERROR 错误码 (日期校验失败):")
response = client.post(
    "/api/quarantined-tests/",
    json={
        "test_name": "test_invalid",
        "test_path": "tests/test.py::test_invalid",
        "quarantine_reason": "超时",
        "owner": "李四",
        "quarantine_date": datetime.utcnow().isoformat(),
        "expiry_date": (datetime.utcnow() - timedelta(days=1)).isoformat()
    }
)
print(f"  状态码: {response.status_code}")
print(f"  错误码: {response.json().get('error_code')}")
assert response.status_code == 400
assert response.json()['error_code'] == "VALIDATION_ERROR"

print("\n✓ 创建测试记录:")
response = client.post(
    "/api/quarantined-tests/",
    json={
        "test_name": "test_flaky",
        "test_path": "tests/test_flaky.py::test_flaky",
        "quarantine_reason": "不稳定",
        "owner": "张三",
        "quarantine_date": datetime.utcnow().isoformat(),
        "expiry_date": (datetime.utcnow() + timedelta(days=7)).isoformat()
    }
)
test_id = response.json()['id']
print(f"  测试 ID: {test_id}")
print(f"  状态: {response.json()['status']}")
assert response.status_code == 201

print("\n✓ 连续通过 3 次进入 READY_FOR_CLEANUP 状态:")
for _ in range(3):
    client.post(
        f"/api/quarantined-tests/{test_id}/result",
        json={"result": "PASS", "run_date": datetime.utcnow().isoformat()}
    )
response = client.get(f"/api/quarantined-tests/{test_id}")
print(f"  状态: {response.json()['status']}")
assert response.json()['status'] == "ready_for_cleanup"

print("\n✓ 测试失败后进入 REQUIRES_MANUAL_REVIEW 状态:")
client.post(
    f"/api/quarantined-tests/{test_id}/result",
    json={"result": "FAIL", "run_date": datetime.utcnow().isoformat()}
)
response = client.get(f"/api/quarantined-tests/{test_id}")
print(f"  状态: {response.json()['status']}")
assert response.json()['status'] == "requires_manual_review"

print("\n✓ 测试 REQUIRES_MANUAL_REVIEW 错误码 (尝试清理需要人工复核的测试):")
response = client.post(f"/api/quarantined-tests/{test_id}/mark-cleaned")
print(f"  状态码: {response.status_code}")
print(f"  错误码: {response.json()['error_code']}")
assert response.status_code == 400
assert response.json()['error_code'] == "REQUIRES_MANUAL_REVIEW"

print("\n✓ 测试 INVALID_STATUS 错误码 (尝试清理 active 状态的测试):")
response2 = client.post(
    "/api/quarantined-tests/",
    json={
        "test_name": "test_active",
        "test_path": "tests/test_active.py::test_active",
        "quarantine_reason": "不稳定",
        "owner": "李四",
        "quarantine_date": datetime.utcnow().isoformat(),
        "expiry_date": (datetime.utcnow() + timedelta(days=7)).isoformat()
    }
)
test_id2 = response2.json()['id']
response = client.post(f"/api/quarantined-tests/{test_id2}/mark-cleaned")
print(f"  状态码: {response.status_code}")
print(f"  错误码: {response.json()['error_code']}")
assert response.status_code == 400
assert response.json()['error_code'] == "INVALID_STATUS"

print("\n✓ 测试 ALREADY_PROCESSED 错误码 (重复清理):")
response3 = client.post(
    "/api/quarantined-tests/",
    json={
        "test_name": "test_clean",
        "test_path": "tests/test_clean.py::test_clean",
        "quarantine_reason": "不稳定",
        "owner": "王五",
        "quarantine_date": datetime.utcnow().isoformat(),
        "expiry_date": (datetime.utcnow() + timedelta(days=7)).isoformat()
    }
)
test_id3 = response3.json()['id']
for _ in range(3):
    client.post(
        f"/api/quarantined-tests/{test_id3}/result",
        json={"result": "PASS", "run_date": datetime.utcnow().isoformat()}
    )
client.post(f"/api/quarantined-tests/{test_id3}/mark-cleaned")
response = client.post(f"/api/quarantined-tests/{test_id3}/mark-cleaned")
print(f"  状态码: {response.status_code}")
print(f"  错误码: {response.json()['error_code']}")
assert response.status_code == 400
assert response.json()['error_code'] == "ALREADY_PROCESSED"

print("\n✓ 测试 NOT_FOUND 错误码:")
response = client.get("/api/quarantined-tests/99999")
print(f"  状态码: {response.status_code}")
print(f"  错误码: {response.json()['detail']['error_code']}")
assert response.status_code == 404
assert response.json()['detail']['error_code'] == "NOT_FOUND"

print("\n" + "=" * 60)
print("✅ 所有 API 端点验证通过！")
print("=" * 60)

if os.path.exists("./verify_api.db"):
    os.remove("./verify_api.db")
