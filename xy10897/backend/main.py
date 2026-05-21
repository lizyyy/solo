from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import asyncio
from contextlib import asynccontextmanager

from app import models, schemas, services
from app.database import engine, get_db, SessionLocal

models.Base.metadata.create_all(bind=engine)


async def auto_expire_credentials():
    while True:
        try:
            db = SessionLocal()
            count = services.expire_credentials(db)
            if count > 0:
                print(f"[{datetime.now()}] 自动回收了 {count} 个过期凭证")
            db.close()
        except Exception as e:
            print(f"自动回收任务出错: {e}")
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(auto_expire_credentials())
    print("后台任务已启动：自动回收过期凭证（每分钟检查一次）")
    yield
    task.cancel()
    print("后台任务已停止")


app = FastAPI(title="开发者访问申请台 API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "开发者访问申请台 API", "version": "1.0"}


@app.post("/api/applications", response_model=schemas.Application)
def create_application(application: schemas.ApplicationCreate, db: Session = Depends(get_db)):
    return services.create_application(db, application)


@app.get("/api/applications/pending", response_model=List[schemas.Application])
def get_pending_applications(db: Session = Depends(get_db)):
    return services.get_pending_applications(db)


@app.get("/api/applications", response_model=List[schemas.Application])
def get_all_applications(db: Session = Depends(get_db)):
    return db.query(models.Application).order_by(models.Application.created_at.desc()).all()


@app.post("/api/approvals", response_model=schemas.CredentialWithSecret)
def approve_application(approval: schemas.ApprovalRequest, db: Session = Depends(get_db)):
    credential = services.process_approval(db, approval)
    if not credential:
        raise HTTPException(status_code=400, detail="审批失败或申请已被拒绝")
    return credential


@app.get("/api/credentials/active", response_model=List[schemas.Credential])
def get_active_credentials(db: Session = Depends(get_db)):
    return services.get_active_credentials(db)


@app.get("/api/credentials/expiring-soon", response_model=List[schemas.Credential])
def get_expiring_soon_credentials(db: Session = Depends(get_db)):
    return services.get_expiring_soon_credentials(db)


@app.get("/api/credentials/revoked", response_model=List[schemas.Credential])
def get_revoked_credentials(db: Session = Depends(get_db)):
    return services.get_revoked_credentials(db)


@app.post("/api/credentials/revoke", response_model=schemas.Credential)
def revoke_credential(revoke: schemas.RevokeRequest, db: Session = Depends(get_db)):
    credential = services.revoke_credential(db, revoke)
    if not credential:
        raise HTTPException(status_code=400, detail="撤销失败，凭证不存在或已失效")
    return credential


@app.post("/api/credentials/expire")
def expire_credentials(db: Session = Depends(get_db)):
    count = services.expire_credentials(db)
    return {"expired_count": count}


@app.post("/api/verify-access")
def verify_access(access: schemas.AccessRequest, request: Request, db: Session = Depends(get_db)):
    client_host = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    result = services.verify_access(db, access, ip=client_host, user_agent=user_agent)
    return result


@app.get("/api/audit-logs", response_model=List[schemas.AuditLog])
def get_audit_logs(credential_id: int = None, limit: int = 100, db: Session = Depends(get_db)):
    return services.get_audit_logs(db, credential_id=credential_id, limit=limit)


@app.get("/api/audit-chain/{credential_id}")
def get_audit_chain(credential_id: int, db: Session = Depends(get_db)):
    chain = services.get_credential_audit_chain(db, credential_id)
    if not chain:
        raise HTTPException(status_code=404, detail="凭证不存在")
    return chain


@app.get("/api/scopes")
def get_allowed_scopes():
    return {"scopes": services.ALLOWED_SCOPES}


@app.get("/api/stats")
def get_statistics(db: Session = Depends(get_db)):
    pending_count = db.query(models.Application).filter(models.Application.status == "pending").count()
    approved_count = db.query(models.Application).filter(models.Application.status == "approved").count()
    rejected_count = db.query(models.Application).filter(models.Application.status == "rejected").count()
    active_creds = db.query(models.Credential).filter(models.Credential.status == "active").count()
    revoked_creds = db.query(models.Credential).filter(models.Credential.status == "revoked").count()
    expired_creds = db.query(models.Credential).filter(models.Credential.status == "expired").count()
    
    return {
        "applications": {
            "pending": pending_count,
            "approved": approved_count,
            "rejected": rejected_count
        },
        "credentials": {
            "active": active_creds,
            "revoked": revoked_creds,
            "expired": expired_creds
        }
    }


@app.post("/api/demo/create-expired-credential", response_model=schemas.CredentialWithSecret)
def create_expired_demo(application: schemas.ApplicationCreate, db: Session = Depends(get_db)):
    return services.create_expired_credential_demo(db, application)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
