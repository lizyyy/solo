from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import io
import csv

from fastapi.responses import StreamingResponse

from app.database import get_db
from app.models import Filter, FilterPrediction
from app.schemas import PredictionCreate, PredictionReview, PredictionResponse
from app.predictor import FilterLifePredictor

router = APIRouter()

@router.post("/predict/{filter_id}")
def predict_filter_life(filter_id: str, db: Session = Depends(get_db)):
    predictor = FilterLifePredictor(db)
    result = predictor.predict(filter_id)
    
    if 'error' in result:
        raise HTTPException(status_code=404, detail=result['error'])
    
    db_prediction = FilterPrediction(
        filter_id=filter_id,
        prediction_date=result['prediction_date'],
        predicted_remaining_days=result['predicted_remaining_days'],
        predicted_remaining_liters=result['predicted_remaining_liters'],
        health_score=result['health_score'],
        risk_level=result['risk_level'],
        recommendation=result['recommendation'],
        explanation=result['explanation'],
        confidence=result['confidence']
    )
    db.add(db_prediction)
    db.commit()
    db.refresh(db_prediction)
    
    return {
        "prediction": db_prediction,
        "factors": result['factors']
    }

@router.post("/predict-batch")
def batch_predict(
    filter_ids: Optional[List[str]] = None,
    db: Session = Depends(get_db)
):
    predictor = FilterLifePredictor(db)
    
    if not filter_ids:
        filters = db.query(Filter).filter(Filter.status == 'active').all()
        filter_ids = [f.filter_id for f in filters]
    
    results = []
    for fid in filter_ids:
        result = predictor.predict(fid)
        if 'error' not in result:
            db_prediction = FilterPrediction(
                filter_id=fid,
                prediction_date=result['prediction_date'],
                predicted_remaining_days=result['predicted_remaining_days'],
                predicted_remaining_liters=result['predicted_remaining_liters'],
                health_score=result['health_score'],
                risk_level=result['risk_level'],
                recommendation=result['recommendation'],
                explanation=result['explanation'],
                confidence=result['confidence']
            )
            db.add(db_prediction)
            results.append({
                "filter_id": fid,
                "risk_level": result['risk_level'],
                "health_score": result['health_score'],
                "predicted_remaining_days": result['predicted_remaining_days'],
                "recommendation": result['recommendation']
            })
    
    db.commit()
    
    return {
        "total_filters": len(filter_ids),
        "successful_predictions": len(results),
        "results": results,
        "risk_summary": {
            "critical": sum(1 for r in results if r['risk_level'] == 'critical'),
            "high": sum(1 for r in results if r['risk_level'] == 'high'),
            "medium": sum(1 for r in results if r['risk_level'] == 'medium'),
            "low": sum(1 for r in results if r['risk_level'] == 'low'),
            "normal": sum(1 for r in results if r['risk_level'] == 'normal')
        }
    }

@router.get("/", response_model=List[PredictionResponse])
def list_predictions(
    filter_id: Optional[str] = None,
    risk_level: Optional[str] = None,
    review_status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(FilterPrediction)
    
    if filter_id:
        query = query.filter(FilterPrediction.filter_id == filter_id)
    if risk_level:
        query = query.filter(FilterPrediction.risk_level == risk_level)
    if review_status:
        query = query.filter(FilterPrediction.review_status == review_status)
    
    return query.order_by(FilterPrediction.prediction_date.desc()).offset(skip).limit(limit).all()

@router.get("/{prediction_id}")
def get_prediction(prediction_id: int, db: Session = Depends(get_db)):
    prediction = db.query(FilterPrediction).filter(FilterPrediction.id == prediction_id).first()
    if not prediction:
        raise HTTPException(status_code=404, detail="预测记录不存在")
    
    predictor = FilterLifePredictor(db)
    result = predictor.predict(prediction.filter_id)
    
    return {
        "prediction": prediction,
        "current_factors": result.get('factors', {})
    }

@router.put("/{prediction_id}/review", response_model=PredictionResponse)
def review_prediction(
    prediction_id: int,
    review_data: PredictionReview,
    db: Session = Depends(get_db)
):
    prediction = db.query(FilterPrediction).filter(FilterPrediction.id == prediction_id).first()
    if not prediction:
        raise HTTPException(status_code=404, detail="预测记录不存在")
    
    valid_statuses = ['approved', 'rejected', 'adjusted']
    if review_data.review_status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"复核状态必须是: {', '.join(valid_statuses)}"
        )
    
    prediction.reviewed_by = review_data.reviewed_by
    prediction.review_status = review_data.review_status
    prediction.review_comment = review_data.review_comment
    prediction.review_date = datetime.utcnow()
    
    db.commit()
    db.refresh(prediction)
    
    return prediction

@router.get("/export/csv")
def export_predictions_csv(
    risk_level: Optional[str] = None,
    review_status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(FilterPrediction)
    
    if risk_level:
        query = query.filter(FilterPrediction.risk_level == risk_level)
    if review_status:
        query = query.filter(FilterPrediction.review_status == review_status)
    
    predictions = query.order_by(FilterPrediction.prediction_date.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        '滤芯ID', '预测日期', '剩余天数', '剩余水量(升)', '健康评分',
        '风险等级', '建议', '解释说明', '置信度', '复核状态', '复核人', '复核日期'
    ])
    
    for p in predictions:
        writer.writerow([
            p.filter_id,
            p.prediction_date.strftime('%Y-%m-%d %H:%M:%S'),
            p.predicted_remaining_days,
            p.predicted_remaining_liters,
            p.health_score,
            p.risk_level,
            p.recommendation,
            p.explanation,
            p.confidence,
            p.review_status,
            p.reviewed_by or '',
            p.review_date.strftime('%Y-%m-%d %H:%M:%S') if p.review_date else ''
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=predictions_{datetime.now().strftime('%Y%m%d')}.csv"
        }
    )

@router.get("/risk/summary")
def get_risk_summary(db: Session = Depends(get_db)):
    active_filters = db.query(Filter).filter(Filter.status == 'active').count()
    
    latest_predictions = db.query(
        FilterPrediction.filter_id,
        FilterPrediction.risk_level,
        FilterPrediction.health_score,
        FilterPrediction.recommendation
    ).distinct(FilterPrediction.filter_id).order_by(
        FilterPrediction.filter_id,
        FilterPrediction.prediction_date.desc()
    ).all()
    
    risk_counts = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'normal': 0}
    health_scores = []
    
    for p in latest_predictions:
        if p.risk_level in risk_counts:
            risk_counts[p.risk_level] += 1
        health_scores.append(p.health_score)
    
    return {
        "active_filters": active_filters,
        "with_predictions": len(latest_predictions),
        "risk_distribution": risk_counts,
        "avg_health_score": sum(health_scores) / len(health_scores) if health_scores else 0,
        "critical_action_required": risk_counts['critical'] > 0 or risk_counts['high'] > 0
    }
