import csv
import json
import yaml
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
import sqlite3

from backend.config import Config
from backend.database import get_db, init_db


class DataImporter:
    @staticmethod
    def import_flight_orders_csv(file_path: str, flight_number: Optional[str] = None) -> Dict[str, Any]:
        results = {
            'success': True,
            'imported': 0,
            'skipped': 0,
            'errors': [],
            'flight_info': {},
            'flight_numbers': set()
        }
        
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                with get_db() as conn:
                    cursor = conn.cursor()
                    
                    flight_cache = {}
                    last_flight_number = None
                    
                    for row in reader:
                        try:
                            row_flight = flight_number
                            if not row_flight and row.get('flight_number'):
                                row_flight = row['flight_number'].strip()
                            
                            if not row_flight:
                                continue
                            
                            if row_flight != last_flight_number:
                                last_flight_number = row_flight
                                results['flight_numbers'].add(row_flight)
                            
                            if row_flight not in flight_cache:
                                cursor.execute('''
                                    INSERT OR IGNORE INTO flights 
                                    (flight_number, aircraft_registration, aircraft_type, 
                                     departure_airport, arrival_airport, scheduled_departure_time)
                                    VALUES (?, ?, ?, ?, ?, ?)
                                ''', (
                                    row_flight,
                                    row.get('aircraft_registration'),
                                    row.get('aircraft_type'),
                                    row.get('departure_airport'),
                                    row.get('arrival_airport'),
                                    row.get('scheduled_departure_time')
                                ))
                                conn.commit()
                                
                                cursor.execute('SELECT * FROM flights WHERE flight_number = ?', (row_flight,))
                                flight_record = cursor.fetchone()
                                flight_cache[row_flight] = flight_record
                            else:
                                flight_record = flight_cache[row_flight]
                            
                            if flight_record:
                                order_id = row.get('order_id') or f"ORD_{row_flight}_{row.get('seat_number', 'UNKNOWN')}"
                                
                                is_special = 1 if (row.get('special_meal_code') or row.get('is_special', '').lower() in ['true', '1', 'yes']) else 0
                                
                                meal_category = row.get('meal_category') or 'regular'
                                if is_special and not row.get('meal_category'):
                                    meal_category = 'special'
                                
                                cursor.execute('''
                                    INSERT OR IGNORE INTO meal_orders 
                                    (flight_id, flight_number, order_id, cabin_class, seat_number,
                                     meal_type, meal_category, special_meal_code, 
                                     special_meal_description, is_special, quantity, temperature_type, status)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                ''', (
                                    flight_record['id'],
                                    row_flight,
                                    order_id,
                                    row.get('cabin_class'),
                                    row.get('seat_number'),
                                    row.get('meal_type'),
                                    meal_category,
                                    row.get('special_meal_code'),
                                    row.get('special_meal_description'),
                                    is_special,
                                    int(row.get('quantity', 1)),
                                    row.get('temperature_type') or 'ambient',
                                    'ordered'
                                ))
                                results['imported'] += 1
                                conn.commit()
                                
                        except sqlite3.IntegrityError:
                            results['skipped'] += 1
                        except Exception as e:
                            results['errors'].append(f"Row error: {str(e)}")
                    
                    if flight_cache:
                        first_flight = next(iter(flight_cache.values()))
                        if first_flight:
                            results['flight_info'] = {
                                'id': first_flight['id'],
                                'flight_number': first_flight['flight_number'],
                                'aircraft_type': first_flight['aircraft_type']
                            }
                    
                    results['flight_numbers'] = list(results['flight_numbers'])
                        
        except Exception as e:
            results['success'] = False
            results['errors'].append(f"File error: {str(e)}")
        
        return results
    
    @staticmethod
    def import_seat_rules_yaml(file_path: str) -> Dict[str, Any]:
        results = {
            'success': True,
            'imported': 0,
            'skipped': 0,
            'errors': []
        }
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
            
            rules = data.get('seat_rules', []) if isinstance(data, dict) else data
            
            if not isinstance(rules, list):
                rules = [rules]
            
            with get_db() as conn:
                cursor = conn.cursor()
                
                for rule in rules:
                    if not isinstance(rule, dict):
                        continue
                    
                    try:
                        cursor.execute('''
                            INSERT INTO seat_rules 
                            (rule_name, aircraft_type, cabin_class, 
                             seat_range_start, seat_range_end, special_meal_allowed,
                             priority_meal, meal_type_restriction, description)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            rule.get('rule_name', 'Unnamed Rule'),
                            rule.get('aircraft_type'),
                            rule.get('cabin_class'),
                            rule.get('seat_range_start'),
                            rule.get('seat_range_end'),
                            rule.get('special_meal_allowed'),
                            1 if rule.get('priority_meal') else 0,
                            rule.get('meal_type_restriction'),
                            rule.get('description')
                        ))
                        results['imported'] += 1
                        conn.commit()
                    except sqlite3.IntegrityError:
                        results['skipped'] += 1
                    except Exception as e:
                        results['errors'].append(f"Rule error: {str(e)}")
                        
        except Exception as e:
            results['success'] = False
            results['errors'].append(f"File error: {str(e)}")
        
        return results
    
    @staticmethod
    def import_kitchen_scans_jsonl(file_path: str) -> Dict[str, Any]:
        results = {
            'success': True,
            'imported': 0,
            'skipped': 0,
            'duplicates': 0,
            'errors': [],
            'flight_numbers': set()
        }
        
        try:
            scan_ids_seen = set()
            meal_flight_map = {}
            
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            for line_num, line in enumerate(lines, 1):
                line = line.strip()
                if not line:
                    continue
                
                try:
                    record = json.loads(line)
                    
                    scan_id = record.get('scan_id') or f"SCAN_{record.get('meal_id', 'UNKNOWN')}_{line_num}"
                    flight_number = record.get('flight_number')
                    
                    if flight_number:
                        results['flight_numbers'].add(flight_number)
                    
                    is_duplicate = 0
                    original_scan_id = None
                    
                    meal_key = (record.get('meal_id'), record.get('quantity'), record.get('scan_time'))
                    if meal_key in meal_flight_map:
                        is_duplicate = 1
                        original_scan_id = meal_flight_map[meal_key]
                        results['duplicates'] += 1
                    else:
                        meal_flight_map[meal_key] = scan_id
                    
                    with get_db() as conn:
                        cursor = conn.cursor()
                        
                        cursor.execute('''
                            INSERT OR IGNORE INTO kitchen_scans 
                            (scan_id, flight_number, meal_id, meal_type, 
                             temperature_type, quantity, scan_time, operator_id,
                             galley_id, container_id, is_duplicate, original_scan_id)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            scan_id,
                            flight_number,
                            record.get('meal_id'),
                            record.get('meal_type'),
                            record.get('temperature_type') or 'ambient',
                            int(record.get('quantity', 1)),
                            record.get('scan_time') or datetime.now().isoformat(),
                            record.get('operator_id'),
                            record.get('galley_id'),
                            record.get('container_id'),
                            is_duplicate,
                            original_scan_id
                        ))
                        results['imported'] += 1
                        conn.commit()
                        
                except json.JSONDecodeError as e:
                    results['errors'].append(f"Line {line_num}: Invalid JSON - {str(e)}")
                except sqlite3.IntegrityError:
                    results['skipped'] += 1
                except Exception as e:
                    results['errors'].append(f"Line {line_num}: {str(e)}")
            
            results['flight_numbers'] = list(results['flight_numbers'])
                        
        except Exception as e:
            results['success'] = False
            results['errors'].append(f"File error: {str(e)}")
        
        return results
    
    @staticmethod
    def import_loading_confirms_json(file_path: str) -> Dict[str, Any]:
        results = {
            'success': True,
            'imported': 0,
            'skipped': 0,
            'errors': [],
            'flight_numbers': set()
        }
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            confirms = data.get('loading_confirms', []) if isinstance(data, dict) else data
            
            if not isinstance(confirms, list):
                confirms = [confirms]
            
            with get_db() as conn:
                cursor = conn.cursor()
                
                for confirm in confirms:
                    if not isinstance(confirm, dict):
                        continue
                    
                    try:
                        confirm_id = confirm.get('confirm_id') or f"LOAD_{confirm.get('meal_id', 'UNKNOWN')}_{datetime.now().strftime('%H%M%S')}"
                        flight_number = confirm.get('flight_number')
                        
                        if flight_number:
                            results['flight_numbers'].add(flight_number)
                        
                        cursor.execute('''
                            INSERT OR IGNORE INTO loading_confirms 
                            (confirm_id, flight_number, meal_id, meal_type,
                             temperature_type, quantity, loading_time, loader_id,
                             aircraft_position, container_id, galley_compartment)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            confirm_id,
                            flight_number,
                            confirm.get('meal_id'),
                            confirm.get('meal_type'),
                            confirm.get('temperature_type') or 'ambient',
                            int(confirm.get('quantity', 1)),
                            confirm.get('loading_time') or datetime.now().isoformat(),
                            confirm.get('loader_id'),
                            confirm.get('aircraft_position'),
                            confirm.get('container_id'),
                            confirm.get('galley_compartment')
                        ))
                        results['imported'] += 1
                        conn.commit()
                        
                    except sqlite3.IntegrityError:
                        results['skipped'] += 1
                    except Exception as e:
                        results['errors'].append(f"Confirm error: {str(e)}")
            
            results['flight_numbers'] = list(results['flight_numbers'])
                        
        except Exception as e:
            results['success'] = False
            results['errors'].append(f"File error: {str(e)}")
        
        return results
    
    @staticmethod
    def import_all_samples() -> Dict[str, Any]:
        results = {
            'flight_orders': None,
            'seat_rules': None,
            'kitchen_scans': None,
            'loading_confirms': None,
            'overall_success': True
        }
        
        samples_dir = Config.SAMPLES_DIR
        
        flight_orders_csv = os.path.join(samples_dir, 'flight_orders.csv')
        if os.path.exists(flight_orders_csv):
            results['flight_orders'] = DataImporter.import_flight_orders_csv(flight_orders_csv)
            if not results['flight_orders']['success']:
                results['overall_success'] = False
        
        seat_rules_yaml = os.path.join(samples_dir, 'seat_rules.yaml')
        if os.path.exists(seat_rules_yaml):
            results['seat_rules'] = DataImporter.import_seat_rules_yaml(seat_rules_yaml)
            if not results['seat_rules']['success']:
                results['overall_success'] = False
        
        kitchen_scans_jsonl = os.path.join(samples_dir, 'kitchen_scans.jsonl')
        if os.path.exists(kitchen_scans_jsonl):
            results['kitchen_scans'] = DataImporter.import_kitchen_scans_jsonl(kitchen_scans_jsonl)
            if not results['kitchen_scans']['success']:
                results['overall_success'] = False
        
        loading_confirms_json = os.path.join(samples_dir, 'loading_confirms.json')
        if os.path.exists(loading_confirms_json):
            results['loading_confirms'] = DataImporter.import_loading_confirms_json(loading_confirms_json)
            if not results['loading_confirms']['success']:
                results['overall_success'] = False
        
        return results
