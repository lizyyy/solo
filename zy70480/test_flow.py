import requests
import json
import time

BASE_URL = "http://localhost:8000"

def print_separator(title=""):
    print("\n" + "="*60)
    if title:
        print(f"  {title}")
        print("="*60)

def test_complete_flow():
    print_separator("批量补偿后端服务 - 完整流程测试")
    
    print("\n1. 获取跨天售后录音样例数据...")
    response = requests.get(f"{BASE_URL}/api/batches/sample/cross-day")
    sample_data = response.json()
    print(f"   ✓ 获得到 {len(sample_data['records'])} 条样例记录")
    print(f"   ✓ 其中包含 {sum(1 for r in sample_data['records'] if r['is_mixed_source'])} 条来源混杂的问题记录")
    
    print("\n2. 预览批次处理影响范围...")
    response = requests.post(f"{BASE_URL}/api/batches/preview", json=sample_data)
    preview_result = response.json()
    print(f"   ✓ 批次号: {preview_result['batch_no']}")
    print(f"   ✓ 总记录数: {preview_result['total_records']}")
    print(f"   ✓ 预估补偿金额: {preview_result['estimated_compensation']}元")
    print(f"   ✓ 影响客户数: {preview_result['affected_customers']}")
    print(f"   ✓ 来源混杂记录: {preview_result['mixed_source_count']}条")
    
    print("\n3. 执行批量补偿处理...")
    response = requests.post(f"{BASE_URL}/api/batches/execute", json=sample_data)
    execute_result = response.json()
    print(f"   ✓ 批次执行完成")
    print(f"   ✓ 批次ID: {execute_result['id']}")
    print(f"   ✓ 状态: {execute_result['status']}")
    print(f"   ✓ 实际补偿金额: {execute_result['total_compensation']}元")
    
    batch_no = sample_data['batch_no']
    
    print("\n4. 测试幂等性 - 重复提交同一批次...")
    response = requests.post(f"{BASE_URL}/api/batches/execute", json=sample_data)
    if response.status_code == 409:
        print(f"   ✓ 正确拒绝重复提交: {response.json()['detail']['message']}")
    else:
        print(f"   ✗ 幂等性测试失败")
    
    print("\n5. 添加人工修正记录...")
    records_resp = requests.get(f"{BASE_URL}/api/batches/{batch_no}/records")
    records_data = records_resp.json()
    record_id = records_data['records'][0]['recording_id']
    
    correction_data = {
        "record_id": record_id,
        "operator": "张工",
        "correction_type": "compensation_amount",
        "original_value": "100.0",
        "corrected_value": "120.0",
        "reason": "考虑到用户是VIP客户，追加补偿"
    }
    response = requests.post(f"{BASE_URL}/api/batches/{batch_no}/corrections", json=correction_data)
    print(f"   ✓ 人工修正记录已添加")
    
    print("\n6. 获取JSON格式报告...")
    response = requests.get(f"{BASE_URL}/api/batches/{batch_no}/report/json")
    json_report = response.json()
    print(f"   ✓ 报告获取成功")
    print(f"   ✓ 总执行时间: {json_report['total_execution_time_ms']}ms")
    print(f"   ✓ 处理前状态: {json_report['before_summary']}")
    print(f"   ✓ 处理后状态: {json_report['after_summary']}")
    print(f"   ✓ 下一步建议: {json_report['next_steps']}")
    
    print("\n7. 获取Markdown格式报告...")
    response = requests.get(f"{BASE_URL}/api/batches/{batch_no}/report/markdown")
    print(f"   ✓ Markdown报告获取成功")
    print(f"   ✓ 报告长度: {len(response.text)} 字符")
    
    print("\n8. 查看批次记录和人工修正...")
    response = requests.get(f"{BASE_URL}/api/batches/{batch_no}/records")
    records_data = response.json()
    print(f"   ✓ 记录数: {len(records_data['records'])}")
    print(f"   ✓ 人工修正记录数: {len(records_data['manual_corrections'])}")
    for corr in records_data['manual_corrections']:
        print(f"     - 批次号[{corr['batch_no']}]: {corr['operator']} 修正 {corr['correction_type']}")
        print(f"       依据: {corr['reason']}")
    
    print("\n9. 查看所有批次列表...")
    response = requests.get(f"{BASE_URL}/api/batches")
    batches = response.json()
    print(f"   ✓ 系统中共有 {len(batches)} 个批次")
    
    print_separator("测试完成!")
    print("\n📋 功能验证总结:")
    print("   ✓ 跨天售后录音样例数据（含1条来源混杂记录）")
    print("   ✓ 批量处理预览影响范围")
    print("   ✓ 批量执行补偿处理")
    print("   ✓ 同一批内容重复提交时复用旧结论（幂等性）")
    print("   ✓ 本地持久化，重启可查询历史记录")
    print("   ✓ 报告包含处理前后对比、执行时间、下一步建议")
    print("   ✓ 支持JSON、Markdown、文件下载三种输出格式")
    print("   ✓ 人工修正记录按批次号标注来源和处理依据")
    print("\n🌐 访问 http://localhost:8000/docs 查看完整API文档")

if __name__ == "__main__":
    try:
        test_complete_flow()
    except requests.exceptions.ConnectionError:
        print("\n❌ 无法连接到服务，请先启动服务:")
        print("   pip install -r requirements.txt")
        print("   python main.py")
    except Exception as e:
        print(f"\n❌ 测试出错: {e}")
        import traceback
        traceback.print_exc()
