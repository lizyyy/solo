from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import sessions, boxoffice, contracts, reconciliation, reports
from database import engine, Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="院线对账服务", description="院线场次、票房、合同对账系统")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions.router, prefix="/api/sessions", tags=["场次管理"])
app.include_router(boxoffice.router, prefix="/api/boxoffice", tags=["票房管理"])
app.include_router(contracts.router, prefix="/api/contracts", tags=["合同管理"])
app.include_router(reconciliation.router, prefix="/api/reconciliation", tags=["对账管理"])
app.include_router(reports.router, prefix="/api/reports", tags=["报告管理"])


@app.get("/")
def root():
    return {"message": "院线对账服务运行中", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
