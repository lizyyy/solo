import json
from datetime import datetime
from starlette.requests import Request
from starlette.responses import Response, JSONResponse

from ..core.database import SessionLocal
from ..models.models import IdempotencyToken
from ..utils.common import calculate_request_hash, get_expires_at
from ..core.config import settings


class IdempotencyMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive)
        idempotency_key = request.headers.get("X-Idempotency-Key")

        if not idempotency_key or request.method not in ["POST", "PUT", "PATCH", "DELETE"]:
            await self.app(scope, receive, send)
            return

        db = SessionLocal()
        try:
            body = await request.body()
            try:
                request_body = json.loads(body) if body else {}
            except json.JSONDecodeError:
                request_body = {}

            request_hash = calculate_request_hash(request_body)

            existing_token = db.query(IdempotencyToken).filter(
                IdempotencyToken.token == idempotency_key
            ).first()

            if existing_token:
                if existing_token.request_hash == request_hash and existing_token.expires_at > datetime.utcnow():
                    if existing_token.response_data:
                        response_data = json.loads(existing_token.response_data)
                        response = JSONResponse(
                            status_code=200,
                            content=response_data,
                            headers={"X-Idempotency-Cache": "HIT"}
                        )
                        await response(scope, receive, send)
                        return

                conflict_response = JSONResponse(
                    status_code=409,
                    content={
                        "code": 409,
                        "message": "幂等键已被使用，但请求内容不一致或已过期",
                        "data": None,
                        "request_id": getattr(request.state, "request_id", ""),
                        "timestamp": datetime.utcnow().isoformat()
                    }
                )
                await conflict_response(scope, receive, send)
                return

            expires_at = get_expires_at(settings.IDEMPOTENCY_TOKEN_EXPIRE_HOURS)
            new_token = IdempotencyToken(
                token=idempotency_key,
                request_hash=request_hash,
                expires_at=expires_at
            )
            db.add(new_token)
            db.commit()

            body_for_downstream = body

            async def receive_wrapper():
                return {
                    "type": "http.request",
                    "body": body_for_downstream,
                    "more_body": False,
                }

            response_started = False
            status_code = None
            response_headers = None
            response_body_parts = []

            async def send_wrapper(message):
                nonlocal response_started, status_code, response_headers, response_body_parts

                if message["type"] == "http.response.start":
                    response_started = True
                    status_code = message["status"]
                    response_headers = message.get("headers", [])
                    response_body_parts = []
                    await send(message)
                elif message["type"] == "http.response.body":
                    response_body_parts.append(message.get("body", b""))
                    if status_code == 200:
                        body_bytes = b"".join(response_body_parts)
                        try:
                            response_data = json.loads(body_bytes)
                            token = db.query(IdempotencyToken).filter(
                                IdempotencyToken.token == idempotency_key
                            ).first()
                            if token:
                                token.response_data = json.dumps(response_data, ensure_ascii=False)
                                db.commit()
                        except (json.JSONDecodeError, Exception):
                            pass
                    await send(message)
                else:
                    await send(message)

            await self.app(scope, receive_wrapper, send_wrapper)

        finally:
            db.close()
