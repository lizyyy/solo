from app.models import TestReport, TestCase, CoverageReport, CoverageFile, FlakyRun, Quarantine
from app import db
from collections import defaultdict
from datetime import datetime, timedelta


def calculate_failure_rate(module=None, owner=None, days=None):
    query = TestCase.query
    
    if module:
        query = query.filter(TestCase.module == module)
    if owner:
        query = query.filter(TestCase.owner == owner)
    if days:
        cutoff = datetime.utcnow() - timedelta(days=days)
        query = query.filter(TestCase.timestamp >= cutoff)
    
    test_cases = query.all()
    
    total = len(test_cases)
    failed = sum(1 for tc in test_cases if tc.status in ('failed', 'error'))
    skipped = sum(1 for tc in test_cases if tc.status == 'skipped')
    
    if total == 0:
        return {
            'total_tests': 0,
            'failed': 0,
            'passed': 0,
            'skipped': 0,
            'failure_rate': 0.0,
            'pass_rate': 0.0
        }
    
    passed = total - failed - skipped
    failure_rate = (failed / total) * 100
    pass_rate = (passed / total) * 100
    
    return {
        'total_tests': total,
        'failed': failed,
        'passed': passed,
        'skipped': skipped,
        'failure_rate': round(failure_rate, 2),
        'pass_rate': round(pass_rate, 2)
    }


def calculate_coverage_gap(target_coverage=80.0, module=None, owner=None):
    query = CoverageReport.query
    
    if module:
        query = query.filter(CoverageReport.module == module)
    if owner:
        query = query.filter(CoverageReport.owner == owner)
    
    latest_report = query.order_by(CoverageReport.timestamp.desc()).first()
    
    if not latest_report:
        return {
            'target_coverage': target_coverage,
            'current_coverage': 0.0,
            'coverage_gap': target_coverage,
            'total_lines': 0,
            'covered_lines': 0,
            'missed_lines': 0,
            'lines_needed': 0,
            'files_below_target': []
        }
    
    current_coverage = latest_report.line_coverage
    coverage_gap = max(0, target_coverage - current_coverage)
    
    total_lines = latest_report.total_lines
    covered_lines = latest_report.covered_lines
    missed_lines = latest_report.missed_lines
    
    lines_needed = 0
    if coverage_gap > 0 and total_lines > 0:
        lines_needed = int((coverage_gap / 100) * total_lines)
    
    files_below_target = []
    files_query = CoverageFile.query.filter_by(coverage_report_id=latest_report.id)
    if module:
        files_query = files_query.filter(CoverageFile.module == module)
    if owner:
        files_query = files_query.filter(CoverageFile.owner == owner)
    
    for cf in files_query.all():
        if cf.line_coverage < target_coverage:
            files_below_target.append({
                'file_path': cf.file_path,
                'module': cf.module,
                'line_coverage': round(cf.line_coverage, 2),
                'missed_lines': cf.missed_lines,
                'missed_lines_list': cf.get_missed_lines()[:20]
            })
    
    return {
        'target_coverage': target_coverage,
        'current_coverage': round(current_coverage, 2),
        'coverage_gap': round(coverage_gap, 2),
        'total_lines': total_lines,
        'covered_lines': covered_lines,
        'missed_lines': missed_lines,
        'lines_needed': lines_needed,
        'files_below_target': files_below_target,
        'report_timestamp': latest_report.timestamp.isoformat() if latest_report.timestamp else None
    }


def calculate_flaky_risk(module=None, owner=None, days=None, flaky_threshold=30.0):
    query = FlakyRun.query
    
    if module:
        query = query.filter(FlakyRun.module == module)
    if owner:
        query = query.filter(FlakyRun.owner == owner)
    if days:
        cutoff = datetime.utcnow() - timedelta(days=days)
        query = query.filter(FlakyRun.timestamp >= cutoff)
    
    flaky_runs = query.all()
    
    total_flaky_tests = len(flaky_runs)
    high_risk_tests = []
    medium_risk_tests = []
    low_risk_tests = []
    
    total_attempts = 0
    total_failures = 0
    max_flaky_rate = 0.0
    
    for fr in flaky_runs:
        total_attempts += fr.run_count
        total_failures += fr.fail_count
        
        if fr.flaky_rate > max_flaky_rate:
            max_flaky_rate = fr.flaky_rate
        
        test_info = {
            'test_name': fr.test_name,
            'full_name': fr.full_name,
            'module': fr.module,
            'owner': fr.owner,
            'run_count': fr.run_count,
            'pass_count': fr.pass_count,
            'fail_count': fr.fail_count,
            'flaky_rate': round(fr.flaky_rate, 2),
            'first_attempt_status': fr.first_attempt_status,
            'last_attempt_status': fr.last_attempt_status,
            'retry_count': fr.retry_count,
            'max_retry_count': fr.max_retry_count,
            'error_messages': fr.get_error_messages()[:3]
        }
        
        if fr.flaky_rate >= flaky_threshold:
            high_risk_tests.append(test_info)
        elif fr.flaky_rate >= 10.0:
            medium_risk_tests.append(test_info)
        else:
            low_risk_tests.append(test_info)
    
    overall_flaky_rate = 0.0
    if total_attempts > 0:
        overall_flaky_rate = (total_failures / total_attempts) * 100
    
    risk_score = 0.0
    if total_flaky_tests > 0:
        high_weight = len(high_risk_tests) * 3
        medium_weight = len(medium_risk_tests) * 1
        risk_score = (high_weight + medium_weight) / total_flaky_tests * 100
    
    return {
        'flaky_threshold': flaky_threshold,
        'total_flaky_tests': total_flaky_tests,
        'total_attempts': total_attempts,
        'total_failures': total_failures,
        'overall_flaky_rate': round(overall_flaky_rate, 2),
        'max_flaky_rate': round(max_flaky_rate, 2),
        'risk_score': round(risk_score, 2),
        'risk_level': _get_risk_level(risk_score),
        'high_risk_tests': high_risk_tests,
        'medium_risk_tests': medium_risk_tests,
        'low_risk_tests': low_risk_tests
    }


def _get_risk_level(risk_score):
    if risk_score >= 80:
        return 'critical'
    elif risk_score >= 50:
        return 'high'
    elif risk_score >= 20:
        return 'medium'
    else:
        return 'low'


def get_metrics_by_module(target_coverage=80.0, flaky_threshold=30.0, days=None):
    modules = set()
    
    for tc in TestCase.query.distinct(TestCase.module).all():
        if tc.module:
            modules.add(tc.module)
    for cr in CoverageReport.query.distinct(CoverageReport.module).all():
        if cr.module:
            modules.add(cr.module)
    for fr in FlakyRun.query.distinct(FlakyRun.module).all():
        if fr.module:
            modules.add(fr.module)
    
    modules = sorted(modules)
    
    result = {}
    for module in modules:
        failure_metrics = calculate_failure_rate(module=module, days=days)
        coverage_metrics = calculate_coverage_gap(target_coverage=target_coverage, module=module)
        flaky_metrics = calculate_flaky_risk(module=module, days=days, flaky_threshold=flaky_threshold)
        
        result[module] = {
            'failure_rate': failure_metrics,
            'coverage_gap': coverage_metrics,
            'flaky_risk': flaky_metrics
        }
    
    return result


def get_metrics_by_owner(target_coverage=80.0, flaky_threshold=30.0, days=None):
    owners = set()
    
    for tc in TestCase.query.distinct(TestCase.owner).all():
        if tc.owner:
            owners.add(tc.owner)
    for cr in CoverageReport.query.distinct(CoverageReport.owner).all():
        if cr.owner:
            owners.add(cr.owner)
    for fr in FlakyRun.query.distinct(FlakyRun.owner).all():
        if fr.owner:
            owners.add(fr.owner)
    
    owners = sorted(owners)
    
    result = {}
    for owner in owners:
        failure_metrics = calculate_failure_rate(owner=owner, days=days)
        coverage_metrics = calculate_coverage_gap(target_coverage=target_coverage, owner=owner)
        flaky_metrics = calculate_flaky_risk(owner=owner, days=days, flaky_threshold=flaky_threshold)
        
        result[owner] = {
            'failure_rate': failure_metrics,
            'coverage_gap': coverage_metrics,
            'flaky_risk': flaky_metrics
        }
    
    return result


def get_overall_metrics(target_coverage=80.0, flaky_threshold=30.0, days=None):
    failure_metrics = calculate_failure_rate(days=days)
    coverage_metrics = calculate_coverage_gap(target_coverage=target_coverage)
    flaky_metrics = calculate_flaky_risk(days=days, flaky_threshold=flaky_threshold)
    
    health_score = _calculate_health_score(failure_metrics, coverage_metrics, flaky_metrics)
    
    return {
        'health_score': round(health_score, 2),
        'health_status': _get_health_status(health_score),
        'failure_rate': failure_metrics,
        'coverage_gap': coverage_metrics,
        'flaky_risk': flaky_metrics,
        'calculated_at': datetime.utcnow().isoformat()
    }


def _calculate_health_score(failure_metrics, coverage_metrics, flaky_metrics):
    score = 100.0
    
    if failure_metrics['total_tests'] > 0:
        score -= failure_metrics['failure_rate'] * 0.5
    
    score -= coverage_metrics['coverage_gap'] * 0.8
    
    flaky_score = flaky_metrics['risk_score']
    if flaky_score > 0:
        score -= flaky_score * 0.3
    
    return max(0, score)


def _get_health_status(health_score):
    if health_score >= 80:
        return 'healthy'
    elif health_score >= 60:
        return 'warning'
    elif health_score >= 40:
        return 'degraded'
    else:
        return 'critical'
