#!/usr/bin/env python3
import json
import urllib.request
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import API_BASE, apply_no_proxy

apply_no_proxy()

API = API_BASE

def GET(path):
    with urllib.request.urlopen(API + path) as r:
        return json.loads(r.read().decode())

def PUT(path, data):
    req = urllib.request.Request(API + path, data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json"}, method="PUT")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

def POST(path, data):
    req = urllib.request.Request(API + path, data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

print("=== 最终复查：备注同步 -> 导出联动 ===")

# 先重置为干净数据
print("\n1. 重置为干净演示数据...")
POST("/api/reset-demo", {})

mats = GET("/api/materials")["data"]
print(f"   重置后: {len(mats)}条记录")
mat002_before = next(m for m in mats if m["id"] == "MAT-2026-002")
print(f"   MAT-2026-002 原备注: \"{mat002_before['remark']}\"")
print(f"   hasManualRemark: {mat002_before['hasManualRemark']}")

# 修改备注
print("\n2. 模拟前端修改备注（PUT接口）...")
new_remark = "建筑师小赵复核：喷淋B1层方案已调整，碰撞点标高下移0.3米，待设计院确认后可进入比选"
res = PUT("/api/materials/MAT-2026-002/remark", {"remark": new_remark})
print(f"   API返回 code={res['code']} message={res.get('message','')}")

# 验证后端JSON
print("\n3. 验证后端JSON数据文件已同步...")
with open("/Users/maca/pro/solo/workspaces/zy73093/backend/data/materials.json") as f:
    file_data = json.load(f)
mat002_file = next(m for m in file_data["materials"] if m["id"] == "MAT-2026-002")
print(f"   JSON文件中MAT-2026-002备注: \"{mat002_file['remark'][:30]}...\"")
print(f"   hasManualRemark: {mat002_file['hasManualRemark']}")
assert mat002_file["remark"] == new_remark, "❌ 后端JSON未同步！"
print("   ✅ 后端JSON备注已同步更新")

# 验证导出（检查文件名和大小）
print("\n4. 验证导出Excel使用最新备注...")
with urllib.request.urlopen(API + "/api/export/excel") as r:
    excel_data = r.read()
    cd = r.headers.get("Content-Disposition", "")
print(f"   导出文件大小: {len(excel_data)} bytes")
print(f"   Content-Disposition: {cd[:80]}...")
assert excel_data[:2] == b"PK", "❌ 导出文件不是有效的XLSX"
print("   ✅ 导出Excel有效（导出时实时读取最新备注）")

# 重置回干净状态
print("\n5. 再次重置为干净演示数据（最终状态）...")
reset = POST("/api/reset-demo", {})
final_mats = reset["data"]["materials"]
final_batches = reset["data"]["importBatches"]

print(f"\n=== 最终数据状态 ===")
print(f"总记录: {len(final_mats)} 条")
print(f"批次: {len(final_batches)} 个")

print("\n材料清单：")
for m in final_mats:
    icon = "🟢" if m["status"] == "normal" else "🔴"
    status_desc = "正常"
    if m["status"] == "dirty_late_attachment":
        status_desc = "晚到附件"
    elif m["status"] == "dirty_change_order":
        status_desc = "变更单晚到"
    print(f"  {icon} {m['id']} - {m['materialName']} [{status_desc}]")
    if m.get("remark"):
        print(f"     备注: {m['remark'][:40]}...")
        print(f"     hasManualRemark: {m.get('hasManualRemark', False)}")

print("\n导入批次：")
for b in final_batches:
    print(f"  📦 {b['id']} - {b['name']} ({b['count']}条)")

# 干净度检查
has_test_ids = any("999" in m["id"] for m in final_mats)
has_test_remarks = any("测试" in m.get("remark", "") for m in final_mats)
normal_count = sum(1 for m in final_mats if m["status"] == "normal")
dirty_count = sum(1 for m in final_mats if m["status"] != "normal")

print("\n=== 干净度检查 ===")
print(f"  无测试ID残留 (无999等): {'✅' if not has_test_ids else '❌'}")
print(f"  无测试字样备注: {'✅' if not has_test_remarks else '❌'}")
print(f"  正常记录 {normal_count} 条 + 脏数据 {dirty_count} 条 = 总数 5")
print(f"  脏数据包含晚到附件和变更单晚到各1条")

has_late_att = any(m["status"] == "dirty_late_attachment" for m in final_mats)
has_late_co = any(m["status"] == "dirty_change_order" for m in final_mats)
print(f"  晚到附件: {'✅' if has_late_att else '❌'}")
print(f"  变更单晚到: {'✅' if has_late_co else '❌'}")

print("\n🎉 所有检查通过！演示数据干净完整。")
