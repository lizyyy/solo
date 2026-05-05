import pytest
from app.analyzer import FastAPIRouteMatcher, RouteHealthAnalyzer
from app.schemas import IssueType, Severity


class TestFastAPIRouteMatcher:
    def test_simple_path_match(self):
        routes = [
            {"path": "/users", "method": "GET", "order_index": 0},
            {"path": "/users/{id}", "method": "GET", "order_index": 1}
        ]
        
        matcher = FastAPIRouteMatcher(routes)
        
        result = matcher.match_url_with_details("/users", "GET")
        assert result["matched"] is True
        assert result["matched_route"] == "/users"
    
    def test_dynamic_param_match(self):
        routes = [
            {"path": "/users/{user_id}", "method": "GET", "order_index": 0}
        ]
        
        matcher = FastAPIRouteMatcher(routes)
        
        result = matcher.match_url_with_details("/users/123", "GET")
        assert result["matched"] is True
        assert result["is_dynamic"] is True
    
    def test_match_order_priority(self):
        routes = [
            {"path": "/users/{user_id}", "method": "GET", "order_index": 0},
            {"path": "/users/me", "method": "GET", "order_index": 1}
        ]
        
        matcher = FastAPIRouteMatcher(routes)
        
        result = matcher.match_url_with_details("/users/me", "GET")
        assert result["matched"] is True
        assert result["matched_route"] == "/users/{user_id}"
        assert result["matched_order"] == 0
        
        all_matches = result["all_matches"]
        assert len(all_matches) == 2
        assert all_matches[0]["path"] == "/users/{user_id}"
        assert all_matches[1]["path"] == "/users/me"
    
    def test_correct_order_no_capture(self):
        routes = [
            {"path": "/users/me", "method": "GET", "order_index": 0},
            {"path": "/users/{user_id}", "method": "GET", "order_index": 1}
        ]
        
        matcher = FastAPIRouteMatcher(routes)
        
        result = matcher.match_url_with_details("/users/me", "GET")
        assert result["matched"] is True
        assert result["matched_route"] == "/users/me"
        assert result["matched_order"] == 0
    
    def test_int_converter(self):
        routes = [
            {"path": "/items/{item_id:int}", "method": "GET", "order_index": 0}
        ]
        
        matcher = FastAPIRouteMatcher(routes)
        
        result1 = matcher.match_url_with_details("/items/123", "GET")
        assert result1["matched"] is True
        
        result2 = matcher.match_url_with_details("/items/abc", "GET")
        assert result2["matched"] is False
    
    def test_path_converter(self):
        routes = [
            {"path": "/files/{file_path:path}", "method": "GET", "order_index": 0}
        ]
        
        matcher = FastAPIRouteMatcher(routes)
        
        result = matcher.match_url_with_details("/files/path/to/file.txt", "GET")
        assert result["matched"] is True
    
    def test_method_mismatch(self):
        routes = [
            {"path": "/users", "method": "POST", "order_index": 0}
        ]
        
        matcher = FastAPIRouteMatcher(routes)
        
        result = matcher.match_url_with_details("/users", "GET")
        assert result["matched"] is False


class TestRouteHealthAnalyzer:
    def test_dynamic_param_capture_detection(self):
        routes = [
            {"path": "/users/{user_id}", "method": "GET", "order_index": 0},
            {"path": "/users/me", "method": "GET", "order_index": 1}
        ]
        
        analyzer = RouteHealthAnalyzer(routes)
        issues = analyzer.check_dynamic_param_capture()
        
        assert len(issues) == 1
        assert issues[0]["issue_type"] == IssueType.DYNAMIC_PARAM_CAPTURE
        assert issues[0]["severity"] == Severity.CRITICAL
        assert issues[0]["path"] == "/users/me"
        assert "/users/{user_id}" in issues[0]["description"]
    
    def test_no_dynamic_param_capture_when_correct_order(self):
        routes = [
            {"path": "/users/me", "method": "GET", "order_index": 0},
            {"path": "/users/{user_id}", "method": "GET", "order_index": 1}
        ]
        
        analyzer = RouteHealthAnalyzer(routes)
        issues = analyzer.check_dynamic_param_capture()
        
        assert len(issues) == 0
    
    def test_duplicate_path_detection(self):
        routes = [
            {"path": "/api/health", "method": "GET", "order_index": 0},
            {"path": "/api/health", "method": "GET", "order_index": 1}
        ]
        
        analyzer = RouteHealthAnalyzer(routes)
        issues = analyzer.check_duplicate_paths()
        
        assert len(issues) == 1
        assert issues[0]["issue_type"] == IssueType.DUPLICATE_PATH
        assert issues[0]["severity"] == Severity.HIGH
    
    def test_method_conflict_detection(self):
        routes = [
            {"path": "/users/{id}", "method": "DELETE", "order_index": 0},
            {"path": "/users/{id}", "method": "DELETE", "order_index": 1}
        ]
        
        analyzer = RouteHealthAnalyzer(routes)
        issues = analyzer.check_method_conflicts()
        
        assert len(issues) >= 1
    
    def test_unreachable_route_detection(self):
        routes = [
            {"path": "/{any}", "method": "GET", "order_index": 0},
            {"path": "/specific", "method": "GET", "order_index": 1}
        ]
        
        analyzer = RouteHealthAnalyzer(routes)
        issues = analyzer.check_unreachable_routes()
        
        assert len(issues) == 1
        assert issues[0]["issue_type"] == IssueType.UNREACHABLE
        assert issues[0]["path"] == "/specific"
    
    def test_complex_issues(self):
        routes = [
            {"path": "/users/{user_id}", "method": "GET", "order_index": 0},
            {"path": "/users/me", "method": "GET", "order_index": 1},
            {"path": "/reports/{date}", "method": "GET", "order_index": 2},
            {"path": "/reports/latest", "method": "GET", "order_index": 3},
            {"path": "/health", "method": "GET", "order_index": 4},
            {"path": "/health", "method": "GET", "order_index": 5}
        ]
        
        analyzer = RouteHealthAnalyzer(routes)
        issues = analyzer.run_all_checks()
        
        dynamic_capture = [i for i in issues if i["issue_type"] == IssueType.DYNAMIC_PARAM_CAPTURE]
        assert len(dynamic_capture) == 2
        
        duplicate = [i for i in issues if i["issue_type"] == IssueType.DUPLICATE_PATH]
        assert len(duplicate) == 1
    
    def test_fix_order_priority(self):
        routes = [
            {"path": "/{any}", "method": "GET", "order_index": 0},
            {"path": "/specific", "method": "GET", "order_index": 1},
            {"path": "/users/{user_id}", "method": "GET", "order_index": 2},
            {"path": "/users/me", "method": "GET", "order_index": 3}
        ]
        
        analyzer = RouteHealthAnalyzer(routes)
        issues = analyzer.run_all_checks()
        suggestions = analyzer.get_fix_order(issues)
        
        assert len(suggestions) > 0
        
        priorities = [s["priority"] for s in suggestions]
        assert priorities == sorted(priorities)
    
    def test_sample_requests_test(self):
        routes = [
            {"path": "/users/me", "method": "GET", "order_index": 0},
            {"path": "/users/{user_id}", "method": "GET", "order_index": 1},
            {"path": "/reports/{date}", "method": "GET", "order_index": 2}
        ]
        
        analyzer = RouteHealthAnalyzer(routes)
        
        sample_urls = [
            "/users/me",
            "/users/123",
            "/reports/2024-01-01",
            "/nonexistent"
        ]
        
        results = analyzer.test_sample_requests(sample_urls)
        
        assert len(results) == 4
        
        assert results[0]["matched"] is True
        assert results[0]["matched_route"] == "/users/me"
        
        assert results[1]["matched"] is True
        assert results[1]["matched_route"] == "/users/{user_id}"
        
        assert results[2]["matched"] is True
        assert results[2]["matched_route"] == "/reports/{date}"
        
        assert results[3]["matched"] is False
    
    def test_is_dynamic_path(self):
        analyzer = RouteHealthAnalyzer([])
        
        assert analyzer._is_dynamic_path("/users/{id}") is True
        assert analyzer._is_dynamic_path("/users/{user_id:int}") is True
        assert analyzer._is_dynamic_path("/users/me") is False
        assert analyzer._is_dynamic_path("/api/health") is False
    
    def test_normalize_path(self):
        analyzer = RouteHealthAnalyzer([])
        
        assert analyzer._normalize_path("/users/{id}") == "/users/{param}"
        assert analyzer._normalize_path("/users/{user_id:int}") == "/users/{param}"
        assert analyzer._normalize_path("/users/me") == "/users/me"
        assert analyzer._normalize_path("/API/USERS") == "/api/users"
