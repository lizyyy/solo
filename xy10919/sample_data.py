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

def create_sample_data():
    print("开始创建样例数据...")
    
    locations = [
        {"name": "社区服务中心", "address": "北京市朝阳区某某路1号", "latitude": 39.9042, "longitude": 116.4074, "radius_meters": 100, "require_location_check": True},
        {"name": "老年活动站", "address": "北京市海淀区某某路2号", "latitude": 39.9542, "longitude": 116.3374, "radius_meters": 150, "require_location_check": True},
        {"name": "环保志愿点", "address": "北京市西城区某某路3号", "latitude": 39.9242, "longitude": 116.3874, "radius_meters": 120, "require_location_check": False}
    ]
    
    created_locations = []
    for i, loc in enumerate(locations):
        r = requests.post(f"{BASE_URL}/locations/", json=loc)
        data = print_response(f"创建位置 {i+1}", r)
        if r.status_code == 200:
            created_locations.append(data)
    
    volunteers = [
        {"name": "张三", "phone": "13800138001", "email": "zhangsan@example.com"},
        {"name": "李四", "phone": "13800138002", "email": "lisi@example.com"},
        {"name": "王五", "phone": "13800138003", "email": "wangwu@example.com"},
        {"name": "赵六", "phone": "13800138004", "email": "zhaoliu@example.com"},
        {"name": "钱七", "phone": "13800138005", "email": "qianqi@example.com"}
    ]
    
    created_volunteers = []
    for i, vol in enumerate(volunteers):
        r = requests.post(f"{BASE_URL}/volunteers/", json=vol)
        data = print_response(f"创建志愿者 {i+1}", r)
        if r.status_code == 200:
            created_volunteers.append(data)
    
    shifts = []
    today = datetime.now()
    for i in range(5):
        shift_date = today + timedelta(days=i)
        start_time = shift_date.replace(hour=9, minute=0, second=0, microsecond=0)
        end_time = shift_date.replace(hour=17, minute=0, second=0, microsecond=0)
        
        loc_idx = i % len(created_locations)
        shifts.append({
            "name": f"第{i+1}期志愿服务",
            "location_id": created_locations[loc_idx]["id"],
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "capacity": 10,
            "description": f"第{i+1}期社区志愿服务活动"
        })
    
    created_shifts = []
    for i, shift in enumerate(shifts):
        r = requests.post(f"{BASE_URL}/shifts/", json=shift)
        data = print_response(f"创建班次 {i+1}", r)
        if r.status_code == 200:
            created_shifts.append(data)
    
    checkins = []
    for i in range(min(3, len(created_volunteers))):
        checkins.append({
            "volunteer_id": created_volunteers[i]["id"],
            "shift_id": created_shifts[0]["id"],
            "checkin_lat": created_locations[0]["latitude"],
            "checkin_lng": created_locations[0]["longitude"]
        })
    
    created_checkins = []
    for i, checkin in enumerate(checkins):
        r = requests.post(f"{BASE_URL}/checkins/", json=checkin)
        data = print_response(f"志愿者签到 {i+1}", r)
        if r.status_code == 200 and data.get("success"):
            created_checkins.append(data["data"])
    
    if created_checkins:
        for i, checkin in enumerate(created_checkins[:2]):
            r = requests.post(
                f"{BASE_URL}/checkins/{checkin['id']}/checkout",
                json={"checkout_lat": checkin["checkin_lat"], "checkout_lng": checkin["checkin_lng"]}
            )
            print_response(f"志愿者签退 {i+1}", r)
    
    if created_volunteers and created_shifts:
        swap_data = {
            "shift_id": created_shifts[0]["id"],
            "requester_id": created_volunteers[0]["id"],
            "acceptor_id": created_volunteers[3]["id"],
            "reason": "有事请假，请求替班"
        }
        r = requests.post(f"{BASE_URL}/swaps/", json=swap_data)
        swap = print_response("创建替班申请", r)
        
        if r.status_code == 200:
            approval_data = {
                "status": "approved",
                "approval_remarks": "同意替班申请",
                "approver_id": 1
            }
            r = requests.post(f"{BASE_URL}/swaps/{swap['id']}/approve", json=approval_data)
            print_response("审批替班申请", r)
    
    if created_checkins:
        cert_data = {
            "volunteer_id": created_checkins[0]["volunteer_id"],
            "checkin_id": created_checkins[0]["id"],
            "claimed_duration": 8.0
        }
        r = requests.post(f"{BASE_URL}/certifications/", json=cert_data)
        cert = print_response("创建时长认证", r)
        
        if r.status_code == 200:
            verify_data = {
                "verified_duration": 7.5,
                "status": "verified",
                "verification_remarks": "扣除休息时间，实际服务时长7.5小时",
                "verifier_id": 1
            }
            r = requests.post(f"{BASE_URL}/certifications/{cert['id']}/verify", json=verify_data)
            print_response("验证时长认证", r)
    
    if created_checkins and len(created_checkins) > 1:
        correction_data = {
            "checkin_id": created_checkins[1]["id"],
            "new_duration": 6.0,
            "reason": "系统计算有误，人工修正服务时长",
            "corrector_id": 1
        }
        r = requests.post(f"{BASE_URL}/corrections/", json=correction_data)
        print_response("人工修正签到记录", r)
    
    report_data = {}
    r = requests.post(f"{BASE_URL}/reports/", json=report_data)
    report = print_response("生成服务报告", r)
    
    if r.status_code == 200 and report.get("id"):
        export_data = {
            "report_id": report["id"],
            "format": "json"
        }
        r = requests.post(f"{BASE_URL}/reports/export", json=export_data)
        print_response("导出报告 (JSON)", r)
    
    print("\n" + "="*60)
    print("样例数据创建完成!")
    print("="*60)
    print(f"\n查看 API 文档: {BASE_URL}/docs")
    print(f"查看志愿者列表: {BASE_URL}/volunteers/")
    print(f"查看班次列表: {BASE_URL}/shifts/")
    print(f"查看签到记录: {BASE_URL}/checkins/")
    print(f"查看异常日志: {BASE_URL}/exceptions/")

if __name__ == "__main__":
    try:
        create_sample_data()
    except requests.exceptions.ConnectionError:
        print("\n错误: 无法连接到 API 服务!")
        print("请先运行以下命令启动服务:")
        print("  python main.py")
        print("或:")
        print("  uvicorn main:app --reload")
    except Exception as e:
        print(f"\n发生错误: {e}")