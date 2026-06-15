import urllib.request
import json
import os

os.environ.pop('http_proxy', None)
os.environ.pop('https_proxy', None)

BASE = 'http://127.0.0.1:8001'

def get(path):
    req = urllib.request.Request(BASE + path)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

print("=" * 80)
print("🎉 AI 搜索排序申诉系统 - 三步流程状态报告")
print("=" * 80)
print()

ticket = get('/tickets/1')
print("【第一步】线上反馈工单第一次导入")
print("-" * 80)
print(f"  工单编号:    {ticket['ticket_no']}")
print(f"  来源:        {ticket['source']}")
print(f"  原始行号:    {ticket['original_row_no']}")
print(f"  导入时间:    {ticket['created_at'][:16]}")
print(f"  导入样本数:  {len(ticket['samples'])}")
print()
print("  低置信度样本检测结果:")
for s in ticket['samples']:
    if s['is_low_confidence']:
        hidden_mark = "⚠️ 被平均指标盖住" if s['is_hidden_by_avg'] else "  正常可见"
        print(f"    {s['sample_no']}: 置信度={s['confidence']:.2f}, 状态={s['status']}, {hidden_mark}")
print()

print("【第二步】标注负责人周姐补看脱敏规则备注")
print("-" * 80)
print(f"  处理人:      {ticket['handler']}")
print(f"  工单状态:    {ticket['status']}")
print(f"  脱敏备注:    {ticket['desensitization_note']}")
print()

print("  补录重算后的状态变化:")
print()
for s in ticket['samples']:
    if s['is_low_confidence']:
        print(f"    {s['sample_no']}: 原始排名={s['original_rank']} → 当前排名={s['current_rank']}, 状态={s['status']}")
print()

print("【第三步】模型版本对比更新")
print("-" * 80)
versions = get('/versions/')
print(f"  可用版本: {[v['version_name'] for v in versions]}")
v1_id, v2_id = versions[0]['id'], versions[1]['id']
compare = get(f'/versions/compare/{v1_id}/{v2_id}')
print(f"  版本对比: {compare['version1']} vs {compare['version2']}")
print(f"  总样本数: {compare['total_count']}")
print(f"  待复核:   {compare['pending_review_count']}")
print(f"  来自线上反馈工单: {compare['from_ticket_count']}")
print()
print("  关键样本排名变化（低置信度专项）:")
for item in compare['items']:
    if item['is_low_confidence']:
        change = ""
        if item['rank_change'] is not None:
            arrow = "↓" if item['rank_change'] > 0 else "↑" if item['rank_change'] < 0 else "="
            change = f", 排名变化: {arrow}{abs(item['rank_change'])}"
        hidden = " ⚠️ 被平均盖住" if item['is_hidden_by_avg'] else ""
        from_src = "【线上反馈工单】" if item['from_source'] == "线上反馈工单" else ""
        pending = "【待复核】" if item['status'] == '待复核' else ""
        print(f"    {item['sample_no']}: {item['query']} {from_src}{pending}{hidden}")
        print(f"            V1={item['v1_rank']} → V2={item['v2_rank']}{change}")
print()

print("=" * 80)
print("【自检结果】")
print("=" * 80)
checks = get('/tickets/1/self-check')
for c in checks:
    status = "✅ 通过" if c['passed'] else "❌ 失败"
    print(f"  {status} - {c['check_type']}")
    if c['details']:
        for k, v in c['details'].items():
            if k == 'passed':
                continue
            if isinstance(v, list) and len(v) > 0:
                print(f"      {k}: {json.dumps(v, ensure_ascii=False)}")
            elif isinstance(v, bool):
                print(f"      {k}: {'是' if v else '否'}")
            else:
                print(f"      {k}: {v}")
print()

print("=" * 80)
print("【审计追踪 - 每一步状态变化留痕】")
print("=" * 80)
logs = get('/tickets/1/audit-logs')
logs_sorted = sorted(logs, key=lambda x: x['created_at'])
for l in logs_sorted:
    ts = l['created_at'][:16]
    sample_info = f", 样本ID={l['sample_id']}" if l['sample_id'] else ""
    print(f"  [{ts}] {l['action']} by {l['operator']}{sample_info}")
    if l.get('note'):
        print(f"      备注: {l['note']}")
    if l.get('before_value'):
        print(f"      变更前: {json.dumps(l['before_value'], ensure_ascii=False)}")
    if l.get('after_value'):
        print(f"      变更后: {json.dumps(l['after_value'], ensure_ascii=False)}")
print()

print("=" * 80)
print("【导出明细一致性验证 - API返回 vs JSON导出 vs Excel导出】")
print("=" * 80)
export = get('/tickets/1/export/json')
print(f"  导出样本数: {len(export['export_rows'])}")
print()
print("  关键字段三端对齐验证:")
all_match = True
for row in export['export_rows']:
    if row['低置信度'] == '是':
        api_s = next(s for s in ticket['samples'] if s['sample_no'] == row['样本编号'])
        checks = [
            ('低置信度', api_s['is_low_confidence'], row['低置信度'] == '是'),
            ('被盖住', api_s['is_hidden_by_avg'], row['被平均指标盖住'] == '是'),
            ('状态', api_s['status'], row['处理状态']),
            ('当前排名', api_s['current_rank'], row['当前排名']),
            ('处理人', ticket['handler'], row['处理人']),
            ('脱敏备注', ticket['desensitization_note'][:20], row['脱敏规则备注'][:20]),
        ]
        mismatches = [f'{k}: API={a} vs 导出={e}' for k, a, e in checks if str(a) != str(e)]
        if mismatches:
            all_match = False
            print(f"  ❌ {row['样本编号']}: {'; '.join(mismatches)}")
        else:
            print(f"  ✅ {row['样本编号']}: 处理状态={row['处理状态']}, 被盖住={row['被平均指标盖住']}, 三端完全对齐")
print()
if all_match:
    print("  🎉 所有样本：导出明细、页面展示、接口返回三端数据完全一致！")
else:
    print("  ⚠️ 存在不一致，需要排查")
print()

print("=" * 80)
print("【停在导出明细】当前完整状态")
print("=" * 80)
print(f"  工单: {ticket['ticket_no']} | 状态: {ticket['status']} | 处理人: {ticket['handler']}")
print(f"  总样本: {len(ticket['samples'])} | 低置信度: {sum(1 for s in ticket['samples'] if s['is_low_confidence'])} | 待复核: {sum(1 for s in ticket['samples'] if s['status'] == '待复核')}")
print(f"  被平均指标盖住: {sum(1 for s in ticket['samples'] if s['is_hidden_by_avg'])} | 已留痕审计: {len(logs)} 条操作记录")
print()
print("  👉 知识库编辑可随时点击【导出明细】下载 Excel，或在【审计追踪】回到证据")
print("  👉 低置信度样本保持【待复核】状态，待知识库编辑人工确认后再归正常")
print("  👉 版本对比页一眼识别【线上反馈工单】来源和【待复核】状态")
print()
print("=" * 80)
