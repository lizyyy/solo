from fastapi import FastAPI
from app.api import import_routes, query_routes, export_routes, review_routes
from app.db.database import engine, Base

app = FastAPI(
    title="宠物医院术后监护交接API",
    description="护士下夜班前合并麻醉记录、输液泵日志、笼位温氧传感器和用药计划，判断动物状态并生成交接单",
    version="1.0.0"
)

Base.metadata.create_all(bind=engine)

app.include_router(import_routes.router, prefix="/api/import", tags=["数据导入"])
app.include_router(query_routes.router, prefix="/api/query", tags=["查询接口"])
app.include_router(export_routes.router, prefix="/api/export", tags=["导出接口"])
app.include_router(review_routes.router, prefix="/api/review", tags=["复核改判"])

@app.get("/")
def root():
    return {"message": "宠物医院术后监护交接API", "version": "1.0.0"}
