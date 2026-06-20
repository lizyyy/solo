from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routes.collisions import router as collisions_router
from .seed import seed_database


def create_app():
    app = FastAPI(title="幕墙节点碰撞预审 API", version="1.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    Base.metadata.create_all(bind=engine)

    @app.on_event("startup")
    async def startup_event():
        seed_database()

    @app.get("/api/health")
    async def health():
        return {"status": "ok", "service": "curtain-wall-collision-api"}

    app.include_router(collisions_router)

    return app


app = create_app()
