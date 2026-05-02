"""CSV解析器测试"""

import pytest
from pathlib import Path
import tempfile
import pandas as pd

from kiln_validator.parsers import (
    parse_firing_plan_csv,
    parse_workpiece_csv,
    parse_probe_data_csv,
)


class TestPlanParser:
    """烧成计划解析测试"""

    def test_parse_basic_plan(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            csv_content = """plan_name,plan_description,firing_type,segment_type,name,start_temp_c,end_temp_c,duration_min
测试计划,单元测试,釉烧,ramp_up,升温段,25,500,120
测试计划,单元测试,釉烧,soak,保温段,500,500,30
测试计划,单元测试,釉烧,ramp_down,降温段,500,200,60
"""
            csv_path = Path(tmpdir) / "plan.csv"
            csv_path.write_text(csv_content, encoding="utf-8")
            
            plan = parse_firing_plan_csv(csv_path)
            
            assert plan.name == "测试计划"
            assert len(plan.segments) == 3
            assert plan.total_duration_minutes == 210
            
            ramp = plan.segments[0]
            assert ramp.segment_type.value == "ramp_up"
            assert ramp.ramp_rate_c_per_hour == 237.5

    def test_parse_chinese_column_names(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            csv_content = """计划名称,描述,烧成类型,段类型,段名,起始温度,结束温度,时间(分钟)
测试,测试,素烧,升温,加热,25,300,60
测试,测试,素烧,保温,保持,300,300,20
"""
            csv_path = Path(tmpdir) / "plan.csv"
            csv_path.write_text(csv_content, encoding="utf-8")
            
            plan = parse_firing_plan_csv(csv_path)
            
            assert len(plan.segments) == 2
            assert plan.segments[0].is_ramp_up
            assert plan.segments[1].is_soak


class TestWorkpieceParser:
    """作品清单解析测试"""

    def test_parse_workpieces_with_glaze(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            csv_content = """id,name,thickness_cm,clay_type,water_content,glaze_outer,glaze_inner
P001,小茶杯,0.8,瓷泥,3,透明釉;1180;1240,
P002,花瓶,2.0,陶泥,5,钧釉;1220;1280,透明釉;1180;1240
"""
            csv_path = Path(tmpdir) / "workpieces.csv"
            csv_path.write_text(csv_content, encoding="utf-8")
            
            workpieces = parse_workpiece_csv(csv_path)
            
            assert workpieces.count == 2
            assert workpieces.max_thickness_cm == 2.0
            
            p1 = workpieces.workpieces[0]
            assert p1.id == "P001"
            assert p1.thickness_cm == 0.8
            assert p1.glaze_outer is not None
            assert p1.glaze_outer.name == "透明釉"
            assert p1.glaze_outer.maturing_temp_min_c == 1180.0
            
            p2 = workpieces.workpieces[1]
            assert p2.glaze_inner is not None
            assert p2.glaze_inner.maturing_temp_max_c == 1240.0

    def test_parse_thickness_mm_conversion(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            csv_content = """编号,thickness_mm
P001,10
P002,20
"""
            csv_path = Path(tmpdir) / "workpieces.csv"
            csv_path.write_text(csv_content, encoding="utf-8")
            
            workpieces = parse_workpiece_csv(csv_path)
            
            assert workpieces.count == 2


class TestProbeParser:
    """探头数据解析测试"""

    def test_parse_simple_probe_data(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            csv_content = """time_minutes,temperature_c
0,25
10,75
20,125
30,175
"""
            csv_path = Path(tmpdir) / "probe.csv"
            csv_path.write_text(csv_content, encoding="utf-8")
            
            data = parse_probe_data_csv(csv_path)
            
            assert len(data) == 4
            assert data[0].time_minutes == 0
            assert data[0].temperature_c == 25.0
            assert data[-1].time_minutes == 30
            assert data[-1].temperature_c == 175.0

    def test_parse_chinese_time_temp(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            csv_content = """时间(分钟),温度(°C)
0,20
60,500
120,1000
"""
            csv_path = Path(tmpdir) / "probe.csv"
            csv_path.write_text(csv_content, encoding="utf-8")
            
            data = parse_probe_data_csv(csv_path)
            
            assert len(data) == 3
            assert data[1].time_minutes == 60
            assert data[1].temperature_c == 500.0

    def test_parse_multi_probe(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            csv_content = """time,probe_main,probe_upper,probe_lower
0,25,25,25
30,500,490,480
60,1000,990,985
"""
            csv_path = Path(tmpdir) / "probe.csv"
            csv_path.write_text(csv_content, encoding="utf-8")
            
            data = parse_probe_data_csv(csv_path)
            
            assert len(data) == 9
            
            probe_ids = sorted(set(p.probe_id for p in data))
            assert "main" in probe_ids
            assert "upper" in probe_ids
            assert "lower" in probe_ids
