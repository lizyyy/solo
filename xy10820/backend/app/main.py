from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine
from . import models
from .routers import suppliers, products, catalog, mappings, sync

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="供应商目录映射 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(suppliers.router)
app.include_router(products.router)
app.include_router(catalog.router)
app.include_router(mappings.router)
app.include_router(sync.router)


@app.get("/")
def root():
    return {"message": "Supplier Catalog Mapping API", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
