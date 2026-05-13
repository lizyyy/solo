from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from app.api import datasets, freshness
from app.database import engine, Base
from app.exceptions import data_freshness_exception_handler, general_exception_handler, DataFreshnessException, create_error_response

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="接口数据新鲜度 API",
    description="数据集新鲜度管理与校验服务 - 提供新鲜度计算、缓存对比、水位核验、过期解释、订阅提醒等功能",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_exception_handler(DataFreshnessException, data_freshness_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(
        status_code=422,
        content=create_error_response(
            "VALIDATION_ERROR",
            "请求参数验证失败",
            {"errors": exc.errors()}
        )
    )


app.include_router(datasets.router, prefix="/api/v1/datasets", tags=["datasets"])
app.include_router(freshness.router, prefix="/api/v1/freshness", tags=["freshness"])


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "data-freshness-api"}
