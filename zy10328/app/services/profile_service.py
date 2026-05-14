import uuid
import hashlib
import json
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.schema import (
    EntryAPI, DownstreamService, CallSample, LatencyDistribution,
    HistoryRecord, RequestDeduplication
)
from app.models.schemas import (
    EntryAPICreate, StatusEnum, RiskLevelEnum, StatusUpdate
)


def generate_uuid() -> str:
    return str(uuid.uuid4())


def _json_serializer(obj):
    """支持datetime类型的JSON序列化"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


def calculate_request_hash(request_data: Dict[str, Any]) -> str:
    sorted_data = json.dumps(request_data, sort_keys=True, default=_json_serializer)
    return hashlib.sha256(sorted_data.encode()).hexdigest()


def is_duplicate_request(db: Session, request_hash: str, ttl_hours: int = 24) -> bool:
    expires_at = datetime.utcnow() - timedelta(hours=ttl_hours)
    existing = db.query(RequestDeduplication).filter(
        and_(
            RequestDeduplication.request_hash == request_hash,
            RequestDeduplication.created_at >= expires_at
        )
    ).first()
    return existing is not None


def save_request_hash(db: Session, request_hash: str, entry_api_id: Optional[str] = None, ttl_hours: int = 24):
    dedup = RequestDeduplication(
        id=generate_uuid(),
        request_hash=request_hash,
        entry_api_id=entry_api_id,
        expires_at=datetime.utcnow() + timedelta(hours=ttl_hours)
    )
    db.add(dedup)
    db.commit()


def classify_sample(sample: CallSample) -> str:
    if sample.status == "SUCCESS":
        if sample.total_latency < 100:
            return "FAST_SUCCESS"
        elif sample.total_latency < 500:
            return "NORMAL_SUCCESS"
        else:
            return "SLOW_SUCCESS"
    else:
        if sample.error_message and "timeout" in sample.error_message.lower():
            return "TIMEOUT_ERROR"
        elif sample.error_message and "404" in sample.error_message:
            return "NOT_FOUND_ERROR"
        else:
            return "UNKNOWN_ERROR"


def calculate_latency_percentiles(latencies: List[float]) -> Dict[str, float]:
    if not latencies:
        return {"p50": 0.0, "p95": 0.0, "p99": 0.0, "avg": 0.0}
    
    sorted_latencies = sorted(latencies)
    n = len(sorted_latencies)
    
    return {
        "p50": sorted_latencies[int(n * 0.50)] if n > 0 else 0.0,
        "p95": sorted_latencies[int(n * 0.95)] if n > 1 else 0.0,
        "p99": sorted_latencies[int(n * 0.99)] if n > 1 else 0.0,
        "avg": sum(latencies) / n
    }


def create_latency_buckets() -> List[Dict[str, Any]]:
    return [
        {"bucket": "0-50ms", "min_ms": 0, "max_ms": 50},
        {"bucket": "50-100ms", "min_ms": 50, "max_ms": 100},
        {"bucket": "100-200ms", "min_ms": 100, "max_ms": 200},
        {"bucket": "200-500ms", "min_ms": 200, "max_ms": 500},
        {"bucket": "500-1000ms", "min_ms": 500, "max_ms": 1000},
        {"bucket": "1000ms+", "min_ms": 1000, "max_ms": float('inf')},
    ]


def calculate_latency_distribution(latencies: List[float]) -> List[Dict[str, Any]]:
    buckets = create_latency_buckets()
    total = len(latencies)
    
    for bucket in buckets:
        count = sum(1 for l in latencies if bucket["min_ms"] <= l < bucket["max_ms"])
        bucket["count"] = count
        bucket["percentage"] = (count / total * 100) if total > 0 else 0.0
    
    return buckets


def is_sensitive_path(method: str, path: str) -> bool:
    """检测是否为敏感操作路径"""
    sensitive_patterns = [
        ("DELETE", "/users"),
        ("DELETE", "/delete"),
        ("DELETE", "/remove"),
        ("DELETE", "/data"),
        ("POST", "/reset"),
        ("POST", "/batch"),
        ("POST", "/admin"),
    ]
    for sensitive_method, sensitive_path in sensitive_patterns:
        if method == sensitive_method and sensitive_path in path:
            return True
    return False


def assess_risk(service: DownstreamService) -> Dict[str, Any]:
    risk_level = RiskLevelEnum.LOW
    risk_factors = []
    
    if service.call_count == 0:
        return {"risk_level": RiskLevelEnum.UNKNOWN, "description": "无调用数据"}
    
    failure_rate = service.failure_count / service.call_count if service.call_count > 0 else 0
    
    # 故障率评估
    if failure_rate >= 0.5:
        risk_level = RiskLevelEnum.CRITICAL
        risk_factors.append(f"故障率过高: {failure_rate:.2%}")
    elif failure_rate >= 0.3:
        risk_level = RiskLevelEnum.HIGH
        risk_factors.append(f"故障率较高: {failure_rate:.2%}")
    elif failure_rate >= 0.1:
        risk_level = max(risk_level, RiskLevelEnum.MEDIUM)
        risk_factors.append(f"故障率偏高: {failure_rate:.2%}")
    
    # 延迟评估 - 降低阈值
    if service.p99_latency >= 3000:
        risk_level = max(risk_level, RiskLevelEnum.CRITICAL)
        risk_factors.append(f"P99耗时严重超标: {service.p99_latency:.2f}ms")
    elif service.p99_latency >= 2000:
        risk_level = max(risk_level, RiskLevelEnum.HIGH)
        risk_factors.append(f"P99耗时过高: {service.p99_latency:.2f}ms")
    elif service.p99_latency >= 1000:
        risk_level = max(risk_level, RiskLevelEnum.MEDIUM)
        risk_factors.append(f"P99耗时偏高: {service.p99_latency:.2f}ms")
    
    # 无缓存策略
    if service.cache_key is None or service.cache_key == "":
        risk_factors.append("未配置缓存策略")
        risk_level = max(risk_level, RiskLevelEnum.MEDIUM)
    
    # 多风险因素叠加升级
    if len(risk_factors) >= 3:
        risk_level = max(risk_level, RiskLevelEnum.CRITICAL)
        risk_factors.append("多风险因素叠加")
    elif len(risk_factors) >= 2:
        risk_level = max(risk_level, RiskLevelEnum.HIGH)
    
    description = "; ".join(risk_factors) if risk_factors else "服务运行正常"
    
    return {"risk_level": risk_level, "description": description}


def aggregate_overall_risk(services: List[DownstreamService], method: str = None, path: str = None, api_failure_rate: float = 0) -> Dict[str, Any]:
    if not services:
        return {"risk_level": RiskLevelEnum.UNKNOWN, "description": "无下游服务"}
    
    risk_order = [RiskLevelEnum.UNKNOWN, RiskLevelEnum.LOW, RiskLevelEnum.MEDIUM, RiskLevelEnum.HIGH, RiskLevelEnum.CRITICAL]
    max_risk = max(services, key=lambda s: risk_order.index(RiskLevelEnum(s.risk_level)))
    
    critical_count = sum(1 for s in services if s.risk_level == RiskLevelEnum.CRITICAL)
    high_count = sum(1 for s in services if s.risk_level == RiskLevelEnum.HIGH)
    medium_count = sum(1 for s in services if s.risk_level == RiskLevelEnum.MEDIUM)
    high_risk_count = critical_count + high_count
    
    overall_level = RiskLevelEnum(max_risk.risk_level)
    description_parts = []
    
    # 敏感路径检测
    is_sensitive = False
    if method and path and is_sensitive_path(method, path):
        is_sensitive = True
        overall_level = RiskLevelEnum.CRITICAL
        description_parts.append("敏感操作路径: 数据删除/批量操作等高风险行为")
    
    # 多个高风险服务叠加升级 - 注意不要覆盖敏感路径的 CRITICAL
    # 使用入口 API 失败率而不是下游服务失败率
    total_failure_rate = api_failure_rate
    
    # 计算应该升级到的风险等级（不覆盖敏感路径已设置的 CRITICAL）
    # 使用 risk_order 索引来比较优先级
    risk_order = [RiskLevelEnum.UNKNOWN, RiskLevelEnum.LOW, RiskLevelEnum.MEDIUM, RiskLevelEnum.HIGH, RiskLevelEnum.CRITICAL]
    
    target_level = None
    if critical_count >= 1 or total_failure_rate >= 0.5 or (high_count >= 1 and medium_count >= 2):
        target_level = RiskLevelEnum.CRITICAL
        description_parts.append(f"整体故障率高: {total_failure_rate:.1%}, 多个下游服务存在风险")
    elif high_count >= 1 or medium_count >= 3 or total_failure_rate >= 0.3:
        target_level = RiskLevelEnum.HIGH
        description_parts.append(f"多服务风险叠加: {medium_count} 个中等风险服务, 整体故障率 {total_failure_rate:.1%}")
    elif medium_count >= 1:
        target_level = RiskLevelEnum.MEDIUM
        description_parts.append(f"存在 {medium_count} 个中等风险服务")
    
    # 只有当不是敏感路径，或目标等级更高时才更新
    if target_level:
        if not is_sensitive or risk_order.index(target_level) > risk_order.index(overall_level):
            if risk_order.index(target_level) > risk_order.index(overall_level):
                overall_level = target_level
    
    if not is_sensitive and not description_parts:
        description_parts.append(f"最高风险等级: {overall_level.value}")
    
    description = "; ".join(description_parts)
    
    return {
        "risk_level": overall_level, 
        "description": description,
        "is_sensitive_path": is_sensitive,
        "risk_breakdown": {
            "CRITICAL": critical_count,
            "HIGH": high_count,
            "MEDIUM": medium_count,
            "LOW": len(services) - high_risk_count - medium_count
        }
    }


def create_entry_api(db: Session, api_data: EntryAPICreate) -> EntryAPI:
    api_id = api_data.id if api_data.id else generate_uuid()
    
    entry_api = EntryAPI(
        id=api_id,
        name=api_data.name,
        method=api_data.method,
        path=api_data.path,
        description=api_data.description,
        status=StatusEnum.CREATED.value
    )
    db.add(entry_api)
    
    add_history_record(
        db, api_id, "CREATED", None, StatusEnum.CREATED.value,
        "创建调用画像任务", "system", {"initial_data": api_data.model_dump()}
    )
    
    if api_data.downstream_services:
        for svc_data in api_data.downstream_services:
            service = DownstreamService(
                id=generate_uuid(),
                entry_api_id=api_id,
                service_name=svc_data.service_name,
                service_type=svc_data.service_type,
                endpoint=svc_data.endpoint,
                method=svc_data.method,
                cache_key=svc_data.cache_key,
                cache_ttl=svc_data.cache_ttl
            )
            db.add(service)
    
    if api_data.call_samples:
        for sample_data in api_data.call_samples:
            sample = CallSample(
                id=generate_uuid(),
                entry_api_id=api_id,
                trace_id=sample_data.trace_id,
                request_id=sample_data.request_id,
                user_id=sample_data.user_id,
                timestamp=sample_data.timestamp,
                status=sample_data.status,
                total_latency=sample_data.total_latency,
                category=sample_data.category,
                request_data=sample_data.request_data,
                response_data=sample_data.response_data,
                error_message=sample_data.error_message,
                error_stack=sample_data.error_stack,
                downstream_calls=sample_data.downstream_calls
            )
            db.add(sample)
    
    db.commit()
    db.refresh(entry_api)
    return entry_api


def add_history_record(
    db: Session, entry_api_id: str, action: str,
    previous_status: Optional[str], new_status: Optional[str],
    reason: str, operator: str, details: Optional[Dict[str, Any]] = None
):
    record = HistoryRecord(
        id=generate_uuid(),
        entry_api_id=entry_api_id,
        action=action,
        operator=operator,
        previous_status=previous_status,
        new_status=new_status,
        change_reason=reason,
        details=details
    )
    db.add(record)


def update_status(db: Session, entry_api_id: str, status_update: StatusUpdate) -> Optional[EntryAPI]:
    entry_api = db.query(EntryAPI).filter(EntryAPI.id == entry_api_id).first()
    if not entry_api:
        return None
    
    previous_status = entry_api.status
    entry_api.status = status_update.status.value
    
    add_history_record(
        db, entry_api_id, "STATUS_CHANGE",
        previous_status, status_update.status.value,
        status_update.reason or "状态推进",
        status_update.operator,
        {"transition": f"{previous_status} -> {status_update.status.value}"}
    )
    
    db.commit()
    db.refresh(entry_api)
    return entry_api


def process_samples(db: Session, entry_api_id: str) -> bool:
    entry_api = db.query(EntryAPI).filter(EntryAPI.id == entry_api_id).first()
    if not entry_api:
        return False
    
    samples = db.query(CallSample).filter(CallSample.entry_api_id == entry_api_id).all()
    
    for sample in samples:
        if not sample.category:
            sample.category = classify_sample(sample)
    
    service_latencies: Dict[str, List[float]] = {}
    service_failures: Dict[str, int] = {}
    
    for sample in samples:
        if sample.downstream_calls:
            for call in sample.downstream_calls:
                svc_name = call.get("service_name")
                latency = call.get("latency", 0)
                call_status = call.get("status", "SUCCESS")
                if svc_name:
                    if svc_name not in service_latencies:
                        service_latencies[svc_name] = []
                        service_failures[svc_name] = 0
                    service_latencies[svc_name].append(latency)
                    if call_status != "SUCCESS":
                        service_failures[svc_name] += 1
    
    services = db.query(DownstreamService).filter(DownstreamService.entry_api_id == entry_api_id).all()
    
    for service in services:
        latencies = service_latencies.get(service.service_name, [])
        if latencies:
            stats = calculate_latency_percentiles(latencies)
            service.avg_latency = stats["avg"]
            service.p50_latency = stats["p50"]
            service.p95_latency = stats["p95"]
            service.p99_latency = stats["p99"]
            service.call_count = len(latencies)
            
            # 计算该服务的失败次数
            service.failure_count = service_failures.get(service.service_name, 0)
            service.success_count = service.call_count - service.failure_count
            
            db.query(LatencyDistribution).filter(LatencyDistribution.service_id == service.id).delete()
            distributions = calculate_latency_distribution(latencies)
            for dist in distributions:
                ld = LatencyDistribution(
                    id=generate_uuid(),
                    service_id=service.id,
                    bucket=dist["bucket"],
                    min_ms=dist["min_ms"],
                    max_ms=dist["max_ms"],
                    count=dist["count"],
                    percentage=dist["percentage"]
                )
                db.add(ld)
            
            risk = assess_risk(service)
            service.risk_level = risk["risk_level"].value
            service.risk_description = risk["description"]
    
    # 计算入口 API 调用的总体失败率
    total_samples = len(samples)
    api_failed_samples = sum(1 for s in samples if s.status == "FAILED")
    api_failure_rate = api_failed_samples / total_samples if total_samples > 0 else 0
    
    overall_risk = aggregate_overall_risk(services, entry_api.method, entry_api.path, api_failure_rate)
    entry_api.risk_level = overall_risk["risk_level"].value
    entry_api.risk_description = overall_risk["description"]
    
    add_history_record(
        db, entry_api_id, "AGGREGATION_COMPLETED",
        entry_api.status, entry_api.status,
        "画像数据聚合完成", "system",
        {
            "sample_count": len(samples),
            "service_count": len(services),
            "risk_breakdown": overall_risk.get("risk_breakdown", {}),
            "is_sensitive_path": overall_risk.get("is_sensitive_path", False)
        }
    )
    
    db.commit()
    return True


def revoke_profile(db: Session, entry_api_id: str, reason: str, operator: str) -> Optional[EntryAPI]:
    entry_api = db.query(EntryAPI).filter(EntryAPI.id == entry_api_id).first()
    if not entry_api:
        return None
    
    previous_status = entry_api.status
    entry_api.status = StatusEnum.REVOKED.value
    
    add_history_record(
        db, entry_api_id, "REVOKED",
        previous_status, StatusEnum.REVOKED.value,
        reason, operator
    )
    
    db.commit()
    db.refresh(entry_api)
    return entry_api
