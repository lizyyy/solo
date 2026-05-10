"""
向量索引重建 API 使用示例
普通用户可以通过运行这个脚本来确认功能是否正常工作
"""

import requests
import json
import sys
import time

BASE_URL = "http://localhost:8000"


def print_step(step_num, description):
    print(f"\n{'='*60}")
    print(f"步骤 {step_num}: {description}")
    print(f"{'='*60}\n")


def check_health():
    print_step(1, "检查服务健康状态")
    
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            data = response.json()
            print(f"✓ 服务运行正常: {data['status']}")
            return True
        else:
            print(f"✗ 服务状态异常: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ 无法连接到服务: {e}")
        print("请先启动服务: uvicorn app.main:app --reload")
        return False


def rebuild_index():
    print_step(2, "发起向量索引重建请求")
    
    request_data = {
        "task_id": f"test_task_{int(time.time())}",
        "document_versions": [
            {
                "document_id": "doc_001",
                "version": 1,
                "content_hash": "a1b2c3d4e5f6",
                "title": "用户指南文档",
                "content": "这是一个测试文档的内容，用于验证索引重建功能"
            },
            {
                "document_id": "doc_002",
                "version": 2,
                "content_hash": "f6e5d4c3b2a1",
                "title": "API 参考文档",
                "content": "这是另一个测试文档，包含 API 使用说明"
            }
        ],
        "recall_samples": [
            {
                "query": "如何使用索引重建 API",
                "expected_document_id": "sample_doc_001",
                "expected_version": 2
            }
        ],
        "enable_rollback": True
    }
    
    print(f"请求数据: {json.dumps(request_data, indent=2, ensure_ascii=False)}")
    print()
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/v1/index/rebuild",
            json=request_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ 重建请求成功")
            print(f"  任务ID: {data['task_id']}")
            print(f"  状态: {data['status']}")
            print(f"  消息: {data['message']}")
            return request_data["task_id"]
        else:
            print(f"✗ 重建请求失败: HTTP {response.status_code}")
            print(f"  错误详情: {response.json()}")
            return None
    except Exception as e:
        print(f"✗ 请求异常: {e}")
        return None


def check_task_status(task_id):
    if not task_id:
        return None
    
    print_step(3, f"查询任务状态: {task_id}")
    
    try:
        response = requests.get(f"{BASE_URL}/api/v1/index/task/{task_id}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ 任务状态查询成功")
            print(f"\n任务信息:")
            print(f"  任务ID: {data['task']['task_id']}")
            print(f"  状态: {data['task']['status']}")
            print(f"  目标文档数: {data['task']['target_document_count']}")
            print(f"  成功处理: {data['task']['success_document_count']}")
            print(f"  失败处理: {data['task']['failed_document_count']}")
            
            print(f"\n分片验证信息:")
            for i, validation in enumerate(data['validations'], 1):
                print(f"  验证 #{i}:")
                print(f"    分片ID: {validation['shard_id']}")
                print(f"    文档版本ID: {validation['document_version_id']}")
                print(f"    验证结果: {'✓ 通过' if validation['is_valid'] else '✗ 失败'}")
            
            if data['recall_samples']:
                print(f"\n召回测试信息:")
                for i, sample in enumerate(data['recall_samples'], 1):
                    print(f"  样本 #{i}:")
                    print(f"    查询: {sample['query']}")
                    print(f"    期望: {sample['expected_document_id']} v{sample['expected_version']}")
                    print(f"    实际: {sample['actual_document_id']} v{sample['actual_version']}")
                    print(f"    匹配: {'✓ 是' if sample['is_match'] else '✗ 否'}")
            
            if data['reports']:
                print(f"\n重建报告:")
                report = data['reports'][0]
                print(f"  总体状态: {report['overall_status']}")
                print(f"  文档总数: {report['total_documents']}")
                print(f"  验证通过: {report['valid_documents']}")
                print(f"  验证失败: {report['invalid_documents']}")
                print(f"  召回准确率: {report['recall_accuracy']*100:.1f}%")
                if report['summary']:
                    print(f"\n  摘要:")
                    for line in report['summary'].split('\n'):
                        print(f"    {line}")
            
            return data
        else:
            print(f"✗ 查询失败: HTTP {response.status_code}")
            print(f"  错误详情: {response.json()}")
            return None
    except Exception as e:
        print(f"✗ 查询异常: {e}")
        return None


def test_rollback(task_id):
    if not task_id:
        return
    
    print_step(4, f"测试人工回滚功能: {task_id}")
    
    rollback_data = {
        "task_id": task_id,
        "reason": "测试人工回滚功能"
    }
    
    print(f"回滚请求: {json.dumps(rollback_data, indent=2, ensure_ascii=False)}")
    print()
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/v1/index/rollback",
            json=rollback_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ 回滚请求成功")
            print(f"  成功: {data['success']}")
            print(f"  消息: {data['message']}")
            
            print(f"\n回滚后状态:")
            check_task_status(task_id)
        else:
            print(f"✗ 回滚请求失败: HTTP {response.status_code}")
            print(f"  错误详情: {response.json()}")
    except Exception as e:
        print(f"✗ 回滚异常: {e}")


def test_error_handling():
    print_step(5, "测试错误处理（缺字段、重复请求）")
    
    print("\n测试 1: 缺少必填字段")
    invalid_request = {
        "task_id": "",
        "document_versions": []
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/v1/index/rebuild",
            json=invalid_request,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 400:
            print(f"✓ 正确识别缺字段错误: HTTP {response.status_code}")
            print(f"  错误信息: {response.json()}")
        else:
            print(f"✗ 异常: HTTP {response.status_code}")
    except Exception as e:
        print(f"✗ 请求异常: {e}")
    
    print("\n测试 2: 重复提交相同任务")
    task_id = f"duplicate_test_{int(time.time())}"
    valid_request = {
        "task_id": task_id,
        "document_versions": [
            {
                "document_id": "doc_dup_001",
                "version": 1,
                "content_hash": "hash_dup_001"
            }
        ]
    }
    
    try:
        response1 = requests.post(
            f"{BASE_URL}/api/v1/index/rebuild",
            json=valid_request,
            headers={"Content-Type": "application/json"}
        )
        print(f"第一次提交: HTTP {response1.status_code}")
        
        response2 = requests.post(
            f"{BASE_URL}/api/v1/index/rebuild",
            json=valid_request,
            headers={"Content-Type": "application/json"}
        )
        
        if response2.status_code == 409:
            print(f"✓ 正确识别重复请求: HTTP {response2.status_code}")
            print(f"  错误信息: {response2.json()}")
        else:
            print(f"✗ 异常: HTTP {response2.status_code}")
    except Exception as e:
        print(f"✗ 请求异常: {e}")


def main():
    print("""
╔══════════════════════════════════════════════════════════════╗
║           向量索引重建 API 功能验证脚本                       ║
║                                                              ║
║  这个脚本将演示如何使用 API，并验证功能是否正常工作。          ║
║                                                              ║
║  请确保已启动服务: uvicorn app.main:app --reload              ║
╚══════════════════════════════════════════════════════════════╝
""")
    
    if not check_health():
        print("\n服务未启动，请先运行: uvicorn app.main:app --reload")
        sys.exit(1)
    
    task_id = rebuild_index()
    
    if task_id:
        task_data = check_task_status(task_id)
        
        if task_data and task_data['task']['status'] == 'completed':
            test_rollback(task_id)
    
    test_error_handling()
    
    print("\n" + "="*60)
    print("功能验证完成！")
    print("="*60)
    print("""
如果你看到了所有的 ✓ 标记，说明 API 功能正常工作。

核心功能验证包括：
1. ✓ 服务健康检查
2. ✓ 向量索引重建
3. ✓ 任务状态查询
4. ✓ 分片验证
5. ✓ 召回测试
6. ✓ 重建报告生成
7. ✓ 人工回滚功能
8. ✓ 错误处理（缺字段、重复请求）

可以查看数据库文件 vector_index.db 来验证数据是否正确存储。
""")


if __name__ == "__main__":
    main()
