#!/usr/bin/env python3
import json
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Base, Tenant, UsageMetric, Incident, IncidentStatus, ClueSource
from app.services import create_incident, generate_incident_key
from app.schemas import IncidentCreate, TenantCreate

DATABASE_URL = "sqlite:///./usage_anomaly.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("数据库初始化完成")

def create_sample_tenants(db):
    tenants = [
        {"tenant_id": "tenant_001", "name": "阿里巴巴", "email": "admin@alibaba.com"},
        {"tenant_id": "tenant_002", "name": "腾讯科技", "email": "admin@tencent.com"},
        {"tenant_id": "tenant_003", "name": "字节跳动", "email": "admin@bytedance.com"},
    ]
    
    for t in tenants:
        tenant = Tenant(**t)
        db.add(tenant)
    db.commit()
    print(f"已创建 {len(tenants)} 个样例租户")

def create_sample_metrics(db):
    tenants = db.query(Tenant).all()
    metrics_data = []
    
    base_time = datetime.utcnow() - timedelta(hours=24)
    
    for tenant in tenants:
        for hour in range(24):
            timestamp = base_time + timedelta(hours=hour)
            base_value = 1000
            
            if hour >= 18 and hour <= 20 and tenant.tenant_id == "tenant_001":
                value = base_value * 3.5
            else:
                value = base_value * (0.9 + (hour % 5) * 0.1)
            
            metric = UsageMetric(
                tenant_id=tenant.id,
                metric_name="api_requests",
                metric_value=value,
                unit="requests",
                timestamp=timestamp,
                baseline_value=base_value,
                deviation_percent=((value - base_value) / base_value) * 100
            )
            metrics_data.append(metric)
    
    db.add_all(metrics_data)
    db.commit()
    print(f"已创建 {len(metrics_data)} 条用量指标数据")

def create_sample_incidents(db):
    window_start = datetime.utcnow() - timedelta(hours=6)
    window_end = datetime.utcnow() - timedelta(hours=4)
    
    incident1 = IncidentCreate(
        tenant=TenantCreate(tenant_id="tenant_001", name="阿里巴巴", email="admin@alibaba.com"),
        metric_name="api_requests",
        unit="requests",
        window_start=window_start,
        window_end=window_end,
        threshold_percent=50.0,
        title="API请求量异常暴涨",
        description="18:00-20:00期间API请求量较基线上涨250%",
        attribution_clues=[
            {
                "clue_key": "clue_001",
                "source": ClueSource.MONITORING,
                "title": "CDN流量异常",
                "description": "CDN带宽使用率达到95%",
                "confidence": 0.85,
                "raw_data": {"bandwidth": "95%", "threshold": "70%"}
            },
            {
                "clue_key": "clue_002",
                "source": ClueSource.LOG,
                "title": "异常IP访问",
                "description": "检测到来自192.168.1.0/24网段的大量请求",
                "confidence": 0.72,
                "raw_data": {"ip_range": "192.168.1.0/24", "request_count": 50000}
            }
        ]
    )
    
    original_input = json.dumps(incident1.model_dump(), default=str)
    incident = create_incident(db, incident1, original_input)
    print(f"已创建样例事故，ID: {incident.id}, Key: {incident.incident_key}")

def generate_sample_request():
    window_start = datetime.utcnow() - timedelta(hours=2)
    window_end = datetime.utcnow()
    
    sample_request = {
        "tenant": {
            "tenant_id": "tenant_004",
            "name": "京东科技",
            "email": "admin@jd.com"
        },
        "metric_name": "api_requests",
        "unit": "requests",
        "window_start": window_start.isoformat(),
        "window_end": window_end.isoformat(),
        "threshold_percent": 50.0,
        "title": "API调用量异常检测",
        "description": "过去2小时内API调用量出现异常波动",
        "attribution_clues": [
            {
                "clue_key": "marketing_campaign_2024",
                "source": "manual",
                "title": "营销活动流量",
                "description": "618营销活动带来的预期流量增长",
                "confidence": 0.95,
                "is_manual": True
            }
        ]
    }
    
    print("\n=== 样例API请求 ===")
    print(json.dumps(sample_request, indent=2, ensure_ascii=False))
    
    sample_request2 = {
        "severity": "high",
        "baseline_adjustment": 50.0,
        "comment": "运营反馈此期间有大促活动，基线需要上调",
        "reclaculate": True
    }
    print("\n=== 人工修正样例 ===")
    print(json.dumps(sample_request2, indent=2, ensure_ascii=False))
    
    return sample_request

if __name__ == "__main__":
    print("=" * 50)
    print("用量异常事故API - 样例数据初始化")
    print("=" * 50)
    
    db = SessionLocal()
    try:
        init_database()
        create_sample_tenants(db)
        create_sample_metrics(db)
        create_sample_incidents(db)
        generate_sample_request()
        
        print("\n" + "=" * 50)
        print("样例数据初始化完成！")
        print("数据库文件: usage_anomaly.db")
        print("=" * 50)
    finally:
        db.close()
