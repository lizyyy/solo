#!/usr/bin/env python3
import sys
sys.path.insert(0, ".")
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

print("=" * 70)
print("API 修复验证测试")
print("=" * 70)
print()

passed = 0
total = 5

print("[1/5] 测试：导入申诉CSV成功（5条记录）")
print("-" * 50)
try:
    with open("sample_data/claims.csv", "rb") as f:
        response = client.post("/api/import/claims/csv", files={"file": ("claims.csv", f, "text/csv")})
    
    if response.status_code == 200:
        result = response.json()
        imported = result.get("imported", 0)
        print(f"  状态码: {response.status_code} OK")
        print(f"  导入结果: {result}")
        
        if imported == 5:
            print("  PASS: 成功导入 5 条记录")
            passed += 1
        else:
            print(f"  FAIL: 导入记录数不符: 期望 5, 实际 {imported}")
    else:
        print(f"  FAIL: 请求失败: HTTP {response.status_code}")
        print(f"  错误信息: {response.text}")
except Exception as e:
    print(f"  FAIL: 异常: {str(e)}")
print()

print("[2/5] 测试：DataStore单例生效（导入后查询数据仍存在）")
print("-" * 50)
try:
    response = client.get("/api/statistics/claims")
    
    if response.status_code == 200:
        data = response.json()
        total_claims = data.get("total_claims", 0)
        print(f"  状态码: {response.status_code} OK")
        print(f"  查询结果: {total_claims} 条记录")
        
        if total_claims == 5:
            print("  PASS: 单例生效，数据持久化成功")
            passed += 1
        else:
            print(f"  FAIL: 数据不匹配: 期望 5, 实际 {total_claims}")
    else:
        print(f"  FAIL: 请求失败: HTTP {response.status_code}")
        print(f"  错误信息: {response.text}")
except Exception as e:
    print(f"  FAIL: 异常: {str(e)}")
print()

print("[3/5] 测试：导入航班JSON成功")
print("-" * 50)
try:
    with open("sample_data/flights.json", "rb") as f:
        response = client.post("/api/import/flights/json", files={"file": ("flights.json", f, "application/json")})
    
    if response.status_code == 200:
        result = response.json()
        imported = result.get("imported", 0)
        print(f"  状态码: {response.status_code} OK")
        print(f"  导入结果: {result}")
        
        if imported > 0:
            print(f"  PASS: 成功导入 {imported} 条航班记录")
            passed += 1
        else:
            print("  FAIL: 未导入任何航班记录")
    else:
        print(f"  FAIL: 请求失败: HTTP {response.status_code}")
        print(f"  错误信息: {response.text}")
except Exception as e:
    print(f"  FAIL: 异常: {str(e)}")
print()

print("[4/5] 测试：自动比对可以运行并返回结果")
print("-" * 50)
try:
    response = client.post("/api/compare/all")
    
    if response.status_code == 200:
        data = response.json()
        total_compared = data.get("total", 0)
        print(f"  状态码: {response.status_code} OK")
        print(f"  比对结果: 共 {total_compared} 条")
        
        if total_compared > 0:
            print("  PASS: 自动比对运行成功")
            passed += 1
        else:
            print("  FAIL: 没有比对结果")
    else:
        print(f"  FAIL: 请求失败: HTTP {response.status_code}")
        print(f"  错误信息: {response.text}")
except Exception as e:
    print(f"  FAIL: 异常: {str(e)}")
print()

print("[5/5] 测试：查询统计汇总有数据")
print("-" * 50)
try:
    response = client.get("/api/statistics/summary")
    
    if response.status_code == 200:
        data = response.json()
        print(f"  状态码: {response.status_code} OK")
        
        if data.get("success"):
            summary = data.get("summary", {})
            total_claims = summary.get("total_claims", 0) if isinstance(summary, dict) else 0
            print(f"  统计结果: {summary}")
            
            if total_claims > 0:
                print("  PASS: 统计汇总有数据")
                passed += 1
            else:
                print("  FAIL: 统计汇总数据为空")
        else:
            print("  FAIL: 接口返回 success=False")
            print(f"  完整响应: {data}")
    else:
        print(f"  FAIL: 请求失败: HTTP {response.status_code}")
        print(f"  错误信息: {response.text}")
except Exception as e:
    print(f"  FAIL: 异常: {str(e)}")
print()

print("=" * 70)
print(f"测试结果: {passed}/{total} 通过")
print("=" * 70)

if passed == total:
    print()
    print("所有测试通过！API 修复验证成功！")
    sys.exit(0)
else:
    print()
    print(f"有 {total - passed} 项测试未通过")
    sys.exit(1)
