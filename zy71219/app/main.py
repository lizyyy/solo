from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine
from app.routers import letters_of_credit, documents, discrepancies, clauses, reports

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="信用证单据不符API",
    description="外贸信用证单据不符点检查管理系统，支持条款解析、单据比对、版本留痕、不符分类和报告导出",
    version="1.0.0",
    contact={
        "name": "外贸单证系统",
        "url": "http://localhost:8000",
    },
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(letters_of_credit.router)
app.include_router(documents.router)
app.include_router(discrepancies.router)
app.include_router(clauses.router)
app.include_router(reports.router)


@app.get("/", tags=["系统"])
def root():
    return {
        "name": "信用证单据不符API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "endpoints": {
            "信用证管理": "/api/letters-of-credit",
            "单据管理": "/api/documents",
            "不符点管理": "/api/discrepancies",
            "条款解析": "/api/clauses",
            "报告导出": "/api/reports",
        }
    }


@app.get("/health", tags=["系统"])
def health_check():
    return {"status": "healthy", "timestamp": "2024-01-01T00:00:00Z"}


@app.get("/api/version-history/{related_type}/{related_id}", tags=["版本管理"])
def get_version_history(related_type: str, related_id: int):
    from sqlalchemy.orm import Session
    from app.database import get_db
    from fastapi import Depends
    from app.core import VersionManager
    from app.schemas import ApiResponse, VersionRecord

    db: Session = Depends(get_db).__next__()
    version_manager = VersionManager(db)
    history = version_manager.get_version_history(related_type.upper(), related_id)

    return ApiResponse(
        success=True,
        message="查询成功",
        data={"total": len(history), "items": [VersionRecord.model_validate(h) for h in history]}
    )
