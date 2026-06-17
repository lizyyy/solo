from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from app import models
from app.schemas import (
    SurveyPlanSubmit,
    CadLayerIn,
    CollisionPointIn,
    ManualJudgmentIn,
)
from app.utils.validators import compute_idempotency_hash, validate_layer_name, normalize_layer_name


def check_idempotency(db: Session, payload: SurveyPlanSubmit) -> Optional[models.SurveyPlan]:
    """幂等校验：按请求哈希 + 方案编号双重判重。
    返回已有方案则代表重复提交。
    """
    h = compute_idempotency_hash(payload.model_dump())
    existing = (
        db.query(models.SurveyPlan)
        .filter(
            (models.SurveyPlan.plan_code == payload.plan_code)
            | (models.SurveyPlan.idempotency_hash == h)
        )
        .first()
    )
    return existing


def _build_layer(layer_in: CadLayerIn, order: int) -> models.CadLayer:
    is_valid, ltype, block_reason = validate_layer_name(layer_in.layer_name)
    return models.CadLayer(
        layer_name=layer_in.layer_name,
        normalized_name=normalize_layer_name(layer_in.layer_name),
        layer_type=ltype,
        entity_count=layer_in.entity_count,
        is_valid=is_valid,
        block_reason=block_reason,
        order_index=order,
    )


def _build_collision_point(p: CollisionPointIn) -> models.CollisionPoint:
    return models.CollisionPoint(
        point_code=p.point_code,
        layer_a=p.layer_a,
        layer_b=p.layer_b,
        anchor_x=p.anchor_x,
        anchor_y=p.anchor_y,
        anchor_z=p.anchor_z,
        view_params=p.view_params,
        description=p.description,
        severity=p.severity,
        is_judged=False,
    )


def _snapshot_plan(plan: models.SurveyPlan) -> Dict[str, Any]:
    return {
        "status": plan.status,
        "collision_total": len(plan.collision_points),
        "judged_count": sum(1 for cp in plan.collision_points if cp.is_judged),
        "blocked_layer_count": sum(1 for l in plan.layers if not l.is_valid),
        "judgment_codes": sorted([j.judgment_code for j in plan.manual_judgments]),
    }


def _diff_summary(before: Dict[str, Any], after: Dict[str, Any], action: str) -> str:
    if action == "submit":
        return f"首次提交方案：碰撞点 {after['collision_total']} 个，异常图层 {after['blocked_layer_count']} 个，待人工改判 {after['collision_total'] - after['judged_count']} 个"
    lines = []
    if before["status"] != after["status"]:
        lines.append(f"方案状态由 {before['status']} 变更为 {after['status']}")
    if before["judged_count"] != after["judged_count"]:
        lines.append(f"人工改判数 {before['judged_count']} → {after['judged_count']}")
    if before["blocked_layer_count"] != after["blocked_layer_count"]:
        lines.append(f"异常图层 {before['blocked_layer_count']} → {after['blocked_layer_count']}")
    added = set(after["judgment_codes"]) - set(before["judgment_codes"])
    removed = set(before["judgment_codes"]) - set(after["judgment_codes"])
    if added:
        lines.append(f"新增改判单：{', '.join(added)}")
    if removed:
        lines.append(f"移除改判单（不应出现，幂等拦截已防止）：{', '.join(removed)}")
    return "；".join(lines) if lines else "无实质变更"


def submit_plan(db: Session, payload: SurveyPlanSubmit) -> Tuple[models.SurveyPlan, bool]:
    """主流程提交流程。
    返回 (方案对象, 是否为重复提交)
    流程含：幂等校验 → 图层校验（混乱命名拦截）→ 碰撞点入库 → 人工改判走异常分支 → 历史快照写入
    """
    existing = check_idempotency(db, payload)
    if existing is not None:
        return existing, True

    h = compute_idempotency_hash(payload.model_dump())
    plan = models.SurveyPlan(
        plan_code=payload.plan_code,
        plan_name=payload.plan_name,
        building_address=payload.building_address,
        submitter=payload.submitter,
        survey_method=payload.survey_method,
        total_stations=payload.total_stations,
        remark=payload.remark,
        status="pending",
        idempotency_hash=h,
    )
    db.add(plan)
    db.flush()

    for i, layer in enumerate(payload.layers):
        plan.layers.append(_build_layer(layer, i))

    cp_map: Dict[str, models.CollisionPoint] = {}
    for p in payload.collision_points:
        cp = _build_collision_point(p)
        plan.collision_points.append(cp)
        cp_map[p.point_code] = cp

    used_judgment_codes: set = set()
    for j in payload.manual_judgments:
        if j.judgment_code in used_judgment_codes:
            continue
        used_judgment_codes.add(j.judgment_code)
        cp = cp_map.get(j.point_code)
        if cp is not None:
            cp.is_judged = True
            mj = models.ManualJudgment(
                judgment_code=j.judgment_code,
                collision_point_id=cp.id,
                point_code=cp.point_code,
                judge=j.judge,
                original_result=j.original_result,
                final_result=j.final_result,
                reason=j.reason,
                evidence=j.evidence,
            )
            plan.manual_judgments.append(mj)

    db.flush()
    after = _snapshot_plan(plan)
    before = {
        "status": "none",
        "collision_total": 0,
        "judged_count": 0,
        "blocked_layer_count": 0,
        "judgment_codes": [],
    }
    history = models.ReviewHistory(
        reviewer=payload.submitter,
        action="submit",
        before_snapshot=before,
        after_snapshot=after,
        diff_summary=_diff_summary(before, after, "submit"),
        comment="方案首次提交，图层命名校验已执行，人工改判已与碰撞点绑定",
    )
    plan.review_histories.append(history)
    db.commit()
    db.refresh(plan)
    return plan, False


def apply_manual_judgment(db: Session, plan_id: int, judgment: ManualJudgmentIn) -> Optional[models.ManualJudgment]:
    """单独追加一笔人工改判，用于走异常分支+历史追踪。
    幂等：同一 judgment_code 不重复入库，不累加为两份。
    """
    plan = db.query(models.SurveyPlan).filter(models.SurveyPlan.id == plan_id).first()
    if not plan:
        return None

    duplicate = (
        db.query(models.ManualJudgment)
        .filter(models.ManualJudgment.judgment_code == judgment.judgment_code)
        .first()
    )
    if duplicate is not None:
        return duplicate

    before = _snapshot_plan(plan)

    cp = None
    for p in plan.collision_points:
        if p.point_code == judgment.point_code:
            cp = p
            break
    if cp is not None:
        cp.is_judged = True

    mj = models.ManualJudgment(
        plan_id=plan.id,
        judgment_code=judgment.judgment_code,
        collision_point_id=cp.id if cp else None,
        point_code=judgment.point_code,
        judge=judgment.judge,
        original_result=judgment.original_result,
        final_result=judgment.final_result,
        reason=judgment.reason,
        evidence=judgment.evidence,
    )
    plan.manual_judgments.append(mj)
    db.flush()

    after = _snapshot_plan(plan)
    history = models.ReviewHistory(
        reviewer=judgment.judge,
        action="judgment_change",
        before_snapshot=before,
        after_snapshot=after,
        diff_summary=_diff_summary(before, after, "judgment_change"),
        comment=f"人工改判[{judgment.judgment_code}]：{judgment.original_result}→{judgment.final_result}，理由：{judgment.reason}",
    )
    plan.review_histories.append(history)
    db.commit()
    db.refresh(plan)
    db.refresh(mj)
    return mj


def build_stats(plan: models.SurveyPlan) -> Dict[str, Any]:
    """汇总口径：与异常明细一一对应。"""
    layers = plan.layers
    collisions = plan.collision_points
    judgments = plan.manual_judgments

    blocked = [l for l in layers if not l.is_valid]
    valid_layers = [l for l in layers if l.is_valid]

    j_map = {j.point_code: j for j in judgments}
    judged_points = [cp for cp in collisions if cp.is_judged]
    unjudged_points = [cp for cp in collisions if not cp.is_judged]

    severity_count: Dict[str, int] = {"info": 0, "warning": 0, "danger": 0}
    for cp in collisions:
        severity_count[cp.severity] = severity_count.get(cp.severity, 0) + 1

    result_count: Dict[str, int] = {}
    for j in judgments:
        result_count[j.final_result] = result_count.get(j.final_result, 0) + 1

    return {
        "total_layers": len(layers),
        "valid_layer_count": len(valid_layers),
        "blocked_layer_count": len(blocked),
        "blocked_layer_names": [l.layer_name for l in blocked],
        "total_collision_points": len(collisions),
        "severity_distribution": severity_count,
        "judged_count": len(judged_points),
        "unjudged_count": len(unjudged_points),
        "judgment_count": len(judgments),
        "judgment_result_distribution": result_count,
        "judgment_codes": sorted([j.judgment_code for j in judgments]),
    }


def build_public_summary(plan: models.SurveyPlan) -> Dict[str, Any]:
    """社区公示版：直接拿去沟通的返回。"""
    stats = build_stats(plan)
    blocked_details = []
    for l in plan.layers:
        if not l.is_valid:
            blocked_details.append(
                {
                    "layer_name": l.layer_name,
                    "block_reason": l.block_reason,
                    "suggestion": "按「类别前缀_部位_楼层」重命名，如 WALL_主体_3F / PIPE_消防_B1",
                }
            )

    j_map = {j.point_code: j for j in plan.manual_judgments}
    abnormal_details: List[Dict[str, Any]] = []
    for cp in plan.collision_points:
        j = j_map.get(cp.point_code)
        item = {
            "category": f"{cp.layer_a} ∩ {cp.layer_b}",
            "point_code": cp.point_code,
            "coordinate_anchor": f"[WGS84] X={cp.anchor_x:.3f}, Y={cp.anchor_y:.3f}, Z={cp.anchor_z:.3f}",
            "description": cp.description or f"{cp.layer_a} 与 {cp.layer_b} 在该坐标发生碰撞",
            "judgment_result": j.final_result if j else (f"待确认（严重级别：{cp.severity}）"),
            "judge": j.judge if j else "",
            "reason": j.reason if j else "",
        }
        abnormal_details.append(item)

    timeline = []
    for h in sorted(plan.review_histories, key=lambda x: x.created_at):
        timeline.append(
            {
                "time": h.created_at.strftime("%Y-%m-%d %H:%M"),
                "reviewer": h.reviewer,
                "action": h.action,
                "diff": h.diff_summary,
                "comment": h.comment,
            }
        )

    overview = {
        "方案编号": plan.plan_code,
        "测绘方式": plan.survey_method,
        "测站数": plan.total_stations,
        "图层总数": stats["total_layers"],
        "命名不合格图层": stats["blocked_layer_count"],
        "碰撞点总数": stats["total_collision_points"],
        "严重碰撞": stats["severity_distribution"].get("danger", 0),
        "警告碰撞": stats["severity_distribution"].get("warning", 0),
        "已人工确认": stats["judged_count"],
        "待确认": stats["unjudged_count"],
    }

    abnormal_summary = {
        "说明": "下方异常明细与本汇总口径一一对应，负责人可按 point_code 跳查坐标锚点",
        "异常图层": stats["blocked_layer_count"],
        "需关注碰撞": stats["total_collision_points"],
        "其中严重": stats["severity_distribution"].get("danger", 0),
        "已改判": stats["judged_count"],
        "待改判": stats["unjudged_count"],
    }

    reviewer_note_parts = []
    if stats["blocked_layer_count"] > 0:
        reviewer_note_parts.append(
            f"有 {stats['blocked_layer_count']} 个图层命名不规范，统一命名后再走公示，避免居民混淆。"
        )
    reviewer_note_parts.append(
        f"所有碰撞点均已锚定到世界坐标 [WGS84]，无需截图换视角，按坐标即可现场复核。"
    )
    if stats["judged_count"] > 0:
        reviewer_note_parts.append(
            f"其中 {stats['judged_count']} 个已完成人工改判，历史可查，见下方 timeline。"
        )

    return {
        "report_title": f"{plan.plan_name} - 旧楼测绘方案比选结果（社区公示版）",
        "generated_at": datetime.now(),
        "plan_basic": {
            "plan_code": plan.plan_code,
            "plan_name": plan.plan_name,
            "building_address": plan.building_address,
            "submitter": plan.submitter,
            "status": plan.status,
            "created_at": plan.created_at.strftime("%Y-%m-%d %H:%M"),
        },
        "overview": overview,
        "abnormal_summary": abnormal_summary,
        "abnormal_details": abnormal_details,
        "blocked_layers": blocked_details,
        "history_timeline": timeline,
        "reviewer_note": "".join(reviewer_note_parts),
    }
