import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

def print_response(title, response):
    print(f"\n{'='*60}")
    print(f"{title}")
    print(f"{'='*60}")
    print(f"状态码: {response.status_code}")
    try:
        data = response.json()
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return data
    except:
        print(response.text)
        return response.text

def test_location_check():
    print("开始测试位置校验功能...")
    
    loc_data = {
        "name": "测试签到点",
        "address": "测试地址",
        "latitude": 39.9042,
        "longitude": 116.4074,
        "radius_meters": 100,
        "require_location_check": True
    }
    r = requests.post(f"{BASE_URL}/locations/", json=loc_data)
    location = print_response("创建测试位置", r)
    if r.status_code != 200:
        print("创建位置失败")
        return
    location_id = location["id"]
    
    vol_data = {"name": "测试志愿者", "phone": "13900139001", "email": "test@example.com"}
    r = requests.post(f"{BASE_URL}/volunteers/", json=vol_data)
    volunteer = print_response("创建测试志愿者", r)
    if r.status_code != 200:
        print("创建志愿者失败")
        return
    volunteer_id = volunteer["id"]
    
    tomorrow = datetime.now() + timedelta(days=1)
    shift_data = {
        "name": "测试班次",
        "location_id": location_id,
        "start_time": tomorrow.replace(hour=9, minute=0).isoformat(),
        "end_time": tomorrow.replace(hour=17, minute=0).isoformat(),
        "capacity": 10
    }
    r = requests.post(f"{BASE_URL}/shifts/", json=shift_data)
    shift = print_response("创建测试班次", r)
    if r.status_code != 200:
        print("创建班次失败")
        return
    shift_id = shift["id"]
    
    print("\n" + "="*60)
    print("测试1: 位置超出范围 - 应该被拒绝")
    print("="*60)
    checkin_data = {
        "volunteer_id": volunteer_id,
        "shift_id": shift_id,
        "checkin_lat": 40.0000,
        "checkin_lng": 116.5000
    }
    r = requests.post(f"{BASE_URL}/checkins/", json=checkin_data)
    result = print_response("异常位置签到", r)
    
    if r.status_code == 400:
        print("✓ 测试1通过: 异常位置被正确拒绝")
    else:
        print("✗ 测试1失败: 异常位置未被拒绝")
    
    print("\n" + "="*60)
    print("测试2: 位置正确位置 - 应该成功")
    print("="*60)
    checkin_data2 = {
        "volunteer_id": volunteer_id,
        "shift_id": shift_id,
        "checkin_lat": 39.9042,
        "checkin_lng": 116.4074
    }
    r = requests.post(f"{BASE_URL}/checkins/", json=checkin_data2)
    result2 = print_response("正确位置签到", r)
    
    if r.status_code == 200 and result2.get("success"):
        print("✓ 测试2通过: 正确位置签到成功")
    else:
        print("✗ 测试2失败: 正确位置签到失败")
    
    print("\n" + "="*60)
    print("测试3: 不提供经纬度 - 应该被拒绝（该位置要求位置校验")
    print("="*60)
    checkin_data3 = {
        "volunteer_id": volunteer_id + 1,
        "shift_id": shift_id
    }
    r = requests.post(f"{BASE_URL}/checkins/", json=checkin_data3)
    result3 = print_response("无坐标签到", r)
    
    if r.status_code == 400:
        print("✓ 测试3通过: 无坐标被正确拒绝")
    else:
        print("✗ 测试3失败: 无坐标未被拒绝")
    
    print("\n" + "="*60)
    print("测试4: skip_location_check=true - 跳过位置校验应该成功")
    print("="*60)
    vol_data2 = {"name": "测试志愿者2", "phone": "13900139002", "email": "test2@example.com"}
    r = requests.post(f"{BASE_URL}/volunteers/", json=vol_data2)
    volunteer2 = r.json()
    
    checkin_data4 = {
        "volunteer_id": volunteer2["id"],
        "shift_id": shift_id,
        "skip_location_check": True
    }
    r = requests.post(f"{BASE_URL}/checkins/", json=checkin_data4)
    result4 = print_response("跳过位置校验签到", r)
    
    if r.status_code == 200 and result4.get("success"):
        print("✓ 测试4通过: 跳过位置校验签到成功")
    else:
        print("✗ 测试4失败")
    
    print("\n" + "="*60)
    print("测试5: 志愿者不存在 - 应该被拒绝")
    print("="*60)
    checkin_data5 = {
        "volunteer_id": 99999,
        "shift_id": shift_id,
        "checkin_lat": 39.9042,
        "checkin_lng": 116.4074
    }
    r = requests.post(f"{BASE_URL}/checkins/", json=checkin_data5)
    result5 = print_response("不存在志愿者签到", r)
    
    if r.status_code == 400:
        print("✓ 测试5通过: 不存在志愿者被正确拒绝")
    else:
        print("✗ 测试5失败: 不存在志愿者未被拒绝")
    
    print("\n" + "="*60)
    print("测试6: 查看异常日志 - 验证异常可追溯")
    print("="*60)
    r = requests.get(f"{BASE_URL}/exceptions/")
    exceptions = print_response("异常日志列表", r)
    
    location_errors = [e for e in exceptions if e['exception_type'] == 'location_error']
    checkin_errors = [e for e in exceptions if e['exception_type'] == 'checkin_error']
    
    print(f"\n异常统计: 位置错误 {len(location_errors)} 条, 签到错误 {len(checkin_errors)} 条")
    if len(location_errors) >= 1 and len(checkin_errors) >= 1:
        print("✓ 异常日志可追溯: 包含位置校验和志愿者校验的异常记录")
    else:
        print("✗ 异常日志不完整")
    
    print("\n" + "="*60)
    print("测试7: 验证异常日志包含原始输入")
    print("="*60)
    if exceptions and len(exceptions) > 0:
        latest = exceptions[0]
        print(f"最新异常 ID: {latest['id']}")
        print(f"异常类型: {latest['exception_type']}")
        print(f"关联记录: {latest['related_type']}={latest['related_id']}")
        print(f"原始输入: {latest['raw_input'][:100]}...")
        print(f"处理结论: {latest['handling_conclusion']}")
        print("✓ 异常日志包含完整追溯信息")
    
    print("\n" + "="*60)
    print("所有测试完成!")
    print("="*60)

if __name__ == "__main__":
    try:
        test_location_check()
    except requests.exceptions.ConnectionError:
        print("\n错误: 无法连接到 API 服务!")
        print("请先运行: python main.py")
    except Exception as e:
        print(f"\n发生错误: {e}")
        import traceback
        traceback.print_exc()