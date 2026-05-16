#!/usr/bin/env python3
import subprocess
import time
import requests
import sys

def run_command(cmd, timeout=30):
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "Timeout"

def main():
    print("=" * 60)
    print("OpenAPI变更裁决API - 快速自检")
    print("=" * 60)

    print("\n[1/5] 检查Python环境...")
    code, out, err = run_command("python --version || python3 --version")
    if code == 0:
        print(f"  ✓ Python版本: {out.strip() or err.strip()}")
    else:
        print("  ✗ Python未找到")
        return 1

    print("\n[2/5] 安装依赖包...")
    code, out, err = run_command("pip install -r requirements.txt -q")
    if code == 0:
        print("  ✓ 依赖安装完成")
    else:
        print(f"  ⚠ 依赖安装可能有问题: {err[:100]}")

    print("\n[3/5] 启动服务...")
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8001"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    time.sleep(3)

    try:
        print("\n[4/5] 测试API接口...")

        print("  - 健康检查...", end=" ")
        try:
            resp = requests.get("http://127.0.0.1:8001/health", timeout=5)
            if resp.status_code == 200 and resp.json().get("status") == "healthy":
                print("✓")
            else:
                print("✗")
        except Exception as e:
            print(f"✗ ({e})")

        print("  - 创建契约变更（文档变更）...", end=" ")
        try:
            payload = {
                "api_path": "/api/v1/test",
                "http_method": "GET",
                "old_contract": {"info": {"title": "旧文档"}},
                "new_contract": {"info": {"title": "新文档"}},
                "caller": "test_service"
            }
            resp = requests.post("http://127.0.0.1:8001/api/v1/changes/", json=payload, timeout=5)
            if resp.status_code == 201:
                data = resp.json()
                print(f"✓ (ID={data['id']}, 风险={data['risk_level']}, 分类={data['change_category']})")
                change_id = data['id']
            else:
                print(f"✗ (状态码={resp.status_code})")
                change_id = None
        except Exception as e:
            print(f"✗ ({e})")
            change_id = None

        print("  - 查询变更列表...", end=" ")
        try:
            resp = requests.get("http://127.0.0.1:8001/api/v1/changes/", timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                print(f"✓ (共{data['total']}条)")
            else:
                print(f"✗ (状态码={resp.status_code})")
        except Exception as e:
            print(f"✗ ({e})")

        if change_id:
            print("  - 人工修正...", end=" ")
            try:
                payload = {
                    "risk_level": "high",
                    "corrected_by": "tester",
                    "reason": "测试修正"
                }
                resp = requests.patch(f"http://127.0.0.1:8001/api/v1/changes/{change_id}/correct", json=payload, timeout=5)
                if resp.status_code == 200:
                    data = resp.json()
                    print(f"✓ (新风险等级={data['risk_level']})")
                else:
                    print(f"✗ (状态码={resp.status_code})")
            except Exception as e:
                print(f"✗ ({e})")

            print("  - 生成报告...", end=" ")
            try:
                resp = requests.post(f"http://127.0.0.1:8001/api/v1/changes/{change_id}/report", timeout=5)
                if resp.status_code == 200:
                    print("✓")
                else:
                    print(f"✗ (状态码={resp.status_code})")
            except Exception as e:
                print(f"✗ ({e})")

        print("  - 导出数据...", end=" ")
        try:
            resp = requests.get("http://127.0.0.1:8001/api/v1/export/", timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                print(f"✓ (共{data['total_count']}条记录)")
            else:
                print(f"✗ (状态码={resp.status_code})")
        except Exception as e:
            print(f"✗ ({e})")

        print("\n[5/5] 运行pytest测试...")
        print("  运行完整测试套件...")
        code, out, err = run_command(f"{sys.executable} -m pytest tests/test_api.py -v --tb=short", timeout=60)
        if code == 0:
            print("  ✓ 所有测试通过")
        else:
            print(f"  ⚠ 部分测试失败")
            print(f"\n  测试输出摘要:\n{out[-500:] if len(out) > 500 else out}")

    finally:
        print("\n停止服务...")
        proc.terminate()
        proc.wait(timeout=5)

    print("\n" + "=" * 60)
    print("自检完成！")
    print("=" * 60)
    print("\n启动服务命令:")
    print("  python -m uvicorn app.main:app --reload")
    print("\n访问API文档:")
    print("  http://127.0.0.1:8000/docs")
    print("\n运行测试:")
    print("  pytest tests/test_api.py -v")
    return 0

if __name__ == "__main__":
    exit(main())
