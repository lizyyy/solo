from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.api import rebalance

Base.metadata.create_all(bind=engine)

app = FastAPI(title="分片重平衡审批API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rebalance.router, prefix="/api/v1/rebalance", tags=["rebalance"])


@app.get("/health")
def health_check():
    return {"status": "healthy"}
