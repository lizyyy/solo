import csv
import json
import yaml
from collections import defaultdict

def load_prescription(csv_path):
    prescriptions = {}
    with open(csv_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            order_id = row['order_id']
            prescriptions[order_id] = {
                'patient_name': row['patient_name'],
                'right_sph': float(row['right_sph']) if row.get('right_sph') and row['right_sph'] != '' else None,
                'right_cyl': float(row['right_cyl']) if row.get('right_cyl') and row['right_cyl'] != '' else None,
                'right_axis': int(row['right_axis']) if row.get('right_axis') and row['right_axis'] != '' else None,
                'left_sph': float(row['left_sph']) if row.get('left_sph') and row['left_sph'] != '' else None,
                'left_cyl': float(row['left_cyl']) if row.get('left_cyl') and row['left_cyl'] != '' else None,
                'left_axis': int(row['left_axis']) if row.get('left_axis') and row['left_axis'] != '' else None,
                'pupil_distance': float(row['pupil_distance']) if row.get('pupil_distance') and row['pupil_distance'] != '' else None,
                'right_add': float(row['right_add']) if row.get('right_add') and row['right_add'] != '' else None,
                'left_add': float(row['left_add']) if row.get('left_add') and row['left_add'] != '' else None,
            }
    return prescriptions

def load_frame(json_path):
    frames = {}
    with open(json_path, encoding='utf-8') as f:
        data = json.load(f)
        for item in data:
            frames[item['order_id']] = item
    return frames

def load_scan(jsonl_path):
    scans = {}
    duplicates = defaultdict(list)
    with open(jsonl_path, encoding='utf-8') as f:
        for line in f:
            if line.strip():
                record = json.loads(line)
                order_id = record['order_id']
                if order_id in scans:
                    duplicates[order_id].append(scans[order_id]['scan_time'])
                scans[order_id] = {
                    'scan_time': record.get('scan_time'),
                    'right_sph': record.get('right_sph'),
                    'right_cyl': record.get('right_cyl'),
                    'right_axis': record.get('right_axis'),
                    'left_sph': record.get('left_sph'),
                    'left_cyl': record.get('left_cyl'),
                    'left_axis': record.get('left_axis'),
                    'pupil_distance': record.get('pupil_distance'),
                    'inspection_passed': record.get('inspection_passed', False),
                    'final_inspection': record.get('final_inspection', False),
                }
    return scans, dict(duplicates)

def load_tolerance(yaml_path):
    with open(yaml_path, encoding='utf-8') as f:
        return yaml.safe_load(f)

def merge_order_data(prescriptions, frames, scans, tolerance):
    orders = {}
    all_order_ids = set(prescriptions.keys()) | set(frames.keys()) | set(scans.keys())
    for oid in all_order_ids:
        orders[oid] = {
            'order_id': oid,
            'prescription': prescriptions.get(oid, {}),
            'frame': frames.get(oid, {}),
            'scan': scans.get(oid, {}),
            'tolerance': tolerance,
        }
    return orders