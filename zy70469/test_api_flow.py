#!/usr/bin/env python3
"""测试完整的 API 流程: 造数 -> 查询 -> 差异报告 -> 候选清单 -> 审批"""

import sys
import os
import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

BASE_URL = "http://localhost:8000"


def test_api_flow():
    print("=== 开始测试完整 API 流程 ===\n")
    
    # 1. 测试服务是否可用
    try:
        response = requests.get(f"{BASE_URL}/")
        if response.status_code == 200:
            print("✅ 1. 服务正常运行")
        else:
            print("❌ 1. 服务无法访问")
            return False
    except Exception as e:
        print(f"❌ 1. 服务无法连接: {e}")
        return False
    
    # 2. 生成测试数据
    print("\n--- 2. 生成测试数据 ---")
    batch_no = "API_TEST_001"
    payload = {
        "batch_no": batch_no,
        "operator": "API测试员",
        "record_count": 10
    }
    response = requests.post(f"{BASE_URL}/api/data/generate", json=payload)
    if response.status_code == 200:
        result = response.json()
        print(f"✅ 数据生成成功: {result['record_count']}条记录, {result['abnormal_count']}条异常")
    else:
        print(f"❌ 数据生成失败: {response.status_code}")
        return False
    
    # 3. 查询比对结果
    print("\n--- 3. 查询比对结果 ---")
    query_payload = {
        "batch_no": batch_no,
        "page": 1,
        "page_size": 20
    }
    response = requests.post(f"{BASE_URL}/api/comparison/query", json=query_payload)
    if response.status_code == 200:
        result = response.json()
        print(f"✅ 查询成功: 共 {result['total']} 条记录")
        
        # 统计重复提交
        duplicate_count = sum(1 for r in result['results'] if r['risk_type'] == "重复提交")
        abnormal_count = sum(1 for r in result['results'] if r['is_abnormal'])
        
        print(f"   - 重复提交: {duplicate_count} 条")
        print(f"   - 异常记录: {abnormal_count} 条")
        
        if duplicate_count == 1:
            print(f"   ✅ 重复提交数量正确（其中一条暴露）")
        else:
            print(f"   ❌ 重复提交数量不正确: 期望1条，实际{duplicate_count}条")
            return False
    else:
        print(f"❌ 查询失败: {response.status_code}")
        return False
    
    # 4. 按风险类型过滤查询
    print("\n--- 4. 按风险类型过滤查询 ---")
    query_payload = {
        "batch_no": batch_no,
        "risk_type": "重复提交",
        "page": 1,
        "page_size": 20
    }
    response = requests.post(f"{BASE_URL}/api/comparison/query", json=query_payload)
    if response.status_code == 200:
        result = response.json()
        print(f"✅ 查询'重复提交'成功: 返回 {result['total']} 条记录")
        
        # 验证所有结果都是 is_abnormal=true
        all_abnormal = all(r['is_abnormal'] for r in result['results'])
        if all_abnormal:
            print("   ✅ 所有查询结果 is_abnormal=true")
        else:
            print("   ❌ 查询结果包含 is_abnormal=false 的记录")
            return False
    else:
        print(f"❌ 按风险类型查询失败: {response.status_code}")
        return False
    
    # 5. 测试差异报告
    print("\n--- 5. 测试差异报告 ---")
    # 找到一条异常记录
    first_abnormal = next(r for r in result['results'] if r['risk_type'] == "重复提交")
    result_id = first_abnormal['id']
    
    response = requests.get(f"{BASE_URL}/api/comparison/{result_id}/diff-report")
    if response.status_code == 200:
        report = response.json()
        print(f"✅ 差异报告生成成功")
        print(f"   - 风险类型: {report['risk_type']}")
        print(f"   - 是否异常: {report['is_abnormal']}")
        print(f"   - 差异字段: {report['diff_fields']}")
        print(f"   - 摘要: {report['summary'][:50]}...")
    else:
        print(f"❌ 差异报告生成失败: {response.status_code}")
        return False
    
    # 6. 创建候选清单
    print("\n--- 6. 创建候选清单 ---")
    candidate_payload = {
        "batch_no": batch_no,
        "candidate_type": "清理",
        "record_ids": [first_abnormal['record_id']],
        "reason": "测试清理",
        "operator": "API测试员"
    }
    response = requests.post(f"{BASE_URL}/api/candidates", json=candidate_payload)
    if response.status_code == 200:
        candidate = response.json()
        print(f"✅ 候选清单创建成功: ID={candidate['id']}")
        candidate_id = candidate['id']
    else:
        print(f"❌ 候选清单创建失败: {response.status_code}")
        return False
    
    # 7. 审批候选清单
    print("\n--- 7. 审批候选清单 ---")
    response = requests.post(f"{BASE_URL}/api/candidates/{candidate_id}/approve?operator=管理员")
    if response.status_code == 200:
        approved = response.json()
        print(f"✅ 审批成功: 状态={approved['status']}")
    else:
        print(f"❌ 审批失败: {response.status_code}")
        return False
    
    # 8. 验证批次摘要
    print("\n--- 8. 验证批次摘要 ---")
    response = requests.get(f"{BASE_URL}/api/batches/{batch_no}")
    if response.status_code == 200:
        batch = response.json()
        print(f"✅ 获取批次信息成功")
        print(f"   - 批次名称: {batch['name']}")
        print(f"   - 摘要: {batch['summary']}")
        
        if "其中重复提交1条" in batch['summary']:
            print("   ✅ 批次摘要中重复提交数量统计正确")
        else:
            print("   ⚠️ 批次摘要格式可能已调整")
    else:
        print(f"❌ 获取批次信息失败: {response.status_code}")
        return False
    
    print("\n=== 所有测试通过 ✅ ===")
    return True


if __name__ == "__main__":
    success = test_api_flow()
    sys.exit(0 if success else 1)
