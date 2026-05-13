#!/usr/bin/env python3
from fastapi import FastAPI
from contextlib import asynccontextmanager
from database import engine, Base
from api import router as api_router
from exceptions import (
    TicketAttributionException,
    exception_handler,
    generic_exception_handler
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="异常工单归因 API",
    description="异常工单归因系统 - 归属匹配、相似合并、根因标注、派单管理",
    version="1.0.0",
    lifespan=lifespan
)

app.add_exception_handler(TicketAttributionException, exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "ticket-attribution-api"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)