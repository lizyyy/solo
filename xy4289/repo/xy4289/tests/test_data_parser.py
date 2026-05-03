import pytest
import os
import sys
import tempfile
from datetime import datetime, date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data_parser import DataParser


class TestDataParser:
    @pytest.fixture
    def parser(self):
        return DataParser()

    @pytest.fixture
    def temp_csv_dir(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            yield tmpdir

    def test_parse_time_various_formats(self, parser):
        test_cases = [
            ('2026-05-01 08:00:00', datetime(2026, 5, 1, 8, 0, 0)),
            ('2026-05-01 08:00', datetime(2026, 5, 1, 8, 0, 0)),
            ('2026/05/01 08:00:00', datetime(2026, 5, 1, 8, 0, 0)),
            ('2026/05/01 08:00', datetime(2026, 5, 1, 8, 0, 0)),
            ('2026-05-01', datetime(2026, 5, 1, 0, 0, 0)),
            ('2026/05/01', datetime(2026, 5, 1, 0, 0, 0)),
        ]

        for input_str, expected in test_cases:
            result = parser.parse_time(input_str)
            assert result == expected, f"Failed for {input_str}"

    def test_parse_time_none_cases(self, parser):
        assert parser.parse_time(None) is None
        assert parser.parse_time('') is None
        assert parser.parse_time('invalid') is None

    def test_load_machine_records(self, parser, temp_csv_dir):
        csv_content = """session_id,machine_id,patient_id,start_time,end_time,treatment_type
S001,M-001,P001,2026-05-01 08:00:00,2026-05-01 12:00:00,常规透析
S002,M-001,P002,2026-05-01 12:30:00,2026-05-01 16:30:00,常规透析
"""
        filepath = os.path.join(temp_csv_dir, 'machine_test.csv')
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(csv_content)

        df = parser.load_machine_records(filepath)

        assert len(df) == 2
        assert df.iloc[0]['machine_id'] == 'M-001'
        assert df.iloc[0]['duration_hours'] == 4.0
        assert df.iloc[0]['date'] == date(2026, 5, 1)

    def test_load_water_quality(self, parser, temp_csv_dir):
        csv_content = """test_id,test_time,conductivity,bacteria_count,endotoxin,ph,temperature,tester,remarks
WQ001,2026-05-01 08:00:00,0.08,50,0.01,7.2,25.5,张护士,正常
"""
        filepath = os.path.join(temp_csv_dir, 'water_test.csv')
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(csv_content)

        df = parser.load_water_quality(filepath)

        assert len(df) == 1
        assert df.iloc[0]['conductivity'] == 0.08
        assert df.iloc[0]['bacteria_count'] == 50
        assert df.iloc[0]['date'] == date(2026, 5, 1)

    def test_load_patient_schedule(self, parser, temp_csv_dir):
        csv_content = """patient_id,patient_name,treatment_time,machine_id,infection_type,doctor_notes
P001,张三,2026-05-01 08:00:00,M-001,,常规透析
P002,李四,2026-05-01 12:30:00,M-001,乙肝,高风险患者
"""
        filepath = os.path.join(temp_csv_dir, 'patient_test.csv')
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(csv_content)

        df = parser.load_patient_schedule(filepath)

        assert len(df) == 2
        assert df.iloc[0]['is_high_risk'] == False
        assert df.iloc[1]['is_high_risk'] == True
        assert df.iloc[1]['infection_type'] == '乙肝'

    def test_load_maintenance_records(self, parser, temp_csv_dir):
        csv_content = """maintenance_id,machine_id,fault_time,repair_time,resolved_time,fault_type,fault_description,technician,repair_notes
M001,M-001,2026-04-28 10:00:00,2026-04-28 14:00:00,2026-04-28 16:00:00,透析器压力异常,压力波动,王工程师,已修复
"""
        filepath = os.path.join(temp_csv_dir, 'maintenance_test.csv')
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(csv_content)

        df = parser.load_maintenance_records(filepath)

        assert len(df) == 1
        assert df.iloc[0]['machine_id'] == 'M-001'
        assert df.iloc[0]['downtime_hours'] == 6.0

    def test_get_all_data(self, parser):
        data = parser.get_all_data()
        
        assert 'machine_records' in data
        assert 'water_quality' in data
        assert 'patient_schedule' in data
        assert 'maintenance_records' in data
