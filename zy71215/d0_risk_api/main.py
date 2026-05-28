from fastapi import FastAPI

from routers.api import router

app = FastAPI(
    title="商户D0垫资风控API",
    version="0.1.0",
    description="轻量API：流水/退款/冻结/费率/垫资申请/风控报告一站式, 支持分批写入与版本追踪",
)

app.include_router(router, prefix="/api/v1", tags=["D0垫资风控"])
