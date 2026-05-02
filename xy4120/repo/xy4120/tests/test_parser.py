import pytest
from pathlib import Path

from gcode_guardian.parser import (
    GCodeParser,
    GCodeType,
    ToolCSVParser,
    FixtureJSONParser,
    WorkpieceParser,
)


class TestGCodeParser:
    def setup_method(self):
        self.parser = GCodeParser()

    def test_parse_line_rapid(self):
        block = self.parser.parse_line("G00 X10.0 Y20.0 Z5.0", 1)
        assert block.gcode_type == GCodeType.RAPID
        assert block.x == 10.0
        assert block.y == 20.0
        assert block.z == 5.0
        assert block.is_motion is True

    def test_parse_line_linear(self):
        block = self.parser.parse_line("G01 X100.0 Y50.0 F500.0", 2)
        assert block.gcode_type == GCodeType.LINEAR
        assert block.x == 100.0
        assert block.y == 50.0
        assert block.f == 500.0

    def test_parse_line_modal_g(self):
        block1 = self.parser.parse_line("G01 X10.0 F500", 1)
        block2 = self.parser.parse_line("Y20.0", 2)
        assert block1.g == 1
        assert block2.g == 1
        assert block2.y == 20.0

    def test_parse_line_tool_change(self):
        block = self.parser.parse_line("T01 M06", 10)
        assert block.gcode_type == GCodeType.TOOL_CHANGE
        assert block.t == 1
        assert block.m == 6

    def test_parse_line_spindle_on(self):
        block = self.parser.parse_line("S1500 M03", 5)
        assert block.gcode_type == GCodeType.SPINDLE_ON
        assert block.s == 1500.0
        assert block.m == 3

    def test_parse_line_comment_paren(self):
        block = self.parser.parse_line("(这是一个注释)", 1)
        assert block.gcode_type == GCodeType.COMMENT
        assert "注释" in block.comment

    def test_parse_line_comment_semicolon(self):
        block = self.parser.parse_line("G00 X10.0 ; 移动到安全位置", 1)
        assert block.gcode_type == GCodeType.RAPID
        assert "安全位置" in block.comment

    def test_parse_file_basic(self, tmp_path: Path):
        gcode_content = """%
O0001
G90 G54 G00 X0.0 Y0.0
G01 Z-5.0 F200.0
G00 Z50.0
M30
%
"""
        test_file = tmp_path / "test.nc"
        test_file.write_text(gcode_content)

        blocks = self.parser.parse_file(test_file)
        assert len(blocks) > 0

        motion_blocks = [b for b in blocks if b.is_motion]
        assert len(motion_blocks) >= 3


class TestToolCSVParser:
    def test_parse_valid_csv(self, tmp_path: Path):
        csv_content = """number,name,type,diameter,length,radius,flute_count,material,max_feed,max_speed,description
1,10mm 立铣刀,endmill,10.0,75.0,0.0,4,硬质合金,5000.0,8000.0,粗加工
2,6mm 钻头,drill,6.0,100.0,0.0,2,高速钢,3000.0,10000.0,钻孔
"""
        test_file = tmp_path / "tools.csv"
        test_file.write_text(csv_content)

        parser = ToolCSVParser()
        tools = parser.parse(test_file)

        assert len(tools) == 2
        assert tools[0].number == 1
        assert tools[0].name == "10mm 立铣刀"
        assert tools[0].diameter == 10.0
        assert tools[0].length == 75.0
        assert tools[1].number == 2
        assert tools[1].type == "drill"


class TestFixtureJSONParser:
    def test_parse_valid_json(self, tmp_path: Path):
        json_content = """[
  {
    "name": "虎钳左钳口",
    "offset_x": -100.0,
    "offset_y": 0.0,
    "offset_z": 0.0,
    "min_x": -120.0,
    "max_x": -80.0,
    "min_y": -50.0,
    "max_y": 50.0,
    "min_z": 0.0,
    "max_z": 150.0,
    "description": "左侧虎钳"
  }
]
"""
        test_file = tmp_path / "fixtures.json"
        test_file.write_text(json_content)

        parser = FixtureJSONParser()
        fixtures = parser.parse(test_file)

        assert len(fixtures) == 1
        assert fixtures[0].name == "虎钳左钳口"
        assert fixtures[0].offset_x == -100.0
        assert fixtures[0].min_x == -120.0
        assert fixtures[0].max_z == 150.0


class TestWorkpieceParser:
    def test_parse_json(self, tmp_path: Path):
        json_content = """{
  "name": "铝制面板",
  "min_x": 0.0,
  "max_x": 100.0,
  "min_y": 0.0,
  "max_y": 100.0,
  "min_z": -50.0,
  "max_z": 0.0,
  "origin_x": 0.0,
  "origin_y": 0.0,
  "origin_z": 0.0
}
"""
        test_file = tmp_path / "workpiece.json"
        test_file.write_text(json_content)

        parser = WorkpieceParser()
        wp = parser.parse(test_file)

        assert wp.name == "铝制面板"
        assert wp.min_x == 0.0
        assert wp.max_x == 100.0
        assert wp.min_z == -50.0
        assert wp.origin_z == 0.0
