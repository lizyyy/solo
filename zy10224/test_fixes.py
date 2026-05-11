import os
import tempfile
import sys

temp_dir = tempfile.mkdtemp()
os.environ['ORTHO_QUEUE_CONFIG'] = temp_dir
print(f'Test config dir: {temp_dir}')

from ortho_queue.database import get_session, Appointment, Reminder
from ortho_queue.services import create_appointment, cancel_appointment, create_reminder, get_reminder_list
from ortho_queue.cli import parse_bool
from datetime import date, timedelta

def test_cancel_reminder_withdrawal():
    print('\n=== Test 1: Cancel reminder withdrawal ===')
    session = get_session()
    
    appt, conflicts, is_dup = create_appointment(
        session,
        'T001', '测试患者', '张医生',
        date.today() + timedelta(days=1),
        current_stage='常规复诊'
    )
    print(f'  Appointment created: {appt.appointment_code}')
    
    reminder, errors = create_reminder(session, appt.appointment_code, date.today(), '短信')
    print(f'  Reminder created: is_sent={reminder.is_sent}, is_withdrawn={reminder.is_withdrawn}')
    
    reminders_before = get_reminder_list(session, date.today(), include_withdrawn=False)
    print(f'  Reminders before cancel (include_withdrawn=False): {len(reminders_before)}')
    
    canceled_appt, errors = cancel_appointment(session, appt.appointment_code, '测试取消')
    print(f'  Appointment canceled: status={canceled_appt.status}')
    
    session.refresh(reminder)
    print(f'  Reminder after cancel: is_sent={reminder.is_sent}, is_withdrawn={reminder.is_withdrawn}')
    
    reminders_after = get_reminder_list(session, date.today(), include_withdrawn=False)
    print(f'  Reminders after cancel (include_withdrawn=False): {len(reminders_after)}')
    
    session.close()
    
    passed = len(reminders_after) == 0 and reminder.is_withdrawn == True
    print(f'  Test 1 PASSED: {passed}')
    return passed

def test_csv_boolean_parsing():
    print('\n=== Test 2: CSV boolean parsing ===')
    
    test_cases = [
        (True, True),
        (False, False),
        ('true', True),
        ('True', True),
        ('TRUE', True),
        ('false', False),
        ('False', False),
        ('FALSE', False),
        ('1', True),
        ('0', False),
        ('yes', True),
        ('no', False),
        ('', False),
    ]
    
    all_passed = True
    for value, expected in test_cases:
        result = parse_bool(value)
        status = '✓' if result == expected else '✗'
        if result != expected:
            all_passed = False
        print(f'  {status} parse_bool({repr(value)}) = {result} (expected {expected})')
    
    print(f'  Test 2 PASSED: {all_passed}')
    return all_passed

if __name__ == '__main__':
    test1_passed = test_cancel_reminder_withdrawal()
    test2_passed = test_csv_boolean_parsing()
    
    print('\n' + '=' * 50)
    all_passed = test1_passed and test2_passed
    print(f'ALL TESTS PASSED: {all_passed}')
    sys.exit(0 if all_passed else 1)
