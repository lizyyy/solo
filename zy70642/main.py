from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import action_items, meetings, reports
from exceptions import register_exception_handlers

Base.metadata.create_all(bind=engine)

app = FastAPI(title="会议纪要行动项延期识别API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(action_items.router, prefix="/api/action-items", tags=["行动项"])
app.include_router(meetings.router, prefix="/api/meetings", tags=["会议纪要"])
app.include_router(reports.router, prefix="/api/reports", tags=["报告导出"])

@app.get("/")
async def root():
    return {"message": "会议纪要行动项延期识别API", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
