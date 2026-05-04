from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import tokenizer, experiment, inference, data

app = FastAPI(
    title="GPT原理沙盘",
    description="一个交互式的GPT原理演示工具",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tokenizer.router, prefix="/api/tokenizer", tags=["Tokenizer"])
app.include_router(experiment.router, prefix="/api/experiment", tags=["Experiment"])
app.include_router(inference.router, prefix="/api/inference", tags=["Inference"])
app.include_router(data.router, prefix="/api/data", tags=["Data"])


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "message": "GPT原理沙盘后端运行正常"}
