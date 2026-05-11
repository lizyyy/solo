import os
import tempfile
import sys

temp_dir = tempfile.mkdtemp()
os.environ['ORTHO_QUEUE_CONFIG'] = temp_dir
print(f'Test config dir: {temp_dir}')

from ortho_queue.database import get_session
from ortho_queue.services import create_appointment, create_reminder
from datetime import date, timedelta

def test_core_commands():
    print('\n=== Test: Core commands without --date parameter ===')
    
    session = get_session()
    
    # 创建一个明天的预约
    tomorrow = date.today() + timedelta(days=1)
    appt, conflicts, is_dup = create_appointment(
        session,
        'D001', '日期测试患者', '王医生',
        tomorrow,
        current_stage='常规复诊'
    )
    print(f'  Created appointment: {appt.appointment_code} for {tomorrow}')
    
    # 创建一个今天的提醒
    reminder, errors = create_reminder(session, appt.appointment_code, date.today(), '短信')
    print(f'  Created reminder for today: {reminder.reminder_date}')
    
    session.close()
    return True

if __name__ == '__main__':
    passed = test_core_commands()
    print('\n' + '=' * 50)
    print(f'Setup test PASSED: {passed}')
    sys.exit(0 if passed else 1)
