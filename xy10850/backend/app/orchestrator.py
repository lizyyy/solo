import httpx
import asyncio
import json
import hashlib
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from cachetools import TTLCache
from .models import BffEndpoint, UpstreamApi, EndpointUpstream, CallHistory, CacheEntry, AggregateField
from . import schemas
from .database import get_db
import uuid


class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.state = "closed"

    def call(self, func, *args, **kwargs):
        if self.state == "open":
            if datetime.now() - self.last_failure_time > timedelta(seconds=self.recovery_timeout):
                self.state = "half-open"
            else:
                raise Exception("Circuit breaker is open")

        try:
            result = func(*args, **kwargs)
            self.on_success()
            return result
        except Exception as e:
            self.on_failure()
            raise e

    def on_success(self):
        self.failure_count = 0
        self.state = "closed"

    def on_failure(self):
        self.failure_count += 1
        if self.failure_count >= self.failure_threshold:
            self.state = "open"
            self.last_failure_time = datetime.now()


class CacheManager:
    def __init__(self, db: Session):
        self.db = db
        self.memory_cache = TTLCache(maxsize=1000, ttl=300)

    def generate_cache_key(self, endpoint: BffEndpoint, request_data: Dict[str, Any]) -> str:
        key_template = endpoint.cache_key_template or f"{endpoint.id}:{endpoint.path}"
        data_str = json.dumps(request_data, sort_keys=True)
        data_hash = hashlib.md5(data_str.encode()).hexdigest()
        return f"{key_template}:{data_hash}"

    def get(self, cache_key: str) -> Optional[Dict[str, Any]]:
        if cache_key in self.memory_cache:
            return self.memory_cache[cache_key]

        entry = self.db.query(CacheEntry).filter(
            CacheEntry.cache_key == cache_key,
            CacheEntry.expires_at > datetime.now()
        ).first()

        if entry:
            entry.hit_count += 1
            self.db.commit()
            self.memory_cache[cache_key] = entry.value
            return entry.value

        return None

    def set(self, cache_key: str, value: Dict[str, Any], ttl: int, endpoint_id: int = None):
        self.memory_cache[cache_key] = value

        entry = self.db.query(CacheEntry).filter(CacheEntry.cache_key == cache_key).first()
        if entry:
            entry.value = value
            entry.expires_at = datetime.now() + timedelta(seconds=ttl)
            entry.hit_count = 0
        else:
            entry = CacheEntry(
                cache_key=cache_key,
                value=value,
                expires_at=datetime.now() + timedelta(seconds=ttl),
                endpoint_id=endpoint_id
            )
            self.db.add(entry)
        self.db.commit()

    def invalidate(self, cache_key: str = None, endpoint_id: int = None):
        if cache_key:
            if cache_key in self.memory_cache:
                del self.memory_cache[cache_key]
            self.db.query(CacheEntry).filter(CacheEntry.cache_key == cache_key).delete()
        elif endpoint_id:
            self.db.query(CacheEntry).filter(CacheEntry.endpoint_id == endpoint_id).delete()
            keys_to_remove = [k for k in self.memory_cache.keys() if k.startswith(f"{endpoint_id}:")]
            for k in keys_to_remove:
                del self.memory_cache[k]
        self.db.commit()

    def cleanup_expired(self):
        self.db.query(CacheEntry).filter(CacheEntry.expires_at < datetime.now()).delete()
        self.db.commit()


class DegradationManager:
    def __init__(self, db: Session):
        self.db = db

    def apply_degradation(self, endpoint: BffEndpoint, error: Exception, cache_manager: CacheManager, cache_key: str) -> Tuple[Dict[str, Any], bool]:
        strategy = endpoint.degradation_strategy
        degraded = True

        if strategy == schemas.DegradationStrategy.RETURN_CACHE:
            cached_value = cache_manager.get(cache_key)
            if cached_value:
                return cached_value, degraded
            strategy = schemas.DegradationStrategy.RETURN_DEFAULT

        if strategy == schemas.DegradationStrategy.RETURN_DEFAULT:
            return endpoint.degradation_default_value or {}, degraded

        if strategy == schemas.DegradationStrategy.SKIP_FIELD:
            return {}, degraded

        if strategy == schemas.DegradationStrategy.RETURN_STATIC:
            return endpoint.degradation_default_value or {"status": "degraded", "message": str(error)}, degraded

        return {}, degraded


class OrchestrationEngine:
    def __init__(self, db: Session):
        self.db = db
        self.cache_manager = CacheManager(db)
        self.degradation_manager = DegradationManager(db)
        self.circuit_breakers: Dict[int, CircuitBreaker] = {}

    def get_circuit_breaker(self, upstream_api_id: int) -> CircuitBreaker:
        if upstream_api_id not in self.circuit_breakers:
            upstream = self.db.query(UpstreamApi).filter(UpstreamApi.id == upstream_api_id).first()
            if upstream:
                self.circuit_breakers[upstream_api_id] = CircuitBreaker(
                    failure_threshold=upstream.failure_threshold,
                    recovery_timeout=upstream.recovery_timeout
                )
            else:
                self.circuit_breakers[upstream_api_id] = CircuitBreaker()
        return self.circuit_breakers[upstream_api_id]

    def get_nested_value(self, data: Dict[str, Any], path: str) -> Any:
        if not path:
            return data
        keys = path.split('.')
        result = data
        for key in keys:
            if isinstance(result, dict) and key in result:
                result = result[key]
            else:
                return None
        return result

    def apply_transformation(self, value: Any, transformation: Dict[str, Any]) -> Any:
        if not transformation:
            return value
        transform_type = transformation.get("type")
        if transform_type == "uppercase":
            return str(value).upper() if value else value
        if transform_type == "lowercase":
            return str(value).lower() if value else value
        if transform_type == "trim":
            return str(value).strip() if value else value
        if transform_type == "default":
            return value if value is not None else transformation.get("default")
        return value

    async def call_upstream(self, upstream_api: UpstreamApi, input_data: Dict[str, Any], input_mapping: Dict[str, Any] = None) -> Dict[str, Any]:
        url = f"{upstream_api.base_url.rstrip('/')}/{upstream_api.path.lstrip('/')}"

        headers = dict(upstream_api.headers or {})
        query_params = dict(upstream_api.query_params or {})
        body = dict(upstream_api.body_template or {})

        if input_mapping:
            for target, source_path in input_mapping.items():
                value = self.get_nested_value(input_data, source_path)
                if target.startswith("header."):
                    headers[target[7:]] = value
                elif target.startswith("query."):
                    query_params[target[6:]] = value
                elif target.startswith("body."):
                    body[target[5:]] = value

        timeout = httpx.Timeout(upstream_api.timeout)

        async with httpx.AsyncClient(timeout=timeout) as client:
            method = upstream_api.method.lower()
            request_kwargs = {"headers": headers}

            if method in ["get", "delete"]:
                request_kwargs["params"] = query_params
            else:
                request_kwargs["json"] = body

            response = await getattr(client, method)(url, **request_kwargs)
            response.raise_for_status()

            return response.json()

    async def execute_upstreams(self, endpoint: BffEndpoint, request_data: Dict[str, Any]) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        upstream_results = {}
        upstream_calls = []
        endpoint_upstreams = sorted(endpoint.upstreams, key=lambda x: x.order)

        parallel_groups = {}
        sequential_tasks = []

        for eu in endpoint_upstreams:
            if eu.parallel:
                group_key = eu.order
                if group_key not in parallel_groups:
                    parallel_groups[group_key] = []
                parallel_groups[group_key].append(eu)
            else:
                sequential_tasks.append(eu)

        for order in sorted(parallel_groups.keys()):
            group = parallel_groups[order]
            tasks = []
            for eu in group:
                upstream_api = eu.upstream_api
                if not upstream_api:
                    continue
                tasks.append(self._execute_single_upstream(eu, upstream_api, request_data, upstream_results))

            results = await asyncio.gather(*tasks, return_exceptions=True)
            for eu, result in zip(group, results):
                if isinstance(result, Exception):
                    upstream_calls.append({
                        "upstream_id": eu.upstream_api_id,
                        "name": eu.upstream_api.name if eu.upstream_api else None,
                        "success": False,
                        "error": str(result),
                        "required": eu.required
                    })
                    if eu.required:
                        raise result
                else:
                    upstream_results[eu.upstream_api_id] = result
                    upstream_calls.append({
                        "upstream_id": eu.upstream_api_id,
                        "name": eu.upstream_api.name if eu.upstream_api else None,
                        "success": True,
                        "required": eu.required
                    })

        for eu in sequential_tasks:
            upstream_api = eu.upstream_api
            if not upstream_api:
                continue

            try:
                result = await self._execute_single_upstream(eu, upstream_api, request_data, upstream_results)
                upstream_results[eu.upstream_api_id] = result
                upstream_calls.append({
                    "upstream_id": eu.upstream_api_id,
                    "name": upstream_api.name,
                    "success": True,
                    "required": eu.required
                })
            except Exception as e:
                upstream_calls.append({
                    "upstream_id": eu.upstream_api_id,
                    "name": upstream_api.name,
                    "success": False,
                    "error": str(e),
                    "required": eu.required
                })
                if eu.required:
                    raise

        return upstream_results, upstream_calls

    async def _execute_single_upstream(self, eu: EndpointUpstream, upstream_api: UpstreamApi, request_data: Dict[str, Any], previous_results: Dict[str, Any]) -> Dict[str, Any]:
        if eu.depends_on:
            for dep_id in eu.depends_on:
                if dep_id not in previous_results:
                    raise Exception(f"Missing dependency: upstream {dep_id}")

        if eu.condition:
            pass

        circuit_breaker = self.get_circuit_breaker(upstream_api.id)

        for attempt in range(upstream_api.retry_count):
            try:
                merged_data = {**request_data, "previous": previous_results}
                result = await self.call_upstream(upstream_api, merged_data, eu.input_mapping)
                circuit_breaker.on_success()

                if eu.output_mapping:
                    mapped_result = {}
                    for target, source_path in eu.output_mapping.items():
                        mapped_result[target] = self.get_nested_value(result, source_path)
                    return mapped_result
                return result

            except Exception as e:
                if attempt == upstream_api.retry_count - 1:
                    circuit_breaker.on_failure()
                    raise
                await asyncio.sleep(0.1 * (attempt + 1))

    def aggregate_fields(self, endpoint: BffEndpoint, upstream_results: Dict[int, Any]) -> Dict[str, Any]:
        result = {}

        for field in endpoint.fields:
            value = None

            if field.source_upstream_id and field.source_upstream_id in upstream_results:
                upstream_data = upstream_results[field.source_upstream_id]
                value = self.get_nested_value(upstream_data, field.source_path or "")

            if value is None and field.default_value is not None:
                value = field.default_value

            if field.transformation:
                value = self.apply_transformation(value, field.transformation)

            if field.required and value is None:
                raise Exception(f"Required field missing: {field.name}")

            if field.path:
                keys = field.path.split('.')
                current = result
                for key in keys[:-1]:
                    if key not in current:
                        current[key] = {}
                    current = current[key]
                current[keys[-1]] = value
            else:
                result[field.name] = value

        return result

    async def execute_endpoint(self, endpoint_id: int, request_data: Dict[str, Any] = None, skip_cache: bool = False) -> Dict[str, Any]:
        request_id = str(uuid.uuid4())
        start_time = datetime.now()
        request_data = request_data or {}
        cache_hit = False
        degraded = False
        error_message = None
        response_body = None
        response_status = 200
        upstream_calls = []

        endpoint = self.db.query(BffEndpoint).filter(BffEndpoint.id == endpoint_id).first()
        if not endpoint:
            error_message = f"Endpoint {endpoint_id} not found"
            response_status = 404
            response_time_ms = (datetime.now() - start_time).total_seconds() * 1000
            self._save_call_history(
                endpoint_id=endpoint_id,
                request_id=request_id,
                request_data=request_data,
                response_status=response_status,
                response_body={"error": error_message},
                response_time_ms=response_time_ms,
                cache_hit=cache_hit,
                degraded=degraded,
                error_message=error_message,
                upstream_calls=upstream_calls
            )
            raise Exception(error_message)

        if endpoint.status != schemas.EndpointStatus.ACTIVE:
            error_message = f"Endpoint is not active: {endpoint.status}"
            response_status = 403
            response_time_ms = (datetime.now() - start_time).total_seconds() * 1000
            self._save_call_history(
                endpoint_id=endpoint_id,
                request_id=request_id,
                request_data=request_data,
                response_status=response_status,
                response_body={"error": error_message},
                response_time_ms=response_time_ms,
                cache_hit=cache_hit,
                degraded=degraded,
                error_message=error_message,
                upstream_calls=upstream_calls
            )
            raise Exception(error_message)

        cache_key = self.cache_manager.generate_cache_key(endpoint, request_data)

        if endpoint.cache_enabled and not skip_cache:
            cached_value = self.cache_manager.get(cache_key)
            if cached_value:
                cache_hit = True
                response_body = cached_value
                response_time_ms = (datetime.now() - start_time).total_seconds() * 1000
                self._save_call_history(
                    endpoint_id=endpoint_id,
                    request_id=request_id,
                    request_data=request_data,
                    response_status=response_status,
                    response_body=response_body,
                    response_time_ms=response_time_ms,
                    cache_hit=cache_hit,
                    degraded=degraded,
                    error_message=error_message,
                    upstream_calls=[]
                )
                return {
                    "data": response_body,
                    "metadata": {
                        "request_id": request_id,
                        "cache_hit": cache_hit,
                        "degraded": degraded,
                        "response_time_ms": response_time_ms
                    }
                }

        try:
            upstream_results, upstream_calls = await self.execute_upstreams(endpoint, request_data)
            response_body = self.aggregate_fields(endpoint, upstream_results)

            if endpoint.cache_enabled:
                self.cache_manager.set(cache_key, response_body, endpoint.cache_ttl, endpoint_id)

        except Exception as e:
            error_message = str(e)
            response_status = 500

            try:
                response_body, degraded = self.degradation_manager.apply_degradation(
                    endpoint, e, self.cache_manager, cache_key
                )
                if degraded:
                    response_status = 206
            except:
                response_body = {"error": error_message}

        response_time_ms = (datetime.now() - start_time).total_seconds() * 1000

        self._save_call_history(
            endpoint_id=endpoint_id,
            request_id=request_id,
            request_data=request_data,
            response_status=response_status,
            response_body=response_body,
            response_time_ms=response_time_ms,
            cache_hit=cache_hit,
            degraded=degraded,
            error_message=error_message,
            upstream_calls=upstream_calls
        )

        return {
            "data": response_body,
            "metadata": {
                "request_id": request_id,
                "cache_hit": cache_hit,
                "degraded": degraded,
                "response_time_ms": response_time_ms,
                "error": error_message
            }
        }

    def _save_call_history(self, endpoint_id: int, request_id: str, request_data: Dict[str, Any],
                           response_status: int, response_body: Dict[str, Any], response_time_ms: float,
                           cache_hit: bool, degraded: bool, error_message: Optional[str],
                           upstream_calls: List[Dict[str, Any]]):
        history = CallHistory(
            endpoint_id=endpoint_id,
            request_id=request_id,
            request_method="POST",
            request_path=f"/execute/{endpoint_id}",
            request_body=request_data,
            response_status=response_status,
            response_body=response_body,
            response_time_ms=response_time_ms,
            cache_hit=cache_hit,
            degraded=degraded,
            error_message=error_message,
            upstream_calls=upstream_calls
        )
        self.db.add(history)
        self.db.commit()
