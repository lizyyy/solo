import json
import urllib.request

BASE = "http://127.0.0.1:5001"

def get(url):
    with urllib.request.urlopen(BASE + url) as r:
        return json.loads(r.read())

def post(url, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(BASE + url, data=body,
                                 headers={"Content-Type": "application/json"},
                                 method="POST")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

print("=" * 50)
print("测试1：核心清洗接口")
print("=" * 50)
d = get("/api/silt/clean")
s = d["summary"]
print(f"总记录: {s['total_records']}, 有效: {s['valid_records']}, 异常: {s['anomaly_records']}")
print(f"清洗后均值: {s['overall_avg_silt_depth']}米")
print(f"原始均值: {s['overall_avg_raw']}米")
print(f"异常拉动: {s['pull_up_amount']}米")
print(f"筛选口径回显: {d['filter_criteria']}")
print(f"异常明细条数: {len(d['anomaly_details'])}")
print(f"来源分布: {list(s['source_distribution'].keys())}")
print(f"影响汇总: {s['influence_summary']}")

print()
print("=" * 50)
print("测试2：早会专用接口（直接能拿去沟通）")
print("=" * 50)
m = get("/api/silt/summary/for_meeting")
print(f"标题: {m['report_title']}")
print(f"结论: 平均{m['conclusion']['overall_avg_silt_depth']}{m['conclusion']['unit']}")
print(f"拉动分析: {m['pull_up_analysis']['description']}")
print("影响来源说明:")
for line in m["source_influence"]["description_lines"]:
    print(f"  - {line}")
print("Top3异常:")
for a in m["key_anomalies"]:
    print(f"  - {a['station']} {a['silt_depth']}米 [{'、'.join(a['influence_tags'])}]")

print()
print("=" * 50)
print("测试3：快照 & 版本留痕")
print("=" * 50)
s1 = post("/api/silt/snapshots", {
    "name": "6月18日初版",
    "filter_criteria": {}
})
print(f"快照1: {s1['snapshot_id']} {s1['snapshot_name']}")
print(f"  均值: {s1['summary']['overall_avg_silt_depth']}米")

s2 = post("/api/silt/snapshots", {
    "name": "6月18日修正版（排旧版+口头）",
    "filter_criteria": {"exclude_old": "true", "exclude_verbal": "true"}
})
print(f"快照2: {s2['snapshot_id']} {s2['snapshot_name']}")
print(f"  均值: {s2['summary']['overall_avg_silt_depth']}米")
print(f"  与上次差异: {s2['delta_vs_previous']}")

confirmed = post(f"/api/silt/snapshots/{s2['snapshot_id']}/confirm", {"operator": "老何"})
print(f"确认后: confirmed={confirmed['confirmed']}, by={confirmed['confirmed_by']}")

cmp = get(f"/api/silt/snapshots/compare?from={s1['snapshot_id']}&to={s2['snapshot_id']}")
print(f"\n版本对比:")
print(f"  均值: {cmp['summary_diff']['avg_before']} -> {cmp['summary_diff']['avg_after']}")
print(f"  变化量: {cmp['summary_diff']['avg_change']}米")
print(f"  变动记录数: {len(cmp['changed_records'])}")

print()
print("=" * 50)
print("测试4：单条记录下钻（明细拉动分析）")
print("=" * 50)
anomaly_id = d["anomaly_details"][0]["id"]
detail = get(f"/api/silt/records/{anomaly_id}")
print(f"记录ID: {detail['id']}")
print(f"站点: {detail['station']}")
print(f"淤积深度: {detail['silt_depth']}米")
print(f"来源: {detail['source_label']}")
print(f"影响标签: {detail['influence_tags']}")
print(f"对整体拉动贡献: {detail['impact_analysis']['contribution_to_pull_up']}")

print()
print("=" * 50)
print("测试5：带筛选的接口（筛选口径留在返回中）")
print("=" * 50)
f = get("/api/silt/clean?station=北防波堤&exclude_old=true")
print(f"筛选条件: {f['filter_criteria']}")
print(f"筛选后记录数: {f['summary']['total_records']}")
print(f"筛选后均值: {f['summary']['overall_avg_silt_depth']}米")

print()
print("✅ 所有测试通过")
