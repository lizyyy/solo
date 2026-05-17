#!/usr/bin/env python3
import sys
import time
import subprocess
import json
from httpx import Client

BASE_URL = "http://localhost:8000"


def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def print_success(message):
    print(f"✅ {message}")


def print_fail(message):
    print(f"❌ {message}")


def test_imports():
    print_section("1. 测试导入")
    try:
        from fastapi import FastAPI
        from sqlalchemy import create_engine
        import uvicorn
        print_success("FastAPI 导入成功")
        print_success("SQLAlchemy 导入成功")
        print_success("Uvicorn 导入成功")
        return True
    except ImportError as e:
        print_fail(f"导入失败: {e}")
        return False


def start_server():
    print_section("2. 启动服务器")
    try:
        proc = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        time.sleep(3)
        print_success("服务器启动中...")
        return proc
    except Exception as e:
        print_fail(f"启动服务器失败: {e}")
        return None


def test_health_check():
    print_section("3. 健康检查")
    try:
        with Client(base_url=BASE_URL) as client:
            response = client.get("/health")
            if response.status_code == 200:
                print_success("健康检查通过")
                return True
            else:
                print_fail(f"健康检查失败: {response.status_code}")
                return False
    except Exception as e:
        print_fail(f"健康检查异常: {e}")
        return False


def test_device_crud():
    print_section("4. 设备管理测试")
    results = []
    device_id = None
    serial = f"TEST{int(time.time())}"

    with Client(base_url=BASE_URL) as client:
        try:
            response = client.post("/api/device/", json={
                "serial_number": serial,
                "brand": "Apple",
                "model": "iPhone 14",
                "storage": "256GB",
                "color": "深空灰"
            })
            if response.status_code == 200:
                data = response.json()
                device_id = data["id"]
                print_success(f"创建设备成功, ID: {device_id}")
                results.append(True)
            else:
                print_fail(f"创建设备失败: {response.text}")
                results.append(False)
        except Exception as e:
            print_fail(f"创建设备异常: {e}")
            results.append(False)

        try:
            response = client.post("/api/device/", json={
                "serial_number": serial,
                "brand": "Apple",
                "model": "iPhone 14"
            })
            if response.status_code == 400:
                data = response.json()
                if data["detail"]["code"] == "duplicate_entry":
                    print_success("重复入库拦截成功")
                    results.append(True)
            else:
                print_fail("重复入库拦截失败")
                results.append(False)
        except Exception as e:
            print_fail(f"重复入库测试异常: {e}")
            results.append(False)

        try:
            response = client.get("/api/device/")
            if response.status_code == 200:
                data = response.json()
                print_success(f"设备列表查询成功, 共 {len(data)} 条")
                results.append(True)
            else:
                print_fail(f"设备列表查询失败")
                results.append(False)
        except Exception as e:
            print_fail(f"设备列表查询异常: {e}")
            results.append(False)

    return all(results), device_id


def test_inspection():
    print_section("5. 检测项评分测试")
    results = []
    item_id = None

    with Client(base_url=BASE_URL) as client:
        try:
            response = client.post("/api/inspection/items", json={
                "name": "屏幕外观",
                "category": "外观检测",
                "max_score": 10.0,
                "weight": 1.5
            })
            if response.status_code == 200:
                data = response.json()
                item_id = data["id"]
                print_success(f"创建检测项成功, ID: {item_id}")
                results.append(True)
            else:
                print_fail(f"创建检测项失败: {response.text}")
                results.append(False)
        except Exception as e:
            print_fail(f"创建检测项异常: {e}")
            results.append(False)

        try:
            response = client.post("/api/inspection/items", json={
                "name": "电池健康",
                "category": "功能检测",
                "max_score": 10.0,
                "weight": 2.0
            })
            if response.status_code == 200:
                print_success("创建电池检测项成功")
                results.append(True)
            else:
                results.append(False)
        except Exception as e:
            print_fail(f"创建电池检测项异常: {e}")
            results.append(False)

    return all(results), item_id


def test_quote_and_deduction(device_id):
    print_section("6. 报价与扣减测试")
    results = []
    quote_id = None
    reason_id = None

    with Client(base_url=BASE_URL) as client:
        try:
            response = client.post("/api/quote/reasons", json={
                "code": "SCREEN_DAMAGE",
                "name": "屏幕破损",
                "category": "外观损坏",
                "default_amount": 200.0
            })
            if response.status_code == 200:
                data = response.json()
                reason_id = data["id"]
                print_success(f"创建扣减原因成功, ID: {reason_id}")
                results.append(True)
            else:
                print_fail(f"创建扣减原因失败: {response.text}")
                results.append(False)
        except Exception as e:
            print_fail(f"创建扣减原因异常: {e}")
            results.append(False)

        try:
            response = client.post("/api/quote/", json={
                "device_id": device_id,
                "base_price": 3000.0,
                "notes": "初步报价"
            })
            if response.status_code == 200:
                data = response.json()
                quote_id = data["id"]
                print_success(f"创建报价成功, ID: {quote_id}")
                results.append(True)
            else:
                print_fail(f"创建报价失败: {response.text}")
                results.append(False)
        except Exception as e:
            print_fail(f"创建报价异常: {e}")
            results.append(False)

        try:
            response = client.post("/api/quote/deductions", json={
                "quote_id": quote_id,
                "reason_id": reason_id,
                "amount": 200.0,
                "description": "屏幕有明显划痕",
                "recorded_by": "检测员A"
            })
            if response.status_code == 200:
                print_success("添加扣减成功")
                results.append(True)
            else:
                print_fail(f"添加扣减失败: {response.text}")
                results.append(False)
        except Exception as e:
            print_fail(f"添加扣减异常: {e}")
            results.append(False)

        try:
            response = client.post(f"/api/quote/{quote_id}/freeze", json={
                "frozen_by": "管理员"
            })
            if response.status_code == 200:
                data = response.json()
                if data["is_frozen"]:
                    print_success("报价冻结成功")
                    results.append(True)
                else:
                    print_fail("报价未冻结")
                    results.append(False)
            else:
                print_fail(f"报价冻结失败: {response.text}")
                results.append(False)
        except Exception as e:
            print_fail(f"报价冻结异常: {e}")
            results.append(False)

        try:
            response = client.post("/api/quote/deductions", json={
                "quote_id": quote_id,
                "reason_id": reason_id,
                "amount": 100.0,
                "description": "测试冻结后扣减"
            })
            if response.status_code == 400:
                data = response.json()
                if data["detail"]["code"] == "invalid_status":
                    print_success("冻结后扣减拦截成功")
                    results.append(True)
            else:
                print_fail("冻结后扣减拦截失败")
                results.append(False)
        except Exception as e:
            print_fail(f"冻结后扣减测试异常: {e}")
            results.append(False)

    return all(results), quote_id


def test_review(device_id, quote_id):
    print_section("7. 复核状态机测试")
    results = []
    review_id = None

    with Client(base_url=BASE_URL) as client:
        try:
            response = client.post("/api/review/", json={
                "device_id": device_id,
                "quote_id": quote_id
            })
            if response.status_code == 200:
                data = response.json()
                review_id = data["id"]
                print_success(f"创建复核记录成功, ID: {review_id}")
                results.append(True)
            else:
                print_fail(f"创建复核记录失败: {response.text}")
                results.append(False)
        except Exception as e:
            print_fail(f"创建复核记录异常: {e}")
            results.append(False)

        try:
            response = client.patch(f"/api/review/{review_id}", json={
                "status": "in_progress",
                "reviewer": "复核员A",
                "review_notes": "开始复核"
            })
            if response.status_code == 200:
                data = response.json()
                if data["status"] == "in_progress":
                    print_success("状态流转: pending -> in_progress")
                    results.append(True)
                else:
                    print_fail("状态流转失败")
                    results.append(False)
            else:
                print_fail(f"状态更新失败: {response.text}")
                results.append(False)
        except Exception as e:
            print_fail(f"状态更新异常: {e}")
            results.append(False)

        try:
            response = client.patch(f"/api/review/{review_id}", json={
                "status": "needs_manual",
                "review_notes": "需要人工复核"
            })
            if response.status_code == 200:
                data = response.json()
                if data["status"] == "needs_manual":
                    print_success("状态流转: in_progress -> needs_manual")
                    results.append(True)
                else:
                    results.append(False)
            else:
                print_fail(f"needs_manual 状态失败: {response.text}")
                results.append(False)
        except Exception as e:
            print_fail(f"needs_manual 状态异常: {e}")
            results.append(False)

        try:
            response = client.patch(f"/api/review/{review_id}", json={
                "status": "approved",
                "resolution": "复核通过",
                "review_notes": "检测数据完整，报价合理"
            })
            if response.status_code == 200:
                data = response.json()
                if data["status"] == "approved":
                    print_success("状态流转: needs_manual -> approved")
                    results.append(True)
                else:
                    results.append(False)
            else:
                print_fail(f"approved 状态失败: {response.text}")
                results.append(False)
        except Exception as e:
            print_fail(f"approved 状态异常: {e}")
            results.append(False)

        try:
            response = client.patch(f"/api/review/{review_id}", json={
                "status": "rejected"
            })
            if response.status_code == 400:
                data = response.json()
                if data["detail"]["code"] == "already_processed":
                    print_success("已完成状态修改拦截成功")
                    results.append(True)
            else:
                print_fail("已完成状态修改拦截失败")
                results.append(False)
        except Exception as e:
            print_fail(f"已完成状态修改测试异常: {e}")
            results.append(False)

    return all(results)


def test_inspection_scoring(device_id, item_id):
    print_section("8. 检测评分测试")
    results = []

    with Client(base_url=BASE_URL) as client:
        try:
            response = client.post("/api/inspection/score", json={
                "device_id": device_id,
                "item_id": item_id,
                "score": 8.5,
                "inspector": "检测员A",
                "notes": "屏幕有轻微划痕，不影响使用"
            })
            if response.status_code == 200:
                data = response.json()
                print_success(f"评分成功, 得分: {data['score']}")
                results.append(True)
            else:
                print_fail(f"评分失败: {response.text}")
                results.append(False)
        except Exception as e:
            print_fail(f"评分异常: {e}")
            results.append(False)

        try:
            response = client.get(f"/api/inspection/device/{device_id}")
            if response.status_code == 200:
                data = response.json()
                print_success(f"设备检测记录查询成功, 共 {len(data)} 条")
                results.append(True)
            else:
                results.append(False)
        except Exception as e:
            print_fail(f"检测记录查询异常: {e}")
            results.append(False)

    return all(results)


def test_report(device_id):
    print_section("9. 质检报告测试")
    results = []
    report_id = None

    with Client(base_url=BASE_URL) as client:
        try:
            response = client.post("/api/report/generate", json={
                "device_id": device_id,
                "generated_by": "系统自动"
            })
            if response.status_code == 200:
                data = response.json()
                report_id = data["id"]
                print_success(f"生成质检报告成功, 报告号: {data['report_number']}")
                print_success(f"总分: {data['total_score']:.2f}")
                results.append(True)
            else:
                print_fail(f"生成报告失败: {response.text}")
                results.append(False)
        except Exception as e:
            print_fail(f"生成报告异常: {e}")
            results.append(False)

        try:
            response = client.get(f"/api/report/export/{report_id}")
            if response.status_code == 200:
                data = response.json()
                print_success(f"导出报告成功, 导出时间: {data['exported_at']}")
                results.append(True)
            else:
                print_fail(f"导出报告失败: {response.text}")
                results.append(False)
        except Exception as e:
            print_fail(f"导出报告异常: {e}")
            results.append(False)

        try:
            response = client.get("/api/report/")
            if response.status_code == 200:
                data = response.json()
                print_success(f"报告列表查询成功, 共 {len(data)} 条")
                results.append(True)
            else:
                results.append(False)
        except Exception as e:
            print_fail(f"报告列表查询异常: {e}")
            results.append(False)

    return all(results)


def main():
    print("\n" + "="*60)
    print("    设备质检报价冻结复核扣减系统 - 自检脚本")
    print("="*60)

    all_passed = True

    if not test_imports():
        all_passed = False

    proc = start_server()
    if not proc:
        print_fail("无法启动服务器，测试终止")
        return 1

    if not test_health_check():
        all_passed = False

    devices_ok, device_id = test_device_crud()
    if not devices_ok:
        all_passed = False

    inspection_ok, item_id = test_inspection()
    if not inspection_ok:
        all_passed = False

    if not test_inspection_scoring(device_id, item_id):
        all_passed = False

    quote_ok, quote_id = test_quote_and_deduction(device_id)
    if not quote_ok:
        all_passed = False

    if not test_review(device_id, quote_id):
        all_passed = False

    if not test_report(device_id):
        all_passed = False

    print_section("测试总结")
    if all_passed:
        print("🎉 所有测试通过！系统运行正常。")
    else:
        print("⚠️  部分测试失败，请检查错误信息。")

    print("\n正在关闭服务器...")
    proc.terminate()
    proc.wait()

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
