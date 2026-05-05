import pytest
import pytest_asyncio
import json
import asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from pathlib import Path
import tempfile
import os

import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app
from database import Base, get_db
from config import get_settings


settings = get_settings()

TEST_DATABASE_URL = "sqlite+aiosqlite:///./test_redis_audit.db"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False}
)

TestingSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False
)


async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(scope="function")
async def test_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield
    
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client(test_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture(scope="function")
async def test_session(client):
    response = await client.post(
        "/api/v1/import/session",
        json={"session_name": "Test Session", "description": "Test description"}
    )
    assert response.status_code == 201
    return response.json()


class TestRootEndpoint:
    @pytest.mark.asyncio
    async def test_root(self, client):
        response = await client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "version" in data
        assert "status" in data

    @pytest.mark.asyncio
    async def test_health(self, client):
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"

    @pytest.mark.asyncio
    async def test_stats(self, client):
        response = await client.get("/api/v1/stats")
        assert response.status_code == 200


class TestSessionManagement:
    @pytest.mark.asyncio
    async def test_create_session(self, client, test_db):
        response = await client.post(
            "/api/v1/import/session",
            json={"session_name": "Test Audit Session", "description": "Test description"}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["session_name"] == "Test Audit Session"
        assert data["status"] == "pending"
        assert data["id"] > 0

    @pytest.mark.asyncio
    async def test_create_session_invalid_name(self, client, test_db):
        response = await client.post(
            "/api/v1/import/session",
            json={"session_name": ""}
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_session(self, client, test_session):
        session_id = test_session["id"]
        response = await client.get(f"/api/v1/import/session/{session_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == session_id
        assert data["session_name"] == test_session["session_name"]

    @pytest.mark.asyncio
    async def test_get_session_not_found(self, client):
        response = await client.get("/api/v1/import/session/999999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_list_sessions(self, client, test_session):
        response = await client.get("/api/v1/import/sessions?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    @pytest.mark.asyncio
    async def test_delete_session(self, client, test_session):
        session_id = test_session["id"]
        response = await client.delete(f"/api/v1/import/session/{session_id}")
        assert response.status_code == 204
        
        response2 = await client.get(f"/api/v1/import/session/{session_id}")
        assert response2.status_code == 404


class TestAnalyzerUnit:
    def test_detect_scenario_counter(self):
        from analyzer import RedisStructureAnalyzer
        analyzer = RedisStructureAnalyzer()
        
        scenario = analyzer.detect_scenario("user:clicks:1001", ["INCR"])
        assert scenario == "counter"
        
        scenario2 = analyzer.detect_scenario("counter:page:views", [])
        assert scenario2 == "counter"

    def test_detect_scenario_leaderboard(self):
        from analyzer import RedisStructureAnalyzer
        analyzer = RedisStructureAnalyzer()
        
        scenario = analyzer.detect_scenario("leaderboard:daily", ["ZADD"])
        assert scenario == "leaderboard"

    def test_evaluate_suitability_good(self):
        from analyzer import RedisStructureAnalyzer
        analyzer = RedisStructureAnalyzer()
        
        score, issues, suggestions = analyzer.evaluate_suitability("string", "counter")
        assert score >= 80
        assert len(issues) == 0

    def test_evaluate_suitability_bad(self):
        from analyzer import RedisStructureAnalyzer
        analyzer = RedisStructureAnalyzer()
        
        score, issues, suggestions = analyzer.evaluate_suitability("list", "deduplication")
        assert score <= 40
        assert len(issues) > 0

    def test_estimate_memory_string(self):
        from analyzer import RedisStructureAnalyzer
        analyzer = RedisStructureAnalyzer()
        
        memory = analyzer.estimate_memory("string", value_size=100)
        assert memory > 0

    def test_estimate_memory_hash(self):
        from analyzer import RedisStructureAnalyzer
        analyzer = RedisStructureAnalyzer()
        
        memory = analyzer.estimate_memory("hash", field_count=10)
        assert memory > 0

    def test_analyze_big_key_string(self):
        from analyzer import RedisStructureAnalyzer
        analyzer = RedisStructureAnalyzer()
        
        is_big, score, issues = analyzer.analyze_big_key("string", value_size=100000)
        assert is_big == True
        assert len(issues) > 0
        
        is_big2, score2, issues2 = analyzer.analyze_big_key("string", value_size=100)
        assert is_big2 == False

    def test_analyze_hot_key(self):
        from analyzer import RedisStructureAnalyzer
        analyzer = RedisStructureAnalyzer()
        
        is_hot, score, issues = analyzer.analyze_hot_key(2000, 1)
        assert is_hot == True
        
        is_hot2, score2, issues2 = analyzer.analyze_hot_key(100, 60)
        assert is_hot2 == False

    def test_analyze_ttl_risk_no_ttl_cache(self):
        from analyzer import RedisStructureAnalyzer
        analyzer = RedisStructureAnalyzer()
        
        risk_level, issues = analyzer.analyze_ttl_risk(-1, "string", "cache")
        assert risk_level == "high"
        assert len(issues) > 0

    def test_get_alternatives_comparison(self):
        from analyzer import RedisStructureAnalyzer
        analyzer = RedisStructureAnalyzer()
        
        alternatives = analyzer.get_alternatives_comparison("list", "counter", value_size=100)
        assert len(alternatives) > 0
        for alt in alternatives:
            assert "data_type" in alt
            assert "suitability_score" in alt

    def test_generate_summary(self):
        from analyzer import RedisStructureAnalyzer
        analyzer = RedisStructureAnalyzer()
        
        key_analyses = [
            {
                "current_type_suitability": 90.0,
                "is_hot_key": False,
                "is_big_key": False,
                "ttl_risk_level": "low",
                "migration_risk_level": "low",
            },
            {
                "current_type_suitability": 80.0,
                "is_hot_key": True,
                "is_big_key": False,
                "ttl_risk_level": "high",
                "migration_risk_level": "medium",
            }
        ]
        
        summary = analyzer.generate_summary(key_analyses)
        assert summary["total_keys"] == 2
        assert summary["hot_key_count"] == 1


class TestImportServiceUnit:
    def test_parse_timestamp_parsing(self):
        from import_service import DataImportService
        service = DataImportService()
        
        from datetime import datetime
        
        ts = service._parse_timestamp("2026-05-05T10:00:00")
        assert ts is not None
        assert ts.year == 2026

    def test_detect_read_write(self):
        from import_service import DataImportService
        service = DataImportService()
        
        assert service._detect_read_write("GET") == "read"
        assert service._detect_read_write("SET") == "write"
        assert service._detect_read_write("INCR") == "write"
        assert service._detect_read_write("HGET") == "read"

    def test_parse_int(self):
        from import_service import DataImportService
        service = DataImportService()
        
        assert service._parse_int("123") == 123
        assert service._parse_int(None) is None
        assert service._parse_int("abc") is None


class TestReportServiceUnit:
    def test_get_score_color(self):
        from report_service import ReportService
        service = ReportService()
        
        assert service._get_score_color(90) == "green"
        assert service._get_score_color(70) == "yellow"
        assert service._get_score_color(30) == "red"

    def test_get_score_label(self):
        from report_service import ReportService
        service = ReportService()
        
        assert service._get_score_label(90) == "Good"
        assert service._get_score_label(70) == "Fair"
        assert service._get_score_label(30) == "Poor"


class TestEndToEndWithMockData:
    @pytest.mark.asyncio
    async def test_full_workflow_with_csv_import(self, client, test_db):
        session_response = await client.post(
            "/api/v1/import/session",
            json={"session_name": "End-to-End Test", "description": "Full workflow test"}
        )
        assert session_response.status_code == 201
        session_data = session_response.json()
        session_id = session_data["id"]
        
        keys_csv_content = """key,type,ttl,memory,value_size,field_count,list_length,set_cardinality,zset_cardinality,tags,description
user:counter:clicks,string,3600,128,8,,,,,counter,Test counter
leaderboard:daily,zset,-1,65536,,,,,100,leaderboard,Test leaderboard
"""
        
        files = {"file": ("keys.csv", keys_csv_content, "text/csv")}
        import_response = await client.post(
            f"/api/v1/import/keys/{session_id}",
            files=files
        )
        assert import_response.status_code == 200
        import_data = import_response.json()
        assert import_data["keys_imported"] == 2
        
        list_response = await client.get(f"/api/v1/import/keys/{session_id}")
        assert list_response.status_code == 200
        keys = list_response.json()
        assert len(keys) == 2

    @pytest.mark.asyncio
    async def test_analysis_after_import(self, client, test_db):
        session_response = await client.post(
            "/api/v1/import/session",
            json={"session_name": "Analysis Test"}
        )
        session_id = session_response.json()["id"]
        
        keys_csv_content = """key,type,ttl,memory,value_size,tags,description
user:counter:1,string,3600,128,8,counter,Counter using string
user:bad_counter:1,hash,-1,512,100,counter,BAD: Counter using hash
"""
        files = {"file": ("keys.csv", keys_csv_content, "text/csv")}
        await client.post(f"/api/v1/import/keys/{session_id}", files=files)
        
        analysis_response = await client.post(f"/api/v1/analysis/{session_id}")
        assert analysis_response.status_code == 200
        analysis_data = analysis_response.json()
        
        assert "overall_score" in analysis_data
        assert "key_analyses" in analysis_data
        assert len(analysis_data["key_analyses"]) == 2
        
        key_analyses = analysis_data["key_analyses"]
        
        string_counter = None
        hash_counter = None
        
        for ka in key_analyses:
            if "bad_counter" in str(ka.get("key_id", "")):
                hash_counter = ka
            else:
                string_counter = ka

    @pytest.mark.asyncio
    async def test_report_generation(self, client, test_db):
        session_response = await client.post(
            "/api/v1/import/session",
            json={"session_name": "Report Test"}
        )
        session_id = session_response.json()["id"]
        
        keys_csv_content = """key,type,ttl,memory,value_size,tags,description
test:counter,string,3600,128,8,counter,Test
"""
        files = {"file": ("keys.csv", keys_csv_content, "text/csv")}
        await client.post(f"/api/v1/import/keys/{session_id}", files=files)
        
        await client.post(f"/api/v1/analysis/{session_id}")
        
        report_response = await client.post(
            "/api/v1/report/generate",
            json={
                "session_id": session_id,
                "report_type": "summary",
                "format": "json"
            }
        )
        assert report_response.status_code == 201
        report_data = report_response.json()
        assert "id" in report_data
        assert report_data["format"] == "json"
        assert report_data["report_type"] == "summary"

    @pytest.mark.asyncio
    async def test_confirmation_flow(self, client, test_db):
        session_response = await client.post(
            "/api/v1/import/session",
            json={"session_name": "Confirmation Test"}
        )
        session_id = session_response.json()["id"]
        
        keys_csv_content = """key,type,ttl,tags
test:counter,string,3600,counter
"""
        files = {"file": ("keys.csv", keys_csv_content, "text/csv")}
        await client.post(f"/api/v1/import/keys/{session_id}", files=files)
        
        await client.post(f"/api/v1/analysis/{session_id}")
        
        report_response = await client.post(
            "/api/v1/report/generate",
            json={
                "session_id": session_id,
                "report_type": "full",
                "format": "json"
            }
        )
        report_id = report_response.json()["id"]
        
        confirm_response = await client.post(
            "/api/v1/confirmation/",
            json={
                "session_id": session_id,
                "report_id": report_id,
                "confirmed_by": "test@example.com",
                "notes": "Test confirmation"
            }
        )
        assert confirm_response.status_code == 200
        confirm_data = confirm_response.json()
        assert confirm_data["human_confirmed"] == True
        assert confirm_data["confirmed_by"] == "test@example.com"

    @pytest.mark.asyncio
    async def test_comparison_generation(self, client, test_db):
        session_response = await client.post(
            "/api/v1/import/session",
            json={"session_name": "Comparison Test"}
        )
        session_id = session_response.json()["id"]
        
        keys_csv_content = """key,type,ttl,tags
test:counter,string,3600,counter
"""
        files = {"file": ("keys.csv", keys_csv_content, "text/csv")}
        await client.post(f"/api/v1/import/keys/{session_id}", files=files)
        
        await client.post(f"/api/v1/analysis/{session_id}")
        
        comparison_response = await client.post(f"/api/v1/comparison/{session_id}")
        assert comparison_response.status_code == 200
        comparisons = comparison_response.json()
        
        if comparisons:
            for comp in comparisons:
                assert "scenario" in comp
                assert "current_structure" in comp
                assert "alternatives" in comp


class TestBadPatternDetection:
    @pytest.mark.asyncio
    async def test_detect_big_key(self, client, test_db):
        session_response = await client.post(
            "/api/v1/import/session",
            json={"session_name": "Big Key Test"}
        )
        session_id = session_response.json()["id"]
        
        keys_csv_content = """key,type,ttl,value_size,list_length,tags
normal:string,string,3600,100,,,
big:string,string,3600,100000,,,cache
big:list,list,3600,,100000,queue
"""
        files = {"file": ("keys.csv", keys_csv_content, "text/csv")}
        await client.post(f"/api/v1/import/keys/{session_id}", files=files)
        
        analysis_response = await client.post(f"/api/v1/analysis/{session_id}")
        analysis_data = analysis_response.json()
        
        summary_response = await client.get(f"/api/v1/analysis/summary/{session_id}")
        summary_data = summary_response.json()
        
        assert "big_keys" in summary_data

    @pytest.mark.asyncio
    async def test_detect_ttl_risk(self, client, test_db):
        session_response = await client.post(
            "/api/v1/import/session",
            json={"session_name": "TTL Risk Test"}
        )
        session_id = session_response.json()["id"]
        
        keys_csv_content = """key,type,ttl,tags
good:cache,string,1800,cache
bad:cache,string,-1,cache
"""
        files = {"file": ("keys.csv", keys_csv_content, "text/csv")}
        await client.post(f"/api/v1/import/keys/{session_id}", files=files)
        
        await client.post(f"/api/v1/analysis/{session_id}")
        
        summary_response = await client.get(f"/api/v1/analysis/summary/{session_id}")
        summary_data = summary_response.json()
        
        assert "high_ttl_risk_keys" in summary_data
