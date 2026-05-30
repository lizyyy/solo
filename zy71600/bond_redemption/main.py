from fastapi import FastAPI
from database import engine, Base
from routers import entry, process, review, export

Base.metadata.create_all(bind=engine)

app = FastAPI(title="企业债赎回现金流预警系统", version="1.0.0")

app.include_router(entry.router, prefix="/api/entry", tags=["数据录入"])
app.include_router(process.router, prefix="/api/process", tags=["核心处理"])
app.include_router(review.router, prefix="/api/review", tags=["复核"])
app.include_router(export.router, prefix="/api/export", tags=["导出"])


@app.get("/")
def root():
    return {"system": "企业债赎回现金流预警", "version": "1.0.0"}
