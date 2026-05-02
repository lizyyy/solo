from fastapi import FastAPI
from app.database import init_db
from app.routers import batches, linen, anomalies, reports

app = FastAPI(title="布草送洗周转追踪系统", version="1.0.0")

@app.on_event("startup")
def startup():
    init_db()

app.include_router(batches.router)
app.include_router(linen.router)
app.include_router(anomalies.router)
app.include_router(reports.router)

@app.get("/")
def root():
    return {
        "message": "布草送洗周转追踪系统",
        "docs": "/docs"
    }
