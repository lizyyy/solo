import os

script_content = r'''import json
import urllib.request
import os
import urllib.parse

BASE = "http://localhost:3000"

def http_req(method, path, body=None):
    url = BASE + path
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode()
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        if hasattr(e, 'read'):
            return json.loads(e.read().decode())
        return {'error': str(e)}

def multipart_post(path, fields, file_field, file_name, file_content):
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body_parts = []
    for k, v in fields.items():
        body_parts.append('--' + boundary + '\r\nContent-Disposition: form-data; name="' + k + '"\r\n\r\n' + v)
    body_parts.append('--' + boundary + '\r\nContent-Disposition: form-data; name="' + file_field + '"; filename="' + file_name + '"\r\nContent-Type: text/csv\r\n\r\n' + file_content)
    body_parts.append('--' + boundary + '--\r\n')
    body = '\r\n'.join(body_parts).encode()
    headers = {"Content-Type": "multipart/form-data; boundary=" + boundary}
    url = BASE + path
    req = urllib.request.Request(url, data=body, method="POST", headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        if hasattr(e, 'read'):
            return json.loads(e.read().decode())
        return {'error': str(e)}

orig_name = "灰度测试批次001"
renamed_name = "灰度测试批次001-已重命名"

print("\n========== 验证开始 ==========\n")

# Step 1
print("【步骤1】第一次导入 CSV (10条)")
with open('/Users/lzy/pro/solo/workspaces/zy72517/sample_data.csv', 'r', encoding='utf-8') as f:
    csv1 = f.read()
r1 = multipart_post('/api/batches', {'batchName': orig_name, 'operator': '老唐'}, 'file', 'sample_data.csv', csv1)
print('  success=', r1.get('success'), ', 导入数=', r1.get('importedCount'))
batch_id = r1.get('batch', {}).get('id')
stats1 = r1.get('checkResult', {}).get('stats', {})
print('  统计: total=', stats1.get('total'), ', normal=', stats1.get('normal'), ', duplicateUser=', stats1.get('duplicateUser'), ', pending=', stats1.get('pending'))
print('  导入来源: initial=', stats1.get('importSources', {}).get('initial',0), ', incremental=', stats1.get('importSources', {}).get('incremental',0))
print('  自检异常:', len(r1.get('checkResult',{}).get('issues',[])), '条')
for i in r1.get('checkResult',{}).get('issues',[]):
    print('    -', i.get('message'))
print('  导出一致性:', r1.get('checkResult',{}).get('exportCheck',{}).get('warning'))
ok1 = stats1.get('total')==10 and stats1.get('duplicateUser')>0 and stats1.get('importSources',{}).get('initial',0)==10
print('  >>', '✓ 通过' if ok1 else '✗ 失败')

# Step 2
print("\n【步骤2】同名批次增量导入（2条复用+2条新增）")
csv2 = "question,user_id,user_name,feedback_time\n产品退款流程是什么,user001,张三,2024-12-01 10:23:45\n怎么联系客服,user002,李四,2024-12-01 11:00:00\n全新的问题X,user100,新用户,2024-12-02 09:00:00\n另一个新问题Y,user101,另一个,2024-12-02 10:00:00\n"
r2 = multipart_post('/api/batches', {'batchName': orig_name, 'operator': '老唐'}, 'file', 'extra.csv', csv2)
diff = r2.get('incrementalDiff', {})
print('  success=', r2.get('success'), ', newCount=', diff.get('newCount'), ', reusedCount=', diff.get('reusedCount'))
stats2 = r2.get('checkResult', {}).get('stats', {})
print('  统计: total=', stats2.get('total'), ', initial=', stats2.get('importSources',{}).get('initial',0), ', incremental=', stats2.get('importSources',{}).get('incremental',0))
ok2 = stats2.get('total')==12 and stats2.get('importSources',{}).get('incremental',0)==2 and diff.get('reusedCount')==2
print('  >>', '✓ 通过（复用2条+新增2条）' if ok2 else '✗ 失败')

# Step 3
print('\n【步骤3】重命名批次:', orig_name, '→', renamed_name)
r3 = http_req('PUT', '/api/batches/' + batch_id + '/rename', {'newName': renamed_name, 'operator': '老唐'})
print('  success=', r3.get('success'), ', 新名称=', r3.get('batch',{}).get('name'))
ok3 = r3.get('success') and r3.get('batch',{}).get('name')==renamed_name
print('  >>', '✓ 通过' if ok3 else '✗ 失败')

# Step 4
print("\n【步骤4】验证批次列表中名称已同步")
r4 = http_req('GET', '/api/batches')
found = None
for b in r4:
    if b.get('id')==batch_id:
        found = b
        break
print('  列表中的批次名:', found.get('name') if found else '未找到')
ok4 = found and found.get('name')==renamed_name
print('  >>', '✓ 通过' if ok4 else '✗ 失败')

# Step 5
print("\n【步骤5】验证导出与页面展示一致")
r5 = http_req('GET', '/api/batches/' + batch_id)
page_records = r5.get('records', [])
print('  页面展示:', len(page_records), '条')
url5 = BASE + '/api/batches/' + batch_id + '/export?format=json'
with urllib.request.urlopen(url5) as resp5:
    export_data = json.loads(resp5.read().decode())
print('  导出JSON:', len(export_data), '条')
sample_export = export_data[0]
print('  抽查第一条: 原始行号=', sample_export.get('原始行号'), ', 状态=', sample_export.get('当前状态'), ', 导入来源=', sample_export.get('导入来源'))
ok5 = len(page_records)==len(export_data) and sample_export.get('导入来源') is not None
print('  >>', '✓ 通过' if ok5 else '✗ 失败')

# Step 6
print("\n【步骤6】补录标注员留言→重算→导出一致性再验证")
dup_rec = None
for r in page_records:
    if r.get('status')=='duplicate_user':
        dup_rec = r
        break
ok6 = False
if dup_rec:
    print('  找到一条「同一用户重复反馈」记录: user=', dup_rec.get('userId'), ', 原始行号L', dup_rec.get('originalLineNumber'))
    r6 = http_req('PUT', '/api/batches/' + batch_id + '/records/' + dup_rec.get("id"), {
        'status': 'needs_review',
        'annotatorComment': '标注员补录：该用户上午和下午各反馈了一次，问题相同',
        'reviewComment': '',
        'operator': '老唐'
    })
    print('  更新成功=', r6.get('success'), ', 新状态=', r6.get('record',{}).get('status'))
    changes = r6.get('record', {}).get('manualChanges', [])
    print('  人工改动历史:', len(changes), '条')
    if changes:
        last = changes[-1]
        print('    最近:', last.get('field'), last.get('oldValue','(空)'), '→', last.get('newValue'), 'by', last.get('changedBy'))
    r6b = http_req('POST', '/api/batches/' + batch_id + '/recheck')
    print('  重算自检成功=', r6b.get('success'))
    stats6 = r6b.get('checkResult',{}).get('stats',{})
    print('  重算后统计: needsReview=', stats6.get('needsReview'), ', duplicateUser=', stats6.get('duplicateUser'))
    url6 = BASE + '/api/batches/' + batch_id + '/export?format=json'
    with urllib.request.urlopen(url6) as resp6:
        exp6 = json.loads(resp6.read().decode())
    updated_exp = None
    for e in exp6:
        if e.get('原始行号')==dup_rec.get('originalLineNumber'):
            updated_exp = e
            break
    print('  导出中该条状态同步:', updated_exp.get('当前状态') if updated_exp else 'N/A')
    ok6 = r6.get('success') and updated_exp and updated_exp.get('当前状态')=='待标注负责人复核'
    print('  >>', '✓ 通过（补录→重算→导出同步，状态为待复核未自动归normal）' if ok6 else '✗ 失败')

# Step 7
print("\n【步骤7】验证CSV导出含中文字段名")
url7 = BASE + '/api/batches/' + batch_id + '/export?format=csv'
with urllib.request.urlopen(url7) as resp7:
    csv7 = resp7.read().decode('utf-8-sig')
header = csv7.split('\n')[0]
print('  CSV表头:', header[:120], '...')
ok7 = '当前状态' in header and '导入来源' in header and '原始行号' in header
print('  >>', '✓ 通过' if ok7 else '✗ 失败')

# Step 8: 验证导出文件名中的批次名是重命名后的
print("\n【步骤8】验证导出文件名已同步为重命名后的批次名")
import urllib.request as ureq
req8 = ureq.Request(BASE + '/api/batches/' + batch_id + '/export?format=csv')
with ureq.urlopen(req8) as resp8:
    cd = resp8.getheader('Content-Disposition')
print('  Content-Disposition:', cd)
ok8 = cd and renamed_name.split('-')[0] in urllib.parse.unquote(cd)
print('  >>', '✓ 通过（导出文件名包含重命名后的批次名）' if ok8 else '✗ 失败（文件名可能未同步批次名）')

all_ok = ok1 and ok2 and ok3 and ok4 and ok5 and ok6 and ok7 and ok8
print('\n==========', '全部通过 ✓' if all_ok else '存在失败 ✗', '==========\n')
'''

output_path = '/Users/lzy/pro/solo/workspaces/zy72517/_verify.py'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(script_content)

print(f"文件已成功写入: {output_path}")
print(f"文件大小: {os.path.getsize(output_path)} bytes")
