from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime
from typing import List, Optional
import hashlib
import json

from app.models.load_test import (
    LoadTestPlan, ConcurrencyStep, ResponsePercentile,
    ErrorDistribution, Bottleneck, TestReport
)
from app.schemas.load_test import (
    LoadTestPlanCreate, LoadTestPlanUpdate,
    ConcurrencyStepCreate, ResponsePercentileCreate,
    ErrorDistributionCreate, BottleneckCreate,
    StatusEnum
)

class LoadTestService:
    def __init__(self, db: Session):
        self.db = db
    
    def _generate_idempotent_key(self, plan_data: dict) -> str:
        data_str = json.dumps(plan_data, sort_keys=True)
        return hashlib.md5(data_str.encode()).hexdigest()
    
    def _check_duplicate_request(self, plan_data: dict) -> Optional[LoadTestPlan]:
        idempotent_key = self._generate_idempotent_key(plan_data)
        return self.db.query(LoadTestPlan).filter(
            LoadTestPlan.request_idempotent_key == idempotent_key
        ).first()
    
    def _determine_plan_status(self, plan: LoadTestPlan) -> str:
        has_anomalies = any(e.is_anomaly for e in plan.error_distributions)
        has_unconfirmed_bottlenecks = any(not b.is_confirmed for b in plan.bottlenecks)
        has_high_severity = any(b.severity == "high" for b in plan.bottlenecks)
        
        if has_anomalies:
            return StatusEnum.INTERCEPTED
        elif has_unconfirmed_bottlenecks or has_high_severity:
            return StatusEnum.PENDING_REVIEW
        elif plan.status == StatusEnum.DRAFT:
            return StatusEnum.RETRYABLE
        else:
            return StatusEnum.SUCCESS
    
    def create_plan(self, plan_create: LoadTestPlanCreate) -> dict:
        plan_data = plan_create.model_dump()
        
        existing_plan = self._check_duplicate_request({
            "name": plan_create.name,
            "version": plan_create.version,
            "api_url": plan_create.api_url
        })
        
        if existing_plan:
            return {
                "code": 409,
                "status": StatusEnum.INTERCEPTED,
                "message": "检测到重复请求，该压测计划已存在",
                "data": {"existing_plan_id": existing_plan.id,
                         "idempotent_key": existing_plan.request_idempotent_key
                }
            }
        
        concurrency_steps_data = plan_data.pop("concurrency_steps", [])
        response_percentile_data = plan_data.pop("response_percentiles", None)
        error_distributions_data = plan_data.pop("error_distributions", [])
        bottlenecks_data = plan_data.pop("bottlenecks", [])
        
        plan = LoadTestPlan(**plan_data)
        plan.request_idempotent_key = self._generate_idempotent_key({
            "name": plan_create.name,
            "version": plan_create.version,
            "api_url": plan_create.api_url
        })
        plan.status = StatusEnum.DRAFT
        
        self.db.add(plan)
        self.db.flush()
        
        for step_data in concurrency_steps_data:
            step = ConcurrencyStep(plan_id=plan.id, **step_data)
            self.db.add(step)
        
        if response_percentile_data:
            percentile = ResponsePercentile(plan_id=plan.id, **response_percentile_data)
            self.db.add(percentile)
        
        for error_data in error_distributions_data:
            error = ErrorDistribution(plan_id=plan.id, **error_data)
            self.db.add(error)
        
        for bottleneck_data in bottlenecks_data:
            bottleneck = Bottleneck(plan_id=plan.id, **bottleneck_data)
            self.db.add(bottleneck)
        
        self.db.commit()
        self.db.refresh(plan)
        
        plan.status = self._determine_plan_status(plan)
        self.db.commit()
        
        return {
            "code": 200,
            "status": plan.status,
            "message": "压测计划创建成功",
            "data": plan
        }
    
    def get_plans(
        self,
        skip: int = 0,
        limit: int = 100,
        version: Optional[str] = None,
        status: Optional[str] = None,
        api_name: Optional[str] = None,
        created_by: Optional[str] = None
    ) -> dict:
        query = self.db.query(LoadTestPlan)
        
        if version:
            query = query.filter(LoadTestPlan.version.contains(version))
        if status:
            query = query.filter(LoadTestPlan.status == status)
        if api_name:
            query = query.filter(LoadTestPlan.api_name.contains(api_name))
        if created_by:
            query = query.filter(LoadTestPlan.created_by.contains(created_by))
        
        total = query.count()
        plans = query.order_by(LoadTestPlan.created_at.desc()).offset(skip).limit(limit).all()
        
        return {
            "code": 200,
            "status": StatusEnum.SUCCESS,
            "message": "获取成功",
            "data": {"total": total, "items": plans}
        }
    
    def get_plan_by_id(self, plan_id: int) -> Optional[LoadTestPlan]:
        return self.db.query(LoadTestPlan).filter(LoadTestPlan.id == plan_id).first()
    
    def approve_plan(self, plan_id: int, approved_by: str) -> dict:
        plan = self.get_plan_by_id(plan_id)
        if not plan:
            return {
                "code": 404,
                "status": StatusEnum.INTERCEPTED,
                "message": "压测计划不存在",
                "data": None
            }
        
        plan.status = StatusEnum.APPROVED
        plan.approved_by = approved_by
        plan.approved_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(plan)
        
        return {
            "code": 200,
            "status": StatusEnum.SUCCESS,
            "message": "审批通过",
            "data": plan
        }
    
    def rollback_plan(self, plan_id: int, remark: str = None) -> dict:
        plan = self.get_plan_by_id(plan_id)
        if not plan:
            return {
                "code": 404,
                "status": StatusEnum.INTERCEPTED,
                "message": "压测计划不存在",
                "data": None
            }
        
        plan.status = StatusEnum.DRAFT
        plan.remark = remark or plan.remark
        plan.approved_by = None
        plan.approved_at = None
        self.db.commit()
        self.db.refresh(plan)
        
        return {
            "code": 200,
            "status": StatusEnum.SUCCESS,
            "message": "回滚成功",
            "data": plan
        }
    
    def retry_plan(self, plan_id: int) -> dict:
        plan = self.get_plan_by_id(plan_id)
        if not plan:
            return {
                "code": 404,
                "status": StatusEnum.INTERCEPTED,
                "message": "压测计划不存在",
                "data": None
            }
        
        new_plan_data = {
            "name": plan.name,
            "version": f"{plan.version}_retry_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "api_name": plan.api_name,
            "api_url": plan.api_url,
            "method": plan.method,
            "headers": plan.headers,
            "body": plan.body,
            "created_by": plan.created_by
        }
        
        plan_create = LoadTestPlanCreate(**new_plan_data)
        
        for step in plan.concurrency_steps:
            plan_create.concurrency_steps.append(
                ConcurrencyStepCreate(
                    step_order=step.step_order,
                    concurrent_users=step.concurrent_users,
                    duration_seconds=step.duration_seconds,
                    ramp_up_seconds=step.ramp_up_seconds,
                    target_qps=step.target_qps
                )
            )
        
        return self.create_plan(plan_create)
    
    def confirm_bottleneck(self, bottleneck_id: int, confirmed_by: str, suggestion: str = None) -> dict:
        bottleneck = self.db.query(Bottleneck).filter(Bottleneck.id == bottleneck_id).first()
        if not bottleneck:
            return {
                "code": 404,
                "status": StatusEnum.INTERCEPTED,
                "message": "瓶颈记录不存在",
                "data": None
            }
        
        bottleneck.is_confirmed = True
        bottleneck.confirmed_by = confirmed_by
        bottleneck.confirmed_at = datetime.utcnow()
        bottleneck.suggestion = suggestion or bottleneck.suggestion
        self.db.commit()
        
        plan = self.get_plan_by_id(bottleneck.plan_id)
        if plan:
            plan.status = self._determine_plan_status(plan)
            self.db.commit()
        
        return {
            "code": 200,
            "status": StatusEnum.SUCCESS,
            "message": "瓶颈确认成功",
            "data": bottleneck
        }
    
    def mark_error_anomaly(self, error_id: int, is_anomaly: bool, anomaly_reason: str = None) -> dict:
        error = self.db.query(ErrorDistribution).filter(ErrorDistribution.id == error_id).first()
        if not error:
            return {
                "code": 404,
                "status": StatusEnum.INTERCEPTED,
                "message": "错误记录不存在",
                "data": None
            }
        
        error.is_anomaly = is_anomaly
        error.anomaly_reason = anomaly_reason
        self.db.commit()
        
        plan = self.get_plan_by_id(error.plan_id)
        if plan:
            plan.status = self._determine_plan_status(plan)
            self.db.commit()
        
        return {
            "code": 200,
            "status": StatusEnum.SUCCESS,
            "message": "异常标记成功",
            "data": error
        }
    
    def export_plan(self, plan_id: int) -> dict:
        plan = self.get_plan_by_id(plan_id)
        if not plan:
            return {
                "code": 404,
                "status": StatusEnum.INTERCEPTED,
                "message": "压测计划不存在",
                "data": None
            }
        
        export_data = {
            "basic_info": {
                "id": plan.id,
                "name": plan.name,
                "version": plan.version,
                "api_name": plan.api_name,
                "api_url": plan.api_url,
                "method": plan.method,
                "status": plan.status,
                "created_by": plan.created_by,
                "created_at": plan.created_at.isoformat(),
                "approved_by": plan.approved_by,
                "approved_at": plan.approved_at.isoformat() if plan.approved_at else None
            },
            "concurrency_steps": [
                {
                    "step_order": s.step_order,
                    "concurrent_users": s.concurrent_users,
                    "duration_seconds": s.duration_seconds,
                    "ramp_up_seconds": s.ramp_up_seconds,
                    "target_qps": s.target_qps,
                    "actual_qps": s.actual_qps
                } for s in plan.concurrency_steps
            ],
            "response_percentiles": [
                {
                    "p50": p.p50,
                    "p75": p.p75,
                    "p90": p.p90,
                    "p95": p.p95,
                    "p99": p.p99,
                    "p999": p.p999,
                    "avg_response_time": p.avg_response_time,
                    "total_requests": p.total_requests,
                    "success_requests": p.success_requests,
                    "failed_requests": p.failed_requests
                } for p in plan.response_percentiles
            ],
            "error_distributions": [
                {
                    "error_type": e.error_type,
                    "error_code": e.error_code,
                    "error_message": e.error_message,
                    "count": e.count,
                    "percentage": e.percentage,
                    "is_anomaly": e.is_anomaly,
                    "anomaly_reason": e.anomaly_reason
                } for e in plan.error_distributions
            ],
            "bottlenecks": [
                {
                    "bottleneck_type": b.bottleneck_type,
                    "description": b.description,
                    "severity": b.severity,
                    "is_confirmed": b.is_confirmed,
                    "confirmed_by": b.confirmed_by,
                    "suggestion": b.suggestion
                } for b in plan.bottlenecks
            ]
        }
        
        return {
            "code": 200,
            "status": StatusEnum.SUCCESS,
            "message": "导出成功",
            "data": export_data
        }
    
    def update_plan(self, plan_id: int, plan_update: LoadTestPlanUpdate) -> dict:
        plan = self.get_plan_by_id(plan_id)
        if not plan:
            return {
                "code": 404,
                "status": StatusEnum.INTERCEPTED,
                "message": "压测计划不存在",
                "data": None
            }
        
        update_data = plan_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(plan, field, value)
        
        plan.status = self._determine_plan_status(plan)
        self.db.commit()
        self.db.refresh(plan)
        
        return {
            "code": 200,
            "status": StatusEnum.SUCCESS,
            "message": "更新成功",
            "data": plan
        }