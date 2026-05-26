from fastapi import FastAPI

from app.config import settings
from app.database import Base, engine
from app.routers import batches, exports, items

Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.app_name, version="0.1.0")

app.include_router(batches.router)
app.include_router(items.router)
app.include_router(exports.router)


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.app_name}
