from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import batches, details

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="博物馆文物借展保险处理系统",
    description="为展陈部提供的文物借展保险材料登记、分类、复核与审计API服务",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(batches.router)
app.include_router(details.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "museum-loan-insurance"}


@app.get("/")
def root():
    return {
        "service": "博物馆文物借展保险处理系统",
        "docs": "/docs",
        "api": {
            "create_batch": "POST /api/batches",
            "upload_materials": "POST /api/batches/{batch_id}/materials",
            "list_details": "GET /api/batches/{batch_id}/details?category=normal|pending|intercepted",
            "review_detail": "POST /api/details/{detail_id}/review",
            "trajectory": "GET /api/details/{detail_id}/trajectory",
            "field_trace": "GET /api/details/{detail_id}/trace",
            "audit_logs": "GET /api/details/{detail_id}/audit",
            "rerun": "POST /api/details/{detail_id}/rerun",
        },
    }
