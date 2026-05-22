from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
import time
import json

from app.core.config import settings
from app.core.database import Base, engine
from app.api import api_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="乡镇药房近效期验收回放链路 API",
    description="处理乡镇药房近效期药品验收记录的回放链路系统",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    from app.core.database import SessionLocal
    from app.services import AuditLogService
    from jose import jwt

    db = SessionLocal()
    try:
        start_time = time.time()

        user_id = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "")
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
                username = payload.get("sub")
                from app.models import User
                user = db.query(User).filter(User.username == username).first()
                if user:
                    user_id = user.id
            except:
                pass

        method = request.method
        url = str(request.url)
        path = request.url.path

        query_params = str(request.query_params) if request.query_params else None
        request_headers = dict(request.headers)

        try:
            request_body = await request.body()
            request_body_str = request_body.decode("utf-8")[:2000] if request_body else None
        except:
            request_body_str = None

        http_log = AuditLogService.create_http_log(
            db,
            method=method,
            url=url,
            path=path,
            query_params=query_params,
            request_body=request_body_str,
            request_headers=json.dumps(request_headers) if request_headers else None,
            user_id=user_id,
            client_ip=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )

        response = await call_next(request)

        end_time = time.time()
        duration_ms = int((end_time - start_time) * 1000)

        try:
            response_body = b""
            async for chunk in response.body_iterator:
                response_body += chunk

            new_response = Response(
                content=response_body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type
            )

            response_body_str = response_body.decode("utf-8")[:2000] if response_body else None

            AuditLogService.update_http_log_response(
                db,
                log_id=http_log.id,
                status_code=response.status_code,
                response_body=response_body_str,
                response_headers=json.dumps(dict(response.headers)) if response.headers else None,
                has_error=1 if response.status_code >= 400 else 0,
                error_message=None
            )

            return new_response
        except Exception as e:
            AuditLogService.update_http_log_response(
                db,
                log_id=http_log.id,
                status_code=response.status_code,
                has_error=1 if response.status_code >= 400 else 0,
                error_message=str(e)
            )
            return response

    except Exception as e:
        return await call_next(request)
    finally:
        db.close()


app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    return {
        "message": "乡镇药房近效期验收回放链路 API",
        "version": "1.0.0",
        "docs": "/docs",
        "api_prefix": settings.API_V1_STR
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": int(time.time())}
