#!/usr/bin/env python3
import requests

proxies = {"http": None, "https": None}
base = "http://localhost:8000"

print("=== 基础测试 ===")
print("Health:", requests.get(f"{base}/api/health", proxies=proxies).json())

print("\n=== 注册封路隐患 ===")
data = {"tree_number": "T001", "road_location": "测试路", "hazard_level": "emergency", "description": "封路测试"}
r = requests.post(f"{base}/api/hazards/register", json=data, proxies=proxies)
print("Register status:", r.status_code)
hid = r.json()["id"]
print("Hazard ID:", hid)

print("\n=== 测试关闭校验 ===")
r = requests.post(f"{base}/api/hazards/{hid}/close", json={"operator": "test"}, proxies=proxies)
print("Close without recheck:", r.status_code)
print("Detail:", r.json().get("detail"))

print("\n=== 测试withdraw ===")
r = requests.post(f"{base}/api/hazards/{hid}/withdraw", json={"operator": "test"}, proxies=proxies)
print("Withdraw:", r.status_code)
if r.status_code == 404:
    print("  Withdraw接口未实现，需要添加")

print("\n=== 测试resubmit ===")
r = requests.post(f"{base}/api/hazards/{hid}/resubmit", json={}, proxies=proxies)
print("Resubmit:", r.status_code)
if r.status_code == 404:
    print("  Resubmit接口未实现，需要添加")

print("\n=== 测试recheck_supplement ===")
r = requests.post(f"{base}/api/hazards/{hid}/recheck_supplement?conclusion=test", proxies=proxies)
print("Supplement:", r.status_code)
if r.status_code == 404:
    print("  Supplement接口未实现，需要添加")
