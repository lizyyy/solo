from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import uvicorn

from . import models, schemas, services
from .database import engine, get_db
from .models import ChangeStatus

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Data Lineage Change API",
    description="数据血缘变更管理 API - 处理离线表字段调整后的影响分析与告警",
    version="0.1.0"
)


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "data-lineage-change-api"}


@app.post("/tables", response_model=schemas.TableMetadataResponse, status_code=status.HTTP_201_CREATED)
def create_table(
    table_data: schemas.TableMetadataCreate,
    created_by: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        return services.create_table_metadata(db, table_data, created_by)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/tables", response_model=List[schemas.TableMetadataResponse])
def list_tables(
    database_name: Optional[str] = None,
    schema_name: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.TableMetadata)
    if database_name:
        query = query.filter(models.TableMetadata.database_name == database_name)
    if schema_name:
        query = query.filter(models.TableMetadata.schema_name == schema_name)
    return query.all()


@app.get("/tables/{table_id}", response_model=schemas.TableMetadataResponse)
def get_table(table_id: int, db: Session = Depends(get_db)):
    table = db.query(models.TableMetadata).filter(models.TableMetadata.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="表不存在")
    return table


@app.get("/tables/{table_id}/versions", response_model=List[schemas.TableFieldVersionResponse])
def get_table_versions(table_id: int, db: Session = Depends(get_db)):
    table = db.query(models.TableMetadata).filter(models.TableMetadata.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="表不存在")
    return db.query(models.TableFieldVersion).filter(
        models.TableFieldVersion.table_id == table_id
    ).order_by(models.TableFieldVersion.version.desc()).all()


@app.get("/tables/{table_id}/versions/{version}", response_model=schemas.TableFieldVersionResponse)
def get_table_version(table_id: int, version: int, db: Session = Depends(get_db)):
    v = db.query(models.TableFieldVersion).filter(
        models.TableFieldVersion.table_id == table_id,
        models.TableFieldVersion.version == version
    ).first()
    if not v:
        raise HTTPException(status_code=404, detail="版本不存在")
    return v


@app.post("/tables/compare-versions", response_model=schemas.VersionCompareResponse)
def compare_table_versions(
    request: schemas.VersionCompareRequest,
    db: Session = Depends(get_db)
):
    try:
        return services.compare_versions(
            db, request.table_id, request.version1, request.version2
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/lineage/edges", response_model=schemas.LineageEdgeResponse, status_code=status.HTTP_201_CREATED)
def create_lineage_edge(
    edge_data: schemas.LineageEdgeCreate,
    db: Session = Depends(get_db)
):
    try:
        return services.create_lineage_edge(db, edge_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/lineage/downstream/{table_id}")
def get_downstream_tables(
    table_id: int,
    field_name: Optional[str] = None,
    db: Session = Depends(get_db)
):
    table = db.query(models.TableMetadata).filter(models.TableMetadata.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="表不存在")
    return {"downstream_tables": services.get_downstream_tables(db, table_id, field_name)}


@app.post("/change-requests", response_model=schemas.FieldChangeRequestResponse, status_code=status.HTTP_201_CREATED)
def create_change_request(
    request_data: schemas.FieldChangeRequestCreate,
    db: Session = Depends(get_db)
):
    try:
        return services.create_field_change_request(db, request_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/change-requests", response_model=List[schemas.FieldChangeRequestResponse])
def list_change_requests(
    table_id: Optional[int] = None,
    status: Optional[ChangeStatus] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.FieldChangeRequest)
    if table_id:
        query = query.filter(models.FieldChangeRequest.table_id == table_id)
    if status:
        query = query.filter(models.FieldChangeRequest.status == status)
    return query.order_by(models.FieldChangeRequest.created_at.desc()).all()


@app.get("/change-requests/{request_id}", response_model=schemas.FieldChangeRequestResponse)
def get_change_request(request_id: int, db: Session = Depends(get_db)):
    cr = db.query(models.FieldChangeRequest).filter(models.FieldChangeRequest.id == request_id).first()
    if not cr:
        raise HTTPException(status_code=404, detail="变更请求不存在")
    return cr


@app.post("/change-requests/{request_id}/submit", response_model=schemas.FieldChangeRequestResponse)
def submit_change_request(
    request_id: int,
    comment: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        return services.submit_for_approval(db, request_id, comment)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/change-requests/{request_id}/approve", response_model=schemas.FieldChangeRequestResponse)
def approve_change_request(
    request_id: int,
    approval: schemas.ChangeApprovalRequest,
    db: Session = Depends(get_db)
):
    try:
        return services.approve_change(db, request_id, approval.approved_by, approval.comment)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/change-requests/{request_id}/apply", response_model=schemas.FieldChangeRequestResponse)
def apply_change_request(
    request_id: int,
    applied_by: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        change_request, new_version = services.apply_change(db, request_id, applied_by)
        return change_request
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/change-requests/{request_id}/rollback", response_model=schemas.FieldChangeRequestResponse)
def rollback_change_request(
    request_id: int,
    rollback_data: schemas.RollbackRequest,
    db: Session = Depends(get_db)
):
    try:
        change_request, prev_version = services.rollback_change(
            db, request_id, rollback_data.reason, rollback_data.rolled_back_by
        )
        return change_request
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/change-requests/{request_id}/impact-analysis", response_model=List[schemas.ImpactAnalysisResponse])
def get_impact_analysis(request_id: int, db: Session = Depends(get_db)):
    cr = db.query(models.FieldChangeRequest).filter(models.FieldChangeRequest.id == request_id).first()
    if not cr:
        raise HTTPException(status_code=404, detail="变更请求不存在")
    return db.query(models.ImpactAnalysis).filter(
        models.ImpactAnalysis.change_request_id == request_id
    ).all()


@app.post("/subscriptions", response_model=schemas.SubscriptionResponse, status_code=status.HTTP_201_CREATED)
def create_subscription(
    subscription_data: schemas.SubscriptionCreate,
    db: Session = Depends(get_db)
):
    try:
        return services.create_subscription(db, subscription_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/subscriptions", response_model=List[schemas.SubscriptionResponse])
def list_subscriptions(
    table_id: Optional[int] = None,
    subscriber_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Subscription)
    if table_id:
        query = query.filter(models.Subscription.table_id == table_id)
    if subscriber_id:
        query = query.filter(models.Subscription.subscriber_id == subscriber_id)
    return query.all()


@app.get("/alerts", response_model=List[schemas.AlertResponse])
def list_alerts(
    change_request_id: Optional[int] = None,
    subscriber_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Alert)
    if change_request_id:
        query = query.filter(models.Alert.change_request_id == change_request_id)
    if subscriber_id:
        query = query.filter(models.Alert.subscriber_id == subscriber_id)
    return query.order_by(models.Alert.created_at.desc()).all()


@app.get("/operation-history", response_model=List[schemas.OperationHistoryResponse])
def list_operation_history(
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    batch_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.OperationHistory)
    if entity_type:
        query = query.filter(models.OperationHistory.entity_type == entity_type)
    if entity_id:
        query = query.filter(models.OperationHistory.entity_id == entity_id)
    if batch_id:
        query = query.filter(models.OperationHistory.batch_id == batch_id)
    return query.order_by(models.OperationHistory.operation_at.desc()).all()


@app.post("/metrics", response_model=schemas.MetricDefinitionResponse, status_code=status.HTTP_201_CREATED)
def create_metric(
    metric_data: schemas.MetricDefinitionCreate,
    db: Session = Depends(get_db)
):
    existing = db.query(models.MetricDefinition).filter(
        models.MetricDefinition.metric_id == metric_data.metric_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail=f"指标 {metric_data.metric_id} 已存在")
    
    metric = models.MetricDefinition(
        metric_id=metric_data.metric_id,
        metric_name=metric_data.metric_name,
        description=metric_data.description,
        owner=metric_data.owner,
        calculation_logic=metric_data.calculation_logic,
        source_tables=metric_data.source_tables,
        source_fields=metric_data.source_fields
    )
    db.add(metric)
    db.commit()
    db.refresh(metric)
    return metric


@app.get("/metrics", response_model=List[schemas.MetricDefinitionResponse])
def list_metrics(
    metric_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.MetricDefinition)
    if metric_id:
        query = query.filter(models.MetricDefinition.metric_id == metric_id)
    return query.all()


def main():
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    main()
