import pandas as pd
from typing import List, Optional
from datetime import datetime
from io import BytesIO
from sqlalchemy.orm import Session

from app.models import ShardRebalancePlan, RebalanceStatus


class ExportService:
    def __init__(self, db: Session):
        self.db = db

    def _get_plan_data_for_export(self, plan: ShardRebalancePlan) -> dict:
        return {
            "计划编号": plan.plan_no,
            "源分片": plan.source_shard,
            "目标节点": plan.target_node,
            "目标分片": plan.target_shard or "",
            "租户数量": len(plan.tenant_distribution),
            "热点租户数量": plan.hot_tenant_count,
            "迁移流量(GB)": round(plan.migration_traffic_gb, 2),
            "预计时长(分钟)": plan.estimated_duration_min,
            "风险等级": plan.risk_level,
            "风险分数": plan.risk_score,
            "状态": plan.status,
            "创建人": plan.created_by,
            "创建时间": plan.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "更新时间": plan.updated_at.strftime("%Y-%m-%d %H:%M:%S") if plan.updated_at else "",
        }

    def export_plans_to_excel(
        self,
        plan_ids: Optional[List[int]] = None,
        status: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> BytesIO:
        query = self.db.query(ShardRebalancePlan)

        if plan_ids:
            query = query.filter(ShardRebalancePlan.id.in_(plan_ids))
        if status:
            query = query.filter(ShardRebalancePlan.status == status)
        if start_date:
            query = query.filter(ShardRebalancePlan.created_at >= start_date)
        if end_date:
            query = query.filter(ShardRebalancePlan.created_at <= end_date)

        plans = query.order_by(ShardRebalancePlan.created_at.desc()).all()

        if not plans:
            raise ValueError("没有符合条件的数据可导出")

        summary_data = [self._get_plan_data_for_export(p) for p in plans]
        summary_df = pd.DataFrame(summary_data)

        tenant_data = []
        for plan in plans:
            for tenant in plan.tenant_distribution:
                tenant_data.append(
                    {
                        "计划编号": plan.plan_no,
                        "租户ID": tenant.get("tenant_id", ""),
                        "租户名称": tenant.get("tenant_name", ""),
                        "数据大小(GB)": tenant.get("data_size_gb", 0),
                        "QPS": tenant.get("qps", ""),
                        "是否热点": tenant.get("is_hot", False),
                    }
                )
        tenant_df = pd.DataFrame(tenant_data)

        risk_details_data = []
        for plan in plans:
            if plan.risk_details and plan.risk_details.get("risk_factors"):
                for factor in plan.risk_details["risk_factors"]:
                    risk_details_data.append(
                        {
                            "计划编号": plan.plan_no,
                            "风险因素": factor.get("factor", ""),
                            "权重": factor.get("weight", 0),
                            "描述": factor.get("description", ""),
                        }
                    )
        risk_df = pd.DataFrame(risk_details_data)

        output = BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            summary_df.to_excel(writer, sheet_name="计划概览", index=False)
            tenant_df.to_excel(writer, sheet_name="租户详情", index=False)
            if not risk_df.empty:
                risk_df.to_excel(writer, sheet_name="风险详情", index=False)

        output.seek(0)
        return output

    def export_plans_summary(
        self,
        plan_ids: Optional[List[int]] = None,
        status: Optional[str] = None,
    ) -> dict:
        query = self.db.query(ShardRebalancePlan)

        if plan_ids:
            query = query.filter(ShardRebalancePlan.id.in_(plan_ids))
        if status:
            query = query.filter(ShardRebalancePlan.status == status)

        plans = query.all()

        if not plans:
            raise ValueError("没有符合条件的数据")

        total_plans = len(plans)
        total_traffic = sum(p.migration_traffic_gb for p in plans)
        hot_tenants_total = sum(p.hot_tenant_count for p in plans)

        status_distribution = {}
        risk_distribution = {"high": 0, "medium": 0, "low": 0}

        for plan in plans:
            status_distribution[plan.status] = (
                status_distribution.get(plan.status, 0) + 1
            )
            risk_distribution[plan.risk_level] += 1

        return {
            "total_plans": total_plans,
            "total_migration_traffic_gb": round(total_traffic, 2),
            "total_hot_tenants": hot_tenants_total,
            "average_risk_score": round(
                sum(p.risk_score for p in plans) / total_plans, 2
            ),
            "status_distribution": status_distribution,
            "risk_distribution": risk_distribution,
            "generated_at": datetime.now().isoformat(),
        }
