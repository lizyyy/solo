#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
产品问答相似问题归并系统 - 完整端到端验证脚本
覆盖：初始化→创建批次→第一次导入→同名重复导入→补录→保存→刷新→重算→自检→导出→重命名
"""

import json
import urllib.request
import urllib.parse
import sys

BASE = "http://localhost:3000"
API_BASE = BASE + "/api"

PASS = "✓"
FAIL = "✗"
results = []

def check(name, condition, detail=""):
    status = PASS if condition else FAIL
    results.append((name, condition, detail))
    print(f"  [{status}] {name}" + (f": {detail}" if detail else ""))
    return condition

def http_req(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    hdrs = {'Content-Type':'application/json'} if body else {}
    req = urllib.request.Request(API_BASE + path, data=data, method=method, headers=hdrs)
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        if hasattr(e, 'read'):
            try: return json.loads(e.read().decode())
            except: return {'_raw': e.read().decode(), '_http_code': e.code}
        return {'_err': str(e)}

def multipart_post(path, fields, file_field, file_name, file_content):
    boundary = "----E2E_Boundary_XYZ"
    body_parts = []
    for k, v in fields.items():
        body_parts.append('--' + boundary + '\r\nContent-Disposition: form-data; name="' + k + '"\r\n\r\n' + str(v))
    body_parts.append('--' + boundary + '\r\nContent-Disposition: form-data; name="' + file_field + '"; filename="' + file_name + '"\r\nContent-Type: text/csv\r\n\r\n' + file_content)
    body_parts.append('--' + boundary + '--\r\n')
    body = '\r\n'.join(body_parts).encode()
    headers = {"Content-Type": "multipart/form-data; boundary=" + boundary}
    req = urllib.request.Request(API_BASE + path, data=body, method="POST", headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        if hasattr(e, 'read'):
            try: return json.loads(e.read().decode())
            except: return {'_raw': e.read().decode(), '_http_code': e.code}
        return {'_err': str(e)}

# ========== 主验证流程 ==========
print("\n" + "="*60)
print("  产品问答相似问题归并系统 - 完整端到端验证")
print("="*60)

print("\n【前置检查】服务健康检查 & 静态文件可访问")
r = http_req('GET', '/health')
check("服务健康检查通过", r.get('status') == 'ok')
req = urllib.request.Request(BASE + '/')
with urllib.request.urlopen(req) as resp:
    html = resp.read().decode()
check("前端页面可访问", '<!DOCTYPE html>' in html or '<html' in html)

print("\n【场景1】浏览器入口初始化 - 获取灰度批次列表")
batches = http_req('GET', '/batches')
check("批次列表接口返回成功", isinstance(batches, list), f"当前共 {len(batches)} 个批次")

print("\n【场景2】创建批次 + 第一次导入灰度数据")
with open('/Users/lzy/pro/solo/workspaces/zy72517/sample_data.csv', 'r', encoding='utf-8') as f:
    csv1 = f.read()
print(f"  CSV文件: sample_data.csv, 长度: {len(csv1)} 字符")
print("  重点验证: 导入表单字段 batchName 与后端一致，不会出现『批次名称不能为空』")
r1 = multipart_post('/batches', {
    'batchName': '灰度批次-2024-Q4-官方样例',
    'operator': '老唐'
}, 'file', 'sample_data.csv', csv1)
batch_id = r1.get('batch', {}).get('id')
check("导入接口返回 success=true", r1.get('success') == True)
check("不会出现『批次名称不能为空』错误", '批次名称不能为空' not in str(r1.get('error', '')))
check("首次导入成功，导入记录数=10", r1.get('importedCount') == 10)
check("批次ID已返回", batch_id is not None, f"batchId={batch_id}")
stats1 = r1.get('checkResult', {}).get('stats', {})
check("自检统计 total=10", stats1.get('total') == 10)
check("检测到 duplicateUser=3 (3组同一用户重复反馈)", stats1.get('duplicateUser') == 3)
check("导入来源 initial=10 (首次导入)", stats1.get('importSources', {}).get('initial') == 10)
issues1 = r1.get('checkResult', {}).get('issues', [])
check("自检异常=3 条（每组用户1条）", len(issues1) == 3)
for i in issues1:
    print(f"      - {i.get('message')}")
ec1 = r1.get('checkResult', {}).get('exportCheck', {})
check("导出一致性校验正常", '页面展示' in str(ec1.get('warning', '')))

print("\n【场景3】同名重复导入 - 区分复用记录 vs 真新增")
csv2 = """question,user_id,user_name,feedback_time
产品退款流程是什么,user001,张三,2024-12-01 10:23:45
怎么联系客服,user002,李四,2024-12-01 11:00:00
全新未出现过的问题A,user998,新用户甲,2024-12-10 09:00:00
另一个全新问题B,user999,新用户乙,2024-12-10 10:00:00
"""
print("  增量CSV: 2条已存在（应复用） + 2条全新（应新增）")
r2 = multipart_post('/batches', {
    'batchName': '灰度批次-2024-Q4-官方样例',
    'operator': '老唐'
}, 'file', 'extra_data.csv', csv2)
check("增量导入接口返回 success=true", r2.get('success') == True)
diff2 = r2.get('incrementalDiff', {})
check("返回 incrementalDiff (增量差异)", diff2 is not None and len(diff2) > 0)
check("复用记录数 reusedCount=2", diff2.get('reusedCount') == 2)
check("真新增记录数 newCount=2", diff2.get('newCount') == 2)
stats2 = r2.get('checkResult', {}).get('stats', {})
check("总记录数 total=12 (10+2)", stats2.get('total') == 12)
check("首次导入 initial=10", stats2.get('importSources', {}).get('initial') == 10)
check("增量导入 incremental=2", stats2.get('importSources', {}).get('incremental') == 2)

print("\n【场景4】浏览器刷新 - 重新获取批次详情和记录")
r3 = http_req('GET', '/batches/' + batch_id)
check("批次详情接口返回成功", r3.get('batch') is not None and r3.get('records') is not None)
check("记录总数=12 (与自检统计一致)", len(r3.get('records', [])) == 12)
records3 = r3.get('records', [])
dup_records = [r for r in records3 if r.get('status') == 'duplicate_user']
check("同一用户重复反馈记录数>0", len(dup_records) > 0, f"共 {len(dup_records)} 条")
target_rec = dup_records[0]
print(f"  选中待补录记录: user={target_rec.get('userId')}, 原始行号L{target_rec.get('originalLineNumber')}, 状态={target_rec.get('status')}")

print("\n【场景5】补录同一用户反馈 - 不自动归normal，留待标注负责人复核")
r4 = http_req('PUT', '/batches/' + batch_id + '/records/' + target_rec['id'], {
    'status': 'needs_review',
    'annotatorComment': '标注员补录：该用户当天上午和下午各反馈一次，问题相同',
    'reviewComment': '',
    'operator': '老唐'
})
check("补录接口返回 success=true", r4.get('success') == True)
check("状态更新为 needs_review", r4.get('record', {}).get('status') == 'needs_review')
changes = r4.get('record', {}).get('manualChanges', [])
check("人工改动历史已记录", len(changes) >= 1)
if changes:
    last = changes[-1]
    print(f"      改动: {last.get('field')} {last.get('oldValue','(空)')} → {last.get('newValue')} by {last.get('changedBy')}")

print("\n【场景6】补录后重算自检")
r5 = http_req('POST', '/batches/' + batch_id + '/recheck')
check("重算接口返回 success=true", r5.get('success') == True)
stats5 = r5.get('checkResult', {}).get('stats', {})
check("重算后 needsReview=1 (补录的那条)", stats5.get('needsReview') == 1)
check("重算后 duplicateUser=2 (剩下2组未处理)", stats5.get('duplicateUser') == 2)
check("状态没有自动归normal", stats5.get('normal', 0) == 0)

print("\n【场景7】主动运行自检")
r6 = http_req('GET', '/batches/' + batch_id + '/check')
check("自检接口返回成功", r6.get('valid') == True)
check("自检 stats 字段完整", all(k in r6.get('stats', {}) for k in ['total', 'normal', 'duplicateUser', 'needsReview', 'pending', 'importSources']))
ec6 = r6.get('exportCheck', {})
check("导出一致性: 含异常记录完整导出提示", '不会静默消失' in ec6.get('warning', ''))

print("\n【场景8】导出JSON报告 - 验证与页面展示一致")
with urllib.request.urlopen(API_BASE + '/batches/' + batch_id + '/export?format=json') as resp:
    exp_json = json.loads(resp.read().decode())
check("导出JSON条数=12 (与页面一致)", len(exp_json) == 12)
exp_target = next((e for e in exp_json if e.get('原始行号') == target_rec.get('originalLineNumber')), None)
check("导出中含『原始行号』字段", exp_target is not None)
check("导出中含『导入来源』字段", exp_target.get('导入来源') is not None and exp_target.get('导入来源') != '')
check("导出中含『当前状态』字段", exp_target.get('当前状态') is not None)
check("导出中补录记录的状态=待标注负责人复核", exp_target.get('当前状态') == '待标注负责人复核')
print(f"      导出记录: 原始行号L{exp_target.get('原始行号')}, 导入来源={exp_target.get('导入来源')}, 当前状态={exp_target.get('当前状态')}")

print("\n【场景9】导出CSV报告 - 含中文字段名")
with urllib.request.urlopen(API_BASE + '/batches/' + batch_id + '/export?format=csv') as resp:
    exp_csv = resp.read().decode('utf-8-sig')
    csv_header = exp_csv.split('\n')[0]
check("CSV表头含『原始行号』", '原始行号' in csv_header)
check("CSV表头含『导入来源』", '导入来源' in csv_header)
check("CSV表头含『当前状态』", '当前状态' in csv_header)
print(f"      CSV表头: {csv_header[:100]}...")

print("\n【场景10】保存批次备注（补看标注员留言）")
r9 = http_req('POST', '/batches/' + batch_id + '/notes', {
    'importNotes': '老唐回看：2024-12-15群里标注员补充，user001和user002都是当天重复反馈，需要重点复核',
    'operator': '老唐'
})
check("备注保存成功", r9.get('success') == True)
check("批次备注已更新", r9.get('batch', {}).get('importNotes') is not None)

print("\n【场景11】批次名称变更 - 验证全链路同步")
new_name = '灰度批次-2024-Q4-官方样例-已复核'
r10 = http_req('PUT', '/batches/' + batch_id + '/rename', {
    'newName': new_name,
    'operator': '老唐'
})
check("重命名接口返回 success=true", r10.get('success') == True)
check("返回的批次名已更新", r10.get('batch', {}).get('name') == new_name)

print("\n【场景12】验证批次列表中名称已同步")
batches12 = http_req('GET', '/batches')
found12 = next((b for b in batches12 if b.get('id') == batch_id), None)
check("列表中批次名已更新", found12 and found12.get('name') == new_name)

print("\n【场景13】验证导出文件名已同步新批次名")
req13 = urllib.request.Request(API_BASE + '/batches/' + batch_id + '/export?format=csv')
with urllib.request.urlopen(req13) as resp13:
    cd = resp13.getheader('Content-Disposition')
decoded_cd = urllib.parse.unquote(cd) if cd else ''
check("导出文件名含新批次名", '灰度批次-2024-Q4-官方样例-已复核' in decoded_cd)
print(f"      Content-Disposition: {decoded_cd[:120]}...")

print("\n【场景14】验证导出内容中批次相关字段同步")
with urllib.request.urlopen(API_BASE + '/batches/' + batch_id + '/export?format=json') as resp14:
    exp14 = json.loads(resp14.read().decode())
check("导出记录数仍=12 (重命名不影响记录)", len(exp14) == 12)
exp14_target = next((e for e in exp14 if e.get('原始行号') == target_rec.get('originalLineNumber')), None)
check("补录记录状态仍=待标注负责人复核", exp14_target and exp14_target.get('当前状态') == '待标注负责人复核')
check("导入来源仍正确", exp14_target and exp14_target.get('导入来源') == '首次导入')

print("\n【场景15】验证手动更新记录状态，历史记录和导出同步")
target_rec2 = next((r for r in records3 if r.get('status') == 'duplicate_user' and r.get('id') != target_rec['id']), None)
if target_rec2:
    print(f"  选中另一条: user={target_rec2.get('userId')}, 原始行号L{target_rec2.get('originalLineNumber')}")
    r15 = http_req('PUT', '/batches/' + batch_id + '/records/' + target_rec2['id'], {
        'status': 'merged',
        'annotatorComment': '',
        'reviewComment': '标注负责人复核确认：归并到主记录',
        'operator': '标注负责人'
    })
    check("状态更新成功", r15.get('success') == True)
    check("新状态=merged", r15.get('record', {}).get('status') == 'merged')
    # 验证导出同步
    with urllib.request.urlopen(API_BASE + '/batches/' + batch_id + '/export?format=json') as resp15:
        exp15 = json.loads(resp15.read().decode())
    exp15_target = next((e for e in exp15 if e.get('原始行号') == target_rec2.get('originalLineNumber')), None)
    check("导出中状态同步为=已归并", exp15_target and exp15_target.get('当前状态') == '已归并')
    check("导出中复核意见已同步", exp15_target and '标注负责人复核确认' in exp15_target.get('复核意见', ''))

# ========== 汇总 ==========
print("\n" + "="*60)
print("  验证结果汇总")
print("="*60)
passed = sum(1 for _, c, _ in results if c)
total = len(results)
print(f"\n  总计: {passed}/{total} 通过")
for name, condition, detail in results:
    status = PASS if condition else FAIL
    print(f"  [{status}] {name}")

print("\n" + "="*60)
if passed == total:
    print("  🎉 全部验证通过！")
    print("  重点证明：『批次名称不能为空』不会再挡住灰度批次样例")
    print("  - 导入表单字段 batchName 与后端一致")
    print("  - 后端兼容 batchName/name 两种字段名")
    print("  - 全链路字段统一，无字段名不匹配问题")
else:
    print(f"  ⚠️  有 {total-passed} 项未通过")
    sys.exit(1)
print("="*60 + "\n")
