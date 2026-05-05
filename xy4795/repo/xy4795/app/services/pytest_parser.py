import defusedxml.ElementTree as ET
from datetime import datetime
from app.models import TestReport, TestCase
from app import db
import re


def parse_pytest_xml(xml_content, report_name=None, module=None, owner=None):
    root = ET.fromstring(xml_content)
    
    test_report = TestReport()
    test_report.report_name = report_name or 'pytest-report'
    test_report.module = module
    test_report.owner = owner
    
    if root.tag == 'testsuite':
        test_report = parse_testsuite_element(root, test_report)
    elif root.tag == 'testsuites':
        test_report = parse_testsuites_element(root, test_report)
    
    return test_report


def parse_testsuite_element(testsuite, test_report):
    test_report.test_suite = testsuite.get('name')
    test_report.total_tests = int(testsuite.get('tests', 0))
    test_report.passed = int(testsuite.get('passed', 0))
    test_report.failed = int(testsuite.get('failures', 0)) + int(testsuite.get('failed', 0))
    test_report.errors = int(testsuite.get('errors', 0))
    test_report.skipped = int(testsuite.get('skipped', 0))
    test_report.duration = float(testsuite.get('time', 0))
    
    timestamp_str = testsuite.get('timestamp')
    if timestamp_str:
        try:
            test_report.timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            pass
    
    test_cases = []
    for testcase in testsuite.findall('testcase'):
        tc = parse_testcase_element(testcase, test_report)
        test_cases.append(tc)
    
    if test_report.total_tests == 0:
        test_report.total_tests = len(test_cases)
    
    if test_report.passed == 0 and test_report.failed == 0 and test_report.errors == 0:
        passed = sum(1 for tc in test_cases if tc.status == 'passed')
        failed = sum(1 for tc in test_cases if tc.status == 'failed')
        errors = sum(1 for tc in test_cases if tc.status == 'error')
        skipped = sum(1 for tc in test_cases if tc.status == 'skipped')
        
        test_report.passed = passed
        test_report.failed = failed
        test_report.errors = errors
        test_report.skipped = skipped
    
    test_report.test_cases = test_cases
    return test_report


def parse_testsuites_element(testsuites, test_report):
    all_test_cases = []
    total_tests = 0
    total_passed = 0
    total_failed = 0
    total_errors = 0
    total_skipped = 0
    total_duration = 0.0
    
    first_suite = None
    
    for testsuite in testsuites.findall('testsuite'):
        if first_suite is None:
            first_suite = testsuite
            test_report.test_suite = testsuite.get('name')
            
            timestamp_str = testsuite.get('timestamp')
            if timestamp_str:
                try:
                    test_report.timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                except (ValueError, AttributeError):
                    pass
        
        total_tests += int(testsuite.get('tests', 0))
        total_failed += int(testsuite.get('failures', 0)) + int(testsuite.get('failed', 0))
        total_errors += int(testsuite.get('errors', 0))
        total_skipped += int(testsuite.get('skipped', 0))
        total_duration += float(testsuite.get('time', 0))
        
        for testcase in testsuite.findall('testcase'):
            tc = parse_testcase_element(testcase, test_report)
            all_test_cases.append(tc)
            if tc.status == 'passed':
                total_passed += 1
    
    test_report.total_tests = total_tests
    test_report.passed = total_passed
    test_report.failed = total_failed
    test_report.errors = total_errors
    test_report.skipped = total_skipped
    test_report.duration = total_duration
    
    test_report.test_cases = all_test_cases
    return test_report


def parse_testcase_element(testcase, test_report):
    tc = TestCase()
    tc.classname = testcase.get('classname')
    tc.name = testcase.get('name')
    tc.duration = float(testcase.get('time', 0))
    
    full_name_parts = []
    if tc.classname:
        full_name_parts.append(tc.classname)
    if tc.name:
        full_name_parts.append(tc.name)
    tc.full_name = '.'.join(full_name_parts) if full_name_parts else tc.name
    
    if tc.classname:
        module_match = re.match(r'^([^.]+)', tc.classname)
        if module_match:
            tc.module = module_match.group(1)
    
    tc.module = tc.module or test_report.module
    tc.owner = test_report.owner
    
    tc.status = 'passed'
    tc.error_type = None
    tc.error_message = None
    tc.error_traceback = None
    tc.stdout = None
    tc.stderr = None
    
    failure = testcase.find('failure')
    if failure is not None:
        tc.status = 'failed'
        tc.error_type = failure.get('type')
        tc.error_message = failure.get('message')
        tc.error_traceback = failure.text
    
    error = testcase.find('error')
    if error is not None:
        tc.status = 'error'
        tc.error_type = error.get('type')
        tc.error_message = error.get('message')
        tc.error_traceback = error.text
    
    skipped = testcase.find('skipped')
    if skipped is not None:
        tc.status = 'skipped'
        tc.message = skipped.get('message')
    
    system_out = testcase.find('system-out')
    if system_out is not None and system_out.text:
        tc.stdout = system_out.text
    
    system_err = testcase.find('system-err')
    if system_err is not None and system_err.text:
        tc.stderr = system_err.text
    
    return tc


def import_pytest_report(xml_content, report_name=None, module=None, owner=None):
    test_report = parse_pytest_xml(xml_content, report_name, module, owner)
    db.session.add(test_report)
    db.session.commit()
    return test_report
