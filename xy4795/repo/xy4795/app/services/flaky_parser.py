import re
from datetime import datetime
from app.models import FlakyRun
from app import db
from collections import defaultdict


def parse_flaky_log(log_content, ci_run_id=None, module=None, owner=None):
    flaky_runs = []
    
    lines = log_content.strip().split('\n')
    
    test_results = defaultdict(lambda: {
        'run_count': 0,
        'pass_count': 0,
        'fail_count': 0,
        'attempts': [],
        'error_messages': [],
        'first_status': None,
        'last_status': None,
        'retry_count': 0,
        'max_retry': 0,
    })
    
    current_test = None
    current_error = []
    
    for line in lines:
        line = line.rstrip()
        
        test_match = re.match(r'^(PASSED|FAILED|ERROR|SKIPPED|RERUN)\s+(.+?)(?:\s+\[.*\])?$', line)
        if test_match:
            status = test_match.group(1)
            test_name = test_match.group(2)
            
            if current_test and current_error:
                test_results[current_test]['error_messages'].append('\n'.join(current_error))
                current_error = []
            
            current_test = test_name
            test_results[current_test]['run_count'] += 1
            
            if test_results[current_test]['first_status'] is None:
                test_results[current_test]['first_status'] = status
            
            test_results[current_test]['last_status'] = status
            
            if status == 'PASSED':
                test_results[current_test]['pass_count'] += 1
            elif status in ('FAILED', 'ERROR'):
                test_results[current_test]['fail_count'] += 1
            elif status == 'RERUN':
                test_results[current_test]['retry_count'] += 1
            
            test_results[current_test]['attempts'].append(status)
            continue
        
        rerun_match = re.match(r'^RERUN\s+(.+?)\s+\((\d+)/(\d+)\)$', line)
        if rerun_match:
            test_name = rerun_match.group(1)
            current_retry = int(rerun_match.group(2))
            max_retry = int(rerun_match.group(3))
            
            if current_test and current_error:
                test_results[current_test]['error_messages'].append('\n'.join(current_error))
                current_error = []
            
            current_test = test_name
            test_results[current_test]['run_count'] += 1
            test_results[current_test]['retry_count'] = max(test_results[current_test]['retry_count'], current_retry)
            test_results[current_test]['max_retry'] = max(test_results[current_test]['max_retry'], max_retry)
            test_results[current_test]['first_status'] = test_results[current_test]['first_status'] or 'RERUN'
            test_results[current_test]['last_status'] = 'RERUN'
            test_results[current_test]['fail_count'] += 1
            continue
        
        passed_rerun_match = re.match(r'^PASSED\s+(.+?)\s+\((\d+)/(\d+)\)$', line)
        if passed_rerun_match:
            test_name = passed_rerun_match.group(1)
            current_retry = int(passed_rerun_match.group(2))
            max_retry = int(passed_rerun_match.group(3))
            
            if current_test and current_error:
                test_results[current_test]['error_messages'].append('\n'.join(current_error))
                current_error = []
            
            current_test = test_name
            test_results[current_test]['run_count'] += 1
            test_results[current_test]['pass_count'] += 1
            test_results[current_test]['last_status'] = 'PASSED'
            test_results[current_test]['max_retry'] = max(test_results[current_test]['max_retry'], max_retry)
            continue
        
        flaky_match = re.match(r'^.*?test.*?(.+?)\s+(passed|failed|reran) on attempt (\d+).*$', line, re.IGNORECASE)
        if flaky_match:
            test_name = flaky_match.group(1)
            status = flaky_match.group(2).upper()
            attempt = int(flaky_match.group(3))
            
            if current_test and current_error:
                test_results[current_test]['error_messages'].append('\n'.join(current_error))
                current_error = []
            
            current_test = test_name
            test_results[current_test]['run_count'] += 1
            
            if status == 'PASSED':
                test_results[current_test]['pass_count'] += 1
            elif status in ('FAILED', 'ERROR'):
                test_results[current_test]['fail_count'] += 1
            elif status == 'RERAN':
                test_results[current_test]['retry_count'] += 1
            
            if test_results[current_test]['first_status'] is None:
                test_results[current_test]['first_status'] = status
            test_results[current_test]['last_status'] = status
            
            continue
        
        if current_test and (line.startswith(' ') or line.startswith('E') or line.startswith('F') or line.startswith('Traceback')):
            current_error.append(line)
            continue
    
    if current_test and current_error:
        test_results[current_test]['error_messages'].append('\n'.join(current_error))
    
    for test_name, data in test_results.items():
        if data['fail_count'] > 0 and data['pass_count'] > 0:
            fr = FlakyRun()
            fr.test_name = test_name
            fr.full_name = test_name
            fr.module = module
            fr.owner = owner
            fr.run_count = data['run_count']
            fr.pass_count = data['pass_count']
            fr.fail_count = data['fail_count']
            fr.first_attempt_status = data['first_status']
            fr.last_attempt_status = data['last_status']
            fr.retry_count = data['retry_count']
            fr.max_retry_count = data['max_retry']
            fr.ci_run_id = ci_run_id
            
            if data['run_count'] > 0:
                fr.flaky_rate = (data['fail_count'] / data['run_count']) * 100
            
            if data['error_messages']:
                fr.set_error_messages(data['error_messages'])
            
            flaky_runs.append(fr)
    
    return flaky_runs


def import_flaky_logs(log_content, ci_run_id=None, module=None, owner=None):
    flaky_runs = parse_flaky_log(log_content, ci_run_id, module, owner)
    
    imported = []
    for fr in flaky_runs:
        existing = FlakyRun.query.filter_by(
            test_name=fr.test_name,
            ci_run_id=ci_run_id
        ).first()
        
        if existing:
            existing.run_count = fr.run_count
            existing.pass_count = fr.pass_count
            existing.fail_count = fr.fail_count
            existing.flaky_rate = fr.flaky_rate
            existing.last_attempt_status = fr.last_attempt_status
            existing.retry_count = max(existing.retry_count, fr.retry_count)
            existing.updated_at = datetime.utcnow()
        else:
            db.session.add(fr)
            imported.append(fr)
    
    db.session.commit()
    return flaky_runs
