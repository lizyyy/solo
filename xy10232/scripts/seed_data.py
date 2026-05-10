#!/usr/bin/env python3
import sys
import os
import json

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


def seed_caregivers():
    caregivers = [
        {'name': '张护理', 'employee_id': 'CG001', 'phone': '13800138001', 'status': 'active'},
        {'name': '李护理', 'employee_id': 'CG002', 'phone': '13800138002', 'status': 'active'},
        {'name': '王护理', 'employee_id': 'CG003', 'phone': '13800138003', 'status': 'active'},
        {'name': '赵主管', 'employee_id': 'CG004', 'phone': '13800138004', 'status': 'active'}
    ]
    
    results = []
    for cg in caregivers:
        resp = requests.post(f'{BASE_URL}/routes/caregivers', json=cg)
        results.append(resp)
        print_response(f'创建护理员: {cg["name"]}', resp)
    
    return results


def seed_patrol_points():
    points = [
        {'name': '一楼大厅', 'code': 'P001', 'location': '养老院1楼入口处', 'description': '夜间入口安全检查点'},
        {'name': '101房间', 'code': 'P002', 'location': '养老院1楼东侧', 'description': '老人居住区'},
        {'name': '102房间', 'code': 'P003', 'location': '养老院1楼东侧', 'description': '老人居住区'},
        {'name': '二楼走廊', 'code': 'P004', 'location': '养老院2楼', 'description': '公共区域巡查'},
        {'name': '201房间', 'code': 'P005', 'location': '养老院2楼西侧', 'description': '老人居住区'},
        {'name': '202房间', 'code': 'P006', 'location': '养老院2楼西侧', 'description': '老人居住区'},
        {'name': '三楼活动区', 'code': 'P007', 'location': '养老院3楼', 'description': '公共活动区域'},
        {'name': '消防控制室', 'code': 'P008', 'location': '地下室', 'description': '安全设备检查点'}
    ]
    
    results = []
    for pt in points:
        resp = requests.post(f'{BASE_URL}/routes/points', json=pt)
        results.append(resp)
        print_response(f'创建巡更点: {pt["name"]}', resp)
    
    return results


def seed_patrol_routes():
    night_route = {
        'name': '夜班巡更路线A',
        'description': '夜班常规巡更路线，覆盖主要区域',
        'shift_type': 'night',
        'start_time': '22:00',
        'end_time': '06:00',
        'status': 'active',
        'points': [
            {'point_id': 1, 'required': True, 'tolerance_minutes': 10},
            {'point_id': 2, 'required': True, 'tolerance_minutes': 10},
            {'point_id': 3, 'required': True, 'tolerance_minutes': 15},
            {'point_id': 4, 'required': True, 'tolerance_minutes': 10},
            {'point_id': 5, 'required': True, 'tolerance_minutes': 10},
            {'point_id': 6, 'required': True, 'tolerance_minutes': 15},
            {'point_id': 7, 'required': False, 'tolerance_minutes': 20},
            {'point_id': 8, 'required': True, 'tolerance_minutes': 10}
        ]
    }
    
    evening_route = {
        'name': '晚班巡更路线B',
        'description': '晚班巡更路线，覆盖重点区域',
        'shift_type': 'evening',
        'start_time': '18:00',
        'end_time': '22:00',
        'status': 'active',
        'points': [
            {'point_id': 1, 'required': True, 'tolerance_minutes': 10},
            {'point_id': 4, 'required': True, 'tolerance_minutes': 10},
            {'point_id': 7, 'required': True, 'tolerance_minutes': 15},
            {'point_id': 8, 'required': True, 'tolerance_minutes': 10}
        ]
    }
    
    routes = [night_route, evening_route]
    results = []
    for route in routes:
        resp = requests.post(f'{BASE_URL}/routes', json=route)
        results.append(resp)
        print_response(f'创建巡更路线: {route["name"]}', resp)
    
    return results


def main():
    print('开始初始化养老院夜巡系统数据...')
    print('\n' + '='*60)
    print('注意：请确保后端服务已启动 (python run.py)')
    print('='*60)
    
    input('\n按回车键开始造数...')
    
    print('\n' + '='*60)
    print('第一步：创建护理员')
    print('='*60)
    seed_caregivers()
    
    print('\n' + '='*60)
    print('第二步：创建巡更点')
    print('='*60)
    seed_patrol_points()
    
    print('\n' + '='*60)
    print('第三步：创建巡更路线')
    print('='*60)
    seed_patrol_routes()
    
    print('\n' + '='*60)
    print('数据初始化完成！')
    print('='*60)
    print('\n已创建：')
    print('- 4 名护理员 (张护理、李护理、王护理、赵主管)')
    print('- 8 个巡更点')
    print('- 2 条巡更路线 (夜班A、晚班B)')


if __name__ == '__main__':
    main()
