from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pathlib import Path

from database import init_db
from api import router as api_router

app = FastAPI(title="人工复判采样系统", version="1.0.0")

BASE_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=BASE_DIR / "templates")

app.include_router(api_router)


@app.on_event("startup")
def startup_event():
    init_db()


@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/review-samples/{sample_id}", response_class=HTMLResponse)
async def sample_detail(request: Request, sample_id: int):
    return templates.TemplateResponse("sample_detail.html", {"request": request, "sample_id": sample_id})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
