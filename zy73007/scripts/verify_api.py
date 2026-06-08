#!/usr/bin/env python3
import os, sys, threading, time, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import uvicorn
from app.main import app

def start_server():
    uvicorn.run(app, host='127.0.0.1', port=8000, log_level='error')

t = threading.Thread(target=start_server, daemon=True)
t.start()
time.sleep(2)

import requests
BASE = 'http://127.0.0.1:8000'

def section(title):
    print()
    print(f'====== {title} ======')

section('1. 首页入口')
r = requests.get(BASE + '/')
print('status', r.status_code, '| 入口项：', list(r.json()['试用入口'].keys()))

section('2. /api/stats 月底复核统计')
r = requests.get(BASE + '/api/stats')
print(json.dumps(r.json(), ensure_ascii=False, indent=2))

section('3. /api/reconcile?status=待补件 过滤')
r = requests.get(BASE + '/api/reconcile', params={'status': '待补件'})
for it in r.json():
    line = it['source_lines'][0]
    print(f"  {it['dog_name']} | {it['status']} | 来源: {line[:70]}...")

section('4. /api/abnormal-queue 与对账明细 状态一致性校验')
qs = requests.get(BASE + '/api/abnormal-queue').json()
recs = requests.get(BASE + '/api/reconcile').json()
rmap = {x['reconcile_id']: x for x in recs}
mismatch = 0
for q in qs:
    s1, s2 = q['status'], rmap.get(q['reconcile_id'], {}).get('status', 'N/A')
    flag = '✓' if s1 == s2 else '✗ MISMATCH'
    if s1 != s2: mismatch += 1
    print(f"  {flag} {q['queue_id']} {q['dog_name']:<4} 队列={s1:<4} 明细={s2:<4} | {q['summary'][:55]}")
print(f'--> 一致性: {mismatch == 0}  不一致条数: {mismatch}')

section('5. POST /api/reconcile/rerun 重跑+导CSV+一致性校验')
r = requests.post(BASE + '/api/reconcile/rerun', params={'month': '2026-06'})
d = r.json()
print('月份:', d['对账月份'], '|明细:', d['对账明细总数'], '|异常:', d['异常队列条数'])
print('一致性校验:', d['状态一致性校验']['一致'])
for k, v in list(d['已导出文件']['对账明细分类CSV'].items())[:3]:
    print(f'  [对账-{k}] .../{os.path.basename(v)}')
print(f'  [异常队列CSV] .../{os.path.basename(d["已导出文件"]["异常队列CSV"])}')

section('6. 人工改判样例：来福(REC-2026-0004) 原话→处理结论')
x = requests.get(BASE + '/api/reconcile/REC-2026-0004').json()
print(f"登记表原话:「{x['owner_supplement_raw']}」")
print(f"异常类型: {x['abnormal_types']}")
print(f"人工改判: {'是' if x['manual_override_flag'] else '否'}")
print(f"改判理由: {x['override_reason']}")
print(f"处理人/时间: {x['handler']} / {x['handled_at']}")
print(f"最终状态: {x['status']}")
print(f"最终认定疫苗日: {x['final_vaccine_date']}")
print(f"影响范围: {x['impact_scope']}")

section('7. 样例：雪球(日期缺失) 影响范围和来源行保留')
x = requests.get(BASE + '/api/reconcile/REC-2026-0003').json()
print(f"状态: {x['status']}")
print(f"旧记录日: {x['old_vaccine_date']}   主人补充日: {x['supplement_vaccine_date']}")
print(f"来源行: {x['source_lines'][0]}")
print(f"影响范围: {x['impact_scope']}")

section('全部验证完成 ✓')
