import pytest
import json
from datetime import datetime


class TestHealth:
    @pytest.mark.asyncio
    async def test_health_check(self, test_client):
        response = await test_client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "version" in data
        assert "database" in data

    @pytest.mark.asyncio
    async def test_root_endpoint(self, test_client):
        response = await test_client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "version" in data
        assert "docs_url" in data

    @pytest.mark.asyncio
    async def test_stats_endpoint(self, test_client):
        response = await test_client.get("/api/stats")
        assert response.status_code == 200
        data = response.json()
        assert "cabins" in data
        assert "work_tickets" in data
        assert "sensor_logs" in data
        assert "ventilation_rules" in data
        assert "risk_anomalies" in data


class TestImportAPI:
    @pytest.mark.asyncio
    async def test_import_cabins_csv(self, test_client):
        csv_content = """舱室代码,舱室名称,面积,容积,位置,船名,描述
CAB-TEST-001,测试舱室A,50.0,150.0,主甲板,测试船,测试描述
"""
        files = {"file": ("cabins.csv", csv_content, "text/csv")}
        response = await test_client.post("/api/import/cabins", files=files)
        assert response.status_code == 200
        data = response.json()
        assert data["success_count"] == 1
        assert data["error_count"] == 0

    @pytest.mark.asyncio
    async def test_import_work_tickets_jsonl(self, test_client):
        jsonl_content = """{"ticket_no": "WT-TEST-001", "舱室代码": "CAB-TEST-001", "作业类型": "底漆喷涂", "开始时间": "2024-05-20 08:00:00", "结束时间": "2024-05-20 16:00:00", "status": "active"}
"""
        files = {"file": ("work_tickets.jsonl", jsonl_content, "application/jsonl")}
        response = await test_client.post("/api/import/work-tickets", files=files)
        assert response.status_code == 200
        data = response.json()
        assert data["success_count"] == 1

    @pytest.mark.asyncio
    async def test_import_sensor_logs_csv(self, test_client):
        csv_content = """传感器ID,舱室代码,时间戳,VOC值,单位,温度,湿度,排风速率,换气次数
SENSOR-TEST-001,CAB-TEST-001,2024-05-20 08:00:00,150,ppm,25.0,60.0,1000.0,35.0
"""
        files = {"file": ("sensor_logs.csv", csv_content, "text/csv")}
        response = await test_client.post("/api/import/sensor-logs", files=files)
        assert response.status_code == 200
        data = response.json()
        assert data["success_count"] == 1

    @pytest.mark.asyncio
    async def test_import_ventilation_rules_yaml(self, test_client):
        yaml_content = """- rule_code: RULE-TEST-001
  rule_name: 测试规则
  min_air_changes_per_hour: 30.0
  voc_threshold_ppm: 500.0
  is_active: true
  priority: 0
"""
        files = {"file": ("ventilation_rules.yaml", yaml_content, "application/x-yaml")}
        response = await test_client.post("/api/import/ventilation-rules", files=files)
        assert response.status_code == 200
        data = response.json()
        assert data["success_count"] == 1


class TestRiskDetection:
    @pytest.mark.asyncio
    async def test_run_risk_check(self, test_client):
        csv_content = """传感器ID,舱室代码,时间戳,VOC值,单位,温度,湿度,排风速率,换气次数
SENSOR-RISK-001,CAB-RISK-001,2024-05-20 08:00:00,600,ppm,25.0,60.0,500.0,20.0
"""
        files = {"file": ("sensor_logs.csv", csv_content, "text/csv")}
        await test_client.post("/api/import/sensor-logs", files=files)
        
        yaml_content = """- rule_code: RULE-RISK-001
  rule_name: 风险测试规则
  min_air_changes_per_hour: 30.0
  voc_threshold_ppm: 500.0
  is_active: true
  priority: 0
"""
        files = {"file": ("ventilation_rules.yaml", yaml_content, "application/x-yaml")}
        await test_client.post("/api/import/ventilation-rules", files=files)
        
        response = await test_client.post("/api/risk/check?clear_existing=true")
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "details" in data

    @pytest.mark.asyncio
    async def test_get_anomalies(self, test_client):
        response = await test_client.get("/api/risk/anomalies?is_confirmed=false")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestReportExport:
    @pytest.mark.asyncio
    async def test_export_markdown_report(self, test_client):
        response = await test_client.get("/api/report/export?format=markdown")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "content" in data

    @pytest.mark.asyncio
    async def test_export_csv_report(self, test_client):
        response = await test_client.get("/api/report/export?format=csv")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True

    @pytest.mark.asyncio
    async def test_export_json_report(self, test_client):
        response = await test_client.get("/api/report/export?format=json")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True


class TestVOCConverter:
    def test_ppm_to_mg_m3_conversion(self):
        from app.risk_detection import VOCConverter
        
        ppm_value = 500.0
        mg_m3_value = VOCConverter.ppm_to_mg_m3(ppm_value)
        
        assert mg_m3_value > 0

    def test_mg_m3_to_ppm_conversion(self):
        from app.risk_detection import VOCConverter
        
        mg_m3_value = 1500.0
        ppm_value = VOCConverter.mg_m3_to_ppm(mg_m3_value)
        
        assert ppm_value > 0

    def test_unit_consistency(self):
        from app.risk_detection import VOCConverter
        
        original_ppm = 500.0
        mg_m3 = VOCConverter.ppm_to_mg_m3(original_ppm)
        converted_back = VOCConverter.mg_m3_to_ppm(mg_m3)
        
        assert abs(converted_back - original_ppm) < 1.0


class TestWorkTicketOverlap:
    def test_normal_overlap(self):
        from app.database import WorkTicket
        from app.risk_detection import WorkTicketOverlapDetector
        
        class MockTicket:
            def __init__(self, start, end, cabin="CAB-001"):
                self.cabin_code = cabin
                self.start_time = datetime.strptime(start, "%Y-%m-%d %H:%M:%S")
                self.end_time = datetime.strptime(end, "%Y-%m-%d %H:%M:%S")
        
        ticket1 = MockTicket("2024-05-20 08:00:00", "2024-05-20 16:00:00")
        ticket2 = MockTicket("2024-05-20 14:00:00", "2024-05-20 22:00:00")
        
        assert WorkTicketOverlapDetector._check_overlap_midnight(ticket1, ticket2) == True

    def test_no_overlap(self):
        from app.risk_detection import WorkTicketOverlapDetector
        
        class MockTicket:
            def __init__(self, start, end, cabin="CAB-001"):
                self.cabin_code = cabin
                self.start_time = datetime.strptime(start, "%Y-%m-%d %H:%M:%S")
                self.end_time = datetime.strptime(end, "%Y-%m-%d %H:%M:%S")
        
        ticket1 = MockTicket("2024-05-20 08:00:00", "2024-05-20 12:00:00")
        ticket2 = MockTicket("2024-05-20 13:00:00", "2024-05-20 17:00:00")
        
        assert WorkTicketOverlapDetector._check_overlap_midnight(ticket1, ticket2) == False

    def test_midnight_overlap(self):
        from app.risk_detection import WorkTicketOverlapDetector
        
        class MockTicket:
            def __init__(self, start, end, cabin="CAB-001"):
                self.cabin_code = cabin
                self.start_time = datetime.strptime(start, "%Y-%m-%d %H:%M:%S")
                self.end_time = datetime.strptime(end, "%Y-%m-%d %H:%M:%S")
        
        ticket1 = MockTicket("2024-05-20 22:00:00", "2024-05-21 06:00:00")
        ticket2 = MockTicket("2024-05-21 04:00:00", "2024-05-21 12:00:00")
        
        assert WorkTicketOverlapDetector._check_overlap_midnight(ticket1, ticket2) == True
        assert WorkTicketOverlapDetector._spans_midnight(ticket1) == True
