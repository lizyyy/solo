from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from app import models, services
from app.database import engine, get_db
from app.routers import batches, details

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="短租房水电押金结算 API",
    description="短租房押金结算系统，支持批次管理、材料上传、拆分结算、轨迹查询和报告生成",
    version="1.0.0",
)

app.include_router(batches.router)
app.include_router(details.router)


@app.get("/")
def root():
    return {
        "name": "短租房水电押金结算 API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/api/batches/{batch_no}/report/download")
def download_report(batch_no: str, db: Session = Depends(get_db)):
    batch = services.get_batch(db, batch_no)
    if not batch:
        raise HTTPException(status_code=404, detail=f"Batch {batch_no} not found")
    
    report = db.query(models.Report).filter(
        models.Report.batch_id == batch.id
    ).first()
    
    if not report:
        raise HTTPException(status_code=404, detail=f"Report for batch {batch_no} not found")
    
    return PlainTextResponse(
        content=report.report_content,
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename=deposit_report_{batch_no}.txt"
        }
    )
