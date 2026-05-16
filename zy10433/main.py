from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
import json

import database
import schemas
import services

database.init_db()

app = FastAPI(
    title="API变更订阅服务",
    description="订阅API变更通知，支持确认、重试和报告导出",
    version="1.0.0"
)


@app.get("/")
async def root():
    return {"message": "API Change Subscription Service", "version": "1.0.0"}


@app.post("/subscribers/", response_model=schemas.Subscriber, tags=["订阅方"])
def create_subscriber(subscriber: schemas.SubscriberCreate, db: Session = Depends(database.get_db)):
    return services.create_subscriber(db, subscriber)


@app.get("/subscribers/", response_model=list[schemas.Subscriber], tags=["订阅方"])
def get_subscribers(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    return services.get_subscribers(db, skip, limit)


@app.get("/subscribers/{subscriber_id}", response_model=schemas.Subscriber, tags=["订阅方"])
def get_subscriber(subscriber_id: int, db: Session = Depends(database.get_db)):
    db_subscriber = services.get_subscriber(db, subscriber_id)
    if db_subscriber is None:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    return db_subscriber


@app.post("/api-paths/", response_model=schemas.ApiPath, tags=["API路径"])
def create_api_path(api_path: schemas.ApiPathCreate, db: Session = Depends(database.get_db)):
    return services.create_api_path(db, api_path)


@app.get("/api-paths/", response_model=list[schemas.ApiPath], tags=["API路径"])
def get_api_paths(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    return services.get_api_paths(db, skip, limit)


@app.get("/api-paths/{api_path_id}", response_model=schemas.ApiPath, tags=["API路径"])
def get_api_path(api_path_id: int, db: Session = Depends(database.get_db)):
    db_api_path = services.get_api_path(db, api_path_id)
    if db_api_path is None:
        raise HTTPException(status_code=404, detail="API Path not found")
    return db_api_path


@app.post("/change-types/", response_model=schemas.ChangeType, tags=["变更类型"])
def create_change_type(change_type: schemas.ChangeTypeCreate, db: Session = Depends(database.get_db)):
    db_change_type = services.get_change_type_by_code(db, change_type.code)
    if db_change_type:
        return db_change_type
    return services.create_change_type(db, change_type)


@app.get("/change-types/", response_model=list[schemas.ChangeType], tags=["变更类型"])
def get_change_types(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    return services.get_change_types(db, skip, limit)


@app.get("/change-types/{change_type_id}", response_model=schemas.ChangeType, tags=["变更类型"])
def get_change_type(change_type_id: int, db: Session = Depends(database.get_db)):
    db_change_type = services.get_change_type(db, change_type_id)
    if db_change_type is None:
        raise HTTPException(status_code=404, detail="Change Type not found")
    return db_change_type


@app.post("/subscriptions/", response_model=schemas.Subscription, tags=["订阅"])
def create_subscription(subscription: schemas.SubscriptionCreate, db: Session = Depends(database.get_db)):
    return services.create_subscription(db, subscription)


@app.get("/subscriptions/", response_model=list[schemas.Subscription], tags=["订阅"])
def get_subscriptions(
    subscriber_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(database.get_db)
):
    return services.get_subscriptions(db, subscriber_id, skip, limit)


@app.get("/subscriptions/{subscription_id}", response_model=schemas.Subscription, tags=["订阅"])
def get_subscription(subscription_id: int, db: Session = Depends(database.get_db)):
    db_subscription = services.get_subscription(db, subscription_id)
    if db_subscription is None:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return db_subscription


@app.post("/api-changes/", response_model=schemas.ApiChange, tags=["API变更"])
def create_api_change(api_change: schemas.ApiChangeCreate, db: Session = Depends(database.get_db)):
    try:
        return services.create_api_change(db, api_change)
    except Exception as e:
        error_log = schemas.ErrorLog(
            timestamp=datetime.utcnow(),
            error_type="create_api_change_error",
            message=str(e),
            raw_input=json.dumps(api_change.model_dump()),
            processing_result="failed"
        )
        raise HTTPException(status_code=500, detail=error_log.model_dump())


@app.get("/api-changes/", response_model=list[schemas.ApiChange], tags=["API变更"])
def get_api_changes(
    is_processed: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(database.get_db)
):
    return services.get_api_changes(db, is_processed, skip, limit)


@app.get("/api-changes/{api_change_id}", response_model=schemas.ApiChange, tags=["API变更"])
def get_api_change(api_change_id: int, db: Session = Depends(database.get_db)):
    db_api_change = services.get_api_change(db, api_change_id)
    if db_api_change is None:
        raise HTTPException(status_code=404, detail="API Change not found")
    return db_api_change


@app.post("/api-changes/{api_change_id}/mark-correction", response_model=schemas.ApiChange, tags=["人工修正"])
def mark_manual_correction(api_change_id: int, correction_note: str, db: Session = Depends(database.get_db)):
    db_api_change = services.mark_manual_correction(db, api_change_id, correction_note)
    if db_api_change is None:
        raise HTTPException(status_code=404, detail="API Change not found")
    return db_api_change


@app.post("/api-changes/{api_change_id}/correction-done", response_model=schemas.ApiChange, tags=["人工修正"])
def manual_correction_done(api_change_id: int, processing_result: str, db: Session = Depends(database.get_db)):
    db_api_change = services.manual_correction_done(db, api_change_id, processing_result)
    if db_api_change is None:
        raise HTTPException(status_code=404, detail="API Change not found")
    return db_api_change


@app.post("/api-changes/{api_change_id}/process", tags=["状态推进"])
def process_api_change(api_change_id: int, db: Session = Depends(database.get_db)):
    try:
        notification_count, duplicate_count = services.process_api_change(db, api_change_id)
        return {
            "api_change_id": api_change_id,
            "notification_count": notification_count,
            "duplicate_count": duplicate_count,
            "message": f"Processed successfully: {notification_count} notifications created, {duplicate_count} duplicates skipped"
        }
    except Exception as e:
        error_log = schemas.ErrorLog(
            timestamp=datetime.utcnow(),
            error_type="process_api_change_error",
            message=str(e),
            raw_input=f"api_change_id={api_change_id}",
            processing_result="failed"
        )
        raise HTTPException(status_code=500, detail=error_log.model_dump())


@app.get("/batches/", response_model=list[schemas.NotificationBatch], tags=["通知批次"])
def get_batches(
    api_change_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(database.get_db)
):
    return services.get_batches(db, api_change_id, skip, limit)


@app.post("/batches/{batch_id}/retry", tags=["批次补发"])
def retry_batch(batch_id: int, db: Session = Depends(database.get_db)):
    retry_count = services.retry_batch(db, batch_id)
    if retry_count is None:
        raise HTTPException(status_code=400, detail="Batch not found or max retry limit reached")
    return {
        "batch_id": batch_id,
        "retried_notifications": retry_count,
        "message": f"Successfully retried {retry_count} notifications"
    }


@app.get("/notifications/", response_model=list[schemas.Notification], tags=["通知"])
def get_notifications(
    subscriber_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(database.get_db)
):
    return services.get_notifications(db, subscriber_id, status, skip, limit)


@app.get("/notifications/{notification_id}", response_model=schemas.Notification, tags=["通知"])
def get_notification(notification_id: int, db: Session = Depends(database.get_db)):
    db_notification = services.get_notification(db, notification_id)
    if db_notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    return db_notification


@app.post("/notifications/{notification_id}/confirm", response_model=schemas.Notification, tags=["确认状态"])
def confirm_notification(
    notification_id: int,
    confirm_data: schemas.NotificationConfirm,
    db: Session = Depends(database.get_db)
):
    db_notification = services.confirm_notification(db, notification_id, confirm_data.confirmation_note)
    if db_notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    return db_notification


@app.post("/notifications/check-timeout", tags=["确认超时"])
def check_confirmation_timeout(db: Session = Depends(database.get_db)):
    expired_count = services.check_confirmation_timeout(db)
    return {
        "expired_count": expired_count,
        "message": f"Marked {expired_count} notifications as expired"
    }


@app.get("/reports/subscription", response_model=schemas.SubscriptionReport, tags=["订阅报告"])
def get_subscription_report(
    subscriber_id: Optional[int] = None,
    db: Session = Depends(database.get_db)
):
    return services.generate_subscription_report(db, subscriber_id)


@app.get("/reports/subscription/export", tags=["订阅报告"])
def export_subscription_report(
    subscriber_id: Optional[int] = None,
    format: str = Query("json", enum=["json", "csv"])
):
    db = next(database.get_db())
    report = services.generate_subscription_report(db, subscriber_id)
    
    if format == "csv":
        csv_lines = ["subscriber_name,subscriber_email,api_path,api_method,change_type,change_title,notification_status,confirmed_at,confirm_deadline"]
        for item in report.items:
            confirmed_at_str = item.confirmed_at.isoformat() if item.confirmed_at else ""
            confirm_deadline_str = item.confirm_deadline.isoformat() if item.confirm_deadline else ""
            csv_lines.append(f'"{item.subscriber_name}","{item.subscriber_email}","{item.api_path}","{item.api_method}","{item.change_type}","{item.change_title}","{item.notification_status}","{confirmed_at_str}","{confirm_deadline_str}"')
        
        csv_content = "\n".join(csv_lines)
        return JSONResponse(
            content={"csv": csv_content},
            headers={"Content-Disposition": "attachment; filename=subscription_report.csv"}
        )
    
    return JSONResponse(content=report.model_dump())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
