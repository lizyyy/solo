from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import routes
import uvicorn

app = FastAPI(title="RAG知识片段质检系统")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes.router, prefix="/api", tags=["api"])

@app.get("/")
def root():
    return {"message": "RAG Quality Check System"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
