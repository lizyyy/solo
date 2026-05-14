from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import engine, Base
from api.tickets import router as tickets_router
from api.config import router as config_router
from api.export import router as export_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    init_sample_data()
    yield


app = FastAPI(
    title="工单SLA时钟API",
    description="工单SLA管理系统 - 支持暂停、升级、补偿、审批、导出等功能",
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

app.include_router(tickets_router)
app.include_router(config_router)
app.include_router(export_router)


def init_sample_data():
    from sqlalchemy.orm import Session
    from models import SLARule, PauseReason, Holiday

    db = Session(bind=engine)

    try:
        if db.query(SLARule).count() == 0:
            sample_rules = [
                SLARule(
                    name="标准SLA",
                    description="普通工单标准处理时间",
                    priority="normal",
                    response_hours=4,
                    resolution_hours=24,
                    work_start_hour=9,
                    work_end_hour=18,
                    work_days="1,2,3,4,5"
                ),
                SLARule(
                    name="紧急SLA",
                    description="紧急工单快速处理",
                    priority="high",
                    response_hours=1,
                    resolution_hours=8,
                    work_start_hour=9,
                    work_end_hour=18,
                    work_days="1,2,3,4,5"
                ),
                SLARule(
                    name="24x7 SLA",
                    description="全天候支持",
                    priority="critical",
                    response_hours=0.5,
                    resolution_hours=4,
                    work_start_hour=0,
                    work_end_hour=24,
                    work_days="0,1,2,3,4,5,6"
                )
            ]
            db.add_all(sample_rules)

        if db.query(PauseReason).count() == 0:
            sample_reasons = [
                PauseReason(code="wait_customer", name="等待客户回复", category="客户相关"),
                PauseReason(code="wait_third_party", name="等待第三方支持", category="外部依赖"),
                PauseReason(code="wait_info", name="等待补充信息", category="信息收集"),
                PauseReason(code="holiday", name="节假日暂停", category="时间相关"),
                PauseReason(code="approval", name="审批流程中", category="内部流程")
            ]
            db.add_all(sample_reasons)

        if db.query(Holiday).count() == 0:
            sample_holidays = [
                Holiday(date="2025-01-01", name="元旦", type="holiday"),
                Holiday(date="2025-02-10", name="春节", type="holiday"),
                Holiday(date="2025-02-11", name="春节", type="holiday"),
                Holiday(date="2025-02-12", name="春节", type="holiday"),
                Holiday(date="2025-04-04", name="清明节", type="holiday"),
                Holiday(date="2025-05-01", name="劳动节", type="holiday"),
                Holiday(date="2025-06-22", name="端午节", type="holiday"),
                Holiday(date="2025-10-01", name="国庆节", type="holiday"),
                Holiday(date="2025-10-02", name="国庆节", type="holiday"),
                Holiday(date="2025-10-03", name="国庆节", type="holiday")
            ]
            db.add_all(sample_holidays)

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"初始化数据失败: {e}")
    finally:
        db.close()


@app.get("/")
def root():
    return {
        "message": "工单SLA时钟API",
        "version": "1.0.0",
        "docs": "/docs",
        "features": [
            "工单管理",
            "SLA计时与暂停",
            "SLA规则配置",
            "暂停原因管理",
            "节假日管理",
            "工单升级流程",
            "审批流程",
            "SLA补偿机制",
            "时间线追踪",
            "Excel报表导出",
            "四条SLA路径: 成功、拦截、补偿、人工复核"
        ]
    }


@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": "2025-01-01T00:00:00"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
