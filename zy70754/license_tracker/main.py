from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import dependencies, licenses, exceptions, reports

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="许可证例外到期日期包路径追踪API",
    description="追踪依赖许可证例外规则、到期日期和包路径追踪系统",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dependencies.router, prefix="/api/v1/dependencies", tags=["dependencies"])
app.include_router(licenses.router, prefix="/api/v1/licenses", tags=["licenses"])
app.include_router(exceptions.router, prefix="/api/v1/exceptions", tags=["exceptions"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["reports"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}
