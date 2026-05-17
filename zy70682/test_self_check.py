import httpx
import json
import os
from datetime import date, datetime

BASE_URL = "http://localhost:8000"

def print_step(step_num, title):
    print(f"\n{'='*60}")
    print(f"步骤 {step_num}: {title}")
    print('='*60)

def print_success(message):
    print(f"✅ {message}")

def print_error(message):
    print(f"❌ {message}")

def print_info(message):
    print(f"ℹ️  {message}")

async def test_lease_import():
    print_step(1, "导入租约数据")
    
    lease_data = {
        "id": "LEASE-001",
        "tenant_name": "张三",
        "tenant_phone": "13800138000",
        "apartment_number": "A-1203",
        "lease_start_date": "2023-01-01",
        "lease_end_date": "2024-01-01",
        "monthly_rent": 5000.0
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(f"{BASE_URL}/leases/", json=lease_data)
            if response.status_code == 201:
                print_success(f"租约 {lease_data['id']} 导入成功")
                return True
            elif response.status_code == 409:
                print_info(f"租约 {lease_data['id']} 已存在，跳过")
                return True
            else:
                print_error(f"租约导入失败: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print_error(f"租约导入异常: {e}")
            return False

async def test_deposit_import():
    print_step(2, "导入押金数据")
    
    deposit_data = {
        "id": "DEPOSIT-001",
        "lease_id": "LEASE-001",
        "amount": 10000.0,
        "currency": "CNY",
        "received_date": "2023-01-01"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(f"{BASE_URL}/deposits/", json=deposit_data)
            if response.status_code == 201:
                print_success(f"押金 {deposit_data['id']} 导入成功")
                return True
            elif response.status_code == 409:
                print_info(f"押金 {deposit_data['id']} 已存在，跳过")
                return True
            else:
                print_error(f"押金导入失败: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print_error(f"押金导入异常: {e}")
            return False

async def test_utility_bill_import():
    print_step(3, "导入水电账单数据")
    
    bills = [
        {
            "id": "BILL-W-001",
            "lease_id": "LEASE-001",
            "bill_type": "water",
            "billing_period_start": "2023-12-01",
            "billing_period_end": "2023-12-31",
            "usage_amount": 50,
            "unit_price": 5.0,
            "total_amount": 250.0,
            "payment_status": "unpaid"
        },
        {
            "id": "BILL-E-001",
            "lease_id": "LEASE-001",
            "bill_type": "electricity",
            "billing_period_start": "2023-12-01",
            "billing_period_end": "2023-12-31",
            "usage_amount": 300,
            "unit_price": 0.8,
            "total_amount": 240.0,
            "payment_status": "unpaid"
        }
    ]
    
    success_count = 0
    async with httpx.AsyncClient() as client:
        for bill in bills:
            try:
                response = await client.post(f"{BASE_URL}/utility-bills/", json=bill)
                if response.status_code == 201:
                    print_success(f"水电账单 {bill['id']} 导入成功")
                    success_count += 1
                elif response.status_code == 409:
                    print_info(f"水电账单 {bill['id']} 已存在，跳过")
                    success_count += 1
                else:
                    print_error(f"水电账单导入失败 {bill['id']}: {response.status_code} - {response.text}")
            except Exception as e:
                print_error(f"水电账单导入异常 {bill['id']}: {e}")
    
    return success_count == len(bills)

async def test_checkout_inspection_import():
    print_step(4, "导入退租检查和扣款数据")
    
    inspection_data = {
        "id": "INSPECTION-001",
        "lease_id": "LEASE-001",
        "inspection_date": "2024-01-02",
        "inspector_name": "李管家",
        "overall_condition": "good",
        "notes": "租客退房时整体状态良好"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(f"{BASE_URL}/checkout-inspections/", json=inspection_data)
            if response.status_code == 201:
                print_success(f"退租检查 {inspection_data['id']} 导入成功")
            elif response.status_code == 409:
                print_info(f"退租检查 {inspection_data['id']} 已存在，跳过")
            else:
                print_error(f"退租检查导入失败: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print_error(f"退租检查导入异常: {e}")
            return False
        
        deductions = [
            {
                "id": "DEDUCT-001",
                "inspection_id": "INSPECTION-001",
                "deduction_type": "cleaning",
                "description": "深度清洁费",
                "amount": 300.0
            },
            {
                "id": "DEDUCT-002",
                "inspection_id": "INSPECTION-001",
                "deduction_type": "maintenance",
                "description": "墙面修复",
                "amount": 500.0
            }
        ]
        
        success_count = 0
        for deduction in deductions:
            try:
                response = await client.post(f"{BASE_URL}/deductions/", json=deduction)
                if response.status_code == 201:
                    print_success(f"扣款 {deduction['id']} 导入成功")
                    success_count += 1
                elif response.status_code == 409:
                    print_info(f"扣款 {deduction['id']} 已存在，跳过")
                    success_count += 1
                else:
                    print_error(f"扣款导入失败 {deduction['id']}: {response.status_code} - {response.text}")
            except Exception as e:
                print_error(f"扣款导入异常 {deduction['id']}: {e}")
        
        return success_count == len(deductions)

async def test_generate_refund_report():
    print_step(5, "生成退款报告")
    
    lease_id = "LEASE-001"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(f"{BASE_URL}/refund-reports/generate/{lease_id}")
            if response.status_code == 200:
                report = response.json()
                print_success(f"退款报告生成成功: {report['id']}")
                print_info(f"  押金金额: {report['total_deposit']}")
                print_info(f"  维修保洁扣款: {report['total_deductions']}")
                print_info(f"  水电扣款: {report['total_utility_deductions']}")
                print_info(f"  应退金额: {report['refund_amount']}")
                print_info(f"  争议状态: {report['dispute_status']}")
                return report['id']
            elif response.status_code == 409:
                print_info("已存在已批准的报告，尝试获取现有报告")
                response = await client.get(f"{BASE_URL}/refund-reports/", params={"lease_id": lease_id})
                if response.status_code == 200:
                    reports = response.json()
                    if reports:
                        return reports[0]['id']
                return None
            else:
                print_error(f"退款报告生成失败: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print_error(f"退款报告生成异常: {e}")
            return None

async def test_filter_reports():
    print_step(6, "筛选退款报告")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{BASE_URL}/refund-reports/", params={"min_refund_amount": 8000})
            if response.status_code == 200:
                reports = response.json()
                print_success(f"筛选成功，找到 {len(reports)} 个报告")
                for r in reports:
                    print_info(f"  - {r['id']}: 应退 {r['refund_amount']} 元, 状态: {r['dispute_status']}")
                return True
            else:
                print_error(f"筛选失败: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print_error(f"筛选异常: {e}")
            return False

async def test_review_report(report_id):
    print_step(7, "审核退款报告")
    
    if not report_id:
        print_error("没有可用的报告ID")
        return False
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.put(
                f"{BASE_URL}/refund-reports/{report_id}/review",
                params={"approve": True, "reviewer": "王经理", "notes": "审核通过，扣款合理"}
            )
            if response.status_code == 200:
                report = response.json()
                print_success(f"报告审核成功，当前状态: {report['dispute_status']}")
                return True
            elif response.status_code == 409:
                print_info("报告已处理过，跳过审核")
                return True
            else:
                print_error(f"审核失败: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print_error(f"审核异常: {e}")
            return False

async def test_process_refund(report_id):
    print_step(8, "处理退款（含重复退款拦截测试）")
    
    if not report_id:
        print_error("没有可用的报告ID")
        return False
    
    transaction_id = f"TXN-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.put(
                f"{BASE_URL}/refund-reports/{report_id}/refund",
                params={"refund_method": "bank_transfer", "transaction_id": transaction_id}
            )
            if response.status_code == 200:
                report = response.json()
                print_success(f"退款处理成功，状态: {report['dispute_status']}")
                print_info(f"  交易号: {report['transaction_id']}")
                print_info(f"  退款方式: {report['refund_method']}")
            elif response.status_code == 409:
                print_info("报告已退款，测试重复退款拦截...")
                response = await client.get(f"{BASE_URL}/refund-reports/{report_id}")
                if response.status_code == 200:
                    report = response.json()
                    transaction_id = report['transaction_id']
            else:
                print_error(f"退款处理失败: {response.status_code} - {response.text}")
                return False
            
            print_info("测试重复退款拦截...")
            response = await client.put(
                f"{BASE_URL}/refund-reports/{report_id}/refund",
                params={"refund_method": "alipay", "transaction_id": transaction_id}
            )
            if response.status_code == 409:
                error_detail = response.json()['detail']
                print_success(f"重复退款拦截成功! 错误码: {error_detail['code']}")
                print_info(f"  消息: {error_detail['message']}")
                return True
            else:
                print_error(f"重复退款拦截失败: {response.status_code}")
                return False
                
        except Exception as e:
            print_error(f"退款处理异常: {e}")
            return False

async def test_export_report(report_id):
    print_step(9, "导出退款报告")
    
    if not report_id:
        print_error("没有可用的报告ID")
        return False
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{BASE_URL}/refund-reports/{report_id}/export", params={"format": "excel"})
            if response.status_code == 200:
                filename = f"refund_report_{report_id}.xlsx"
                with open(filename, "wb") as f:
                    f.write(response.content)
                print_success(f"Excel报告导出成功: {filename}")
                print_info(f"  文件大小: {os.path.getsize(filename)} 字节")
                return True
            else:
                print_error(f"Excel导出失败: {response.status_code}")
                return False
        except Exception as e:
            print_error(f"Excel导出异常: {e}")
            return False

async def test_error_cases():
    print_step(10, "测试错误响应类型")
    
    async with httpx.AsyncClient() as client:
        all_passed = True
        
        print_info("测试 1: 缺少必填字段（生成报告时无押金）")
        try:
            lease_data = {
                "id": "LEASE-TEST-NO-DEP",
                "tenant_name": "测试用户",
                "apartment_number": "TEST-001",
                "lease_start_date": "2023-01-01",
                "lease_end_date": "2024-01-01",
                "monthly_rent": 3000.0
            }
            await client.post(f"{BASE_URL}/leases/", json=lease_data)
            
            response = await client.post(f"{BASE_URL}/refund-reports/generate/LEASE-TEST-NO-DEP")
            if response.status_code == 400:
                error_detail = response.json()['detail']
                if error_detail['code'] == 'missing_field':
                    print_success(f"正确返回 missing_field 错误")
                    print_info(f"  消息: {error_detail['message']}")
                else:
                    print_error(f"错误码不正确: {error_detail['code']}")
                    all_passed = False
            else:
                print_error(f"状态码不正确: {response.status_code}")
                all_passed = False
        except Exception as e:
            print_error(f"测试异常: {e}")
            all_passed = False
        
        print_info("测试 2: 状态不允许（未批准直接退款）")
        try:
            lease_data2 = {
                "id": "LEASE-TEST-STATE",
                "tenant_name": "测试用户2",
                "apartment_number": "TEST-002",
                "lease_start_date": "2023-01-01",
                "lease_end_date": "2024-01-01",
                "monthly_rent": 3000.0
            }
            await client.post(f"{BASE_URL}/leases/", json=lease_data2)
            
            deposit_data2 = {
                "id": "DEPOSIT-TEST-STATE",
                "lease_id": "LEASE-TEST-STATE",
                "amount": 6000.0,
                "received_date": "2023-01-01"
            }
            await client.post(f"{BASE_URL}/deposits/", json=deposit_data2)
            
            inspection_data2 = {
                "id": "INSPECTION-TEST-STATE",
                "lease_id": "LEASE-TEST-STATE",
                "inspection_date": "2024-01-02"
            }
            await client.post(f"{BASE_URL}/checkout-inspections/", json=inspection_data2)
            
            response = await client.post(f"{BASE_URL}/refund-reports/generate/LEASE-TEST-STATE")
            if response.status_code == 200:
                report = response.json()
                response2 = await client.put(
                    f"{BASE_URL}/refund-reports/{report['id']}/refund",
                    params={"refund_method": "alipay", "transaction_id": "TEST-TXN-001"}
                )
                if response2.status_code == 422:
                    error_detail = response2.json()['detail']
                    if error_detail['code'] == 'invalid_state':
                        print_success(f"正确返回 invalid_state 错误")
                        print_info(f"  消息: {error_detail['message']}")
                    else:
                        print_error(f"错误码不正确: {error_detail['code']}")
                        all_passed = False
                else:
                    print_error(f"状态码不正确: {response2.status_code}")
                    all_passed = False
        except Exception as e:
            print_error(f"测试异常: {e}")
            all_passed = False
        
        print_info("测试 3: 需要人工复核（扣款超过押金30%）")
        try:
            lease_data3 = {
                "id": "LEASE-TEST-MANUAL",
                "tenant_name": "测试用户3",
                "apartment_number": "TEST-003",
                "lease_start_date": "2023-01-01",
                "lease_end_date": "2024-01-01",
                "monthly_rent": 3000.0
            }
            await client.post(f"{BASE_URL}/leases/", json=lease_data3)
            
            deposit_data3 = {
                "id": "DEPOSIT-TEST-MANUAL",
                "lease_id": "LEASE-TEST-MANUAL",
                "amount": 6000.0,
                "received_date": "2023-01-01"
            }
            await client.post(f"{BASE_URL}/deposits/", json=deposit_data3)
            
            inspection_data3 = {
                "id": "INSPECTION-TEST-MANUAL",
                "lease_id": "LEASE-TEST-MANUAL",
                "inspection_date": "2024-01-02"
            }
            await client.post(f"{BASE_URL}/checkout-inspections/", json=inspection_data3)
            
            deduction_data3 = {
                "id": "DEDUCT-TEST-MANUAL",
                "inspection_id": "INSPECTION-TEST-MANUAL",
                "deduction_type": "maintenance",
                "description": "大额维修",
                "amount": 2500.0
            }
            await client.post(f"{BASE_URL}/deductions/", json=deduction_data3)
            
            response = await client.post(f"{BASE_URL}/refund-reports/generate/LEASE-TEST-MANUAL")
            if response.status_code == 200:
                report = response.json()
                if report['dispute_status'] == 'needs_manual_review':
                    print_success(f"正确触发人工复核状态: {report['dispute_status']}")
                    print_info(f"  备注: {report['dispute_notes']}")
                else:
                    print_error(f"状态不正确: {report['dispute_status']}")
                    all_passed = False
            else:
                print_error(f"状态码不正确: {response.status_code}")
                all_passed = False
        except Exception as e:
            print_error(f"测试异常: {e}")
            all_passed = False
        
        return all_passed

async def main():
    print("\n" + "#"*60)
    print("#  退租押金水电抵扣争议复核API - 自检脚本")
    print("#"*60)
    
    results = []
    
    results.append(("导入租约数据", await test_lease_import()))
    results.append(("导入押金数据", await test_deposit_import()))
    results.append(("导入水电账单", await test_utility_bill_import()))
    results.append(("导入退租检查和扣款", await test_checkout_inspection_import()))
    
    report_id = await test_generate_refund_report()
    results.append(("生成退款报告", report_id is not None))
    
    results.append(("筛选退款报告", await test_filter_reports()))
    results.append(("审核退款报告", await test_review_report(report_id)))
    results.append(("处理退款和重复拦截", await test_process_refund(report_id)))
    results.append(("导出退款报告", await test_export_report(report_id)))
    results.append(("错误响应测试", await test_error_cases()))
    
    print("\n" + "="*60)
    print("测试结果汇总")
    print("="*60)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ 通过" if result else "❌ 失败"
        print(f"{status} - {test_name}")
        if result:
            passed += 1
    
    print(f"\n总计: {passed}/{total} 测试通过")
    
    if passed == total:
        print("\n🎉 所有测试通过！API功能正常！")
    else:
        print(f"\n⚠️  有 {total - passed} 个测试失败，请检查！")
    
    return passed == total

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
