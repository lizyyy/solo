from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    SurveyPlanSubmit,
    PlanDetailResponse,
    SurveyPlanOut,
    CadLayerOut,
    CollisionPointOut,
    ManualJudgmentOut,
    ReviewHistoryOut,
    IdempotencyNotice,
    ManualJudgmentIn,
    PublicSummaryResponse,
)
from app import models
from app.services import (
    submit_plan,
    apply_manual_judgment,
    build_stats,
    build_public_summary,
)

router = APIRouter(prefix="/api/v1/survey", tags=["旧楼测绘方案比选"])


def _build_detail(plan: models.SurveyPlan, is_duplicate: bool = False) -> PlanDetailResponse:
    return PlanDetailResponse(
        plan=SurveyPlanOut.model_validate(plan),
        idempotency=(
            IdempotencyNotice(
                is_duplicate=True,
                original_plan_code=plan.plan_code,
                submitted_at=plan.created_at,
                note="请求内容完全一致，幂等拦截生效：不重复入库，人工改判单也不累加为两份。",
            )
            if is_duplicate
            else None
        ),
        layers=[CadLayerOut.model_validate(l) for l in sorted(plan.layers, key=lambda x: x.order_index)],
        collision_points=[CollisionPointOut.model_validate(cp) for cp in plan.collision_points],
        manual_judgments=[ManualJudgmentOut.model_validate(j) for j in plan.manual_judgments],
        review_histories=[
            ReviewHistoryOut.model_validate(h) for h in sorted(plan.review_histories, key=lambda x: x.created_at)
        ],
        stats=build_stats(plan),
    )


@router.post(
    "/plans",
    response_model=PlanDetailResponse,
    summary="提交旧楼测绘方案比选（含幂等、图层校验、人工改判走异常分支）",
)
def create_survey_plan(payload: SurveyPlanSubmit, db: Session = Depends(get_db)):
    plan, duplicated = submit_plan(db, payload)
    return _build_detail(plan, is_duplicate=duplicated)


@router.get(
    "/plans/{plan_id}",
    response_model=PlanDetailResponse,
    summary="查询方案详情（含碰撞点坐标锚、统计口径、历史快照）",
)
def get_survey_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(models.SurveyPlan).filter(models.SurveyPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="方案不存在")
    return _build_detail(plan, is_duplicate=False)


@router.post(
    "/plans/{plan_id}/judgments",
    response_model=ManualJudgmentOut,
    summary="追加一笔人工改判（异常分支验证；幂等：同judgment_code不重复）",
)
def add_manual_judgment(plan_id: int, judgment: ManualJudgmentIn, db: Session = Depends(get_db)):
    mj = apply_manual_judgment(db, plan_id, judgment)
    if mj is None:
        raise HTTPException(status_code=404, detail="方案不存在或改判幂等拦截已返回原记录")
    return ManualJudgmentOut.model_validate(mj)


@router.get(
    "/plans/{plan_id}/public-summary",
    response_model=PublicSummaryResponse,
    summary="社区公示用返回格式（直接沟通用，非功能清单）",
)
def get_public_summary(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(models.SurveyPlan).filter(models.SurveyPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="方案不存在")
    return build_public_summary(plan)


@router.get(
    "/plans",
    response_model=list[SurveyPlanOut],
    summary="方案列表（社区公示前核对历史状态）",
)
def list_survey_plans(db: Session = Depends(get_db)):
    plans = db.query(models.SurveyPlan).order_by(models.SurveyPlan.created_at.desc()).all()
    return [SurveyPlanOut.model_validate(p) for p in plans]
