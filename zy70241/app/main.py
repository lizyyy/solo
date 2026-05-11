from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from app.database import engine, Base
from app.api import filter, water_quality, water_volume, complaints, predictions, replacement

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="净水站滤芯寿命预测器",
    description="基于水量、水质和投诉记录的滤芯寿命预测系统",
    version="1.0.0"
)

app.include_router(filter.router, prefix="/api/filters", tags=["滤芯管理"])
app.include_router(water_quality.router, prefix="/api/water-quality", tags=["水质指标"])
app.include_router(water_volume.router, prefix="/api/water-volume", tags=["水量记录"])
app.include_router(complaints.router, prefix="/api/complaints", tags=["投诉管理"])
app.include_router(predictions.router, prefix="/api/predictions", tags=["寿命预测"])
app.include_router(replacement.router, prefix="/api/replacement", tags=["更换管理"])

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/health")
def health_check():
    return {"status": "healthy", "message": "净水站滤芯寿命预测器运行中"}
