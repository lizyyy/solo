from typing import List, Dict, Any, Optional
from datetime import datetime

from .models import TollRecord, Route, AuditResult


class RouteValidator:
    DEFAULT_ROUTES = [
        Route(
            route_id="R_001",
            entry_station="北京朝阳站",
            exit_station="天津塘沽站",
            expected_distance=160.0,
            min_expected_time=1.5,
            max_expected_time=3.0
        ),
        Route(
            route_id="R_002",
            entry_station="上海虹桥站",
            exit_station="苏州新区站",
            expected_distance=85.0,
            min_expected_time=0.8,
            max_expected_time=2.0
        ),
        Route(
            route_id="R_003",
            entry_station="广州白云站",
            exit_station="深圳福田站",
            expected_distance=140.0,
            min_expected_time=1.2,
            max_expected_time=2.5
        ),
        Route(
            route_id="R_004",
            entry_station="成都东站",
            exit_station="重庆西站",
            expected_distance=300.0,
            min_expected_time=2.5,
            max_expected_time=5.0
        ),
        Route(
            route_id="R_005",
            entry_station="杭州东站",
            exit_station="宁波站",
            expected_distance=155.0,
            min_expected_time=1.3,
            max_expected_time=2.8
        ),
        Route(
            route_id="R_006",
            entry_station="武汉站",
            exit_station="长沙南站",
            expected_distance=350.0,
            min_expected_time=3.0,
            max_expected_time=6.0
        ),
        Route(
            route_id="R_007",
            entry_station="西安北站",
            exit_station="郑州东站",
            expected_distance=480.0,
            min_expected_time=4.0,
            max_expected_time=8.0
        ),
        Route(
            route_id="R_008",
            entry_station="南京南站",
            exit_station="合肥南站",
            expected_distance=156.0,
            min_expected_time=1.3,
            max_expected_time=2.8
        )
    ]
    
    AVERAGE_SPEED_KMH = 90
    
    def __init__(self, custom_routes: List[Route] = None):
        self.routes = {f"{r.entry_station}-{r.exit_station}": r 
                      for r in (custom_routes if custom_routes else self.DEFAULT_ROUTES)
                      if r.valid}
    
    def validate(self, records: List[TollRecord], existing_results: List[AuditResult] = None) -> List[AuditResult]:
        results = existing_results if existing_results else []
        
        if not results:
            for record in records:
                results.append(AuditResult(
                    record_id=record.record_id,
                    plate_number=record.plate_number,
                    vehicle_type=record.vehicle_type.value
                ))
        
        for record, result in zip(records, results):
            self._validate_single(record, result)
        
        return results
    
    def _validate_single(self, record: TollRecord, result: AuditResult) -> None:
        route_key = f"{record.entry_station}-{record.exit_station}"
        actual_time = record.travel_duration
        
        if route_key in self.routes:
            route = self.routes[route_key]
            self._validate_known_route(record, result, route, actual_time)
        else:
            self._validate_unknown_route(record, result, actual_time)
    
    def _validate_known_route(self, record: TollRecord, result: AuditResult, 
                              route: Route, actual_time: float) -> None:
        issues = []
        
        if actual_time < route.min_expected_time:
            issues.append(
                f"行驶时间异常：实际用时 {actual_time:.2f}小时，低于最短预期时间 {route.min_expected_time}小时"
                f"（路段：{route.entry_station}→{route.exit_station}，预期距离：{route.expected_distance}公里）"
            )
        
        if actual_time > route.max_expected_time:
            issues.append(
                f"行驶时间异常：实际用时 {actual_time:.2f}小时，超过最长预期时间 {route.max_expected_time}小时"
                f"（路段：{route.entry_station}→{route.exit_station}，预期距离：{route.expected_distance}公里）"
            )
        
        if issues:
            result.route_issue = True
            result.route_evidence = "；".join(issues)
            result.needs_manual_review = True
            result.review_notes.extend(issues)
    
    def _validate_unknown_route(self, record: TollRecord, result: AuditResult, 
                                 actual_time: float) -> None:
        result.review_notes.append(
            f"未知路径：{record.entry_station}→{record.exit_station}，使用默认规则校验"
        )
        
        min_allowed_time = 0.1
        max_allowed_time = 24.0
        
        issues = []
        
        if actual_time < min_allowed_time:
            issues.append(
                f"行驶时间异常：实际用时 {actual_time:.2f}小时，明显过短"
                f"（路段：{record.entry_station}→{record.exit_station}）"
            )
        
        if actual_time > max_allowed_time:
            issues.append(
                f"行驶时间异常：实际用时 {actual_time:.2f}小时，超过24小时"
                f"（路段：{record.entry_station}→{record.exit_station}）"
            )
        
        if issues:
            result.route_issue = True
            result.route_evidence = "；".join(issues)
            result.needs_manual_review = True
            result.review_notes.extend(issues)
    
    def get_stats(self, results: List[AuditResult]) -> Dict[str, Any]:
        total = len(results)
        route_issues = sum(1 for r in results if r.route_issue)
        
        return {
            "total_records": total,
            "route_issues": route_issues,
            "route_pass_rate": (total - route_issues) / total * 100 if total > 0 else 0
        }
