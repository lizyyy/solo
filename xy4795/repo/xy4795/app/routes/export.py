from flask import Blueprint, request, jsonify, Response, make_response
from app.services.exporter import export_markdown_report, export_json_details
from datetime import datetime

export_bp = Blueprint('export', __name__)


@export_bp.route('/markdown', methods=['GET'])
def export_markdown():
    target_coverage = request.args.get('target_coverage', 80.0, type=float)
    flaky_threshold = request.args.get('flaky_threshold', 30.0, type=float)
    days = request.args.get('days', type=int)
    include_modules = request.args.get('include_modules', 'true').lower() == 'true'
    include_owners = request.args.get('include_owners', 'true').lower() == 'true'
    include_quarantine = request.args.get('include_quarantine', 'true').lower() == 'true'
    
    markdown = export_markdown_report(
        target_coverage=target_coverage,
        flaky_threshold=flaky_threshold,
        days=days,
        include_modules=include_modules,
        include_owners=include_owners,
        include_quarantine=include_quarantine
    )
    
    filename = f'test-health-report-{datetime.now().strftime("%Y%m%d-%H%M%S")}.md'
    
    response = make_response(markdown)
    response.headers['Content-Type'] = 'text/markdown; charset=utf-8'
    response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
    
    return response


@export_bp.route('/markdown/preview', methods=['GET'])
def preview_markdown():
    target_coverage = request.args.get('target_coverage', 80.0, type=float)
    flaky_threshold = request.args.get('flaky_threshold', 30.0, type=float)
    days = request.args.get('days', type=int)
    include_modules = request.args.get('include_modules', 'true').lower() == 'true'
    include_owners = request.args.get('include_owners', 'true').lower() == 'true'
    include_quarantine = request.args.get('include_quarantine', 'true').lower() == 'true'
    
    markdown = export_markdown_report(
        target_coverage=target_coverage,
        flaky_threshold=flaky_threshold,
        days=days,
        include_modules=include_modules,
        include_owners=include_owners,
        include_quarantine=include_quarantine
    )
    
    return jsonify({
        'markdown': markdown,
        'generated_at': datetime.now().isoformat()
    })


@export_bp.route('/json', methods=['GET'])
def export_json():
    target_coverage = request.args.get('target_coverage', 80.0, type=float)
    flaky_threshold = request.args.get('flaky_threshold', 30.0, type=float)
    days = request.args.get('days', type=int)
    include_test_cases = request.args.get('include_test_cases', 'false').lower() == 'true'
    include_coverage_files = request.args.get('include_coverage_files', 'false').lower() == 'true'
    include_flaky_details = request.args.get('include_flaky_details', 'false').lower() == 'true'
    include_quarantine = request.args.get('include_quarantine', 'true').lower() == 'true'
    
    details = export_json_details(
        target_coverage=target_coverage,
        flaky_threshold=flaky_threshold,
        days=days,
        include_test_cases=include_test_cases,
        include_coverage_files=include_coverage_files,
        include_flaky_details=include_flaky_details,
        include_quarantine=include_quarantine
    )
    
    filename = f'test-health-details-{datetime.now().strftime("%Y%m%d-%H%M%S")}.json'
    
    response = make_response(jsonify(details))
    response.headers['Content-Type'] = 'application/json'
    response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
    
    return response


@export_bp.route('/health-gate', methods=['GET'])
def health_gate_report():
    target_coverage = request.args.get('target_coverage', 80.0, type=float)
    flaky_threshold = request.args.get('flaky_threshold', 30.0, type=float)
    max_failure_rate = request.args.get('max_failure_rate', 5.0, type=float)
    max_flaky_risk = request.args.get('max_flaky_risk', 50.0, type=float)
    days = request.args.get('days', type=int)
    
    from app.services.metrics_calculator import get_overall_metrics
    
    overall = get_overall_metrics(target_coverage, flaky_threshold, days)
    
    failure_rate = overall['failure_rate']['failure_rate']
    coverage_gap = overall['coverage_gap']['coverage_gap']
    flaky_risk_score = overall['flaky_risk']['risk_score']
    
    gates = []
    
    gate1 = {
        'name': '测试通过率',
        'metric': 'failure_rate',
        'value': failure_rate,
        'threshold': max_failure_rate,
        'unit': '%',
        'passed': failure_rate <= max_failure_rate
    }
    gates.append(gate1)
    
    gate2 = {
        'name': '代码覆盖率',
        'metric': 'coverage_gap',
        'value': coverage_gap,
        'threshold': 0.0,
        'unit': '%',
        'passed': coverage_gap <= 0.0
    }
    gates.append(gate2)
    
    gate3 = {
        'name': 'Flaky 测试风险',
        'metric': 'flaky_risk_score',
        'value': flaky_risk_score,
        'threshold': max_flaky_risk,
        'unit': '',
        'passed': flaky_risk_score <= max_flaky_risk
    }
    gates.append(gate3)
    
    all_passed = all(g['passed'] for g in gates)
    
    result = {
        'health_gate': {
            'overall_status': 'PASSED' if all_passed else 'FAILED',
            'gates': gates,
            'health_score': overall['health_score'],
            'health_status': overall['health_status']
        },
        'metrics': {
            'failure_rate': overall['failure_rate'],
            'coverage_gap': overall['coverage_gap'],
            'flaky_risk': overall['flaky_risk']
        },
        'thresholds': {
            'target_coverage': target_coverage,
            'flaky_threshold': flaky_threshold,
            'max_failure_rate': max_failure_rate,
            'max_flaky_risk': max_flaky_risk
        },
        'generated_at': datetime.now().isoformat()
    }
    
    return jsonify(result)
