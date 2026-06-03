from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from interpolation_gauge.database import engine, Base
from interpolation_gauge.api.routes import router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="插值曲线仪表修补系统",
    description="评分权重表导入 → 旧公式截图补看 → 反例列表更新，边界值等于阈值留待任课老师复核",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def root():
    return {"service": "插值曲线仪表修补系统", "version": "1.0.0"}
