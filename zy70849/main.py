from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from routers import claim, rules, history
from database import engine, Base
import os

Base.metadata.create_all(bind=engine)

app = FastAPI(title="理赔材料审核系统", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(claim.router, prefix="/api/claim", tags=["理赔审核"])
app.include_router(rules.router, prefix="/api/rules", tags=["规则管理"])
app.include_router(history.router, prefix="/api/history", tags=["历史记录"])

@app.get("/")
async def root():
    return {"message": "理赔材料审核系统 API", "version": "1.0.0"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
