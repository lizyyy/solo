from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import init_db
from app.api.routers import instruments, borrows, calibrations, approvals, exports, users

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="计量器具借用校准管理服务 - 面向车间器具借走后归还、校准、封存状态管理场景",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=400,
        content={"detail": str(exc)},
    )


@app.on_event("startup")
async def on_startup():
    init_db()


@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME}


app.include_router(instruments.router)
app.include_router(borrows.router)
app.include_router(calibrations.router)
app.include_router(approvals.router)
app.include_router(exports.router)
app.include_router(users.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
