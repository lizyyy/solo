from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base, get_db
from app.routers import router
from app.auth import init_default_users

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="家电售后仓管理系统",
    description="解决工程师领件、旧件返还、厂商索赔对不上问题的后端系统",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix=settings.API_V1_STR)


@app.on_event("startup")
def startup_event():
    db = next(get_db())
    try:
        init_default_users(db)
        print("系统初始化完成")
    except Exception as e:
        print(f"初始化警告: {e}")
    finally:
        db.close()


@app.get("/")
def root():
    return {
        "message": "家电售后仓管理系统 API",
        "docs": "/docs",
        "api_version": settings.API_V1_STR
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
