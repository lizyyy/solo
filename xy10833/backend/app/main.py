from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from .core.database import engine, Base
from .api import router as api_router
from . import demo_data

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Feature Flag API Console", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")

frontend_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "frontend")
if os.path.exists(frontend_path):
    app.mount("/static", StaticFiles(directory=os.path.join(frontend_path, "dist")), name="static")
    
    @app.get("/")
    async def serve_frontend():
        index_path = os.path.join(frontend_path, "dist", "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return {"message": "Feature Flag API Console - Frontend not built yet"}


@app.on_event("startup")
async def startup_event():
    from sqlalchemy.orm import Session
    db = Session(bind=engine)
    try:
        demo_data.create_demo_data(db)
    finally:
        db.close()


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Feature Flag API Console"}
