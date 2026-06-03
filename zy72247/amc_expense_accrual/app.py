from fastapi import FastAPI
from .api.routes import router

app = FastAPI(
    title="资管计划费用预提",
    description="除权日截图与税费率备注证据整合、差异清单版本管理、拆行判定与复核",
    version="1.0.0",
)

app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok"}
