import yaml
import json
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from models import (
    RouteConfig, ProtectionPolicy, DependencyHealth, RequestSample,
    PolicyVersion, PolicyStatus
)
from datetime import datetime


def parse_yaml_file(file_path: str) -> Dict[str, Any]:
    with open(file_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def parse_jsonl_file(file_path: str) -> List[Dict[str, Any]]:
    records = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return records


def import_routes(db: Session, routes_data: Dict[str, Any], policy_version_id: Optional[int] = None) -> List[RouteConfig]:
    routes = []
    routes_list = routes_data.get('routes', []) if isinstance(routes_data, dict) else routes_data
    
    for route_data in routes_list:
        route_key = route_data.get('key') or f"{route_data.get('method', 'GET')}:{route_data.get('path')}"
        
        existing = db.query(RouteConfig).filter(RouteConfig.route_key == route_key).first()
        
        if existing:
            existing.path = route_data.get('path', existing.path)
            existing.method = route_data.get('method', existing.method)
            existing.service_name = route_data.get('service_name', existing.service_name)
            existing.endpoint_name = route_data.get('endpoint_name', existing.endpoint_name)
            if policy_version_id:
                existing.policy_version_id = policy_version_id
            route = existing
        else:
            route = RouteConfig(
                route_key=route_key,
                path=route_data.get('path'),
                method=route_data.get('method', 'GET'),
                service_name=route_data.get('service_name'),
                endpoint_name=route_data.get('endpoint_name'),
                policy_version_id=policy_version_id
            )
            db.add(route)
        
        routes.append(route)
    
    db.commit()
    return routes


def import_protection_policy(db: Session, policy_data: Dict[str, Any], policy_version_id: Optional[int] = None) -> List[ProtectionPolicy]:
    policies = []
    policies_list = policy_data.get('policies', []) if isinstance(policy_data, dict) else policy_data
    
    for policy_item in policies_list:
        policy_key = policy_item.get('key') or f"policy_{policy_item.get('route_key', 'default')}"
        
        existing = db.query(ProtectionPolicy).filter(ProtectionPolicy.policy_key == policy_key).first()
        
        rate_limit = policy_item.get('rate_limit', {}) or {}
        circuit_breaker = policy_item.get('circuit_breaker', {}) or {}
        degradation = policy_item.get('degradation', {}) or {}
        
        if existing:
            existing.route_key = policy_item.get('route_key', existing.route_key)
            if policy_version_id:
                existing.policy_version_id = policy_version_id
            
            existing.rate_limit_enabled = rate_limit.get('enabled', existing.rate_limit_enabled)
            existing.rate_limit_type = rate_limit.get('type', existing.rate_limit_type)
            existing.rate_limit_threshold = rate_limit.get('threshold', existing.rate_limit_threshold)
            existing.rate_limit_window_seconds = rate_limit.get('window_seconds', existing.rate_limit_window_seconds)
            existing.rate_limit_burst = rate_limit.get('burst', existing.rate_limit_burst)
            
            existing.circuit_breaker_enabled = circuit_breaker.get('enabled', existing.circuit_breaker_enabled)
            existing.cb_failure_threshold = circuit_breaker.get('failure_threshold', existing.cb_failure_threshold)
            existing.cb_min_requests = circuit_breaker.get('min_requests', existing.cb_min_requests)
            existing.cb_half_open_max_requests = circuit_breaker.get('half_open_max_requests', existing.cb_half_open_max_requests)
            existing.cb_open_duration_seconds = circuit_breaker.get('open_duration_seconds', existing.cb_open_duration_seconds)
            existing.cb_sliding_window_size = circuit_breaker.get('sliding_window_size', existing.cb_sliding_window_size)
            
            existing.degradation_enabled = degradation.get('enabled', existing.degradation_enabled)
            existing.degradation_fallback_type = degradation.get('fallback_type', existing.degradation_fallback_type)
            existing.degradation_fallback_value = degradation.get('fallback_value', existing.degradation_fallback_value)
            
            policy = existing
        else:
            policy = ProtectionPolicy(
                policy_key=policy_key,
                route_key=policy_item.get('route_key'),
                policy_version_id=policy_version_id,
                
                rate_limit_enabled=rate_limit.get('enabled', True),
                rate_limit_type=rate_limit.get('type', 'fixed_window'),
                rate_limit_threshold=rate_limit.get('threshold', 100),
                rate_limit_window_seconds=rate_limit.get('window_seconds', 60),
                rate_limit_burst=rate_limit.get('burst', 10),
                
                circuit_breaker_enabled=circuit_breaker.get('enabled', True),
                cb_failure_threshold=circuit_breaker.get('failure_threshold', 0.5),
                cb_min_requests=circuit_breaker.get('min_requests', 10),
                cb_half_open_max_requests=circuit_breaker.get('half_open_max_requests', 3),
                cb_open_duration_seconds=circuit_breaker.get('open_duration_seconds', 30),
                cb_sliding_window_size=circuit_breaker.get('sliding_window_size', 100),
                
                degradation_enabled=degradation.get('enabled', True),
                degradation_fallback_type=degradation.get('fallback_type', 'default_response'),
                degradation_fallback_value=degradation.get('fallback_value')
            )
            db.add(policy)
        
        policies.append(policy)
    
    db.commit()
    return policies


def import_dependency_health(db: Session, health_records: List[Dict[str, Any]]) -> List[DependencyHealth]:
    dependencies = []
    
    for record in health_records:
        dependency_key = record.get('key') or f"{record.get('service_name', 'unknown')}:{record.get('endpoint', 'unknown')}"
        
        existing = db.query(DependencyHealth).filter(DependencyHealth.dependency_key == dependency_key).first()
        
        if existing:
            existing.service_name = record.get('service_name', existing.service_name)
            existing.endpoint = record.get('endpoint', existing.endpoint)
            existing.is_healthy = record.get('is_healthy', existing.is_healthy)
            existing.error_rate = record.get('error_rate', existing.error_rate)
            existing.latency_p99_ms = record.get('latency_p99_ms', existing.latency_p99_ms)
            existing.success_count = record.get('success_count', existing.success_count)
            existing.failure_count = record.get('failure_count', existing.failure_count)
            existing.total_requests = record.get('total_requests', existing.total_requests)
            existing.reported_at = datetime.now()
            dep = existing
        else:
            dep = DependencyHealth(
                dependency_key=dependency_key,
                service_name=record.get('service_name'),
                endpoint=record.get('endpoint'),
                is_healthy=record.get('is_healthy', True),
                error_rate=record.get('error_rate', 0.0),
                latency_p99_ms=record.get('latency_p99_ms', 0.0),
                success_count=record.get('success_count', 0),
                failure_count=record.get('failure_count', 0),
                total_requests=record.get('total_requests', 0),
                reported_at=datetime.now()
            )
            db.add(dep)
        
        dependencies.append(dep)
    
    db.commit()
    return dependencies


def import_request_samples(db: Session, samples: List[Dict[str, Any]]) -> List[RequestSample]:
    request_samples = []
    
    for sample in samples:
        sample_key = sample.get('key') or f"sample_{sample.get('method', 'GET')}:{sample.get('path')}"
        
        existing = db.query(RequestSample).filter(RequestSample.sample_key == sample_key).first()
        
        if existing:
            existing.route_key = sample.get('route_key', existing.route_key)
            existing.path = sample.get('path', existing.path)
            existing.method = sample.get('method', existing.method)
            existing.headers = sample.get('headers', existing.headers)
            existing.query_params = sample.get('query_params', existing.query_params)
            existing.body = sample.get('body', existing.body)
            existing.expected_decision = sample.get('expected_decision', existing.expected_decision)
            existing.expected_reason = sample.get('expected_reason', existing.expected_reason)
            existing.is_bad_sample = sample.get('is_bad_sample', existing.is_bad_sample)
            existing.bad_sample_hint = sample.get('bad_sample_hint', existing.bad_sample_hint)
            req_sample = existing
        else:
            req_sample = RequestSample(
                sample_key=sample_key,
                route_key=sample.get('route_key'),
                path=sample.get('path'),
                method=sample.get('method', 'GET'),
                headers=sample.get('headers'),
                query_params=sample.get('query_params'),
                body=sample.get('body'),
                expected_decision=sample.get('expected_decision'),
                expected_reason=sample.get('expected_reason'),
                is_bad_sample=sample.get('is_bad_sample', False),
                bad_sample_hint=sample.get('bad_sample_hint')
            )
            db.add(req_sample)
        
        request_samples.append(req_sample)
    
    db.commit()
    return request_samples


def import_all_configs(
    db: Session,
    routes_file: Optional[str] = None,
    protection_policy_file: Optional[str] = None,
    dependency_health_file: Optional[str] = None,
    request_samples_file: Optional[str] = None,
    create_version: bool = True,
    version_description: str = "Imported configuration"
) -> Dict[str, Any]:
    result = {
        "routes": [],
        "policies": [],
        "dependencies": [],
        "samples": [],
        "policy_version": None
    }
    
    policy_version = None
    policy_version_id = None
    
    if create_version:
        from datetime import datetime
        version = f"v{datetime.now().strftime('%Y%m%d%H%M%S')}"
        policy_version = PolicyVersion(
            version=version,
            description=version_description,
            status=PolicyStatus.DRAFT
        )
        db.add(policy_version)
        db.commit()
        db.refresh(policy_version)
        policy_version_id = policy_version.id
        result["policy_version"] = policy_version
    
    routes_config = None
    if routes_file:
        routes_data = parse_yaml_file(routes_file)
        routes_config = routes_data
        result["routes"] = import_routes(db, routes_data, policy_version_id)
    
    if protection_policy_file:
        policy_data = parse_yaml_file(protection_policy_file)
        result["policies"] = import_protection_policy(db, policy_data, policy_version_id)
    
    if policy_version and (routes_config or protection_policy_file):
        policy_version.routes_config = routes_config
        if protection_policy_file:
            policy_version.protection_config = parse_yaml_file(protection_policy_file)
        db.commit()
    
    if dependency_health_file:
        health_records = parse_jsonl_file(dependency_health_file)
        result["dependencies"] = import_dependency_health(db, health_records)
    
    if request_samples_file:
        samples = parse_jsonl_file(request_samples_file)
        result["samples"] = import_request_samples(db, samples)
    
    return result
