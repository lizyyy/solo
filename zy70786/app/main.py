from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.api import router as api_router
from app.exceptions import BundleBudgetException

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Bundle Budget API",
    description="API for managing frontend bundle size budgets and analyzing build artifacts",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(BundleBudgetException)
async def bundle_budget_exception_handler(request: Request, exc: BundleBudgetException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error_code": exc.error_code,
            "message": exc.detail,
            "details": exc.details,
        },
    )


@app.get("/")
def root():
    return {
        "name": "Bundle Budget API",
        "version": "0.1.0",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


app.include_router(api_router, prefix=settings.API_V1_STR)


def main():
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    main()
