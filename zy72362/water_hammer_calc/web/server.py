from __future__ import annotations
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from ..api.main import app as api_app

app = FastAPI()

app.mount("/api", api_app)

app.mount("/static", StaticFiles(directory="water_hammer_calc/web/static"), name="static")

templates = Jinja2Templates(directory="water_hammer_calc/web/templates")


@app.get("/", response_class=HTMLResponse)
def dashboard(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request})


@app.get("/calculations/{calc_id}", response_class=HTMLResponse)
def calculation_detail(request: Request, calc_id: str):
    return templates.TemplateResponse("calc_detail.html", {"request": request, "calc_id": calc_id})


@app.get("/calculations/{calc_id}/replay", response_class=HTMLResponse)
def calculation_replay(request: Request, calc_id: str):
    return templates.TemplateResponse("calc_replay.html", {"request": request, "calc_id": calc_id})
