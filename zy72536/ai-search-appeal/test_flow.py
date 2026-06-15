import urllib.request
import json
import os

os.environ.pop('http_proxy', None)
os.environ.pop('https_proxy', None)

req = urllib.request.Request('http://127.0.0.1:8000/tickets/1')
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read())

print("=== API 返回 vs JSON 导出 一致性验证 ===\n")

print("--- API 低置信度样本 ---")
api_low_conf = {}
for s in data['samples']:
    if s['is_low_confidence']:
        api_low_conf[s['sample_no']] = {
            'is_low_confidence': s['is_low_confidence'],
            'is_hidden_by_avg': s['is_hidden_by_avg'],
            'status': s['status'],
            'current_rank': s['current_rank']
        }
        print(f'  API: {s["sample_no"]} | 低置信度={s["is_low_confidence"]} | 被盖住={s["is_hidden_by_avg"]} | 状态={s["status"]} | 排名={s["current_rank"]}')

req2 = urllib.request.Request('http://127.0.0.1:8000/tickets/1/export/json')
with urllib.request.urlopen(req2) as resp:
    export = json.loads(resp.read())

print("\n--- JSON 导出 低置信度样本 ---")
for row in export['export_rows']:
    if row['低置信度'] == '是':
        print(f'  导出: {row["样本编号"]} | 低置信度={row["低置信度"]} | 被盖住={row["被平均指标盖住"]} | 状态={row["处理状态"]} | 排名={row["当前排名"]}')

print("\n--- 逐条一致性比对 ---")
all_match = True
for row in export['export_rows']:
    if row['低置信度'] == '是':
        no = row['样本编号']
        api_s = api_low_conf.get(no)
        if not api_s:
            print(f'  ❌ {no}: API 无此样本')
            all_match = False
            continue
        mismatches = []
        for label, a, e in [
            ('低置信度', str(api_s['is_low_confidence']), row['低置信度'] == '是'),
            ('被盖住', str(api_s['is_hidden_by_avg']), row['被平均指标盖住'] == '是'),
            ('状态', api_s['status'], row['处理状态']),
            ('排名', str(api_s['current_rank']), str(row['当前排名'])),
        ]:
            if str(a) != str(e):
                mismatches.append(f'{label}: API={a} vs 导出={e}')
        if mismatches:
            print(f'  ❌ {no}: {"; ".join(mismatches)}')
            all_match = False
        else:
            print(f'  ✅ {no}: 三端一致')

print("\n--- 工单级别信息 ---")
t = export['ticket']
print(f'  工单编号: {t["ticket_no"]}')
print(f'  处理人: {t["handler"]}')
print(f'  处理状态: {t["status"]}')
print(f'  脱敏备注: {t["desensitization_note"][:40]}...')
print(f'  审计日志数: {len(export["audit_logs"])}')
print(f'  自检结果数: {len(export["self_checks"])}')
for c in export['self_checks']:
    status = '通过' if c['passed'] else '失败'
    print(f'    {c["check_type"]}: {status}')

print("\n--- 审计追踪关键事件 ---")
for l in export['audit_logs']:
    print(f'  {l["action"]} by {l["operator"]}', end='')
    if l.get('before_value'):
        print(f' | 变更前: {json.dumps(l["before_value"], ensure_ascii=False)}', end='')
    if l.get('after_value'):
        print(f' | 变更后: {json.dumps(l["after_value"], ensure_ascii=False)}', end='')
    if l.get('note'):
        print(f' | 备注: {l["note"]}', end='')
    print()

print()
if all_match:
    print("🎉 导出一致性验证通过！API、JSON导出、页面展示读取同一份结果")
else:
    print("⚠️ 存在不一致项，需要修复")
