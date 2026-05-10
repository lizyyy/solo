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
    print('开始执行顺利样例：张护理完整完成夜班巡更')
    print('\n' + '='*60)
    print('业务场景：')
    print('1. 张护理正常完成夜班巡更路线A的所有打卡点')
    print('2. 其中一个打卡点需要补录，申请后由赵主管批准')
    print('3. 进行漏巡检测，确认无漏巡')
    print('4. 生成夜巡报表，完成率100%')
    print('='*60)
    
    input('\n按回车键开始...')
    
    ids = get_ids()
    print(f'\n获取到的ID: {json.dumps(ids, ensure_ascii=False, indent=2)}')
    
    today = datetime.now().strftime('%Y-%m-%d')
    shift_date = today
    
    print('\n' + '='*60)
    print('第一步：张护理进行正常打卡')
    print('='*60)
    
    checkin_time1 = f'{shift_date} 22:05:00'
    checkin1 = {
        'route_id': ids['night_route'],
        'point_id': ids['points']['P001'],
        'caregiver_id': ids['zhang'],
        'checkin_time': checkin_time1,
        'checkin_type': 'normal',
        'notes': '正常打卡，一楼大厅一切正常'
    }
    resp1 = requests.post(f'{BASE_URL}/checkins', json=checkin1)
    print_response('打卡1: 一楼大厅 (22:05)', resp1)
    
    checkin_time2 = f'{shift_date} 22:15:00'
    checkin2 = {
        'route_id': ids['night_route'],
        'point_id': ids['points']['P002'],
        'caregiver_id': ids['zhang'],
        'checkin_time': checkin_time2,
        'checkin_type': 'normal',
        'notes': '正常打卡，101房间老人休息良好'
    }
    resp2 = requests.post(f'{BASE_URL}/checkins', json=checkin2)
    print_response('打卡2: 101房间 (22:15)', resp2)
    
    checkin_time3 = f'{shift_date} 22:30:00'
    checkin3 = {
        'route_id': ids['night_route'],
        'point_id': ids['points']['P003'],
        'caregiver_id': ids['zhang'],
        'checkin_time': checkin_time3,
        'checkin_type': 'normal',
        'notes': '正常打卡，102房间巡查完毕'
    }
    resp3 = requests.post(f'{BASE_URL}/checkins', json=checkin3)
    print_response('打卡3: 102房间 (22:30)', resp3)
    
    checkin_time4 = f'{shift_date} 22:45:00'
    checkin4 = {
        'route_id': ids['night_route'],
        'point_id': ids['points']['P004'],
        'caregiver_id': ids['zhang'],
        'checkin_time': checkin_time4,
        'checkin_type': 'normal',
        'notes': '正常打卡，二楼走廊安全'
    }
    resp4 = requests.post(f'{BASE_URL}/checkins', json=checkin4)
    print_response('打卡4: 二楼走廊 (22:45)', resp4)
    
    checkin_time5 = f'{shift_date} 23:00:00'
    checkin5 = {
        'route_id': ids['night_route'],
        'point_id': ids['points']['P005'],
        'caregiver_id': ids['zhang'],
        'checkin_time': checkin_time5,
        'checkin_type': 'normal',
        'notes': '正常打卡，201房间老人状态良好'
    }
    resp5 = requests.post(f'{BASE_URL}/checkins', json=checkin5)
    print_response('打卡5: 201房间 (23:00)', resp5)
    
    input('\n按回车键继续...')
    
    print('\n' + '='*60)
    print('第二步：张护理漏打202房间，后续申请补录')
    print('='*60)
    
    checkin_time6 = f'{shift_date} 23:30:00'
    checkin6 = {
        'route_id': ids['night_route'],
        'point_id': ids['points']['P006'],
        'caregiver_id': ids['zhang'],
        'checkin_time': checkin_time6,
        'checkin_type': 'supplement',
        'notes': '事后补录，202房间巡查完毕'
    }
    resp6 = requests.post(f'{BASE_URL}/checkins', json=checkin6)
    print_response('补录打卡: 202房间 (23:30)', resp6)
    
    checkin6_id = resp6.json()['data']['id']
    
    supplement_request = {
        'checkin_id': checkin6_id,
        'requester_id': ids['zhang'],
        'reason': '当时正在处理101房间老人紧急情况，未能及时打卡，事后补录。有监控录像为证。',
        'evidence': '监控录像编号: CAM-20240115-2315'
    }
    resp_supplement = requests.post(f'{BASE_URL}/supplements', json=supplement_request)
    print_response('提交补录申请', resp_supplement)
    
    supplement_id = resp_supplement.json()['data']['id']
    
    input('\n按回车键继续...')
    
    print('\n' + '='*60)
    print('第三步：赵主管审批补录申请 - 批准')
    print('='*60)
    
    approval = {
        'reviewer_id': ids['zhao'],
        'review_comment': '经核实监控录像，情况属实。补录申请批准。'
    }
    resp_approve = requests.post(f'{BASE_URL}/supplements/{supplement_id}/approve', json=approval)
    print_response('赵主管批准补录申请', resp_approve)
    
    input('\n按回车键继续...')
    
    print('\n' + '='*60)
    print('第四步：张护理继续完成剩余打卡')
    print('='*60)
    
    checkin_time7 = f'{shift_date} 00:15:00'
    checkin7 = {
        'route_id': ids['night_route'],
        'point_id': ids['points']['P008'],
        'caregiver_id': ids['zhang'],
        'checkin_time': checkin_time7,
        'checkin_type': 'normal',
        'notes': '正常打卡，消防控制室设备正常'
    }
    resp7 = requests.post(f'{BASE_URL}/checkins', json=checkin7)
    print_response('打卡7: 消防控制室 (00:15)', resp7)
    
    input('\n按回车键继续...')
    
    print('\n' + '='*60)
    print('第五步：进行漏巡检测')
    print('='*60)
    
    detection_request = {
        'route_id': ids['night_route'],
        'caregiver_id': ids['zhang'],
        'shift_date': shift_date
    }
    resp_detection = requests.post(f'{BASE_URL}/detections/detect', json=detection_request)
    print_response('漏巡检测', resp_detection)
    
    result = resp_detection.json()
    print(f'\n漏巡检测结果: 发现 {result["count"]} 条漏巡记录')
    print(f'预期: 应该是0条漏巡（因为所有必要打卡点都已完成，包括补录的202房间）')
    
    input('\n按回车键继续...')
    
    print('\n' + '='*60)
    print('第六步：生成夜巡报表')
    print('='*60)
    
    report_request = {
        'report_date': shift_date,
        'route_id': ids['night_route'],
        'caregiver_id': ids['zhang']
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
    
    print('\n' + '='*60)
    print('顺利样例执行完成！')
    print('='*60)
    print('\n关键要点:')
    print('1. 张护理完成了夜班巡更路线A的所有必要打卡点')
    print('2. 202房间的补录申请得到赵主管批准，计入有效打卡')
    print('3. 漏巡检测结果为0条，符合预期')
    print('4. 夜巡报表完成率100%，包含1条补录记录')
    print('5. 责任班次清晰，张护理为本班次责任护理员')


if __name__ == '__main__':
    main()
