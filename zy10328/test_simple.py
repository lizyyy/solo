#!/usr/bin/env python3
"""简单测试风险标注修复"""
import sys
sys.path.insert(0, '.')

from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import json

from app.models.base import Base
from app.models.schema import EntryAPI, DownstreamService, CallSample
from app.services.profile_service import process_samples, is_sensitive_path

# 创建内存数据库
engine = create_engine("sqlite:///:memory:")
Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

print("=" * 60)
print("测试 1: 高风险场景风险标注")
print("=" * 60)

# 创建高风险画像
entry_api = EntryAPI(
    id="high-risk-test-001",
    name="推荐商品接口",
    method="GET",
    path="/api/v1/recommendations",
    description="个性化推荐",
    status="CREATED"
)
db.add(entry_api)

# 创建3个下游服务
for i, svc_name in enumerate(["user_behavior_db", "recommendation_engine", "product_catalog"]):
    svc = DownstreamService(
        id=f"svc-{i}",
        entry_api_id="high-risk-test-001",
        service_name=svc_name,
        service_type="database" if i == 0 else "grpc",
        cache_key=None,
        cache_ttl=None
    )
    db.add(svc)

# 创建10个样本，50%失败率
for i in range(1, 11):
    status = "FAILED" if i % 2 == 0 else "SUCCESS"
    sample = CallSample(
        id=f"sample-{i}",
        entry_api_id="high-risk-test-001",
        trace_id=f"trace-{i}-{datetime.utcnow().timestamp()}",
        request_id=f"req-{i}",
        user_id=f"user-{i}",
        timestamp=datetime.utcnow() - timedelta(minutes=i),
        status=status,
        total_latency=4500.0 if i % 2 == 0 else 2500.0,
        downstream_calls=[
            {"service_name": "user_behavior_db", "latency": 800 + i * 50, "status": "SUCCESS"},
            {"service_name": "recommendation_engine", "latency": 3500 if i % 2 == 0 else 1500, "status": status},
            {"service_name": "product_catalog", "latency": 200, "status": "SUCCESS"}
        ]
    )
    db.add(sample)

db.commit()
print("✓ 测试数据创建完成")

# 状态推进到 AGGREGATING
entry_api.status = "AGGREGATING"
db.commit()

# 执行聚合
process_samples(db, "high-risk-test-001")

# 获取结果
entry_api = db.query(EntryAPI).filter_by(id="high-risk-test-001").first()
services = db.query(DownstreamService).filter_by(entry_api_id="high-risk-test-001").all()

print(f"\n聚合结果:")
print(f"  风险等级: {entry_api.risk_level}")
print(f"  风险描述: {entry_api.risk_description}")
print(f"\n各服务风险详情:")
for svc in services:
    print(f"  {svc.service_name}: {svc.risk_level} (失败率: {svc.failure_count}/{svc.call_count}, P99: {svc.p99_latency}ms)")

print(f"\n期望: CRITICAL")
print(f"实际: {entry_api.risk_level}")
if entry_api.risk_level == "CRITICAL":
    print("✓ 风险标注正确!")
else:
    print("✗ 风险标注不正确!")

print("\n" + "=" * 60)
print("测试 2: 敏感路径检测")
print("=" * 60)

# 测试敏感路径
test_cases = [
    ("DELETE", "/api/v1/users/{id}/data", True),
    ("DELETE", "/api/v1/delete-account", True),
    ("POST", "/api/v1/admin/reset-all", True),
    ("GET", "/api/v1/users/{id}", False),
    ("POST", "/api/v1/orders", False),
]

all_pass = True
for method, path, expected in test_cases:
    actual = is_sensitive_path(method, path)
    status = "✓" if actual == expected else "✗"
    if actual != expected:
        all_pass = False
    print(f"  {status} {method} {path}: {actual} (期望: {expected})")

if all_pass:
    print("\n✓ 敏感路径检测全部正确!")
else:
    print("\n✗ 敏感路径检测有错误!")

db.close()
