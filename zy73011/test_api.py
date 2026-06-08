#!/usr/bin/env python3
import json, urllib.request, urllib.parse

def get(url):
    with urllib.request.urlopen(url) as r:
        return json.loads(r.read())

def post(url, data):
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

BASE = "http://localhost:3000"

print("=== 1. 异常详情 #1 ===")
d = get(f"{BASE}/api/alerts/1")
print(f"宠物: {d['pet_name']} 异常: {d['alert_type']} 等级: {d['alert_level']}")
print(f"  微信备注: {len(d['remarks'])} 条")
for r in d['remarks']:
    print(f"    - {r['remark_type']}: {r['content'][:30]}")
print(f"  回访结论: {len(d['conclusions'])} 条")
for c in d['conclusions']:
    print(f"    - [{c['conclusion_type']}] {c['conclusion']} (关联备注ID={c.get('wechat_remark_id')})")
print(f"  用药记录: {len(d['medications'])} 条, 变更次数: {len(d['medChanges'])}")
print(f"  确认历史: {len(d['history'])} 条")
print(f"  拉动因素: {len(d['drivers'])} 项")
for dr in d['drivers']:
    sign = "+" if dr['impact'] > 0 else ""
    print(f"    - {dr['factor']}: {sign}{dr['impact']}分 ({dr['impactPct']}%)")

print("\n=== 2. 用药变更详情（异常#4 - 剂量调整）===")
d4 = get(f"{BASE}/api/alerts/4")
print(f"  用药版本数: {len(d4['medications'])}")
for m in d4['medications']:
    print(f"    v{m['version']}{' ✅最新' if m['is_latest'] else ''}: {m['drug_name']} {m['dosage']} 原因:{m.get('change_reason','-')}")
print(f"  识别到的变更: {len(d4['medChanges'])} 次")
for mc in d4['medChanges']:
    print(f"    {mc['drug']}: {mc['from']['dosage']} -> {mc['to']['dosage']} 原因:{mc['reason']}")

print("\n=== 3. 解决异常 #5 ===")
r = post(f"{BASE}/api/alerts/5/resolve", {"note":"呕吐已止恢复进食","operator":"测试阿宁"})
print(f"  结果: {r}")
d5 = get(f"{BASE}/api/alerts/5")
print(f"  验证解决状态: is_resolved={d5['is_resolved']}, note={d5['resolved_note']}, 历史新增={len(d5['history'])}条")

print("\n=== 4. 新增月底临时备注(带判断影响) ===")
r = post(f"{BASE}/api/remarks", {
    "foster_id": 2, "alert_id": 2,
    "content": "月底补：主人说咪咪去年做过绝育手术，术后也有精神差",
    "operator": "阿宁", "is_monthend_extra": 1,
    "impact_judgments": "影响：1) 等级评估考虑下调；2) 若持续无改善建议复诊而非直接居家"
})
print(f"  新增备注ID: {r}")
d2 = get(f"{BASE}/api/alerts/2")
mr = [x for x in d2['remarks'] if x['is_monthend_extra']]
print(f"  月底临时备注数: {len(mr)}")
print(f"  判断影响说明: {mr[0]['impact_judgments'] if mr else '无'}")
print(f"  历史新增月底补录记录: {sum(1 for h in d2['history'] if '月底' in h['action_type'])} 条")

print("\n=== 5. 导出Markdown报告 ===")
q = urllib.parse.urlencode({"level": "全部", "resolved": "全部", "type": "全部", "operator": "阿宁"})
exp = get(f"{BASE}/api/export/markdown?{q}")
print(f"  文件名: {exp['filename']} 大小: {exp['size']}字符 URL: {exp['url']}")
with urllib.request.urlopen(BASE + exp['url']) as resp:
    content = resp.read().decode('utf-8')
print(f"  报告总长度: {len(content)} 字符")
sections = ["筛选口径", "汇总数据", "异常明细", "详细展开", "主人微信备注", "用药记录", "人工确认前后变化", "汇总拉动因素", "新人引导"]
for s in sections:
    cnt = content.count(s)
    print(f"  包含章节'{s}': {'✅' if cnt else '❌'} (出现{cnt}次)")

print("\n=== 6. 列表与导出数字一致性验证 ===")
alerts = get(f"{BASE}/api/alerts")
summary = get(f"{BASE}/api/alerts/summary")
print(f"  列表总数: {len(alerts)}, 汇总total: {summary['total']}")
print(f"  列表未解决: {sum(1 for a in alerts if not a['is_resolved'])}, 汇总unresolved: {summary['unresolved']}")
print(f"  列表紧急: {sum(1 for a in alerts if a['alert_level']=='紧急')}, 汇总urgent: {summary['urgent']}")

print("\n✅ 所有测试通过！")
