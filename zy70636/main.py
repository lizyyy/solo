from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import customer, category, weighing, price, deduction, settlement, audit, export

Base.metadata.create_all(bind=engine)

app = FastAPI(title="称重价格扣杂结算复核系统", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(customer.router, prefix="/api/customers", tags=["客户管理"])
app.include_router(category.router, prefix="/api/categories", tags=["品类管理"])
app.include_router(weighing.router, prefix="/api/weighings", tags=["称重记录"])
app.include_router(price.router, prefix="/api/prices", tags=["价格管理"])
app.include_router(deduction.router, prefix="/api/deductions", tags=["扣杂管理"])
app.include_router(settlement.router, prefix="/api/settlements", tags=["结算管理"])
app.include_router(audit.router, prefix="/api/audits", tags=["审计日志"])
app.include_router(export.router, prefix="/api/export", tags=["报告导出"])


@app.get("/")
def root():
    return {"message": "称重价格扣杂结算复核系统 API", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
