#!/usr/bin/env python3
import sys
import os
import time
import threading
import requests
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from app import app

def run_server():
    app.run(host='127.0.0.1', port=5002, debug=False, use_reloader=False)

print("=" * 60)
print("🔍 API 完整流程测试（明细/历史/导出 三者数据一致性验证）")
print("=" * 60)
print()

t = threading.Thread(target=run_server, daemon=True)
t.start()
time.sleep(3)

base = 'http://127.0.0.1:5002'

# 1. 查点位列表
print("【1/8】获取点位列表...")
r = requests.get(f'{base}/api/points')
points = r.json()
print(f"  ✅ 共 {len(points)} 条点位")
for p in points:
    tag = "边界" if p['is_boundary'] else "正常"
    print(f"     {p['id']}: {p['name']} | {tag} | 总分: {p['score']['total']} ({p['score']['level']})")
print()

# 2. 查 point_002 详情（修正前）
print("【2/8】查看 point_002 详情（人工修正前）...")
r = requests.get(f'{base}/api/points/point_002')
p2_before = r.json()
print(f"  交通安全: {p2_before['current_score']['traffic_safety']}")
print(f"  总分: {p2_before['current_score']['total']}")
print(f"  方法: {p2_before['current_score']['method']}")
print(f"  历史记录: {len(p2_before['score_history'])} 条")
print(f"  边界状态: {'是' if p2_before['is_boundary'] else '否'}")
print()

# 3. 第一次地图导出（修正前）
print("【3/8】第一次地图导出（人工修正前）...")
r = requests.post(f'{base}/api/export-map', json={'format': 'geojson'})
export1 = r.json()
print(f"  ✅ 已导出: {export1['filename']}")
print(f"  摘要: {json.dumps(export1['summary'], ensure_ascii=False)}")
feat1 = export1['geojson']['features'][1]['properties']
print(f"  point_002 交通: {feat1['score']['traffic_safety']}")
print(f"  point_002 方法: {feat1['score']['method']}")
print()

# 4. 人工修正 point_002
print("【4/8】执行人工修正: 交通 58.5 → 72.0, 步行 54 → 68...")
payload = {
    'override': {
        'traffic_safety': 72.0,
        'pedestrian_facility': 68.0
    },
    'reason': '项目经理复核：边界点位实际归解放路街道，调整评分'
}
r = requests.post(f'{base}/api/points/point_002/manual-correct', json=payload)
result = r.json()
print(f"  ✅ 修正成功，新总分: {result['new_score']}")
print()

# 5. 验证明细页读取
print("【5/8】验证明细页读取（修正后）...")
r = requests.get(f'{base}/api/points/point_002')
p2_after = r.json()
detail_traffic = p2_after['current_score']['traffic_safety']
print(f"  交通安全: {detail_traffic}  {'✅ 正确' if detail_traffic == 72.0 else '❌ 错误!'}")
print(f"  总分: {p2_after['current_score']['total']}")
print(f"  方法: {p2_after['current_score']['method']}")
print(f"  历史记录: {len(p2_after['score_history'])} 条 (新增1条)")
print(f"  修正原因: {p2_after['manual_correction']['reason']}")
print(f"  修正字段: traffic={p2_after['manual_correction']['traffic_safety']}, pedestrian={p2_after['manual_correction']['pedestrian_facility']}")
print()

# 6. 验证列表页同步
print("【6/8】验证列表页数据同步...")
r = requests.get(f'{base}/api/points')
points_after = r.json()
p2_list = [p for p in points_after if p['id'] == 'point_002'][0]
list_total = p2_list['score']['total']
list_status = p2_list['status']
print(f"  列表页总分: {list_total}")
print(f"  列表页状态: {list_status}")
print(f"  明细页总分: {p2_after['current_score']['total']}")
print(f"  ✅ 列表与明细数据一致" if list_total == p2_after['current_score']['total'] else "  ❌ 不一致!")
print()

# 7. 第二次地图导出（修正后）
print("【7/8】第二次地图导出（人工修正后，验证数据同步）...")
r = requests.post(f'{base}/api/export-map', json={'format': 'geojson'})
export2 = r.json()
print(f"  ✅ 已导出: {export2['filename']}")
print(f"  摘要: {json.dumps(export2['summary'], ensure_ascii=False)}")
feat2 = export2['geojson']['features'][1]['properties']
export_traffic = feat2['score']['traffic_safety']
export_method = feat2['score']['method']
print(f"  point_002 交通: {export_traffic}  {'✅ 一致' if export_traffic == detail_traffic else '❌ 不一致!'}")
print(f"  point_002 方法: {export_method}")
print(f"  人工修正记录: {feat2['manual_correction']}")
print(f"  公交证据: {feat2['bus_evidence']['route']} {feat2['bus_evidence']['stop_name']} | 高峰儿童: {feat2['bus_evidence']['peak_children_count']}")
print(f"  追溯链步数: {len(feat2['audit_trail'])}")
print()

# 8. 验证追溯链完整
print("【8/8】验证追溯链（从人工修正追回公交原始材料）...")
for step in feat2['audit_trail']:
    extra = []
    if 'bus_evidence' in step:
        be = step['bus_evidence']
        extra.append(f"公交: {be['route']} {be['stop_name']}, 高峰儿童: {be['peak_children_count']}")
    if 'correction_evidence' in step:
        ce = step['correction_evidence']
        extra.append(f"修正: {ce['reason']}, 调整: {ce['override_fields']}")
    extra_str = f" [{', '.join(extra)}]" if extra else ""
    print(f"  [{step['step']}] {step['event']}: {step['score']}分 ({step['level']}){extra_str}")
print()

# 最终一致性验证
print("=" * 60)
print("✅ 最终一致性验证:")
print("=" * 60)
print(f"  列表页总分: {list_total}")
print(f"  明细页交通安全: {detail_traffic}")
print(f"  明细页总分: {p2_after['current_score']['total']}")
print(f"  导出文件交通安全: {export_traffic}")
print(f"  导出文件总分: {feat2['score']['total']}")

all_match = (detail_traffic == export_traffic == 72.0 and 
             list_total == p2_after['current_score']['total'] == feat2['score']['total'])
if all_match:
    print(f"\n🎉 三者数据完全一致！人工修正 58.5 → 72.0 修复成功！")
else:
    print(f"\n❌ 数据不一致！")

# 验证追溯链能追回原始材料
print()
print("🔍 追溯链证据验证:")
has_bus_evidence = any('bus_evidence' in s for s in feat2['audit_trail'])
has_correction_evidence = any('correction_evidence' in s for s in feat2['audit_trail'])
print(f"  包含公交原始材料: {'✅ 是' if has_bus_evidence else '❌ 否'}")
print(f"  包含人工修正证据: {'✅ 是' if has_correction_evidence else '❌ 否'}")
print(f"  导出包含bus_evidence: {'✅ 是' if feat2.get('bus_evidence') else '❌ 否'}")
print(f"  导出包含manual_correction: {'✅ 是' if feat2.get('manual_correction') else '❌ 否'}")
print()
print("📁 导出文件:")
print(f"  修正前: {export1['filepath']}")
print(f"  修正后: {export2['filepath']}")
