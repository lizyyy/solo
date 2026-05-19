#!/usr/bin/env python3
import requests
import time
import subprocess
import sys
import os

BASE_URL = "http://localhost:8001"

def wait_for_server(timeout=30):
    print("等待服务启动...")
    start = time.time()
    while time.time() - start < timeout:
        try:
            response = requests.get(f"{BASE_URL}/", timeout=2)
            if response.status_code == 200:
                print("服务已启动!")
                return True
        except:
            pass
        time.sleep(1)
    print("服务启动超时!")
    return False

def test_import_sample():
    print("\n=== 测试留样台账Excel导入 ===")
    if not os.path.exists("留样台账.xlsx"):
        print("先生成测试数据...")
        subprocess.run([sys.executable, "generate_test_data.py"])
    
    with open("留样台账.xlsx", "rb") as f:
        files = {"file": ("留样台账.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        data = {"imported_by": "测试用户"}
        response = requests.post(f"{BASE_URL}/api/import/sample", files=files, data=data)
    
    result = response.json()
    print(f"导入结果: {result}")
    return result.get("batch_id")

def test_import_temperature():
    print("\n=== 测试温度日志CSV导入 ===")
    if not os.path.exists("温度日志.csv"):
        print("先生成测试数据...")
        subprocess.run([sys.executable, "generate_test_data.py"])
    
    with open("温度日志.csv", "rb") as f:
        files = {"file": ("温度日志.csv", f, "text/csv")}
        data = {"imported_by": "测试用户"}
        response = requests.post(f"{BASE_URL}/api/import/temperature", files=files, data=data)
    
    result = response.json()
    print(f"导入结果: {result}")
    return result.get("batch_id")

def test_query_records():
    print("\n=== 测试数据查询 ===")
    
    params = {
        "status": "异常",
        "limit": 10
    }
    response = requests.get(f"{BASE_URL}/api/records", params=params)
    result = response.json()
    print(f"查询异常记录: 共 {result['total']} 条")
    for r in result['data'][:3]:
        print(f"  - {r['store_name']} {r['item_name']}: {r['anomaly_type']}")

    params = {
        "responsible_person": "张三",
        "limit": 5
    }
    response = requests.get(f"{BASE_URL}/api/records", params=params)
    result = response.json()
    print(f"\n按负责人'张三'查询: 共 {result['total']} 条")

def test_get_errors(batch_id):
    print("\n=== 查看导入错误 ===")
    if batch_id:
        response = requests.get(f"{BASE_URL}/api/import/errors/{batch_id}")
        result = response.json()
        print(f"批次 {batch_id} 的错误记录: {result['total']} 条")
        for e in result['data']:
            print(f"  行 {e['row_number']}: {e['error_reason']}")
            print(f"    建议: {e['fix_suggestion']}")

def test_import_history():
    print("\n=== 查看导入历史 ===")
    response = requests.get(f"{BASE_URL}/api/import/history")
    result = response.json()
    print(f"共 {result['total']} 次导入记录")
    for h in result['data'][:3]:
        print(f"  - {h['file_name']}: 成功 {h['success_count']} 条, 失败 {h['error_count']} 条")

def test_stats_summary():
    print("\n=== 统计摘要 ===")
    response = requests.get(f"{BASE_URL}/api/stats/summary")
    result = response.json()
    print(f"总记录数: {result['total_records']}")
    print(f"正常记录: {result['normal_records']}")
    print(f"异常记录: {result['abnormal_records']}")
    print("异常分布:")
    for a in result['anomaly_distribution']:
        print(f"  - {a['type']}: {a['count']} 条")

def test_export_report():
    print("\n=== 测试报告导出 ===")
    params = {"status": "异常"}
    response = requests.get(f"{BASE_URL}/api/export/report", params=params)
    if response.status_code == 200:
        filename = response.headers.get('content-disposition', '').split('filename=')[-1].strip('"')
        with open(filename, 'wb') as f:
            f.write(response.content)
        print(f"报告已导出: {filename}")
    else:
        print("导出失败")

def main():
    print("=" * 50)
    print("门店品控数据管理系统 - API测试脚本")
    print("=" * 50)

    if not wait_for_server():
        print("请先启动服务: python main.py")
        return

    batch1 = test_import_sample()
    batch2 = test_import_temperature()
    
    if batch1:
        test_get_errors(batch1)
    if batch2:
        test_get_errors(batch2)
    
    test_import_history()
    test_query_records()
    test_stats_summary()
    test_export_report()

    print("\n" + "=" * 50)
print("所有测试完成!")
print(f"查看API文档: {BASE_URL}/docs")
print("可查看目录下生成的品控报告Excel文件")
print("重启服务后可再次运行测试脚本来验证数据持久化功能")
print("=" * 50)

if __name__ == "__main__":
    main()
