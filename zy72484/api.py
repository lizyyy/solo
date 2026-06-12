from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from core import FumeInspectionSystem
from models import ReviewStatus, NextRole

app = FastAPI(title="沿街店铺油烟整治 API", description="给小看板用的接口")

system = FumeInspectionSystem()


def _init_demo_data():
    c1 = system.add_community("阳光花园小区", "光明路88号", "江城区")
    c2 = system.add_community("和平家园", "和平路123号", "江城区")

    s1 = system.add_shop("老王川菜馆", c1, "光明路88号-1", "餐饮", has_fume_hood=True)
    s2 = system.add_shop("李记烧烤", c1, "光明路88号-2", "餐饮", has_fume_hood=False)
    s3 = system.add_shop("张姐早餐店", c2, "和平路123号-1", "餐饮", has_fume_hood=True)

    r1 = system.import_ramp_record(
        shop_id=s1, community_name="阳光花园小区", has_ramp=False,
        inspection_date="2026-06-01", inspector="市政巡检员老陈", notes="门口有台阶，无坡道"
    )
    r2 = system.import_ramp_record(
        shop_id=s2, community_name="阳光花园", has_ramp=True,
        ramp_width=1.2, inspection_date="2026-06-01", inspector="市政巡检员老陈"
    )

    sp1 = system.import_sampling_point(
        shop_id=s1, community_name="阳光花园小区",
        sampling_date="2026-06-05", sampling_time="22:30",
        fume_concentration=3.5, sampler="街道规划员小姜", notes="晚高峰后采样"
    )
    sp2 = system.import_sampling_point(
        shop_id=s2, community_name="阳光花园",
        sampling_date="2026-06-05", sampling_time="23:15",
        fume_concentration=1.8, sampler="街道规划员小姜"
    )


_init_demo_data()


class RampRecordIn(BaseModel):
    shop_id: str
    community_name: str
    has_ramp: bool
    inspection_date: str
    inspector: Optional[str] = None
    ramp_width: Optional[float] = None
    ramp_slope: Optional[float] = None
    has_handrail: bool = False
    notes: Optional[str] = None


class SamplingPointIn(BaseModel):
    shop_id: str
    community_name: str
    sampling_date: str
    sampling_time: str
    fume_concentration: float
    standard_limit: float = 2.0
    sampler: Optional[str] = None
    notes: Optional[str] = None


class ReviewAliasIn(BaseModel):
    index: int
    reviewer: str
    is_valid: bool
    note: Optional[str] = None


@app.get("/")
async def root():
    return {
        "name": "沿街店铺油烟整治 API",
        "version": "1.0",
        "endpoints": {
            "GET /api/summary": "获取街道会看的摘要",
            "GET /api/issues": "获取所有问题记录",
            "GET /api/issues/{issue_id}": "获取问题详情（含关联原始记录）",
            "GET /api/chart-data": "获取图表数据（3D/小看板用）",
            "POST /api/ramp-records": "导入无障碍坡道记录",
            "POST /api/sampling-points": "补录夜间采样点",
            "POST /api/review-alias": "复核小区同名问题",
            "GET /api/aliases": "获取小区同名待复核列表"
        }
    }


@app.get("/api/summary")
async def get_summary():
    summary = system.generate_street_summary()
    return {
        "generated_at": summary.generated_at.isoformat(),
        "total_shops": summary.total_shops,
        "shops_with_issues": summary.shops_with_issues,
        "pending_review": summary.pending_review,
        "alias_issues": summary.alias_issues,
        "missing_ramp_records": summary.missing_ramp_records,
        "missing_sampling_points": summary.missing_sampling_points,
        "alias_details": summary.alias_details,
        "issues": summary.issues
    }


@app.get("/api/issues")
async def get_issues(status: Optional[str] = None):
    summary = system.generate_street_summary()
    issues = summary.issues
    if status:
        issues = [i for i in issues if i["当前状态"] == status]
    return {"issues": issues, "count": len(issues)}


@app.get("/api/issues/{issue_id}")
async def get_issue_detail(issue_id: str):
    issue = system.store.issue_records.get(issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="找不到该问题记录")

    ramp = system.get_ramp_by_issue(issue_id)
    sampling = system.get_sampling_by_issue(issue_id)

    result = {
        "id": issue.id,
        "shop_id": issue.shop_id,
        "shop_name": issue.shop_name,
        "community_name": issue.community_name,
        "reason_kept": issue.reason_kept,
        "missing_materials": issue.missing_materials,
        "next_role": issue.next_role.value,
        "status": issue.status.value,
        "has_alias_issue": issue.has_alias_issue,
        "created_at": issue.created_at.isoformat(),
        "updated_at": issue.updated_at.isoformat(),
        "ramp_record": None,
        "sampling_point": None
    }

    if ramp:
        result["ramp_record"] = {
            "id": ramp.id,
            "community_name": ramp.community_name,
            "has_ramp": ramp.has_ramp,
            "ramp_width": ramp.ramp_width,
            "ramp_slope": ramp.ramp_slope,
            "has_handrail": ramp.has_handrail,
            "inspector": ramp.inspector,
            "inspection_date": ramp.inspection_date,
            "notes": ramp.notes,
            "status": ramp.status.value
        }

    if sampling:
        result["sampling_point"] = {
            "id": sampling.id,
            "community_name": sampling.community_name,
            "sampling_date": sampling.sampling_date,
            "sampling_time": sampling.sampling_time,
            "fume_concentration": sampling.fume_concentration,
            "standard_limit": sampling.standard_limit,
            "is_qualified": sampling.is_qualified,
            "sampler": sampling.sampler,
            "notes": sampling.notes,
            "status": sampling.status.value
        }

    return result


@app.get("/api/chart-data")
async def get_chart_data():
    return system.get_chart_data()


@app.get("/api/aliases")
async def get_aliases():
    return {
        "aliases": [
            {
                "index": idx,
                "community_id": a.community_id,
                "old_name": a.old_name,
                "new_name": a.new_name,
                "detected_at": a.detected_at.isoformat(),
                "reviewed": a.reviewed,
                "reviewer": a.reviewer,
                "review_note": a.review_note
            }
            for idx, a in enumerate(system.store.community_aliases)
        ]
    }


@app.post("/api/ramp-records")
async def add_ramp_record(record: RampRecordIn):
    rid = system.import_ramp_record(**record.dict())
    return {"id": rid, "message": "坡道记录已导入", "summary": system.generate_street_summary().__dict__}


@app.post("/api/sampling-points")
async def add_sampling_point(record: SamplingPointIn):
    sid = system.import_sampling_point(**record.dict())
    return {"id": sid, "message": "夜间采样点已补录", "summary": system.generate_street_summary().__dict__}


@app.post("/api/review-alias")
async def review_alias(review: ReviewAliasIn):
    if review.index >= len(system.store.community_aliases):
        raise HTTPException(status_code=400, detail="序号超出范围")
    system.review_alias(review.index, review.reviewer, review.is_valid, review.note)
    return {"message": "复核完成", "summary": system.generate_street_summary().__dict__}


app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard():
    with open("static/index.html", "r", encoding="utf-8") as f:
        return f.read()
