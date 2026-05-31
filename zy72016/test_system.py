#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import json
import time
import requests
import subprocess
import signal

os.environ['NO_PROXY'] = '127.0.0.1,localhost'
os.environ['no_proxy'] = '127.0.0.1,localhost'

BASE_URL = 'http://127.0.0.1:5001/api'
DB_FILE = 'margin_call.db'

session = requests.Session()
session.trust_env = False
session.proxies = {'http': None, 'https': None}

COLORS = {
    'RED': '\033[91m',
    'GREEN': '\033[92m',
    'YELLOW': '\033[93m',
    'BLUE': '\033[94m',
    'ENDC': '\033[0m',
    'BOLD': '\033[1m'
}


def print_color(msg, color='ENDC', bold=False):
    prefix = COLORS.get(color, '')
    if bold:
        prefix += COLORS['BOLD']
    print(f'{prefix}{msg}{COLORS["ENDC"]}')


def print_header(title):
    print()
    print_color('=' * 60, 'BLUE', bold=True)
    print_color(f'  {title}', 'BLUE', bold=True)
    print_color('=' * 60, 'BLUE', bold=True)


def check_server():
    try:
        r = session.get(f'{BASE_URL}/health', timeout=3)
        return r.status_code == 200
    except:
        return False


def wait_for_server(timeout=30):
    print('等待服务启动...', end='', flush=True)
    start = time.time()
    while time.time() - start < timeout:
        if check_server():
            print_color(' 已就绪', 'GREEN')
            return True
        time.sleep(1)
        print('.', end='', flush=True)
    print_color(' 超时', 'RED')
    return False


def start_server():
    if os.path.exists(DB_FILE):
        os.remove(DB_FILE)
        print_color(f'已清理旧数据库: {DB_FILE}', 'YELLOW')

    env = os.environ.copy()
    env['PYTHONUNBUFFERED'] = '1'

    proc = subprocess.Popen(
        [sys.executable, 'run.py'],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=env,
        preexec_fn=os.setsid
    )

    if not wait_for_server():
        print('服务启动失败，输出:')
        try:
            outs, _ = proc.communicate(timeout=5)
            print(outs.decode('utf-8', errors='ignore'))
        except:
            pass
        proc.kill()
        return None

    return proc


def stop_server(proc):
    if proc and proc.poll() is None:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
            proc.wait(timeout=5)
        except:
            proc.kill()
    print_color('服务已停止', 'YELLOW')


def test_step(description, func):
    print(f'  {description}...', end=' ', flush=True)
    try:
        result = func()
        if result is None or result:
            print_color('✓ 通过', 'GREEN')
            return True
        else:
            print_color('✗ 失败', 'RED')
            return False
    except AssertionError as e:
        print_color(f'✗ 断言失败: {e}', 'RED')
        return False
    except Exception as e:
        print_color(f'✗ 异常: {e}', 'RED')
        import traceback
        traceback.print_exc()
        return False


def run_tests():
    print_header('外汇保证金穿仓复盘系统 - 综合测试')

    proc = start_server()
    if not proc:
        return False

    results = []

    try:
        print_header('测试1: 批次创建')

        from test_data import SAMPLE_BATCH

        def test_create_batch():
            r = session.post(f'{BASE_URL}/batches', json=SAMPLE_BATCH)
            assert r.status_code == 200, f'HTTP {r.status_code}: {r.text}'
            data = r.json()
            assert data['success'], f'API失败: {data.get("error")}'
            assert data['data']['batch_no'] == SAMPLE_BATCH['batch_no']
            assert data['data']['created_by'] == SAMPLE_BATCH['operator']
            return True

        results.append(test_step('创建复盘批次', test_create_batch))

        def test_list_batches():
            r = session.get(f'{BASE_URL}/batches')
            assert r.status_code == 200
            data = r.json()
            assert data['success']
            assert len(data['data']) >= 1
            return True

        results.append(test_step('查询批次列表', test_list_batches))

        print_header('测试2: 批量导入（含脏数据）')

        from test_data import SAMPLE_RECORDS

        batch_id = None

        def test_import_records():
            nonlocal batch_id
            r = session.get(f'{BASE_URL}/batches')
            batch_id = r.json()['data'][0]['id']

            r = session.post(f'{BASE_URL}/batches/{batch_id}/import', json={
                'records': SAMPLE_RECORDS,
                'source': 'CONTRACT_SCAN',
                'operator': '门店财务老曹'
            })
            assert r.status_code == 200
            data = r.json()
            assert data['success']
            assert data['total'] == 9
            assert data['imported'] == 9
            assert data['duplicates'] == 1
            assert data['has_null'] >= 1
            assert data['boundary'] >= 3
            assert len(data['warnings']) > 0
            print()
            print_color(f'    导入结果: 共{data["total"]}条，成功{data["imported"]}条，重复{data["duplicates"]}条，空值{data["has_null"]}条，边界{data["boundary"]}条', 'YELLOW')
            print_color(f'    警告信息: {len(data["warnings"])}条', 'YELLOW')
            for w in data['warnings'][:5]:
                print_color(f'      - {w}', 'YELLOW')
            return True

        results.append(test_step('批量导入含脏数据的记录', test_import_records))

        def test_query_records():
            r = session.get(f'{BASE_URL}/records', params={'batch_id': batch_id})
            assert r.status_code == 200
            data = r.json()
            assert data['success']
            records = data['data']

            unique_records = {}
            for r in records:
                key = (r['record_no'], r['version'])
                unique_records[key] = r

            assert len(unique_records) == 8, f'应有8条记录(9条导入，1条重复只更新不新建)，实际{len(unique_records)}'

            rec_null = [r for r in records if r['record_no'] == 'REC-003'][0]
            assert rec_null['data_quality'] in ['HAS_NULL', 'DIRTY'], f'REC-003质量应为HAS_NULL或DIRTY，实际{rec_null["data_quality"]}'
            assert rec_null['has_exception'] == True
            assert rec_null['contract_original_note'] is not None
            assert '找柜台小周核对' in rec_null['contract_original_note'], f'原始备注丢失: {rec_null["contract_original_note"]}'

            rec_boundary_zero = [r for r in records if r['record_no'] == 'REC-004'][0]
            assert rec_boundary_zero['data_quality'] == 'BOUNDARY', f'REC-004质量应为BOUNDARY，实际{rec_boundary_zero["data_quality"]}'
            assert rec_boundary_zero['shortfall_amount'] == 0

            rec_boundary_neg = [r for r in records if r['record_no'] == 'REC-005'][0]
            assert rec_boundary_neg['data_quality'] == 'BOUNDARY', f'REC-005质量应为BOUNDARY，实际{rec_boundary_neg["data_quality"]}'
            assert rec_boundary_neg['shortfall_amount'] == -5000

            rec_boundary_refund = [r for r in records if r['record_no'] == 'REC-006'][0]
            assert rec_boundary_refund['data_quality'] == 'BOUNDARY', f'REC-006质量应为BOUNDARY，实际{rec_boundary_refund["data_quality"]}'

            rec_boundary_big = [r for r in records if r['record_no'] == 'REC-008'][0]
            assert rec_boundary_big['data_quality'] == 'BOUNDARY', f'REC-008质量应为BOUNDARY，实际{rec_boundary_big["data_quality"]}'
            assert rec_boundary_big['shortfall_amount'] == 15000000

            rec_dup_v1 = [r for r in records if r['record_no'] == 'REC-001' and r['version'] == 1][0]
            assert rec_dup_v1['data_quality'] == 'HAS_DUPLICATE', f'REC-001 v1质量应为HAS_DUPLICATE，实际{rec_dup_v1["data_quality"]}'
            assert '重复导入' in rec_dup_v1['exception_reason'], f'缺少重复标记: {rec_dup_v1["exception_reason"]}'
            assert '老曹-5月16日已联系' in rec_dup_v1['contract_original_note'], f'原始备注被洗掉: {rec_dup_v1["contract_original_note"]}'

            rec_messy = [r for r in records if r['record_no'] == 'REC-002'][0]
            assert '别问老曹，问风控老王' in rec_messy['contract_original_note'], f'乱备注被洗掉: {rec_messy["contract_original_note"]}'

            print()
            print_color('    脏数据处理验证:', 'YELLOW')
            print_color(f'      - REC-003(空值): 质量={rec_null["data_quality"]}, 状态={rec_null["current_status"]}', 'YELLOW')
            print_color(f'      - REC-004(穿仓=0): 质量={rec_boundary_zero["data_quality"]}, 状态={rec_boundary_zero["current_status"]}', 'YELLOW')
            print_color(f'      - REC-005(穿仓<0): 质量={rec_boundary_neg["data_quality"]}, 状态={rec_boundary_neg["current_status"]}', 'YELLOW')
            print_color(f'      - REC-001(重复): 质量={rec_dup_v1["data_quality"]}, 原始备注保留={rec_dup_v1["contract_original_note"][:30]}...', 'YELLOW')
            print_color(f'      - REC-002(乱备注): 备注保留完整={rec_messy["contract_original_note"][:30]}...', 'YELLOW')

            return True

        results.append(test_step('验证脏数据处理和原始备注保留', test_query_records))

        print_header('测试3: 人工确认流程')

        from test_data import MANUAL_CONFIRMATIONS

        def test_manual_confirm():
            r = session.get(f'{BASE_URL}/records', params={'batch_id': batch_id})
            records = {r['record_no']: r for r in r.json()['data'] if r['version'] == 1}

            for conf in MANUAL_CONFIRMATIONS:
                rec = records.get(conf['record_no'])
                if not rec:
                    continue
                r_update = session.put(f'{BASE_URL}/records/{rec["id"]}/status', json={
                    'new_status': conf['new_status'],
                    'operator': conf['operator'],
                    'change_reason': conf['change_reason'],
                    'source': 'MANUAL_NOTE',
                    'manual_notes': [f'老曹确认: {conf["change_reason"]}']
                })
                assert r_update.status_code == 200, f'HTTP {r_update.status_code}: {r_update.text}'
                data = r_update.json()
                assert data['success'], f'API失败: {data.get("error")}'
                assert data['record']['current_status'] == conf['new_status']
                assert data['record']['processed_by'] == conf['operator']

            r_check = session.get(f'{BASE_URL}/records', params={'batch_id': batch_id})
            updated = r_check.json()['data']
            confirmed = [r for r in updated if r['current_status'] == 'CONFIRMED']
            exceptions = [r for r in updated if r['current_status'] == 'EXCEPTION']
            needs_confirm = [r for r in updated if r['current_status'] == 'NEEDS_CONFIRM']

            print()
            print_color('    人工确认后状态分布:', 'YELLOW')
            print_color(f'      - 已确认(CONFIRMED): {len(confirmed)}条', 'YELLOW')
            print_color(f'      - 例外(EXCEPTION): {len(exceptions)}条', 'YELLOW')
            print_color(f'      - 需确认(NEEDS_CONFIRM): {len(needs_confirm)}条', 'YELLOW')
            print_color(f'      - 例外不会在汇总中消失: exception_count > 0', 'GREEN')

            return True

        results.append(test_step('人工确认状态更新', test_manual_confirm))

        print_header('测试4: 晚到附件处理（不覆盖原判断，保留历史）')

        from test_data import LATE_ATTACHMENT_REC007

        original_record = None
        original_status = None
        original_shortfall = None

        def test_late_attachment():
            nonlocal original_record, original_status, original_shortfall
            r = session.get(f'{BASE_URL}/records', params={'batch_id': batch_id})
            records = r.json()['data']
            original_record = [r for r in records if r['record_no'] == 'REC-007' and r['version'] == 1][0]
            original_status = original_record['current_status']
            original_shortfall = original_record['shortfall_amount']

            r_late = session.post(f'{BASE_URL}/batches/{batch_id}/import-late', json={
                'record': LATE_ATTACHMENT_REC007,
                'source': 'LATE_ATTACHMENT',
                'operator': '门店财务老曹'
            })
            assert r_late.status_code == 200, f'HTTP {r_late.status_code}: {r_late.text}'
            data = r_late.json()
            assert data['success'], f'API失败: {data.get("error")}'
            assert data['created_new_version'] == True, f'未创建新版本: {data}'
            assert data['record']['version'] == 2, f'版本号不对: {data["record"]["version"]}'
            assert data['record']['is_late_attachment'] == True
            assert data['record']['original_record_id'] == original_record['id']
            assert data['record']['current_status'] == 'NEEDS_CONFIRM'

            r_versions = session.get(f'{BASE_URL}/records/REC-007/versions', params={'batch_id': batch_id})
            versions = r_versions.json()['data']
            assert len(versions) == 2, f'版本数不对: {len(versions)}'

            v1 = [v for v in versions if v['version'] == 1][0]
            v2 = [v for v in versions if v['version'] == 2][0]

            assert v1['shortfall_amount'] == 45000, f'v1穿仓不对: {v1["shortfall_amount"]}'
            assert v2['shortfall_amount'] == 15000, f'v2穿仓不对: {v2["shortfall_amount"]}'
            assert v1['payment_amount'] == 30000, f'v1已缴不对: {v1["payment_amount"]}'
            assert v2['payment_amount'] == 45000, f'v2已缴不对: {v2["payment_amount"]}'

            status_history = v2['status_history']
            assert len(status_history) >= 1, f'状态历史为空'
            assert status_history[0]['from_status'] == original_status, f'起始状态不对: {status_history[0]["from_status"]}'
            assert status_history[0]['to_status'] == 'NEEDS_CONFIRM'
            assert '晚到附件' in status_history[0]['change_reason'], f'缺少晚到附件原因: {status_history[0]["change_reason"]}'

            note_history = v2['note_history']
            has_late_note = any('【晚到附件】' in n['note_content'] for n in note_history)
            assert has_late_note, '晚到附件备注未保留'

            has_original_note = any('老曹-客户说下周补缴' in n['note_content'] for n in note_history)
            assert has_original_note, '原始备注被洗掉了！'

            print()
            print_color('    晚到附件版本追溯:', 'YELLOW')
            print_color(f'      - v1 穿仓: {v1["shortfall_amount"]}, 已缴: {v1["payment_amount"]}, 状态: {v1["current_status"]}', 'YELLOW')
            print_color(f'      - v2 穿仓: {v2["shortfall_amount"]}, 已缴: {v2["payment_amount"]}, 状态: {v2["current_status"]}', 'YELLOW')
            print_color(f'      - 状态流转记录: 包含前后变化，不覆盖原判断', 'GREEN')
            print_color(f'      - 原始备注完整保留: 是', 'GREEN')

            return True

        results.append(test_step('晚到附件创建新版本并保留历史', test_late_attachment))

        def test_confirm_late_attachment():
            r = session.get(f'{BASE_URL}/records', params={'batch_id': batch_id})
            records = r.json()['data']
            v2_list = [r for r in records if r['record_no'] == 'REC-007' and r['version'] == 2]
            assert len(v2_list) > 0, '找不到REC-007 v2'
            v2 = v2_list[0]

            r_update = session.put(f'{BASE_URL}/records/{v2["id"]}/status', json={
                'new_status': 'CONFIRMED',
                'operator': '门店财务老曹',
                'change_reason': '晚到附件确认，客户已全额补缴',
                'source': 'MANUAL_NOTE',
                'manual_notes': ['老曹确认: 晚到流水到账，穿仓已覆盖']
            })
            assert r_update.status_code == 200
            assert r_update.json()['success']
            return True

        results.append(test_step('确认晚到附件新版本', test_confirm_late_attachment))

        print_header('测试5: 导出报告（批次、状态、人工确认读同一份数据）')

        first_export_summary = None
        first_export_exception_count = None

        def test_export_report():
            nonlocal first_export_summary, first_export_exception_count
            r = session.get(f'{BASE_URL}/export/report', params={'batch_id': batch_id, 'format': 'json'})
            assert r.status_code == 200
            data = r.json()
            assert data['success']
            report = data['data']

            summary = report['summary']
            first_export_summary = summary
            first_export_exception_count = summary['exception_count']

            print()
            print_color('    报告汇总数据:', 'YELLOW')
            print_color(f'      - 总记录数: {summary["total_records"]}', 'YELLOW')
            print_color(f'      - 穿仓总额: {summary["total_shortfall"]}', 'YELLOW')
            print_color(f'      - 已缴总额: {summary["total_payment"]}', 'YELLOW')
            print_color(f'      - 应退总额: {summary["total_refund"]}', 'YELLOW')
            print_color(f'      - 净穿仓: {summary["net_shortfall"]}', 'YELLOW')
            print_color(f'      - 例外记录数: {summary["exception_count"]}', 'YELLOW')
            print_color(f'      - 晚到附件数: {summary["late_attachment_count"]}', 'YELLOW')
            print_color(f'      - 待确认数: {summary["needs_confirm_count"]}', 'YELLOW')
            print()
            print_color('    按状态分布:', 'YELLOW')
            for k, v in summary['by_status'].items():
                print_color(f'      - {k}: {v}条', 'YELLOW')

            assert summary['exception_count'] > 0, '例外在汇总中消失了！'
            assert summary['late_attachment_count'] > 0, '晚到附件在汇总中消失了！'
            assert summary['needs_confirm_count'] > 0, '待确认在汇总中消失了！'

            rec002_found = False
            rec007_v1_found = False
            rec007_v2_found = False
            for rec in report['records']:
                if rec['记录编号'] == 'REC-002':
                    rec002_found = True
                    assert '别问老曹，问风控老王' in rec['合同原始备注'], f'乱备注在导出时被洗掉了！实际: {rec["合同原始备注"]}'
                    assert rec['当前状态'] == '例外', f'REC-002状态不是例外！实际: {rec["当前状态"]}'
                if rec['记录编号'] == 'REC-007' and rec['版本'] == 1:
                    rec007_v1_found = True
                    assert '老曹-客户说下周补缴' in rec['合同原始备注'], f'原始备注在导出时被洗掉了！实际: {rec["合同原始备注"]}'
                if rec['记录编号'] == 'REC-007' and rec['版本'] == 2:
                    rec007_v2_found = True
                    assert '【晚到附件】' in rec['所有备注'], f'晚到附件备注在导出时消失了！实际: {rec["所有备注"][:100]}'
                    assert '原判断' in rec['所有备注'], f'原判断在导出时被覆盖了！实际: {rec["所有备注"][:100]}'

            assert rec002_found, 'REC-002在导出报告中消失了！'
            assert rec007_v1_found, 'REC-007 v1在导出报告中消失了！'
            assert rec007_v2_found, 'REC-007 v2在导出报告中消失了！'

            r_records = session.get(f'{BASE_URL}/records', params={'batch_id': batch_id})
            db_records = r_records.json()['data']
            db_exceptions = len([r for r in db_records if r['has_exception']])
            db_late = len([r for r in db_records if r['is_late_attachment']])
            db_needs = len([r for r in db_records if r['current_status'] == 'NEEDS_CONFIRM'])

            assert summary['exception_count'] == db_exceptions, f'报告例外数{summary["exception_count"]} != 数据库{db_exceptions}'
            assert summary['late_attachment_count'] == db_late, f'报告晚到附件数{summary["late_attachment_count"]} != 数据库{db_late}'
            assert summary['needs_confirm_count'] == db_needs, f'报告待确认数{summary["needs_confirm_count"]} != 数据库{db_needs}'

            print()
            print_color('    数据一致性验证:', 'GREEN')
            print_color(f'      - 批次/状态/人工确认/报告: 读同一份数据库数据', 'GREEN')
            print_color(f'      - 例外记录: 报告{summary["exception_count"]} == DB{db_exceptions}', 'GREEN')
            print_color(f'      - 晚到附件: 报告{summary["late_attachment_count"]} == DB{db_late}', 'GREEN')
            print_color(f'      - 待确认: 报告{summary["needs_confirm_count"]} == DB{db_needs}', 'GREEN')

            return True

        results.append(test_step('导出报告并验证数据一致性', test_export_report))

        def test_export_excel():
            r = session.get(f'{BASE_URL}/export/report', params={'batch_id': batch_id, 'format': 'excel'})
            assert r.status_code == 200
            assert 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' in r.headers['Content-Type']
            assert len(r.content) > 1000
            return True

        results.append(test_step('导出Excel格式报告', test_export_excel))

        print_header('测试6: 历史追溯和操作日志')

        def test_history_and_logs():
            r = session.get(f'{BASE_URL}/records', params={'batch_id': batch_id})
            rec = [r for r in r.json()['data'] if r['record_no'] == 'REC-001' and r['version'] == 1][0]

            r_detail = session.get(f'{BASE_URL}/records/{rec["id"]}', params={'include_history': 'true'})
            detail = r_detail.json()['data']

            assert 'status_history' in detail
            assert len(detail['status_history']) >= 2, f'状态历史太少: {len(detail["status_history"])}'
            assert 'note_history' in detail
            assert len(detail['note_history']) >= 1

            contract_notes = [n for n in detail['note_history'] if n['is_original']]
            assert len(contract_notes) >= 1, '原始合同备注标记丢失'
            assert '合同扫描件备注' in contract_notes[0]['note_content']

            manual_notes = [n for n in detail['note_history'] if n['note_type'] == 'MANUAL_NOTE']
            assert len(manual_notes) >= 1

            confirm_notes = [n for n in detail['note_history'] if n['note_type'] == 'MANUAL_CONFIRM']
            assert len(confirm_notes) >= 1, '缺少人工确认备注'

            r_logs = session.get(f'{BASE_URL}/logs', params={'batch_id': batch_id, 'limit': 50})
            logs = r_logs.json()['data']
            assert len(logs) >= 10, f'操作日志太少: {len(logs)}'

            ops = set(l['operation'] for l in logs)
            expected_ops = {'创建复盘批次', '批量导入完成', '导入穿仓记录', '重复导入检测', '状态更新'}
            for op in expected_ops:
                assert op in ops, f'操作日志缺少: {op}'

            print()
            print_color('    历史追溯验证:', 'YELLOW')
            print_color(f'      - 状态流转历史: {len(detail["status_history"])}条', 'YELLOW')
            print_color(f'      - 备注历史: {len(detail["note_history"])}条 (原始{len(contract_notes)}, 人工{len(manual_notes)}, 确认{len(confirm_notes)})', 'YELLOW')
            print_color(f'      - 操作日志: {len(logs)}条', 'YELLOW')
            print_color(f'      - 每条记录都有: 来源(source) + 操作人(operator) + 时间(created_at)', 'GREEN')
            print_color(f'      - 别人接手时: 看日志和历史就知道为什么这么判', 'GREEN')

            return True

        results.append(test_step('历史追溯、备注分类、操作日志', test_history_and_logs))

        print_header('测试7: 重启服务后数据一致性')

        def test_save_data_before_restart():
            r = session.get(f'{BASE_URL}/records', params={'batch_id': batch_id})
            records_before = r.json()['data']

            r_exp = session.get(f'{BASE_URL}/export/report', params={'batch_id': batch_id})
            export_before = r_exp.json()['data']['summary']

            r_notes = session.get(f'{BASE_URL}/records/REC-002', params={'include_history': 'true'})
            rec002_list = [r for r in r_notes.json()['data'] if r['version'] == 1]
            assert len(rec002_list) > 0
            rec002_before = rec002_list[0]

            with open('_test_state.json', 'w') as f:
                json.dump({
                    'records_count': len(records_before),
                    'export_summary': export_before,
                    'rec002_note': rec002_before['contract_original_note'],
                    'rec002_status': rec002_before['current_status'],
                    'rec002_has_exception': rec002_before['has_exception'],
                    'exception_count': export_before['exception_count']
                }, f, ensure_ascii=False, indent=2)

            return True

        results.append(test_step('保存重启前数据快照', test_save_data_before_restart))

        stop_server(proc)
        time.sleep(3)

        proc = start_server()
        if not proc:
            return False

        def test_verify_after_restart():
            with open('_test_state.json', 'r') as f:
                before = json.load(f)

            r = session.get(f'{BASE_URL}/records', params={'batch_id': batch_id})
            records_after = r.json()['data']
            assert len(records_after) == before['records_count'], f'重启后记录数不一致: {len(records_after)} != {before["records_count"]}'

            r_exp = session.get(f'{BASE_URL}/export/report', params={'batch_id': batch_id})
            export_after = r_exp.json()['data']['summary']

            for key in ['total_records', 'total_shortfall', 'total_refund', 'exception_count', 'late_attachment_count']:
                assert export_after[key] == before['export_summary'][key], \
                    f'重启后{key}不一致: {export_after[key]} != {before["export_summary"][key]}'

            r_notes = session.get(f'{BASE_URL}/records/REC-002', params={'include_history': 'true'})
            rec002_list = [r for r in r_notes.json()['data'] if r['version'] == 1]
            assert len(rec002_list) > 0
            rec002_after = rec002_list[0]

            assert rec002_after['contract_original_note'] == before['rec002_note'], '重启后合同原始备注被改了！'
            assert rec002_after['current_status'] == before['rec002_status'], '重启后状态变了！'
            assert rec002_after['has_exception'] == before['rec002_has_exception'], '重启后例外标记丢了！'

            r_notes7 = session.get(f'{BASE_URL}/records/REC-007/versions', params={'batch_id': batch_id})
            versions_after = r_notes7.json()['data']
            assert len(versions_after) == 2, '重启后版本历史丢了！'

            print()
            print_color('    重启后数据一致性验证:', 'GREEN')
            print_color(f'      - 记录总数: {len(records_after)} == {before["records_count"]}', 'GREEN')
            print_color(f'      - 穿仓总额: {export_after["total_shortfall"]} == {before["export_summary"]["total_shortfall"]}', 'GREEN')
            print_color(f'      - 例外记录数: {export_after["exception_count"]} == {before["export_summary"]["exception_count"]}', 'GREEN')
            print_color(f'      - REC-002合同备注: 完整保留，未被篡改', 'GREEN')
            print_color(f'      - REC-007版本历史: v1和v2都在', 'GREEN')
            print_color(f'      - 门店财务老曹接手: 不用重新翻合同扫描件！', 'GREEN')

            os.remove('_test_state.json')
            return True

        results.append(test_step('重启后验证数据完全一致', test_verify_after_restart))

        print_header('测试8: 边界记录特殊验证')

        def test_boundary_records_preserved():
            r = session.get(f'{BASE_URL}/records', params={'has_exception': 'true'})
            exceptions = r.json()['data']

            r_all = session.get(f'{BASE_URL}/export/report', params={'batch_id': batch_id})
            report = r_all.json()['data']
            summary = report['summary']

            boundary_quality = summary['by_quality'].get('边界记录', 0)
            null_quality = summary['by_quality'].get('有空值', 0)
            dirty_quality = summary['by_quality'].get('脏数据', 0)
            dup_quality = summary['by_quality'].get('有重复', 0)

            print()
            print_color('    脏数据在汇总中都有交代:', 'YELLOW')
            print_color(f'      - 边界记录: {boundary_quality}条 (穿仓=0, 穿仓<0, 退款>已缴, 超大额)', 'YELLOW')
            print_color(f'      - 有空值: {null_quality}条', 'YELLOW')
            print_color(f'      - 有重复: {dup_quality}条', 'YELLOW')
            print_color(f'      - 脏数据: {dirty_quality}条', 'YELLOW')
            print_color(f'      - 例外总数: {summary["exception_count"]}条，都在，没有悄悄消失！', 'GREEN')

            assert boundary_quality >= 4, f'边界记录计数不对: {boundary_quality}'
            assert null_quality >= 1, f'空值记录计数不对: {null_quality}'
            assert dup_quality >= 1, f'重复记录计数不对: {dup_quality}'
            assert summary['exception_count'] >= 6, f'例外记录不够: {summary["exception_count"]}'

            return True

        results.append(test_step('边界记录、脏数据在汇总中不消失', test_boundary_records_preserved))

    finally:
        stop_server(proc)
        if os.path.exists('_test_state.json'):
            os.remove('_test_state.json')

    print_header('测试结果汇总')

    passed = sum(1 for r in results if r)
    total = len(results)

    print()
    print_color(f'总计: {passed}/{total} 测试通过', 'GREEN' if passed == total else 'RED', bold=True)
    print()

    if passed == total:
        print_color('✓ 所有测试通过！系统可以实际跑通外汇保证金穿仓复盘流程。', 'GREEN', bold=True)
        print()
        print_color('核心特性验证:', 'BLUE')
        print_color('  ✓ 批次、状态、人工确认、导出报告读同一份本地SQLite数据', 'GREEN')
        print_color('  ✓ 合同扫描件乱备注完整保留，不会为了整齐而洗掉', 'GREEN')
        print_color('  ✓ 晚到附件创建新版本，不直接覆盖原判断，前后变化有记录', 'GREEN')
        print_color('  ✓ 例外记录在汇总数字中单独标记，不会悄悄消失', 'GREEN')
        print_color('  ✓ 脏材料(空值/重复/边界)进来时有明确交代和质量标记', 'GREEN')
        print_color('  ✓ 每条记录都保留原始来源、操作人、处理时间，可追溯', 'GREEN')
        print_color('  ✓ 重启服务后历史备注和导出数字完全一致', 'GREEN')
        print_color('  ✓ 门店财务老曹接手时不用重新翻合同扫描件', 'GREEN')
        return True
    else:
        print_color('✗ 有测试失败，请检查上面的错误信息。', 'RED', bold=True)
        return False


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
