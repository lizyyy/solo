#!/usr/bin/env python3
"""疫苗预约对账系统演示脚本"""

import requests
import json
import time

BASE_URL = "http://localhost:8000/api/v1"


def test_import_data():
    """测试数据导入功能"""
    print("=" * 60)
    print("1. 测试数据导入功能")
    print("=" * 60)
    
    # 导入预约CSV
    print("\n1.1 导入预约CSV数据...")
    with open("app/data/sample_appointments.csv", "rb") as f:
        files = {"file": ("sample_appointments.csv", f, "text/csv")}
        response = requests.post(f"{BASE_URL}/import/appointments/csv", files=files)
        result = response.json()
        print(f"    预约导入结果: {result['message']}")
        print(f"    导入批次: {result['data']['batch_id']}")
        appointment_batch = result['data']['batch_id']
    
    # 导入库存JSON
    print("\n1.2 导入疫苗库存数据...")
    with open("app/data/sample_inventory.json", "rb") as f:
        files = {"file": ("sample_inventory.json", f, "application/json")}
        response = requests.post(f"{BASE_URL}/import/inventory/json", files=files)
        result = response.json()
        print(f"    库存导入结果: {result['message']}")
    
    # 导入规则JSON
    print("\n1.3 导入禁忌规则数据...")
    with open("app/data/sample_rules.json", "rb") as f:
        files = {"file": ("sample_rules.json", f, "application/json")}
        response = requests.post(f"{BASE_URL}/import/rules/json", files=files)
        result = response.json()
        print(f"    规则导入结果: {result['message']}")
    
    return appointment_batch


def test_reconciliation(batch_id):
    """测试对账功能"""
    print("\n" + "=" * 60)
    print("2. 测试自动对账功能")
    print("=" * 60)
    
    print("\n2.1 执行自动对账...")
    response = requests.post(f"{BASE_URL}/reconciliation/run", params={"batch_id": batch_id})
    result = response.json()
    print(f"    对账结果: {result['message']}")
    print(f"    对账批次: {result['data']['batch_id']}")
    
    data = result['data']
    print(f"    - 总记录数: {data['total_records']}")
    print(f"    - 自动通过: {data['auto_approved']}")
    print(f"    - 自动拒绝: {data['auto_rejected']}")
    print(f"    - 需人工复核: {data['needs_review']}")
    print(f"    - 发现差异: {data['discrepancies_found']}")
    
    return result['data']['batch_id']


def test_reports():
    """测试报告功能"""
    print("\n" + "=" * 60)
    print("3. 测试报告生成功能")
    print("=" * 60)
    
    print("\n3.1 获取汇总报告...")
    response = requests.get(f"{BASE_URL}/report/summary")
    result = response.json()
    summary = result['data']
    print(f"    汇总统计:")
    print(f"    - 总记录: {summary['total_records']}")
    print(f"    - 通过率: {summary['approval_rate']}%")
    print(f"    - 复核进度: {summary['review_progress']}%")
    
    print("\n3.2 获取差异分析报告...")
    response = requests.get(f"{BASE_URL}/report/discrepancies")
    result = response.json()
    discrep = result['data']
    print(f"    差异分析:")
    print(f"    - 总差异数: {discrep['total_discrepancies']}")
    print(f"    - 涉及记录数: {len(discrep['records_with_discrepancies'])}")
    print(f"    - 按类型统计: {discrep['by_type']}")
    
    print("\n3.3 导出Excel报告...")
    response = requests.get(f"{BASE_URL}/report/export/excel")
    if response.status_code == 200:
        with open("reconciliation_report.xlsx", "wb") as f:
            f.write(response.content)
        print(f"    Excel报告已导出: reconciliation_report.xlsx")
    else:
        print("    Excel报告导出失败")


def test_review_workflow():
    """测试人工复核流程"""
    print("\n" + "=" * 60)
    print("4. 测试人工复核功能")
    print("=" * 60)
    
    print("\n4.1 获取对账统计...")
    response = requests.get(f"{BASE_URL}/reconciliation/statistics")
    result = response.json()
    stats = result['data']
    print(f"    当前状态: {stats['by_status']}")
    
    print("\n4.2 获取明细记录...")
    response = requests.get(f"{BASE_URL}/report/details")
    result = response.json()
    details = result['data']
    
    need_review = [d for d in details if d['status'] == 'needs_review']
    auto_rejected = [d for d in details if d['status'] == 'auto_rejected']
    
    if need_review:
        record_id = need_review[0]['record_id']
        print(f"\n4.3 复核记录 {record_id} (人工通过)...")
        review_data = {
            "action": "approve",
            "reviewer": "张医生",
            "review_notes": "经人工核实，数据无误，准予接种",
            "decision_reason": "库存虽不足，但本批次优先保障"
        }
        response = requests.post(f"{BASE_URL}/review/{record_id}", json=review_data)
        result = response.json()
        print(f"    复核结果: {result['message']}")
        print(f"    审计日志ID: {result['data']['audit_log_id']}")
    
    if auto_rejected:
        record_id = auto_rejected[0]['record_id']
        print(f"\n4.4 复核记录 {record_id} (需补充材料)...")
        review_data = {
            "action": "request_info",
            "reviewer": "李医生",
            "review_notes": "需补充相关证明材料",
            "decision_reason": "系统自动拦截，需家长提供结核菌素试验阴性证明"
        }
        response = requests.post(f"{BASE_URL}/review/{record_id}", json=review_data)
        result = response.json()
        print(f"    复核结果: {result['message']}")


def test_traceability():
    """测试数据追溯功能"""
    print("\n" + "=" * 60)
    print("5. 测试数据追溯功能")
    print("=" * 60)
    
    print("\n5.1 获取明细记录用于追溯...")
    response = requests.get(f"{BASE_URL}/report/details")
    result = response.json()
    details = result['data']
    
    if details:
        record_id = details[0]['record_id']
        appointment_id = details[0]['appointment_id']
        child_id_card = details[0]['child_id_card']
        
        print(f"\n5.2 追溯对账记录 {record_id}...")
        response = requests.get(f"{BASE_URL}/trace/record/{record_id}")
        result = response.json()
        trace = result['data']
        print(f"    追溯路径: {trace['trace_path']}")
        print(f"    状态说明: {trace['decision_explanation']['status_meaning']}")
        if trace['decision_explanation']['reasons']:
            print(f"    差异原因:")
            for reason in trace['decision_explanation']['reasons']:
                print(f"      - [{reason['severity']}] {reason['description']}")
        
        print(f"\n5.3 按预约ID {appointment_id} 追溯...")
        response = requests.get(f"{BASE_URL}/trace/appointment/{appointment_id}")
        result = response.json()
        print(f"    找到 {result['total']} 条对账记录")
        
        print(f"\n5.4 按儿童身份证 {child_id_card} 查询历史...")
        response = requests.get(f"{BASE_URL}/trace/child/{child_id_card}")
        result = response.json()
        history = result['data']
        print(f"    历史预约总数: {history['total_appointments']}")
        for apt in history['appointments']:
            print(f"      - {apt['vaccine_name']} ({apt['appointment_date']}): {len(apt['reconciliation_records'])}条对账记录")


def main():
    print("\n" + "╔" + "═" * 58 + "╗")
    print("║" + " " * 15 + "社区卫生服务站疫苗预约对账系统" + " " * 15 + "║")
    print("║" + " " * 23 + "功能演示" + " " * 27 + "║")
    print("╚" + "═" * 58 + "╝")
    
    try:
        appointment_batch = test_import_data()
        reconciliation_batch = test_reconciliation(appointment_batch)
        test_reports()
        test_review_workflow()
        test_traceability()
        
        print("\n" + "=" * 60)
        print("✅ 所有功能测试完成！")
        print("=" * 60)
        print("\n📋 API文档地址: http://localhost:8000/docs")
        print("📊 生成的Excel报告: reconciliation_report.xlsx")
        
    except requests.exceptions.ConnectionError:
        print("\n❌ 错误: 无法连接到服务器！")
        print("请先启动服务: python -m uvicorn app.main:app --reload")
    except Exception as e:
        print(f"\n❌ 发生错误: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
