import sqlite3
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict

from backend.config import Config
from backend.database import get_db, row_to_dict, rows_to_dict_list


class MealMatcher:
    @staticmethod
    def match_meals_for_flight(flight_number: str) -> Dict[str, Any]:
        results = {
            'flight_number': flight_number,
            'matched': 0,
            'unmatched_orders': 0,
            'unmatched_scans': 0,
            'unmatched_confirms': 0,
            'matches': [],
            'issues': []
        }
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            cursor.execute('SELECT * FROM flights WHERE flight_number = ?', (flight_number,))
            flight = cursor.fetchone()
            
            if not flight:
                return {'error': f'Flight {flight_number} not found'}
            
            flight_id = flight['id']
            
            cursor.execute('''
                SELECT * FROM meal_orders 
                WHERE flight_number = ? AND status = 'ordered'
            ''', (flight_number,))
            orders = cursor.fetchall()
            
            cursor.execute('''
                SELECT * FROM kitchen_scans 
                WHERE flight_number = ? AND is_duplicate = 0
            ''', (flight_number,))
            scans = cursor.fetchall()
            
            cursor.execute('''
                SELECT * FROM loading_confirms 
                WHERE flight_number = ?
            ''', (flight_number,))
            confirms = cursor.fetchall()
            
            order_map = defaultdict(list)
            for order in orders:
                key = (order['meal_type'], order['temperature_type'] or 'ambient')
                order_map[key].append(order)
            
            scan_map = defaultdict(list)
            for scan in scans:
                key = (scan['meal_type'], scan['temperature_type'] or 'ambient')
                scan_map[key].append(scan)
            
            confirm_map = defaultdict(list)
            for confirm in confirms:
                key = (confirm['meal_type'], confirm['temperature_type'] or 'ambient')
                confirm_map[key].append(confirm)
            
            all_keys = set(order_map.keys()) | set(scan_map.keys()) | set(confirm_map.keys())
            
            for key in all_keys:
                meal_type, temp_type = key
                order_list = order_map.get(key, [])
                scan_list = scan_map.get(key, [])
                confirm_list = confirm_map.get(key, [])
                
                max_len = max(len(order_list), len(scan_list), len(confirm_list))
                
                for i in range(max_len):
                    order = order_list[i] if i < len(order_list) else None
                    scan = scan_list[i] if i < len(scan_list) else None
                    confirm = confirm_list[i] if i < len(confirm_list) else None
                    
                    match_status = 'partial'
                    if order and scan and confirm:
                        match_status = 'fully_matched'
                        results['matched'] += 1
                    elif order and scan:
                        match_status = 'scanned_not_loaded'
                    elif order:
                        match_status = 'ordered_only'
                        results['unmatched_orders'] += 1
                    
                    window_check = MealMatcher.check_temperature_window(
                        scan, confirm, temp_type
                    )
                    
                    match_record = {
                        'flight_id': flight_id,
                        'meal_type': meal_type,
                        'temperature_type': temp_type,
                        'order_id': order['order_id'] if order else None,
                        'order_seat': order['seat_number'] if order else None,
                        'is_special': order['is_special'] if order else 0,
                        'scan_id': scan['scan_id'] if scan else None,
                        'scan_time': scan['scan_time'] if scan else None,
                        'confirm_id': confirm['confirm_id'] if confirm else None,
                        'loading_time': confirm['loading_time'] if confirm else None,
                        'match_status': match_status,
                        'window_check': window_check['status']
                    }
                    
                    results['matches'].append(match_record)
                    
                    if window_check['status'] in ['risk_hot', 'risk_cold', 'expired']:
                        results['issues'].append({
                            'type': 'temperature_window',
                            'flight_number': flight_number,
                            'meal_type': meal_type,
                            'description': window_check['message'],
                            'severity': 'high' if window_check['status'] == 'expired' else 'medium',
                            'scan_id': scan['scan_id'] if scan else None
                        })
                    
                    cursor.execute('''
                        INSERT OR REPLACE INTO meal_matches 
                        (flight_id, meal_order_id, kitchen_scan_id, loading_confirm_id,
                         match_status, temperature_check, window_check)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        flight_id,
                        order['id'] if order else None,
                        scan['id'] if scan else None,
                        confirm['id'] if confirm else None,
                        match_status,
                        'ok',
                        window_check['status']
                    ))
                    conn.commit()
        
        return results
    
    @staticmethod
    def check_temperature_window(
        scan: Optional[sqlite3.Row],
        confirm: Optional[sqlite3.Row],
        temp_type: str
    ) -> Dict[str, Any]:
        result = {
            'status': 'unknown',
            'message': 'No timing data available',
            'minutes_since_scan': 0,
            'minutes_since_load': 0
        }
        
        if not scan:
            return result
        
        now = datetime.now()
        
        try:
            scan_time = datetime.fromisoformat(scan['scan_time'].replace('Z', '+00:00'))
            minutes_since_scan = int((now - scan_time).total_seconds() / 60)
            result['minutes_since_scan'] = minutes_since_scan
            
            if confirm:
                load_time = datetime.fromisoformat(confirm['loading_time'].replace('Z', '+00:00'))
                minutes_since_load = int((now - load_time).total_seconds() / 60)
                result['minutes_since_load'] = minutes_since_load
            
            if temp_type == 'hot':
                min_window = Config.WINDOW_HOT_MIN
                max_window = Config.WINDOW_HOT_MAX
                if minutes_since_scan < min_window:
                    result['status'] = 'ok'
                    result['message'] = f'热餐保温正常 ({minutes_since_scan}分钟)'
                elif minutes_since_scan <= max_window:
                    result['status'] = 'risk_hot'
                    result['message'] = f'热餐即将超出保温窗口 ({minutes_since_scan}分钟，限{max_window}分钟)'
                else:
                    result['status'] = 'expired'
                    result['message'] = f'热餐已超出保温窗口 ({minutes_since_scan}分钟，限{max_window}分钟)'
            
            elif temp_type == 'cold':
                min_window = Config.WINDOW_COLD_MIN
                max_window = Config.WINDOW_COLD_MAX
                if minutes_since_scan < min_window:
                    result['status'] = 'ok'
                    result['message'] = f'冷餐冷藏正常 ({minutes_since_scan}分钟)'
                elif minutes_since_scan <= max_window:
                    result['status'] = 'risk_cold'
                    result['message'] = f'冷餐即将超出冷藏窗口 ({minutes_since_scan}分钟，限{max_window}分钟)'
                else:
                    result['status'] = 'expired'
                    result['message'] = f'冷餐已超出冷藏窗口 ({minutes_since_scan}分钟，限{max_window}分钟)'
            else:
                result['status'] = 'ok'
                result['message'] = f'常温餐食 ({minutes_since_scan}分钟)'
        
        except Exception as e:
            result['message'] = f'Time parsing error: {str(e)}'
        
        return result


class CabinCapacityChecker:
    @staticmethod
    def check_aircraft_change(flight_number: str) -> Dict[str, Any]:
        results = {
            'flight_number': flight_number,
            'has_change': False,
            'original_config': [],
            'current_config': [],
            'capacity_issues': [],
            'summary': ''
        }
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT * FROM cabin_configs 
                WHERE flight_id IN (SELECT id FROM flights WHERE flight_number = ?)
                ORDER BY created_at
            ''', (flight_number,))
            configs = cursor.fetchall()
            
            if len(configs) < 2:
                results['summary'] = 'No aircraft change detected or insufficient configuration data'
                return results
            
            original_configs = [c for c in configs if c['is_original'] == 1]
            new_configs = [c for c in configs if c['is_original'] == 0]
            
            if original_configs and new_configs:
                results['has_change'] = True
                results['original_config'] = rows_to_dict_list(original_configs)
                results['current_config'] = rows_to_dict_list(new_configs)
                
                original_by_cabin = {}
                for c in original_configs:
                    original_by_cabin[c['cabin_class']] = c
                
                for new_config in new_configs:
                    cabin = new_config['cabin_class']
                    original = original_by_cabin.get(cabin)
                    
                    if original:
                        original_seats = original['seats_count']
                        original_capacity = original['meal_capacity'] or original_seats
                        
                        new_seats = new_config['seats_count']
                        new_capacity = new_config['meal_capacity'] or new_seats
                        
                        if new_seats != original_seats:
                            results['capacity_issues'].append({
                                'cabin_class': cabin,
                                'original_seats': original_seats,
                                'new_seats': new_seats,
                                'seat_diff': new_seats - original_seats,
                                'original_capacity': original_capacity,
                                'new_capacity': new_capacity,
                                'capacity_diff': new_capacity - original_capacity,
                                'issue': '座位数量变更' if new_seats < original_seats else '座位数量增加'
                            })
                        
                        if new_capacity < original_capacity:
                            results['capacity_issues'].append({
                                'cabin_class': cabin,
                                'original_capacity': original_capacity,
                                'new_capacity': new_capacity,
                                'capacity_diff': new_capacity - original_capacity,
                                'issue': '舱位容量不足，可能需要减少配餐'
                            })
                
                cursor.execute('''
                    SELECT cabin_class, COUNT(*) as order_count,
                           SUM(quantity) as total_meals
                    FROM meal_orders 
                    WHERE flight_number = ?
                    GROUP BY cabin_class
                ''', (flight_number,))
                orders_by_cabin = cursor.fetchall()
                
                for order_row in orders_by_cabin:
                    cabin = order_row['cabin_class']
                    order_count = order_row['order_count']
                    
                    current_config = next((c for c in new_configs if c['cabin_class'] == cabin), None)
                    if current_config:
                        capacity = current_config['meal_capacity'] or current_config['seats_count']
                        if order_count > capacity:
                            results['capacity_issues'].append({
                                'cabin_class': cabin,
                                'ordered_meals': order_count,
                                'current_capacity': capacity,
                                'issue': f'已订 {order_count} 份餐食，但当前机型容量仅 {capacity} 份'
                            })
                
                if results['capacity_issues']:
                    results['summary'] = f'检测到机型变更，存在 {len(results["capacity_issues"])} 个容量问题'
                else:
                    results['summary'] = '机型变更已确认，容量匹配正常'
        
        return results
    
    @staticmethod
    def add_cabin_config(
        flight_number: str,
        aircraft_registration: str,
        aircraft_type: str,
        cabin_configs: List[Dict[str, Any]],
        is_original: bool = False,
        change_reason: str = None
    ) -> Dict[str, Any]:
        results = {
            'success': True,
            'added': 0,
            'errors': []
        }
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            cursor.execute('SELECT * FROM flights WHERE flight_number = ?', (flight_number,))
            flight = cursor.fetchone()
            
            if not flight:
                cursor.execute('''
                    INSERT INTO flights (flight_number, aircraft_registration, aircraft_type)
                    VALUES (?, ?, ?)
                ''', (flight_number, aircraft_registration, aircraft_type))
                conn.commit()
                cursor.execute('SELECT * FROM flights WHERE flight_number = ?', (flight_number,))
                flight = cursor.fetchone()
            
            flight_id = flight['id']
            
            for config in cabin_configs:
                try:
                    cursor.execute('''
                        INSERT INTO cabin_configs 
                        (flight_id, aircraft_registration, aircraft_type, cabin_class,
                         seats_count, meal_capacity, galley_location, is_original, change_reason)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        flight_id,
                        aircraft_registration,
                        aircraft_type,
                        config.get('cabin_class'),
                        config.get('seats_count'),
                        config.get('meal_capacity'),
                        config.get('galley_location'),
                        1 if is_original else 0,
                        change_reason or (None if is_original else 'Aircraft Change')
                    ))
                    results['added'] += 1
                    conn.commit()
                except Exception as e:
                    results['errors'].append(f"Config error: {str(e)}")
        
        return results


class IssueManager:
    @staticmethod
    def create_issue(
        flight_number: str,
        issue_type: str,
        description: str,
        severity: str = 'medium',
        related_order_id: str = None,
        related_scan_id: str = None,
        related_confirm_id: str = None
    ) -> Dict[str, Any]:
        with get_db() as conn:
            cursor = conn.cursor()
            
            cursor.execute('SELECT id FROM flights WHERE flight_number = ?', (flight_number,))
            flight = cursor.fetchone()
            flight_id = flight['id'] if flight else None
            
            cursor.execute('''
                INSERT INTO issues 
                (flight_number, flight_id, issue_type, severity, description,
                 related_order_id, related_scan_id, related_confirm_id, is_resolved)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
            ''', (
                flight_number,
                flight_id,
                issue_type,
                severity,
                description,
                related_order_id,
                related_scan_id,
                related_confirm_id
            ))
            conn.commit()
            
            issue_id = cursor.lastrowid
            
            return {
                'success': True,
                'issue_id': issue_id
            }
    
    @staticmethod
    def add_note(
        flight_number: str,
        note_type: str,
        content: str,
        related_entity_type: str = None,
        related_entity_id: str = None,
        created_by: str = None
    ) -> Dict[str, Any]:
        with get_db() as conn:
            cursor = conn.cursor()
            
            cursor.execute('SELECT id FROM flights WHERE flight_number = ?', (flight_number,))
            flight = cursor.fetchone()
            flight_id = flight['id'] if flight else None
            
            now = datetime.now().isoformat()
            
            cursor.execute('''
                INSERT INTO notes 
                (flight_number, flight_id, note_type, related_entity_type,
                 related_entity_id, content, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                flight_number,
                flight_id,
                note_type,
                related_entity_type,
                related_entity_id,
                content,
                created_by or 'System',
                now,
                now
            ))
            conn.commit()
            
            return {
                'success': True,
                'note_id': cursor.lastrowid
            }
    
    @staticmethod
    def get_flight_issues(flight_number: str, include_resolved: bool = False) -> List[Dict[str, Any]]:
        with get_db() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            if include_resolved:
                cursor.execute('''
                    SELECT * FROM issues WHERE flight_number = ?
                    ORDER BY created_at DESC
                ''', (flight_number,))
            else:
                cursor.execute('''
                    SELECT * FROM issues WHERE flight_number = ? AND is_resolved = 0
                    ORDER BY created_at DESC
                ''', (flight_number,))
            
            return rows_to_dict_list(cursor.fetchall())
    
    @staticmethod
    def get_flight_notes(flight_number: str) -> List[Dict[str, Any]]:
        with get_db() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT * FROM notes WHERE flight_number = ?
                ORDER BY created_at DESC
            ''', (flight_number,))
            
            return rows_to_dict_list(cursor.fetchall())
    
    @staticmethod
    def resolve_issue(
        issue_id: int,
        resolution_note: str,
        resolved_by: str = None
    ) -> Dict[str, Any]:
        with get_db() as conn:
            cursor = conn.cursor()
            
            now = datetime.now().isoformat()
            
            cursor.execute('''
                UPDATE issues 
                SET is_resolved = 1, resolution_note = ?, resolved_by = ?, resolved_at = ?
                WHERE id = ?
            ''', (
                resolution_note,
                resolved_by or 'Operator',
                now,
                issue_id
            ))
            conn.commit()
            
            if cursor.rowcount > 0:
                return {'success': True, 'message': 'Issue resolved'}
            else:
                return {'success': False, 'message': 'Issue not found'}


class TimelineGenerator:
    @staticmethod
    def get_flight_timeline(flight_number: str) -> List[Dict[str, Any]]:
        timeline = []
        
        with get_db() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute('SELECT * FROM flights WHERE flight_number = ?', (flight_number,))
            flight = cursor.fetchone()
            
            if not flight:
                return timeline
            
            if flight['scheduled_departure_time']:
                timeline.append({
                    'type': 'scheduled_departure',
                    'time': flight['scheduled_departure_time'],
                    'title': '计划起飞时间',
                    'description': f'航班 {flight_number} 计划起飞'
                })
            
            cursor.execute('''
                SELECT scan_time as event_time, 'kitchen_scan' as type,
                       scan_id, meal_type, quantity, operator_id
                FROM kitchen_scans 
                WHERE flight_number = ? AND is_duplicate = 0
                ORDER BY scan_time
            ''', (flight_number,))
            
            for row in cursor.fetchall():
                timeline.append({
                    'type': 'kitchen_scan',
                    'time': row['event_time'],
                    'title': '厨房出库',
                    'description': f"{row['meal_type']} x{row['quantity']} - {row['scan_id']}",
                    'scan_id': row['scan_id'],
                    'meal_type': row['meal_type'],
                    'operator_id': row['operator_id']
                })
            
            cursor.execute('''
                SELECT loading_time as event_time, 'loading_confirm' as type,
                       confirm_id, meal_type, quantity, loader_id, galley_compartment
                FROM loading_confirms 
                WHERE flight_number = ?
                ORDER BY loading_time
            ''', (flight_number,))
            
            for row in cursor.fetchall():
                timeline.append({
                    'type': 'loading_confirm',
                    'time': row['event_time'],
                    'title': '机上装载确认',
                    'description': f"{row['meal_type']} x{row['quantity']} - 舱位: {row['galley_compartment'] or 'N/A'}",
                    'confirm_id': row['confirm_id'],
                    'meal_type': row['meal_type'],
                    'loader_id': row['loader_id']
                })
            
            cursor.execute('''
                SELECT created_at as event_time, 'cabin_change' as type,
                       aircraft_type, change_reason
                FROM cabin_configs 
                WHERE flight_id = ? AND is_original = 0
                ORDER BY created_at
            ''', (flight['id'],))
            
            for row in cursor.fetchall():
                timeline.append({
                    'type': 'aircraft_change',
                    'time': row['event_time'],
                    'title': '机型变更',
                    'description': f"更换机型为 {row['aircraft_type']} - 原因: {row['change_reason'] or 'N/A'}",
                    'aircraft_type': row['aircraft_type']
                })
            
            cursor.execute('''
                SELECT created_at as event_time, 'issue' as type,
                       issue_type, severity, description
                FROM issues 
                WHERE flight_number = ?
                ORDER BY created_at
            ''', (flight_number,))
            
            for row in cursor.fetchall():
                timeline.append({
                    'type': 'issue',
                    'time': row['event_time'],
                    'title': f"问题发现 - {row['severity']}",
                    'description': f"{row['issue_type']}: {row['description']}",
                    'severity': row['severity']
                })
            
            cursor.execute('''
                SELECT created_at as event_time, 'note' as type,
                       note_type, content, created_by
                FROM notes 
                WHERE flight_number = ?
                ORDER BY created_at
            ''', (flight_number,))
            
            for row in cursor.fetchall():
                timeline.append({
                    'type': 'note',
                    'time': row['event_time'],
                    'title': f"人工备注 - {row['note_type']}",
                    'description': row['content'],
                    'created_by': row['created_by']
                })
            
            timeline.sort(key=lambda x: x['time'])
        
        return timeline
