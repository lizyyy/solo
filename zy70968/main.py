from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import batches, exports

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="园林喷洒作业追溯系统",
    description="园林项目经理喷洒作业记录与追溯服务",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(batches.router, prefix="/api/v1")
app.include_router(exports.router, prefix="/api/v1")


@app.get("/")
def root():
    return {
        "service": "园林喷洒作业追溯系统",
        "version": "1.0.0",
        "endpoints": {
            "batch_management": "/api/v1/batches/",
            "import": {
                "jobs_csv": "/api/v1/batches/jobs/import",
                "chemicals_json": "/api/v1/batches/chemicals/import",
                "weather_json": "/api/v1/batches/weather/import",
            },
            "exports": "/api/v1/exports/batches",
        },
    }


@app.get("/api/v1/health")
def health_check():
    return {"status": "healthy"}
