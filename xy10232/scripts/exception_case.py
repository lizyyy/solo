#!/usr/bin/env python3
import sys
import os
import json
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests

BASE_URL = 'http://localhost:5000/api/v1'


def print_response(title, response):
    print(f'\n{"="*60}')
    print(f'{title}')
    print(f'{"="*60}')
    print(f'Status: {response.status_code}')
    if response.headers.get('content-type', '').startswith('application/json'):
        print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    else:
        print(response.text)


def get_ids():
    caregivers = requests.get(f'{BASE_URL}/routes/caregivers').json()['data']
    points = requests.get(f'{BASE_URL}/routes/points').json()['data']
    routes = requests.get(f'{BASE_URL}/routes').json()['data']
    
    return {
        'zhang': next((c['id'] for c in caregivers if c['employee_id'] == 'CG001'), None),
        'li': next((c['id'] for c in caregivers if c['employee_id'] == 'CG002'), None),
        'wang': next((c['id'] for c in caregivers if c['employee_id'] == 'CG003'), None),
        'zhao': next((c['id'] for c in caregivers if c['employee_id'] == 'CG004'), None),
        'night_route': next((r['id'] for r in routes if r['name'] == '夜班巡更路线A'), None),
        'evening_route': next((r['id'] for r in routes if r['name'] == '晚班巡更路线B'), None),
        'points': {p['code']: p['id'] for p in points}
    }


def main():
    print('开始执行异常样例：李护理漏巡 + 补录被拒')
    print('\n' + '='*60)
    print('业务场景：')
    print('1. 李护理夜班巡更时故意漏打多个必要打卡点')
    print('2. 事后试图补录，但申请被赵主管拒绝')
    print('3. 漏巡检测发现多处漏巡，记录责任班次')
    print('4. 生成夜巡报表，完成率低于预期')
    print('='*60)
    
    input('\n按回车键开始...')
    
    ids = get_ids()
    print(f'\n获取到的ID: {json.dumps(ids, ensure_ascii=False, indent=2)}')
    
    today = datetime.now().strftime('%Y-%m-%d')
    shift_date = today
    
    print('\n' + '='*60)
    print('第一步：李护理进行部分打卡（故意漏打）')
    print('='*60)
    
    checkin_time1 = f'{shift_date} 22:10:00'
    checkin1 = {
        'route_id': ids['night_route'],
        'point_id': ids['points']['P001'],
        'caregiver_id': ids['li'],
        'checkin_time': checkin_time1,
        'checkin_type': 'normal',
        'notes': '正常打卡'
    }
    resp1 = requests.post(f'{BASE_URL}/checkins', json=checkin1)
    print_response('打卡1: 一楼大厅 (22:10)', resp1)
    
    checkin_time2 = f'{shift_date} 22:20:00'
    checkin2 = {
        'route_id': ids['night_route'],
        'point_id': ids['points']['P002'],
        'caregiver_id': ids['li'],
        'checkin_time': checkin_time2,
        'checkin_type': 'normal',
        'notes': '正常打卡'
    }
    resp2 = requests.post(f'{BASE_URL}/checkins', json=checkin2)
    print_response('打卡2: 101房间 (22:20)', resp2)
    
    checkin_time3 = f'{shift_date} 00:30:00'
    checkin3 = {
        'route_id': ids['night_route'],
        'point_id': ids['points']['P008'],
        'caregiver_id': ids['li'],
        'checkin_time': checkin_time3,
        'checkin_type': 'normal',
        'notes': '正常打卡'
    }
    resp3 = requests.post(f'{BASE_URL}/checkins', json=checkin3)
    print_response('打卡3: 消防控制室 (00:30)', resp3)
    
    print('\n注意：李护理漏打了 P003, P004, P005, P006 等必要打卡点')
    
    input('\n按回车键继续...')
    
    print('\n' + '='*60)
    print('第二步：李护理试图事后补录')
    print('='*60)
    
    checkin_time4 = f'{shift_date} 23:00:00'
    checkin4 = {
        'route_id': ids['night_route'],
        'point_id': ids['points']['P003'],
        'caregiver_id': ids['li'],
        'checkin_time': checkin_time4,
        'checkin_type': 'supplement',
        'notes': '补录打卡'
    }
    resp4 = requests.post(f'{BASE_URL}/checkins', json=checkin4)
    print_response('补录打卡: 102房间 (23:00)', resp4)
    
    checkin4_id = resp4.json()['data']['id']
    
    supplement_request = {
        'checkin_id': checkin4_id,
        'requester_id': ids['li'],
        'reason': '当时太忙忘记打卡了，补录一下。',
        'evidence': ''
    }
    resp_supplement = requests.post(f'{BASE_URL}/supplements', json=supplement_request)
    print_response('提交补录申请', resp_supplement)
    
    supplement_id = resp_supplement.json()['data']['id']
    
    input('\n按回车键继续...')
    
    print('\n' + '='*60)
    print('第三步：赵主管审批补录申请 - 拒绝')
    print('='*60)
    
    rejection = {
        'reviewer_id': ids['zhao'],
        'review_comment': '经核查监控录像，23:00-23:30期间你并不在102房间附近。补录申请无有效证据，予以拒绝。'
    }
    resp_reject = requests.post(f'{BASE_URL}/supplements/{supplement_id}/reject', json=rejection)
    print_response('赵主管拒绝补录申请', resp_reject)
    
    input('\n按回车键继续...')
    
    print('\n' + '='*60)
    print('第四步：进行漏巡检测')
    print('='*60)
    
    detection_request = {
        'route_id': ids['night_route'],
        'caregiver_id': ids['li'],
        'shift_date': shift_date
    }
    resp_detection = requests.post(f'{BASE_URL}/detections/detect', json=detection_request)
    print_response('漏巡检测', resp_detection)
    
    result = resp_detection.json()
    print(f'\n漏巡检测结果: 发现 {result["count"]} 条漏巡记录')
    print(f'预期: 应该发现多条漏巡记录（P003, P004, P005, P006）')
    
    input('\n按回车键继续...')
    
    print('\n' + '='*60)
    print('第五步：李护理对漏巡记录提出申诉')
    print('='*60)
    
    if result['count'] > 0:
        missed_id = result['data'][0]['id']
        
        appeal = {
            'notes': '我当时在处理其他紧急事务，请求复核。'
        }
        resp_appeal = requests.post(f'{BASE_URL}/detections/{missed_id}/appeal', json=appeal)
        print_response(f'对漏巡记录 {missed_id} 提出申诉', resp_appeal)
        
        print('\n现在漏巡记录状态变为 "appealed"，等待复核')
    
    input('\n按回车键继续...')
    
    print('\n' + '='*60)
    print('第六步：生成夜巡报表')
    print('='*60)
    
    report_request = {
        'report_date': shift_date,
        'route_id': ids['night_route'],
        'caregiver_id': ids['li']
    }
    resp_report = requests.post(f'{BASE_URL}/reports/generate', json=report_request)
    print_response('生成夜巡报表', resp_report)
    
    report = resp_report.json()['data']
    print(f'\n报表摘要:')
    print(f'  - 护理员: {report["caregiver_name"]}')
    print(f'  - 应巡点数: {report["total_points"]}')
    print(f'  - 已巡点数: {report["checked_points"]}')
    print(f'  - 漏巡点数: {report["missed_points"]}')
    print(f'  - 补录数量: {report["supplement_count"]}')
    print(f'  - 完成率: {report["completion_rate"]}%')
    
    input('\n按回车键继续...')
    
    print('\n' + '='*60)
    print('第七步：查看漏巡统计和责任班次')
    print('='*60)
    
    resp_stats = requests.get(f'{BASE_URL}/detections/stats')
    print_response('漏巡统计', resp_stats)
    
    resp_missed = requests.get(f'{BASE_URL}/detections', params={'caregiver_id': ids['li']})
    print_response(f'李护理的漏巡记录 (责任班次)', resp_missed)
    
    if resp_missed.json()['count'] > 0:
        missed = resp_missed.json()['data'][0]
        print(f'\n责任班次: {missed["responsibility_shift"]}')
        print(f'这清楚地记录了李护理在哪个班次、哪个巡更路线上出现了漏巡')
    
    print('\n' + '='*60)
    print('异常样例执行完成！')
    print('='*60)
    print('\n关键要点:')
    print('1. 李护理故意漏打多个必要打卡点')
    print('2. 补录申请因证据不足被赵主管拒绝，不计入有效打卡')
    print('3. 漏巡检测发现多处漏巡，责任班次清晰记录')
    print('4. 夜巡报表完成率较低，反映真实工作情况')
    print('5. 护理责任明确：李护理为本班次责任护理员，漏巡记录直接关联到其责任')
    print('6. 李护理可对漏巡记录申诉，进入待复核状态')


if __name__ == '__main__':
    main()
