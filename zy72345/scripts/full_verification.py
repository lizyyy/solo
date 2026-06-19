#!/usr/bin/env python3
# -*- coding: utf-8 -*-
#
# 完整闭环端到端验证脚本
#
# 使用说明：
#   1. 使用前确保 `npm run dev` 已启动
#   2. 使用前如果需要干净数据，先 `npm run reset && 重启服务`
#   3. 运行：`python3 scripts/full_verification.py`
#   4. 退出码 0 = 全通过，非零 = 失败
#

import sys
import os
import io
import csv
import json
import requests

API = 'http://localhost:3001'
ok = []
fail = []


def rq(method, path, **kw):
    return getattr(requests, method)(API + path, **kw)


def step(name):
    print()
    print('=' * 60)
    print(name)
    print('=' * 60)


def check(name, cond, detail=''):
    mark = '✓' if cond else '✗'
    print('  ' + mark + ' ' + name + (' — ' + detail if detail else ''))
    (ok if cond else fail).append((name, detail))


def parse_csv_text(text):
    if text.startswith('\ufeff'):
        text = text[1:]
    reader = csv.DictReader(io.StringIO(text))
    return list(reader)


def find_row(rows, key, value):
    for r in rows:
        if str(r.get(key, '')) == str(value):
            return r
    return None


LID = None
BID = None
RID = None
CHG_ID = None


# =========================================================================
# Step 0 准备
# =========================================================================
step('Step 0 准备')

try:
    r = rq('get', '/api/health')
    health_ok = r.status_code == 200 and r.json().get('success')
except Exception as e:
    health_ok = False
check('服务健康检查', health_ok, '无法连接到 ' + API if not health_ok else '')

if not health_ok:
    print()
    print('!!! 服务未启动或无法连接，请先 npm run dev')
    sys.exit(1)

demo_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'demo')
os.makedirs(demo_dir, exist_ok=True)
csv_path = os.path.join(demo_dir, 'batch1_sampling.csv')

csv_exists = os.path.exists(csv_path)
csv_content_ok = False
if csv_exists:
    with open(csv_path, 'r', encoding='utf-8') as f:
        content = f.read()
        if '-20.5' in content and 'missing' in content and '2月课程退款' in content:
            csv_content_ok = True

if not csv_content_ok:
    demo_csv = 'value,old_table_status,remark\n'
    demo_csv += '120.5,normal,1月正常课时费\n'
    demo_csv += '88.0,normal,小班课\n'
    demo_csv += '-20.5,missing,"2月课程退款"\n'
    demo_csv += '150.0,normal,一对一辅导\n'
    demo_csv += '95.5,normal,周末集训\n'
    with open(csv_path, 'w', encoding='utf-8') as f:
        f.write(demo_csv)
    check('Demo CSV 文件已生成', True, csv_path)
else:
    check('Demo CSV 文件已存在且内容正确', True, csv_path)


# =========================================================================
# Step 1 第一次导入抽样名单
# =========================================================================
step('Step 1 第一次导入抽样名单')

with open(csv_path, 'rb') as f:
    r = rq('post', '/api/sampling/import',
           files={'file': ('batch1_sampling.csv', f, 'text/csv')},
           data={'name': '第一批', 'operator': '吴老师', 'operatorRole': '教研负责人'})

d1 = r.json()
check('导入接口返回 success=True', d1.get('success') is True,
      '实际: ' + json.dumps(d1, ensure_ascii=False) if not d1.get('success') else '')

record_count = d1.get('data', {}).get('recordCount')
check('recordCount=5', record_count == 5,
      '期望: 5, 实际: ' + str(record_count))

boundary_count = d1.get('data', {}).get('boundaryCount')
check('boundaryCount=1', boundary_count == 1,
      '期望: 1, 实际: ' + str(boundary_count))

LID = d1.get('data', {}).get('listId')
check('返回 batchId 非空', bool(d1.get('data', {}).get('batchId')),
      '实际 batchId: ' + str(d1.get('data', {}).get('batchId')))
check('返回 listId 非空', bool(LID), '实际 listId: ' + str(LID))


# =========================================================================
# Step 2 定位那条 -20.5 的负数边界样本
# =========================================================================
step('Step 2 定位那条 -20.5 的负数边界样本')

r = rq('get', '/api/boundary', params={'status': 'pending'})
d2 = r.json()
data2 = d2.get('data', [])

check('返回 success=True', d2.get('success') is True)
check('len(data) >= 1', len(data2) >= 1, '实际长度: ' + str(len(data2)))

target = None
for s in data2:
    ov = s.get('original_value')
    if ov == -20.5 or (isinstance(ov, float) and abs(ov - (-20.5)) < 0.001):
        target = s
        break

check('找到 original_value=-20.5 的样本', target is not None)

if target:
    BID = target.get('id')
    RID = target.get('record_id')
    check('status=pending', target.get('status') == 'pending',
          '期望: pending, 实际: ' + str(target.get('status')))

    cv = target.get('corrected_value')
    cv_ok = (cv is None) or (str(cv).strip() == '')
    check('corrected_value=None 或空', cv_ok,
          '期望: None/空, 实际: ' + str(cv))

    pr = target.get('process_reason')
    check('process_reason 空', pr is None or pr == '',
          '实际: ' + str(pr))

    dd = target.get('decision_detail')
    check('decision_detail 空', dd is None or dd == '',
          '实际: ' + str(dd))

    cb = target.get('confirmed_by')
    check('confirmed_by=None', cb is None or cb == '',
          '实际: ' + str(cb))

    ca = target.get('confirmed_at')
    check('confirmed_at=None', ca is None or ca == '',
          '实际: ' + str(ca))

    check('list_name=第一批', target.get('list_name') == '第一批',
          '实际: ' + str(target.get('list_name')))


# =========================================================================
# Step 3 学生助教先服务复核
# =========================================================================
step('Step 3 学生助教先服务复核（先服务复核）')

r = rq('post', '/api/boundary/' + (BID or '') + '/review',
       json={
           'content': '对照了2月财务台账，-20.5确认为退款，旧表误标为缺失，建议教研负责人确认作废',
           'author': '学生小王',
           'authorRole': '学生助教'
       })
d3 = r.json()
check('复核意见提交 success=True', d3.get('success') is True,
      '实际: ' + json.dumps(d3, ensure_ascii=False) if not d3.get('success') else '')

r = rq('get', '/api/boundary', params={'status': 'pending'})
data3 = r.json().get('data', [])
target3 = None
for s in data3:
    if s.get('id') == BID:
        target3 = s
        break

if target3:
    rcc = target3.get('review_comments_count', 0)
    check('review_comments_count >= 1', rcc is not None and int(rcc) >= 1,
          '实际: ' + str(rcc))


# =========================================================================
# Step 4 吴老师只改了一条记录的备注
# =========================================================================
step('Step 4 吴老师只改了一条记录的备注（只改一条备注）')

new_remark = '吴老师标记：学生S2024-032 2月退费 已核发票号#F2024-0218'
r = rq('put', '/api/sampling/records/' + (RID or '') + '/remark',
       json={
           'remark': new_remark,
           'operator': '吴老师',
           'operatorRole': '教研负责人'
       })
d4 = r.json()
check('备注修改 success=True', d4.get('success') is True,
      '实际: ' + json.dumps(d4, ensure_ascii=False) if not d4.get('success') else '')

r = rq('get', '/api/sampling/' + (LID or ''))
d4b = r.json()
check('抽样名单详情查询成功', d4b.get('success') is True)

records4 = d4b.get('data', {}).get('records', [])
rec4 = None
for rec in records4:
    if rec.get('id') == RID:
        rec4 = rec
        break

check('找到目标记录 RID', rec4 is not None)
if rec4:
    check('remark 已更新为新值', rec4.get('remark') == new_remark,
          '期望: "' + new_remark[:30] + '...", 实际: "' + str(rec4.get('remark', ''))[:30] + '..."')


# =========================================================================
# Step 5 教研负责人吴老师确认（修正为 0）
# =========================================================================
step('Step 5 教研负责人吴老师确认（修正为 0）')

r = rq('put', '/api/boundary/' + (BID or '') + '/status',
       json={
           'status': 'confirmed',
           'processReason': '2月退费，经核对发票与台账一致，该样本不计入正常分摊',
           'decisionDetail': '确认作废，原始值-20.5修正为0，后续计算不再以负数参与',
           'correctedValue': 0,
           'confirmedBy': '吴老师',
           'operatorRole': '教研负责人'
       })
d5 = r.json()
check('确认操作 success=True', d5.get('success') is True,
      '实际: ' + json.dumps(d5, ensure_ascii=False) if not d5.get('success') else '')


# =========================================================================
# Step 6 确认后各字段检查
# =========================================================================
step('Step 6 确认后各字段检查')

r = rq('get', '/api/boundary')
data6 = r.json().get('data', [])
target6 = None
for s in data6:
    if s.get('id') == BID:
        target6 = s
        break

check('在 boundary 列表中找到目标样本', target6 is not None)

if target6:
    check('status=confirmed', target6.get('status') == 'confirmed',
          '期望: confirmed, 实际: ' + str(target6.get('status')))

    cv6 = target6.get('corrected_value')
    check('corrected_value=0', (cv6 == 0) or (isinstance(cv6, (int, float)) and float(cv6) == 0),
          '期望: 0, 实际: ' + str(cv6))

    pr6 = target6.get('process_reason', '')
    check('process_reason 包含"2月退费"', '2月退费' in str(pr6),
          '实际: ' + str(pr6)[:40])

    dd6 = target6.get('decision_detail', '')
    check('decision_detail 包含"确认作废"', '确认作废' in str(dd6),
          '实际: ' + str(dd6)[:40])

    check('confirmed_by=吴老师', target6.get('confirmed_by') == '吴老师',
          '实际: ' + str(target6.get('confirmed_by')))

    ca6 = target6.get('confirmed_at')
    check('confirmed_at 非空', ca6 is not None and str(ca6).strip() != '',
          '实际: ' + str(ca6))

    ov6 = target6.get('original_value')
    check('original_value=-20.5 (保存的原始值)',
          ov6 == -20.5 or (isinstance(ov6, (int, float)) and abs(float(ov6) - (-20.5)) < 0.001),
          '期望: -20.5, 实际: ' + str(ov6))

r = rq('get', '/api/sampling/' + (LID or ''))
d6b = r.json()
records6 = d6b.get('data', {}).get('records', [])
rec6 = None
for rec in records6:
    if rec.get('id') == RID:
        rec6 = rec
        break

check('在 sampling records 中找到目标记录', rec6 is not None)
if rec6:
    ov6r = rec6.get('original_value')
    check('sampling_record original_value=0 (被修正后的值)',
          ov6r == 0 or (isinstance(ov6r, (int, float)) and float(ov6r) == 0),
          '期望: 0, 实际: ' + str(ov6r))

    check('sampling_record boundary_status=confirmed',
          rec6.get('boundary_status') == 'confirmed',
          '实际: ' + str(rec6.get('boundary_status')))


# =========================================================================
# Step 7 重复导入同一批（测试重复导入）
# =========================================================================
step('Step 7 重复导入同一批（测试重复导入）')

with open(csv_path, 'rb') as f:
    r = rq('post', '/api/sampling/import',
           files={'file': ('batch1_sampling.csv', f, 'text/csv')},
           data={'name': '第一批重复导入', 'operator': '吴老师', 'operatorRole': '教研负责人'})

d7 = r.json()
check('重复导入返回 success=True', d7.get('success') is True)

data7 = d7.get('data', {})
dup_count = data7.get('duplicateImportCount')
check('duplicateImportCount=2', dup_count is not None and int(dup_count) >= 2,
      '期望: >=2, 实际: ' + str(dup_count))

check('skipped=True', data7.get('skipped') is True,
      '实际: ' + str(data7.get('skipped')))

check('originalListId 与第一步一致', data7.get('originalListId') == LID,
      '期望: ' + str(LID)[:8] + '..., 实际: ' + str(data7.get('originalListId', ''))[:8] + '...')

r = rq('get', '/api/calculation')
d7b = r.json()
summary7 = d7b.get('data', {}).get('summary', {})
check('summary.totalSamples 仍为 5（不翻倍）', summary7.get('totalSamples') == 5,
      '期望: 5, 实际: ' + str(summary7.get('totalSamples')))


# =========================================================================
# Step 8 计算、刷新、导出（确认状态下）
# =========================================================================
step('Step 8 计算、刷新、导出（确认状态下）')

r = rq('get', '/api/calculation')
d8 = r.json()
check('计算查询 success=True', d8.get('success') is True)

results8 = d8.get('data', {}).get('results', [])
res8 = None
for r8 in results8:
    if r8.get('traceable_id') == RID or r8.get('record_id') == RID:
        res8 = r8
        break

check('在计算结果中找到目标记录', res8 is not None)
if res8:
    check('计算结果 boundary_status=confirmed', res8.get('boundary_status') == 'confirmed',
          '实际: ' + str(res8.get('boundary_status')))

    cv8 = res8.get('corrected_value')
    check('计算结果 corrected_value=0', cv8 == 0 or (isinstance(cv8, (int, float)) and float(cv8) == 0),
          '期望: 0, 实际: ' + str(cv8))

    check('计算结果 confirmed_by=吴老师', res8.get('confirmed_by') == '吴老师',
          '实际: ' + str(res8.get('confirmed_by')))

    pr8 = res8.get('process_reason', '')
    check('计算结果 process_reason 非空', str(pr8).strip() != '',
          '实际: ' + str(pr8))

r = rq('get', '/api/calculation/export')
csv_rows8 = parse_csv_text(r.text)
check('计算导出 CSV 有数据行', len(csv_rows8) >= 1, '实际行数: ' + str(len(csv_rows8)))

row8 = find_row(csv_rows8, 'traceable_id', RID)
check('计算导出中找到 traceable_id=RID 的行', row8 is not None)
if row8:
    ov8 = row8.get('original_value', '')
    check('计算导出 original_value=0（确认后修正值）',
          ov8 == '0' or ov8 == '0.0',
          '期望: 0, 实际: ' + str(ov8))

    check('计算导出 boundary_status=confirmed',
          row8.get('boundary_status') == 'confirmed',
          '实际: ' + str(row8.get('boundary_status')))

    check('计算导出 confirmed_by=吴老师',
          row8.get('confirmed_by') == '吴老师',
          '实际: ' + str(row8.get('confirmed_by')))


# =========================================================================
# Step 9 生成报告导出（确认状态下）
# =========================================================================
step('Step 9 生成报告导出（确认状态下）')

r = rq('get', '/api/boundary/export')
csv_rows9 = parse_csv_text(r.text)
check('边界报告导出 CSV 有数据行', len(csv_rows9) >= 1, '实际行数: ' + str(len(csv_rows9)))

row9 = find_row(csv_rows9, 'traceable_id', RID)
check('边界报告中找到 traceable_id=RID 的行', row9 is not None)
if row9:
    check('边界报告 status=confirmed',
          row9.get('status') == 'confirmed',
          '实际: ' + str(row9.get('status')))

    cv9 = row9.get('corrected_value', '')
    check('边界报告 corrected_value=0',
          cv9 == '0' or cv9 == '0.0',
          '期望: 0, 实际: ' + str(cv9))

    check('边界报告 confirmed_by=吴老师',
          row9.get('confirmed_by') == '吴老师',
          '实际: ' + str(row9.get('confirmed_by')))

    pr9 = row9.get('process_reason', '')
    check('边界报告 process_reason 非空',
          str(pr9).strip() != '',
          '实际: ' + str(pr9)[:30])


# =========================================================================
# Step 10 撤回确认（核心验证）
# =========================================================================
step('Step 10 撤回确认（核心验证）')

r = rq('get', '/api/history', params={'action': 'update_status', 'pageSize': 100})
d10 = r.json()
items10 = d10.get('data', {}).get('items', [])

chg_entry = None
for it in items10:
    if it.get('entity_type') == 'boundary_sample' and it.get('entity_id') == BID:
        chg_entry = it
        break

check('从历史中找到 update_status 变更记录', chg_entry is not None)
if chg_entry:
    CHG_ID = chg_entry.get('id')
    check('CHG_ID 非空', bool(CHG_ID), '实际: ' + str(CHG_ID))

if CHG_ID:
    r = rq('get', '/api/history/' + CHG_ID)
    d10b = r.json()
    check('变更详情查询 success=True', d10b.get('success') is True)

    data10b = d10b.get('data', {})
    hr = data10b.get('humanReadable', '')
    check('humanReadable 包含"边界样本状态"字样',
          '边界样本' in str(hr),
          '实际: ' + str(hr))

    rp = data10b.get('rollbackPreview', [])
    check('rollbackPreview 非空且 willBecome=pending',
          len(rp) >= 1 and rp[0].get('willBecome') == 'pending',
          '实际: ' + json.dumps(rp, ensure_ascii=False))

    r = rq('post', '/api/history/' + CHG_ID + '/rollback',
           json={'operator': '吴老师', 'operatorRole': '教研负责人'})
    d10c = r.json()
    check('回滚操作 success=True', d10c.get('success') is True,
          '实际: ' + json.dumps(d10c, ensure_ascii=False) if not d10c.get('success') else '')

    rd = d10c.get('rollbackDetails', {})
    fields = rd.get('fields', []) if isinstance(rd, dict) else []
    check('rollbackDetails 包含至少多个字段回滚',
          len(fields) >= 2,
          '回滚字段数: ' + str(len(fields)))


# =========================================================================
# Step 11 撤回确认后全面字段检查（最重要的证明）
# =========================================================================
step('Step 11 撤回确认后全面字段检查（最重要的证明）')

r = rq('get', '/api/boundary')
data11 = r.json().get('data', [])
target11 = None
for s in data11:
    if s.get('id') == BID:
        target11 = s
        break

check('在 boundary 列表中找到目标样本', target11 is not None)

if target11:
    s11_status = target11.get('status')
    check('✅ status === pending', s11_status == 'pending',
          '期望: pending, 实际: ' + str(s11_status))

    s11_cv = target11.get('corrected_value')
    s11_cv_is_empty = (s11_cv is None) or (str(s11_cv).strip() == '')
    s11_cv_is_zero = False
    if not s11_cv_is_empty:
        try:
            s11_cv_is_zero = float(s11_cv) == 0
        except:
            pass
    check('✅ corrected_value 是 None/NULL/空（绝不等于 0）',
          s11_cv_is_empty and not s11_cv_is_zero,
          '期望: 空/None, 实际: ' + str(s11_cv))

    s11_pr = str(target11.get('process_reason', ''))
    check('✅ process_reason 空（绝不包含"2月退费"）',
          s11_pr == '' and '2月退费' not in s11_pr,
          '实际: "' + s11_pr + '"')

    s11_dd = str(target11.get('decision_detail', ''))
    check('✅ decision_detail 空（绝不包含"确认作废"）',
          s11_dd == '' and '确认作废' not in s11_dd,
          '实际: "' + s11_dd + '"')

    s11_cb = target11.get('confirmed_by')
    check('✅ confirmed_by 是 None/空字符串（绝不等于"吴老师"）',
          (s11_cb is None or str(s11_cb).strip() == '') and s11_cb != '吴老师',
          '实际: "' + str(s11_cb) + '"')

    s11_ca = target11.get('confirmed_at')
    check('✅ confirmed_at 是 None/空字符串',
          s11_ca is None or str(s11_ca).strip() == '',
          '实际: "' + str(s11_ca) + '"')

    s11_ov = target11.get('original_value')
    check('✅ original_value === -20.5（保存的原始值）',
          s11_ov == -20.5 or (isinstance(s11_ov, (int, float)) and abs(float(s11_ov) - (-20.5)) < 0.001),
          '期望: -20.5, 实际: ' + str(s11_ov))

r = rq('get', '/api/sampling/' + (LID or ''))
d11b = r.json()
records11 = d11b.get('data', {}).get('records', [])
rec11 = None
for rec in records11:
    if rec.get('id') == RID:
        rec11 = rec
        break

check('在 sampling records 中找到目标记录', rec11 is not None)
if rec11:
    s11_ov_r = rec11.get('original_value')
    check('✅ sampling_record original_value === -20.5（恢复原始负数，绝不等于 0）',
          s11_ov_r == -20.5 or (isinstance(s11_ov_r, (int, float)) and abs(float(s11_ov_r) - (-20.5)) < 0.001),
          '期望: -20.5, 实际: ' + str(s11_ov_r))

    s11_neg = rec11.get('is_negative')
    check('✅ is_negative === 1 或 true',
          s11_neg == 1 or s11_neg is True or s11_neg == '1' or str(s11_neg).lower() == 'true',
          '实际: ' + str(s11_neg))

    check('✅ sampling_record boundary_status === pending',
          rec11.get('boundary_status') == 'pending',
          '实际: ' + str(rec11.get('boundary_status')))


# =========================================================================
# Step 12 撤回后重算刷新
# =========================================================================
step('Step 12 撤回后重算刷新（证明再次计算不会把它当成 0）')

r = rq('get', '/api/calculation')
d12 = r.json()
summary12 = d12.get('data', {}).get('summary', {})

check('summary.pendingCount >= 1',
      summary12.get('pendingCount', 0) >= 1,
      '实际: ' + str(summary12.get('pendingCount')))

check('summary.confirmedCount === 0',
      summary12.get('confirmedCount', 0) == 0,
      '期望: 0, 实际: ' + str(summary12.get('confirmedCount')))

results12 = d12.get('data', {}).get('results', [])
res12 = None
for r12 in results12:
    if r12.get('traceable_id') == RID or r12.get('record_id') == RID:
        res12 = r12
        break

check('在计算结果中找到目标记录', res12 is not None)
if res12:
    check('✅ 计算结果 boundary_status === pending',
          res12.get('boundary_status') == 'pending',
          '实际: ' + str(res12.get('boundary_status')))

    r12_cv = res12.get('corrected_value')
    r12_cv_ok = (r12_cv is None) or (str(r12_cv).strip() == '')
    check('✅ 计算结果 corrected_value 为空/None',
          r12_cv_ok,
          '实际: ' + str(r12_cv))

    r12_cb = res12.get('confirmed_by')
    r12_cb_ok = (r12_cb is None) or (str(r12_cb).strip() == '')
    check('✅ 计算结果 confirmed_by 为空/None',
          r12_cb_ok,
          '实际: "' + str(r12_cb) + '"')

    r12_ov = res12.get('original_value')
    check('✅ 计算结果 original_value 是负数 -20.5',
          r12_ov == -20.5 or (isinstance(r12_ov, (int, float)) and abs(float(r12_ov) - (-20.5)) < 0.001),
          '期望: -20.5, 实际: ' + str(r12_ov))


# =========================================================================
# Step 13 撤回后导出报告
# =========================================================================
step('Step 13 撤回后导出报告（证明报告里也不带吴老师结论）')

r = rq('get', '/api/boundary/export')
csv_rows13 = parse_csv_text(r.text)
check('边界报告导出 CSV 有数据行', len(csv_rows13) >= 1, '实际行数: ' + str(len(csv_rows13)))

row13 = find_row(csv_rows13, 'traceable_id', RID)
check('边界报告中找到 traceable_id=RID 的行', row13 is not None)
if row13:
    check('✅ 报告 status === pending',
          row13.get('status') == 'pending',
          '实际: ' + str(row13.get('status')))

    cv13 = str(row13.get('corrected_value', ''))
    check('✅ 报告 corrected_value 空字符串',
          cv13 == '' or cv13 == 'None',
          '实际: "' + cv13 + '"')

    pr13 = str(row13.get('process_reason', ''))
    check('✅ 报告 process_reason 空字符串',
          pr13 == '',
          '实际: "' + pr13 + '"')

    dd13 = str(row13.get('decision_detail', ''))
    check('✅ 报告 decision_detail 空字符串',
          dd13 == '',
          '实际: "' + dd13 + '"')

    cb13 = str(row13.get('confirmed_by', ''))
    check('✅ 报告 confirmed_by 空字符串',
          cb13 == '' or cb13 == 'None',
          '实际: "' + cb13 + '"')


# =========================================================================
# Step 14 撤回后导出计算明细
# =========================================================================
step('Step 14 撤回后导出计算明细')

r = rq('get', '/api/calculation/export')
csv_rows14 = parse_csv_text(r.text)
check('计算导出 CSV 有数据行', len(csv_rows14) >= 1, '实际行数: ' + str(len(csv_rows14)))

row14 = find_row(csv_rows14, 'traceable_id', RID)
check('计算导出中找到 traceable_id=RID 的行', row14 is not None)
if row14:
    ov14 = row14.get('original_value', '')
    check('✅ 计算导出 original_value == -20.5（必须是负数，不是 0）',
          ov14 == '-20.5' or ov14 == '-20.50',
          '期望: -20.5, 实际: ' + str(ov14))

    check('✅ 计算导出 boundary_status === pending',
          row14.get('boundary_status') == 'pending',
          '实际: ' + str(row14.get('boundary_status')))

    cv14 = str(row14.get('corrected_value', ''))
    check('✅ 计算导出 corrected_value 空',
          cv14 == '' or cv14 == 'None',
          '实际: "' + cv14 + '"')

    pr14 = str(row14.get('process_reason', ''))
    check('✅ 计算导出 process_reason 空',
          pr14 == '',
          '实际: "' + pr14 + '"')

    cb14 = str(row14.get('confirmed_by', ''))
    check('✅ 计算导出 confirmed_by 空',
          cb14 == '' or cb14 == 'None',
          '实际: "' + cb14 + '"')


# =========================================================================
# Step 15 改前改后历史完整
# =========================================================================
step('Step 15 改前改后历史完整（所有动作都能在历史里看到）')

r = rq('get', '/api/history', params={'pageSize': 100})
d15 = r.json()
items15 = d15.get('data', {}).get('items', [])
check('历史查询返回 success=True', d15.get('success') is True)
check('历史记录条数充足', len(items15) >= 5, '实际条数: ' + str(len(items15)))

actions_found = set()
for it in items15:
    actions_found.add(it.get('action', ''))

check('✅ 有 import（名单导入）记录',
      'import' in actions_found,
      '已找到 actions: ' + str(actions_found))

check('✅ 有 boundary_detected（边界检测）记录',
      'boundary_detected' in actions_found,
      '已找到 actions: ' + str(actions_found))

check('✅ 有 add_review（学生助教加意见）记录',
      'add_review' in actions_found,
      '已找到 actions: ' + str(actions_found))

check('✅ 有 update_remark（吴老师改备注）记录',
      'update_remark' in actions_found,
      '已找到 actions: ' + str(actions_found))

check('✅ 有 correct_value（原始值从 -20.5 改到 0）记录',
      'correct_value' in actions_found,
      '已找到 actions: ' + str(actions_found))

check('✅ 有 update_status（从 pending 改到 confirmed）记录',
      'update_status' in actions_found,
      '已找到 actions: ' + str(actions_found))

rollback_count = 0
for it in items15:
    if it.get('action') == 'rollback':
        rollback_count += 1
check('✅ 有 rollback 记录（撤回操作）',
      rollback_count >= 1,
      'rollback 条数: ' + str(rollback_count))

correct_value_entry = None
for it in items15:
    if it.get('action') == 'correct_value':
        correct_value_entry = it
        break
if correct_value_entry:
    check('correct_value: old_value=-20.5',
          correct_value_entry.get('old_value') == '-20.5',
          '实际: ' + str(correct_value_entry.get('old_value')))
    check('correct_value: new_value=0',
          correct_value_entry.get('new_value') == '0',
          '实际: ' + str(correct_value_entry.get('new_value')))

update_status_entry = None
for it in items15:
    if it.get('action') == 'update_status' and it.get('entity_type') == 'boundary_sample':
        update_status_entry = it
        break
if update_status_entry:
    check('update_status: old_value=pending',
          update_status_entry.get('old_value') == 'pending',
          '实际: ' + str(update_status_entry.get('old_value')))
    check('update_status: new_value=confirmed',
          update_status_entry.get('new_value') == 'confirmed',
          '实际: ' + str(update_status_entry.get('new_value')))


# =========================================================================
# Step 16 报告反查
# =========================================================================
step('Step 16 报告反查（从导出 CSV 的 traceable_id 反查到源记录）')

r = rq('get', '/api/boundary/export')
csv_rows16 = parse_csv_text(r.text)
row16 = find_row(csv_rows16, 'traceable_id', RID)
check('从边界报告导出拿到 traceable_id（应为 RID）', row16 is not None)

if row16:
    trace_id = row16.get('traceable_id')
    check('traceable_id 与 RID 一致', trace_id == RID,
          '期望: ' + str(RID)[:8] + '..., 实际: ' + str(trace_id)[:8] + '...')

    r = rq('get', '/api/sampling/' + (LID or ''))
    d16b = r.json()
    records16 = d16b.get('data', {}).get('records', [])

    rec16 = None
    for rec in records16:
        if rec.get('id') == trace_id:
            rec16 = rec
            break

    check('GET /api/sampling/{LID} 中通过 traceable_id 反查到源记录', rec16 is not None)
    if rec16:
        ov16 = rec16.get('original_value')
        check('反查记录 original_value=-20.5',
              ov16 == -20.5 or (isinstance(ov16, (int, float)) and abs(float(ov16) - (-20.5)) < 0.001),
              '期望: -20.5, 实际: ' + str(ov16))

        check('反查记录 boundary_status=pending',
              rec16.get('boundary_status') == 'pending',
              '实际: ' + str(rec16.get('boundary_status')))


# =========================================================================
# 最终输出
# =========================================================================
print()
print('=' * 60)
print('验证结果: ' + str(len(ok)) + ' 通过  ' + str(len(fail)) + ' 失败')
print('=' * 60)

if fail:
    print()
    print('失败项列表:')
    for n, d in fail:
        print('  ✗ ' + n + ('  —  ' + d if d else ''))
    sys.exit(1)
else:
    print()
    print('全部验证通过 ✓')
    sys.exit(0)
