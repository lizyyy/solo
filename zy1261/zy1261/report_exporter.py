from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
import json
from models import (
    RequestLog, RequestDecision, CircuitBreakerRecord, CircuitBreakerState,
    PolicyVersion, DependencyHealth, RouteConfig, ProtectionPolicy
)


class ReportExporter:
    def __init__(self, db: Session):
        self.db = db
    
    def get_request_stats(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        route_key: Optional[str] = None
    ) -> Dict[str, Any]:
        query = self.db.query(RequestLog)
        
        if start_time:
            query = query.filter(RequestLog.created_at >= start_time)
        if end_time:
            query = query.filter(RequestLog.created_at <= end_time)
        if route_key:
            query = query.filter(RequestLog.route_key == route_key)
        
        total_count = query.count()
        
        stats = {
            "total_requests": total_count,
            "by_decision": {},
            "by_route": {},
            "by_policy_version": {},
            "dry_run_vs_live": {
                "dry_run": query.filter(RequestLog.is_dry_run == True).count(),
                "live": query.filter(RequestLog.is_dry_run == False).count()
            }
        }
        
        for decision in RequestDecision:
            count = query.filter(RequestLog.decision == decision).count()
            stats["by_decision"][decision] = {
                "count": count,
                "percentage": (count / total_count * 100) if total_count > 0 else 0
            }
        
        route_counts = self.db.query(
            RequestLog.route_key,
            func.count(RequestLog.id).label('count')
        ).filter(
            RequestLog.created_at >= start_time if start_time else True,
            RequestLog.created_at <= end_time if end_time else True
        ).group_by(RequestLog.route_key).all()
        
        for route_key_val, count in route_counts:
            stats["by_route"][route_key_val] = {
                "count": count,
                "percentage": (count / total_count * 100) if total_count > 0 else 0
            }
        
        version_counts = self.db.query(
            RequestLog.policy_version,
            func.count(RequestLog.id).label('count')
        ).filter(
            RequestLog.created_at >= start_time if start_time else True,
            RequestLog.created_at <= end_time if end_time else True
        ).group_by(RequestLog.policy_version).all()
        
        for version, count in version_counts:
            stats["by_policy_version"][version] = {
                "count": count,
                "percentage": (count / total_count * 100) if total_count > 0 else 0
            }
        
        return stats
    
    def get_circuit_breaker_summary(self) -> Dict[str, Any]:
        records = self.db.query(CircuitBreakerRecord).all()
        
        summary = {
            "total": len(records),
            "by_state": {},
            "circuits": []
        }
        
        for state in CircuitBreakerState:
            count = sum(1 for r in records if r.state == state)
            summary["by_state"][state] = count
        
        for record in records:
            summary["circuits"].append({
                "route_key": record.route_key,
                "state": record.state,
                "previous_state": record.previous_state,
                "failure_count": record.failure_count,
                "success_count": record.success_count,
                "total_count": record.total_count,
                "failure_rate": record.failure_rate,
                "open_at": record.open_at.isoformat() if record.open_at else None,
                "reason": record.reason
            })
        
        return summary
    
    def get_dependency_health_summary(self) -> Dict[str, Any]:
        records = self.db.query(DependencyHealth).all()
        
        summary = {
            "total": len(records),
            "healthy": sum(1 for r in records if r.is_healthy),
            "unhealthy": sum(1 for r in records if not r.is_healthy),
            "dependencies": []
        }
        
        for record in records:
            summary["dependencies"].append({
                "dependency_key": record.dependency_key,
                "service_name": record.service_name,
                "endpoint": record.endpoint,
                "is_healthy": record.is_healthy,
                "error_rate": record.error_rate,
                "latency_p99_ms": record.latency_p99_ms,
                "success_count": record.success_count,
                "failure_count": record.failure_count,
                "total_requests": record.total_requests,
                "reported_at": record.reported_at.isoformat() if record.reported_at else None
            })
        
        return summary
    
    def get_policy_versions_summary(self) -> Dict[str, Any]:
        records = self.db.query(PolicyVersion).order_by(PolicyVersion.created_at.desc()).all()
        
        summary = {
            "total": len(records),
            "versions": []
        }
        
        for record in records:
            summary["versions"].append({
                "id": record.id,
                "version": record.version,
                "description": record.description,
                "status": record.status,
                "canary_percentage": record.canary_percentage,
                "created_at": record.created_at.isoformat() if record.created_at else None,
                "updated_at": record.updated_at.isoformat() if record.updated_at else None
            })
        
        return summary
    
    def export_json_report(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        include_samples: bool = False
    ) -> str:
        report = {
            "report_type": "protection_policy_report",
            "generated_at": datetime.now().isoformat(),
            "time_range": {
                "start": start_time.isoformat() if start_time else None,
                "end": end_time.isoformat() if end_time else None
            },
            "request_stats": self.get_request_stats(start_time, end_time),
            "circuit_breaker_summary": self.get_circuit_breaker_summary(),
            "dependency_health_summary": self.get_dependency_health_summary(),
            "policy_versions": self.get_policy_versions_summary()
        }
        
        if include_samples:
            sample_logs = self.db.query(RequestLog).order_by(
                RequestLog.created_at.desc()
            ).limit(100).all()
            
            report["recent_requests"] = [
                {
                    "request_id": log.request_id,
                    "route_key": log.route_key,
                    "path": log.path,
                    "method": log.method,
                    "policy_version": log.policy_version,
                    "decision": log.decision,
                    "decision_reason": log.decision_reason,
                    "threshold_value": log.threshold_value,
                    "actual_value": log.actual_value,
                    "is_dry_run": log.is_dry_run,
                    "circuit_breaker_state": log.circuit_breaker_state,
                    "response_status": log.response_status,
                    "response_time_ms": log.response_time_ms,
                    "created_at": log.created_at.isoformat() if log.created_at else None
                }
                for log in sample_logs
            ]
        
        return json.dumps(report, indent=2, ensure_ascii=False)
    
    def export_markdown_report(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> str:
        generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        request_stats = self.get_request_stats(start_time, end_time)
        cb_summary = self.get_circuit_breaker_summary()
        dep_health = self.get_dependency_health_summary()
        policy_versions = self.get_policy_versions_summary()
        
        markdown = f"""# 接口保护策略报告

> 生成时间: {generated_at}

---

## 目录
1. [请求统计](#请求统计)
2. [熔断状态](#熔断状态)
3. [依赖健康](#依赖健康)
4. [策略版本](#策略版本)

---

## 请求统计

### 概览
- **总请求数**: {request_stats['total_requests']}
- **Dry Run**: {request_stats['dry_run_vs_live']['dry_run']}
- **Live**: {request_stats['dry_run_vs_live']['live']}

### 决策分布

| 决策类型 | 请求数 | 占比 |
|----------|--------|------|
"""
        
        for decision, data in request_stats['by_decision'].items():
            markdown += f"| {decision} | {data['count']} | {data['percentage']:.2f}% |\n"
        
        markdown += f"""

### 按路由分布

| 路由 | 请求数 | 占比 |
|------|--------|------|
"""
        
        for route_key, data in request_stats['by_route'].items():
            markdown += f"| {route_key} | {data['count']} | {data['percentage']:.2f}% |\n"
        
        markdown += f"""

---

## 熔断状态

### 概览
- **总熔断数**: {cb_summary['total']}
- **Closed (正常)**: {cb_summary['by_state'].get('closed', 0)}
- **Open (熔断)**: {cb_summary['by_state'].get('open', 0)}
- **Half Open (半开)**: {cb_summary['by_state'].get('half_open', 0)}

### 详细状态

| 路由 | 状态 | 失败率 | 失败数 | 成功数 | 原因 |
|------|------|--------|--------|--------|------|
"""
        
        for circuit in cb_summary['circuits']:
            markdown += f"| {circuit['route_key']} | {circuit['state']} | {circuit['failure_rate']:.2%} | {circuit['failure_count']} | {circuit['success_count']} | {circuit['reason'] or '-'} |\n"
        
        markdown += f"""

---

## 依赖健康

### 概览
- **总依赖数**: {dep_health['total']}
- **健康**: {dep_health['healthy']}
- **不健康**: {dep_health['unhealthy']}

### 详细状态

| 依赖 | 服务 | 端点 | 健康状态 | 错误率 | P99延迟(ms) | 成功数 | 失败数 |
|------|------|------|----------|--------|-------------|--------|--------|
"""
        
        for dep in dep_health['dependencies']:
            health_status = "✅ 健康" if dep['is_healthy'] else "❌ 不健康"
            markdown += f"| {dep['dependency_key']} | {dep['service_name'] or '-'} | {dep['endpoint'] or '-'} | {health_status} | {dep['error_rate']:.2%} | {dep['latency_p99_ms']} | {dep['success_count']} | {dep['failure_count']} |\n"
        
        markdown += f"""

---

## 策略版本

### 版本列表

| 版本号 | 状态 | 灰度占比 | 描述 | 创建时间 |
|--------|------|----------|------|----------|
"""
        
        for version in policy_versions['versions']:
            status_emoji = {
                'draft': '📝',
                'active': '✅',
                'canary': '🐦',
                'rolled_back': '↩️'
            }.get(version['status'], '❓')
            
            markdown += f"| {version['version']} | {status_emoji} {version['status']} | {version['canary_percentage']}% | {version['description'] or '-'} | {version['created_at']} |\n"
        
        markdown += """

---

## 附录

### 决策类型说明
- `allow`: 请求被放行
- `rate_limited`: 请求被限流
- `circuit_breaker_open`: 熔断打开，请求被拒绝
- `circuit_breaker_half_open`: 半开状态测试请求
- `degraded`: 请求命中降级兜底

### 熔断状态说明
- `closed`: 正常状态，所有请求通过
- `open`: 熔断打开，所有请求被拒绝
- `half_open`: 半开状态，允许少量测试请求
"""
        
        return markdown
    
    def export_bad_samples_report(self) -> str:
        from models import RequestSample
        
        bad_samples = self.db.query(RequestSample).filter(
            RequestSample.is_bad_sample == True
        ).all()
        
        if not bad_samples:
            return "## 坏样例报告\n\n> 没有找到坏样例数据\n"
        
        markdown = f"""# 坏样例提示报告

> 生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

---

## 坏样例列表 ({len(bad_samples)} 个)

| 样例Key | 路由 | 方法 | 期望决策 | 提示 |
|----------|------|------|----------|------|
"""
        
        for sample in bad_samples:
            markdown += f"| {sample.sample_key} | {sample.route_key or '-'} | {sample.method} | {sample.expected_decision or '-'} | {sample.bad_sample_hint or '-'} |\n"
        
        markdown += f"""

---

## 详细信息

"""
        
        for i, sample in enumerate(bad_samples, 1):
            markdown += f"""### 样例 {i}: {sample.sample_key}

- **路由Key**: {sample.route_key or '-'}
- **路径**: {sample.path}
- **方法**: {sample.method}
- **期望决策**: {sample.expected_decision or '-'}
- **期望原因**: {sample.expected_reason or '-'}

**坏样例提示**:
```
{sample.bad_sample_hint or '无'}
```

**请求详情**:
- Headers: {json.dumps(sample.headers, ensure_ascii=False) if sample.headers else '-'}
- Query Params: {json.dumps(sample.query_params, ensure_ascii=False) if sample.query_params else '-'}
- Body: {sample.body or '-'}

---

"""
        
        return markdown
