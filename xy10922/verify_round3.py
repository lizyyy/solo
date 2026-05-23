import json
import urllib.request

BASE = "http://localhost:8000"

def curl(url, method="GET", data=None):
    req = urllib.request.Request(f"{BASE}{url}", method=method)
    if data:
        req.add_header("Content-Type", "application/json")
        req.data = json.dumps(data).encode()
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

print("=== 第三轮修复完整验证 ===\n")

print("1. 创建新预约（scheduled 状态，车位2）")
r = curl("/appointments/", "POST", {
    "visitor_id": 1,
    "parking_spot_id": 2,
    "meeting_room": "完整验证会议室",
    "start_time": "2026-05-24T10:00:00",
    "end_time": "2026-05-24T12:00:00"
})
appt_id = r['data']['appointment']['id']
spot_status = curl("/parking-spots/2")['data']['parking_spot']['status']
print(f"   预约ID: {appt_id}")
print(f"   车位2状态: {spot_status}")

print("\n2. 为预约生成放行码")
r = curl(f"/appointments/{appt_id}/pass-code", "POST")
code = r['data']['pass_code']['code']
code_status = r['data']['pass_code']['status']
print(f"   放行码: {code}")
print(f"   放行码状态: {code_status}")

print("\n3. PUT取消预约")
r = curl(f"/appointments/{appt_id}", "PUT", {"status": "cancelled"})
print(f"   返回消息: {r['message']}")

print("\n4. 取消后车位2状态")
spot_status = curl("/parking-spots/2")['data']['parking_spot']['status']
print(f"   车位2状态: {spot_status}")

print("\n5. 为已取消的预约再次生成放行码（应拒绝）")
r = curl(f"/appointments/{appt_id}/pass-code", "POST")
print(f"   status: {r['status']}")
print(f"   message: {r['message']}")

print("\n6. 验证已取消预约的放行码（应失败）")
r = curl("/pass-codes/verify", "POST", {"code": code})
print(f"   success: {r['success']}")
print(f"   status: {r['status']}")
print(f"   message: {r['message']}")

print("\n✅ 第三轮所有修复验证完成！")
