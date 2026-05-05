from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os

from config import settings, ensure_dirs
from scanner.file_watcher import FileScanner
from preflight.engine import PreflightEngine


_scanner: FileScanner = None
_preflight_engine: PreflightEngine = None


def get_scanner() -> FileScanner:
    return _scanner


def get_preflight_engine() -> PreflightEngine:
    return _preflight_engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scanner, _preflight_engine
    
    ensure_dirs()
    
    _scanner = FileScanner()
    _preflight_engine = PreflightEngine()
    
    def on_new_order(work_order):
        stocks = _scanner.get_all_paper_stocks()
        maintenance = _scanner.get_all_maintenance_records()
        templates = _scanner.get_all_cutting_templates()
        
        _preflight_engine.update_paper_stocks(stocks)
        _preflight_engine.update_maintenance_records(maintenance)
        _preflight_engine.update_templates(templates)
        
        result = _preflight_engine.run_preflight(work_order)
        _scanner.add_preflight_result(result)
    
    def on_data_updated(*args):
        stocks = _scanner.get_all_paper_stocks()
        maintenance = _scanner.get_all_maintenance_records()
        templates = _scanner.get_all_cutting_templates()
        
        _preflight_engine.update_paper_stocks(stocks)
        _preflight_engine.update_maintenance_records(maintenance)
        _preflight_engine.update_templates(templates)
    
    _scanner.on_new_order = on_new_order
    _scanner.on_stock_updated = on_data_updated
    _scanner.on_maintenance_updated = on_data_updated
    _scanner.on_template_updated = on_data_updated
    
    yield
    
    _scanner.stop()


def create_app() -> FastAPI:
    app = FastAPI(
        title="印刷店自动化工具",
        description="小型印刷店本地自动化工具 - 预检、查询、复核系统",
        version="1.0.0",
        lifespan=lifespan
    )
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    from web.routes import (
        orders_router,
        stocks_router,
        maintenance_router,
        templates_router,
        preflight_router,
        review_router,
        export_router
    )
    
    app.include_router(orders_router, prefix="/api/orders", tags=["工单管理"])
    app.include_router(stocks_router, prefix="/api/stocks", tags=["库存管理"])
    app.include_router(maintenance_router, prefix="/api/maintenance", tags=["保养管理"])
    app.include_router(templates_router, prefix="/api/templates", tags=["裁切模板"])
    app.include_router(preflight_router, prefix="/api/preflight", tags=["预检管理"])
    app.include_router(review_router, prefix="/api/review", tags=["复核管理"])
    app.include_router(export_router, prefix="/api/export", tags=["导出功能"])
    
    static_dir = os.path.join(os.path.dirname(__file__), "static")
    if os.path.exists(static_dir):
        app.mount("/static", StaticFiles(directory=static_dir), name="static")
    
    return app


app = create_app()
