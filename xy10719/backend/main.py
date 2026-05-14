from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import samples, masking, approval, compliance

app = FastAPI(title="数据脱敏规则试验台", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(samples.router, prefix="/api/samples", tags=["样例数据"])
app.include_router(masking.router, prefix="/api/masking", tags=["脱敏策略"])
app.include_router(approval.router, prefix="/api/approval", tags=["例外审批"])
app.include_router(compliance.router, prefix="/api/compliance", tags=["合规记录"])

@app.get("/")
async def root():
    return {"message": "数据脱敏规则试验台 API", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
