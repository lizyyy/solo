from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import migration, approval, execution, export
from app.core.database import engine, Base
from app.initial_data import init_db

Base.metadata.create_all(bind=engine)

app = FastAPI(title="数据库迁移审批台", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(migration.router, prefix="/api/migration", tags=["迁移脚本"])
app.include_router(approval.router, prefix="/api/approval", tags=["审批链路"])
app.include_router(execution.router, prefix="/api/execution", tags=["执行日志"])
app.include_router(export.router, prefix="/api/export", tags=["导出"])

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/")
def root():
    return {"message": "数据库迁移审批台 API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)