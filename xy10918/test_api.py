#!/usr/bin/env python3
"""
农资赊销回款API - 轻量测试/自检脚本
覆盖：正常流程、重复请求幂等、脏数据、导出内容一致性
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import asyncio
import uuid
import json
import pandas as pd
from datetime import datetime
from httpx import AsyncClient

BASE_URL = "http://localhost:8000"


class Color:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'


def print_test(name, passed, details=""):
    color = Color.GREEN if passed else Color.RED
    status = "PASS" if passed else "FAIL"
    print(f"{color}[{status}]{Color.END} {name}")
    if details:
        print(f"       {details}")


async def test_normal_flow():
    """测试1: 正常业务流程"""
    print(f"\n{Color.BLUE}=== 测试1: 正常业务流程 ==={Color.END}")
    
    async with AsyncClient(base_url=BASE_URL, timeout=30) as client:
        try:
            await client.get("/")
        except:
            print(f"{Color.RED}错误: 请先启动API服务!{Color.END}")
            print("       运行: python -m uvicorn app.main:app --reload")
            return False
        
        all_passed = True
        
        # 1.1 创建客户
        customer_data = {
            "name": "测试客户",
            "phone": "13900139000",
            "address": "测试地址",
            "id_card": "320101198001010001",
            "remark": "测试用"
        }
        resp = await client.post("/api/customers", json=customer_data)
        if resp.status_code == 200:
            customer_id = resp.json()["data"]["customer"]["id"]
            print_test("1.1 创建客户", True, f"客户ID: {customer_id}")
        else:
            print_test("1.1 创建客户", False, f"状态码: {resp.status_code}")
            all_passed = False
            return all_passed
        
        # 1.2 创建赊销单
        idempotency_key = str(uuid.uuid4())
        order_data = {
            "customer_id": customer_id,
            "discount_amount": 20.0,
            "remark": "测试订单",
            "items": [
                {
                    "product_batch": "TEST001",
                    "product_name": "测试化肥",
                    "quantity": 10,
                    "unit_price": 50.0,
                    "unit": "袋",
                    "specification": "50kg/袋"
                },
                {
                    "product_batch": "TEST002",
                    "product_name": "测试农药",
                    "quantity": 5,
                    "unit_price": 30.0,
                    "unit": "瓶",
                    "specification": "1L/瓶"
                }
            ],
            "idempotency_key": idempotency_key
        }
        resp = await client.post("/api/credit-orders", json=order_data)
        if resp.status_code == 200:
            result = resp.json()
            order_id = result["data"]["order"]["id"]
            debt_amount = result["data"]["order"]["debt_amount"]
            expected_debt = (10 * 50 + 5 * 30) - 20
            if debt_amount == expected_debt:
                print_test("1.2 创建赊销单", True, f"订单ID: {order_id}, 欠款: {debt_amount}")
            else:
                print_test("1.2 创建赊销单", False, f"欠款计算错误: 期望{expected_debt}, 实际{debt_amount}")
                all_passed = False
        else:
            print_test("1.2 创建赊销单", False, f"状态码: {resp.status_code}")
            all_passed = False
            return all_passed
        
        # 1.3 退货处理
        return_data = {
            "order_id": order_id,
            "product_batch": "TEST001",
            "product_name": "测试化肥",
            "quantity": 2,
            "unit_price": 50.0,
            "reason": "质量问题"
        }
        resp = await client.post("/api/returns", json=return_data)
        if resp.status_code == 200:
            return_id = resp.json()["data"]["return"]["id"]
            print_test("1.3 创建退货记录", True, f"退货ID: {return_id}")
        else:
            print_test("1.3 创建退货记录", False, f"状态码: {resp.status_code}")
            all_passed = False
        
        # 验证退货后欠款
        resp = await client.get(f"/api/credit-orders/{order_id}")
        new_debt = resp.json()["data"]["order"]["debt_amount"]
        expected_after_return = expected_debt - 100
        if new_debt == expected_after_return:
            print_test("1.4 退货抵扣欠款", True, f"退货后欠款: {new_debt}")
        else:
            print_test("1.4 退货抵扣欠款", False, f"期望{expected_after_return}, 实际{new_debt}")
            all_passed = False
        
        # 1.5 分期回款
        payment_data = {
            "customer_id": customer_id,
            "order_id": order_id,
            "amount": 200.0,
            "payment_method": "现金"
        }
        resp = await client.post("/api/payments", json=payment_data)
        if resp.status_code == 200:
            payment_id = resp.json()["data"]["payment"]["id"]
            print_test("1.5 创建回款记录", True, f"回款ID: {payment_id}")
        else:
            print_test("1.5 创建回款记录", False, f"状态码: {resp.status_code}")
            all_passed = False
        
        # 验证回款后欠款
        resp = await client.get(f"/api/credit-orders/{order_id}")
        debt_after_payment = resp.json()["data"]["order"]["debt_amount"]
        expected_after_payment = expected_after_return - 200
        if debt_after_payment == expected_after_payment:
            print_test("1.6 回款抵扣欠款", True, f"回款后欠款: {debt_after_payment}")
        else:
            print_test("1.6 回款抵扣欠款", False, f"期望{expected_after_payment}, 实际{debt_after_payment}")
            all_passed = False
        
        # 1.7 生成报告
        report_req = {"customer_id": customer_id}
        resp = await client.post("/api/reports/generate", json=report_req)
        if resp.status_code == 200:
            report_id = resp.json()["data"]["report"]["id"]
            print_test("1.7 生成欠款报告", True, f"报告ID: {report_id}")
        else:
            print_test("1.7 生成欠款报告", False, f"状态码: {resp.status_code}")
            all_passed = False
            return all_passed
        
        # 1.8 导出报告
        resp = await client.post(f"/api/reports/{report_id}/export")
        if resp.status_code == 200:
            file_path = resp.json()["data"]["file_path"]
            print_test("1.8 导出Excel报告", True, f"文件: {file_path}")
        else:
            print_test("1.8 导出Excel报告", False, f"状态码: {resp.status_code}")
            all_passed = False
            return all_passed
        
        return all_passed


async def test_idempotency():
    """测试2: 重复请求幂等性"""
    print(f"\n{Color.BLUE}=== 测试2: 重复请求幂等性 ==={Color.END}")
    
    async with AsyncClient(base_url=BASE_URL, timeout=30) as client:
        all_passed = True
        
        # 先创建一个客户
        resp = await client.post("/api/customers", json={
            "name": "幂等测试客户",
            "phone": "13900139001"
        })
        customer_id = resp.json()["data"]["customer"]["id"]
        
        # 使用同一个idempotency_key重复创建赊销单
        idempotency_key = str(uuid.uuid4())
        order_data = {
            "customer_id": customer_id,
            "items": [
                {
                    "product_batch": "IDEMP001",
                    "product_name": "幂等测试商品",
                    "quantity": 1,
                    "unit_price": 100.0
                }
            ],
            "idempotency_key": idempotency_key
        }
        
        # 第一次请求
        resp1 = await client.post("/api/credit-orders", json=order_data)
        order1_id = resp1.json()["data"]["order"]["id"]
        created1 = resp1.json()["data"]["created"]
        
        # 第二次请求（重复）
        resp2 = await client.post("/api/credit-orders", json=order_data)
        order2_id = resp2.json()["data"]["order"]["id"]
        created2 = resp2.json()["data"]["created"]
        
        if order1_id == order2_id and created1 and not created2:
            print_test("2.1 赊销单幂等性", True, f"两次请求返回相同订单ID: {order1_id}")
        else:
            print_test("2.1 赊销单幂等性", False, f"订单ID不同或created标记错误")
            all_passed = False
        
        # 查询订单列表，应该只有一个
        resp = await client.get("/api/credit-orders", params={"customer_id": customer_id})
        order_count = len(resp.json()["data"]["orders"])
        if order_count == 1:
            print_test("2.2 数据库只有一条记录", True, f"订单数: {order_count}")
        else:
            print_test("2.2 数据库只有一条记录", False, f"期望1, 实际{order_count}")
            all_passed = False
        
        return all_passed


async def test_dirty_data():
    """测试3: 脏数据和异常处理"""
    print(f"\n{Color.BLUE}=== 测试3: 脏数据和异常处理 ==={Color.END}")
    
    async with AsyncClient(base_url=BASE_URL, timeout=30) as client:
        all_passed = True
        
        # 3.1 客户不存在
        order_data = {
            "customer_id": 99999,
            "items": [
                {
                    "product_batch": "TEST",
                    "product_name": "测试",
                    "quantity": 1,
                    "unit_price": 100.0
                }
            ]
        }
        resp = await client.post("/api/credit-orders", json=order_data)
        if resp.status_code == 400:
            print_test("3.1 客户不存在时返回错误", True, f"状态码: {resp.status_code}")
        else:
            print_test("3.1 客户不存在时返回错误", False, f"状态码: {resp.status_code}")
            all_passed = False
        
        # 3.2 商品批次不存在的退货
        resp = await client.post("/api/customers", json={"name": "异常测试客户"})
        customer_id = resp.json()["data"]["customer"]["id"]
        
        order_data = {
            "customer_id": customer_id,
            "items": [
                {"product_batch": "BATCH001", "product_name": "商品A", "quantity": 5, "unit_price": 10.0}
            ]
        }
        resp = await client.post("/api/credit-orders", json=order_data)
        order_id = resp.json()["data"]["order"]["id"]
        
        return_data = {
            "order_id": order_id,
            "product_batch": "NOT_EXIST",
            "product_name": "不存在商品",
            "quantity": 1,
            "unit_price": 10.0
        }
        resp = await client.post("/api/returns", json=return_data)
        if resp.status_code == 400:
            print_test("3.2 退货商品批次不存在返回错误", True, f"状态码: {resp.status_code}")
        else:
            print_test("3.2 退货商品批次不存在返回错误", False, f"状态码: {resp.status_code}")
            all_passed = False
        
        # 3.3 退货数量超过可退
        return_data = {
            "order_id": order_id,
            "product_batch": "BATCH001",
            "product_name": "商品A",
            "quantity": 10,
            "unit_price": 10.0
        }
        resp = await client.post("/api/returns", json=return_data)
        if resp.status_code == 400:
            print_test("3.3 退货数量超过可退返回错误", True, f"状态码: {resp.status_code}")
        else:
            print_test("3.3 退货数量超过可退返回错误", False, f"状态码: {resp.status_code}")
            all_passed = False
        
        # 3.4 验证异常日志已记录
        resp = await client.get("/api/exceptions")
        exceptions = resp.json()["data"]["exceptions"]
        if len(exceptions) > 0:
            print_test("3.4 异常请求已记录日志", True, f"异常记录数: {len(exceptions)}")
        else:
            print_test("3.4 异常请求已记录日志", False, "未找到异常记录")
            all_passed = False
        
        return all_passed


async def test_export_consistency():
    """测试4: 导出内容一致性"""
    print(f"\n{Color.BLUE}=== 测试4: 导出内容一致性 ==={Color.END}")
    
    async with AsyncClient(base_url=BASE_URL, timeout=30) as client:
        all_passed = True
        
        # 创建测试数据
        resp = await client.post("/api/customers", json={
            "name": "导出测试客户",
            "phone": "13900139999"
        })
        customer_id = resp.json()["data"]["customer"]["id"]
        
        order_data = {
            "customer_id": customer_id,
            "discount_amount": 10,
            "items": [
                {"product_batch": "EXPORT001", "product_name": "导出测试商品", "quantity": 10, "unit_price": 20.0}
            ]
        }
        resp = await client.post("/api/credit-orders", json=order_data)
        order_id = resp.json()["data"]["order"]["id"]
        order_no = resp.json()["data"]["order"]["order_no"]
        
        # 生成并导出报告
        resp = await client.post("/api/reports/generate", json={"customer_id": customer_id})
        report_id = resp.json()["data"]["report"]["id"]
        expected_total = resp.json()["data"]["report"]["total_debt"]
        expected_net = resp.json()["data"]["report"]["net_debt"]
        
        resp = await client.post(f"/api/reports/{report_id}/export")
        file_path = resp.json()["data"]["file_path"]
        
        # 读取Excel验证内容
        if os.path.exists(file_path):
            df_summary = pd.read_excel(file_path, sheet_name='报告摘要')
            excel_total = df_summary['应收总额'].iloc[0]
            excel_net = df_summary['欠款总额'].iloc[0]
            
            if excel_total == expected_total and excel_net == expected_net:
                print_test("4.1 Excel报告数据与API一致", True, 
                          f"应收总额: {excel_total}, 欠款总额: {excel_net}")
            else:
                print_test("4.1 Excel报告数据与API一致", False,
                          f"API期望(总额:{expected_total},欠款:{expected_net}), "
                          f"Excel实际(总额:{excel_total},欠款:{excel_net})")
                all_passed = False
            
            df_orders = pd.read_excel(file_path, sheet_name='欠款汇总')
            order_exists = any(df_orders['赊销单号'] == order_no)
            if order_exists:
                print_test("4.2 赊销单号存在于Excel", True, f"订单号: {order_no}")
            else:
                print_test("4.2 赊销单号存在于Excel", False, f"订单号{order_no}不存在")
                all_passed = False
            
            df_details = pd.read_excel(file_path, sheet_name='商品明细')
            batch_exists = any(df_details['商品批次'] == 'EXPORT001')
            if batch_exists:
                print_test("4.3 商品批次存在于明细", True, f"批次: EXPORT001")
            else:
                print_test("4.3 商品批次存在于明细", False, "商品批次不存在")
                all_passed = False
        else:
            print_test("4.x Excel文件不存在", False, f"路径: {file_path}")
            all_passed = False
        
        return all_passed


async def test_manual_correction():
    """测试5: 人工修正功能"""
    print(f"\n{Color.BLUE}=== 测试5: 人工修正功能 ==={Color.END}")
    
    async with AsyncClient(base_url=BASE_URL, timeout=30) as client:
        all_passed = True
        
        # 创建测试订单
        resp = await client.post("/api/customers", json={"name": "修正测试客户"})
        customer_id = resp.json()["data"]["customer"]["id"]
        
        order_data = {
            "customer_id": customer_id,
            "items": [
                {"product_batch": "CORRECT001", "product_name": "商品", "quantity": 1, "unit_price": 500.0}
            ]
        }
        resp = await client.post("/api/credit-orders", json=order_data)
        order_id = resp.json()["data"]["order"]["id"]
        original_debt = resp.json()["data"]["order"]["debt_amount"]
        
        # 人工修正
        correction_data = {
            "order_id": order_id,
            "new_debt_amount": 300.0,
            "correction_reason": "抹零优惠",
            "corrected_by": "管理员"
        }
        resp = await client.post("/api/corrections/manual", json=correction_data)
        if resp.status_code == 200:
            new_debt = resp.json()["data"]["order"]["debt_amount"]
            if new_debt == 300.0:
                print_test("5.1 人工修正欠款", True, f"{original_debt} -> {new_debt}")
            else:
                print_test("5.1 人工修正欠款", False, f"期望300, 实际{new_debt}")
                all_passed = False
        else:
            print_test("5.1 人工修正欠款", False, f"状态码: {resp.status_code}")
            all_passed = False
        
        return all_passed


async def main():
    """运行所有测试"""
    print(f"\n{Color.YELLOW}{'='*60}{Color.END}")
    print(f"{Color.YELLOW}       农资赊销回款API - 自检脚本{Color.END}")
    print(f"{Color.YELLOW}{'='*60}{Color.END}")
    
    # 先初始化样例数据
    print("\n正在初始化样例数据...")
    import init_sample_data
    init_sample_data.init_sample_data()
    
    results = []
    
    # 运行所有测试
    results.append(("正常业务流程", await test_normal_flow()))
    results.append(("幂等性测试", await test_idempotency()))
    results.append(("脏数据测试", await test_dirty_data()))
    results.append(("导出一致性测试", await test_export_consistency()))
    results.append(("人工修正功能", await test_manual_correction()))
    
    # 统计结果
    print(f"\n{Color.YELLOW}{'='*60}{Color.END}")
    print(f"{Color.YELLOW}              测试结果汇总{Color.END}")
    print(f"{Color.YELLOW}{'='*60}{Color.END}")
    
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    
    for name, passed in results:
        color = Color.GREEN if passed else Color.RED
        status = " 通过 " if passed else " 失败 "
        print(f"{color}[{status}]{Color.END} {name}")
    
    print(f"\n总计: {passed_count}/{total_count} 个测试通过")
    
    if passed_count == total_count:
        print(f"{Color.GREEN}✓ 所有测试通过!{Color.END}")
    else:
        print(f"{Color.RED}✗ 部分测试失败, 请检查!{Color.END}")
    
    print(f"\n{Color.YELLOW}{'='*60}{Color.END}")
    
    return passed_count == total_count


if __name__ == "__main__":
    import subprocess
    import time
    
    print("正在启动API服务...")
    server_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--port", "8000"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    time.sleep(3)
    
    try:
        success = asyncio.run(main())
        sys.exit(0 if success else 1)
    finally:
        server_proc.terminate()
        server_proc.wait()
