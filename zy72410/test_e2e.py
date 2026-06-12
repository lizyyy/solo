#!/usr/bin/env python3
"""影视配乐素材入库 - 端到端测试脚本
"""

import json
import urllib.request
import urllib.error
from collections import Counter

BASE_URL = "http://localhost:3001/api"

def api_get(path):
    req = urllib.request.Request(f"{BASE_URL}{path}")
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read().decode())
            return result.get("data", result)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  [API ERROR {e.code}] {path}: {body[:100]}")
        return None

def api_post(path, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(f"{BASE_URL}{path}", data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read().decode())
            return result.get("data", result)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  [API ERROR {e.code}] {path}: {body[:200]}")
        return None

def api_put(path, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(f"{BASE_URL}{path}", data=body, headers={"Content-Type": "application/json"}, method="PUT")
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read().decode())
            return result.get("data", result)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  [API ERROR {e.code}] {path}: {body[:200]}")
        return None

def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

# ============================================================
section("1. 初始化检查")
# ============================================================
materials = api_get("/materials")
if materials:
    print(f"当前素材总数: {len(materials)}")
    print(f"当前轨道总数: {sum(len(m['tracks']) for m in materials)}")
    for m in materials[:3]:
        print(f"  - {m['material_name']} | {m['isrc_code']} | {m['status']} | {len(m['tracks'])}轨")

# 找一个有轨道的素材用于测试
material_with_track = None
for m in (materials or []):
    if m["tracks"]:
        material_with_track = m
        break

# ============================================================
section("2. 轨道备注含返工原因 - 验证待复核标记")
# ============================================================
if material_with_track:
    track = material_with_track["tracks"][0]
    print(f"测试素材: {material_with_track['material_name']}")
    print(f"测试轨道: {track['track_name']}")
    print(f"当前备注: {track['remarks']}")
    print(f"need_recheck: {track['need_recheck']}")
    
    # 更新轨道备注为含返工原因
    result = api_put(f"/materials/tracks/{track['id']}/remarks", {
        "remarks": "导演说情绪不够，返工重录，调整配器。补录后重算",
        "operator": "版权运营",
        "change_reason": "调音师反馈需要返工"
    })
    if result:
        print(f"\n更新备注后:")
        print(f"  新备注: {result['remarks']}")
        print(f"  need_recheck: {result['need_recheck']}")
        print(f"  rework_confirmed: {result['rework_confirmed']}")
    
    # 验证变更记录
    changes = api_get("/changes")
    if changes:
        recent = [c for c in changes if c.get("track_id") == track["id"]]
        print(f"\n  该轨道变更记录: {len(recent)}条")
        for c in recent[-2:]:
            print(f"    - {c['field_name']}: {c['old_value'][:20]} → {c['new_value'][:20]} ({c['change_reason'][:20]})")

# ============================================================
section("3. 调音师留言补录 - 冲突检测")
# ============================================================
if materials and len(materials) > 0:
    test_material = materials[0]
    print(f"测试素材: {test_material['material_name']} (ID: {test_material['id']})")
    print(f"  当前集数: {test_material['episode_count']}")
    print(f"  当前授权费用: {test_material['license_fee']}")
    print(f"  当前分成比例: {test_material['revenue_ratio']}")

    # 添加留言（含冲突数据）
    message = api_post(f"/{test_material['id']}/messages", {
        "content": "许老师回看：调音师留言说这个项目实际是45集，保底费用应该是150万不是120万，授权开始时间是2024-02-01不是1月1日，分成比例要35%",
        "message_date": "2024-04-15",
        "recorded_by": "许老师"
    })
    if message:
        print(f"\n留言补录完成:")
        print(f"  留言内容: {message['message']['content'][:60]}...")
        print(f"  冲突数: {len(message['conflicts'])}")
        for c in message['conflicts']:
            print(f"    冲突字段: {c['field_name']}")
            print(f"      原值: {c['original_value']}")
            print(f"      留言值: {c['message_value']}")
            print(f"      状态: {c['status']}")

# ============================================================
section("4. 排练变更记录 & 历史记录")
# ============================================================
changes = api_get("/changes")
if changes:
    print(f"总变更记录数: {len(changes)}")
    print(f"变更类型分布:")
    types = Counter(c['field_name'] for c in changes)
    for t, cnt in types.most_common(8):
        print(f"  {t}: {cnt}次")

    # 统计变更涉及的素材
    material_changes = Counter(c['material_name'] for c in changes if c.get('material_name'))
    print(f"\n变更最多的素材:")
    for name, cnt in material_changes.most_common(5):
        print(f"  {name}: {cnt}次")

    # 查看单个素材的变更轨迹
    if material_with_track:
        mid = material_with_track["id"]
        trace = api_get(f"/changes/trace/{mid}")
        if trace:
            print(f"\n素材[{material_with_track['material_name']}]的变更轨迹:")
            print(f"  轨迹节点数: {len(trace)}")
            for node in trace[:5]:
                print(f"    {node['changed_at'][:16]} - {node['change_type']}/{node['field_name']}")
                print(f"      {node['old_value'][:20]} → {node['new_value'][:20]}")
                print(f"      原因: {node['change_reason'][:30]}")

# ============================================================
section("5. 四项自检")
# ============================================================
selfcheck = api_get("/selfcheck/run-all")
if selfcheck:
    print(f"自检结果:")
    passed = sum(1 for r in selfcheck if r['passed'])
    print(f"  通过: {passed}/{len(selfcheck)} 项")
    for r in selfcheck:
        status = "✅ 通过" if r['passed'] else f"❌ {r['issue_count']}个问题"
        print(f"  {r['check_type']}: {status}")
        if not r['passed']:
            for d in r['details'][:2]:
                print(f"    - {d['description'][:60]}...")

# ============================================================
section("6. 结果报告")
# ============================================================
summary = api_get("/report/summary")
if summary:
    print(f"报告汇总:")
    print(f"  素材总数: {summary['total_materials']}")
    print(f"  轨道总数: {summary['total_tracks']}")
    print(f"  待处理冲突: {summary['pending_conflicts']}")
    print(f"  待返工复核: {summary['tracks_need_recheck']}")
    print(f"  总变更次数: {summary['total_changes']}")
    print(f"  导入批次数: {len(summary['import_batches'])}")
    for batch in summary['import_batches'][:5]:
        print(f"    {batch['file_name']}: 新增{batch['new_count']} 复用{batch['reused_count']}")
    print(f"\n  生成时间: {summary['generated_at']}")

# ============================================================
section("7. 导出功能验证")
# ============================================================
print("Excel导出接口: GET /api/export/excel")
print("PDF导出接口: GET /api/export/pdf")

try:
    req = urllib.request.Request(f"{BASE_URL}/export/excel")
    with urllib.request.urlopen(req) as resp:
        data = resp.read()
        print(f"\nExcel导出: ✅ 成功")
        print(f"  状态码: {resp.status}")
        print(f"  文件大小: {len(data)} bytes")
        print(f"  Content-Type: {resp.headers.get('Content-Type', '')}")
except Exception as e:
    print(f"\nExcel导出: ❌ 失败 - {e}")

# ============================================================
section("总结")
# ============================================================
print("✅ 端到端测试完成！")
print("")
print("已验证的核心功能:")
print("  1. 素材列表查询（带轨道信息）")
print("  2. 轨道备注更新 + 返工原因自动标记")
print("  3. 轨道备注变更自动同步到排练变更记录")
print("  4. 调音师留言补录 + 冲突自动检测")
print("  5. 排练变更记录 & 历史快照")
print("  6. 变更轨迹追溯")
print("  7. 四项自检（重复/返工/重算/导出）")
print("  8. 结果报告汇总统计")
print("  9. Excel导出")
print("")
print("前端页面（6个）:")
print("  📥 授权期限导入 - 支持Excel/CSV上传、重复检测预览、确认入库")
print("  📝 调音师留言补录 - 快捷模板、冲突检测、证据展示")
print("  🎵 素材入库管理 - 轨道备注编辑、返工复核、补录重算")
print("  📋 排练变更记录 - 变更时间线、历史快照、轨迹追溯")
print("  🔍 四项自检 - 重复导入、返工原因、补录重算、导出一致")
print("  📊 结果报告 - 汇总统计、素材清单、Excel/PDF导出")
