import requests
import json
import os

BASE_URL = "http://localhost:8080"
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')

def import_json_data(endpoint, json_file):
    file_path = os.path.join(DATA_DIR, json_file)
    if not os.path.exists(file_path):
        print(f"Warning: {file_path} not found, skipping")
        return None
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    url = f"{BASE_URL}{endpoint}"
    response = requests.post(url, json=data)
    
    if response.status_code in [200, 201]:
        result = response.json()
        print(f"✓ {endpoint}: 导入成功 {result.get('imported', 0)} 条")
        if result.get('errors', 0) > 0:
            print(f"  ⚠ 错误: {result.get('errors')} 条")
        return result
    else:
        print(f"✗ {endpoint}: 导入失败 ({response.status_code})")
        print(f"  响应: {response.text[:200]}")
        return None

def main():
    print("=" * 50)
    print("换电柜系统 - 数据初始化")
    print("=" * 50)
    print()
    
    print("1. 检查服务是否运行...")
    try:
        response = requests.get(BASE_URL, timeout=5)
        if response.status_code != 200:
            print("✗ 服务响应异常，请先启动服务: python app.py")
            return
        print("✓ 服务运行正常")
    except requests.exceptions.ConnectionError:
        print("✗ 无法连接到服务，请先启动: python app.py")
        return
    
    print()
    print("2. 导入柜门传感器日志...")
    import_json_data("/api/logs/door-sensor", "door_sensor_logs.json")
    
    print()
    print("3. 导入温度曲线日志...")
    import_json_data("/api/logs/temperature", "temperature_logs.json")
    
    print()
    print("4. 导入换电记录...")
    import_json_data("/api/logs/swap-records", "swap_records.json")
    
    print()
    print("5. 导入维修工单...")
    import_json_data("/api/logs/maintenance", "maintenance_orders.json")
    
    print()
    print("6. 触发争议检测...")
    url = f"{BASE_URL}/api/disputes/detect"
    response = requests.post(url, json={})
    if response.status_code == 200:
        result = response.json()
        print(f"✓ 检测到 {result.get('detected', 0)} 条争议")
        if result.get('errors', 0) > 0:
            print(f"  ⚠ 检测错误: {result.get('errors')}")
    else:
        print(f"✗ 争议检测失败 ({response.status_code})")
    
    print()
    print("=" * 50)
    print("数据初始化完成！")
    print("=" * 50)
    print()
    print("可用端点:")
    print(f"  GET  {BASE_URL}/api/batteries    - 电池列表")
    print(f"  GET  {BASE_URL}/api/doors        - 柜门列表")
    print(f"  GET  {BASE_URL}/api/swaps        - 换电记录")
    print(f"  GET  {BASE_URL}/api/maintenance  - 维修工单")
    print(f"  GET  {BASE_URL}/api/disputes     - 争议列表")
    print()

if __name__ == "__main__":
    main()
