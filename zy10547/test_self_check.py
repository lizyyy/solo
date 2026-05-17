#!/usr/bin/env python3
import requests
import json
import time
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000/api"

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

def test_health_check():
    print_section("1. 健康检查")
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
        assert response.status_code == 200
        print("✓ 健康检查通过")
        return True
    except Exception as e:
        print(f"✗ 健康检查失败: {e}")
        return False

def test_normal_flow():
    print_section("2. 正常流程测试")
    results = []
    
    try:
        print("2.1 创建知识命中记录")
        hit_data = {
            "session_id": f"SESSION_{int(time.time())}",
            "knowledge_entry": "客户退款政策：商品签收后7天内可申请无理由退款",
            "knowledge_id": "KB-REFUND-001",
            "hit_reason": "客户询问退款政策，关键词匹配：退款、7天",
            "is_expired": False
        }
        response = requests.post(f"{BASE_URL}/knowledge-hits/", json=hit_data)
        print(f"状态码: {response.status_code}")
        result = response.json()
        print(f"响应: {json.dumps(result, ensure_ascii=False, indent=2)}")
        assert response.status_code == 200
        hit_id = result["id"]
        print(f"✓ 创建成功，ID: {hit_id}")
        results.append(True)
        
        print("\n2.2 查询命中记录")
        response = requests.get(f"{BASE_URL}/knowledge-hits/{hit_id}")
        assert response.status_code == 200
        print(f"✓ 查询成功")
        results.append(True)
        
        print("\n2.3 提交反馈")
        feedback_data = {
            "feedback": "知识内容准确，但需要补充特殊商品例外情况",
            "feedback_by": "客服_张三"
        }
        response = requests.post(f"{BASE_URL}/knowledge-hits/{hit_id}/feedback", json=feedback_data)
        assert response.status_code == 200
        print(f"✓ 反馈提交成功")
        results.append(True)
        
        print("\n2.4 确认修订")
        revision_data = {
            "revision_note": "已更新退款政策，补充特殊商品说明",
            "revised_by": "知识库管理员"
        }
        response = requests.post(f"{BASE_URL}/knowledge-hits/{hit_id}/confirm-revision", json=revision_data)
        assert response.status_code == 200
        print(f"✓ 修订确认成功")
        results.append(True)
        
        print("\n2.5 生成报告")
        response = requests.post(f"{BASE_URL}/knowledge-hits/{hit_id}/report")
        assert response.status_code == 200
        report = response.json()
        print(f"✓ 报告生成成功，包含时间线: {list(report['timeline'].keys())}")
        results.append(True)
        
        print("\n2.6 导出CSV")
        response = requests.get(f"{BASE_URL}/knowledge-hits/export/csv")
        assert response.status_code == 200
        print(f"✓ CSV导出成功，内容长度: {len(response.content)}")
        results.append(True)
        
        return all(results)
    
    except Exception as e:
        print(f"✗ 正常流程测试失败: {e}")
        return False

def test_expired_knowledge():
    print_section("3. 过期知识拦截测试")
    try:
        hit_data = {
            "session_id": f"SESSION_EXPIRED_{int(time.time())}",
            "knowledge_entry": "旧版运费政策",
            "knowledge_id": "KB-SHIPPING-OLD",
            "hit_reason": "客户询问运费",
            "is_expired": False,
            "expire_date": (datetime.utcnow() - timedelta(days=10)).isoformat()
        }
        response = requests.post(f"{BASE_URL}/knowledge-hits/", json=hit_data)
        result = response.json()
        print(f"状态码: {response.status_code}")
        print(f"状态: {result['status']}")
        print(f"是否过期: {result['is_expired']}")
        assert result["status"] == "expired"
        assert result["is_expired"] == True
        print("✓ 过期知识正确拦截，状态自动标记为 expired")
        return True
    except Exception as e:
        print(f"✗ 过期知识拦截测试失败: {e}")
        return False

def test_dirty_data():
    print_section("4. 脏数据测试")
    results = []
    
    try:
        print("4.1 缺少必填字段")
        dirty_data = {
            "session_id": "DIRTY_SESSION",
        }
        response = requests.post(f"{BASE_URL}/knowledge-hits/", json=dirty_data)
        print(f"状态码: {response.status_code}")
        assert response.status_code == 422
        print("✓ 正确拒绝缺少必填字段的请求")
        results.append(True)
        
        print("\n4.2 空字符串字段")
        dirty_data = {
            "session_id": "",
            "knowledge_entry": "",
            "hit_reason": ""
        }
        response = requests.post(f"{BASE_URL}/knowledge-hits/", json=dirty_data)
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.text[:200]}")
        print("✓ 空字符串数据处理完成")
        results.append(True)
        
        print("\n4.3 无效状态更新")
        hit_data = {
            "session_id": "TEST_INVALID_STATUS",
            "knowledge_entry": "测试知识",
            "hit_reason": "测试原因"
        }
        response = requests.post(f"{BASE_URL}/knowledge-hits/", json=hit_data)
        hit_id = response.json()["id"]
        
        response = requests.patch(f"{BASE_URL}/knowledge-hits/{hit_id}/status?status=invalid_status")
        print(f"状态码: {response.status_code}")
        assert response.status_code == 400
        print("✓ 正确拒绝无效状态更新")
        results.append(True)
        
        print("\n4.4 查询不存在的记录")
        response = requests.get(f"{BASE_URL}/knowledge-hits/999999")
        print(f"状态码: {response.status_code}")
        assert response.status_code == 404
        print("✓ 正确返回404")
        results.append(True)
        
        return all(results)
    
    except Exception as e:
        print(f"✗ 脏数据测试失败: {e}")
        return False

def test_duplicate_requests():
    print_section("5. 重复请求测试")
    try:
        hit_data = {
            "session_id": f"SESSION_DUPLICATE_{int(time.time())}",
            "knowledge_entry": "重复测试知识",
            "hit_reason": "重复测试原因",
            "raw_input": "原始输入数据"
        }
        
        print("5.1 多次提交相同数据")
        ids = []
        for i in range(3):
            response = requests.post(f"{BASE_URL}/knowledge-hits/", json=hit_data)
            assert response.status_code == 200
            ids.append(response.json()["id"])
            print(f"  请求 {i+1}: ID = {ids[-1]}")
        
        print(f"✓ 3次请求均成功，生成不同ID: {ids}")
        assert len(set(ids)) == 3
        
        print("\n5.2 验证原始输入保留")
        response = requests.get(f"{BASE_URL}/knowledge-hits/{ids[0]}/raw")
        raw_data = response.json()
        print(f"原始输入已保留: {raw_data['raw_input'] is not None}")
        print("✓ 原始输入正确保留")
        
        return True
    
    except Exception as e:
        print(f"✗ 重复请求测试失败: {e}")
        return False

def test_manual_correction():
    print_section("6. 人工修正测试")
    try:
        hit_data = {
            "session_id": f"SESSION_CORRECT_{int(time.time())}",
            "knowledge_entry": "错误的知识内容：退款需要30天",
            "hit_reason": "错误的匹配原因",
            "is_expired": False
        }
        response = requests.post(f"{BASE_URL}/knowledge-hits/", json=hit_data)
        hit_id = response.json()["id"]
        print(f"创建初始记录，ID: {hit_id}")
        print(f"初始知识条目: {response.json()['knowledge_entry']}")
        
        print("\n6.1 应用人工修正")
        correction_data = {
            "knowledge_entry": "正确的知识内容：退款需要7天",
            "hit_reason": "正确的匹配原因：客户询问退款周期",
            "is_expired": True,
            "status": "revision_confirmed",
            "corrected_by": "质检_李四",
            "correction_note": "原知识内容已过时，修正为最新版本"
        }
        response = requests.patch(
            f"{BASE_URL}/knowledge-hits/{hit_id}/manual-correct",
            json=correction_data
        )
        result = response.json()
        print(f"修正状态码: {response.status_code}")
        print(f"修正内容: {json.dumps(result['corrections'], ensure_ascii=False, indent=2)}")
        
        print("\n6.2 验证修正结果")
        response = requests.get(f"{BASE_URL}/knowledge-hits/{hit_id}")
        corrected = response.json()
        print(f"修正后知识条目: {corrected['knowledge_entry']}")
        print(f"是否人工修正: {corrected['is_manually_corrected']}")
        print(f"修正人: {corrected['corrected_by']}")
        assert corrected["is_manually_corrected"] == True
        assert corrected["corrected_by"] == "质检_李四"
        
        print("\n6.3 查看修正详情")
        response = requests.get(f"{BASE_URL}/knowledge-hits/{hit_id}/raw")
        raw_data = response.json()
        corrections = json.loads(raw_data["corrections"])
        print(f"修正备注: {corrections['note']}")
        print("✓ 人工修正功能正常工作")
        
        return True
    
    except Exception as e:
        print(f"✗ 人工修正测试失败: {e}")
        return False

def test_query_filters():
    print_section("7. 查询过滤测试")
    try:
        session_id = f"SESSION_FILTER_{int(time.time())}"
        
        for i in range(3):
            hit_data = {
                "session_id": session_id,
                "knowledge_entry": f"过滤测试知识 {i}",
                "hit_reason": f"原因 {i}",
                "is_expired": i == 0
            }
            requests.post(f"{BASE_URL}/knowledge-hits/", json=hit_data)
        
        print("7.1 按会话ID查询")
        response = requests.get(f"{BASE_URL}/knowledge-hits/", params={"session_id": session_id})
        results = response.json()
        print(f"找到 {len(results)} 条记录")
        assert len(results) >= 3
        
        print("\n7.2 按过期状态过滤")
        response = requests.get(f"{BASE_URL}/knowledge-hits/", params={"is_expired": True})
        expired = response.json()
        print(f"过期记录数: {len(expired)}")
        
        response = requests.get(f"{BASE_URL}/knowledge-hits/", params={"is_expired": False})
        not_expired = response.json()
        print(f"未过期记录数: {len(not_expired)}")
        
        print("✓ 查询过滤功能正常")
        return True
    
    except Exception as e:
        print(f"✗ 查询过滤测试失败: {e}")
        return False

def main():
    print("\n" + "="*60)
    print("  客服知识命中API - 自检脚本")
    print("  " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("="*60)
    
    tests = [
        ("健康检查", test_health_check),
        ("正常流程", test_normal_flow),
        ("过期拦截", test_expired_knowledge),
        ("脏数据处理", test_dirty_data),
        ("重复请求", test_duplicate_requests),
        ("人工修正", test_manual_correction),
        ("查询过滤", test_query_filters),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"✗ {name} 发生异常: {e}")
            results.append((name, False))
    
    print_section("测试总结")
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = "✓ 通过" if result else "✗ 失败"
        print(f"  {status} - {name}")
    
    print(f"\n总计: {passed}/{total} 测试通过")
    
    if passed == total:
        print("\n🎉 所有测试通过！服务运行正常。")
    else:
        print(f"\n⚠️  有 {total - passed} 个测试失败，请检查服务状态。")

if __name__ == "__main__":
    main()
