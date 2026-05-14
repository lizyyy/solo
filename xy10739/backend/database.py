import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from enum import Enum

class RouteStatus(Enum):
    DRAFT = "draft"
    PUBLISHING = "publishing"
    PUBLISHED = "published"
    FAILED = "failed"
    ROLLING_BACK = "rolling_back"
    ROLLED_BACK = "rolled_back"

class AuthStrategy(Enum):
    NONE = "none"
    API_KEY = "api_key"
    JWT = "jwt"
    OAUTH2 = "oauth2"

@dataclass
class RouteRule:
    id: str
    name: str
    path: str
    upstream_url: str
    methods: List[str]
    auth_strategy: AuthStrategy
    gray_scale_percent: int
    status: RouteStatus
    raw_input: Dict[str, Any]
    processed_result: Optional[Dict[str, Any]]
    version: int
    created_at: datetime
    updated_at: datetime
    created_by: str
    error_message: Optional[str] = None
    previous_version_id: Optional[str] = None

@dataclass
class GatewayLog:
    id: str
    route_id: str
    timestamp: datetime
    level: str
    message: str
    details: Dict[str, Any]
    request_id: Optional[str] = None

class InMemoryDB:
    def __init__(self):
        self.routes: Dict[str, RouteRule] = {}
        self.logs: List[GatewayLog] = []
        self.idempotency_keys: Dict[str, Dict[str, Any]] = {}
        
    def create_route(self, route_data: Dict[str, Any], raw_input: Dict[str, Any], user: str) -> RouteRule:
        route_id = str(uuid.uuid4())
        route = RouteRule(
            id=route_id,
            name=route_data["name"],
            path=route_data["path"],
            upstream_url=route_data["upstream_url"],
            methods=route_data.get("methods", ["GET", "POST"]),
            auth_strategy=AuthStrategy(route_data.get("auth_strategy", "none")),
            gray_scale_percent=route_data.get("gray_scale_percent", 0),
            status=RouteStatus.DRAFT,
            raw_input=raw_input,
            processed_result=None,
            version=1,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            created_by=user
        )
        self.routes[route_id] = route
        self.add_log(route_id, "INFO", f"路由规则创建成功", {"action": "create"})
        return route
    
    def update_route(self, route_id: str, route_data: Dict[str, Any], raw_input: Dict[str, Any]) -> Optional[RouteRule]:
        if route_id not in self.routes:
            return None
        route = self.routes[route_id]
        route.name = route_data.get("name", route.name)
        route.path = route_data.get("path", route.path)
        route.upstream_url = route_data.get("upstream_url", route.upstream_url)
        route.methods = route_data.get("methods", route.methods)
        route.auth_strategy = AuthStrategy(route_data.get("auth_strategy", route.auth_strategy.value))
        route.gray_scale_percent = route_data.get("gray_scale_percent", route.gray_scale_percent)
        route.raw_input = raw_input
        route.updated_at = datetime.now()
        route.version += 1
        self.add_log(route_id, "INFO", f"路由规则更新成功，版本 {route.version}", {"action": "update", "version": route.version})
        return route
    
    def publish_route(self, route_id: str, idempotency_key: str) -> Optional[RouteRule]:
        if route_id not in self.routes:
            return None
        
        if idempotency_key in self.idempotency_keys:
            cached_result = self.idempotency_keys[idempotency_key]
            if cached_result["route_id"] == route_id and cached_result["action"] == "publish":
                return self.routes[route_id]
        
        route = self.routes[route_id]
        route.status = RouteStatus.PUBLISHING
        self.add_log(route_id, "INFO", "开始发布路由规则", {"action": "publish"})
        
        try:
            route.processed_result = self._process_route_for_publish(route)
            route.status = RouteStatus.PUBLISHED
            self.add_log(route_id, "INFO", "路由规则发布成功", {"action": "publish", "success": True})
        except Exception as e:
            route.status = RouteStatus.FAILED
            route.error_message = str(e)
            self.add_log(route_id, "ERROR", f"路由规则发布失败: {str(e)}", {"action": "publish", "success": False, "error": str(e)})
        
        self.idempotency_keys[idempotency_key] = {
            "route_id": route_id,
            "action": "publish",
            "timestamp": datetime.now().isoformat()
        }
        return route
    
    def _process_route_for_publish(self, route: RouteRule) -> Dict[str, Any]:
        errors = []
        if not route.path.startswith("/"):
            errors.append("路径必须以 / 开头")
        if not route.upstream_url.startswith(("http://", "https://")):
            errors.append("上游服务URL必须以 http:// 或 https:// 开头")
        if route.gray_scale_percent < 0 or route.gray_scale_percent > 100:
            errors.append("灰度百分比必须在 0-100 之间")
        if not route.methods:
            errors.append("至少需要指定一个HTTP方法")
        
        if errors:
            raise ValueError("; ".join(errors))
        
        return {
            "normalized_path": route.path.rstrip("/"),
            "normalized_upstream": route.upstream_url.rstrip("/"),
            "auth_config": self._get_auth_config(route.auth_strategy),
            "gray_scale_config": {
                "enabled": route.gray_scale_percent > 0,
                "percentage": route.gray_scale_percent
            },
            "validation_passed": True
        }
    
    def _get_auth_config(self, strategy: AuthStrategy) -> Dict[str, Any]:
        configs = {
            AuthStrategy.NONE: {"type": "none", "required": False},
            AuthStrategy.API_KEY: {"type": "api_key", "header": "X-API-Key", "required": True},
            AuthStrategy.JWT: {"type": "jwt", "header": "Authorization", "scheme": "Bearer", "required": True},
            AuthStrategy.OAUTH2: {"type": "oauth2", "flows": ["authorization_code", "client_credentials"], "required": True}
        }
        return configs[strategy]
    
    def rollback_route(self, route_id: str, idempotency_key: str) -> Optional[RouteRule]:
        if route_id not in self.routes:
            return None
        
        if idempotency_key in self.idempotency_keys:
            cached_result = self.idempotency_keys[idempotency_key]
            if cached_result["route_id"] == route_id and cached_result["action"] == "rollback":
                return self.routes[route_id]
        
        route = self.routes[route_id]
        if route.status not in [RouteStatus.PUBLISHED, RouteStatus.FAILED]:
            raise ValueError("只有已发布或发布失败的路由才能回滚")
        
        route.status = RouteStatus.ROLLING_BACK
        self.add_log(route_id, "INFO", "开始回滚路由规则", {"action": "rollback"})
        
        route.status = RouteStatus.ROLLED_BACK
        route.version += 1
        self.add_log(route_id, "INFO", "路由规则回滚成功", {"action": "rollback", "success": True})
        
        self.idempotency_keys[idempotency_key] = {
            "route_id": route_id,
            "action": "rollback",
            "timestamp": datetime.now().isoformat()
        }
        return route
    
    def add_log(self, route_id: str, level: str, message: str, details: Dict[str, Any]):
        log = GatewayLog(
            id=str(uuid.uuid4()),
            route_id=route_id,
            timestamp=datetime.now(),
            level=level,
            message=message,
            details=details,
            request_id=str(uuid.uuid4())
        )
        self.logs.append(log)
    
    def get_logs_by_route(self, route_id: str) -> List[GatewayLog]:
        return [log for log in self.logs if log.route_id == route_id]
    
    def get_all_logs(self) -> List[GatewayLog]:
        return sorted(self.logs, key=lambda x: x.timestamp, reverse=True)

db = InMemoryDB()