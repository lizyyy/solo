from __future__ import annotations

from fastapi import FastAPI

from .routes import router

app = FastAPI(title="驿站滞留件处理 API", version="0.1.0")
app.include_router(router)


@app.get("/")
def root():
    return {"service": "station-overstay-api", "docs": "/docs"}
