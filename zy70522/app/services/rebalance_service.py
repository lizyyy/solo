import uuid
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.models import (
    ShardRebalancePlan,
    ApprovalRecord,
    ExecutionSummary,
    ManualCorrection,
    FailureRecord,
    RebalanceStatus,
)
from app.schemas.schemas import (
    RebalancePlanCreate,
    TenantDistribution,
    ApprovalAction,
)


class RebalanceService:
    HOT_QPS_THRESHOLD = 1000
    HIGH_RISK_SCORE = 80
    MEDIUM_RISK_SCORE = 50
    MIGRATION_SPEED_MB_PER_MIN = 50 * 1024

    def __init__(self, db: Session):
        self.db = db

    def identify_hot_tenants(
        self, tenants: List[TenantDistribution]
    ) -> List[Dict[str, Any]]:
        hot_tenants = []
        for tenant in tenants:
            is_hot = tenant.is_hot or (
                tenant.qps is not None and tenant.qps >= self.HOT_QPS_THRESHOLD
            )
            if is_hot:
                hot_tenants.append(
                    {
                        "tenant_id": tenant.tenant_id,
                        "tenant_name": tenant.tenant_name,
                        "data_size_gb": tenant.data_size_gb,
                        "qps": tenant.qps,
                    }
                )
        return hot_tenants

    def calculate_migration_traffic(
        self, tenants: List[TenantDistribution]
    ) -> float:
        return sum(tenant.data_size_gb for tenant in tenants)

    def estimate_duration(self, traffic_gb: float) -> int:
        traffic_mb = traffic_gb * 1024
        minutes = int(traffic_mb / (self.MIGRATION_SPEED_MB_PER_MIN / 1024))
        return max(1, minutes)

    def assess_risk(
        self, hot_tenants: List[Dict[str, Any]], traffic_gb: float
    ) -> Dict[str, Any]:
        hot_count = len(hot_tenants)
        risk_score = 0.0

        risk_factors = []

        if hot_count > 0:
            hot_risk = min(hot_count * 20, 50)
            risk_score += hot_risk
            risk_factors.append(
                {
                    "factor": "hot_tenants",
                    "weight": hot_risk,
                    "description": f"检测到 {hot_count} 个热点租户",
                }
            )

        if traffic_gb > 100:
            traffic_risk = 30
            risk_score += traffic_risk
            risk_factors.append(
                {
                    "factor": "large_traffic",
                    "weight": traffic_risk,
                    "description": f"迁移流量过大: {traffic_gb:.2f} GB",
                }
            )
        elif traffic_gb > 50:
            traffic_risk = 15
            risk_score += traffic_risk
            risk_factors.append(
                {
                    "factor": "medium_traffic",
                    "weight": traffic_risk,
                    "description": f"迁移流量中等: {traffic_gb:.2f} GB",
                }
            )

        if risk_score >= self.HIGH_RISK_SCORE:
            risk_level = "high"
        elif risk_score >= self.MEDIUM_RISK_SCORE:
            risk_level = "medium"
        else:
            risk_level = "low"

        return {
            "risk_level": risk_level,
            "risk_score": risk_score,
            "risk_details": {
                "risk_factors": risk_factors,
                "recommendation": self._get_recommendation(risk_level, hot_count),
            },
        }

    def _get_recommendation(self, risk_level: str, hot_count: int) -> str:
        if risk_level == "high":
            return "高风险: 建议在业务低峰期执行，准备回滚方案，通知相关租户"
        elif risk_level == "medium":
            return "中风险: 建议监控执行过程，准备应急预案"
        else:
            return "低风险: 可正常执行，建议常规监控"

    def generate_plan_no(self) -> str:
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        suffix = str(uuid.uuid4())[:8].upper()
        return f"RBL-{timestamp}-{suffix}"

    def create_plan(self, plan_data: RebalancePlanCreate) -> ShardRebalancePlan:
        existing = (
            self.db.query(ShardRebalancePlan)
            .filter(
                ShardRebalancePlan.source_shard == plan_data.source_shard,
                ShardRebalancePlan.target_node == plan_data.target_node,
                ShardRebalancePlan.status.in_(
                    [
                        RebalanceStatus.DRAFT.value,
                        RebalanceStatus.PENDING_APPROVAL.value,
                        RebalanceStatus.APPROVED.value,
                        RebalanceStatus.EXECUTING.value,
                    ]
                ),
            )
            .first()
        )

        if existing:
            raise ValueError(
                f"该分片 {plan_data.source_shard} 到节点 {plan_data.target_node} 的迁移计划已存在 (状态: {existing.status})"
            )

        tenants = plan_data.tenant_distribution
        hot_tenants = self.identify_hot_tenants(tenants)
        migration_traffic = self.calculate_migration_traffic(tenants)
        estimated_duration = self.estimate_duration(migration_traffic)
        risk_assessment = self.assess_risk(hot_tenants, migration_traffic)

        processing_logic = f"""
        热点识别规则: QPS >= {self.HOT_QPS_THRESHOLD} 或标记为热点的租户
        迁移速度假设: {self.MIGRATION_SPEED_MB_PER_MIN / 1024:.2f} GB/min
        风险评估: 热点租户({len(hot_tenants)}个) + 流量({migration_traffic:.2f}GB) = {risk_assessment['risk_score']}分
        """

        plan = ShardRebalancePlan(
            plan_no=self.generate_plan_no(),
            source_shard=plan_data.source_shard,
            target_node=plan_data.target_node,
            target_shard=plan_data.target_shard,
            tenant_distribution=[t.dict() for t in tenants],
            migration_traffic_gb=migration_traffic,
            estimated_duration_min=estimated_duration,
            hot_tenant_count=len(hot_tenants),
            hot_tenants=hot_tenants,
            risk_level=risk_assessment["risk_level"],
            risk_score=risk_assessment["risk_score"],
            risk_details=risk_assessment["risk_details"],
            status=RebalanceStatus.DRAFT.value,
            created_by=plan_data.created_by,
            raw_input=plan_data.dict(),
            processing_logic=processing_logic.strip(),
        )

        self.db.add(plan)
        self.db.commit()
        self.db.refresh(plan)
        return plan

    def get_plan(self, plan_id: int) -> Optional[ShardRebalancePlan]:
        return self.db.query(ShardRebalancePlan).filter(ShardRebalancePlan.id == plan_id).first()

    def list_plans(
        self,
        status: Optional[str] = None,
        source_shard: Optional[str] = None,
        created_by: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ):
        query = self.db.query(ShardRebalancePlan)

        if status:
            query = query.filter(ShardRebalancePlan.status == status)
        if source_shard:
            query = query.filter(ShardRebalancePlan.source_shard == source_shard)
        if created_by:
            query = query.filter(ShardRebalancePlan.created_by == created_by)

        total = query.count()
        items = query.order_by(ShardRebalancePlan.created_at.desc()).offset(
            (page - 1) * page_size
        ).limit(page_size).all()

        return {"total": total, "items": items, "page": page, "page_size": page_size}

    def process_approval(
        self, plan_id: int, approver: str, action: ApprovalAction, comments: Optional[str] = None
    ) -> ShardRebalancePlan:
        plan = self.get_plan(plan_id)
        if not plan:
            raise ValueError(f"计划 {plan_id} 不存在")

        if action == ApprovalAction.SUBMIT:
            if plan.status != RebalanceStatus.DRAFT.value:
                raise ValueError(f"只有草稿状态可以提交审批，当前状态: {plan.status}")
            new_status = RebalanceStatus.PENDING_APPROVAL.value
        elif action == ApprovalAction.APPROVE:
            if plan.status != RebalanceStatus.PENDING_APPROVAL.value:
                raise ValueError(f"只有待审批状态可以批准，当前状态: {plan.status}")
            new_status = RebalanceStatus.APPROVED.value
        elif action == ApprovalAction.REJECT:
            if plan.status != RebalanceStatus.PENDING_APPROVAL.value:
                raise ValueError(f"只有待审批状态可以拒绝，当前状态: {plan.status}")
            new_status = RebalanceStatus.REJECTED.value
        else:
            raise ValueError(f"不支持的审批操作: {action}")

        approval = ApprovalRecord(
            plan_id=plan_id,
            approver=approver,
            approval_action=action.value,
            comments=comments,
        )
        self.db.add(approval)

        plan.status = new_status
        self.db.commit()
        self.db.refresh(plan)
        return plan

    def update_status(
        self, plan_id: int, new_status: RebalanceStatus, operator: str, reason: Optional[str] = None
    ) -> ShardRebalancePlan:
        plan = self.get_plan(plan_id)
        if not plan:
            raise ValueError(f"计划 {plan_id} 不存在")

        valid_transitions = {
            RebalanceStatus.DRAFT.value: [RebalanceStatus.PENDING_APPROVAL.value],
            RebalanceStatus.PENDING_APPROVAL.value: [
                RebalanceStatus.APPROVED.value,
                RebalanceStatus.REJECTED.value,
            ],
            RebalanceStatus.APPROVED.value: [
                RebalanceStatus.EXECUTING.value,
                RebalanceStatus.NEEDS_CORRECTION.value,
            ],
            RebalanceStatus.EXECUTING.value: [
                RebalanceStatus.COMPLETED.value,
                RebalanceStatus.FAILED.value,
            ],
            RebalanceStatus.NEEDS_CORRECTION.value: [
                RebalanceStatus.DRAFT.value,
                RebalanceStatus.PENDING_APPROVAL.value,
            ],
            RebalanceStatus.FAILED.value: [
                RebalanceStatus.DRAFT.value,
                RebalanceStatus.NEEDS_CORRECTION.value,
            ],
        }

        if new_status.value not in valid_transitions.get(plan.status, []):
            raise ValueError(
                f"不支持的状态转换: {plan.status} -> {new_status.value}"
            )

        plan.status = new_status.value
        self.db.commit()
        self.db.refresh(plan)
        return plan

    def record_execution_result(
        self,
        plan_id: int,
        success: bool,
        actual_traffic_gb: Optional[float] = None,
        execution_details: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None,
    ) -> ExecutionSummary:
        plan = self.get_plan(plan_id)
        if not plan:
            raise ValueError(f"计划 {plan_id} 不存在")

        if plan.status != RebalanceStatus.EXECUTING.value:
            raise ValueError(f"只有执行中状态可以记录结果，当前状态: {plan.status}")

        summary = ExecutionSummary(
            plan_id=plan_id,
            actual_start_time=datetime.now(),
            actual_end_time=datetime.now(),
            actual_traffic_gb=actual_traffic_gb,
            success=success,
            execution_details=execution_details,
            error_message=error_message,
        )
        self.db.add(summary)

        if success:
            plan.status = RebalanceStatus.COMPLETED.value
        else:
            plan.status = RebalanceStatus.FAILED.value

        self.db.commit()
        self.db.refresh(summary)
        return summary

    def record_failure(
        self,
        plan_id: int,
        failed_step: str,
        raw_input_snapshot: Dict[str, Any],
        processing_evidence: Dict[str, Any],
        final_conclusion: str,
        error_details: Optional[str] = None,
    ) -> FailureRecord:
        failure = FailureRecord(
            plan_id=plan_id,
            failed_step=failed_step,
            raw_input_snapshot=raw_input_snapshot,
            processing_evidence=processing_evidence,
            final_conclusion=final_conclusion,
            error_details=error_details,
        )
        self.db.add(failure)

        plan = self.get_plan(plan_id)
        if plan:
            plan.status = RebalanceStatus.FAILED.value

        self.db.commit()
        self.db.refresh(failure)
        return failure

    def apply_manual_correction(
        self,
        plan_id: int,
        corrected_by: str,
        corrected_values: Dict[str, Any],
        correction_reason: str,
    ) -> ShardRebalancePlan:
        plan = self.get_plan(plan_id)
        if not plan:
            raise ValueError(f"计划 {plan_id} 不存在")

        if plan.status not in [
            RebalanceStatus.DRAFT.value,
            RebalanceStatus.NEEDS_CORRECTION.value,
            RebalanceStatus.FAILED.value,
        ]:
            raise ValueError(f"当前状态 {plan.status} 不允许人工修正")

        original_values = {}
        for key, value in corrected_values.items():
            if hasattr(plan, key):
                original_values[key] = getattr(plan, key)
                setattr(plan, key, value)

        if "tenant_distribution" in corrected_values:
            tenant_dicts = corrected_values["tenant_distribution"]
            tenants = [TenantDistribution(**t) for t in tenant_dicts]
            hot_tenants = self.identify_hot_tenants(tenants)
            migration_traffic = self.calculate_migration_traffic(tenants)
            estimated_duration = self.estimate_duration(migration_traffic)
            risk_assessment = self.assess_risk(hot_tenants, migration_traffic)

            plan.tenant_distribution = tenant_dicts
            plan.hot_tenants = hot_tenants
            plan.hot_tenant_count = len(hot_tenants)
            plan.migration_traffic_gb = migration_traffic
            plan.estimated_duration_min = estimated_duration
            plan.risk_level = risk_assessment["risk_level"]
            plan.risk_score = risk_assessment["risk_score"]
            plan.risk_details = risk_assessment["risk_details"]

        correction = ManualCorrection(
            plan_id=plan_id,
            corrected_by=corrected_by,
            original_values=original_values,
            corrected_values=corrected_values,
            correction_reason=correction_reason,
            recalculated_plan={
                "hot_tenant_count": plan.hot_tenant_count,
                "migration_traffic_gb": plan.migration_traffic_gb,
                "risk_level": plan.risk_level,
                "risk_score": plan.risk_score,
            },
        )
        self.db.add(correction)

        plan.status = RebalanceStatus.DRAFT.value
        self.db.commit()
        self.db.refresh(plan)
        return plan

    def get_approvals(self, plan_id: int) -> List[ApprovalRecord]:
        return (
            self.db.query(ApprovalRecord)
            .filter(ApprovalRecord.plan_id == plan_id)
            .order_by(ApprovalRecord.approved_at.desc())
            .all()
        )

    def get_executions(self, plan_id: int) -> List[ExecutionSummary]:
        return (
            self.db.query(ExecutionSummary)
            .filter(ExecutionSummary.plan_id == plan_id)
            .order_by(ExecutionSummary.created_at.desc())
            .all()
        )

    def get_failures(self, plan_id: int) -> List[FailureRecord]:
        return (
            self.db.query(FailureRecord)
            .filter(FailureRecord.plan_id == plan_id)
            .order_by(FailureRecord.failed_at.desc())
            .all()
        )
