from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .database import engine, Base, SessionLocal
from .models import Store, InspectionItem, DeductionRule
from .routers import master, inspection, report
from .services import BusinessRuleError


def init_db_data():
    db = SessionLocal()
    try:
        if db.query(Store).count() == 0:
            sample_stores = [
                Store(name="北京朝阳路店", code="ST001", region="华北区", city="北京", address="北京市朝阳区建国路88号"),
                Store(name="上海南京东路店", code="ST002", region="华东区", city="上海", address="上海市黄浦区南京东路100号"),
                Store(name="广州天河店", code="ST003", region="华南区", city="广州", address="广州市天河区天河路200号"),
                Store(name="深圳福田店", code="ST004", region="华南区", city="深圳", address="深圳市福田区福华路150号"),
                Store(name="杭州西湖店", code="ST005", region="华东区", city="杭州", address="杭州市西湖区湖滨路50号"),
            ]
            db.add_all(sample_stores)

        if db.query(InspectionItem).count() == 0:
            sample_items = [
                InspectionItem(name="环境卫生", code="ITEM001", category="环境", description="门店整体清洁状况", base_score=10.0),
                InspectionItem(name="商品陈列", code="ITEM002", category="商品", description="商品摆放规范", base_score=10.0),
                InspectionItem(name="员工着装", code="ITEM003", category="人员", description="员工制服和仪容仪表", base_score=10.0),
                InspectionItem(name="消防设施", code="ITEM004", category="安全", description="灭火器、应急灯等设备完好", base_score=10.0),
                InspectionItem(name="服务态度", code="ITEM005", category="服务", description="顾客服务态度", base_score=10.0),
            ]
            db.add_all(sample_items)

        if db.query(DeductionRule).count() == 0:
            sample_rules = [
                DeductionRule(name="通用一级", item_category=None, level=1, base_deduction=2.0, overdue_multiplier=1.5, retry_penalty=1.0, description="一般问题，逾期加50%扣分"),
                DeductionRule(name="通用二级", item_category=None, level=2, base_deduction=5.0, overdue_multiplier=2.0, retry_penalty=2.0, description="严重问题，逾期扣分翻倍"),
                DeductionRule(name="通用三级", item_category=None, level=3, base_deduction=10.0, overdue_multiplier=2.0, retry_penalty=3.0, description="重大问题，直接满分扣完"),
                DeductionRule(name="安全一级", item_category="安全", level=1, base_deduction=5.0, overdue_multiplier=2.0, retry_penalty=2.0, description="安全问题加倍处理"),
            ]
            db.add_all(sample_rules)

        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    init_db_data()
    yield


app = FastAPI(
    title="门店巡检整改 API",
    description="处理门店巡检、整改分派、照片证据、复查、扣分和区域报表",
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


@app.exception_handler(BusinessRuleError)
async def business_rule_exception_handler(request: Request, exc: BusinessRuleError):
    return JSONResponse(
        status_code=400,
        content={
            "error": exc.code or "business_rule_error",
            "message": exc.message
        }
    )


app.include_router(master.router)
app.include_router(inspection.router)
app.include_router(report.router)


@app.get("/")
def root():
    return {
        "service": "门店巡检整改 API",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "running"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
