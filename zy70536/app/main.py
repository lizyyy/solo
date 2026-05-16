import uuid
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import JSONResponse

from .models import (
    ChangeOrder, ChangeStatus, RiskScore, ReviewConclusion,
    CreateChangeOrderRequest, UpdateStatusRequest, ManualCorrectionRequest,
    ErrorResponse, RiskLevel
)
from .audit_engine import SQLAuditEngine

app = FastAPI(title="SQL变更审核API", version="1.0.0")

change_orders: Dict[str, ChangeOrder] = {}
audit_engine = SQLAuditEngine()


def create_error_response(error_code: str, error_message: str,
                          details: Dict[str, Any] = None, suggestion: str = "") -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content=ErrorResponse(
            error_code=error_code,
            error_message=error_message,
            details=details or {},
            suggestion=suggestion
        ).dict()
    )


@app.post("/api/change-orders", response_model=ChangeOrder, status_code=201)
async def create_change_order(request: CreateChangeOrderRequest):
    order_id = str(uuid.uuid4())[:12]
    now = datetime.utcnow()

    if not request.sql_contents:
        return create_error_response(
            "EMPTY_SQL",
            "SQL内容不能为空",
            suggestion="请提供至少一条SQL语句"
        )

    if request.rollback_scripts and len(request.rollback_scripts) != len(request.sql_contents):
        return create_error_response(
            "ROLLBACK_MISMATCH",
            "回滚脚本数量与SQL数量不匹配",
            {"sql_count": len(request.sql_contents), "rollback_count": len(request.rollback_scripts)},
            "请为每条SQL提供对应的回滚脚本，或不提供回滚脚本"
        )

    processing_steps = []
    all_errors = []
    sql_snippets = []

    for idx, sql_content in enumerate(request.sql_contents):
        rollback_script = request.rollback_scripts[idx] if request.rollback_scripts else None

        processing_steps.append({
            "step": f"audit_sql_{idx}",
            "action": "审核SQL片段",
            "timestamp": now.isoformat(),
            "sql_preview": sql_content[:100]
        })

        snippet = audit_engine.audit_snippet(sql_content, rollback_script)
        sql_snippets.append(snippet)

        if snippet.parse_errors:
            all_errors.extend(snippet.parse_errors)

    total_risk = RiskScore()
    for snippet in sql_snippets:
        snippet_risk = audit_engine.calculate_risk_score(snippet)
        total_risk.total_score += snippet_risk.total_score
        total_risk.impact_score += snippet_risk.impact_score
        total_risk.lock_score += snippet_risk.lock_score
        total_risk.rollback_score += snippet_risk.rollback_score
        total_risk.risk_factors.extend(snippet_risk.risk_factors)

    if total_risk.total_score >= 70:
        total_risk.risk_level = RiskLevel.CRITICAL
    elif total_risk.total_score >= 50:
        total_risk.risk_level = RiskLevel.HIGH
    elif total_risk.total_score >= 30:
        total_risk.risk_level = RiskLevel.MEDIUM

    if all_errors:
        status = ChangeStatus.FAILED
        final_conclusion = "审核失败：存在SQL解析或回滚校验错误"
    elif total_risk.risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]:
        status = ChangeStatus.MANUAL_REVIEW_REQUIRED
        final_conclusion = f"需要人工审核：风险等级{total_risk.risk_level.value}"
    elif total_risk.risk_level == RiskLevel.MEDIUM:
        status = ChangeStatus.PENDING_REVIEW
        final_conclusion = "待审核：中等风险"
    else:
        status = ChangeStatus.AUTO_APPROVED
        final_conclusion = "自动审核通过：低风险"

    processing_trace = audit_engine.create_processing_trace(
        original_input=json.dumps(request.dict(), ensure_ascii=False),
        steps=processing_steps,
        final_conclusion=final_conclusion,
        errors=all_errors
    )

    change_order = ChangeOrder(
        id=order_id,
        title=request.title,
        description=request.description,
        creator=request.creator,
        created_at=now,
        updated_at=now,
        status=status,
        sql_snippets=sql_snippets,
        risk_score=total_risk,
        processing_trace=processing_trace,
        is_dry_run=request.is_dry_run,
        tags=request.tags
    )

    change_orders[order_id] = change_order
    return change_order


@app.get("/api/change-orders", response_model=List[ChangeOrder])
async def list_change_orders(status: Optional[ChangeStatus] = None, creator: Optional[str] = None):
    result = list(change_orders.values())

    if status:
        result = [o for o in result if o.status == status]
    if creator:
        result = [o for o in result if o.creator == creator]

    return sorted(result, key=lambda x: x.created_at, reverse=True)


@app.get("/api/change-orders/{order_id}", response_model=ChangeOrder)
async def get_change_order(order_id: str):
    if order_id not in change_orders:
        return create_error_response(
            "NOT_FOUND",
            f"变更单 {order_id} 不存在",
            suggestion="请检查变更单ID是否正确"
        )
    return change_orders[order_id]


@app.patch("/api/change-orders/{order_id}/status", response_model=ChangeOrder)
async def update_change_order_status(order_id: str, request: UpdateStatusRequest):
    if order_id not in change_orders:
        return create_error_response(
            "NOT_FOUND",
            f"变更单 {order_id} 不存在",
            suggestion="请检查变更单ID是否正确"
        )

    order = change_orders[order_id]
    now = datetime.utcnow()

    valid_transitions = {
        ChangeStatus.CREATED: [ChangeStatus.PENDING_REVIEW, ChangeStatus.FAILED],
        ChangeStatus.PENDING_REVIEW: [ChangeStatus.MANUAL_REVIEW_REQUIRED, ChangeStatus.APPROVED, ChangeStatus.REJECTED],
        ChangeStatus.MANUAL_REVIEW_REQUIRED: [ChangeStatus.APPROVED, ChangeStatus.REJECTED],
        ChangeStatus.AUTO_APPROVED: [ChangeStatus.APPROVED, ChangeStatus.REJECTED, ChangeStatus.EXECUTED],
        ChangeStatus.APPROVED: [ChangeStatus.EXECUTED, ChangeStatus.ROLLBACK_REQUIRED],
        ChangeStatus.EXECUTED: [ChangeStatus.ROLLBACK_REQUIRED],
        ChangeStatus.FAILED: [ChangeStatus.PENDING_REVIEW],
    }

    current_status = order.status
    if not request.manual_override and request.status not in valid_transitions.get(current_status, []):
        return create_error_response(
            "INVALID_STATUS_TRANSITION",
            f"不允许从 {current_status.value} 变更到 {request.status.value}",
            {"current_status": current_status.value, "requested_status": request.status.value},
            f"有效的目标状态: {', '.join(s.value for s in valid_transitions.get(current_status, []))}"
        )

    order.status = request.status
    order.updated_at = now

    if request.status in [ChangeStatus.APPROVED, ChangeStatus.REJECTED]:
        order.review_conclusion = ReviewConclusion(
            reviewer=request.operator,
            reviewed_at=now,
            approved=(request.status == ChangeStatus.APPROVED),
            comments=request.comments,
            decision_basis=[
                f"操作人: {request.operator}",
                f"原状态: {current_status.value}",
                f"新状态: {request.status.value}"
            ]
        )

    return order


@app.post("/api/change-orders/{order_id}/correct", response_model=ChangeOrder)
async def manual_correction(order_id: str, request: ManualCorrectionRequest):
    if order_id not in change_orders:
        return create_error_response(
            "NOT_FOUND",
            f"变更单 {order_id} 不存在",
            suggestion="请检查变更单ID是否正确"
        )

    order = change_orders[order_id]
    now = datetime.utcnow()

    snippet = next((s for s in order.sql_snippets if s.id == request.snippet_id), None)
    if not snippet:
        return create_error_response(
            "SNIPPET_NOT_FOUND",
            f"SQL片段 {request.snippet_id} 不存在",
            {"order_id": order_id, "snippet_id": request.snippet_id},
            "请检查SQL片段ID是否正确"
        )

    corrected_snippet = audit_engine.audit_snippet(request.corrected_sql, request.corrected_rollback)
    corrected_snippet.id = snippet.id

    idx = order.sql_snippets.index(snippet)
    order.sql_snippets[idx] = corrected_snippet

    new_risk = RiskScore()
    for s in order.sql_snippets:
        snippet_risk = audit_engine.calculate_risk_score(s)
        new_risk.total_score += snippet_risk.total_score
        new_risk.impact_score += snippet_risk.impact_score
        new_risk.lock_score += snippet_risk.lock_score
        new_risk.rollback_score += snippet_risk.rollback_score
        new_risk.risk_factors.extend(snippet_risk.risk_factors)

    if new_risk.total_score >= 70:
        new_risk.risk_level = RiskLevel.CRITICAL
    elif new_risk.total_score >= 50:
        new_risk.risk_level = RiskLevel.HIGH
    elif new_risk.total_score >= 30:
        new_risk.risk_level = RiskLevel.MEDIUM
    else:
        new_risk.risk_level = RiskLevel.LOW

    order.risk_score = new_risk
    order.updated_at = now
    order.status = ChangeStatus.PENDING_REVIEW

    if order.processing_trace:
        order.processing_trace.processing_steps.append({
            "step": "manual_correction",
            "action": "人工修正SQL",
            "corrector": request.corrector,
            "reason": request.reason,
            "snippet_id": request.snippet_id,
            "timestamp": now.isoformat()
        })

    return order


@app.get("/api/change-orders/{order_id}/export")
async def export_change_order(order_id: str, format: str = "json"):
    if order_id not in change_orders:
        return create_error_response(
            "NOT_FOUND",
            f"变更单 {order_id} 不存在",
            suggestion="请检查变更单ID是否正确"
        )

    order = change_orders[order_id]

    if format == "json":
        content = json.dumps(order.dict(), indent=2, ensure_ascii=False, default=str)
        return Response(
            content=content,
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=change-order-{order_id}.json"}
        )
    elif format == "text":
        lines = [
            "=" * 60,
            f"SQL变更审核报告 - {order.id}",
            "=" * 60,
            f"标题: {order.title}",
            f"创建人: {order.creator}",
            f"创建时间: {order.created_at}",
            f"状态: {order.status.value}",
            f"风险等级: {order.risk_score.risk_level.value}",
            f"风险评分: {order.risk_score.total_score}",
            f"风险因素: {', '.join(order.risk_score.risk_factors) if order.risk_score.risk_factors else '无'}",
            "",
            "-" * 60,
            "SQL 片段详情:",
            "-" * 60,
        ]

        for snippet in order.sql_snippets:
            lines.extend([
                f"\n【SQL {snippet.id}】",
                f"类型: {snippet.sql_type.value}",
                f"影响行数预估: {snippet.estimated_impacted_rows}",
                f"锁风险评分: {snippet.lock_risk_score}",
                f"锁风险原因: {snippet.lock_risk_reason or '无'}",
                f"回滚脚本: {'已提供' if snippet.has_rollback else '未提供'}",
                f"目标表: {', '.join(t.table_name for t in snippet.target_tables)}",
                "\nSQL内容:",
                snippet.sql_content,
            ])
            if snippet.warnings:
                lines.append("\n警告:")
                for w in snippet.warnings:
                    lines.append(f"  - {w}")
            if snippet.parse_errors:
                lines.append("\n错误:")
                for e in snippet.parse_errors:
                    lines.append(f"  - {e}")
            lines.append("\n" + "-" * 60)

        if order.review_conclusion:
            lines.extend([
                "\n审核结论:",
                f"  审核人: {order.review_conclusion.reviewer}",
                f"  审核时间: {order.review_conclusion.reviewed_at}",
                f"  结果: {'通过' if order.review_conclusion.approved else '拒绝'}",
                f"  备注: {order.review_conclusion.comments}",
            ])

        content = "\n".join(lines)
        return Response(
            content=content,
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename=change-order-{order_id}.txt"}
        )
    else:
        return create_error_response(
            "INVALID_FORMAT",
            f"不支持的导出格式: {format}",
            {"supported_formats": ["json", "text"]},
            "请使用支持的导出格式"
        )


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}
