from fastapi import FastAPI
from app.api.tasks import router as tasks_router


def create_app(init_db: bool = True) -> FastAPI:
    app = FastAPI(
        title="流式任务断点API",
        description="支持长时间流式处理任务中断后从正确位置继续的后端服务",
        version="1.0.0"
    )

    if init_db:
        from app.database import engine, Base
        Base.metadata.create_all(bind=engine)

    app.include_router(tasks_router, prefix="/api/v1")

    @app.get("/health")
    def health_check():
        return {"status": "healthy"}

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
