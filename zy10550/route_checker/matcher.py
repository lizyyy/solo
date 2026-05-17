import re
from typing import List, Optional
from fnmatch import fnmatch

from .models import RouteRule, RequestSample, MatchResult, MatchType


class RouteMatcher:
    def __init__(self, routes: List[RouteRule]):
        self.routes = self._sort_routes(routes)

    def _sort_routes(self, routes: List[RouteRule]) -> List[RouteRule]:
        def sort_key(route: RouteRule):
            type_priority = {
                MatchType.EXACT: 100,
                MatchType.REGEX: 50,
                MatchType.PREFIX: 10
            }
            path_length = len(route.path)
            return (-type_priority.get(route.match_type, 0), -route.priority, -path_length)

        return sorted(routes, key=sort_key)

    def match_request(self, request: RequestSample) -> MatchResult:
        candidates: List[RouteRule] = []

        for route in self.routes:
            if self._is_method_match(request, route):
                if self._is_path_match(request.path, route):
                    if self._is_headers_match(request, route):
                        candidates.append(route)

        if candidates:
            matched_route = candidates[0]
            return MatchResult(
                request=request,
                matched_route=matched_route,
                candidate_routes=candidates,
                is_matched=True,
                match_reason=self._get_match_reason(request, matched_route, candidates)
            )
        else:
            return MatchResult(
                request=request,
                matched_route=None,
                candidate_routes=[],
                is_matched=False,
                match_reason="未找到匹配的路由规则"
            )

    def match_all_requests(self, requests: List[RequestSample]) -> List[MatchResult]:
        return [self.match_request(req) for req in requests]

    def _is_method_match(self, request: RequestSample, route: RouteRule) -> bool:
        return request.method.upper() in [m.upper() for m in route.methods]

    def _is_path_match(self, request_path: str, route: RouteRule) -> bool:
        if route.match_type == MatchType.EXACT:
            return request_path == route.path
        elif route.match_type == MatchType.PREFIX:
            return request_path.startswith(route.path)
        elif route.match_type == MatchType.REGEX:
            try:
                return bool(re.match(route.path, request_path))
            except re.error:
                return False
        return False

    def _is_headers_match(self, request: RequestSample, route: RouteRule) -> bool:
        if not route.headers:
            return True
        for key, value in route.headers.items():
            req_value = request.headers.get(key, '')
            if not fnmatch(req_value, value):
                return False
        return True

    def _get_match_reason(self, request: RequestSample, matched_route: RouteRule, candidates: List[RouteRule]) -> str:
        reasons = []
        reasons.append(f"匹配类型: {matched_route.match_type.value}")
        reasons.append(f"路由优先级: {matched_route.priority}")
        reasons.append(f"请求方法: {request.method} 匹配")
        
        if len(candidates) > 1:
            reasons.append(f"共找到 {len(candidates)} 个候选路由，按优先级排序后选择此路由")
        
        return ", ".join(reasons)

    def get_route_priority_explanation(self) -> List[str]:
        explanations = []
        for idx, route in enumerate(self.routes, 1):
            type_desc = {
                MatchType.EXACT: "精确匹配 (最高优先级)",
                MatchType.REGEX: "正则匹配 (中等优先级)",
                MatchType.PREFIX: "前缀匹配 (最低优先级)"
            }
            explanations.append(
                f"#{idx} {route.path} -> {route.upstream} [{type_desc.get(route.match_type, '')}] 优先级={route.priority}"
            )
        return explanations
