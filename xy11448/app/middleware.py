import json
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from sqlalchemy.orm import Session
import time

from app.database import SessionLocal
from app.models import AuditLog, User


class AuditLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        request_body = await request.body()
        request_data = request_body.decode() if request_body else None
        
        response = await call_next(request)
        
        process_time = time.time() - start_time
        
        if request.url.path.startswith("/api/v1/") and not request.url.path.endswith("/login"):
            try:
                db: Session = SessionLocal()
                
                authorization = request.headers.get("Authorization")
                user_id = None
                if authorization and authorization.startswith("Bearer "):
                    token = authorization.replace("Bearer ", "")
                    try:
                        from jose import jwt
                        from app.config import settings
                        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
                        username = payload.get("sub")
                        if username:
                            user = db.query(User).filter(User.username == username).first()
                            if user:
                                user_id = user.id
                    except:
                        pass
                
                path = request.url.path
                resource_type = self._extract_resource_type(path)
                action = self._extract_action(request.method, path)
                
                response_body = b""
                async for chunk in response.body_iterator:
                    response_body += chunk
                
                audit_log = AuditLog(
                    user_id=user_id,
                    action=action,
                    resource_type=resource_type,
                    method=request.method,
                    path=path,
                    request_data=request_data[:1000] if request_data else None,
                    response_data=response_body.decode()[:1000] if response_body else None,
                    ip_address=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent")
                )
                
                db.add(audit_log)
                db.commit()
                db.close()
                
                return Response(
                    content=response_body,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    media_type=response.media_type
                )
                
            except Exception as e:
                print(f"Audit log error: {e}")
        
        return response
    
    def _extract_resource_type(self, path: str) -> str:
        parts = path.split("/")
        if len(parts) >= 4:
            return parts[3]
        return "unknown"
    
    def _extract_action(self, method: str, path: str) -> str:
        if path.endswith("/reconcile"):
            return "reconcile"
        elif path.endswith("/export"):
            return "export"
        elif path.endswith("/review"):
            return "review"
        elif path.endswith("/playback"):
            return "playback"
        elif method == "POST":
            return "create"
        elif method == "PUT" or method == "PATCH":
            return "update"
        elif method == "DELETE":
            return "delete"
        elif method == "GET":
            return "read"
        return "unknown"
