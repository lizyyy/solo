from fastapi import FastAPI
from database import engine, Base
from routers import scores, fingering, annotations, reports, audit

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="古琴谱指法校对器",
    description="古琴减字谱指法校对、版本比对、批注留痕与异常定位服务",
    version="1.0.0",
)

app.include_router(scores.router)
app.include_router(fingering.router)
app.include_router(annotations.router)
app.include_router(reports.router)
app.include_router(audit.router)


@app.get("/health")
def health():
    return {"status": "ok"}
