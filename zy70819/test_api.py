import requests
import json
import time

BASE_URL = "http://localhost:8000"

def test_create_batch():
    print("=" * 60)
    print("测试1: 创建批次")
    print("=" * 60)
    
    data = {
        "batch_number": "PURCHASE-2025-001",
        "submitted_by": "张采购",
        "items": [
            {
                "material_code": "MAT-001",
                "material_name": "牙科树脂材料",
                "specification": "A3色 4g/支",
                "manufacturer": "德国某牙科材料公司",
                "batch_no": "BATCH-20250101",
                "production_date": "2025-01-15T00:00:00",
                "expiry_date": "2027-12-15T00:00:00",
                "quantity": 100,
                "unit": "支",
                "storage_condition": "阴凉干燥处",
                "supplier": "XX医疗器械有限公司"
            },
            {
                "material_code": "MAT-002",
                "material_name": "一次性口腔器械盒",
                "specification": "标准型",
                "manufacturer": "江苏某医疗器械公司",
                "batch_no": "BATCH-20250201",
                "production_date": "2025-02-20T00:00:00",
                "expiry_date": "2026-08-20T00:00:00",
                "quantity": 500,
                "unit": "盒",
                "storage_condition": "常温保存",
                "supplier": "YY医疗器械有限公司"
            },
            {
                "material_code": "MAT-003",
                "material_name": "正畸托槽",
                "specification": "MBT 0.022",
                "manufacturer": "美国某正畸公司",
                "batch_no": "BATCH-20241201",
                "production_date": "2024-12-01T00:00:00",
                "expiry_date": "2026-06-10T00:00:00",
                "quantity": 200,
                "unit": "套",
                "storage_condition": "密封保存",
                "supplier": "ZZ医疗器械有限公司"
            }
        ]
    }
    
    response = requests.post(f"{BASE_URL}/api/batches/", json=data)
    result = response.json()
    
    print(f"状态码: {response.status_code}")
    print(f"批次号: {result.get('batch_number')}")
    print(f"是否重复: {result.get('is_duplicate')}")
    print(f"耗材数量: {len(result.get('items', []))}")
    
    print("\n分类结果:")
    for item in result.get('items', []):
        print(f"  - {item['material_name']}: {item['classification']}")
        print(f"    原因: {item['reason']}")
    
    return result


def test_duplicate_submit():
    print("\n" + "=" * 60)
    print("测试2: 重复提交识别")
    print("=" * 60)
    
    data = {
        "batch_number": "PURCHASE-2025-002",
        "submitted_by": "张采购",
        "items": [
            {
                "material_code": "MAT-001",
                "material_name": "牙科树脂材料",
                "specification": "A3色 4g/支",
                "manufacturer": "德国某牙科材料公司",
                "batch_no": "BATCH-20250101",
                "production_date": "2025-01-15T00:00:00",
                "expiry_date": "2027-12-15T00:00:00",
                "quantity": 100,
                "unit": "支",
                "storage_condition": "阴凉干燥处",
                "supplier": "XX医疗器械有限公司"
            },
            {
                "material_code": "MAT-002",
                "material_name": "一次性口腔器械盒",
                "specification": "标准型",
                "manufacturer": "江苏某医疗器械公司",
                "batch_no": "BATCH-20250201",
                "production_date": "2025-02-20T00:00:00",
                "expiry_date": "2026-08-20T00:00:00",
                "quantity": 500,
                "unit": "盒",
                "storage_condition": "常温保存",
                "supplier": "YY医疗器械有限公司"
            },
            {
                "material_code": "MAT-003",
                "material_name": "正畸托槽",
                "specification": "MBT 0.022",
                "manufacturer": "美国某正畸公司",
                "batch_no": "BATCH-20241201",
                "production_date": "2024-12-01T00:00:00",
                "expiry_date": "2026-06-10T00:00:00",
                "quantity": 200,
                "unit": "套",
                "storage_condition": "密封保存",
                "supplier": "ZZ医疗器械有限公司"
            }
        ]
    }
    
    response = requests.post(f"{BASE_URL}/api/batches/", json=data)
    result = response.json()
    
    print(f"状态码: {response.status_code}")
    print(f"批次号: {result.get('batch_number')}")
    print(f"是否重复: {result.get('is_duplicate')}")
    
    if result.get('is_duplicate'):
        print("✓ 重复提交识别成功！")


def test_get_batches():
    print("\n" + "=" * 60)
    print("测试3: 获取批次列表")
    print("=" * 60)
    
    response = requests.get(f"{BASE_URL}/api/batches/")
    batches = response.json()
    
    print(f"状态码: {response.status_code}")
    print(f"批次总数: {len(batches)}")
    
    for batch in batches:
        print(f"  - {batch['batch_number']} (提交人: {batch['submitted_by']})")


def test_get_batch_detail(batch_id):
    print("\n" + "=" * 60)
    print("测试4: 获取批次详情")
    print("=" * 60)
    
    response = requests.get(f"{BASE_URL}/api/batches/{batch_id}")
    batch = response.json()
    
    print(f"状态码: {response.status_code}")
    print(f"批次号: {batch['batch_number']}")
    print(f"提交人: {batch['submitted_by']}")
    print(f"提交时间: {batch['submit_time']}")
    
    return batch


def test_modify_item(item_id):
    print("\n" + "=" * 60)
    print("测试5: 修改耗材结论")
    print("=" * 60)
    
    data = {
        "classification": "待补充",
        "reason": "经过质控审核，该批托槽虽效期不足30天，但经供应商确认可延长效期，且为临床急需",
        "follow_up_action": "标记为优先使用，要求临床30天内用完，每日监控使用情况",
        "changed_by": "李质控",
        "change_reason": "临床急需且供应商确认可安全使用，经质控部门审批通过"
    }
    
    response = requests.put(f"{BASE_URL}/api/items/{item_id}", json=data)
    result = response.json()
    
    print(f"状态码: {response.status_code}")
    print(f"耗材名称: {result['material_name']}")
    print(f"新分类: {result['classification']}")
    print(f"新原因: {result['reason']}")


def test_get_change_history(item_id):
    print("\n" + "=" * 60)
    print("测试6: 获取修改历史")
    print("=" * 60)
    
    response = requests.get(f"{BASE_URL}/api/items/{item_id}/history")
    history = response.json()
    
    print(f"状态码: {response.status_code}")
    print(f"修改记录数: {len(history)}")
    
    for record in history:
        print(f"  - 修改人: {record['changed_by']}")
        print(f"    修改时间: {record['change_time']}")
        print(f"    {record['old_classification']} → {record['new_classification']}")
        print(f"    修改原因: {record['change_reason']}")


def test_statistics():
    print("\n" + "=" * 60)
    print("测试7: 获取统计信息")
    print("=" * 60)
    
    response = requests.get(f"{BASE_URL}/api/statistics")
    stats = response.json()
    
    print(f"状态码: {response.status_code}")
    print(f"总批次数: {stats['total_batches']}")
    print(f"总耗材数: {stats['total_items']}")
    print("分类分布:")
    for classification, count in stats['classification_distribution'].items():
        print(f"  - {classification}: {count}")


def test_download_reports(batch_id):
    print("\n" + "=" * 60)
    print("测试8: 下载报告")
    print("=" * 60)
    
    response = requests.get(f"{BASE_URL}/api/reports/batch/{batch_id}")
    print(f"批次报告状态码: {response.status_code}")
    print(f"报告大小: {len(response.content)} bytes")
    
    if response.status_code == 200:
        with open("测试_批次报告.xlsx", "wb") as f:
            f.write(response.content)
        print("✓ 批次报告已保存为: 测试_批次报告.xlsx")
    
    response = requests.get(f"{BASE_URL}/api/reports/full")
    print(f"全量报告状态码: {response.status_code}")
    print(f"报告大小: {len(response.content)} bytes")
    
    if response.status_code == 200:
        with open("测试_全量报告.xlsx", "wb") as f:
            f.write(response.content)
        print("✓ 全量报告已保存为: 测试_全量报告.xlsx")


if __name__ == "__main__":
    print("开始测试牙科耗材效期预警API服务...")
    print()
    
    try:
        result1 = test_create_batch()
        batch_id = result1['id']
        
        test_duplicate_submit()
        test_get_batches()
        batch_detail = test_get_batch_detail(batch_id)
        
        item_id = batch_detail['items'][2]['id']
        test_modify_item(item_id)
        test_get_change_history(item_id)
        
        test_statistics()
        test_download_reports(batch_id)
        
        print("\n" + "=" * 60)
        print("所有测试完成！")
        print("=" * 60)
        
    except Exception as e:
        print(f"测试过程中出错: {e}")
        import traceback
        traceback.print_exc()
