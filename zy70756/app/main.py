from fastapi import FastAPI
from app.core.database import engine, Base
from app.api.routes import router as csv_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="CSV to NDJSON Converter API",
    description="API for converting CSV files to NDJSON with encoding detection, column mapping, and bad row handling",
    version="1.0.0"
)

app.include_router(csv_router)


@app.get("/")
def root():
    return {
        "message": "CSV to NDJSON Converter API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
