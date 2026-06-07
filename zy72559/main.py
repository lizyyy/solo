from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from app.database import engine, Base
from app.routers.api import router as api_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="冷启动相似用户扩展系统")

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

app.include_router(api_router)


@app.get("/")
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/slice/{slice_id}")
async def slice_detail(request: Request, slice_id: int):
    return templates.TemplateResponse("slice_detail.html", {"request": request, "slice_id": slice_id})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
