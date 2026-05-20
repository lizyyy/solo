from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import router as api_router
from app.database import engine, Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="法务对账服务 API", description="合同盖章、授权审批、快递寄出对账系统", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "法务对账服务 API", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
