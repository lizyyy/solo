import sys
import json
sys.path.insert(0, "backend")

from app.service import (
    create_profile,
    import_coordinate_origin,
    attach_inspection_photo,
    update_annotation,
    resolve_conflict,
    export_detail,
    get_profile,
)

print("=" * 60)
print("道路积水深度剖面 - 完整三步工作流演示")
print("含同一障碍物被标了两个名字的冲突场景")
print("=" * 60)

print("\n【步骤①】创建剖面并导入坐标原点说明")
profile = create_profile(
    project_name="XX路积水剖面",
    coordinate_origin_description="坐标原点位于XX路与YY路交叉口中心，X轴沿道路方向，Y轴垂直道路，Z轴竖直向上",
)
print(f"  剖面已创建: {profile.profile_id}")

origin_lines = [
    "OBS001 | 路面凹陷A | 120 | 10.5 | 3.2 | 0.0",
    "OBS001 | 凹陷点A | 120 | 10.5 | 3.2 | 0.0",
    "OBS002 | 排水口B | 50 | 25.0 | 8.1 | 0.0",
    "OBS003 | 井盖缺失C | 200 | 40.0 | 12.5 | -0.3",
]
profile = import_coordinate_origin(profile.profile_id, origin_lines, operator="system")
print(f"  已导入 {len(origin_lines)} 行坐标原点说明数据")
print(f"  检测到冲突: {len(profile.conflicts)} 条")
for c in profile.conflicts:
    print(f"    - {c.conflict_id}: 障碍物 {c.obstacle_id} 被标了两个名字: {c.names}")
    print(f"      状态: {c.status}")
    for r in profile.records:
        if c.conflict_id in r.conflict_ids:
            print(f"        记录 {r.record_id}: name={r.obstacle_name}, status={r.status}")

print("\n  ※ 冲突已自动检测，但未自动消除，等待设备工程师许工确认")

print("\n【步骤②】设备工程师许工补看巡检照片")
profile = attach_inspection_photo(
    profile.profile_id,
    obstacle_id="OBS001",
    photo_id="IMG-20240315-001",
    photo_description="照片中可见该处为路面凹陷，积水约12cm，现场标识为'凹陷点A'",
    operator="许工",
)
print("  已为 OBS001 追加巡检照片证据 IMG-20240315-001")

profile = attach_inspection_photo(
    profile.profile_id,
    obstacle_id="OBS002",
    photo_id="IMG-20240315-002",
    photo_description="排水口B正常排水，无堵塞",
    operator="许工",
)
print("  已为 OBS002 追加巡检照片证据 IMG-20240315-002")

print("\n  检查冲突状态:")
profile = get_profile(profile.profile_id)
for c in profile.conflicts:
    print(f"    - {c.conflict_id}: {c.names} 状态={c.status}")
    print(f"      ※ 冲突仍在待处理，未因照片补看而自动消除")

print("\n【步骤③】更新三维标注视图（非冲突记录）")
profile = update_annotation(
    profile.profile_id,
    obstacle_id="OBS002",
    new_depth=55.0,
    operator="许工",
)
print("  OBS002 标注已更新：深度 50→55mm")

profile = update_annotation(
    profile.profile_id,
    obstacle_id="OBS003",
    new_position={"x": 40.2, "y": 12.6, "z": -0.25},
    operator="许工",
)
print("  OBS003 标注已更新：位置微调")

print("\n【冲突处理】许工确认同一障碍物双名冲突")
profile = resolve_conflict(
    profile.profile_id,
    conflict_id="conflict_OBS001",
    chosen_name="路面凹陷A",
    operator="许工",
)
print("  许工选择名称: '路面凹陷A'")
print("  冲突已解决:")

profile = get_profile(profile.profile_id)
for r in profile.records:
    if r.obstacle_id == "OBS001":
        print(f"    记录 {r.record_id}: name={r.obstacle_name}, status={r.status}")

for c in profile.conflicts:
    print(f"    冲突 {c.conflict_id}: status={c.status}, resolution={c.resolution}")

print("\n【回滚演示】许工回滚冲突决定")
profile = resolve_conflict(
    profile.profile_id,
    conflict_id="conflict_OBS001",
    chosen_name="",
    operator="许工",
    rollback=True,
)
print("  冲突已回滚:")
for c in profile.conflicts:
    print(f"    冲突 {c.conflict_id}: status={c.status}")
for r in profile.records:
    if r.obstacle_id == "OBS001":
        print(f"    记录 {r.record_id}: name={r.obstacle_name}, status={r.status}")

print("\n【重新确认】许工再次确认，选择'凹陷点A'")
profile = resolve_conflict(
    profile.profile_id,
    conflict_id="conflict_OBS001",
    chosen_name="凹陷点A",
    operator="许工",
)
for r in profile.records:
    if r.obstacle_id == "OBS001":
        print(f"  记录 {r.record_id}: name={r.obstacle_name}, status={r.status}")

print("\n【一致性验证】检查所有出口是否读同一份结果")
detail = export_detail(profile.profile_id)
page_view = get_profile(profile.profile_id).model_dump(mode="json")

detail_records = {r["obstacle_id"]: r for r in detail["records"]}
page_records = {r["obstacle_id"]: r for r in page_view["records"]}

all_consistent = True
for oid in detail_records:
    d = detail_records[oid]
    p = page_records.get(oid)
    if not p:
        print(f"  ✗ {oid} 在页面视图中缺失!")
        all_consistent = False
        continue
    if d["obstacle_name"] != p["obstacle_name"]:
        print(f"  ✗ {oid} 名称不一致: 导出={d['obstacle_name']}, 页面={p['obstacle_name']}")
        all_consistent = False
    if d["status"] != p["status"]:
        print(f"  ✗ {oid} 状态不一致: 导出={d['status']}, 页面={p['status']}")
        all_consistent = False
    if d["water_depth_mm"] != p["water_depth_mm"]:
        print(f"  ✗ {oid} 深度不一致: 导出={d['water_depth_mm']}, 页面={p['water_depth_mm']}")
        all_consistent = False

if all_consistent:
    print("  ✓ 所有记录在导出明细和页面视图中完全一致")

print("\n【证据追溯】查看 OBS001 的完整证据链")
for r in detail["records"]:
    if r["obstacle_id"] == "OBS001":
        print(f"  障碍物: {r['obstacle_name']} (ID: {r['obstacle_id']})")
        print(f"  状态: {r['status']}")
        for i, e in enumerate(r["evidence_trail"], 1):
            line_info = f" (行{e['original_line_number']})" if e.get("original_line_number") else ""
            photo_info = f" (照片{e['photo_id']})" if e.get("photo_id") else ""
            print(f"  证据{i}: [{e['source']}] {line_info}{photo_info}")
            print(f"          内容: {e['original_content']}")
            print(f"          操作: {e['operator']} @ {e['timestamp']}")

print("\n【审计日志】")
for entry in reversed(detail["audit_log"]):
    print(f"  {entry['timestamp']} | {entry['action']} | {json.dumps(entry['detail'], ensure_ascii=False)}")

print("\n" + "=" * 60)
print("演示完成。数据文件: backend/data/{}.json".format(profile.profile_id))
print("可随时重新运行此脚本，产出可复盘的完整记录。")
print("=" * 60)
