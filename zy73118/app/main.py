from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.api import survey_router
from app import models  # noqa: F401  触发模型注册


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="旧楼测绘方案比选系统",
    description=(
        "面向社区公示的旧楼测绘方案审核流程。核心能力：\n"
        "1. 幂等提交：重复请求不重复计数，人工改判不重复入库\n"
        "2. 图层命名校验：混乱命名被拦截并说明原因\n"
        "3. 碰撞点坐标锚定：不依赖截图视角，按WGS84坐标直接沟通\n"
        "4. 人工改判异常分支：主流程可携带改判单走异常路径\n"
        "5. 历史快照：人工确认前后变化全程留痕\n"
        "6. 社区公示接口：返回可直接用于沟通的摘要，非功能清单"
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(survey_router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "旧楼测绘方案比选系统"}
