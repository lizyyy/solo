from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .database import Base, engine
from .routers import records, scores

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="乐谱版本校对器",
    version="1.0.0",
    description="管弦乐团总谱与分谱版本校对服务，检测小节号错位、声部缺页、旧版覆盖新版等问题。",
)

app.include_router(scores.router)
app.include_router(records.router)


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=422,
        content={"error_type": "business_rule_violation", "detail": str(exc)},
    )


@app.get("/health")
def health():
    return {"status": "ok"}
