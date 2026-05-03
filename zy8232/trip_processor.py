from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple, Optional
from collections import defaultdict
import hashlib

from database import (
    get_all_students, get_all_swipe_records, get_all_routes, 
    get_all_teacher_notes, save_trip_status, save_issues
)


def parse_timestamp(ts_str: str) -> datetime:
    for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M']:
        try:
            return datetime.strptime(ts_str, fmt)
        except ValueError:
            continue
    return datetime.now()


def get_date_from_timestamp(ts_str: str) -> str:
    dt = parse_timestamp(ts_str)
    return dt.strftime('%Y-%m-%d')


def generate_id(*args) -> str:
    content = '_'.join(str(arg) for arg in args)
    return hashlib.md5(content.encode()).hexdigest()[:12]


def group_records_by_trip(swipe_records: List[Dict], students: List[Dict], routes: List[Dict]) -> Dict:
    students_dict = {s['student_id']: s for s in students}
    routes_dict = {r['route_id']: r for r in routes}
    
    trips = defaultdict(list)
    
    for record in swipe_records:
        student_id = record['student_id']
        route_id = record.get('route_id')
        vehicle_id = record['vehicle_id']
        timestamp = record['timestamp']
        
        student = students_dict.get(student_id)
        route = routes_dict.get(route_id) if route_id else None
        
        trip_date = get_date_from_timestamp(timestamp)
        
        trip_key = (vehicle_id, route_id or 'UNKNOWN', trip_date)
        
        trips[trip_key].append({
            'record': record,
            'student': student,
            'route': route
        })
    
    return trips


def reconstruct_trip_status(trip_data: List[Dict]) -> Tuple[List[Dict], List[Dict]]:
    trip_statuses = []
    issues = []
    
    student_records = defaultdict(list)
    for item in trip_data:
        student_id = item['record']['student_id']
        student_records[student_id].append(item)
    
    for student_id, records in student_records.items():
        records_sorted = sorted(records, key=lambda x: parse_timestamp(x['record']['timestamp']))
        
        on_board = False
        boarded_at = None
        boarded_record = None
        
        for item in records_sorted:
            record = item['record']
            student = item['student']
            route = item['route']
            
            direction = record['direction']
            timestamp = record['timestamp']
            vehicle_id = record['vehicle_id']
            route_id = record.get('route_id')
            trip_date = get_date_from_timestamp(timestamp)
            
            student_name = student['name'] if student else '未知'
            expected_route_id = student['route_id'] if student else None
            
            if direction == 'ON':
                if on_board:
                    issues.append({
                        'issue_id': generate_id('duplicate_swipe', student_id, timestamp),
                        'student_id': student_id,
                        'student_name': student_name,
                        'issue_type': '重复刷卡',
                        'description': f'学生 {student_name} 在上车状态下再次刷卡上车，时间: {timestamp}',
                        'date': trip_date,
                        'vehicle_id': vehicle_id,
                        'route_id': route_id,
                        'swipe_id': record['swipe_id'],
                        'is_handled': False
                    })
                else:
                    on_board = True
                    boarded_at = timestamp
                    boarded_record = record
                    
                    if expected_route_id and route_id and expected_route_id != route_id:
                        issues.append({
                            'issue_id': generate_id('wrong_route', student_id, timestamp),
                            'student_id': student_id,
                            'student_name': student_name,
                            'issue_type': '错线路',
                            'description': f'学生 {student_name} 应乘坐线路 {expected_route_id}，实际乘坐 {route_id}，时间: {timestamp}',
                            'date': trip_date,
                            'vehicle_id': vehicle_id,
                            'route_id': route_id,
                            'swipe_id': record['swipe_id'],
                            'is_handled': False
                        })
                    
                    if boarded_record:
                        trip_statuses.append({
                            'trip_id': generate_id('trip', student_id, vehicle_id, trip_date),
                            'student_id': student_id,
                            'date': trip_date,
                            'vehicle_id': vehicle_id,
                            'route_id': route_id,
                            'status': 'boarding',
                            'boarded_at': boarded_at,
                            'alighted_at': None
                        })
            
            elif direction == 'OFF':
                if not on_board:
                    issues.append({
                        'issue_id': generate_id('unexpected_alight', student_id, timestamp),
                        'student_id': student_id,
                        'student_name': student_name,
                        'issue_type': '异常下车',
                        'description': f'学生 {student_name} 在未上车状态下刷卡下车，时间: {timestamp}',
                        'date': trip_date,
                        'vehicle_id': vehicle_id,
                        'route_id': route_id,
                        'swipe_id': record['swipe_id'],
                        'is_handled': False
                    })
                else:
                    on_board = False
                    
                    for ts in trip_statuses:
                        if (ts['student_id'] == student_id and 
                            ts['vehicle_id'] == vehicle_id and 
                            ts['status'] == 'boarding'):
                            ts['status'] = 'completed'
                            ts['alighted_at'] = timestamp
                            break
    
    for ts in trip_statuses:
        if ts['status'] == 'boarding':
            student = None
            for item in trip_data:
                if item['student'] and item['student']['student_id'] == ts['student_id']:
                    student = item['student']
                    break
            student_name = student['name'] if student else '未知'
            
            issues.append({
                'issue_id': generate_id('not_alighted', ts['student_id'], ts['date'], ts['vehicle_id']),
                'student_id': ts['student_id'],
                'student_name': student_name,
                'issue_type': '未下车',
                'description': f'学生 {student_name} 于 {ts["boarded_at"]} 上车后未刷卡下车',
                'date': ts['date'],
                'vehicle_id': ts['vehicle_id'],
                'route_id': ts['route_id'],
                'swipe_id': None,
                'is_handled': False
            })
    
    return trip_statuses, issues


def check_leave_students_on_board(trip_data: List[Dict], teacher_notes: List[Dict]) -> List[Dict]:
    issues = []
    
    leave_notes = [n for n in teacher_notes if n.get('note_type') == '请假']
    
    students_dict = {s['student_id']: s for item in trip_data 
                     for s in [item['student']] if item['student']}
    
    for item in trip_data:
        record = item['record']
        student = item['student']
        
        if not student:
            continue
        
        student_id = student['student_id']
        student_name = student['name']
        timestamp = record['timestamp']
        direction = record['direction']
        vehicle_id = record['vehicle_id']
        route_id = record.get('route_id')
        trip_date = get_date_from_timestamp(timestamp)
        
        if direction == 'ON':
            for note in leave_notes:
                if note['student_id'] == student_id and note['date'] == trip_date:
                    issues.append({
                        'issue_id': generate_id('leave_on_board', student_id, trip_date),
                        'student_id': student_id,
                        'student_name': student_name,
                        'issue_type': '请假仍上车',
                        'description': f'学生 {student_name} 已请假（{note["description"]}）但于 {timestamp} 刷卡上车',
                        'date': trip_date,
                        'vehicle_id': vehicle_id,
                        'route_id': route_id,
                        'swipe_id': record['swipe_id'],
                        'is_handled': False
                    })
                    break
    
    return issues


def check_duplicate_swipes(swipe_records: List[Dict], students: List[Dict]) -> List[Dict]:
    issues = []
    
    students_dict = {s['student_id']: s for s in students}
    
    student_swipes = defaultdict(list)
    for record in swipe_records:
        key = (record['student_id'], record['vehicle_id'], record['direction'])
        student_swipes[key].append(record)
    
    for (student_id, vehicle_id, direction), records in student_swipes.items():
        if len(records) > 1:
            records_sorted = sorted(records, key=lambda x: parse_timestamp(x['timestamp']))
            
            for i, record in enumerate(records_sorted):
                if i == 0:
                    continue
                
                prev_record = records_sorted[i - 1]
                current_ts = parse_timestamp(record['timestamp'])
                prev_ts = parse_timestamp(prev_record['timestamp'])
                
                time_diff = current_ts - prev_ts
                
                if time_diff.total_seconds() < 300:
                    student = students_dict.get(student_id)
                    student_name = student['name'] if student else '未知'
                    trip_date = get_date_from_timestamp(record['timestamp'])
                    
                    issues.append({
                        'issue_id': generate_id('quick_duplicate', student_id, record['timestamp']),
                        'student_id': student_id,
                        'student_name': student_name,
                        'issue_type': '重复刷卡',
                        'description': f'学生 {student_name} 在 {prev_record["timestamp"]} 和 {record["timestamp"]} 连续刷卡{direction}，间隔仅 {int(time_diff.total_seconds())} 秒',
                        'date': trip_date,
                        'vehicle_id': vehicle_id,
                        'route_id': record.get('route_id'),
                        'swipe_id': record['swipe_id'],
                        'is_handled': False
                    })
    
    return issues


def check_night_route_cross_midnight(trip_data: List[Dict], routes: List[Dict]) -> List[Dict]:
    issues = []
    
    routes_dict = {r['route_id']: r for r in routes}
    
    for item in trip_data:
        record = item['record']
        route = item['route']
        
        if not route:
            continue
        
        route_id = route['route_id']
        route_info = routes_dict.get(route_id)
        
        if route_info and route_info.get('is_night_route'):
            timestamp = record['timestamp']
            ts = parse_timestamp(timestamp)
            
            if 0 <= ts.hour < 6:
                student = item['student']
                student_name = student['name'] if student else '未知'
                prev_date = (ts - timedelta(days=1)).strftime('%Y-%m-%d')
                
                issues.append({
                    'issue_id': generate_id('midnight_cross', record['student_id'], timestamp),
                    'student_id': record['student_id'],
                    'student_name': student_name,
                    'issue_type': '跨午夜晚托',
                    'description': f'晚托路线 {route_id} 学生 {student_name} 在凌晨 {timestamp} 刷卡，属于前一天日期应为 {prev_date}',
                    'date': prev_date,
                    'vehicle_id': record['vehicle_id'],
                    'route_id': route_id,
                    'swipe_id': record['swipe_id'],
                    'is_handled': False
                })
    
    return issues


def process_all_trips():
    students = get_all_students()
    swipe_records = get_all_swipe_records()
    routes = get_all_routes()
    teacher_notes = get_all_teacher_notes()
    
    trips = group_records_by_trip(swipe_records, students, routes)
    
    all_trip_statuses = []
    all_issues = []
    
    for trip_key, trip_data in trips.items():
        vehicle_id, route_id, trip_date = trip_key
        
        trip_statuses, trip_issues = reconstruct_trip_status(trip_data)
        all_trip_statuses.extend(trip_statuses)
        all_issues.extend(trip_issues)
        
        leave_issues = check_leave_students_on_board(trip_data, teacher_notes)
        all_issues.extend(leave_issues)
        
        night_issues = check_night_route_cross_midnight(trip_data, routes)
        all_issues.extend(night_issues)
    
    duplicate_issues = check_duplicate_swipes(swipe_records, students)
    all_issues.extend(duplicate_issues)
    
    seen_issue_ids = set()
    unique_issues = []
    for issue in all_issues:
        if issue['issue_id'] not in seen_issue_ids:
            seen_issue_ids.add(issue['issue_id'])
            unique_issues.append(issue)
    
    save_trip_status(all_trip_statuses)
    save_issues(unique_issues)
    
    return {
        'trip_statuses': all_trip_statuses,
        'issues': unique_issues,
        'total_trips': len(trips),
        'total_students': len(students),
        'total_issues': len(unique_issues)
    }
