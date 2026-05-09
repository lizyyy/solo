from datetime import datetime
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.database import Base, engine, SessionLocal
from app.models import DeviceCategory, SparePart, RepairWorker
from app.routers import router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="教室设备报修派单服务",
    description=(
        "校园教室设备报修系统。支持：报修单创建与状态跟踪、设备分类管理、"
        "智能派单与优先级计算、备件领用与库存管理、完工验收流程、校园统计分析。"
    ),
    version="1.0.0",
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    errors = []
    for err in exc.errors():
        field = ".".join([str(loc) for loc in err["loc"][1:]])
        errors.append(f"字段「{field}」：{err['msg']}")

    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "message": "请求参数有误",
            "details": errors,
            "code": "VALIDATION_ERROR",
        },
    )


def init_sample_data():
    db = SessionLocal()
    try:
        if db.query(DeviceCategory).count() == 0:
            categories = [
                DeviceCategory(code="projector", name="投影仪", description="教室投影设备", priority_weight=4),
                DeviceCategory(code="access_control", name="门禁系统", description="教室门禁", priority_weight=5),
                DeviceCategory(code="aircon", name="空调", description="空调制冷设备", priority_weight=3),
                DeviceCategory(code="computer", name="计算机", description="教学电脑", priority_weight=3),
                DeviceCategory(code="lighting", name="照明", description="教室灯具电路", priority_weight=2),
            ]
            db.add_all(categories)

        if db.query(RepairWorker).count() == 0:
            workers = [
                RepairWorker(name="张师傅", phone="13800000001", specialty_category="投影设备、多媒体、通用电子", is_available=True, current_load=0),
                RepairWorker(name="李师傅", phone="13800000002", specialty_category="空调制冷、暖通、通用机电", is_available=True, current_load=1),
                RepairWorker(name="王师傅", phone="13800000003", specialty_category="门禁系统、安防、通用电子", is_available=True, current_load=0),
                RepairWorker(name="赵师傅", phone="13800000004", specialty_category="计算机设备、通用电子", is_available=False, current_load=2),
            ]
            db.add_all(workers)

        if db.query(SparePart).count() == 0:
            spares = [
                SparePart(code="BULB-001", name="投影灯泡", model="Philips UHP 200W", unit="个", stock_quantity=5, unit_price=450.0),
                SparePart(code="FILTER-001", name="空调过滤网", model="标准型", unit="套", stock_quantity=20, unit_price=35.0),
                SparePart(code="CARD-001", name="门禁读卡器", model="IC卡读卡器", unit="台", stock_quantity=3, unit_price=180.0),
                SparePart(code="LAMP-001", name="LED灯管", model="18W 600mm", unit="支", stock_quantity=50, unit_price=12.0),
                SparePart(code="CABLE-001", name="HDMI线", model="2.0版 3米", unit="条", stock_quantity=10, unit_price=25.0),
            ]
            db.add_all(spares)

        db.commit()
    finally:
        db.close()


init_sample_data()

app.include_router(router)


@app.get("/")
def root():
    return {
        "service": "教室设备报修派单服务",
        "version": "1.0.0",
        "status": "运行中",
        "docs": "/docs",
        "redoc": "/redoc",
    }
