from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import master_data, import_data, plans


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="临时改线安全核对器",
    description="校车临时改线安全核对后端服务 - 支持容量校验、时间窗校验、司机资质校验、接送人授权校验、重复接送校验和交接记录校验",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(master_data.router)
app.include_router(import_data.router)
app.include_router(plans.router)


@app.get("/")
def root():
    return {
        "name": "临时改线安全核对器",
        "version": "0.1.0",
        "status": "运行中",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
