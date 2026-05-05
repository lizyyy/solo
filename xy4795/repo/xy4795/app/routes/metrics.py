from flask import Blueprint, request, jsonify
from app.services.metrics_calculator import (
    calculate_failure_rate, calculate_coverage_gap, calculate_flaky_risk,
    get_metrics_by_module, get_metrics_by_owner, get_overall_metrics
)

metrics_bp = Blueprint('metrics', __name__)


@metrics_bp.route('', methods=['GET'])
def get_all_metrics():
    target_coverage = request.args.get('target_coverage', 80.0, type=float)
    flaky_threshold = request.args.get('flaky_threshold', 30.0, type=float)
    days = request.args.get('days', type=int)
    
    overall = get_overall_metrics(target_coverage, flaky_threshold, days)
    by_module = get_metrics_by_module(target_coverage, flaky_threshold, days)
    by_owner = get_metrics_by_owner(target_coverage, flaky_threshold, days)
    
    return jsonify({
        'overall': overall,
        'by_module': by_module,
        'by_owner': by_owner
    })


@metrics_bp.route('/overall', methods=['GET'])
def overall_metrics():
    target_coverage = request.args.get('target_coverage', 80.0, type=float)
    flaky_threshold = request.args.get('flaky_threshold', 30.0, type=float)
    days = request.args.get('days', type=int)
    
    metrics = get_overall_metrics(target_coverage, flaky_threshold, days)
    return jsonify(metrics)


@metrics_bp.route('/failure-rate', methods=['GET'])
def failure_rate_metrics():
    module = request.args.get('module')
    owner = request.args.get('owner')
    days = request.args.get('days', type=int)
    
    metrics = calculate_failure_rate(module=module, owner=owner, days=days)
    return jsonify(metrics)


@metrics_bp.route('/coverage-gap', methods=['GET'])
def coverage_gap_metrics():
    target_coverage = request.args.get('target_coverage', 80.0, type=float)
    module = request.args.get('module')
    owner = request.args.get('owner')
    
    metrics = calculate_coverage_gap(target_coverage=target_coverage, module=module, owner=owner)
    return jsonify(metrics)


@metrics_bp.route('/flaky-risk', methods=['GET'])
def flaky_risk_metrics():
    module = request.args.get('module')
    owner = request.args.get('owner')
    days = request.args.get('days', type=int)
    flaky_threshold = request.args.get('flaky_threshold', 30.0, type=float)
    
    metrics = calculate_flaky_risk(module=module, owner=owner, days=days, flaky_threshold=flaky_threshold)
    return jsonify(metrics)


@metrics_bp.route('/by-module', methods=['GET'])
def metrics_by_module():
    target_coverage = request.args.get('target_coverage', 80.0, type=float)
    flaky_threshold = request.args.get('flaky_threshold', 30.0, type=float)
    days = request.args.get('days', type=int)
    
    metrics = get_metrics_by_module(target_coverage, flaky_threshold, days)
    return jsonify(metrics)


@metrics_bp.route('/by-owner', methods=['GET'])
def metrics_by_owner():
    target_coverage = request.args.get('target_coverage', 80.0, type=float)
    flaky_threshold = request.args.get('flaky_threshold', 30.0, type=float)
    days = request.args.get('days', type=int)
    
    metrics = get_metrics_by_owner(target_coverage, flaky_threshold, days)
    return jsonify(metrics)


@metrics_bp.route('/health-score', methods=['GET'])
def health_score():
    target_coverage = request.args.get('target_coverage', 80.0, type=float)
    flaky_threshold = request.args.get('flaky_threshold', 30.0, type=float)
    days = request.args.get('days', type=int)
    
    overall = get_overall_metrics(target_coverage, flaky_threshold, days)
    
    return jsonify({
        'health_score': overall['health_score'],
        'health_status': overall['health_status'],
        'calculated_at': overall['calculated_at']
    })
