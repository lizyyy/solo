from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import pets, cages, medical_orders, hospitalizations, reports

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="宠物医院住院笼位管理API",
    description="宠物医院住院笼位管理系统，支持宠物档案、笼位分配、住院医嘱和状态管理",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pets.router, prefix="/api/pets", tags=["宠物档案"])
app.include_router(cages.router, prefix="/api/cages", tags=["笼位管理"])
app.include_router(medical_orders.router, prefix="/api/medical-orders", tags=["住院医嘱"])
app.include_router(hospitalizations.router, prefix="/api/hospitalizations", tags=["住院管理"])
app.include_router(reports.router, prefix="/api/reports", tags=["报表看板"])


@app.get("/")
def root():
    return {"message": "宠物医院住院笼位管理API", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
