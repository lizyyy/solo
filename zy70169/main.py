from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
import os

from models.database import init_db
from routers.api import router as api_router

app = FastAPI(
    title="模型发布审批 API",
    description="模型从训练到上线的审批管理系统，支持评测、灰度审批、流量切换和回滚",
    version="1.0.0"
)

static_dir = os.path.join(os.path.dirname(__file__), "static")
templates_dir = os.path.join(os.path.dirname(__file__), "templates")

if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

templates = None
if os.path.exists(templates_dir):
    templates = Jinja2Templates(directory=templates_dir)

app.include_router(api_router, prefix="/api/v1", tags=["模型发布审批"])


@app.on_event("startup")
def startup_event():
    init_db()


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def index(request: Request):
    if templates:
        return templates.TemplateResponse("index.html", {"request": request})
    return HTMLResponse(
        """
        <html>
            <head><title>模型发布审批系统</title></head>
            <body>
                <h1>模型发布审批系统</h1>
                <p>API 文档: <a href="/docs">/docs</a></p>
            </body>
        </html>
        """
    )
