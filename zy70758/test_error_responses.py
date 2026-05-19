#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app
from database import Base, engine, SessionLocal

Base.metadata.create_all(bind=engine)
client = TestClient(app)

TEST_EVENTS = """LAST SEEN   TYPE      REASON              OBJECT                                        MESSAGE
2m5s        Warning   FailedScheduling    pod/myapp-7f9d8c7546-2xqz8                   0/3 nodes are available: 3 Insufficient cpu.
118s        Warning   BackOff             pod/myapp-7f9d8c7546-2xqz8                   Back-off restarting failed container
"""

TEST_PODS = """NAME                     READY   STATUS             RESTARTS   AGE     IP            NODE
myapp-7f9d8c7546-2xqz8  0/1     CrashLoopBackOff   5          10m     10.244.0.123  node-01
"""

LOW_CONFIDENCE_EVENTS = """LAST SEEN   TYPE      REASON              OBJECT                                        MESSAGE
1m          Normal    Pulling             pod/myapp-xxx                                   Pulling image
"""

LOW_CONFIDENCE_PODS = """NAME                     READY   STATUS             RESTARTS   AGE     IP            NODE
myapp-xxx              1/1     Running            0          10m     10.244.0.123  node-01
"""


def test_missing_field_error():
    print("=" * 60)
    print("测试 1: MISSING_FIELD - 缺少必填字段")
    print("=" * 60)

    response = client.post(
        "/api/v1/releases",
        json={
            # 缺少 namespace 和 deployment_name
            "old_image": "nginx:v1"
        }
    )
    print(f"状态码: {response.status_code}")
    print(f"响应: {response.json()}")

    data = response.json()
    error_code = data.get("detail", {}).get("error_code")

    if error_code == "MISSING_FIELD":
        print("✅ PASS: 正确返回 MISSING_FIELD 错误码")
        return True
    else:
        print(f"❌ FAIL: 期望 MISSING_FIELD，实际 {error_code}")
        return False


def test_already_processed_error():
    print("\n" + "=" * 60)
    print("测试 2: ALREADY_PROCESSED - 已处理 release 重复调用")
    print("=" * 60)

    response = client.post(
        "/api/v1/releases",
        json={
            "namespace": "default",
            "deployment_name": "test-deployment",
            "events_output": TEST_EVENTS,
            "pods_output": TEST_PODS
        }
    )
    release_id = response.json()["id"]
    print(f"创建 release ID: {release_id}")

    response1 = client.post(f"/api/v1/releases/{release_id}/process")
    print(f"第一次 process 状态码: {response1.status_code}")

    response2 = client.post(f"/api/v1/releases/{release_id}/process")
    print(f"第二次 process 状态码: {response2.status_code}")
    print(f"响应: {response2.json()}")

    data = response2.json()
    error_code = data.get("detail", {}).get("error_code")

    if error_code == "ALREADY_PROCESSED":
        print("✅ PASS: 正确返回 ALREADY_PROCESSED 错误码")
        return True
    else:
        print(f"❌ FAIL: 期望 ALREADY_PROCESSED，实际 {error_code}")
        return False


def test_manual_review_required():
    print("\n" + "=" * 60)
    print("测试 3: MANUAL_REVIEW_REQUIRED - 低置信度需要人工复核")
    print("=" * 60)

    response = client.post(
        "/api/v1/releases",
        json={
            "namespace": "default",
            "deployment_name": "low-confidence-deployment",
            "events_output": LOW_CONFIDENCE_EVENTS,
            "pods_output": LOW_CONFIDENCE_PODS
        }
    )
    release_id = response.json()["id"]
    print(f"创建 release ID: {release_id}")

    response2 = client.post(f"/api/v1/releases/{release_id}/process")
    print(f"process 状态码: {response2.status_code}")
    print(f"响应: {response2.json()}")

    data = response2.json()
    error_code = data.get("detail", {}).get("error_code")

    if error_code == "MANUAL_REVIEW_REQUIRED":
        print("✅ PASS: 正确返回 MANUAL_REVIEW_REQUIRED 错误码")
        return True
    else:
        print(f"❌ FAIL: 期望 MANUAL_REVIEW_REQUIRED，实际 {error_code}")
        return False


def test_not_found_error():
    print("\n" + "=" * 60)
    print("测试 4: NOT_FOUND - release 不存在")
    print("=" * 60)

    response = client.post("/api/v1/releases/999999/process")
    print(f"状态码: {response.status_code}")
    print(f"响应: {response.json()}")

    data = response.json()
    error_code = data.get("detail", {}).get("error_code")

    if error_code == "NOT_FOUND":
        print("✅ PASS: 正确返回 NOT_FOUND 错误码")
        return True
    else:
        print(f"❌ FAIL: 期望 NOT_FOUND，实际 {error_code}")
        return False


def test_full_workflow_with_errors():
    print("\n" + "=" * 60)
    print("测试 5: 完整工作流程 - 所有错误响应可达")
    print("=" * 60)

    results = []
    results.append(("MISSING_FIELD", test_missing_field_error()))
    results.append(("ALREADY_PROCESSED", test_already_processed_error()))
    results.append(("MANUAL_REVIEW_REQUIRED", test_manual_review_required()))
    results.append(("NOT_FOUND", test_not_found_error()))

    print("\n" + "=" * 60)
    print("错误响应测试汇总")
    print("=" * 60)
    all_passed = True
    for name, passed in results:
        status = "✅" if passed else "❌"
        print(f"{status} {name}")
        if not passed:
            all_passed = False

    return all_passed


if __name__ == "__main__":
    success = test_full_workflow_with_errors()
    print("\n" + "=" * 60)
    if success:
        print("🎉 所有错误响应测试通过！")
        sys.exit(0)
    else:
        print("❌ 部分测试失败")
        sys.exit(1)
