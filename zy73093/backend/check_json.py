import json
with open('/Users/maca/pro/solo/workspaces/zy73093/backend/data/materials.json') as f:
    data = json.load(f)

print("=== 材料送审表完整列表 ===")
for m in data['materials']:
    icon = "[正常]" if m['status']=='normal' else "[脏数据]"
    print(f"  {icon} {m['id']} - {m['materialName']} ({m['status']})")
    if m.get('remark'):
        print(f"        备注: {m['remark'][:50]}...")
        print(f"        人工备注: {m.get('hasManualRemark', False)}")

print()
print(f"总记录: {len(data['materials'])} 条")
print(f"  正常: {sum(1 for m in data['materials'] if m['status']=='normal')} 条")
print(f"  脏数据: {sum(1 for m in data['materials'] if m['status']!='normal')} 条")
print(f"导入批次: {len(data['importBatches'])} 个")

print()
print("=== MAT-2026-002 备注详情 ===")
for m in data['materials']:
    if m['id'] == 'MAT-2026-002':
        print(f"  备注内容: \"{m['remark']}\"")
        print(f"  hasManualRemark: {m['hasManualRemark']}")
        print(f"  备注长度: {len(m['remark'])} 字")
        if '建筑师小赵' in m['remark']:
            print("  ✅ 备注已从前端同步到后端JSON")
        else:
            print("  ⚠️  备注未更新（可能同步还没完成）")
        break
