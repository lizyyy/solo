import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

def test_create_anomaly():
    print_section("1. 创建单条异常记录")
    
    data = {
        "bus_id": "BUS999",
        "driver_id": "DRV999",
        "driver_name": "测试司机",
        "route_name": "测试线路",
        "scheduled_time": datetime.now().isoformat(),
        "actual_time": (datetime.now() + timedelta(minutes=25)).isoformat(),
        "anomaly_type": "test_type",
        "responsible_person": "测试负责人",
        "notes": "这是一条测试记录"
    }
    
    response = requests.post(f"{BASE_URL}/api/anomalies/", json=data)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"创建成功! 异常ID: {result['anomaly_id']}")
        print(f"延误分钟: {result['delay_minutes']}")
        return result['anomaly_id']
    else:
        print(f"失败: {response.text}")
        return None

def test_get_summary():
    print_section("2. 获取数据摘要")
    
    response = requests.get(f"{BASE_URL}/api/anomalies/summary")
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))

def test_filter_anomalies():
    print_section("3. 筛选异常记录")
    
    filters = [
        ("按负责人筛选", {"responsible_person": "李调度"}),
        ("按状态筛选", {"status": "pending"}),
        ("按异常类型筛选", {"anomaly_type": "traffic_delay"}),
    ]
    
    for desc, params in filters:
        print(f"\n--- {desc} ---")
        response = requests.get(f"{BASE_URL}/api/anomalies/", params=params)
        if response.status_code == 200:
            results = response.json()
            print(f"找到 {len(results)} 条记录")
            for r in results[:2]:
                print(f"  - {r['anomaly_id']}: {r['driver_name']} - {r['route_name']}")

def test_update_anomaly(anomaly_id):
    print_section("4. 更新异常记录")
    
    data = {
        "status": "resolved",
        "notes": "已复核，责任判定为客观原因导致延误"
    }
    
    response = requests.put(f"{BASE_URL}/api/anomalies/{anomaly_id}", json=data)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"更新成功! 状态: {result['status']}")
        print(f"备注: {result['notes']}")

def test_batch_operation():
    print_section("5. 批量导入测试（含成功/失败场景）")
    
    batch_data = [
        {
            "bus_id": "BATCH01",
            "driver_id": "DRVB01",
            "driver_name": "批量司机1",
            "route_name": "批量线路1",
            "scheduled_time": datetime.now().isoformat(),
            "actual_time": (datetime.now() + timedelta(minutes=10)).isoformat(),
            "anomaly_type": "batch_test",
            "responsible_person": "批量负责人1"
        },
        {
            "bus_id": "BATCH02",
            "driver_id": "DRVB02",
            "driver_name": "批量司机2",
            "route_name": "批量线路2",
            "scheduled_time": datetime.now().isoformat(),
            "actual_time": (datetime.now() + timedelta(minutes=20)).isoformat(),
            "anomaly_type": "batch_test",
            "responsible_person": "批量负责人2"
        }
    ]
    
    response = requests.post(f"{BASE_URL}/api/anomalies/batch/", json=batch_data)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"成功: {result['success_count']} 条")
        print(f"失败: {result['failure_count']} 条")
        print(f"成功ID: {result['successful_ids']}")
        if result['failed_ids']:
            print(f"失败ID: {result['failed_ids']}")
            print(f"错误: {result['errors']}")
        return result['successful_ids']
    return []

def test_retry_operation(successful_ids):
    print_section("6. 批量重试/更新测试")
    
    if not successful_ids:
        print("没有可重试的ID")
        return
    
    test_ids = successful_ids[:1] + ["INVALID_ID_12345"]
    print(f"尝试更新ID: {test_ids}")
    
    response = requests.put(
        f"{BASE_URL}/api/anomalies/batch/retry",
        params={"status": "resolved"},
        json=test_ids
    )
    
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"成功: {result['success_count']} 条")
        print(f"失败: {result['failure_count']} 条")
        print(f"成功ID: {result['successful_ids']}")
        if result['failed_ids']:
            print(f"失败ID: {result['failed_ids']}")
            print(f"错误: {result['errors']}")

def test_export():
    print_section("7. 导出报告测试")
    
    formats = ["excel", "csv"]
    for fmt in formats:
        print(f"\n--- 导出 {fmt} 格式 ---")
        response = requests.get(
            f"{BASE_URL}/api/export/anomalies",
            params={"format": fmt, "status": "pending"}
        )
        print(f"状态码: {response.status_code}")
        if response.status_code == 200:
            print(f"导出成功! 文件名: {response.headers.get('content-disposition')}")

def main():
    print("校车调度异常处理系统 - 完整流程测试")
    print("="*60)
    
    anomaly_id = test_create_anomaly()
    test_get_summary()
    test_filter_anomalies()
    
    if anomaly_id:
        test_update_anomaly(anomaly_id)
    
    batch_ids = test_batch_operation()
    test_retry_operation(batch_ids)
    test_export()
    
    print_section("测试完成")

if __name__ == "__main__":
    main()
