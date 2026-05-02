import csv
import json
import re
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Iterator


class GCodeType(Enum):
    RAPID = "G0"
    LINEAR = "G1"
    ARC_CW = "G2"
    ARC_CCW = "G3"
    DWELL = "G4"
    TOOL_CHANGE = "M6"
    SPINDLE_ON = "M3"
    SPINDLE_OFF = "M5"
    COOLANT_ON = "M8"
    COOLANT_OFF = "M9"
    PROGRAM_END = "M30"
    COMMENT = "COMMENT"
    UNKNOWN = "UNKNOWN"


@dataclass
class GCodeBlock:
    line_number: int
    raw_line: str
    gcode_type: GCodeType
    x: Optional[float] = None
    y: Optional[float] = None
    z: Optional[float] = None
    i: Optional[float] = None
    j: Optional[float] = None
    k: Optional[float] = None
    r: Optional[float] = None
    f: Optional[float] = None
    s: Optional[float] = None
    t: Optional[int] = None
    m: Optional[int] = None
    g: Optional[int] = None
    comment: str = ""
    is_modal: bool = False

    @property
    def is_motion(self) -> bool:
        return self.gcode_type in [
            GCodeType.RAPID,
            GCodeType.LINEAR,
            GCodeType.ARC_CW,
            GCodeType.ARC_CCW,
        ]


@dataclass
class Tool:
    number: int
    name: str = ""
    type: str = "endmill"
    diameter: float = 0.0
    length: float = 0.0
    radius: float = 0.0
    flute_count: int = 0
    material: str = ""
    max_feed: Optional[float] = None
    max_speed: Optional[float] = None
    description: str = ""


@dataclass
class Fixture:
    name: str
    offset_x: float = 0.0
    offset_y: float = 0.0
    offset_z: float = 0.0
    min_x: Optional[float] = None
    max_x: Optional[float] = None
    min_y: Optional[float] = None
    max_y: Optional[float] = None
    min_z: Optional[float] = None
    max_z: Optional[float] = None
    description: str = ""


@dataclass
class Workpiece:
    name: str = "Workpiece"
    min_x: float = 0.0
    max_x: float = 100.0
    min_y: float = 0.0
    max_y: float = 100.0
    min_z: float = 0.0
    max_z: float = 50.0
    origin_x: float = 0.0
    origin_y: float = 0.0
    origin_z: float = 0.0


class GCodeParser:
    PATTERN_WORD = re.compile(r"([A-Z])([-+]?[\d.]+)")
    PATTERN_COMMENT_PAREN = re.compile(r"\(([^)]*)\)")
    PATTERN_COMMENT_SEMICOLON = re.compile(r";(.*)$")

    def __init__(self):
        self.last_x: Optional[float] = None
        self.last_y: Optional[float] = None
        self.last_z: Optional[float] = None
        self.current_g: int = 0
        self.modal_g: int = 0
        self.current_f: Optional[float] = None
        self.current_s: Optional[float] = None
        self.current_t: Optional[int] = None

    def reset(self):
        self.last_x = None
        self.last_y = None
        self.last_z = None
        self.current_g = 0
        self.modal_g = 0
        self.current_f = None
        self.current_s = None
        self.current_t = None

    def parse_line(self, line: str, line_number: int) -> GCodeBlock:
        original_line = line.strip()
        line_upper = original_line.upper()

        comment = ""
        match_comment = self.PATTERN_COMMENT_PAREN.search(line_upper)
        if match_comment:
            comment = match_comment.group(1).strip()
            line_upper = self.PATTERN_COMMENT_PAREN.sub("", line_upper)

        match_comment = self.PATTERN_COMMENT_SEMICOLON.search(line_upper)
        if match_comment:
            if not comment:
                comment = match_comment.group(1).strip()
            line_upper = self.PATTERN_COMMENT_SEMICOLON.sub("", line_upper)

        words = self.PATTERN_WORD.findall(line_upper)
        word_dict: Dict[str, str] = {k: v for k, v in words}

        if not words and comment:
            return GCodeBlock(
                line_number=line_number,
                raw_line=original_line,
                gcode_type=GCodeType.COMMENT,
                comment=comment,
            )

        if not words:
            return GCodeBlock(
                line_number=line_number,
                raw_line=original_line,
                gcode_type=GCodeType.UNKNOWN,
            )

        g_code: Optional[int] = None
        if "G" in word_dict:
            g_code = int(float(word_dict["G"]))
            self.modal_g = g_code
        else:
            g_code = self.modal_g

        m_code: Optional[int] = None
        if "M" in word_dict:
            m_code = int(float(word_dict["M"]))

        x: Optional[float] = self.last_x
        y: Optional[float] = self.last_y
        z: Optional[float] = self.last_z

        if "X" in word_dict:
            x = float(word_dict["X"])
        if "Y" in word_dict:
            y = float(word_dict["Y"])
        if "Z" in word_dict:
            z = float(word_dict["Z"])

        if "X" in word_dict or "Y" in word_dict or "Z" in word_dict:
            if x is not None:
                self.last_x = x
            if y is not None:
                self.last_y = y
            if z is not None:
                self.last_z = z

        f: Optional[float] = self.current_f
        if "F" in word_dict:
            f = float(word_dict["F"])
            self.current_f = f

        s: Optional[float] = self.current_s
        if "S" in word_dict:
            s = float(word_dict["S"])
            self.current_s = s

        t: Optional[int] = self.current_t
        if "T" in word_dict:
            t = int(float(word_dict["T"]))

        i: Optional[float] = None
        j: Optional[float] = None
        k: Optional[float] = None
        r: Optional[float] = None

        if "I" in word_dict:
            i = float(word_dict["I"])
        if "J" in word_dict:
            j = float(word_dict["J"])
        if "K" in word_dict:
            k = float(word_dict["K"])
        if "R" in word_dict:
            r = float(word_dict["R"])

        gcode_type = self._determine_gcode_type(g_code, m_code, t, word_dict)

        if t is not None and m_code != 6:
            self.current_t = t

        return GCodeBlock(
            line_number=line_number,
            raw_line=original_line,
            gcode_type=gcode_type,
            x=x,
            y=y,
            z=z,
            i=i,
            j=j,
            k=k,
            r=r,
            f=f,
            s=s,
            t=t,
            m=m_code,
            g=g_code,
            comment=comment,
        )

    def _determine_gcode_type(
        self, g: Optional[int], m: Optional[int], t: Optional[int], words: Dict[str, str]
    ) -> GCodeType:
        if m == 6:
            return GCodeType.TOOL_CHANGE
        if m == 3:
            return GCodeType.SPINDLE_ON
        if m == 5:
            return GCodeType.SPINDLE_OFF
        if m == 8:
            return GCodeType.COOLANT_ON
        if m == 9:
            return GCodeType.COOLANT_OFF
        if m == 30:
            return GCodeType.PROGRAM_END

        if g == 0:
            return GCodeType.RAPID
        if g == 1:
            return GCodeType.LINEAR
        if g == 2:
            return GCodeType.ARC_CW
        if g == 3:
            return GCodeType.ARC_CCW
        if g == 4:
            return GCodeType.DWELL

        return GCodeType.UNKNOWN

    def parse_file(self, filepath: Path) -> List[GCodeBlock]:
        self.reset()
        blocks = []
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            for line_num, line in enumerate(f, start=1):
                block = self.parse_line(line, line_num)
                blocks.append(block)
        return blocks


class ToolCSVParser:
    def parse(self, filepath: Path) -> List[Tool]:
        tools = []
        with open(filepath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                tool = self._row_to_tool(row)
                tools.append(tool)
        return tools

    def _row_to_tool(self, row: Dict[str, Any]) -> Tool:
        return Tool(
            number=int(self._get_value(row, ["number", "tool_number", "t", "tool", "id"], 0)),
            name=str(self._get_value(row, ["name", "tool_name", "description"], "")),
            type=str(self._get_value(row, ["type", "tool_type"], "endmill")),
            diameter=float(self._get_value(row, ["diameter", "dia", "d"], 0.0)),
            length=float(self._get_value(row, ["length", "len", "l"], 0.0)),
            radius=float(self._get_value(row, ["radius", "corner_radius", "r"], 0.0)),
            flute_count=int(self._get_value(row, ["flute_count", "flutes", "z"], 0)),
            material=str(self._get_value(row, ["material", "mat"], "")),
            max_feed=self._get_optional_float(row, ["max_feed", "feed_max"]),
            max_speed=self._get_optional_float(row, ["max_speed", "speed_max", "rpm_max"]),
            description=str(self._get_value(row, ["description", "notes", "remark"], "")),
        )

    def _get_value(self, row: Dict[str, Any], keys: List[str], default: Any) -> Any:
        for key in keys:
            if key in row and row[key]:
                return row[key]
        return default

    def _get_optional_float(self, row: Dict[str, Any], keys: List[str]) -> Optional[float]:
        for key in keys:
            if key in row and row[key]:
                try:
                    return float(row[key])
                except (ValueError, TypeError):
                    pass
        return None


class FixtureJSONParser:
    def parse(self, filepath: Path) -> List[Fixture]:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        fixtures = []
        if isinstance(data, list):
            for item in data:
                fixtures.append(self._dict_to_fixture(item))
        elif isinstance(data, dict):
            fixtures.append(self._dict_to_fixture(data))

        return fixtures

    def _dict_to_fixture(self, data: Dict[str, Any]) -> Fixture:
        return Fixture(
            name=str(data.get("name", data.get("fixture_name", "Unnamed Fixture"))),
            offset_x=float(data.get("offset_x", data.get("x_offset", 0.0))),
            offset_y=float(data.get("offset_y", data.get("y_offset", 0.0))),
            offset_z=float(data.get("offset_z", data.get("z_offset", 0.0))),
            min_x=self._get_optional_float(data, ["min_x", "bound_min_x"]),
            max_x=self._get_optional_float(data, ["max_x", "bound_max_x"]),
            min_y=self._get_optional_float(data, ["min_y", "bound_min_y"]),
            max_y=self._get_optional_float(data, ["max_y", "bound_max_y"]),
            min_z=self._get_optional_float(data, ["min_z", "bound_min_z"]),
            max_z=self._get_optional_float(data, ["max_z", "bound_max_z"]),
            description=str(data.get("description", data.get("notes", ""))),
        )

    def _get_optional_float(self, data: Dict[str, Any], keys: List[str]) -> Optional[float]:
        for key in keys:
            if key in data and data[key] is not None:
                try:
                    return float(data[key])
                except (ValueError, TypeError):
                    pass
        return None


class WorkpieceParser:
    def parse(self, filepath: Path) -> Workpiece:
        if filepath.suffix == ".json":
            return self._parse_json(filepath)
        elif filepath.suffix == ".csv":
            return self._parse_csv(filepath)
        return Workpiece()

    def _parse_json(self, filepath: Path) -> Workpiece:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        return Workpiece(
            name=str(data.get("name", data.get("workpiece_name", "Workpiece"))),
            min_x=float(data.get("min_x", 0.0)),
            max_x=float(data.get("max_x", 100.0)),
            min_y=float(data.get("min_y", 0.0)),
            max_y=float(data.get("max_y", 100.0)),
            min_z=float(data.get("min_z", 0.0)),
            max_z=float(data.get("max_z", 50.0)),
            origin_x=float(data.get("origin_x", data.get("offset_x", 0.0))),
            origin_y=float(data.get("origin_y", data.get("offset_y", 0.0))),
            origin_z=float(data.get("origin_z", data.get("offset_z", 0.0))),
        )

    def _parse_csv(self, filepath: Path) -> Workpiece:
        with open(filepath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            row = next(reader, {})

        def get_float(keys: List[str], default: float) -> float:
            for key in keys:
                if key in row and row[key]:
                    try:
                        return float(row[key])
                    except (ValueError, TypeError):
                        pass
            return default

        return Workpiece(
            name=str(row.get("name", row.get("workpiece_name", "Workpiece"))),
            min_x=get_float(["min_x"], 0.0),
            max_x=get_float(["max_x"], 100.0),
            min_y=get_float(["min_y"], 0.0),
            max_y=get_float(["max_y"], 100.0),
            min_z=get_float(["min_z"], 0.0),
            max_z=get_float(["max_z"], 50.0),
            origin_x=get_float(["origin_x", "offset_x"], 0.0),
            origin_y=get_float(["origin_y", "offset_y"], 0.0),
            origin_z=get_float(["origin_z", "offset_z"], 0.0),
        )
