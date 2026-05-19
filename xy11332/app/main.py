from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import tasks, escorts, patients
from .database import engine
from . import models

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="门诊服务台陪检调度系统", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(escorts.router, prefix="/api/escorts", tags=["escorts"])
app.include_router(patients.router, prefix="/api/patients", tags=["patients"])


@app.get("/")
def root():
    return {"message": "门诊服务台陪检调度系统", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}