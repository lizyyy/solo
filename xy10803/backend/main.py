from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import engine, Base
from app.api.templates import router as templates_router
from app.api.sandboxes import router as sandboxes_router
from app.api.batches import router as batches_router
from app.api.cleanup import router as cleanup_router
from app.api.logs import router as logs_router
from app.api.pages import router as pages_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Sandbox Data Seed API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="../frontend/static"), name="static")
templates = Jinja2Templates(directory="../frontend/templates")

app.include_router(pages_router)
app.include_router(templates_router, prefix="/api/v1")
app.include_router(sandboxes_router, prefix="/api/v1")
app.include_router(batches_router, prefix="/api/v1")
app.include_router(cleanup_router, prefix="/api/v1")
app.include_router(logs_router, prefix="/api/v1")


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "sandbox-data-seed"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
