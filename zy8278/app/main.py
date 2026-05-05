from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from io import BytesIO
import json
import os

from app.database import engine, get_db, Base
from app.models import Contestant, JudgeScore, RankRule, Appeal, RankingResult
from app.import_service import ImportService
from app.ranking_service import RankingService, RankingMode, ContestantScore, PromotionStatus
from app.report_service import ReportService

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="赛事评分排名复核 API",
    description="本地赛事评分排名复核服务，支持数据导入、排名预览、申诉调整和报告导出",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {
        "message": "赛事评分排名复核 API 服务",
        "version": "1.0.0",
        "endpoints": {
            "导入": [
                "POST /import/contestants - 导入选手信息 (CSV)",
                "POST /import/judge-scores - 导入评委打分 (CSV)",
                "POST /import/rank-rules - 导入排名规则 (YAML)",
                "POST /import/appeals - 导入申诉记录 (JSONL)"
            ],
            "排名": [
                "GET /ranking - 获取排名列表",
                "GET /ranking/preview - 排名预览"
            ],
            "申诉": [
                "GET /appeals - 获取申诉列表",
                "POST /appeals/{appeal_id}/process - 处理申诉"
            ],
            "报告": [
                "GET /report/csv - 导出排名 CSV",
                "GET /report/md - 导出复核报告 (Markdown)"
            ]
        }
    }


@app.post("/import/contestants", tags=["导入"])
def import_contestants(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        content = file.file.read().decode("utf-8")
        result = ImportService.import_contestants(db, content)
        return {
            "success": len(result["errors"]) == 0,
            "imported": result["imported"],
            "errors": result["errors"]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/import/judge-scores", tags=["导入"])
def import_judge_scores(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        content = file.file.read().decode("utf-8")
        result = ImportService.import_judge_scores(db, content)
        return {
            "success": len(result["errors"]) == 0,
            "imported": result["imported"],
            "errors": result["errors"]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/import/rank-rules", tags=["导入"])
def import_rank_rules(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        content = file.file.read().decode("utf-8")
        result = ImportService.import_rank_rules(db, content)
        return {
            "success": len(result["errors"]) == 0,
            "imported": result["imported"],
            "rule": result.get("rule"),
            "errors": result["errors"]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/import/appeals", tags=["导入"])
def import_appeals(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        content = file.file.read().decode("utf-8")
        result = ImportService.import_appeals(db, content)
        return {
            "success": len(result["errors"]) == 0,
            "imported": result["imported"],
            "errors": result["errors"]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


def get_rank_rules(db: Session) -> Dict[str, Any]:
    rule = db.query(RankRule).order_by(RankRule.updated_at.desc()).first()
    if not rule:
        return {
            "rule_name": "default",
            "drop_highest": 0,
            "drop_lowest": 0,
            "ranking_mode": "competition",
            "promotion_threshold": None,
            "promotion_score": None
        }
    
    categories = None
    if rule.categories:
        try:
            categories = json.loads(rule.categories)
        except:
            categories = None
    
    return {
        "rule_name": rule.rule_name,
        "drop_highest": rule.drop_highest,
        "drop_lowest": rule.drop_lowest,
        "ranking_mode": rule.ranking_mode,
        "promotion_threshold": rule.promotion_threshold,
        "promotion_score": rule.promotion_score,
        "categories": categories
    }


def get_contestant_scores(db: Session, rules: Dict[str, Any]) -> List[ContestantScore]:
    contestants = db.query(Contestant).all()
    
    contestant_scores = []
    for contestant in contestants:
        scores = db.query(JudgeScore).filter(
            JudgeScore.contestant_id == contestant.contestant_id
        ).all()
        
        score_values = [s.score for s in scores]
        
        final_score, effective_scores, dropped_scores = RankingService.calculate_final_score(
            score_values,
            drop_highest=rules.get("drop_highest", 0),
            drop_lowest=rules.get("drop_lowest", 0)
        )
        
        appeal_impact = None
        appeals = db.query(Appeal).filter(
            Appeal.contestant_id == contestant.contestant_id,
            Appeal.status == "approved"
        ).all()
        
        if appeals:
            score_changes = []
            for appeal in appeals:
                if appeal.original_score != appeal.new_score:
                    change = appeal.new_score - appeal.original_score
                    direction = "上升" if change > 0 else "下降"
                    score_changes.append(f"分数{direction} {abs(change):.2f}")
            
            if score_changes:
                appeal_impact = f"申诉后: {', '.join(score_changes)}"
                
                old_scores = []
                for s in scores:
                    if s.original_score is not None:
                        old_scores.append(s.original_score)
                    else:
                        old_scores.append(s.score)
                
                old_final, _, _ = RankingService.calculate_final_score(
                    old_scores,
                    drop_highest=rules.get("drop_highest", 0),
                    drop_lowest=rules.get("drop_lowest", 0)
                )
                
                if (old_final < (rules.get("promotion_score") or 0) and 
                    final_score >= (rules.get("promotion_score") or 0)):
                    appeal_impact = f"申诉后分数提升，成功跨过晋级线 (原: {old_final:.3f} -> 现: {final_score:.3f})，Crossed promotion line after appeal"
        
        contestant_score = ContestantScore(
            contestant_id=contestant.contestant_id,
            name=contestant.name,
            scores=score_values,
            dropped_scores=dropped_scores,
            final_score=final_score,
            category=contestant.category,
            appeal_impact=appeal_impact
        )
        contestant_scores.append(contestant_score)
    
    return contestant_scores


@app.get("/ranking", tags=["排名"])
def get_ranking(
    category: Optional[str] = Query(None, description="按类别筛选"),
    ranking_mode: Optional[str] = Query(None, description="排名模式: competition 或 dense"),
    promotion_threshold: Optional[int] = Query(None, description="晋级名额（覆盖配置）"),
    promotion_score: Optional[float] = Query(None, description="晋级分数线（覆盖配置）"),
    db: Session = Depends(get_db)
):
    rules = get_rank_rules(db)
    
    if ranking_mode:
        rules["ranking_mode"] = ranking_mode
    if promotion_threshold is not None:
        rules["promotion_threshold"] = promotion_threshold
    if promotion_score is not None:
        rules["promotion_score"] = promotion_score
    
    contestant_scores = get_contestant_scores(db, rules)
    
    if not contestant_scores:
        return {
            "success": True,
            "rules": rules,
            "total": 0,
            "rankings": []
        }
    
    mode = RankingMode.COMPETITION
    if rules.get("ranking_mode") == "dense":
        mode = RankingMode.DENSE
    
    ranked_contestants = RankingService.rank_contestants(
        contestant_scores,
        ranking_mode=mode,
        promotion_threshold=rules.get("promotion_threshold"),
        promotion_score=rules.get("promotion_score"),
        category=category
    )
    
    rankings_json = []
    for r in ranked_contestants:
        rankings_json.append({
            "contestant_id": r.contestant_id,
            "name": r.name,
            "final_score": r.final_score,
            "rank": r.rank,
            "rank_display": r.rank_display,
            "category": r.category,
            "is_promoted": r.is_promoted,
            "promotion_status": r.promotion_status,
            "appeal_impact": r.appeal_impact
        })
    
    return {
        "success": True,
        "rules": rules,
        "category": category,
        "total": len(ranked_contestants),
        "rankings": rankings_json
    }


@app.get("/ranking/preview", tags=["排名"])
def preview_ranking(
    compare_modes: bool = Query(False, description="对比两种排名模式"),
    db: Session = Depends(get_db)
):
    rules = get_rank_rules(db)
    contestant_scores = get_contestant_scores(db, rules)
    
    if not contestant_scores:
        return {
            "success": True,
            "rules": rules,
            "modes": {}
        }
    
    result = {
        "success": True,
        "rules": rules,
        "modes": {}
    }
    
    modes_to_show = ["competition"]
    if compare_modes:
        modes_to_show = ["competition", "dense"]
    
    for mode_name in modes_to_show:
        mode = RankingMode.COMPETITION if mode_name == "competition" else RankingMode.DENSE
        
        ranked = RankingService.rank_contestants(
            contestant_scores,
            ranking_mode=mode,
            promotion_threshold=rules.get("promotion_threshold"),
            promotion_score=rules.get("promotion_score")
        )
        
        result["modes"][mode_name] = {
            "total": len(ranked),
            "promoted_count": sum(1 for r in ranked if r.is_promoted),
            "rankings": [
                {
                    "rank": r.rank,
                    "rank_display": r.rank_display,
                    "name": r.name,
                    "final_score": r.final_score,
                    "is_promoted": r.is_promoted
                }
                for r in ranked[:10]
            ]
        }
    
    return result


@app.get("/appeals", tags=["申诉"])
def get_appeals(
    status: Optional[str] = Query(None, description="按状态筛选: pending, approved, rejected"),
    db: Session = Depends(get_db)
):
    query = db.query(Appeal)
    
    if status:
        query = query.filter(Appeal.status == status)
    
    appeals = query.order_by(Appeal.created_at.desc()).all()
    
    result = []
    for appeal in appeals:
        contestant = db.query(Contestant).filter(
            Contestant.contestant_id == appeal.contestant_id
        ).first()
        
        result.append({
            "id": appeal.id,
            "contestant_id": appeal.contestant_id,
            "contestant_name": contestant.name if contestant else None,
            "judge_id": appeal.judge_id,
            "original_score": appeal.original_score,
            "new_score": appeal.new_score,
            "reason": appeal.reason,
            "status": appeal.status,
            "created_at": appeal.created_at,
            "processed_at": appeal.processed_at
        })
    
    return {
        "success": True,
        "total": len(result),
        "appeals": result
    }


@app.post("/appeals/{appeal_id}/process", tags=["申诉"])
def process_appeal(
    appeal_id: int,
    approve: bool = Query(..., description="是否通过申诉"),
    db: Session = Depends(get_db)
):
    result = ImportService.process_appeal(db, appeal_id, approve)
    
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("error"))
    
    return result


@app.get("/report/csv", tags=["报告"])
def export_csv(
    category: Optional[str] = Query(None, description="按类别筛选"),
    db: Session = Depends(get_db)
):
    rules = get_rank_rules(db)
    contestant_scores = get_contestant_scores(db, rules)
    
    if not contestant_scores:
        raise HTTPException(status_code=404, detail="暂无排名数据")
    
    mode = RankingMode.COMPETITION
    if rules.get("ranking_mode") == "dense":
        mode = RankingMode.DENSE
    
    ranked_contestants = RankingService.rank_contestants(
        contestant_scores,
        ranking_mode=mode,
        promotion_threshold=rules.get("promotion_threshold"),
        promotion_score=rules.get("promotion_score"),
        category=category
    )
    
    csv_content = ReportService.export_ranking_csv(ranked_contestants)
    
    output = BytesIO(csv_content.encode("utf-8-sig"))
    output.seek(0)
    
    filename = f"ranking_{category if category else 'all'}.csv"
    
    return StreamingResponse(
        output,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@app.get("/report/md", tags=["报告"])
def export_report_md(
    db: Session = Depends(get_db)
):
    rules = get_rank_rules(db)
    contestant_scores = get_contestant_scores(db, rules)
    
    if not contestant_scores:
        raise HTTPException(status_code=404, detail="暂无排名数据")
    
    mode = RankingMode.COMPETITION
    if rules.get("ranking_mode") == "dense":
        mode = RankingMode.DENSE
    
    ranked_contestants = RankingService.rank_contestants(
        contestant_scores,
        ranking_mode=mode,
        promotion_threshold=rules.get("promotion_threshold"),
        promotion_score=rules.get("promotion_score")
    )
    
    appeals = db.query(Appeal).all()
    appeals_data = []
    for appeal in appeals:
        contestant = db.query(Contestant).filter(
            Contestant.contestant_id == appeal.contestant_id
        ).first()
        
        appeals_data.append({
            "id": appeal.id,
            "contestant_id": appeal.contestant_id,
            "contestant_name": contestant.name if contestant else None,
            "judge_id": appeal.judge_id,
            "original_score": appeal.original_score,
            "new_score": appeal.new_score,
            "reason": appeal.reason,
            "status": appeal.status,
            "processed_at": appeal.processed_at
        })
    
    report_content = ReportService.generate_review_report(
        ranked_contestants=ranked_contestants,
        rules=rules,
        contestant_scores=contestant_scores,
        appeals_data=appeals_data
    )
    
    output = BytesIO(report_content.encode("utf-8"))
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": "attachment; filename=review_report.md"
        }
    )


@app.get("/stats", tags=["统计"])
def get_stats(db: Session = Depends(get_db)):
    contestant_count = db.query(Contestant).count()
    score_count = db.query(JudgeScore).count()
    appeal_count = db.query(Appeal).count()
    pending_appeals = db.query(Appeal).filter(Appeal.status == "pending").count()
    
    rules = get_rank_rules(db)
    
    return {
        "success": True,
        "stats": {
            "contestants": contestant_count,
            "judge_scores": score_count,
            "appeals": {
                "total": appeal_count,
                "pending": pending_appeals
            }
        },
        "current_rules": rules
    }
