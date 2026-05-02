from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from . import models
from .database import engine
from .routes import samples, alerts, trace, import as import_routes

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="食堂留样追溯系统", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(samples.router)
app.include_router(import_routes.router)
app.include_router(alerts.router)
app.include_router(trace.router)


@app.get("/")
def read_root():
    return {
        "message": "食堂留样追溯系统",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
