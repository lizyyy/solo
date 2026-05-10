#!/usr/bin/env python3
import json
import requests
import sys
import time
from datetime import datetime

BASE_URL = 'http://localhost:8080/api'

def wait_for_server():
    print('等待服务启动...', end='', flush=True)
    for i in range(30):
        try:
            r = requests.get(f'{BASE_URL}/health', timeout=2)
            if r.status_code == 200:
                print(' 就绪')
                return True
        except requests.ConnectionError:
            pass
        print('.', end='', flush=True)
        time.sleep(1)
    print(' 超时')
    return False

def headers(user_type):
    return {'X-User-Type': user_type}

h = headers

def test_health():
    print('\n[测试] 健康检查')
    r = requests.get(f'{BASE_URL}/health')
    assert r.status_code == 200
    print(f'  状态: {r.json()["status"]}')

def test_roles():
    print('\n[测试] 角色列表')
    r = requests.get(f'{BASE_URL}/roles', headers=h('admin'))
    assert r.status_code == 200
    data = r.json()
    print(f'  当前用户: {data["current_user"]["name"]} ({data["current_user"]["role"]})')
    print(f'  角色数: {len(data["roles"])}')
    for role in data['roles']:
        export_perm = '可导出' if role['can_export'] else '不可导出'
        print(f'    - {role["name"]}: {export_perm}')

def test_viewer_desensitization():
    print('\n[测试] 普通查看者角色脱敏')
    r = requests.get(f'{BASE_URL}/logs?page=1&per_page=3', headers=h('viewer'))
    assert r.status_code == 200
    data = r.json()
    logs = data['logs']
    print(f'  查看者看到的日志(前3条):')
    for log in logs[:3]:
        print(f'    event_id: {log["event_id"]}')
        print(f'      user_name: {log["user_name"]} (应该脱敏: 只显示首字)')
        print(f'      request_data: {log["request_data"]} (应该显示 [无权限])')

def test_admin_full_access():
    print('\n[测试] 管理员完整权限')
    r = requests.get(f'{BASE_URL}/logs?page=1&per_page=1', headers=h('admin'))
    assert r.status_code == 200
    data = r.json()
    log = data['logs'][0]
    print(f'  管理员看到的日志:')
    print(f'    user_name: {log["user_name"]} (姓名脱敏但可见)')
    print(f'    request_data: {log["request_data"]} (隐藏显示 ******)')

def test_field_strategies_admin_only():
    print('\n[测试] 字段策略权限控制')
    r = requests.get(f'{BASE_URL}/field-strategies', headers=h('viewer'))
    assert r.status_code == 403
    print(f'  普通用户查看策略: 被拒绝 (正确)')
    
    r = requests.get(f'{BASE_URL}/field-strategies', headers=h('admin'))
    assert r.status_code == 200
    data = r.json()
    print(f'  管理员查看策略: {len(data["strategies"])} 条')
    for s in data['strategies'][:3]:
        print(f'    - {s["field_name"]}: {s["description"]}')

def test_export_permission():
    print('\n[测试] 导出权限控制')
    r = requests.post(f'{BASE_URL}/logs/export', 
                     json={'format': 'json', 'status': 'success'},
                     headers=h('viewer'))
    assert r.status_code == 403
    print(f'  普通查看者导出: 被拒绝 (正确)')
    
    r = requests.post(f'{BASE_URL}/logs/export',
                     json={'format': 'json', 'status': 'success', 'log_ids': [1, 2, 3]},
                     headers=h('auditor'))
    assert r.status_code == 200
    export_data = r.json()
    print(f'  审计员导出: 成功')
    print(f'    导出水印 hash: {export_data["watermark"]["hash"]}')
    print(f'    导出操作人: {export_data["watermark"]["operator_name"]}')
    print(f'    日志数量: {len(export_data["logs"])} 条')

def test_supplement_and_withdraw():
    print('\n[测试] 补录和撤回')
    event_id = f'TEST_SUPPLEMENT_{int(time.time())}'
    supplement_data = {
        'event_id': event_id,
        'user_id': 'UID-TEST999',
        'user_name': '测试补录',
        'action': '手动补录测试',
        'resource': '/api/test/supplement',
        'ip_address': '10.0.0.1',
        'reason': '测试补录功能'
    }
    
    r = requests.post(f'{BASE_URL}/logs/supplement', 
                     json=supplement_data,
                     headers=h('viewer'))
    assert r.status_code == 403
    print(f'  普通查看者补录: 被拒绝 (正确)')
    
    r = requests.post(f'{BASE_URL}/logs/supplement',
                     json=supplement_data,
                     headers=h('auditor'))
    assert r.status_code == 200
    print(f'  审计员补录: 成功, event_id={event_id}')
    log_id = r.json()['log_id']
    
    r = requests.get(f'{BASE_URL}/logs/{event_id}/history', headers=h('admin'))
    assert r.status_code == 200
    history = r.json()
    print(f'  日志历史: {history["history_count"]} 条')
    for hist_item in history['histories']:
        print(f'    - {hist_item["action_type"]}: {hist_item["operator_name"]} at {hist_item["created_at"]}')
    
    r = requests.post(f'{BASE_URL}/logs/{event_id}/withdraw',
                     json={'reason': '测试撤回'},
                     headers=h('auditor'))
    assert r.status_code == 403
    print(f'  审计员撤回: 被拒绝 (只有管理员可撤回，正确)')
    
    r = requests.post(f'{BASE_URL}/logs/{event_id}/withdraw',
                     json={'reason': '测试撤回功能'},
                     headers=h('admin'))
    assert r.status_code == 200
    print(f'  管理员撤回: 成功')
    
    r = requests.get(f'{BASE_URL}/logs/{event_id}', headers=h('admin'))
    assert r.status_code == 404
    print(f'  撤回后查询: 已不可见 (正确)')
    
    r = requests.get(f'{BASE_URL}/logs/{event_id}/history', headers=h('admin'))
    history = r.json()
    print(f'  撤回后历史记录: {history["history_count"]} 条')
    for hist_item in history['histories']:
        print(f'    - {hist_item["action_type"]}: {hist_item["operator_name"]}, reason={hist_item["reason"]}')

def test_access_audit():
    print('\n[测试] 访问审计')
    r = requests.get(f'{BASE_URL}/access-audit', headers=h('viewer'))
    assert r.status_code == 403
    print(f'  普通查看者查看访问审计: 被拒绝 (正确)')
    
    r = requests.get(f'{BASE_URL}/access-audit?page=1&per_page=5', headers=h('admin'))
    assert r.status_code == 200
    data = r.json()
    print(f'  管理员查看访问审计: {data["pagination"]["total"]} 条记录')
    for record in data['records'][:3]:
        print(f'    - {record["action"]}: {record["operator_name"]}({record["operator_role"]}) at {record["timestamp"]}')

def test_compliance_report():
    print('\n[测试] 合规报表')
    r = requests.get(f'{BASE_URL}/compliance-report?days=7', headers=h('auditor'))
    assert r.status_code == 200
    data = r.json()
    summary = data['summary']
    print(f'  报表周期: {summary["period"]["start"]} ~ {summary["period"]["end"]}')
    print(f'  总日志数: {summary["total_logs"]}')
    print(f'  已撤回日志: {summary["withdrawn_logs"]}')
    print(f'  补录日志: {summary["supplemented_logs"]}')
    print(f'  导出次数: {summary["export_count"]}')
    print(f'  查看次数: {summary["view_count"]}')
    print(f'  按角色访问统计:')
    for role, count in summary['access_by_role'].items():
        print(f'    {role}: {count} 次')

def test_consistency():
    print('\n[测试] 数据重跑稳定性')
    event_id = 'EVT-000005'
    results = []
    for i in range(3):
        r = requests.get(f'{BASE_URL}/logs/{event_id}', headers=h('viewer'))
        results.append(r.json())
    
    all_same = all(r == results[0] for r in results)
    print(f'  同一日志3次查询结果一致: {all_same}')
    print(f'  脱敏结果稳定 (固定规则): 姓名={results[0]["user_name"]}')

def main():
    print('=' * 60)
    print('审计日志脱敏授权 API 功能验证脚本')
    print('=' * 60)
    
    if not wait_for_server():
        print('\n错误: 无法连接到服务器，请先运行: python app.py')
        sys.exit(1)
    
    tests = [
        ('健康检查', test_health),
        ('角色列表', test_roles),
        ('查看者脱敏', test_viewer_desensitization),
        ('管理员权限', test_admin_full_access),
        ('字段策略权限', test_field_strategies_admin_only),
        ('导出权限控制', test_export_permission),
        ('补录和撤回', test_supplement_and_withdraw),
        ('访问审计', test_access_audit),
        ('合规报表', test_compliance_report),
        ('数据稳定性', test_consistency),
    ]
    
    passed = 0
    failed = 0
    
    for name, test_func in tests:
        try:
            test_func()
            passed += 1
        except Exception as e:
            print(f'  ❌ 失败: {e}')
            import traceback
            traceback.print_exc()
            failed += 1
    
    print('\n' + '=' * 60)
    print(f'测试完成: 通过 {passed}, 失败 {failed}')
    print('=' * 60)
    
    if failed > 0:
        sys.exit(1)

if __name__ == '__main__':
    main()
