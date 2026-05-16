#!/usr/bin/env python3
import sys
import subprocess
import time
import requests
from datetime import datetime, timedelta

def run_command(cmd, description):
    print(f"\n{'='*60}")
    print(f"检查: {description}")
    print(f"命令: {cmd}")
    print('-'*60)
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=60)
        print(f"返回码: {result.returncode}")
        if result.stdout:
            print("标准输出:")
            print(result.stdout[:500])
        if result.stderr:
            print("标准错误:")
            print(result.stderr[:500])
        return result.returncode == 0
    except Exception as e:
        print(f"执行失败: {e}")
        return False

def check_python_version():
    return run_command("python3 --version", "Python 版本")

def check_dependencies():
    return run_command("pip show fastapi uvicorn sqlalchemy pydantic", "依赖包安装情况")

def test_unit_tests():
    print("\n" + "="*60)
    print("检查: 运行单元测试")
    print('-'*60)
    
    cmd = f"{sys.executable} -m pytest tests/test_api.py -v --tb=short"
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=120)
        print(f"返回码: {result.returncode}")
        if result.stdout:
            print("测试输出:")
            print(result.stdout)
        if result.stderr:
            print("错误输出:")
            print(result.stderr[-1000:] if len(result.stderr) > 1000 else result.stderr)
        
        passed = result.returncode == 0
        print(f"\n单元测试 {'通过' if passed else '失败'}!")
        return passed
    except Exception as e:
        print(f"执行失败: {e}")
        return False

def test_api_endpoints():
    print("\n" + "="*60)
    print("检查: API 端点功能测试")
    print('-'*60)
    
    base_url = "http://127.0.0.1:8000"
    
    proc = None
    try:
        proc = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        print("启动 API 服务器...")
        time.sleep(5)
        
        tests = []
        
        try:
            response = requests.get(f"{base_url}/", timeout=5)
            print(f"[GET /] 状态码: {response.status_code}")
            tests.append(("根路径", response.status_code == 200))
        except Exception as e:
            print(f"[GET /] 失败: {e}")
            tests.append(("根路径", False))
        
        window_start = datetime.utcnow() - timedelta(hours=6)
        window_end = datetime.utcnow() - timedelta(hours=4)
        
        incident_payload = {
            "tenant": {
                "tenant_id": "self_check_tenant",
                "name": "自检租户",
                "email": "check@example.com"
            },
            "metric_name": "api_requests",
            "unit": "requests",
            "window_start": window_start.isoformat(),
            "window_end": window_end.isoformat(),
            "threshold_percent": 50.0,
            "title": "自检异常事故",
            "description": "自检用的异常事故记录"
        }
        
        try:
            response = requests.post(f"{base_url}/api/incidents", json=incident_payload, timeout=10)
            print(f"[POST /api/incidents] 状态码: {response.status_code}")
            tests.append(("创建事故", response.status_code == 201))
            
            if response.status_code == 201:
                incident_id = response.json()["id"]
                
                try:
                    response = requests.get(f"{base_url}/api/incidents/{incident_id}", timeout=5)
                    print(f"[GET /api/incidents/{{id}}] 状态码: {response.status_code}")
                    tests.append(("查询事故", response.status_code == 200))
                except Exception as e:
                    print(f"[GET /api/incidents/{{id}}] 失败: {e}")
                    tests.append(("查询事故", False))
                
                try:
                    status_payload = {"status": "confirmed", "comment": "自检确认"}
                    response = requests.patch(f"{base_url}/api/incidents/{incident_id}/status", json=status_payload, timeout=5)
                    print(f"[PATCH /api/incidents/{{id}}/status] 状态码: {response.status_code}")
                    tests.append(("更新状态", response.status_code == 200))
                except Exception as e:
                    print(f"[PATCH /api/incidents/{{id}}/status] 失败: {e}")
                    tests.append(("更新状态", False))
                
                try:
                    clue_payload = {
                        "clue_key": "self_check_clue",
                        "source": "manual",
                        "title": "自检线索",
                        "description": "自检添加的归因线索",
                        "confidence": 0.9,
                        "is_manual": True
                    }
                    response = requests.post(f"{base_url}/api/incidents/{incident_id}/clues", json=clue_payload, timeout=5)
                    print(f"[POST /api/incidents/{{id}}/clues] 状态码: {response.status_code}")
                    tests.append(("添加线索", response.status_code == 200))
                except Exception as e:
                    print(f"[POST /api/incidents/{{id}}/clues] 失败: {e}")
                    tests.append(("添加线索", False))
                
                try:
                    correction_payload = {
                        "severity": "high",
                        "comment": "人工调整严重程度",
                        "reclaculate": False
                    }
                    response = requests.post(f"{base_url}/api/incidents/{incident_id}/correct", json=correction_payload, timeout=5)
                    print(f"[POST /api/incidents/{{id}}/correct] 状态码: {response.status_code}")
                    tests.append(("人工修正", response.status_code == 200))
                except Exception as e:
                    print(f"[POST /api/incidents/{{id}}/correct] 失败: {e}")
                    tests.append(("人工修正", False))
                
                try:
                    response = requests.get(f"{base_url}/api/incidents/{incident_id}/export", timeout=5)
                    print(f"[GET /api/incidents/{{id}}/export] 状态码: {response.status_code}")
                    tests.append(("导出事故", response.status_code == 200))
                except Exception as e:
                    print(f"[GET /api/incidents/{{id}}/export] 失败: {e}")
                    tests.append(("导出事故", False))
        
        except Exception as e:
            print(f"[POST /api/incidents] 失败: {e}")
            tests.append(("创建事故", False))
        
        print("\n" + "-"*60)
        print("测试结果汇总:")
        for test_name, passed in tests:
            status = "✓ 通过" if passed else "✗ 失败"
            print(f"  {status}: {test_name}")
        
        all_passed = all(passed for _, passed in tests)
        print(f"\nAPI 端点测试 {'全部通过' if all_passed else '存在失败'}!")
        return all_passed
        
    finally:
        if proc:
            proc.terminate()
            proc.wait(timeout=5)

def main():
    print("\n" + "="*60)
    print("用量异常事故 API - 系统自检")
    print("="*60)
    
    results = []
    
    results.append(("Python 版本", check_python_version()))
    results.append(("依赖包", check_dependencies()))
    results.append(("单元测试", test_unit_tests()))
    results.append(("API 端点测试", test_api_endpoints()))
    
    print("\n" + "="*60)
    print("自检结果汇总")
    print("="*60)
    
    all_passed = True
    for check_name, passed in results:
        status = "✓ 通过" if passed else "✗ 失败"
        print(f"{status}: {check_name}")
        if not passed:
            all_passed = False
    
    print("\n" + "="*60)
    if all_passed:
        print("✓ 所有检查通过！系统运行正常。")
    else:
        print("✗ 部分检查失败，请检查错误信息。")
    print("="*60 + "\n")
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())
