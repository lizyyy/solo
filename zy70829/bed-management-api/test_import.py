#!/usr/bin/env python3
"""
床位管理API测试脚本
"""
import requests
import os
import json

BASE_URL = "http://localhost:8000"


def print_separator(title=""):
    print("\n" + "=" * 60)
    if title:
        print(f"  {title}")
        print("=" * 60)


def test_health_check():
    print_separator("健康检查")
    try:
        response = requests.get(f"{BASE_URL}/api/health")
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
        return response.status_code == 200
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到服务器，请先启动服务:")
        print("   python -m uvicorn app.main:app --reload --port 8000")
        return False


def test_first_import():
    print_separator("首次导入测试")
    
    sample_dir = os.path.join(os.path.dirname(__file__), "samples")
    
    files = {
        "bed_csv": open(os.path.join(sample_dir, "beds_ward.csv"), "rb"),
        "patient_flow_json": open(os.path.join(sample_dir, "patient_flows.json"), "rb"),
        "cleaning_order_json": open(os.path.join(sample_dir, "cleaning_orders.json"), "rb"),
    }
    
    data = {
        "batch_id": "BATCH20240115001"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/import", files=files, data=data)
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\n批次ID: {result['batch_id']}")
            print(f"总计: {result['total_count']} 条")
            print(f"✅ 成功: {result['success_count']} 条")
            print(f"⚠️  待确认: {result['pending_count']} 条")
            print(f"❌ 失败: {result['failed_count']} 条")
            
            if result['pending_items']:
                print("\n待确认项详情:")
                for item in result['pending_items']:
                    print(f"  - [{item['record_type']}] {item['record_id']}: {item['suggestion']}")
            
            if result['failed_items']:
                print("\n失败项详情（需要人工修正）:")
                for item in result['failed_items']:
                    print(f"  - [{item['record_type']}] {item['record_id']}: {item['suggestion']}")
                    print(f"    原始数据: {json.dumps(item['original_data'], ensure_ascii=False)}")
        
        return response.status_code == 200
    finally:
        for f in files.values():
            f.close()


def test_duplicate_batch():
    print_separator("幂等性测试（重复提交同一批次）")
    
    sample_dir = os.path.join(os.path.dirname(__file__), "samples")
    
    files = {
        "bed_csv": open(os.path.join(sample_dir, "beds_ward.csv"), "rb"),
    }
    
    data = {
        "batch_id": "BATCH20240115001"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/import", files=files, data=data)
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            if result['pending_items']:
                print(f"✅ 幂等性生效: {result['pending_items'][0]['suggestion']}")
        
        return response.status_code == 200
    finally:
        for f in files.values():
            f.close()


def test_get_batches():
    print_separator("查询已处理批次")
    response = requests.get(f"{BASE_URL}/api/batches")
    print(f"状态码: {response.status_code}")
    print(f"已处理批次: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    return response.status_code == 200


def main():
    print("\n🏥 床位管理导入API 测试脚本")
    
    if not test_health_check():
        return
    
    test_first_import()
    test_duplicate_batch()
    test_get_batches()
    
    print_separator("测试完成")
    print("\n📋 测试总结:")
    print("  - 访问 http://localhost:8000/docs 查看完整API文档")
    print("  - 查看 README.md 获取详细使用说明")
    print("\n💡 失败项说明:")
    print("  - INTERNAL-006: 占用状态但患者ID为空，需要补录患者信息")
    print("  - FLOW004: 转科记录转出与转入床位相同，需要核对转科信息")
    print("  - CLEAN004: 保洁工单已完成但缺少完成时间，需要补录时间")


if __name__ == "__main__":
    main()
