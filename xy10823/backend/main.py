from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware

from backend.app.database import engine, Base
from backend.app.api import router as api_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="物流面单代理API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


@app.get("/")
async def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/record/{record_id}")
async def record_detail(request: Request, record_id: int):
    return templates.TemplateResponse("record.html", {"request": request, "record_id": record_id})


@app.get("/batch/{batch_id}")
async def batch_detail(request: Request, batch_id: int):
    return templates.TemplateResponse("batch.html", {"request": request, "batch_id": batch_id})


app.include_router(api_router, prefix="/api/v1")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
