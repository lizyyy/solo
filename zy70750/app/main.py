from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app.api.routes import router as core_router
from app.api.processing import router as processing_router
from app.core.database import engine, Base

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="脱敏规则回归差异报告API",
    description="脱敏规则回归差异报告失败行保留后端API",
    version="1.0.0"
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": str(exc),
            "error_code": "internal_server_error"
        }
    )


app.include_router(core_router)
app.include_router(processing_router)


@app.get("/")
def root():
    return {
        "message": "脱敏规则回归差异报告API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
