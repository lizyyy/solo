#!/usr/bin/env python3
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

print("\n" + "="*60)
print("验证 FastAPI 错误响应格式")
print("="*60 + "\n")

print("测试 1: 缺少必填字段的错误响应")
print("-" * 60)
response = client.post("/api/v1/rules", json={})
print(f"状态码: {response.status_code}")
print(f"响应: {response.json()}")
assert response.status_code == 400
assert response.json()["error_code"] == "missing_field"
print("[✓ PASS] missing_field 错误码正确返回\n")

print("测试 2: 验证错误响应格式")
print("-" * 60)
response = client.post("/api/v1/directories", json={"name": "test"})
print(f"状态码: {response.status_code}")
print(f"响应: {response.json()}")
assert response.status_code == 400
assert response.json()["error_code"] == "missing_field"
print("[✓ PASS] FastAPI 422 验证错误已正确转换为 missing_field\n")

print("="*60)
print("所有 FastAPI 错误响应测试通过!")
print("="*60)
