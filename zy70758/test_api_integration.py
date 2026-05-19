#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app
from database import Base, engine

client = TestClient(app)
Base.metadata.create_all(bind=engine)

TEST_EVENTS = """LAST SEEN   TYPE      REASON              OBJECT                                        MESSAGE
2m5s        Warning   FailedScheduling    pod/myapp-7f9d8c7546-2xqz8                   0/3 nodes are available: 3 Insufficient cpu.
118s        Warning   BackOff             pod/myapp-7f9d8c7546-2xqz8                   Back-off restarting failed container
115s        Normal    Pulling             pod/myapp-7f9d8c7546-2xqz8                   Pulling image "myregistry/myapp:v2.0"
110s        Warning   Failed              pod/myapp-7f9d8c7546-2xqz8                   Failed to pull image "myregistry/myapp:v2.0": rpc error: code = Unknown desc = Error response from daemon: manifest for myregistry/myapp:v2.0 not found: manifest unknown: manifest unknown
105s        Warning   Failed              pod/myapp-7f9d8c7546-2xqz8                   Error: ImagePullBackOff
95s         Normal    SandboxChanged      pod/myapp-7f9d8c7546-2xqz8                   Pod sandbox changed, it will be killed and re-created.
85s         Warning   Unhealthy           pod/myapp-7f9d8c7546-2xqz8                   Readiness probe failed: Get "http://10.244.0.123:8080/health": dial tcp 10.244.0.123:8080: connect: connection refused
75s         Warning   ProbeWarning        pod/myapp-7f9d8c7546-2xqz8                   Liveness probe warning: Readiness probe failed
"""

TEST_PODS = """NAME                     READY   STATUS             RESTARTS   AGE     IP            NODE
myapp-7f9d8c7546-2xqz8  0/1     ImagePullBackOff   5          10m     10.244.0.123  node-01
myapp-7f9d8c7546-abcde  0/1     CrashLoopBackOff   3          8m      10.244.0.124  node-02
myapp-6d7c987546-xyz12  1/1     Running            0          1h      10.244.0.120  node-01
"""


def test_full_api_flow():
    print("=" * 70)
    print("API 集成测试：完整发布失败分析闭环")
    print("=" * 70)
    print()

    passed = 0
    total = 0

    # 测试 1: 创建发布记录
    total += 1
    print(f"测试 {total}: 创建发布记录（传入 events_output 和 pods_output）")
    response = client.post(
        "/api/v1/releases",
        json={
            "namespace": "default",
            "deployment_name": "myapp",
            "old_image": "myregistry/myapp:v1.0",
            "new_image": "myregistry/myapp:v2.0",
            "events_output": TEST_EVENTS,
            "pods_output": TEST_PODS
        }
    )
    if response.status_code == 200:
        data = response.json()
        release_id = data.get("id")
        print(f"  ✅ 成功，发布 ID: {release_id}")
        passed += 1
    else:
        print(f"  ❌ 失败: {response.status_code} - {response.text}")
        return False
    print()

    # 测试 2: 获取发布详情
    total += 1
    print(f"测试 {total}: 获取发布详情")
    response = client.get(f"/api/v1/releases/{release_id}")
    if response.status_code == 200:
        data = response.json()
        events_count = data.get("events_count", 0)
        pods_count = data.get("pods_count", 0)
        print(f"  ✅ 成功，事件数: {events_count}, Pod数: {pods_count}")
        passed += 1
    else:
        print(f"  ❌ 失败: {response.status_code} - {response.text}")
    print()

    # 测试 3: 处理发布分析
    total += 1
    print(f"测试 {total}: 触发发布失败分析")
    response = client.post(f"/api/v1/releases/{release_id}/process")
    if response.status_code == 200:
        data = response.json()
        root_cause = data.get("root_cause")
        confidence = data.get("confidence")
        print(f"  ✅ 成功")
        print(f"    - 根因: {root_cause}")
        print(f"    - 置信度: {confidence}")
        print(f"    - 建议数: {len(data.get('suggested_actions', []))}")
        passed += 1
    else:
        print(f"  ❌ 失败: {response.status_code} - {response.text}")
    print()

    # 测试 4: 获取 Markdown 报告
    total += 1
    print(f"测试 {total}: 获取 Markdown 分析报告")
    response = client.get(f"/api/v1/releases/{release_id}/report")
    if response.status_code == 200:
        report = response.text
        print(f"  ✅ 成功，报告长度: {len(report)} 字符")
        checks = [
            ("包含基本信息", "K8s 发布失败时间线分析报告" in report),
            ("包含根因分析", root_cause in report),
            ("包含排查建议", "排查建议" in report),
            ("包含事件时间线", "事件时间线" in report),
        ]
        for check_name, check_result in checks:
            status = "✅" if check_result else "❌"
            print(f"    {status} {check_name}")
            if check_result:
                passed += 1
            total += 1
    else:
        print(f"  ❌ 失败: {response.status_code} - {response.text}")
    print()

    # 测试 5: 验证事件 MESSAGE 完整解析
    total += 1
    print(f"测试 {total}: 验证事件 MESSAGE 完整解析")
    response2 = client.post(
        "/api/v1/parse/kubectl",
        json={"events_output": TEST_EVENTS}
    )
    if response2.status_code == 200:
        data = response2.json()
        events = data.get("events", [])
        has_long_message = any(len(e.get("message", "")) > 30 for e in events)
        print(f"  ✅ 解析事件数: {len(events)}")
        print(f"  ✅ 包含完整长消息: {has_long_message}")
        if has_long_message:
            passed += 1
            for e in events[:3]:
                msg = e.get("message", "")
                if len(msg) > 30:
                    print(f"    - 完整消息示例: {msg[:60]}...")
    print()

    print("=" * 70)
    print(f"测试结果: {passed}/{total} 通过")
    print("=" * 70)

    success = passed == total
    if success:
        print("\n🎉 完整 API 闭环验证通过！")
    else:
        print("\n❌ 部分测试失败")

    return success


if __name__ == "__main__":
    success = test_full_api_flow()
    sys.exit(0 if success else 1)
