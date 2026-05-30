from fastapi import FastAPI
from app.database import engine, Base
from app.routers import members, absences, rehearsals, arrangements, substitutes, history

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="合唱缺勤补位排表服务",
    description="合唱团排练站位安排后端服务",
    version="1.0.0"
)

app.include_router(members.router)
app.include_router(absences.router)
app.include_router(rehearsals.router)
app.include_router(arrangements.router)
app.include_router(substitutes.router)
app.include_router(history.router)


@app.get("/")
def root():
    return {
        "service": "合唱缺勤补位排表服务",
        "version": "1.0.0",
        "endpoints": {
            "members": "/members",
            "absences": "/absences",
            "rehearsals": "/rehearsals",
            "arrangements": "/arrangements",
            "substitutes": "/substitutes",
            "history": "/history"
        },
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
