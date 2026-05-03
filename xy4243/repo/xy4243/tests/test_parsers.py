import pytest
import csv
import tempfile
from pathlib import Path
from datetime import datetime

from app.parsers import (
    PropParser, SceneParser, ActorScheduleParser, ParseResult
)
from app.models import Prop, Scene, HandoverRecord, DangerLevel


class TestPropParser:
    def test_parse_valid_csv(self, tmp_path):
        csv_content = """name,category,danger_level,is_dangerous,total_quantity
罗密欧之剑,武器,MEDIUM,True,2
毒药瓶,容器,HIGH,True,1
朱丽叶的面纱,服饰,SAFE,False,3"""
        
        csv_file = tmp_path / "props.csv"
        csv_file.write_text(csv_content)

        parser = PropParser()
        result = parser.parse_file(csv_file)

        assert result.success is True
        assert len(result.records) == 3
        assert result.errors == []

        prop1 = result.records[0]
        assert prop1.name == "罗密欧之剑"
        assert prop1.category == "武器"
        assert prop1.danger_level == DangerLevel.MEDIUM
        assert prop1.is_dangerous is True
        assert prop1.total_quantity == 2

    def test_parse_with_missing_required_column(self, tmp_path):
        csv_content = """category,danger_level
武器,MEDIUM"""
        
        csv_file = tmp_path / "props.csv"
        csv_file.write_text(csv_content)

        parser = PropParser()
        result = parser.parse_file(csv_file)

        assert result.success is False
        assert len(result.errors) > 0
        assert "缺少必需列" in result.errors[0]

    def test_parse_empty_file(self, tmp_path):
        csv_file = tmp_path / "props.csv"
        csv_file.write_text("")

        parser = PropParser()
        result = parser.parse_file(csv_file)

        assert result.success is False
        assert "CSV文件为空" in result.errors[0]


class TestSceneParser:
    def test_parse_valid_csv(self, tmp_path):
        csv_content = """act_number,scene_number,title,duration_minutes,start_time,end_time
1,1,维洛那广场,15,2026-05-10T19:30:00,2026-05-10T19:45:00
1,2,凯普莱特家宴会,30,2026-05-10T19:45:00,2026-05-10T20:15:00"""
        
        csv_file = tmp_path / "scenes.csv"
        csv_file.write_text(csv_content)

        parser = SceneParser()
        result = parser.parse_file(csv_file)

        assert result.success is True
        assert len(result.records) == 2

        scene1 = result.records[0]
        assert scene1.act_number == 1
        assert scene1.scene_number == 1
        assert scene1.title == "维洛那广场"
        assert scene1.duration_minutes == 15

    def test_parse_with_missing_required_columns(self, tmp_path):
        csv_content = """title,duration_minutes
维洛那广场,15"""
        
        csv_file = tmp_path / "scenes.csv"
        csv_file.write_text(csv_content)

        parser = SceneParser()
        result = parser.parse_file(csv_file)

        assert result.success is False
        assert len(result.errors) >= 2


class TestActorScheduleParser:
    def test_parse_valid_csv(self, tmp_path):
        csv_content = """actor_name,scene_id,prop_name,quantity
罗密欧,scene_1_1,罗密欧之剑,1
朱丽叶,scene_1_2,朱丽叶的面纱,1"""
        
        csv_file = tmp_path / "handovers.csv"
        csv_file.write_text(csv_content)

        parser = ActorScheduleParser()
        result = parser.parse_file(csv_file)

        assert result.success is True
        assert len(result.records) == 2

        handover1 = result.records[0]
        assert handover1.actor_name == "罗密欧"
        assert handover1.scene_id == "scene_1_1"
        assert handover1.prop_name == "罗密欧之剑"
        assert handover1.quantity == 1

    def test_parse_with_existing_props_and_scenes(self, tmp_path):
        props = [
            Prop(id="prop_001", name="罗密欧之剑"),
            Prop(id="prop_002", name="毒药瓶")
        ]
        scenes = [
            Scene(id="scene_1_1", act_number=1, scene_number=1, title="维洛那广场")
        ]

        csv_content = """actor_name,scene_id,prop_name,quantity
罗密欧,scene_1_1,罗密欧之剑,1"""
        
        csv_file = tmp_path / "handovers.csv"
        csv_file.write_text(csv_content)

        parser = ActorScheduleParser(props=props, scenes=scenes)
        result = parser.parse_file(csv_file)

        assert result.success is True
        handover = result.records[0]
        assert handover.prop_id == "prop_001"
        assert handover.scene_title == "第1幕 - 第1场 - 维洛那广场"

    def test_parse_with_missing_required_columns(self, tmp_path):
        csv_content = """actor_name,prop_name
罗密欧,罗密欧之剑"""
        
        csv_file = tmp_path / "handovers.csv"
        csv_file.write_text(csv_content)

        parser = ActorScheduleParser()
        result = parser.parse_file(csv_file)

        assert result.success is False
        assert len(result.errors) > 0
