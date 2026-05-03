import csv
import json
import os
from typing import List, Dict, Any
import yaml


def safe_str(value: Any) -> str:
    if value is None:
        return ''
    if isinstance(value, str):
        return value.strip()
    return str(value)


def import_students_csv(file_path: str) -> List[Dict[str, Any]]:
    students = []
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            student = {
                'student_id': row.get('student_id', '').strip(),
                'name': row.get('name', '').strip(),
                'grade': row.get('grade', '').strip(),
                'class_name': row.get('class_name', '').strip(),
                'parent_name': row.get('parent_name', '').strip(),
                'parent_phone': row.get('parent_phone', '').strip(),
                'route_id': row.get('route_id', '').strip(),
                'pickup_stop': row.get('pickup_stop', '').strip(),
                'dropoff_stop': row.get('dropoff_stop', '').strip()
            }
            if student['student_id']:
                students.append(student)
    return students


def import_swipe_jsonl(file_path: str) -> List[Dict[str, Any]]:
    records = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                record = json.loads(line)
                records.append({
                    'swipe_id': record.get('swipe_id', '').strip(),
                    'student_id': record.get('student_id', '').strip(),
                    'timestamp': record.get('timestamp', '').strip(),
                    'direction': record.get('direction', '').strip().upper(),
                    'vehicle_id': record.get('vehicle_id', '').strip(),
                    'route_id': record.get('route_id', '').strip(),
                    'stop_name': record.get('stop_name', '').strip()
                })
    return records


def import_routes_yaml(file_path: str) -> List[Dict[str, Any]]:
    routes = []
    with open(file_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
        if isinstance(data, list):
            for item in data:
                route = {
                    'route_id': safe_str(item.get('route_id')),
                    'route_name': safe_str(item.get('route_name')),
                    'vehicle_id': safe_str(item.get('vehicle_id')),
                    'teacher_name': safe_str(item.get('teacher_name')),
                    'teacher_phone': safe_str(item.get('teacher_phone')),
                    'stops': item.get('stops', []),
                    'is_night_route': item.get('is_night_route', False)
                }
                if route['route_id']:
                    routes.append(route)
        elif isinstance(data, dict):
            if 'routes' in data:
                for item in data['routes']:
                    route = {
                        'route_id': safe_str(item.get('route_id')),
                        'route_name': safe_str(item.get('route_name')),
                        'vehicle_id': safe_str(item.get('vehicle_id')),
                        'teacher_name': safe_str(item.get('teacher_name')),
                        'teacher_phone': safe_str(item.get('teacher_phone')),
                        'stops': item.get('stops', []),
                        'is_night_route': item.get('is_night_route', False)
                    }
                    if route['route_id']:
                        routes.append(route)
    return routes


def import_teacher_notes_csv(file_path: str) -> List[Dict[str, Any]]:
    notes = []
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            note = {
                'note_id': row.get('note_id', '').strip(),
                'student_id': row.get('student_id', '').strip(),
                'date': row.get('date', '').strip(),
                'note_type': row.get('note_type', '').strip(),
                'description': row.get('description', '').strip()
            }
            if note['note_id']:
                notes.append(note)
    return notes


def import_all_data(data_dir: str) -> Dict[str, Any]:
    result = {
        'students': [],
        'swipe_records': [],
        'routes': [],
        'teacher_notes': []
    }
    
    students_file = os.path.join(data_dir, 'students.csv')
    if os.path.exists(students_file):
        result['students'] = import_students_csv(students_file)
    
    swipe_file = os.path.join(data_dir, 'swipe_records.jsonl')
    if os.path.exists(swipe_file):
        result['swipe_records'] = import_swipe_jsonl(swipe_file)
    
    routes_file = os.path.join(data_dir, 'routes.yaml')
    if os.path.exists(routes_file):
        result['routes'] = import_routes_yaml(routes_file)
    
    notes_file = os.path.join(data_dir, 'teacher_notes.csv')
    if os.path.exists(notes_file):
        result['teacher_notes'] = import_teacher_notes_csv(notes_file)
    
    return result
