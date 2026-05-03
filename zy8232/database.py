import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
import os


DB_PATH = os.path.join(os.path.dirname(__file__), 'school_bus.db')


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            grade TEXT,
            class_name TEXT,
            parent_name TEXT,
            parent_phone TEXT,
            route_id TEXT,
            pickup_stop TEXT,
            dropoff_stop TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS swipe_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            swipe_id TEXT UNIQUE NOT NULL,
            student_id TEXT NOT NULL,
            timestamp TIMESTAMP NOT NULL,
            direction TEXT NOT NULL,
            vehicle_id TEXT NOT NULL,
            route_id TEXT,
            stop_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS routes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            route_id TEXT UNIQUE NOT NULL,
            route_name TEXT NOT NULL,
            vehicle_id TEXT,
            teacher_name TEXT,
            teacher_phone TEXT,
            stops TEXT,
            is_night_route INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS teacher_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            note_id TEXT UNIQUE NOT NULL,
            student_id TEXT NOT NULL,
            date TEXT NOT NULL,
            note_type TEXT,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS issues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            issue_id TEXT UNIQUE NOT NULL,
            student_id TEXT NOT NULL,
            student_name TEXT,
            issue_type TEXT NOT NULL,
            description TEXT,
            date TEXT,
            vehicle_id TEXT,
            route_id TEXT,
            swipe_id TEXT,
            is_handled INTEGER DEFAULT 0,
            handled_by TEXT,
            handled_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS trip_status (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trip_id TEXT UNIQUE NOT NULL,
            student_id TEXT NOT NULL,
            date TEXT,
            vehicle_id TEXT,
            route_id TEXT,
            status TEXT,
            boarded_at TIMESTAMP,
            alighted_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()


def save_students(students: List[Dict[str, Any]]):
    conn = get_connection()
    cursor = conn.cursor()
    
    for student in students:
        cursor.execute('''
            INSERT OR REPLACE INTO students 
            (student_id, name, grade, class_name, parent_name, parent_phone, route_id, pickup_stop, dropoff_stop)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            student.get('student_id'),
            student.get('name'),
            student.get('grade'),
            student.get('class_name'),
            student.get('parent_name'),
            student.get('parent_phone'),
            student.get('route_id'),
            student.get('pickup_stop'),
            student.get('dropoff_stop')
        ))
    
    conn.commit()
    conn.close()


def save_swipe_records(records: List[Dict[str, Any]]):
    conn = get_connection()
    cursor = conn.cursor()
    
    for record in records:
        cursor.execute('''
            INSERT OR REPLACE INTO swipe_records 
            (swipe_id, student_id, timestamp, direction, vehicle_id, route_id, stop_name)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            record.get('swipe_id'),
            record.get('student_id'),
            record.get('timestamp'),
            record.get('direction'),
            record.get('vehicle_id'),
            record.get('route_id'),
            record.get('stop_name')
        ))
    
    conn.commit()
    conn.close()


def save_routes(routes: List[Dict[str, Any]]):
    conn = get_connection()
    cursor = conn.cursor()
    
    for route in routes:
        cursor.execute('''
            INSERT OR REPLACE INTO routes 
            (route_id, route_name, vehicle_id, teacher_name, teacher_phone, stops, is_night_route)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            route.get('route_id'),
            route.get('route_name'),
            route.get('vehicle_id'),
            route.get('teacher_name'),
            route.get('teacher_phone'),
            json.dumps(route.get('stops', []), ensure_ascii=False),
            1 if route.get('is_night_route', False) else 0
        ))
    
    conn.commit()
    conn.close()


def save_teacher_notes(notes: List[Dict[str, Any]]):
    conn = get_connection()
    cursor = conn.cursor()
    
    for note in notes:
        cursor.execute('''
            INSERT OR REPLACE INTO teacher_notes 
            (note_id, student_id, date, note_type, description)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            note.get('note_id'),
            note.get('student_id'),
            note.get('date'),
            note.get('note_type'),
            note.get('description')
        ))
    
    conn.commit()
    conn.close()


def save_issues(issues: List[Dict[str, Any]]):
    conn = get_connection()
    cursor = conn.cursor()
    
    for issue in issues:
        cursor.execute('''
            INSERT OR REPLACE INTO issues 
            (issue_id, student_id, student_name, issue_type, description, date, vehicle_id, route_id, swipe_id, is_handled)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            issue.get('issue_id'),
            issue.get('student_id'),
            issue.get('student_name'),
            issue.get('issue_type'),
            issue.get('description'),
            issue.get('date'),
            issue.get('vehicle_id'),
            issue.get('route_id'),
            issue.get('swipe_id'),
            1 if issue.get('is_handled', False) else 0
        ))
    
    conn.commit()
    conn.close()


def save_trip_status(trips: List[Dict[str, Any]]):
    conn = get_connection()
    cursor = conn.cursor()
    
    for trip in trips:
        cursor.execute('''
            INSERT OR REPLACE INTO trip_status 
            (trip_id, student_id, date, vehicle_id, route_id, status, boarded_at, alighted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            trip.get('trip_id'),
            trip.get('student_id'),
            trip.get('date'),
            trip.get('vehicle_id'),
            trip.get('route_id'),
            trip.get('status'),
            trip.get('boarded_at'),
            trip.get('alighted_at')
        ))
    
    conn.commit()
    conn.close()


def get_all_students() -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM students')
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_all_swipe_records() -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM swipe_records ORDER BY timestamp')
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_all_routes() -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM routes')
    rows = cursor.fetchall()
    conn.close()
    result = []
    for row in rows:
        r = dict(row)
        r['stops'] = json.loads(r['stops']) if r['stops'] else []
        r['is_night_route'] = bool(r['is_night_route'])
        result.append(r)
    return result


def get_all_teacher_notes() -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM teacher_notes')
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_issues(date: Optional[str] = None, vehicle_id: Optional[str] = None, is_handled: Optional[bool] = None) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    
    query = 'SELECT * FROM issues WHERE 1=1'
    params = []
    
    if date:
        query += ' AND date = ?'
        params.append(date)
    if vehicle_id:
        query += ' AND vehicle_id = ?'
        params.append(vehicle_id)
    if is_handled is not None:
        query += ' AND is_handled = ?'
        params.append(1 if is_handled else 0)
    
    query += ' ORDER BY created_at DESC'
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for row in rows:
        r = dict(row)
        r['is_handled'] = bool(r['is_handled'])
        result.append(r)
    return result


def get_trip_status(date: Optional[str] = None, vehicle_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    
    query = 'SELECT * FROM trip_status WHERE 1=1'
    params = []
    
    if date:
        query += ' AND date = ?'
        params.append(date)
    if vehicle_id:
        query += ' AND vehicle_id = ?'
        params.append(vehicle_id)
    
    query += ' ORDER BY boarded_at'
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def mark_issue_handled(issue_id: str, handled_by: str = 'admin'):
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE issues 
        SET is_handled = 1, handled_by = ?, handled_at = CURRENT_TIMESTAMP
        WHERE issue_id = ?
    ''', (handled_by, issue_id))
    
    conn.commit()
    conn.close()


def get_available_dates() -> List[str]:
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT DISTINCT date FROM issues 
        UNION 
        SELECT DISTINCT date FROM trip_status
        ORDER BY date DESC
    ''')
    
    rows = cursor.fetchall()
    conn.close()
    return [row[0] for row in rows]


def get_available_vehicles() -> List[str]:
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT DISTINCT vehicle_id FROM issues 
        UNION 
        SELECT DISTINCT vehicle_id FROM trip_status
        ORDER BY vehicle_id
    ''')
    
    rows = cursor.fetchall()
    conn.close()
    return [row[0] for row in rows]


def get_student_by_id(student_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM students WHERE student_id = ?', (student_id,))
    row = cursor.fetchone()
    conn.close()
    
    return dict(row) if row else None


init_db()
