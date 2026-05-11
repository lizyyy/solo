import os
import tempfile
import sys
import csv
import json

temp_dir = tempfile.mkdtemp()
os.environ['ORTHO_QUEUE_CONFIG'] = temp_dir
print(f'Test config dir: {temp_dir}')

from ortho_queue.database import get_session, Appointment
from ortho_queue.services import create_appointment
from ortho_queue.cli import parse_bool
from datetime import datetime as dt

def test_csv_import_logic():
    print('\n=== Test: CSV import with boolean parsing ===')
    session = get_session()
    
    csv_content = """patient_id,patient_name,doctor,date,stage,interval,phone,emergency,emergency_reason
C001,CSV测试1,李医生,2026-05-20,常规复诊,28,13800000001,false,
C002,CSV测试2,王医生,2026-05-20,常规复诊,28,13800000002,TRUE,托槽脱落
C003,CSV测试3,李医生,2026-05-21,常规复诊,28,13800000003,True,弓丝断裂
C004,CSV测试4,王医生,2026-05-21,常规复诊,28,13800000004,0,
C005,CSV测试5,李医生,2026-05-22,常规复诊,28,13800000005,1,疼痛难忍
"""
    
    csv_file = os.path.join(temp_dir, 'test_import.csv')
    with open(csv_file, 'w', encoding='utf-8') as f:
        f.write(csv_content)
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        appointments_data = list(reader)
    
    print(f'  Loaded {len(appointments_data)} records from CSV')
    
    success_count = 0
    for idx, item in enumerate(appointments_data, 1):
        try:
            appt_date = dt.strptime(item['date'], '%Y-%m-%d').date()
            
            patient_kwargs = {}
            if 'stage' in item:
                patient_kwargs['current_stage'] = item['stage']
            if 'interval' in item:
                patient_kwargs['review_interval_days'] = int(item['interval'])
            if 'phone' in item:
                patient_kwargs['phone'] = item['phone']
            
            emergency_value = item.get('emergency', False)
            is_emergency = parse_bool(emergency_value)
            
            appt, conflicts, is_duplicate = create_appointment(
                session,
                item['patient_id'],
                item['patient_name'],
                item['doctor'],
                appt_date,
                is_emergency=is_emergency,
                emergency_reason=item.get('emergency_reason'),
                notes=item.get('notes'),
                **patient_kwargs
            )
            
            if appt:
                success_count += 1
                status = '🚨 EMG' if appt.is_emergency else '常规'
                print(f'  [{idx}] {status}: {appt.appointment_code}')
        
        except Exception as e:
            print(f'  [{idx}] ❌ Error: {str(e)}')
            session.close()
            return False
    
    session.close()
    
    passed = success_count == len(appointments_data)
    print(f'  Test PASSED: {passed} ({success_count}/{len(appointments_data)})')
    return passed

if __name__ == '__main__':
    passed = test_csv_import_logic()
    print('\n' + '=' * 50)
    print(f'CSV IMPORT TEST PASSED: {passed}')
    sys.exit(0 if passed else 1)
