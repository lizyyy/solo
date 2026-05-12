from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from app.config import settings
from app.database import engine, Base
from app.routes import routes_api, tasks_api, faults_api, reports_api, master_api
from app.utils.exceptions import BusinessException
from samples import demo_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    description="""
售卖机补货路线 API - 围绕自动售卖机补货的综合业务系统

核心能力:
- 补货任务管理：结合缺货、保质期、销量预测创建补货任务
- 路线规划：考虑补货车容量限制，支持任务拆分和多路线分配
- 故障管理：故障插单、暂停故障机器补货、故障优先级
- 状态追踪：完整的历史记录、状态变化轨迹
- 幂等性保障：重复执行/重复回调保持幂等
- 人工修正：记录前后差异和操作者
- 报告导出：日报生成、Excel导出

业务规则:
- 同一机器同一时间只能有一个待处理任务（重复派单保护）
- 路线容量不足时自动校验，需拆分任务或增加路线
- 临期商品（默认3天内）自动标记为需回收
- 故障机器自动暂停补货
""",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(BusinessException)
async def business_exception_handler(request: Request, exc: BusinessException):
    return JSONResponse(
        status_code=400,
        content={
            "code": exc.code,
            "message": exc.message,
            "details": exc.details
        }
    )


app.include_router(master_api.router)
app.include_router(tasks_api.router)
app.include_router(routes_api.router)
app.include_router(faults_api.router)
app.include_router(reports_api.router)


@app.get("/")
def root():
    return {
        "name": settings.API_TITLE,
        "version": settings.API_VERSION,
        "status": "running",
        "docs": "/docs",
        "sample_data": "/api/samples/init",
        "demo_paths": {
            "normal_flow": "查看 docs 中的 Demo: 正常补货流程",
            "capacity_split": "查看 docs 中的 Demo: 容量不足拆分",
            "expiry_recovery": "查看 docs 中的 Demo: 临期回收",
            "fault_interrupt": "查看 docs 中的 Demo: 故障插单"
        }
    }


@app.post("/api/samples/init", tags=["Samples"])
def init_sample_data():
    return demo_data.init_all_samples()


@app.post("/api/samples/reset", tags=["Samples"])
def reset_sample_data():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    return {"message": "Database reset successfully"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
