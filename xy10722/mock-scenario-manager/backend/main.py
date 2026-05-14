from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import scenarios, approvals, mock
from database import engine, Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Mock Scenario Manager", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scenarios.router, prefix="/api/scenarios", tags=["scenarios"])
app.include_router(approvals.router, prefix="/api/approvals", tags=["approvals"])
app.include_router(mock.router, prefix="/api/mock", tags=["mock"])

@app.get("/")
async def root():
    return {"message": "Mock Scenario Manager API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)